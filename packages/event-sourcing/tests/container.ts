import { Container } from 'inversify';
import pg from 'pg';

import config from './config';

const container = new Container();

container
    .bind<pg.Client>('PGClient')
    .toDynamicValue(() => new pg.Client(config.EVENT_SOURCING.EVENT_STORE))
    .inSingletonScope();
container.onDeactivation<pg.Client>('PostgresClient', async (client) => {
    await client.end();
});

export default container;
