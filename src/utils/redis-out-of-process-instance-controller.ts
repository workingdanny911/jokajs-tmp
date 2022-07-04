import {RedisClient} from "./types";

export class RedisOutOfProcessInstanceController {
    public static readonly channelNamePrefix =
        'joka__out-of-process-instance-controller_';
    private static instanceByName: {
        [name: string]: RedisOutOfProcessInstanceController;
    } = {};

    public readonly channelName: string;
    private isReserved = false;

    constructor(
        public readonly name: string,
        private readonly redis: RedisClient,
        options?: {
            channelName?: string;
        }
    ) {
        this.channelName =
            options?.channelName ||
            RedisOutOfProcessInstanceController.makeChannelName(name);

        RedisOutOfProcessInstanceController.setInstance(this);
    }

    public static reset() {
        RedisOutOfProcessInstanceController.instanceByName = {};
    }

    private static setInstance(instance: RedisOutOfProcessInstanceController) {
        const name = instance.name;
        if (this.getInstanceByName(name)) {
            throw new Error(`instance already exists for '${name}'.`);
        }

        this.instanceByName[instance.name] = instance;
    }

    public static getInstanceByName(name: string) {
        return this.instanceByName[name];
    }

    public static makeChannelName(name: string) {
        return `${this.channelNamePrefix}${name}`;
    }

    public async reserve() {
        if (this.isReserved) {
            throw new Error('already reserved');
        }

        await this.redis.subscribe(this.channelName, () => {
            return;
        });

        if (await this.canReserve()) {
            this.isReserved = true;
        } else {
            await this.redis.unsubscribe(this.channelName);
            throw new Error(`could not reserve for '${this.name}'`);
        }
    }

    private async canReserve() {
        return (await this.getNumberOfSubscriptions()) === 1; // 1 because we are subscribed to the channel
    }

    private async getNumberOfSubscriptions() {
        const redis2 = this.redis.duplicate();
        await redis2.connect();

        const numSub = await redis2.PUBSUB_NUMSUB(this.channelName);

        await redis2.quit();
        return numSub[this.channelName];
    }
}