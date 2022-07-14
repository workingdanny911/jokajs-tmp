import {
    Aggregate,
    Command,
    createMessageFactory,
    Event,
    When,
} from '@joka/core';

export type CounterId = number;

let counterId = 1;

type CounterEvent<TData = any> = Event<TData, CounterId>;

export type CounterCreated = CounterEvent<{
    value: number;
}>;

export type CounterIncremented = CounterEvent<{
    by: number;
}>;

export class Counter extends Aggregate<
    CounterId,
    {
        value: number;
    }
> {
    static readonly namespace = 'test-context';

    value!: number;
    initialValue = 0;

    protected raiseInitialEvents({ value }: { value: number }) {
        this.raise<CounterCreated>('CounterCreated', { value });
    }

    protected afterCreation() {
        this.initialValue = this.value;
    }

    increment(by: number) {
        this.raise<CounterIncremented>('CounterIncremented', { by });
    }

    simulateFailure(message: string, additionalDetails: any) {
        this.throwError('CounterError', message, additionalDetails);
    }

    @When('CounterCreated')
    private setInitialValue({ value }: CounterCreated['data']) {
        this.value = value;
    }

    @When('CounterIncremented')
    private incrementValue({ by }: CounterIncremented['data']) {
        this.value += by;
    }
}

export type CreateCounter = Command<{ value: number }>;

export type IncrementCounter = Command<{ counterId: CounterId; by: number }>;

export const makeCreateCounterCommand = createMessageFactory<CreateCounter>(
    'CreateCounter',
    {
        type: 'object',
        properties: {
            value: { type: 'number', nullable: false },
        },
        required: ['value'],
    }
);

export const makeIncrementCounterCommand =
    createMessageFactory<IncrementCounter>('IncrementCounter', {
        type: 'object',
        properties: {
            counterId: { type: 'number', nullable: false },
            by: { type: 'number', nullable: false },
        },
        required: ['counterId', 'by'],
    });

export function resetCounterId() {
    counterId = 1;
}
