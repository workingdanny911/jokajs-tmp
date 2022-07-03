import pg from 'pg';

import { Message } from '../core';

export interface MDBRawMessage<
    TMetadata extends {
        occurredAt: string;
        causationMessageId?: Message['id'];
    } = { occurredAt: string; causationMessageId?: Message['id'] }
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
export class MDBMessageStore {
    private connection: pg.Client;

    constructor(connection: pg.Client) {
        this.connection = connection;
    }

    // TODO: query positions at once and match them
    async appendMessages(
        streamName: string,
        lastPosition: number,
        messages: Message[]
    ) {
        await this.startTransaction();

        try {
            await this.commitMessages(streamName, lastPosition, messages);
        } catch (e) {
            await this.rollbackTransaction();
            throw e;
        }

        await this.commitTransaction();
    }

    protected async startTransaction() {
        await this.connection.query('BEGIN');
    }

    protected async commitMessages(
        streamName: string,
        lastPosition: number,
        messages: Message[]
    ) {
        for (const message of messages) {
            await this.writeMessage(message, streamName, lastPosition++);
            [message.streamPosition, message.globalPosition] =
                await this.getMessagePositions(message);
        }
    }

    protected async rollbackTransaction() {
        await this.connection.query('ROLLBACK');
    }

    protected async commitTransaction() {
        await this.connection.query('COMMIT');
    }

    private async writeMessage(
        message: Message,
        streamName: string,
        lastPosition: number
    ) {
        try {
            await this.connection.query(
                'SELECT write_message($1, $2, $3, $4, $5, $6)',
                [
                    message.id,
                    streamName,
                    message.type,
                    message.data,
                    {
                        occurredAt: message.occurredAt,
                        causationMessageId: message.causationMessageId,
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

    private async getMessagePositions(message: Message) {
        const query = await this.connection.query(
            `SELECT
            position::int as stream_position,
            global_position::int as global_position
            FROM messages WHERE id = $1`,
            [message.id]
        );
        const position = query.rows[0];
        if (!position) {
            throw new Error(
                `Message with id '${message.id}' not found in database`
            );
        }

        return [position.stream_position, position.global_position];
    }

    async getStream<
        TMetadata extends { occurredAt: string } = { occurredAt: string }
    >(
        streamName: string,
        messageDeserializer?: (raw: MDBRawMessage<TMetadata>) => Message
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
        return messageDeserializer ? rows.map(messageDeserializer) : rows;
    }

    async getCategories(categoriesAndLastGlobalPositions: {
        [category: string]: number;
    }) {
        return [];
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

    public static deserializeRawMessage(
        raw: MDBRawMessage,
        messages: { [eventType: string]: { new (...args: any[]): Message } }
    ) {
        const messageClass = messages[raw.type];
        if (!messageClass || messageClass.name !== raw.type) {
            throw new Error(`Event '${raw.type}' not found.`);
        }

        return new messageClass(raw.data, {
            id: raw.id,
            streamPosition: raw.stream_position,
            globalPosition: raw.global_position,
            occurredAt: new Date(raw.metadata.occurredAt),
            causationId: raw.metadata.causationMessageId,
        });
    }
}
