import { Sequelize } from 'sequelize';

import { Message } from '@joka/core';
import { SequelizeMessageStore } from '../src';
import { createVoidMessages } from '@joka/testing';

import container from './container';

describe('SequelizeMessageStore', () => {
    const sequelize = container.get<Sequelize>('Sequelize');
    SequelizeMessageStore.defineModel(sequelize);
    const model = SequelizeMessageStore.model;

    const messageStore = new SequelizeMessageStore(sequelize);
    const messages = createVoidMessages(10);

    beforeAll(async () => {
        await model.sync({ force: true });
    });

    beforeEach(async () => {
        await model.truncate();
    });

    afterAll(async () => {
        await container.unbindAllAsync();
    });

    test('appending messages', async () => {
        await messageStore.append(messages);

        const storedRawMessages = await model.findAll();
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const raw = storedRawMessages[i];
            const storedMessage = new Message(
                raw.messageData,
                raw.messageHeader
            );
            expect(storedMessage).toEqual(message);
        }
    });

    async function insertMessages(isPublished: boolean) {
        await model.bulkCreate(
            messages.map((message) => ({
                messageId: message.id,
                messageHeader: message.header,
                messageData: message.data,
                isPublished,
            }))
        );
    }

    test('marking messages as published', async () => {
        await insertMessages(false);

        const messageIds = messages.map((message) => message.id);
        await messageStore.markAsPublished(messageIds);

        const storedRawMessages = await model.findAll({
            where: { messageId: messageIds },
            order: [['index', 'ASC']],
        });
        for (let i = 0; i < messages.length; i++) {
            const raw = storedRawMessages[i];
            expect(raw.isPublished).toBe(true);
        }
    });

    test('getting unpublished messages', async () => {
        await insertMessages(false);

        const chunkSize = 3;
        const unpublishedMessages = await messageStore.getUnpublishedMessages(
            chunkSize
        );
        expect(unpublishedMessages.length).toBe(chunkSize);
        for (let i = 0; i < unpublishedMessages.length; i++) {
            const message = messages[i];
            const storedMessage = unpublishedMessages[i];
            expect(storedMessage).toEqual(message);
        }
    });

    test('checking if message is published', async () => {
        const messageId = messages[0].id;

        // message is not in the store
        await expect(messageStore.isPublished(messageId)).resolves.toBe(false);

        // message is in the store but not published
        await insertMessages(false);
        await expect(messageStore.isPublished(messageId)).resolves.toBe(false);

        // message is in the store and published
        await messageStore.markAsPublished([messageId]);
        await expect(messageStore.isPublished(messageId)).resolves.toBe(true);
    });

    test('append and fetch', async () => {
        await messageStore.append(messages);

        const insertedMessages = await messageStore.getUnpublishedMessages(
            messages.length
        );

        expect(insertedMessages).toEqual(messages);
    });
});
