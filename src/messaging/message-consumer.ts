import { Message } from '../core';

export type AllMessageTypes = '*';

export interface MessageConsumer<TMessage extends Message = Message<any>> {
    name: string;
    subjects: AllMessageTypes | Set<string>;

    consume(
        message: Message,
        chunkInfo: { size: number; current: number }
    ): Promise<any>;
}
