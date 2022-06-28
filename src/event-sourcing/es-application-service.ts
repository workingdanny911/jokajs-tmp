import {
    Aggregate,
    ApplicationService,
    Command,
    Event,
    UnitOfWork,
} from 'joka/core';
import { Class } from 'joka/utils';

import { MDBMessageStore, MDBRawMessage } from './mdb-message-store';

export abstract class ESApplicationService<
    TAggregate extends Aggregate<any, unknown>
> extends ApplicationService {
    protected abstract aggregateClass: Class<TAggregate>;
    protected abstract events: {
        [eventType: string]: { new (...args: any[]): Event };
    };

    messageStore: MDBMessageStore;

    constructor({
        unitOfWork,
        messageStore,
    }: {
        unitOfWork: UnitOfWork;
        messageStore: MDBMessageStore;
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

    deserializeRawEvent(raw: MDBRawMessage) {
        return MDBMessageStore.deserializeRawMessage(raw, this.events);
    }

    async saveAggregate(aggregate: TAggregate) {
        await this.messageStore.appendMessages(
            this.getStreamName(aggregate.id),
            aggregate.version,
            aggregate.events
        );
    }
}
