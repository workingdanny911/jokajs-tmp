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

    public subscribe(consumer: MessageConsumer) {
        const { subjects } = consumer;
        if (subjects === '*') {
            this.subscriptions['*'] = this.subscriptions['*'] || [];
            this.subscriptions['*'].push(consumer);
        } else {
            for (const messageType of consumer.subjects) {
                this.subscriptions[messageType] =
                    this.subscriptions[messageType] || [];
                this.subscriptions[messageType].push(consumer);
            }
        }
    }

    private getConsumers(messageType: string): MessageConsumer[] {
        let consumers = this.subscriptions[messageType] || [];
        if (this.subscriptions['*']) {
            consumers = consumers.concat(this.subscriptions['*']);
        }
        return consumers;
    }
}
