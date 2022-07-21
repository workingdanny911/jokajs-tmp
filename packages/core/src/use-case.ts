import { ErrorWithDetails } from '@jokajs/utils';
import { Message } from './message';

export class ApplicationError extends ErrorWithDetails {
    constructor(public code = 'ApplicationError', ...args: any[]) {
        super(...args);
    }
}

export abstract class UseCase<
    TCommand extends Message<any> = Message<any>,
    TResponse = any
> {
    protected static autoAssignDependencies = true;

    constructor(dependencies?: Record<string, any>) {
        if (dependencies && (this.constructor as any).autoAssignDependencies) {
            Object.assign(this, dependencies);
        }
    }

    // eslint-disable-next-line
    public static createCommand(data: any): any {
        throw new Error('not implemented');
    }

    public abstract execute(command: TCommand): Promise<TResponse>;
}
