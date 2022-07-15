import { Container } from 'inversify';

import config from './config';
import pg from 'pg';

const container = new Container();

container
    .bind<pg.Client>('PGClient')
    .toDynamicValue(() => new pg.Client(config.EVENT_SOURCING.EVENT_STORE))
    .inSingletonScope();
container.onDeactivation<pg.Client>('PostgresClient', async (client) => {
    await client.end();
});

export default container;
