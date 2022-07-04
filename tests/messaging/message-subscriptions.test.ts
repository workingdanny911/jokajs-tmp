import { Message } from '@joka/core';
import {
    AllMessageTypes,
    MessageConsumer,
    MessageSubscriptions,
} from '@joka/messaging';
import { createNullMessage } from '@joka/testing';

describe('MessageSubscriptions', () => {
    test('notifying', async () => {
        const subscriptions = new MessageSubscriptions();
        const messages: Message[] = [];
        const consumer = {
            name: 'consumer',
            subjects: new Set(['Message']),
            async consume(message: Message) {
                messages.push(message);
            },
        };
        subscriptions.subscribe(consumer);
        const message = createNullMessage();

        await subscriptions.notifyMessages([message]);

        expect(messages).toEqual([message]);
    });

    test('notifying with multiple consumers', async () => {
        const subscriptions = new MessageSubscriptions();
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
        subscriptions.subscribe(consumer);
        subscriptions.subscribe(consumer2);
        const message = createNullMessage();

        await subscriptions.notifyMessages([message]);

        expect(messages).toEqual([message, message]);
    });

    test('notifying - return value', async () => {
        const subscriptions = new MessageSubscriptions();
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
        subscriptions.subscribe(consumer);
        subscriptions.subscribe(failingConsumer);
        const messages = [createNullMessage(), createNullMessage()];

        const results = await subscriptions.notifyMessages(messages);

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
        const subscriptions = new MessageSubscriptions();
        subscriptions.subscribe(fooConsumer);
        subscriptions.subscribe(barConsumer);

        await subscriptions.notifyMessages([fooMessage, barMessage]);

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
            subjects: '*' as AllMessageTypes,
            consume: jest.fn(async (message: Message) => {
                return;
            }),
        };
        const fooMessage = new Message<null>(null, { type: 'FooMessage' });
        const barMessage = new Message<null>(null, { type: 'BarMessage' });
        const subscriptions = new MessageSubscriptions();
        subscriptions.subscribe(allConsumer);

        await subscriptions.notifyMessages([fooMessage, barMessage]);
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
