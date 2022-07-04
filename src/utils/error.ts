export class ErrorWithDetails extends Error {
    details?: any;

    constructor(message?: string, details?: any) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
    }
}