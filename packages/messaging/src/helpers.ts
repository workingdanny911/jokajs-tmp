import { Message } from '@joka/core';

export interface MessageWithRId<T = unknown> {
    rId: string | number;
    message: Message<T>;
}

export class RedisStreamSerializer {
    public static serialize(message: Message) {
        return { value: message.toJSONString() };
    }

    public static deserialize(raw: any) {
        return Message.fromJSONString(raw.value);
    }
}
