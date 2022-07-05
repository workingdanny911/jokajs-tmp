import Ajv from 'ajv';

import { createMessageFactoryWithValidateFunction } from '@joka/core';

const fooCommandSchema = {
    type: 'object',
    properties: {
        foo: { type: 'string' },
    },
    required: ['foo'],
};

function makeFooCommandFactory(validate: any) {
    return createMessageFactoryWithValidateFunction('FooCommand', validate);
}

describe('Command', () => {
    test('validates constructor input through ajv', () => {
        const mockValidate = jest.fn().mockImplementation((data: any) => data);
        const commandFactory = makeFooCommandFactory(mockValidate);

        commandFactory({ foo: 'bar' });

        expect(mockValidate).toHaveBeenCalledWith({ foo: 'bar' });
    });

    test('throws ValidationError when validation has failed', () => {
        const validate = new Ajv().compile(fooCommandSchema);
        const commandFactory = makeFooCommandFactory(validate);

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            commandFactory({ foo: null });
            throw new Error('this line should not be executed.');
        } catch (e: any) {
            expect(e.name).toBe('ValidationError');
        }
    });
});
