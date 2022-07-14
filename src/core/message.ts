import lodash from 'lodash';
import { v4 as uuid } from 'uuid';

import { MessageRegistry } from './message-registry';

export interface MessageHeader {
    id: string;
    type: string;
    namespace: string;
    causationMessageId?: string;
    streamPosition: number;
    globalPosition: number;
    createdAt: Date;
}

const NOT_SET = -99999;

export class Message<TData = unknown> {
    header: MessageHeader;
    data: TData;
    private static isRegistered = false;

    constructor(data: TData, headerFields?: Partial<MessageHeader>) {
        this.data = data;
        this.header = (this.constructor as any).makeHeader(
            headerFields
        ) as MessageHeader;

        if (!(this.constructor as any).isRegistered) {
            MessageRegistry.register(this.constructor);
        }
    }

    private static makeHeader(
        provided: Partial<
            Omit<MessageHeader, 'createdAt'> & { createdAt: string | Date }
        > = {}
    ) {
        function transformPosition(value: any) {
            if (typeof value === 'number') {
                return value;
            } else if (typeof value === 'string') {
                return parseInt(value);
            }
            return NOT_SET;
        }

        let createdAt: string | Date = provided.createdAt || new Date();
        if (typeof createdAt === 'string') {
            createdAt = new Date(createdAt);
        }

        const type = provided.type || this.type;
        return {
            id: provided.id ?? uuid(),
            type,
            namespace: provided.namespace ?? '',
            causationMessageId: provided.causationMessageId,
            streamPosition: transformPosition(provided.streamPosition),
            globalPosition: transformPosition(provided.globalPosition),
            createdAt,
        } as MessageHeader;
    }

    static get type() {
        return this.name;
    }

    get id() {
        return this.header.id;
    }

    get type() {
        return this.header.type;
    }

    get namespace() {
        return this.header.namespace;
    }

    // for testing purposes
    set _id(value: string) {
        this.header.id = value;
    }

    get causationMessageId() {
        return this.header.causationMessageId;
    }

    get createdAt() {
        return this.header.createdAt;
    }

    get streamPosition() {
        return this.header.streamPosition;
    }

    set streamPosition(value: number) {
        this.header.streamPosition = value;
    }

    get globalPosition() {
        return this.header.globalPosition;
    }

    set globalPosition(value: number) {
        this.header.globalPosition = value;
    }

    equals(other: Message<TData>) {
        return (
            lodash.isEqual(this.header, other.header) &&
            lodash.isEqual(this.data, other.data)
        );
    }

    toJSONString() {
        return JSON.stringify({
            header: this.header,
            data: this.data,
        });
    }

    static fromJSONString(json: string, useRegistry = true) {
        const { header, data } = JSON.parse(json);
        const messageClass: { new (...args: any[]): Message } = useRegistry
            ? MessageRegistry.getMessageClass(header.type)
            : this;
        return new messageClass(data, header);
    }

    static asType<TMessage extends Message>(
        type: string,
        data: TMessage['data'],
        headerFields: Partial<MessageHeader> = {}
    ) {
        const message = new this(data, { ...headerFields, type });
        return message as TMessage;
    }
}

export type Event<TData = unknown, TAggregateId = unknown> = Message<
    { aggregateId: TAggregateId } & TData
>;

export type Command<TData = unknown> = Message<TData>;
