import { Message } from '../core';

export interface MessageStore {
    append(messages: Message[]): Promise<void>;

    markAsPublished(messageIds: string[]): Promise<void>;

    getUnpublishedMessages(chunkSize?: number): Promise<Message[]>;

    isPublished(messageId: string): Promise<boolean>;
}
