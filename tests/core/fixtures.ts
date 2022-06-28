import {
    Aggregate,
    AggregateError,
    Command,
    createCommandFactory,
    Event,
} from 'joka/core';
import { ESApplicationService } from 'joka/event-sourcing';

export type CounterId = number;

let counterId = 1;

class CounterEvent<TData> extends Event<
    CounterId,
    { aggregateId: CounterId } & TData
> {}

export class CounterCreated extends CounterEvent<{
    value: number;
}> {}

export class CounterIncremented extends CounterEvent<{
    by: number;
}> {}

class CounterError extends AggregateError {}

export class Counter extends Aggregate<
    CounterId,
    {
        value: number;
    }
> {
    value!: number;
    initialValue = 0;

    protected raiseInitialEvents({ value }: { value: number }) {
        this.raise(CounterCreated, { value });
    }

    protected afterCreation() {
        this.initialValue = this.value;
    }

    increment(by: number) {
        this.raise(CounterIncremented, { by });
    }

    simulateFailure(message: string, additionalDetails: any) {
        this.throwError(CounterError, message, additionalDetails);
    }

    private whenCounterCreated({ value }: CounterCreated['data']) {
        this.value = value;
    }

    private whenCounterIncremented({ by }: CounterIncremented['data']) {
        this.value += by;
    }
}

class CreateCounter extends Command<{ value: number }> {}

export class IncrementCounter extends Command<{
    counterId: number;
    by: number;
}> {}

export const makeCreateCounterCommand = createCommandFactory(CreateCounter, {
    type: 'object',
    properties: {
        value: { type: 'number', nullable: false },
    },
    required: ['value'],
});
export const makeIncrementCounterCommand = createCommandFactory(
    IncrementCounter,
    {
        type: 'object',
        properties: {
            counterId: { type: 'number', nullable: false },
            by: { type: 'number', nullable: false },
        },
        required: ['counterId', 'by'],
    }
);

export class CounterApplicationService extends ESApplicationService<Counter> {
    aggregateClass = Counter;
    events = {
        CounterCreated,
        CounterIncremented,
    };

    async executeCreateCounter(command: CreateCounter) {
        const newCounter = new Counter({
            id: counterId++,
            data: command.data,
            causationCommandId: command.id,
        });
        await this.saveAggregate(newCounter);
        return { id: newCounter.id, value: newCounter.value };
    }

    async executeIncrementCounter(command: IncrementCounter) {
        const counter = await this.loadAggregate(
            command.data.counterId,
            command.id
        );
        counter.increment(command.data.by);
        await this.saveAggregate(counter);
        return { id: counter.id, value: counter.value };
    }
}

export function resetCounterId() {
    counterId = 1;
}
