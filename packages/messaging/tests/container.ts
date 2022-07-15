import cls from 'cls-hooked';
import { Container } from 'inversify';
import { Sequelize } from 'sequelize';
import { createClient } from 'redis';
import config from './config';
import { SequelizeUnitOfWork } from '@joka/core';
import { RedisClient } from '@joka/utils';

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
