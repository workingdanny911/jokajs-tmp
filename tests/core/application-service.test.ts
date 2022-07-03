import { UnitOfWork } from 'joka/core';
import { MDBMessageStore } from 'joka/event-sourcing';
import { mdbMessageStoreForTest, patchPrivateMethod } from 'joka/testing';
import {
    Counter,
    CounterApplicationService,
    CounterCreated,
    makeCreateCounterCommand,
    makeIncrementCounterCommand,
    resetCounterId,
} from './fixtures';

class UnitOfWorkSpy implements UnitOfWork<void> {
    public hasDoneExecuting = false;

    async start<TResult = any>(
        execBody: (transaction: void) => Promise<TResult>
    ) {
        const result = await execBody();
        this.hasDoneExecuting = true;
        return result;
    }
}

describe('ApplicationService', () => {
    let messageStoreGenerator: ReturnType<typeof mdbMessageStoreForTest>;
    let messageStore: MDBMessageStore;
    let unitOfWorkSpy: UnitOfWorkSpy;
    let applicationService: CounterApplicationService;

    beforeEach(async () => {
        resetCounterId();
        messageStoreGenerator = mdbMessageStoreForTest();
        messageStore = (await messageStoreGenerator.next())
            .value as MDBMessageStore;
        unitOfWorkSpy = new UnitOfWorkSpy();
        applicationService = new CounterApplicationService({
            unitOfWork: unitOfWorkSpy,
            messageStore,
        });
    });

    afterEach(async () => {
        await messageStoreGenerator.next();
    });

    test('saves aggregate to message store', async () => {
        await applicationService.saveAggregate(
            new Counter({
                id: 1,
                data: { value: 0 },
            })
        );

        const aggregate = new Counter({
            id: 1,
            events: await messageStore.getStream(
                applicationService.getStreamName(1),
                (raw) => applicationService.deserializeRawEvent(raw)
            ),
        });
        expect(aggregate.id).toBe(1);
        expect(aggregate.version).toBe(0);
        expect(aggregate.value).toBe(0);
    });

    test('loads aggregate from message store', async () => {
        const causationCommandId = 'command-id';
        await messageStore.appendMessages(
            applicationService.getStreamName(1),
            -1,
            [new CounterCreated({ aggregateId: 1, value: 0 })]
        );

        const aggregate = await applicationService.loadAggregate(
            1,
            causationCommandId
        );
        expect(aggregate.id).toBe(1);
        expect(aggregate.value).toBe(0);
        expect(aggregate.version).toBe(0);
        expect(aggregate.causationCommandId).toBe(causationCommandId);
    });

    test('routes command to appropriate handler', async () => {
        expect(
            await applicationService.execute(
                makeCreateCounterCommand({ value: 0 })
            )
        ).toEqual({ id: 1, value: 0 });

        expect(
            await applicationService.execute(
                makeIncrementCounterCommand({ counterId: 1, by: 1 })
            )
        ).toEqual({ id: 1, value: 1 });
    });

    class FooError extends Error {
        name = 'FooError';
    }

    test('returns error response when error occurred', async () => {
        const error = new FooError('foo message');
        patchPrivateMethod(
            applicationService,
            'executeCreateCounter',
            jest.fn(async (...args: any[]) => {
                throw error;
            })
        );
        const command = makeCreateCounterCommand({ value: 0 });

        const errorResponse = await applicationService.execute(command);

        expect(errorResponse).toEqual({
            commandType: command.type,
            commandId: command.id,
            errorCode: error.name,
            errorMessage: error.message,
        });
    });
});
