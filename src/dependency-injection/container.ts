import 'reflect-metadata';
import cls from 'cls-hooked';
import { Container } from 'inversify';
import { Sequelize } from 'sequelize';
import { createClient } from 'redis';

import config from '../config';
import { SequelizeUnitOfWork, UnitOfWork } from '../core';
import { RedisClient } from '../utils';
import {
    MessageStore,
    MessageTracker,
    SequelizeMessageStore,
    SequelizeMessageTracker,
} from '../messaging';
import TYPES from './dependecies';

const container = new Container();

const sequelizeNamespace = cls.createNamespace('sequelize');
Sequelize.useCLS(sequelizeNamespace);

const sequelize = new Sequelize(config.DATABASE);

container
    .bind<MessageStore>('MessageStore')
    .toDynamicValue(() => new SequelizeMessageStore(sequelize));
SequelizeMessageStore.defineModel(sequelize);

container
    .bind<MessageTracker>('MessageTracker')
    .toDynamicValue(() => new SequelizeMessageTracker(sequelize));
SequelizeMessageTracker.defineModel(sequelize);

container.bind<Sequelize>(TYPES.Sequelize).toConstantValue(sequelize);
// container.onDeactivation<Sequelize>(
//     TYPES.Sequelize,
//     async (sequelize: Sequelize) => {
//         await sequelize.close();
//     }
// );

let redisClients: RedisClient[] = [];
container
    .bind<RedisClient>(TYPES.RedisClient)
    .toDynamicValue(() => {
        const redis = createClient();

        redis.on('ready', () => {
            redisClients.push(redis);
        });
        redis.on('end', () => {
            redisClients = redisClients.filter((c) => c !== redis);
        });

        return redis;
    })
    .inTransientScope();
container.bind<RedisClient[]>('AllRedisClients').toConstantValue(redisClients);
container.onDeactivation<RedisClient>(TYPES.RedisClient, async (redis) => {
    await redis.quit();
});

container
    .bind<UnitOfWork>(TYPES.UnitOfWork)
    .toDynamicValue(
        ({ container }) =>
            new SequelizeUnitOfWork(container.get<Sequelize>(TYPES.Sequelize))
    )
    .inSingletonScope();

container
    .bind<MessageStore>(TYPES.MessageStoreForMessaging)
    .toDynamicValue(() => {
        const sequelize = container.get<Sequelize>(TYPES.Sequelize);
        return new SequelizeMessageStore(sequelize);
    })
    .inSingletonScope();

export default container;
