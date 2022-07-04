import { Sequelize } from 'sequelize';

import { Message, UnitOfWork } from '@joka/core';
import {
    IdempotentMessageConsumer,
    SequelizeMessageTracker,
} from '@joka/messaging';

import container from './container';

class IdempotentMessageConsumerSpy extends IdempotentMessageConsumer {
    name = 'dummy';
    subjects = new Set(['FooMessage']);
    messagesReceived: Message[] = [];

    protected async consumeNewMessage(
        message: Message,
        chunkInfo: { size: number; current: number }
    ) {
        this.messagesReceived.push(message);
    }
}

describe('IdempotentMessageConsumer', () => {
    const sequelize = container.get<Sequelize>('Sequelize');
    SequelizeMessageTracker.defineModel(sequelize);
    const model = SequelizeMessageTracker.model;

    const tracker = new SequelizeMessageTracker(sequelize);

    function createConsumer() {
        return new IdempotentMessageConsumerSpy(
            tracker,
            container.get<UnitOfWork>('UnitOfWork')
        );
    }

    const consumer = createConsumer();

    beforeEach(async () => {
        await model.sync({ force: true });
    });

    afterAll(container.unbindAllAsync);

    test('idempotency', async () => {
        const message = new Message<null>(null);
        const message2 = new Message<null>(null);
        message2._id = message.id;

        for (let i = 0; i < 3; i++) {
            await consumer.consume(message, { size: 10, current: i });
            await consumer.consume(message2, { size: 10, current: i });
        }

        expect(consumer.messagesReceived.length).toBe(1);
    });

    test('race condition', async () => {
        const consumers = Array.from({ length: 5 }, () => createConsumer());
        const message = new Message<null>(null);

        let updates: Promise<void>[] = [];
        for (let i = 0; i < 10; i++) {
            updates = [
                ...consumers.map((consumer) =>
                    consumer.consume(message, { size: 10, current: i })
                ),
            ];
        }
        await Promise.all(updates);

        expect(
            consumers.map((consumer) => consumer.messagesReceived.length)
        ).toEqual([1, 0, 0, 0, 0]);
    });
});
