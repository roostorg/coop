import { readFileSync } from 'fs';
import { dirname, join as pathJoin, resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';
import {
  SCRIPT_TEMPLATES_DIR_ABSOLUTE_PATH,
  ScyllaStorage,
  wrapMigration,
  type DatabaseConfig,
} from '@roostorg/db-migrator';
import { Client as ScyllaClient, types as scyllaTypes } from 'cassandra-driver';
import { Umzug } from 'umzug';

const __dirname = dirname(fileURLToPath(import.meta.url));
const relativePath = (it: string) => pathJoin(__dirname, it);

const driverOpts = {
  credentials: {
    username: process.env.SCYLLA_USERNAME!,
    password: process.env.SCYLLA_PASSWORD!,
  },
  contactPoints: process.env.SCYLLA_HOSTS!.split(',').map((it) => it.trim()),
  localDataCenter: process.env.SCYLLA_LOCAL_DATACENTER!,
  queryOptions: {
    consistency: scyllaTypes.consistencies.localQuorum,
  },
  keyspace: process.env.SCYLLA_KEYSPACE!,
};

const scyllaEnvironmentDependentOptions = {
  keyspaceReplication: {
    class: process.env.SCYLLA_REPLICATION_CLASS!,
    replication_factor: Number(process.env.SCYLLA_REPLICATION_FACTOR!),
  },
};

export default {
  defaultScriptFormat: 'cjs',
  supportedScriptFormats: ['cjs'],
  supportedEnvironments: ['staging', 'prod'],
  scriptsDirectory: relativePath('../scripts/scylla'),

  createStorage() {
    return new ScyllaStorage({ driverOptions: driverOpts });
  },

  async createContext() {
    const client = new ScyllaClient(driverOpts);
    await client.connect();
    return client;
  },

  async destroyContext(context) {
    await context.shutdown();
  },

  async destroyStorage(storage) {
    await storage.shutdown();
  },

  resolveScript(params) {
    const client = params.context;
    const { keyspace } = driverOpts;

    const baseResult = Umzug.defaultResolver(params);

    async function resetActiveKeyspace() {
      await client.execute(`USE "${keyspace}";`);
    }

    return wrapMigration({ runBefore: resetActiveKeyspace }, baseResult);
  },

  getTemplate(filePath: string) {
    return filePath.endsWith('.cjs')
      ? readFileSync(
          pathResolve(SCRIPT_TEMPLATES_DIR_ABSOLUTE_PATH, './scylla.cjs'),
          'utf8',
        )
      : '';
  },

  async dropDbAndDisconnect() {
    const client = new ScyllaClient(driverOpts);
    await client.connect();
    await client.execute(`DROP KEYSPACE "${driverOpts.keyspace}";`);
    await client.shutdown();
  },

  async prepareDbAndDisconnect() {
    //Driver will error if we connect with the keyspace set if it does not already exist
    const { keyspace, ...opts } = driverOpts;
    const replication = scyllaEnvironmentDependentOptions.keyspaceReplication;
    const client = new ScyllaClient(opts);
    await client.connect();
    await client.execute(`CREATE KEYSPACE IF NOT EXISTS "${keyspace}"
                           WITH replication = { 'class': '${replication.class}',
                           'replication_factor': ${replication.replication_factor}};`);
    await client.shutdown();
  },
} satisfies DatabaseConfig<
  'cjs',
  ScyllaClient,
  ScyllaStorage
> as DatabaseConfig<'cjs', ScyllaClient, ScyllaStorage>;
