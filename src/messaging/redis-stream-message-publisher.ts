import { Message } from 'joka/core';
import { RedisClient } from 'joka/utils';
import { MessageWithRId, RedisStreamSerializer } from './helpers';

export class RedisStreamMessagePublisher {
    constructor(private stream: string, private redis: RedisClient) {}

    public publish(messages: Message[]): Promise<string[]>;
    public publish(messagesWithRId: MessageWithRId[]): Promise<string[]>;

    async publish(messages: Message[] | MessageWithRId[]) {
        const transaction = this.redis.multi();

        for (const message of messages) {
            if (message instanceof Message) {
                transaction.xAdd(this.stream, '*', {
                    value: message.toJSONString(),
                });
            } else {
                const { rId, message: actualMessage } = message;
                transaction.xAdd(
                    this.stream,
                    rId.toString(),
                    RedisStreamSerializer.serialize(actualMessage)
                );
            }
        }

        return await transaction.exec();
    }
}
