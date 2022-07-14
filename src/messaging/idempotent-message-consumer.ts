import { Message, MessageConsumer, UnitOfWork } from '../core';

import { MessageTracker } from './message-tracker';

export abstract class IdempotentMessageConsumer<
    TMessage extends Message = Message<any>
> implements MessageConsumer
{
    abstract name: string;
    abstract subjects: string | Set<string>;

    constructor(
        private tracker: MessageTracker,
        private unitOfWork: UnitOfWork
    ) {}

    async consume(
        message: TMessage,
        chunkInfo: { size: number; current: number }
    ) {
        const doConsume = async () => {
            const shouldConsume = !(await this.tracker.hasBeenConsumed(
                this.name,
                message.id
            ));

            if (shouldConsume) {
                await this.consumeNewMessage(message, chunkInfo);
                await this.tracker.saveConsumption(this.name, message.id);
            }
        };

        await this.unitOfWork.start(doConsume);
    }

    protected abstract consumeNewMessage(
        message: TMessage,
        chunkInfo: { size: number; current: number }
    ): Promise<void>;
}
