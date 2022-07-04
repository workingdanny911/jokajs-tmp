import { Message } from '@joka/core';
import { RedisClient } from '@joka/utils';
import { MessageWithRId, RedisStreamMessagePublisher } from '@joka/messaging';
import { createNullMessages } from '@joka/testing';

import container from './container';

const STREAM = '_test-stream__redis-stream-message-publisher';
describe('RedisStreamMessagePublisher', () => {
    const redis = container.get<RedisClient>('RedisClient');
    const publisher = new RedisStreamMessagePublisher(STREAM, redis);

    beforeAll(async () => {
        await redis.connect();
    });
    beforeEach(async () => {
        await redis.del(STREAM);
    });
    afterAll(container.unbindAllAsync);

    test('publishing - with empty messages', async () => {
        const result = await publisher.publish([]);

        expect(result).toEqual([]);
    });

    async function expectMessagesFromStream(
        expectedMessages: Message[],
        start = '-',
        end = '+'
    ) {
        const result = await redis.xRange(STREAM, start, end);
        const messagesInStream = result.map(({ message: raw }) =>
            Message.fromJSONString(raw.value)
        );
        expect(messagesInStream).toEqual(expectedMessages);
    }

    test('publishing - without rid', async () => {
        const messages = createNullMessages(10);

        const result = await publisher.publish(messages);

        await expectMessagesFromStream(
            messages,
            result[0],
            result[result.length - 1]
        );
    });

    test('publishing - with rid', async () => {
        const messagesWithRId = createNullMessages(10).map(
            (message, i) =>
                ({
                    rId: i + 1,
                    message,
                } as MessageWithRId)
        );

        const result = await publisher.publish(messagesWithRId);

        await expectMessagesFromStream(
            messagesWithRId.map(({ message }) => message),
            result[0],
            result[result.length - 1]
        );
    });
});
