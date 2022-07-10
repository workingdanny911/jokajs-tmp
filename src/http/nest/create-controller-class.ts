import 'reflect-metadata';
import { Controller } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

type ControllerDependencies = { [controllerProperty: string]: any };

export interface RouteConfig<TParams extends any[] = any[], TResponse = any> {
    name: string;
    handler: (...params: TParams) => Promise<TResponse>;
    decoratorsForHandler: MethodDecorator[];
    decoratorsForHandlerParameters: ParameterDecorator[];
}

export function createControllerClass(
    name: string,
    dependencies: ControllerDependencies
) {
    class ControllerClass {
        private injectedDependencies: { [property: string]: any } = {};

        constructor(private moduleRef: ModuleRef) {
            for (const [property, dependencyKey] of Object.entries(
                dependencies
            )) {
                const dep = moduleRef.get(dependencyKey);
                (this as any)[property] = dep;
                this.injectedDependencies[property] = dep;
            }
        }
    }

    Object.defineProperty(ControllerClass, 'name', { value: name });
    Reflect.defineMetadata('design:paramtypes', [ModuleRef], ControllerClass);

    return ControllerClass as { new (): any };
}

function defineRoute<THandlerParams extends any[] = any[], TResponse = any>(
    controllerPrototype: any,
    {
        name,
        handler,
        decoratorsForHandler,
        decoratorsForHandlerParameters,
    }: RouteConfig<THandlerParams, TResponse>
) {
    Object.defineProperty(controllerPrototype, name, {
        value: handler,
        writable: false,
        configurable: true,
        enumerable: true,
    });

    decoratorsForHandlerParameters.forEach((decorator, index) =>
        decorator(controllerPrototype, name, index)
    );

    const handlerDescriptor = Object.getOwnPropertyDescriptor(
        controllerPrototype,
        name
    ) as PropertyDescriptor;

    for (const decorator of decoratorsForHandler) {
        decorator(controllerPrototype, name, handlerDescriptor);
    }
}

// eslint-disable-next-line
export function buildControllerClass({
    name,
    urlPrefix,
    decorators = [],
    dependencies = {},
    routes = [],
}: {
    name: string;
    decorators: ClassDecorator[];
    dependencies: ControllerDependencies;
    urlPrefix: string;
    routes: any[];
}) {
    const controllerClass = createControllerClass(name, dependencies);

    for (const routeConfig of routes) {
        defineRoute(controllerClass.prototype, routeConfig);
    }

    Controller(urlPrefix)(controllerClass);
    for (const decorator of decorators) {
        decorator(controllerClass);
    }

    return controllerClass;
}
