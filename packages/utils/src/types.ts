import { createClient } from 'redis';

export type Class<T> = { new (...args: any[]): T };

export type PromiseSettledResult<T = any> = {
    status: 'fulfilled' | 'rejected';
    value?: T;
    reason?: any;
};

export type RedisClient = ReturnType<typeof createClient>;
