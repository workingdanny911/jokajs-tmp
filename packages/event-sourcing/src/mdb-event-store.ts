import pg from 'pg';

import { Message } from '@jokajs/core';

export interface MDBRawEvent<
    TMetadata extends {
        createdAt: string;
        causationMessageId?: Message['id'];
    } = { createdAt: string; causationMessageId?: Message['id'] }
> {
    id: string;
    data: any;
    type: string;
    stream_position: number;
    global_position: number;
    metadata: TMetadata;
}

/**
 * Event store implementation using PostgreSQL.
 * https://github.com/message-db/message-db
 */
export class MDBEventStore {
    private connection: pg.Client;

    constructor(connection: pg.Client) {
        this.connection = connection;
    }

    // TODO: query positions at once and match them
    async appendEvents(
        streamName: string,
        lastPosition: number,
        events: Message[]
    ) {
        await this.startTransaction();

        try {
            await this.commitEvents(streamName, lastPosition, events);
        } catch (e) {
            await this.rollbackTransaction();
            throw e;
        }

        await this.commitTransaction();
    }

    protected async startTransaction() {
        await this.connection.query('BEGIN');
    }

    protected async commitEvents(
        streamName: string,
        lastPosition: number,
        events: Message[]
    ) {
        for (const event of events) {
            await this.insertEvent(event, streamName, lastPosition++);
            [event.streamPosition, event.globalPosition] =
                await this.getEventPositions(event);
        }
    }

    protected async rollbackTransaction() {
        await this.connection.query('ROLLBACK');
    }

    protected async commitTransaction() {
        await this.connection.query('COMMIT');
    }

    private async insertEvent(
        event: Message,
        streamName: string,
        lastPosition: number
    ) {
        try {
            await this.connection.query(
                'SELECT write_message($1, $2, $3, $4, $5, $6)',
                [
                    event.id,
                    streamName,
                    event.type,
                    event.data,
                    {
                        createdAt: event.createdAt,
                        causationMessageId: event.causationMessageId,
                    },
                    lastPosition,
                ]
            );
        } catch (e: any) {
            const streamVersionErrorMatch = e.message.match(
                /Wrong expected version.*(\d) \(Stream: (\w+-\d).*(\d)/i
            );
            if (streamVersionErrorMatch) {
                const providedVersion = parseInt(streamVersionErrorMatch[1]);
                const streamName = streamVersionErrorMatch[2];
                const expectedVersion = parseInt(streamVersionErrorMatch[3]);
                throw new Error(
                    `Invalid position for stream: '${streamName}'.
                    Expected: '${expectedVersion}', Provided: '${providedVersion}'`
                );
            }
            throw e;
        }
    }

    private async getEventPositions(event: Message) {
        const query = await this.connection.query(
            `SELECT
            position::int as stream_position,
            global_position::int as global_position
            FROM messages WHERE id = $1`,
            [event.id]
        );
        const position = query.rows[0];
        if (!position) {
            throw new Error(
                `Event with id '${event.id}' not found in database`
            );
        }

        return [position.stream_position, position.global_position];
    }

    async getStream<
        TMetadata extends { createdAt: string } = { createdAt: string }
    >(
        streamName: string,
        eventDeserializer?: (raw: MDBRawEvent<TMetadata>) => Message
    ) {
        const { rows } = await this.connection.query(
            `SELECT 
            id, type,
            position::int as stream_position, global_position::int as global_position,
            data::jsonb as data,
            metadata::jsonb
            FROM get_stream_messages($1)`,
            [streamName]
        );
        return eventDeserializer ? rows.map(eventDeserializer) : rows;
    }

    async getLastStreamPosition(streamName: string) {
        const query = await this.connection.query(
            `SELECT MAX(position)::int as max FROM messages WHERE stream_name = $1`,
            [streamName]
        );
        const result = query.rows[0].max;
        return result === null ? -1 : result;
    }

    async getLastGlobalPosition() {
        const query = await this.connection.query(
            `SELECT MAX(global_position)::int as max FROM messages`
        );
        const result = query.rows[0].max;
        return result === null ? -1 : result;
    }

    async drop() {
        await this.connection.query('TRUNCATE messages RESTART IDENTITY');
    }

    public static deserializeRawMDBEvent(raw: MDBRawEvent) {
        return new Message<any>(raw.data, {
            id: raw.id,
            type: raw.type,
            createdAt: new Date(raw.metadata.createdAt),
            causationMessageId: raw.metadata.causationMessageId,
            streamPosition: raw.stream_position,
            globalPosition: raw.global_position,
        });
    }
}
