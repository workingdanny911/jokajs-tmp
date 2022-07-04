import { v4 as uuid } from 'uuid';
import { Sequelize } from 'sequelize';

import { SequelizeMessageTracker } from '@joka/messaging';

import container from './container';

describe('SequelizeMessageTracker', () => {
    const sequelize = container.get<Sequelize>('Sequelize');
    SequelizeMessageTracker.defineModel(sequelize);
    const model = SequelizeMessageTracker.model;

    const tracker = new SequelizeMessageTracker(sequelize);

    const messageId = uuid();
    const consumerName = 'consumer';

    beforeAll(async () => {
        await model.sync({ force: true });
    });

    beforeEach(async () => {
        await model.truncate();
    });

    afterAll(container.unbindAllAsync);

    test('saving consumption', async () => {
        await tracker.saveConsumption(consumerName, messageId);

        const record = await model.findOne({
            where: {
                messageId,
                consumer: consumerName,
            },
        });

        expect(record).toBeTruthy();
    });

    test('returns false when message has not been consumed', async () => {
        const result = await tracker.hasBeenConsumed(consumerName, messageId);

        expect(result).toBe(false);
    });

    test('returns true when message has been consumed', async () => {
        await sequelize.models.MessageByConsumer.create({
            messageId,
            consumer: consumerName,
        });

        const result = await tracker.hasBeenConsumed(consumerName, messageId);

        expect(result).toBe(true);
    });

    test('throws error when message is already consumed', async () => {
        await model.create({
            messageId,
            consumer: consumerName,
        });

        await expect(
            tracker.saveConsumption(consumerName, messageId)
        ).rejects.toThrow();
    });

    test('altogether', async () => {
        await expect(
            tracker.hasBeenConsumed(consumerName, messageId)
        ).resolves.toBe(false);

        await tracker.saveConsumption(consumerName, messageId);

        await expect(
            tracker.hasBeenConsumed(consumerName, messageId)
        ).resolves.toBe(true);
    });
});
