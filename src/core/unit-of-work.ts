export interface UnitOfWork<TTransaction = any> {
    start<TResult = any>(
        execBody: (transaction: TTransaction) => Promise<TResult>
    ): Promise<TResult>;
}
