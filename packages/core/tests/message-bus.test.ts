import { Message, MessageBus, MessageConsumer } from '../src';
import { createVoidMessage } from '@jokajs/testing';

describe('MessageBus', () => {
    test('notifying', async () => {
        const bus = new MessageBus();
        const messages: Message[] = [];
        const consumer = {
            name: 'consumer',
            subjects: new Set(['Message']),
            async consume(message: Message) {
                messages.push(message);
            },
        };
        bus.subscribe(consumer);
        const message = createVoidMessage();

        await bus.notifyMessages([message]);

        expect(messages).toEqual([message]);
    });

    test('notifying with multiple consumers', async () => {
        const bus = new MessageBus();
        const messages: Message[] = [];
        const consumer = {
            name: 'consumer',
            subjects: new Set(['Message']),
            async consume(message: Message) {
                messages.push(message);
            },
        };
        const consumer2 = {
            name: 'consumer2',
            subjects: new Set(['Message']),
            async consume(message: Message) {
                messages.push(message);
            },
        };
        bus.subscribe(consumer);
        bus.subscribe(consumer2);
        const message = createVoidMessage();

        await bus.notifyMessages([message]);

        expect(messages).toEqual([message, message]);
    });

    test('notifying - return value', async () => {
        const bus = new MessageBus();
        const consumer = {
            name: 'consumer',
            subjects: new Set(['Message']),
            async consume(message: Message) {
                return message.id;
            },
        };
        const failingConsumer = {
            name: 'failing consumer',
            subjects: new Set(['Message']),
            async consume(message: Message) {
                throw new Error(message.id);
            },
        };
        bus.subscribe(consumer);
        bus.subscribe(failingConsumer);
        const messages = [createVoidMessage(), createVoidMessage()];

        const results = await bus.notifyMessages(messages);

        for (let i = 0; i < messages.length; i++) {
            const result = results[i];
            const message = messages[i];
            expect(result).toEqual([
                {
                    status: 'fulfilled',
                    value: message.id,
                },
                {
                    status: 'rejected',
                    reason: new Error(message.id),
                },
            ]);
        }
    });

    test('subscribing to a message type', async () => {
        const fooConsumer = {
            name: 'foo',
            subjects: new Set(['FooMessage']),
            consume: jest.fn(async () => {
                return;
            }),
        } as MessageConsumer;
        const barConsumer = {
            name: 'bar',
            subjects: new Set(['BarMessage']),
            consume: jest.fn(async () => {
                return;
            }),
        } as MessageConsumer;

        const fooMessage = new Message<null>(null, { type: 'FooMessage' });
        const barMessage = new Message<null>(null, { type: 'BarMessage' });
        const bus = new MessageBus();
        bus.subscribe(fooConsumer);
        bus.subscribe(barConsumer);

        await bus.notifyMessages([fooMessage, barMessage]);

        expect(fooConsumer.consume).toHaveBeenCalledTimes(1);
        expect(fooConsumer.consume).toHaveBeenCalledWith(fooMessage, {
            size: 2,
            current: 0,
        });

        expect(barConsumer.consume).toHaveBeenCalledTimes(1);
        expect(barConsumer.consume).toHaveBeenCalledWith(barMessage, {
            size: 2,
            current: 1,
        });
    });

    test('subscribing to all message types', async () => {
        const allConsumer = {
            name: 'all',
            subjects: '*',
            consume: jest.fn(async (message: Message) => {
                return;
            }),
        };
        const fooMessage = new Message<null>(null, { type: 'FooMessage' });
        const barMessage = new Message<null>(null, { type: 'BarMessage' });
        const bus = new MessageBus();
        bus.subscribe(allConsumer);

        await bus.notifyMessages([fooMessage, barMessage]);
        expect(allConsumer.consume).toHaveBeenCalledTimes(2);
        expect(allConsumer.consume).toHaveBeenCalledWith(fooMessage, {
            size: 2,
            current: 0,
        });
        expect(allConsumer.consume).toHaveBeenCalledWith(barMessage, {
            size: 2,
            current: 1,
        });
    });
});
