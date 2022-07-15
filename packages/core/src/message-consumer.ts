import { Message } from './message';

export interface MessageConsumer<TMessage extends Message = Message<any>> {
    name: string;
    subjects: string | Set<string>;

    consume(
        message: TMessage,
        chunkInfo: { size: number; current: number }
    ): Promise<any>;
}
