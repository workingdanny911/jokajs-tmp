import { RedisClient, RedisOutOfProcessInstanceController } from '@joka/utils';

import container from '../container';

const redisClients: RedisClient[] = [];

async function createRedisClient() {
    const redis = container.get<RedisClient>('RedisClient');
    await redis.connect();
    redisClients.push(redis);
    return redis;
}

const NAME = '_test_redis-out-of-process-instance-reservation';
describe('RedisOutOfProcessInstanceReservation', () => {
    let redis: RedisClient;
    let runner: RedisOutOfProcessInstanceController;

    beforeAll(async () => {
        redis = await createRedisClient();
    });
    afterAll(container.unbindAllAsync);

    beforeEach(async () => {
        RedisOutOfProcessInstanceController.reset();
        runner = new RedisOutOfProcessInstanceController(NAME, redis);
    });
    afterEach(async () => {
        await Promise.all(
            redisClients.map(async (client) => await client.pUnsubscribe('*'))
        );
    });

    test('can only instantiate once per name', async () => {
        expect(() => {
            new RedisOutOfProcessInstanceController(runner.name, redis);
        }).toThrow('instance already exists');
    });

    test('reserving', async () => {
        const redis2 = container.get<RedisClient>('RedisClient');
        await redis2.connect();

        await runner.reserve();

        const numSub = await redis2.PUBSUB_NUMSUB(runner.channelName);
        expect(numSub[runner.channelName]).toBe(1);
    });

    test('cannot reserve twice', async () => {
        await runner.reserve();
        await expect(runner.reserve()).rejects.toThrow('already reserved');
    });

    test('unsubscribing when reserving fails', async () => {
        const redis2 = container.get<RedisClient>('RedisClient');
        await redis2.connect();
        await redis2.subscribe(runner.channelName, () => {
            return;
        });

        await expect(runner.reserve()).rejects.toThrow('could not reserve');

        await redis2.unsubscribe(runner.channelName);
        const numSub = await redis2.PUBSUB_NUMSUB(runner.channelName);
        expect(numSub[runner.channelName]).toBe(0);
        await redis2.quit();
    });
});
