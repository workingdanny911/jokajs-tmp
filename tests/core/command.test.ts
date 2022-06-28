import Ajv from 'ajv';

import { Command, createCommandFactoryWithValidateFunction } from 'joka/core';

class FooCommand extends Command<{ foo: string }> {}

const fooCommandSchema = {
    type: 'object',
    properties: {
        foo: { type: 'string' },
    },
    required: ['foo'],
};

function makeFooCommand(validate: any) {
    return createCommandFactoryWithValidateFunction(FooCommand, validate);
}

describe('Command', () => {
    test('validates constructor input through ajv', () => {
        const mockValidate = jest.fn().mockImplementation((data: any) => data);
        const FooCommand = makeFooCommand(mockValidate);

        FooCommand({ foo: 'bar' });

        expect(mockValidate).toHaveBeenCalledWith({ foo: 'bar' });
    });

    test('throws ValidationError when validation has failed', () => {
        const validate = new Ajv().compile(fooCommandSchema);
        const FooCommand = makeFooCommand(validate);

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            FooCommand({ foo: null });
            throw new Error('this line should not be executed.');
        } catch (e: any) {
            expect(e.name).toBe('ValidationError');
        }
    });
});
