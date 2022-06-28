import 'reflect-metadata';
import cls from 'cls-hooked';
import { Container } from 'inversify';
import { Sequelize } from 'sequelize';
import { createClient } from 'redis';

import config from 'joka/config';
import { SequelizeUnitOfWork, UnitOfWork } from 'joka/core';
import { RedisClient } from 'joka/utils';

import TYPES from './dependecies';

const container = new Container();

const sequelizeNamespace = cls.createNamespace('sequelize');
Sequelize.useCLS(sequelizeNamespace);
container
    .bind<Sequelize>(TYPES.Sequelize)
    .toDynamicValue(() => new Sequelize(config.DATABASE))
    .inSingletonScope();
container.onDeactivation<Sequelize>(
    TYPES.Sequelize,
    async (sequelize: Sequelize) => {
        await sequelize.close();
    }
);

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

export default container;
