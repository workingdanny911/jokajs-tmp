import {
    Aggregate,
    ApplicationService,
    Command,
    Event,
    UnitOfWork,
} from '@joka/core';
import { Class } from '@joka/utils';

import { MDBEventStore, MDBRawEvent } from './mdb-event-store';

export abstract class ESApplicationService<
    TAggregate extends Aggregate<any, unknown>
> extends ApplicationService {
    protected abstract aggregateClass: Class<TAggregate>;
    protected abstract events: {
        [eventType: string]: { new (...args: any[]): Event };
    };

    messageStore: MDBEventStore;

    constructor({
        unitOfWork,
        messageStore,
    }: {
        unitOfWork: UnitOfWork;
        messageStore: MDBEventStore;
    }) {
        super({ unitOfWork });
        this.messageStore = messageStore;
    }

    async loadAggregate(
        id: TAggregate['id'],
        causationCommandId?: Command['id'],
        ...rest: any[]
    ) {
        const events = await this.messageStore.getStream(
            this.getStreamName(id),
            (raw) => this.deserializeRawEvent(raw)
        );
        return new this.aggregateClass(
            {
                id,
                events,
                causationCommandId,
            },
            ...rest
        );
    }

    getStreamName(id: TAggregate['id']) {
        return `${this.aggregateClass.name}-${id}`;
    }

    deserializeRawEvent(raw: MDBRawEvent) {
        return MDBEventStore.deserializeRawMDBEvent(raw);
    }

    async saveAggregate(aggregate: TAggregate) {
        await this.messageStore.appendEvents(
            this.getStreamName(aggregate.id),
            aggregate.version,
            aggregate.events
        );
    }
}
