import { v4 as uuid } from 'uuid';

import { Message } from './message';
import { MessageConsumer } from './message-consumer';

export class MessageBus {
    private readonly subscriptions: {
        [messageType: string]: MessageConsumer[];
    } = {};

    public async notifyMessages(messages: Message[]): Promise<any> {
        const chunkSize = messages.length;
        const consumeProcessesForAllMessages = messages.map(
            async (message, index) => {
                const chunkInfo = { size: chunkSize, current: index };
                return await this.doNotify(message, chunkInfo);
            }
        );
        return await Promise.all(consumeProcessesForAllMessages);
    }

    public async notifyMessage(message: Message): Promise<any> {
        return (await this.notifyMessages([message]))[0];
    }

    private async doNotify(
        message: Message,
        chunkInfo: { size: number; current: number }
    ) {
        const consumeProcesses = this.getConsumers(message.type).map(
            async (consumer) => await consumer.consume(message, chunkInfo)
        );
        return await Promise.allSettled(consumeProcesses);
    }

    public subscribe(consume: MessageConsumer['consume']): () => void;
    public subscribe(consumer: MessageConsumer): () => void;
    public subscribe(
        consumeOrConsumer: MessageConsumer | MessageConsumer['consume']
    ) {
        let consumer: MessageConsumer;
        if (typeof consumeOrConsumer === 'function') {
            consumer = {
                name: uuid(),
                subjects: '*',
                consume: consumeOrConsumer,
            };
        } else {
            consumer = consumeOrConsumer;
        }

        const { subjects } = consumer;
        if (typeof subjects === 'string') {
            this.subscriptions[subjects] = this.subscriptions[subjects] || [];
            this.subscriptions[subjects].push(consumer);
        } else {
            for (const messageType of consumer.subjects) {
                this.subscriptions[messageType] =
                    this.subscriptions[messageType] || [];
                this.subscriptions[messageType].push(consumer);
            }
        }

        return () => {
            if (subjects === '*') {
                this.subscriptions['*'] = this.subscriptions['*'].filter(
                    (consumer) => consumer !== consumer
                );
            } else {
                for (const messageType of subjects) {
                    this.subscriptions[messageType] = this.subscriptions[
                        messageType
                    ].filter((consumer) => consumer !== consumer);
                }
            }
        };
    }

    private getConsumers(messageType: string): MessageConsumer[] {
        let consumers = this.subscriptions[messageType] || [];
        if (this.subscriptions['*']) {
            consumers = consumers.concat(this.subscriptions['*']);
        }
        return consumers;
    }
}
