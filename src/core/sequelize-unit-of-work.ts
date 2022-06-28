import { Sequelize, Transaction } from 'sequelize';

import { UnitOfWork } from './unit-of-work';

export class SequelizeUnitOfWork implements UnitOfWork<Transaction> {
    private sequelize: Sequelize;

    constructor(sequelize: Sequelize) {
        this.sequelize = sequelize;
    }

    public async start<TResult = any>(
        execBody: (transaction: Transaction) => Promise<TResult>
    ) {
        let result!: TResult;
        await this.sequelize.transaction(async (t) => {
            result = await execBody(t);
        });
        return result;
    }

    public get sequelizeInstance() {
        return this.sequelize;
    }
}
