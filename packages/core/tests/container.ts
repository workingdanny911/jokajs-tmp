import cls from 'cls-hooked';
import { Container } from 'inversify';
import { Sequelize } from 'sequelize';

import config from './config';
import { RedisClient } from '@joka/utils';
import { createClient } from 'redis';

const container = new Container();

const sequelizeNamespace = cls.createNamespace('sequelize');
Sequelize.useCLS(sequelizeNamespace);

container
    .bind<Sequelize>('Sequelize')
    .toDynamicValue(() => new Sequelize({ ...config.DATABASE, logging: false }))
    .inSingletonScope();

container
    .bind<RedisClient>('RedisClient')
    .toDynamicValue(() => createClient())
    .inTransientScope();
container.onDeactivation<RedisClient>('RedisClient', async (client) => {
    await client.quit();
});

export default container;
