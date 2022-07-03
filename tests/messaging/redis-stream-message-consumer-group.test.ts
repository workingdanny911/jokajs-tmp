import { Message } from 'joka/core';
import { RedisClient } from 'joka/utils';
import {
    MessageConsumer,
    MessageWithRId,
    RedisStreamMessageConsumerGroup,
} from 'joka/messaging';
import { createNullMessages, createRedisClient } from 'joka/testing';

const STREAM = '_test-stream__redis-stream-message-consumer-group';
const GROUP = '_test-group__redis-stream-message-consumer-group';
const CONSUMER = 'consumer';

describe('RedisStreamMessageConsumerGroup', () => {
    const redis = createRedisClient();
    const consumerGroup = new RedisStreamMessageConsumerGroup(
        {
            group: GROUP,
            stream: STREAM,
            consumer: CONSUMER,
        },
        redis
    );

    const messages = createNullMessages(10);
    const dummyConsumer = {
        name: 'dummy',
        subjects: '*',
        consume: jest.fn(async (message: Message) => {
            return;
        }),
    } as MessageConsumer<Message>;

    beforeAll(async () => {
        await redis.connect();
    });

    async function appendMessages(
        messages: Message[],
        _redis: RedisClient = redis
    ) {
        const transaction = _redis.multi();
        for (const message of messages) {
            transaction.xAdd(STREAM, '*', {
                value: message.toJSONString(),
            });
        }
        await transaction.exec();
    }

    async function clearMessages() {
        await redis.xTrim(STREAM, 'MAXLEN', 0);
    }

    function extractMessagesOnly(messagesWithRId: MessageWithRId[]) {
        return messagesWithRId.map(({ message }) => message);
    }

    beforeEach(async () => {
        await redis.flushDb();
        await redis.xGroupCreate(STREAM, GROUP, '$', {
            MKSTREAM: true,
        });
        await appendMessages(messages);
    });

    async function hasGroup(stream: string, group: string) {
        const xInfoGroupsReply = await redis.xInfoGroups(STREAM);
        let found = false;
        for (const group of xInfoGroupsReply) {
            if (group.name === GROUP) {
                found = true;
                break;
            }
        }
        return found;
    }

    test('creating consumer group', async () => {
        await redis.xGroupDestroy(STREAM, GROUP);

        await consumerGroup.create();

        expect(await hasGroup(STREAM, GROUP)).toBe(true);
    });

    test('fetching new messages - empty', async () => {
        await clearMessages();

        expect(await consumerGroup.fetchNewMessages()).toEqual([]);
    });

    test('fetching new messages - with messages', async () => {
        const messagesFetched = await consumerGroup.fetchNewMessages();

        expect(extractMessagesOnly(messagesFetched)).toEqual(messages);
    });

    test('fetching new messages - with chunk size', async () => {
        const messagesFetched = await consumerGroup.fetchNewMessages({
            chunkSize: 1,
        });

        expect(extractMessagesOnly(messagesFetched)).toEqual(
            messages.slice(0, 1)
        );
    });

    test('fetching new messages - with block for', async () => {
        await clearMessages();
        const redis2 = createRedisClient();
        await redis2.connect();
        const fetchMessagesPromise = consumerGroup.fetchNewMessages({
            blockFor: 100,
        });
        await appendMessages(messages, redis2);

        const messagesFetched = await fetchMessagesPromise;
        expect(extractMessagesOnly(messagesFetched)).toEqual(messages);
    });

    test('fetching pending messages - empty', async () => {
        await clearMessages();

        expect(await consumerGroup.fetchPendingMessages()).toEqual({
            nextPendingMessageRId: '0-0',
            messagesWithRId: [],
        });
    });

    test.skip('fetching pending messages', async () => {
        return;
    });

    test.skip('fetching pending messages - with chunk size', async () => {
        return;
    });

    test.skip('fetching pending messages - with min idle time', async () => {
        return;
    });

    test.skip('fetching pending messages - with start id', async () => {
        return;
    });

    test('processing new messages', async () => {
        consumerGroup.join(dummyConsumer);

        await consumerGroup.processNewMessages();

        const numberOfMessages = messages.length;
        expect(dummyConsumer.consume).toHaveBeenCalledTimes(numberOfMessages);

        for (const message of messages) {
            const index = messages.indexOf(message);
            const consume = dummyConsumer.consume as jest.Mock;
            expect(consume.mock.calls[index][0]).toEqual(message);
        }
    });

    test('sends acks after successful processing', async () => {
        consumerGroup.join(dummyConsumer);

        await consumerGroup.processNewMessages();

        const xPendingResult = await redis.xPending(STREAM, GROUP);
        expect(xPendingResult.pending).toBe(0);
    });

    test('does not send ack when one or more consumers failed', async () => {
        const numberOfMessages = messages.length;
        const succeedingConsumer = dummyConsumer;
        // fails on every message except the last one
        const failingConsumer = {
            name: 'failing',
            subjects: '*',
            consume: async (message: Message<{ value: number }>) => {
                const isLastMessage =
                    message.id === messages[numberOfMessages - 1].id;
                if (!isLastMessage) {
                    throw new Error('error');
                }
            },
        } as MessageConsumer;
        consumerGroup.join(succeedingConsumer);
        consumerGroup.join(failingConsumer);

        await consumerGroup.processNewMessages();

        const xPendingResult = await redis.xPending(STREAM, GROUP);
        expect(xPendingResult.pending).toBe(numberOfMessages - 1); // only the last message is acked
    });
});
