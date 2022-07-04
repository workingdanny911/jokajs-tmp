import { Command, Event, Message } from './message';
import {ErrorWithDetails} from "../utils/error";

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

export class AggregateError extends ErrorWithDetails {}

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

    protected applyEvents(events: Message[]) {
        for (const event of events) {
            this.when(event);
        }
        const lastEvent = events.slice(-1)[0];
        this.version = lastEvent.streamPosition;
    }

    protected when(event: Message) {
        const applierName = `when${event.type}` as keyof this;
        const applier = this[applierName] as unknown as (
            data: Message['data']
        ) => void;
        if (!applier) {
            throw new Error(`Event '${event.type}' cannot be handled.`);
        }
        applier.bind(this)(event.data);
    }

    protected raise<T extends Event = Event<TId, any>>(
        eventClass: { new (...args: any[]): T },
        data: Omit<T['data'], 'aggregateId'>
    ) {
        const event = new eventClass(
            {
                aggregateId: this.id,
                ...data,
            },
            { causationMessageId: this.causationCommandId }
        );
        this.when(event);
        this.events.push(event);
    }

    protected abstract raiseInitialEvents(data: TData): void;

    public flushEvents() {
        this.events = [];
    }

    protected throwError(
        errorClass: { new (...args: any[]): AggregateError },
        message: string,
        additionalDetails = {}
    ) {
        throw new errorClass(message, {
            ...additionalDetails,
            meta: {
                aggregate: this.constructor.name,
                aggregateId: this.id,
                causationCommandId: this.causationCommandId,
            },
        });
    }
}
