import { ErrorWithDetails } from '../utils';

import { Command, Event, Message } from './message';

export type EntityId = number | string;

export abstract class Entity<TId extends EntityId> {
    id: TId;

    constructor(id: TId) {
        this.id = id;
    }
}

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

export abstract class Aggregate<
    TId extends EntityId,
    TData = Record<string, unknown>
> extends Entity<TId> {
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
        const applierName = `when${event.type}` as keyof this;
        const applier = this[applierName] as unknown as (
            data: Message['data']
        ) => void;
        if (!applier) {
            throw new Error(`Event '${event.type}' cannot be handled.`);
        }
        applier.bind(this)(event.data);
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
            { type: eventType, causationMessageId: this.causationCommandId }
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
