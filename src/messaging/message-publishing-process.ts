import { UnitOfWork } from '../core';
import { TrampolineRunner } from '../utils';

import { RedisStreamMessagePublisher } from './redis-stream-message-publisher';
import { MessageStore } from './message-store';

export class MessagePublishingProcess extends TrampolineRunner {
    private static CHUNK_SIZE = 100;

    private readonly chunkSize: number;

    constructor(
        private readonly publisher: RedisStreamMessagePublisher,
        private readonly messageStore: MessageStore,
        private readonly unitOfWork: UnitOfWork,
        options: Partial<{
            chunkSize: number;
            interval: number;
        }> = {}
    ) {
        super(options.interval);

        this.chunkSize =
            options.chunkSize || MessagePublishingProcess.CHUNK_SIZE;
    }

    protected async execBody() {
        await this.unitOfWork.start(async () => {
            const messages = await this.messageStore.getUnpublishedMessages(
                this.chunkSize
            );

            const publishPromise = this.publisher.publish(messages);
            const markAsPublishedPromise = this.messageStore.markAsPublished(
                messages.map(({ id }) => id)
            );

            await Promise.all([publishPromise, markAsPublishedPromise]);
            this.emit('published', messages);
        });
    }
}
