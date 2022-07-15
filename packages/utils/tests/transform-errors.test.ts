import { TransformErrors } from '@jokajs/utils';

class ErrorA1 extends Error {}

class ErrorB1 extends Error {}

class ErrorA2 extends ErrorA1 {}

describe('TransformErrors', () => {
    test('single error', async () => {
        class Foo {
            @TransformErrors([
                [
                    Error,
                    (e: Error) => {
                        return 'foo';
                    },
                ],
            ])
            async foo() {
                throw new Error('error');
            }
        }

        await expect(new Foo().foo()).resolves.toBe('foo');
    });

    test('single error with default transformer', async () => {
        class Foo {
            @TransformErrors([Error], (e) => 'foo')
            async foo() {
                throw new Error('error');
            }
        }

        await expect(new Foo().foo()).resolves.toBe('foo');
    });

    test('multiple errors with default transformer', async () => {
        class Foo {
            @TransformErrors([ErrorA1, ErrorA2], (e) => 'foo')
            async foo() {
                throw new ErrorA2('error');
            }
        }

        await expect(new Foo().foo()).resolves.toBe('foo');
    });

    test('multiple errors', async () => {
        class Foo {
            @TransformErrors([
                [ErrorA1, (e) => 'a'],
                [ErrorB1, (e) => 'b'],
            ])
            async foo() {
                throw new ErrorB1('error');
            }
        }

        await expect(new Foo().foo()).resolves.toBe('b');
    });

    test('inherited error', async () => {
        class Foo {
            @TransformErrors([
                [ErrorA1, (e) => 'a1'],
                [ErrorA2, (e) => 'a2'],
            ])
            async foo() {
                throw new ErrorA2('error');
            }
        }

        await expect(new Foo().foo()).resolves.toBe('a2');
    });

    test('throwing another error', async () => {
        class Foo {
            @TransformErrors([
                [
                    ErrorA1,
                    (e) => {
                        throw new ErrorB1('b');
                    },
                ],
            ])
            async foo() {
                throw new ErrorA1('error');
            }
        }
        await expect(new Foo().foo()).rejects.toThrow('b');
    });

    test('returning promise', async () => {
        class Foo {
            @TransformErrors([Error], (e: Error) => Promise.resolve('foo'))
            async foo() {
                throw new Error('error');
            }
        }

        await expect(new Foo().foo()).resolves.toBe('foo');
    });
});
