export interface UnitOfWork<TTransaction = any> {
    start<TResult = any>(
        execBody: (transaction: TTransaction) => Promise<TResult>
    ): Promise<TResult>;
}

export function Transactional(unitOfWorkProperty = 'unitOfWork') {
    return (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) => {
        const original = descriptor.value;
        descriptor.value = async function (this: any, ...args: any[]) {
            const unitOfWork = this[unitOfWorkProperty] as UnitOfWork;
            return await unitOfWork.start(async () => {
                return original.call(this, ...args);
            });
        };
    };
}
