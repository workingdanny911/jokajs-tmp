import { Sequelize, Transaction } from 'sequelize';

import { SequelizeUnitOfWork } from '../src';
import container from './container';

describe('SequelizeUnitOfWork', () => {
    const uow = new SequelizeUnitOfWork(container.get<Sequelize>('Sequelize'));

    beforeAll(container.unbindAllAsync);

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
        let transaction_!: Transaction;

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
