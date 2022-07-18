import cls from 'cls-hooked';
import { Container } from 'inversify';
import { Sequelize } from 'sequelize';
import { SequelizeUnitOfWork } from '@jokajs/core';
import { RedisClient } from '@jokajs/utils';
import { createClient } from 'redis';
import config from './config';

const container = new Container();

const sequelizeNamespace = cls.createNamespace('sequelize');
Sequelize.useCLS(sequelizeNamespace);

container
    .bind<Sequelize>('Sequelize')
    .toDynamicValue(() => new Sequelize({ ...config.DATABASE, logging: false }))
    .inSingletonScope();

container
    .bind<RedisClient>('RedisClient')
    .toDynamicValue(() => {
        return createClient();
    })
    .inTransientScope();
container.onDeactivation<RedisClient>('RedisClient', async (client) => {
    await client.quit();
});

container
    .bind<SequelizeUnitOfWork>('UnitOfWork')
    .toDynamicValue(
        () => new SequelizeUnitOfWork(container.get<Sequelize>('Sequelize'))
    )
    .inSingletonScope();

export default container;
