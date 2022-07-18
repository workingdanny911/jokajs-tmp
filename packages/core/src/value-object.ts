export class ValueObject {
    constructor(data: any) {
        Object.assign(this, data);
        Object.freeze(this);
    }
}
