import 'reflect-metadata';

import { ErrorWithDetails } from '@jokajs/utils';

import { Command, Event, Message } from './message';
import { Entity, EntityId } from './entity';

export interface AggregateConstructorArgs<
    TId extends EntityId,
    TData = Record<string, unknown>
> {
    id: TId;
    causationCommandId?: Command['id'];
    data?: TData;
    events?: Event[];
}

export class AggregateError<TDetails = any> extends ErrorWithDetails<
    TDetails & {
        meta: {
            aggregateName: string;
            aggregateId: any;
            causationCommandId?: string;
        };
    }
> {}

const EVENT_HANDLERS_NAMESPACE = '__aggregate_event_handlers__';

function getEventHandlerMetadataKey(
    aggregatePrototype: any,
    eventType: string
) {
    const aggregateClass = aggregatePrototype.constructor;
    return `${aggregateClass.name}.${eventType}`;
}

function getEventHandler(aggregateObject: any, eventType: string) {
    const prototype = Object.getPrototypeOf(aggregateObject);
    return Reflect.getMetadata(
        getEventHandlerMetadataKey(prototype, eventType),
        prototype
    );
}

function reflectEventHandler(
    aggregatePrototype: any,
    eventType: string,
    eventHandler: any
) {
    Reflect.defineMetadata(
        getEventHandlerMetadataKey(aggregatePrototype, eventType),
        eventHandler,
        aggregatePrototype
    );
}

type EventHandler<T extends Event = Event<any, any>> =
    | ((data: T['data']) => void)
    | ((data: T['data'], event: T) => void);

export function When<T extends Event = Event<any, any>>(eventType: string) {
    return (
        aggregatePrototype: any,
        propertyKey: string,
        descriptor: TypedPropertyDescriptor<EventHandler<T>>
    ) => {
        reflectEventHandler(aggregatePrototype, eventType, descriptor.value);
    };
}

export abstract class Aggregate<
    TId extends EntityId,
    TData = Record<string, unknown>
> extends Entity<TId> {
    static readonly namespace: string;

    events: Event[] = [];
    version = -1;
    causationCommandId?: Command['id'];

    constructor({
        id,
        causationCommandId,
        data,
        events,
    }: AggregateConstructorArgs<TId, TData>) {
        super(id);
        this.version = -1;
        this.causationCommandId = causationCommandId;

        if (data && events) {
            throw new AggregateError(
                'Cannot initialize aggregate with both data and events'
            );
        }

        if (data) {
            this.raiseInitialEvents(data);
            if (this.events.length === 0) {
                throw new Error(
                    `At least one event must be raised in '.raiseEventOfCreation()'.`
                );
            }
            this.afterCreation();
        } else if (events) {
            this.applyEvents(events);
        }
    }

    protected afterCreation() {
        // noop
    }

    protected applyEvents(events: Event[]) {
        for (const event of events) {
            this.dispatch(event);
        }
        const lastEvent = events.slice(-1)[0];
        this.version = lastEvent.streamPosition;
    }

    protected dispatch(event: Event) {
        const eventHandler = getEventHandler(this, event.type);
        if (!eventHandler) {
            throw new Error(`Event '${event.type}' cannot be handled.`);
        }
        eventHandler.call(this, event['data'], event);
    }

    protected raise<TEvent extends Event = Event<any, TId>>(
        eventType: TEvent['type'],
        data: Omit<TEvent['data'], 'aggregateId'>
    ) {
        const thisClass = this.constructor as any;
        const namespace = thisClass.namespace ?? thisClass.name;

        const event = new Message<any>(
            {
                aggregateId: this.id,
                ...data,
            },
            {
                namespace,
                type: eventType,
                causationMessageId: this.causationCommandId,
            }
        ) as Event;
        this.dispatch(event);

        this.events.push(event);
    }

    protected abstract raiseInitialEvents(data: TData): void;

    public flushEvents() {
        this.events = [];
    }

    protected throwError<TDetails = any>(
        type: string,
        message: string,
        details = {} as TDetails
    ) {
        const error = new AggregateError<TDetails>(message, {
            ...details,
            meta: {
                aggregate: this.constructor.name,
                aggregateId: this.id,
                causationCommandId: this.causationCommandId,
            },
        });
        error.name = type;
        throw error;
    }
}
