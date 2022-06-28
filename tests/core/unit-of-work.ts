import * as sequelize from 'sequelize';

import { SequelizeUnitOfWork } from 'joka/core';

describe('SequelizeUnitOfWork', () => {
    const SEQUELIZE_OPTIONS = {
        dialect: 'mariadb',
        host: '127.0.0.1',
        username: 'root',
        password: '1234',
        database: 'basalt_ac_test',
    } as sequelize.Options;
    let uow: SequelizeUnitOfWork;

    beforeEach(() => {
        uow = new SequelizeUnitOfWork(
            new sequelize.Sequelize(SEQUELIZE_OPTIONS)
        );
    });

    test('committing', async () => {
        let isCommitted = false;

        await uow.start(async (transaction) => {
            transaction.afterCommit(() => {
                isCommitted = true;
            });
        });
        expect(isCommitted).toBe(true);
    });

    test('rolling back', async () => {
        let transaction_!: sequelize.Transaction;

        async function doRollBack() {
            await uow.start(async (transaction) => {
                transaction_ = transaction;
                transaction.rollback = jest.fn();
                throw new Error('rollback');
            });
        }

        await expect(doRollBack).rejects.toThrow('rollback');

        expect(transaction_.rollback).toBeCalled();
    });
});
