import { TrampolineRunner } from '@jokajs/utils';

import { RedisStreamMessageConsumerGroup } from './redis-stream-message-consumer-group';

export class MessageConsumingProcess extends TrampolineRunner {
    constructor(
        private consumerGroup: RedisStreamMessageConsumerGroup,
        interval?: number
    ) {
        super(interval);
    }

    protected async execBody() {
        await this.consumerGroup.processNewMessages();
    }
}
