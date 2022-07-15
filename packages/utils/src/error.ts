export class ErrorWithDetails<TDetails = any> extends Error {
    details: TDetails;

    constructor(message?: string, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.details = details as TDetails;
    }
}

type ErrorClass = { new (): Error };

function _defaultTransformer(e: Error) {
    const serialized: any = {
        code: e.name,
        message: e.message,
    };

    if ((e as any).details) {
        serialized.details = (e as any).details;
    }

    return serialized;
}

export function TransformErrors(
    errorClassesWithOrWithoutTransformer: Array<
        ErrorClass | [ErrorClass, (e: Error) => any]
    >,
    defaultTransformer = _defaultTransformer
) {
    const errorClassAndTransformerList: Array<[ErrorClass, (e: Error) => any]> =
        [];
    for (const errorClassWithOrWithoutTransformer of errorClassesWithOrWithoutTransformer) {
        if (Array.isArray(errorClassWithOrWithoutTransformer)) {
            const [errorClass, transformer] =
                errorClassWithOrWithoutTransformer;
            errorClassAndTransformerList.push([errorClass, transformer]);
        } else {
            errorClassAndTransformerList.push([
                errorClassWithOrWithoutTransformer,
                defaultTransformer,
            ]);
        }
    }

    function throwOrReturnTransformed(e: Error) {
        for (const [errorClass, transformer] of errorClassAndTransformerList) {
            if (e.constructor === errorClass) {
                return transformer(e);
            }
        }

        for (const [errorClass, transformer] of errorClassAndTransformerList) {
            if (e instanceof errorClass) {
                return transformer(e);
            }
        }

        throw e;
    }

    return (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) => {
        const original = descriptor.value;
        descriptor.value = async function (this: any, ...args: any[]) {
            try {
                return await original.call(this, ...args);
            } catch (e: any) {
                return throwOrReturnTransformed(e);
            }
        };
    };
}
