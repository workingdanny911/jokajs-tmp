import assert from 'assert';

import {
    DataTypes,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize,
} from 'sequelize';

import { MessageTracker } from './message-tracker';

export class SequelizeMessageTracker implements MessageTracker {
    constructor(private readonly sequelize: Sequelize) {
        const modelName = SequelizeMessageTracker.model.modelName;
        assert(sequelize.models[modelName], `model '${modelName}' not found`);
    }

    public async hasBeenConsumed(
        consumerName: string,
        messageId: string
    ): Promise<boolean> {
        const count = await SequelizeMessageTracker.model.count({
            where: {
                messageId,
                consumer: consumerName,
            },
        });
        return count === 1;
    }

    async saveConsumption(consumerName: string, messageId: string) {
        await SequelizeMessageTracker.model.create({
            messageId,
            consumer: consumerName,
        });
    }

    public static defineModel(sequelize: Sequelize) {
        const model = this.model;
        if (!sequelize.models[model.modelName]) {
            model.init(
                {
                    ...model.schemaDefinition,
                },
                {
                    modelName: model.modelName,
                    tableName: model.tableName,
                    sequelize,
                    ...model.extraOptions,
                }
            );
        }
    }

    public static get model() {
        return MessageByConsumerDM;
    }
}

class MessageByConsumerDM extends Model<
    InferAttributes<MessageByConsumerDM>,
    InferCreationAttributes<MessageByConsumerDM, { omit: 'consumedAt' }>
> {
    declare messageId: string;
    declare consumer: string;
    declare consumedAt: Date;

    static modelName = 'MessageByConsumer';
    static tableName = 'joka__messages_by_consumers';

    static schemaDefinition = {
        messageId: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        consumer: {
            type: DataTypes.STRING,
        },
        consumedAt: {
            type: DataTypes.DATE,
            field: 'consumed_at',
        },
    };

    static extraOptions = {
        timestamps: false,
    };
}
