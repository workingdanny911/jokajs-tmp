import { Sequelize } from 'sequelize';

import { SequelizeUnitOfWork } from '@joka/core';

import container from '../container';

container
    .bind<SequelizeUnitOfWork>('UnitOfWork')
    .toDynamicValue(
        () => new SequelizeUnitOfWork(container.get<Sequelize>('Sequelize'))
    )
    .inSingletonScope();

export default container;
