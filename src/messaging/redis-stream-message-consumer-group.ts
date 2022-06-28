import { Message } from 'joka/core';
import { PromiseSettledResult, RedisClient } from 'joka/utils';

import { MessageSubscriptions } from './message-subscriptions';
import { MessageConsumer } from './message-consumer';
import { MessageWithRId, RedisStreamSerializer } from './helpers';

interface RedisStreamMessageConsumerGroupOptions {
    group: string;
    stream: string;
    consumer?: string;
}

export class RedisStreamMessageConsumerGroup {
    public static DEFAULT_CONSUMER = 'default';

    private readonly options: RedisStreamMessageConsumerGroupOptions & {
        consumer: string;
    };
    private readonly subscriptions: MessageSubscriptions =
        new MessageSubscriptions();

    constructor(
        options: RedisStreamMessageConsumerGroupOptions,
        private readonly redis: RedisClient
    ) {
        this.redis = redis;

        const consumer =
            options.consumer ||
            RedisStreamMessageConsumerGroup.DEFAULT_CONSUMER;
        this.options = {
            consumer,
            ...options,
        };
    }

    public async create(createStream = false) {
        const { group, stream } = this.options;

        const commandArgs: Parameters<typeof this.redis.xGroupCreate> = [
            stream,
            group,
            '0',
        ];
        if (createStream) {
            commandArgs.push({ MKSTREAM: true });
        }
        try {
            await this.redis.xGroupCreate(...commandArgs);
        } catch (e: any) {
            const doesGroupAlreadyExist = e.message.includes('BUSYGROUP');
            if (doesGroupAlreadyExist) {
                return;
            }

            throw e;
        }
    }

    public async fetchNewMessages(params?: {
        chunkSize?: number;
        blockFor?: number;
    }): Promise<MessageWithRId[]> {
        const { group, stream, consumer = 'default' } = this.options;
        const { chunkSize = 100, blockFor } = params || {};

        const result = await this.redis.xReadGroup(
            group,
            consumer,
            { key: stream, id: '>' },
            {
                COUNT: chunkSize,
                BLOCK: blockFor,
            }
        );

        if (!result) {
            return [];
        }

        const rawMessages: Array<{ id: string; message: any }> =
            result[0].messages;
        return rawMessages.map(
            ({ id: rId, message: raw }) =>
                ({
                    rId,
                    message: RedisStreamSerializer.deserialize(raw),
                } as MessageWithRId)
        );
    }

    public async fetchPendingMessages(): Promise<{
        nextPendingMessageRId: string;
        messagesWithRId: MessageWithRId[];
    }> {
        return {
            nextPendingMessageRId: '0-0',
            messagesWithRId: [],
        };
    }

    private static deserializeMessage({
        message: raw,
    }: {
        message: { [key: string]: string };
    }) {
        return Message.fromJSONString(raw.value);
    }

    public join(consumer: MessageConsumer) {
        this.subscriptions.subscribe(consumer);
    }

    public async processNewMessages() {
        const messagesWithRId = await this.fetchNewMessages();
        const acks = [];

        for (const { rId, message } of messagesWithRId) {
            const results: PromiseSettledResult[] =
                await this.subscriptions.notifyMessage(message);

            const shouldSendACK = results.every(
                (promise) => promise.status === 'fulfilled'
            );
            if (shouldSendACK) {
                acks.push(rId);
            }
        }

        if (acks.length > 0) {
            const { group, stream } = this.options;
            await this.redis.xAck(stream, group, acks as string[]);
        }
    }
}
