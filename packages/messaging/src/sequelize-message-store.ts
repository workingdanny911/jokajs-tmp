import {
    DataTypes,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize,
} from 'sequelize';

import { Message } from '@jokajs/core';

import { MessageStore } from './message-store';

export class SequelizeMessageStore implements MessageStore {
    constructor(private readonly sequelize: Sequelize) {}

    public async append(messages: Message[]) {
        const now = new Date();
        const messagesToSave = messages.map((message) => ({
            messageId: message.id,
            messageHeader: message.header,
            messageData: message.data,
            isPublished: false,
            createdAt: now,
        }));
        await OutgoingMessageDM.bulkCreate(messagesToSave);
    }

    public async markAsPublished(messageIds: string[]) {
        await OutgoingMessageDM.update(
            { isPublished: true },
            { where: { messageId: messageIds } }
        );
    }

    public async getUnpublishedMessages(chunkSize = 100): Promise<Message[]> {
        const messageDMs = await OutgoingMessageDM.findAll({
            where: { isPublished: false },
            limit: chunkSize,
            order: [['index', 'ASC']],
        });

        return messageDMs.map((messageDM) => {
            const createdAt = new Date(messageDM.messageHeader.createdAt);
            return new Message(messageDM.messageData, {
                ...messageDM.messageHeader,
                createdAt,
            });
        });
    }

    public async isPublished(messageId: string) {
        const messageDM = await OutgoingMessageDM.findOne({
            where: { messageId, isPublished: true },
            attributes: ['messageId'],
        });
        return !!messageDM;
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
        return OutgoingMessageDM;
    }
}

class OutgoingMessageDM extends Model<
    InferAttributes<OutgoingMessageDM>,
    InferCreationAttributes<
        OutgoingMessageDM,
        { omit: 'index' | 'createdAt' | 'isPublished' }
    >
> {
    declare index: number;
    declare messageId: string;
    declare messageHeader: Message['header'];
    declare messageData: any;
    declare isPublished: boolean;
    declare createdAt: Date;

    static modelName = 'OutgoingMessage';
    static tableName = 'joka__outgoing_messages';

    static schemaDefinition = {
        index: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        messageId: {
            type: DataTypes.STRING,
            unique: true,
            field: 'message_id',
        },
        messageHeader: {
            type: DataTypes.JSON,
            field: 'message_header',
        },
        messageData: {
            type: DataTypes.JSON,
            field: 'message_data',
        },
        isPublished: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_published',
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    };

    static extraOptions = {
        timestamps: false,
    };
}
