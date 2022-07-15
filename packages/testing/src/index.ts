import { Sequelize } from 'sequelize';

import { Message } from '@joka/core';

export function expectMessages<TMessage extends Message = Message<any>>(
    messages: Message[],
    {
        count = 1,
        type,
        filter,
    }: Partial<{
        count: number;
        type: TMessage['type'];
        filter: (data: TMessage['data'], message: TMessage) => boolean;
    }>
) {
    if (type) {
        messages = messages.filter((message) => message.type === type);
    }

    if (filter) {
        messages = messages.filter((message) =>
            filter(message.data as TMessage['data'], message as TMessage)
        );
    }

    expect(messages).toHaveLength(count);
}

export function createVoidMessage() {
    return new Message<null>(null);
}

export function createVoidMessages(count: number) {
    return Array.from({ length: count }, createVoidMessage);
}

export async function truncateAllTables(sequelize: Sequelize) {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const model of Object.values(sequelize.models)) {
        await model.truncate({ cascade: true, restartIdentity: true });
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}
