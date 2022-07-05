import { Sequelize } from 'sequelize';

import { Message } from '../core';

export function expectEvents<TMessage extends Message = Message<any>>(
    messages: Message[],
    {
        type,
        number = 1,
        filter,
    }: {
        type?: TMessage['type'];
        number?: number;
        filter?: (data: TMessage['data'], message: TMessage) => boolean;
    }
) {
    if (type) {
        messages = messages.filter((message) => message.type === type);
    }

    if (filter) {
        messages = messages.filter((message) =>
            filter(message.data as TMessage['data'], message as TMessage)
        );
    }

    expect(messages).toHaveLength(number);
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
