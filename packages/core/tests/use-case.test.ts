import assert from 'assert';

import { UseCase } from '../src';

describe('UseCase', () => {
    test('cannot be constructed without command type', () => {
        class UseCaseWithoutCommandType extends UseCase<any> {
            execute(command: any) {
                return Promise.resolve();
            }
        }

        expect(() => new UseCaseWithoutCommandType()).toThrowError(
            /.*commandType.*is not defined.*/
        );
    });

    test('cannot be constructed without command payload validator', () => {
        class UseCaseWithoutCommandPayloadValidator extends UseCase<any> {
            static commandType = 'Command';

            execute(command: any) {
                return Promise.resolve();
            }
        }

        expect(() => new UseCaseWithoutCommandPayloadValidator()).toThrowError(
            /.*commandPayloadValidator.*is not defined.*/
        );
    });

    test('validates command payload when creating command', () => {
        class ExecuteFooCommand extends UseCase<any> {
            static commandType = 'FooCommand';
            static commandPayloadValidator = {
                validate(data: any) {
                    return {
                        value: { foo: 'bar' },
                        error: null,
                    };
                },
            };

            execute(command: any) {
                return Promise.resolve();
            }
        }

        const fooCommand = ExecuteFooCommand.createCommand({});
        expect(fooCommand.type).toBe('FooCommand');
        expect(fooCommand.data).toEqual({ foo: 'bar' });
    });

    test('throws error when command payload is invalid', () => {
        class ExecuteFooCommand extends UseCase<any> {
            static commandType = 'FooCommand';
            static commandPayloadValidator = {
                validate(data: any) {
                    return {
                        value: null,
                        error: {
                            message: 'Invalid payload',
                            details: {
                                foo: 'bar',
                            },
                        },
                    };
                },
            };

            execute(command: any) {
                return Promise.resolve();
            }
        }

        try {
            ExecuteFooCommand.createCommand({});
            assert(false, 'should have thrown error');
        } catch (error: any) {
            expect(error.code).toBe('InvalidCommandPayload');
            expect(error.message).toBe('Invalid payload');
            expect(error.details).toEqual({ foo: 'bar' });
        }
    });
});
