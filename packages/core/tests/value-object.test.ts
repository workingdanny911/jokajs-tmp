import { ValueObject } from '../src';

class FooValueObject extends ValueObject {
    foo!: string;
}

test('immutability', () => {
    const vo = new FooValueObject({ foo: 'foo' });
    try {
        vo.foo = 'bar';
    } catch (_) {
        // TypeError is thrown in strict mode
    }

    expect(vo.foo).toBe('foo');
});
