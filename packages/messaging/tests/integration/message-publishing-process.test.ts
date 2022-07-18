import { Sequelize } from 'sequelize';

import { SequelizeUnitOfWork } from '@jokajs/core';
import {
    MessagePublishingProcess,
    RedisStreamMessagePublisher,
    RedisStreamSerializer,
    SequelizeMessageStore,
} from '@jokajs/messaging';
import { createVoidMessages } from '@jokajs/testing';
import { RedisClient } from '@jokajs/utils';

import container from '../container';

const REDIS_MESSAGE_STREAM = '_test-stream-run-message-publisher';
describe('MessagePublishingProcess', () => {
    // long running test
    jest.setTimeout(60000);

    const sequelize = container.get<Sequelize>('Sequelize');
    const unitOfWork = new SequelizeUnitOfWork(sequelize);

    SequelizeMessageStore.defineModel(sequelize);
    const model = SequelizeMessageStore.model;
    const messageStore = new SequelizeMessageStore(sequelize);

    const redis = container.get<RedisClient>('RedisClient');
    const publisher = new RedisStreamMessagePublisher(
        REDIS_MESSAGE_STREAM,
        redis
    );

    const process = new MessagePublishingProcess(
        publisher,
        messageStore,
        unitOfWork
    );

    const messages = createVoidMessages(10);

    beforeAll(async () => {
        await Promise.all([model.sync({ force: true }), redis.connect()]);
    });

    afterAll(async () => {
        await redis.quit();
        await container.unbindAllAsync();
    });

    beforeEach(async () => {
        await Promise.all([
            model.truncate(),
            redis.del(REDIS_MESSAGE_STREAM),
            messageStore.append(messages),
        ]);
    });

    test('publishes messages to redis stream', async () => {
        await process.run(1);

        const redisStream = await redis.xRange(REDIS_MESSAGE_STREAM, '-', '+');
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const { message: raw } = redisStream[i];
            expect(RedisStreamSerializer.deserialize(raw)).toEqual(message);

            const isPublished = await messageStore.isPublished(message.id);
            expect(isPublished).toBe(true);
        }
    });

    test('does not mark messages as published until they are published', async () => {
        const originalPublish = publisher.publish;
        publisher.publish = jest.fn(async (...args: any[]) => {
            throw new Error('publishing failed');
        });

        await process.run(1);

        for (const message of messages) {
            const isPublished = await messageStore.isPublished(message.id);
            expect(isPublished).toBe(false);
        }

        publisher.publish = originalPublish;
    });
});
