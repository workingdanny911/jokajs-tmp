import 'reflect-metadata';
import {
    ArgumentsHost,
    Catch,
    Controller,
    ExceptionFilter,
    Get,
    INestApplication,
    Injectable,
    Module,
} from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request, { SuperTest } from 'supertest';

import * as Nest from '../../../src';

const { ErrorToResponse } = Nest;

class FooError extends Error {
    name = 'FooError';
}

class BarError extends Error {
    name = 'BarError';
}

class QuzError extends Error {
    name = 'QuzError';
}

class FooBarQuzError extends Error {
    name = 'FooBarQuz';
}

class QuxError extends Error {
    name = 'QuxError';
}

@ErrorToResponse({ 500: [QuzError] })
@Controller('')
class FooController {
    @Get('/foo')
    @ErrorToResponse({ 400: [FooError] })
    async foo() {
        throw new FooError('Foo!');
    }

    @Get('/bar')
    @ErrorToResponse({ 400: [BarError] })
    async bar() {
        throw new BarError('Bar!');
    }

    @Get('/foo-bar-quz')
    async fooBarQuz() {
        throw new FooBarQuzError('FooBarQuz!');
    }

    @Get('/qux')
    @ErrorToResponse({
        400: [
            [
                QuxError,
                (e: QuxError) => {
                    return {
                        errorCode: e.name,
                        message: e.message,
                        iAmQux: true,
                    };
                },
            ],
        ],
    })
    async qux() {
        throw new QuxError('Qux!');
    }
}

@Catch()
@Injectable()
class AppExceptionFilter implements ExceptionFilter {
    constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const { httpAdapter } = this.httpAdapterHost;
        const ctx = host.switchToHttp();

        return httpAdapter.reply(
            ctx.getResponse(),
            {
                isGlobalFilter: true,
            },
            429
        );
    }
}

@Module({
    providers: [
        {
            provide: APP_FILTER,
            useClass: AppExceptionFilter,
        },
    ],
    controllers: [FooController],
})
class ModuleForTest {}

describe('ErrorToResponse', () => {
    let app: INestApplication;
    let client: SuperTest<any>;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ModuleForTest],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
        client = request(app.getHttpServer());
    });

    test('mapping error to status code', async () => {
        const response = await client.get('/foo');

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            errorCode: 'FooError',
            message: 'Foo!',
        });
    });

    test('route has higher priority over controller', async () => {
        const response = await client.get('/bar');

        expect(response.statusCode).toBe(400);
    });

    test('chain of responsibility', async () => {
        const response = await client.get('/foo-bar-quz');

        expect(response.statusCode).toBe(429);
    });

    test('can specify error transformer', async () => {
        const response = await client.get('/qux');

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            iAmQux: true,
            errorCode: 'QuxError',
            message: 'Qux!',
        });
    });
});
