import { Options as SequelizeOptions } from 'sequelize/types/sequelize';

export default {
    DATABASE: {
        dialect: 'mariadb',
        host: process.env.DB_HOST,
        username: process.env.DB_USER,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
    } as SequelizeOptions,
    EVENT_SOURCING: {
        EVENT_STORE: {
            host: process.env.EVENT_SOURCING__EVENT_STORE_HOST || 'localhost',
            port: parseInt(
                process.env.EVENT_SOURCING__EVENT_STORE_PORT || '5432'
            ),
            database:
                process.env.EVENT_SOURCING__EVENT_STORE_DATABASE ||
                'test_message_db',
            user:
                process.env.EVENT_SOURCING__EVENT_STORE_USER || 'message_store',
        },
    },
};
