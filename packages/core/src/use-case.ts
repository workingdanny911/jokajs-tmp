import { ErrorWithDetails } from '@jokajs/utils';
import { Command, Message } from './message';
import assert from 'assert';

export class ApplicationError extends ErrorWithDetails {
    constructor(public code = 'ApplicationError', ...args: any[]) {
        super(...args);
    }
}

interface CommandPayloadValidator<TCommand extends Command> {
    validate(data: Partial<TCommand['data']>): {
        value: TCommand['data'];
        error: any;
    };
}

export abstract class UseCase<
    TCommand extends Command = Command,
    TResponse = any
> {
    public static commandType: string;
    protected static commandPayloadValidator: CommandPayloadValidator<
        Command<any>
    >;
    protected static autoAssignDependencies = true;

    constructor(dependencies?: Record<string, any>) {
        const thisClass = this.constructor as typeof UseCase;
        assert(
            thisClass.commandType,
            `'commandType' is not defined for ${thisClass.name}`
        );
        assert(
            thisClass.commandPayloadValidator,
            `'commandPayloadValidator' is not defined for ${thisClass.name}`
        );
        if (dependencies && thisClass.autoAssignDependencies) {
            Object.assign(this, dependencies);
        }
    }

    public static createCommand<TCommand extends Command = Command>(
        payload: Partial<TCommand>
    ): TCommand {
        const { value, error } = this.commandPayloadValidator.validate(payload);
        if (error) {
            throw new ApplicationError(
                'InvalidCommandPayload',
                error.message,
                error.details
            );
        }
        return Message.asType<TCommand>(this.commandType, value);
    }

    public abstract execute(command: TCommand): Promise<TResponse>;
}
