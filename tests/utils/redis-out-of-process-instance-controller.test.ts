import { RedisClient, RedisOutOfProcessInstanceController } from 'joka/utils';
import { createRedisClient } from 'joka/test-helpers';
import { container } from 'joka/dependency-injection';

const NAME = '_test_redis-out-of-process-instance-reservation';
describe('RedisOutOfProcessInstanceReservation', () => {
    const redis = createRedisClient();
    let runner: RedisOutOfProcessInstanceController;

    beforeEach(async () => {
        await redis.connect();
        RedisOutOfProcessInstanceController.reset();
        runner = new RedisOutOfProcessInstanceController(NAME, redis);
    });

    afterEach(async () => {
        const clients = container.get<RedisClient[]>('AllRedisClients');
        await Promise.all(
            clients.map(
                async (client) => client.isOpen && (await client.quit())
            )
        );
    });

    test('can only instantiate once per name', async () => {
        expect(() => {
            new RedisOutOfProcessInstanceController(runner.name, redis);
        }).toThrow('instance already exists');
    });

    test('reserving', async () => {
        const redis2 = createRedisClient();
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
        const redis2 = createRedisClient();
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
