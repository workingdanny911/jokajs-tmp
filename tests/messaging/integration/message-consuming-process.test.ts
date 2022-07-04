import { Message } from '@joka/core';
import { createNullMessages } from '@joka/testing';
import {
    AllMessageTypes,
    MessageConsumingProcess,
    RedisStreamMessageConsumerGroup,
} from '@joka/messaging';
import { RedisClient } from '@joka/utils';
import container from '../container';

const messageConsumerSpies = [...Array(5).keys()].map((i) => ({
    name: `spy-${i}`,
    subjects: '*' as AllMessageTypes,
    consume: jest.fn(async () => {
        return;
    }),
}));

const GROUP = '_test-message-consuming-process__group';
const STREAM = '_test-message-consuming-process__stream';
const CONSUMER = 'consumer';
describe('MessageConsumingProcess', () => {
    const redis = container.get<RedisClient>('RedisClient');
    const consumerGroup = new RedisStreamMessageConsumerGroup(
        {
            group: GROUP,
            stream: STREAM,
            consumer: CONSUMER,
        },
        redis
    );
    for (const spy of messageConsumerSpies) {
        consumerGroup.join(spy);
    }
    const process = new MessageConsumingProcess(consumerGroup);

    async function appendMessagesToStream(messages: Message[]) {
        const transaction = redis.multi();
        for (const message of messages) {
            transaction.xAdd(STREAM, '*', { value: message.toJSONString() });
        }
        await transaction.exec();
    }

    beforeEach(async () => {
        jest.clearAllMocks();
        await redis.connect();
        await consumerGroup.create(true);
    });

    afterAll(container.unbindAllAsync);

    test('consuming messages', async () => {
        const messages = createNullMessages(10);
        await appendMessagesToStream(messages);

        await process.run(1);

        for (const spy of messageConsumerSpies) {
            expect(spy.consume).toHaveBeenCalledTimes(messages.length);
            for (const message of messages) {
                const index = messages.indexOf(message);
                expect(spy.consume.mock.calls[index]).toContainEqual(message);
            }
        }
    });
});
