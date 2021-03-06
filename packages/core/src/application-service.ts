import Ajv, { ErrorObject, JSONSchemaType, ValidateFunction } from 'ajv';

import { Command, Message, MessageHeader } from './message';
import { UnitOfWork } from './unit-of-work';

const ajv = new Ajv();

export class ValidationError extends Error {
    name = 'ValidationError';

    constructor(message: string, public errors: ErrorObject[] = []) {
        super(message);
    }
}

export function createMessageFactory<TMessage extends Message>(
    messageType: string,
    schema: JSONSchemaType<TMessage['data']>
) {
    let validate = ajv.getSchema(messageType);
    if (!validate) {
        ajv.addSchema(schema, messageType);
        validate = ajv.getSchema(messageType);
    }

    return createMessageFactoryWithValidateFunction<TMessage>(
        messageType,
        validate as ValidateFunction<JSONSchemaType<TMessage['data']>>
    );
}

export function createMessageFactoryWithValidateFunction<
    TMessage extends Message = Message
>(
    messageType: string,
    validate: ValidateFunction<JSONSchemaType<TMessage['data']>>
) {
    return (
        data: TMessage['data'],
        headerFields: Partial<MessageHeader> = {}
    ) => {
        if (!validate(data) && validate.errors) {
            throw new ValidationError(
                'Command validation failed. See errors for details.',
                validate.errors
            );
        }

        return new Message(data, {
            ...headerFields,
            type: messageType,
        });
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
