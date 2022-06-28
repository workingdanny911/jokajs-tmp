import { Message, MessageRegistry } from 'joka/core';

describe('MessageRegistry', () => {
    test('registers message class', () => {
        @MessageRegistry.register
        class TestMessage extends Message {}

        expect(
            MessageRegistry.getMessageClass<TestMessage>(TestMessage.type)
        ).toBe(TestMessage);
    });

    test('can be reset', () => {
        @MessageRegistry.register
        class TestMessage extends Message {}

        MessageRegistry.reset();

        expect(() => MessageRegistry.getMessageClass(TestMessage.type)).toThrow(
            /.*no message class.*/
        );
    });
});
