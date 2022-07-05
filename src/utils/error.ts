export class ErrorWithDetails<TDetails = any> extends Error {
    details: TDetails;

    constructor(message?: string, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.details = details as TDetails;
    }
}
