import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    Injectable,
    UseFilters,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

type ErrorClass<T extends Error = Error> = { new (): T };
type ErrorTransformer<T extends Error = Error> = (error: T) => any;
type ErrorClassWithTransformer<T extends Error = Error> = [
    ErrorClass<T>,
    ErrorTransformer<T>
];

interface ErrorToResponseParam {
    [statusCode: number]: Array<ErrorClass | ErrorClassWithTransformer>;
}

function _defaultTransformer(error: Error) {
    return {
        errorCode: error.name,
        message: (error as any).message ?? '',
    };
}

export function ErrorToResponse(
    param: ErrorToResponseParam,
    defaultTransformer = _defaultTransformer
) {
    const statusByErrorClass = new Map();
    const transformersByErrorClass = new Map();

    for (const [statusCode, errorsWithOrWithoutTransformer] of Object.entries(
        param
    )) {
        for (const e of errorsWithOrWithoutTransformer) {
            let errorClass: ErrorClass;

            if (Array.isArray(e)) {
                transformersByErrorClass.set(e[0], e[1]);
                errorClass = e[0];
            } else {
                errorClass = e;
            }

            statusByErrorClass.set(errorClass, statusCode);
        }
    }

    @Catch(...statusByErrorClass.keys())
    @Injectable()
    class Filter implements ExceptionFilter {
        constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

        catch(exception: unknown, host: ArgumentsHost): void {
            const errorClass = (exception as Error).constructor;
            const { httpAdapter } = this.httpAdapterHost;
            const ctx = host.switchToHttp();

            const statusCode = statusByErrorClass.get(errorClass);
            if (!statusCode) {
                throw exception;
            }

            const transformer = transformersByErrorClass.has(errorClass)
                ? transformersByErrorClass.get(errorClass)
                : defaultTransformer;

            return httpAdapter.reply(
                ctx.getResponse(),
                transformer(exception),
                statusCode
            );
        }
    }

    return UseFilters(Filter);
}
