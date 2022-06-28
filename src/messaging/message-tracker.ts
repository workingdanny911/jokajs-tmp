export interface MessageTracker {
    hasBeenConsumed(consumerName: string, messageId: string): Promise<boolean>;

    saveConsumption(consumerName: string, messageId: string): Promise<void>;
}
