import pg from 'pg';

import { Message } from 'joka/core';
import { MDBMessageStore, MDBRawMessage } from 'joka/event-sourcing';
import { mdbMessageStoreForTest, pgClientForTest } from 'joka/test-helpers';

class SomeMessage extends Message<{ value: string }> {}

const deserialize = (raw: MDBRawMessage) =>
    MDBMessageStore.deserializeRawMessage(raw, { SomeMessage });

describe('MDBMessageStore', () => {
    let clientGen: AsyncGenerator<pg.Client>;
    let client: pg.Client;
    let messageStoreGen: AsyncGenerator<MDBMessageStore>;
    let messageStore: MDBMessageStore;
    const messages = [
        new SomeMessage({ value: 'foo' }),
        new SomeMessage({ value: 'bar' }),
        new SomeMessage({ value: 'quz' }),
    ];

    beforeAll(async () => {
        clientGen = pgClientForTest();
        client = (await clientGen.next()).value;

        messageStoreGen = mdbMessageStoreForTest(client);
        messageStore = (await messageStoreGen.next()).value;
    });

    beforeEach(async () => {
        await messageStore.drop();
    });

    afterAll(async () => {
        await clientGen.next();
    });

    test('returns empty list when stream does not exist', async () => {
        const nonExistingStream = await messageStore.getStream(
            'non-existing-stream-name-asdiuji'
        );
        expect(nonExistingStream.length).toBe(0);
    });

    test('returns -1 as last position when stream does not exist', async () => {
        expect(await messageStore.getLastGlobalPosition()).toBe(-1);
        expect(
            await messageStore.getLastStreamPosition(
                'non-existing-stream-18928'
            )
        ).toBe(-1);
    });

    test('appends messages to stream', async () => {
        const streamName = 'SomeStream-1';

        await messageStore.appendMessages(streamName, -1, messages);

        const { rows } = await client.query(
            `
            SELECT 
                id, type,
                position::int as stream_position, global_position::int as global_position,
                data::jsonb as data,
                metadata::jsonb
                    FROM get_stream_messages($1)`,
            [streamName]
        );
        expect(rows.map(deserialize)).toEqual(messages);
    });

    test('throws error when provided last position is not equal to the last position of the stream', async () => {
        const streamName = 'SomeStream-2';

        await expect(async () => {
            await messageStore.appendMessages(streamName, -2, messages);
        }).rejects.toThrow(/.*invalid position.*/i);

        await messageStore.appendMessages(streamName, -1, messages);

        await expect(async () => {
            await messageStore.appendMessages(streamName, -1, messages);
        }).rejects.toThrow(/.*invalid position.*/i);
    });

    test('sets stream position and global position of message when appending', async () => {
        const streamName = 'SomeStream-3';

        await messageStore.appendMessages(streamName, -1, messages);

        let expectedStreamPosition = await messageStore.getLastStreamPosition(
            streamName
        );
        let expectedGlobalPosition = await messageStore.getLastGlobalPosition();

        for (const message of messages.reverse()) {
            expect(message.streamPosition).toBe(expectedStreamPosition--);
            expect(message.globalPosition).toBe(expectedGlobalPosition--);
        }
    });

    describe('Transaction', () => {
        let querySpy: jest.Mock<any, any>;
        let transaction: {
            hasBegun: boolean;
            isCommitted: boolean;
            isRolledBack: boolean;
        };
        let spyOnQuery: (text: string, values?: any[]) => Promise<any>;

        beforeEach(async () => {
            transaction = {
                hasBegun: false,
                isCommitted: false,
                isRolledBack: false,
            };
            const query = client.query.bind(client);
            spyOnQuery = (text: string, values?: any[]) => {
                switch (text) {
                    case 'BEGIN':
                        transaction.hasBegun = true;
                        break;
                    case 'COMMIT':
                        transaction.isCommitted = true;
                        break;
                    case 'ROLLBACK':
                        transaction.isRolledBack = true;
                        break;
                }

                return query(text, values);
            };
            querySpy = jest.fn().mockImplementation(spyOnQuery);
            client.query = querySpy;
        });

        test('wraps append queries in a transaction', async () => {
            await messageStore.appendMessages('SomeStream-1', -1, messages);
            expect(transaction.hasBegun).toBe(true);
            expect(transaction.isCommitted).toBe(true);
            expect(transaction.isRolledBack).toBe(false);
        });

        test('rolls back when aborted', async () => {
            try {
                // appending messages with invalid last position MUST FAIL
                await messageStore.appendMessages('SomeStream-1', -2, messages);
            } catch (_) {
                // do nothing
            }

            expect(transaction.hasBegun).toBe(true);
            expect(transaction.isRolledBack).toBe(true);
            expect(transaction.isCommitted).toBe(false);
        });
    });
});
