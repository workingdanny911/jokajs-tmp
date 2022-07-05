import { v4 as uuid } from 'uuid';

import { AggregateError, Message } from '@joka/core';
import { expectEvents } from '@joka/testing';

import { Counter, CounterCreated, CounterIncremented } from './fixtures';

describe('Aggregate', () => {
    test('raises initial events when created with initial state', () => {
        const counter = new Counter({
            id: 1,
            data: {
                value: 0,
            },
        });

        expect(counter.value).toBe(0);

        expectEvents<CounterCreated>(counter.events, {
            type: 'CounterCreated',
            filter(e) {
                return e.aggregateId === 1 && e.value === 0;
            },
        });
    });

    test('every event raised by aggregate preserves causation command id', () => {
        const counter = new Counter({
            id: 1,
            data: {
                value: 0,
            },
            causationCommandId: 'causation-command-id',
        });

        counter.increment(1);

        expectEvents(counter.events, {
            number: counter.events.length,
            filter(data, e) {
                return e.causationMessageId === 'causation-command-id';
            },
        });
    });

    test('can be reconstituted from events', () => {
        const counterCreated = Message.asType<CounterCreated>(
            'CounterCreated',
            { aggregateId: 1, value: 0 },
            { streamPosition: 0 }
        );

        const counterIncremented = Message.asType<CounterIncremented>(
            'CounterIncremented',
            { aggregateId: 1, by: 5 },
            { streamPosition: 1 }
        );

        const counter = new Counter({
            id: 1,
            events: [counterCreated, counterIncremented],
        });

        expect(counter.id).toBe(1);
        expect(counter.value).toBe(5);
        expect(counter.version).toBe(1);
    });

    test('error thrown is AggregateError', () => {
        const causationCommandId = uuid();
        const counter = new Counter({
            id: 1,
            data: {
                value: 0,
            },
            causationCommandId,
        });

        try {
            counter.simulateFailure('message', { foo: 'bar' });
            throw new Error('this line must not be reached');
        } catch (e: any) {
            const { meta, ...additionalDetails } = e.details;

            expect(e).toBeInstanceOf(AggregateError);
            expect(e.message).toBe('message');
            expect(additionalDetails).toEqual({ foo: 'bar' });
            expect(meta).toEqual({
                causationCommandId,
                aggregate: 'Counter',
                aggregateId: counter.id,
            });
        }
    });
});
