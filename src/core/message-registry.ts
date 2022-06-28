import assert from 'assert';

export class MessageRegistry {
    private static registry = new Map<string, any>();

    static reset() {
        MessageRegistry.registry.clear();
    }

    static register(messageClass: any) {
        MessageRegistry.registry.set(messageClass.type, messageClass);
        return messageClass;
    }

    static getMessageClass<TMessageClass>(messageType: string) {
        const messageClass = MessageRegistry.registry.get(messageType);
        assert(
            messageClass,
            `no message class registered for message type '${messageType}'`
        );
        return messageClass as TMessageClass;
    }
}
