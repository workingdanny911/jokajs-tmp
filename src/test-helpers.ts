import pg from 'pg';
import { Sequelize } from 'sequelize';

import { Aggregate, Event, Message } from 'joka/core';
import config from 'joka/config';
import { RedisClient } from 'joka/utils';
import { container, DEP_TYPES } from 'joka/dependency-injection';
import { MDBMessageStore } from 'joka/event-sourcing';

export async function* pgClientForTest() {
    const client = new pg.Client(config.TEST.MESSAGE_STORE);
    await client.connect();

    yield client;

    await client.end();
}

export async function* mdbMessageStoreForTest(client?: pg.Client) {
    let clientGenerator: ReturnType<typeof pgClientForTest> | null = null;
    if (!client) {
        clientGenerator = pgClientForTest();
        client = (await clientGenerator.next()).value as pg.Client;
    }

    const messageStore = new MDBMessageStore(client);
    await messageStore.drop();

    yield messageStore;

    if (clientGenerator) {
        await clientGenerator.next();
    }
}

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

export const sequelizeForTest = container.get<Sequelize>(DEP_TYPES.Sequelize);

export async function truncateAllTables(
    sequelize: Sequelize = sequelizeForTest
) {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const model of Object.values(sequelize.models)) {
        await model.truncate({ cascade: true, restartIdentity: true });
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

export function createRedisClient(): RedisClient {
    return container.get<RedisClient>(DEP_TYPES.RedisClient);
}
