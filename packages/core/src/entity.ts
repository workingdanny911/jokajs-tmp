export type EntityId = number | string;

export abstract class Entity<TId extends EntityId> {
    id: TId;

    constructor(id: TId) {
        this.id = id;
    }
}

