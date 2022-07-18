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
``;
function getEventHandlerMetadataKey(
    aggregatePrototype: any,
    eventType: string
) {
    const aggregateClass = aggregatePrototype.constructor;
    const namespace = aggregateClass.namespace;

    let key = EVENT_HANDLERS_NAMESPACE;
    if (namespace) {
        key += `.${namespace}`;
    }
    return `${key}.${aggregatePrototype.constructor.name}.${eventType}`;
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

export function When(eventType: string) {
    return (
        aggregatePrototype: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
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
            this.when(event);
        }
        const lastEvent = events.slice(-1)[0];
        this.version = lastEvent.streamPosition;
    }

    protected when(event: Event) {
        const eventHandler = getEventHandler(this, event.type);
        if (!eventHandler) {
            throw new Error(`Event '${event.type}' cannot be handled.`);
        }
        eventHandler.call(this, event['data'], event);
    }

    protected raise<TEvent extends Event = Event<TId, any>>(
        eventType: TEvent['type'],
        data: Omit<TEvent['data'], 'aggregateId'>
    ) {
        const event = new Message<any>(
            {
                aggregateId: this.id,
                ...data,
            },
            {
                type: eventType,
                causationMessageId: this.causationCommandId,
                namespace: (this.constructor as any).namespace,
            }
        ) as Event;
        this.when(event);
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
