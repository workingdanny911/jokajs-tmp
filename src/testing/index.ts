import { Sequelize } from 'sequelize';

import { Aggregate, Event, Message } from '../core';

export function expectEvents<TEvent extends Event<any, any> = Event<any, any>>(
    events: Event<any, any>[],
    {
        eventType,
        numberOfEvents = 1,
        filter,
    }: {
        eventType?: TEvent['type'];
        numberOfEvents?: number;
        filter?: (eventData: TEvent['data'], event: Event<any, any>) => boolean;
    }
) {
    if (eventType) {
        events = events.filter((e) => e.type === eventType) as TEvent[];
    }

    if (filter) {
        events = events.filter((e) => filter(e.data, e));
    }

    expect(events).toHaveLength(numberOfEvents);
}

export function makeExpectEventsForAggregate(aggregate: Aggregate<any, any>) {
    return <TEvent extends Event<any, any> = Event<any, any>>({
        eventType,
        numberOfEvents = 1,
        filter,
    }: {
        eventType: TEvent['type'];
        numberOfEvents?: number;
        filter?: (eventData: TEvent['data']) => boolean;
    }) =>
        expectEvents<TEvent>(aggregate.events, {
            eventType,
            numberOfEvents,
            filter,
        });
}

export function patchPrivateMethod(
    instance: any,
    methodName: string,
    mockImplementation: any
) {
    const prototype = Object.getPrototypeOf(instance);
    const originalFn = prototype[methodName];
    prototype[methodName] = mockImplementation;
    return originalFn.bind(instance);
}

export function createNullMessage() {
    return new Message<null>(null);
}

export function createNullMessages(count: number) {
    return Array.from({ length: count }, () => createNullMessage());
}

export async function truncateAllTables(sequelize: Sequelize) {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const model of Object.values(sequelize.models)) {
        await model.truncate({ cascade: true, restartIdentity: true });
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}
