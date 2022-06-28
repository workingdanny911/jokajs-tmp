import EventEmitter from 'events';

import { createClient } from 'redis';

export type Class<T> = { new (...args: any[]): T };

export type PromiseSettledResult<T = any> = {
    status: 'fulfilled' | 'rejected';
    value?: T;
    reason?: any;
};

export type RedisClient = ReturnType<typeof createClient>;

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

export class TrampolineRunner extends EventEmitter {
    private static INTERVAL = 1000;

    private _execBody?: (runner: TrampolineRunner) => Promise<void>;
    protected shouldStop = false;
    protected currentRun = 0;
    protected currentState: 'not running' | 'running' | 'stopped' =
        'not running';
    protected isRunning = false;

    constructor(protected interval = TrampolineRunner.INTERVAL) {
        super();
    }

    public async run(runFor?: number) {
        if (this.currentState === 'stopped') {
            return;
        }
        this.currentState = 'running';

        await this.doRun();

        if (this.determineShouldStop(runFor)) {
            this.doStop();
        } else {
            await this.restAndRunAgain(runFor);
        }
    }

    private async doRun() {
        try {
            await this.getExecutionBody().call(this, this);
            this.emit('ran');
        } catch (e) {
            this.emit('error', e);
            return;
        }
    }

    private getExecutionBody() {
        return this._execBody ?? this.execBody;
    }

    private determineShouldStop(runFor?: number) {
        return (
            this.shouldStop ||
            (typeof runFor === 'number' && ++this.currentRun >= runFor)
        );
    }

    private doStop() {
        this.currentState = 'stopped';
        this.emit('stopped');
    }

    private async restAndRunAgain(runFor: number | undefined) {
        await new Promise((resolve) => setTimeout(resolve, this.interval));
        await this.run(runFor);
    }

    protected async execBody() {
        return;
    }

    public async stop() {
        const isNotRunning = this.currentState !== 'running';
        if (isNotRunning) {
            return;
        }

        this.shouldStop = true;
        return await new Promise((resolve) => {
            this.on('stopped', resolve);
        });
    }

    public reset() {
        this.currentState = 'not running';
        this.shouldStop = false;
        this.currentRun = 0;
    }

    public setExecutionBody(
        execBody: (runner: TrampolineRunner) => Promise<void>
    ) {
        this._execBody = execBody;
    }
}

export class ErrorWithDetails extends Error {
    details?: any;

    constructor(message?: string, details?: any) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
    }
}
