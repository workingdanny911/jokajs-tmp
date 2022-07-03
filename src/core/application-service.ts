import Ajv, { ErrorObject, JSONSchemaType, ValidateFunction } from 'ajv';

import { Class } from '../utils';

import { Command, Message } from './message';
import { UnitOfWork } from './unit-of-work';

const ajv = new Ajv();

class ValidationError extends Error {
    name = 'ValidationError';

    constructor(message: string, public errors: ErrorObject[] = []) {
        super(message);
    }
}

export function createCommandFactory<TCommand extends Command>(
    commandClass: Class<TCommand>,
    schema: JSONSchemaType<TCommand['data']>
) {
    const commandType = commandClass.name;
    let validate = ajv.getSchema(commandType);
    if (!validate) {
        ajv.addSchema(schema, commandType);
        validate = ajv.getSchema(commandType);
    }

    return createCommandFactoryWithValidateFunction(
        commandClass,
        validate as ValidateFunction<JSONSchemaType<TCommand['data']>>
    );
}

export function createCommandFactoryWithValidateFunction<
    TCommand extends Command
>(
    commandClass: Class<TCommand>,
    validate: ValidateFunction<JSONSchemaType<TCommand['data']>>
) {
    return (data: TCommand['data'], causationMessageId?: Message['id']) => {
        if (!validate(data) && validate.errors) {
            throw new ValidationError(
                'Command validation failed. See errors for details.',
                validate.errors
            );
        }

        return new commandClass(data, { causationMessageId });
    };
}

type CommandHandler = (
    command: Command,
    unitOfWork: UnitOfWork
) => Promise<unknown>;

export interface ErrorResponse {
    commandType: string;
    commandId: string;
    errorCode: string;
    errorMessage: string;
    errorDetails?: any;
}

export class ApplicationService {
    protected unitOfWork: UnitOfWork;

    constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
        this.unitOfWork = unitOfWork;
    }

    public async execute<TSuccessResponse = any>(
        command: Command
    ): Promise<TSuccessResponse | ErrorResponse> {
        let response: TSuccessResponse | ErrorResponse;
        const commandHandler = this.getCommandHandler(command.type);

        try {
            response = (await commandHandler.call(
                this,
                command,
                this.unitOfWork
            )) as TSuccessResponse;
        } catch (e: any) {
            response = {
                commandId: command.id,
                commandType: command.type,
                errorCode: e.name,
                errorMessage: e.message,
                errorDetails: e.details,
            };
        }
        return response;
    }

    protected getCommandHandler(commandType: string) {
        const commandHandlerName = `execute${commandType}` as keyof this;
        const commandHandler = this[
            commandHandlerName
        ] as unknown as CommandHandler;
        if (!commandHandler) {
            throw new Error(
                `command '${commandType}' cannot be executed in '${this.constructor.name}'.`
            );
        }

        return commandHandler;
    }
}
