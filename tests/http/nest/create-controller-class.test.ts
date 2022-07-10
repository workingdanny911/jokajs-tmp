import 'reflect-metadata';
import {Body, Get, HttpCode, Module, Param, Post, Query,} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {ExpressAdapter} from '@nestjs/platform-express';
import request from 'supertest';

import {Nest} from "@joka/http";

const foo = 'foo';
const DEFAULT_CONTROLLER_CONFIG = {
    name: 'FooController',
    routePrefix: '',
    dependencies: { foo: 'foo' },
};
const DEFAULT_MODULE_METADATA = {
    providers: [{ provide: 'foo', useValue: foo }],
};

async function setup(controllerConfig?: any, moduleMetadata?: any) {
    if (!controllerConfig) {
        controllerConfig = DEFAULT_CONTROLLER_CONFIG;
    }
    if (!moduleMetadata) {
        moduleMetadata = DEFAULT_MODULE_METADATA;
    }

    const controllerClass = Nest.buildControllerClass(controllerConfig);

    @Module({
        ...moduleMetadata,
        controllers: [controllerClass],
    })
    class ModuleForTest {}

    const moduleRef = await Test.createTestingModule({
        imports: [ModuleForTest],
    }).compile();
    const app = moduleRef.createNestApplication(new ExpressAdapter());
    await app.init();

    return {
        app,
        controllerClass,
        module: ModuleForTest,
    };
}

describe('createControllerClass', () => {
    test('simple controller creation', async () => {
        const { app, module, controllerClass } = await setup({
            name: 'FooController',
            prefix: '',
            dependencies: { foo: 'foo' },
        });

        const controller = app.select(module).get(controllerClass) as any;

        expect(controller.constructor.name).toBe('FooController');
        expect(controller.foo).toBe(foo);
    });

    test('applying decorators to controller', async () => {
        function SimpleDecorator(target: any) {
            target._isDecorated = true;
        }

        const { controllerClass } = await setup({
            decorators: [SimpleDecorator],
        });

        expect((controllerClass as any)._isDecorated).toBe(true);
    });

    test('defining api routes', async () => {
        type _Route1_QueryParams = { quz: string };
        type _Route1_HandlerParams = [string, _Route1_QueryParams];
        type _Route1_Response = {
            param: string;
            queryParams: _Route1_QueryParams;
        };
        type _Route2_Body = { foo: string };
        type _Route2_HandlerParams = [_Route2_Body];
        type _Route2_Response = _Route2_Body;
        const { app } = await setup({
            urlPrefix: '',
            routes: [
                {
                    name: 'get-foo',
                    async handler(
                        param: string,
                        queryParams: _Route1_QueryParams
                    ) {
                        return {
                            param,
                            queryParams,
                        };
                    },
                    decoratorsForHandler: [Get('/foo/:param'), HttpCode(200)],
                    decoratorsForHandlerParameters: [Param('param'), Query()],
                } as Nest.RouteConfig<_Route1_HandlerParams, _Route1_Response>,
                {
                    name: 'post-foo',
                    async handler(body: _Route2_Body) {
                        return body;
                    },
                    decoratorsForHandler: [Post('/foo'), HttpCode(201)],
                    decoratorsForHandlerParameters: [Body()],
                } as Nest.RouteConfig<_Route2_HandlerParams, _Route2_Response>,
            ],
        });
        const client = request(app.getHttpServer()) as any;

        const response1 = await client.get('/foo/bar?quz=foobar');
        expect(response1.statusCode).toBe(200);
        expect(response1.body).toEqual({
            param: 'bar',
            queryParams: { quz: 'foobar' },
        });

        const response2 = await client.post('/foo/').send({ foo: 'bar' });
        expect(response2.statusCode).toBe(201);
        expect(response2.body).toEqual({
            foo: 'bar',
        });
    });
});
