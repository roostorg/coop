import { readFileSync } from 'fs';
import { resolve as pathResolve } from 'path';
import { type ConnectionOptions } from 'tls';
import {
  makeSequelizeUmzugStorage,
  SCRIPT_TEMPLATES_DIR_ABSOLUTE_PATH,
  wrapMigration,
  type DatabaseConfig,
} from '@roostorg/db-migrator';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import {
  QueryTypes,
  Sequelize,
  type Options,
  type QueryInterface,
} from 'sequelize';
import { Umzug } from 'umzug';

const postgresSupportedScriptFormats = ['sql', 'cjs'] as const;
type PostgresSupportedScriptFormats =
  (typeof postgresSupportedScriptFormats)[number];

type PostgresContext = QueryInterface & { kysely: Kysely<unknown> };

export function makePostgresDatabaseConfig(opts: {
  defaultScriptFormat: PostgresSupportedScriptFormats;
  scriptsDirectory: string;
  driverOpts: Options & { schema: string };
  maintenanceDatabase?: string;
  /** TLS options for every connection; undefined connects without TLS. */
  ssl?: ConnectionOptions;
  /** `pg.Client` subclass for every connection, e.g. to explain TLS errors. */
  pgClient?: typeof pg.Client;
}): DatabaseConfig<PostgresSupportedScriptFormats, PostgresContext> {
  const { scriptsDirectory, defaultScriptFormat } = opts;
  // Forward server-side `RAISE NOTICE` / `RAISE WARNING` from migrations
  // (e.g. PL/pgSQL DO blocks that report rows they modified) to stderr.
  // Sequelize sets `client_min_messages` to WARNING by default, which makes
  // postgres filter NOTICE-severity messages server-side before they reach
  // the client; we lower it to NOTICE on each connection so RAISE NOTICE
  // actually surfaces, then attach a listener that prints each one.
  type PgClientLike = {
    on: (event: string, cb: (msg: unknown) => void) => void;
    query: (sql: string, cb: (err: unknown) => void) => void;
  };
  const isPgClientLike = (c: unknown): c is PgClientLike =>
    c !== null &&
    typeof c === 'object' &&
    'on' in c &&
    typeof (c as { on: unknown }).on === 'function' &&
    'query' in c &&
    typeof (c as { query: unknown }).query === 'function';
  const driverOpts: Options & { schema: string } = {
    ...opts.driverOpts,
    // Sequelize's pg dialect ignores a top-level `ssl` field.
    ...(opts.ssl
      ? {
          dialectOptions: { ...opts.driverOpts.dialectOptions, ssl: opts.ssl },
        }
      : {}),
    // Sequelize creates connections with `dialectModule.Client`; the rest of
    // the module comes from `pg` through the prototype.
    ...(opts.pgClient
      ? {
          dialectModule: Object.create(pg, {
            Client: { value: opts.pgClient },
          }) as typeof pg,
        }
      : {}),
    hooks: {
      ...opts.driverOpts.hooks,
      afterConnect(connection: unknown) {
        if (!isPgClientLike(connection)) return;
        connection.on('notice', (msg) => {
          const m = msg as { message?: string; severity?: string };
          const severity = m.severity ?? 'NOTICE';
          // eslint-disable-next-line no-console
          console.warn(`[postgres ${severity}] ${m.message ?? ''}`);
        });
        connection.query(`SET client_min_messages = 'notice'`, (err) => {
          if (err) {
            // eslint-disable-next-line no-console
            console.warn(
              `[postgres] failed to lower client_min_messages: ${String(err)}`,
            );
          }
        });
      },
    },
  };
  // DB used for CREATE/DROP DATABASE (can't be the target DB itself).
  // Defaults to `postgres`; some managed providers use a different name
  // (e.g. `defaultdb`).
  const maintenanceDatabase = opts.maintenanceDatabase ?? 'postgres';

  return {
    supportedEnvironments: ['staging', 'prod'],
    supportedScriptFormats: postgresSupportedScriptFormats,
    defaultScriptFormat,
    scriptsDirectory,

    createStorage() {
      return makeSequelizeUmzugStorage(new Sequelize(driverOpts), {
        charset: 'utf8',
        collate: 'utf8_unicode_ci',
        schema: driverOpts.schema,
      });
    },

    createContext() {
      // For backwards compatibility w/ existing migrations, the context
      // object that we give to umzug needs to continue to be a sequelize
      // QueryInterface object. However, some migrations need to be able to
      // use kysely, so we just attach a kysely instance directly onto the
      // existing object, exploiting JS dynamism.
      const sequelize = new Sequelize(driverOpts);
      const queryInterface = sequelize.getQueryInterface() as QueryInterface & {
        kysely: Kysely<unknown>;
      };

      queryInterface.kysely = new Kysely({
        dialect: new PostgresDialect({
          pool: new pg.Pool({
            ...driverOpts,
            user: driverOpts.username,
            ssl: opts.ssl,
            ...(opts.pgClient ? { Client: opts.pgClient } : {}),
          }),
        }),
      });
      return queryInterface;
    },

    destroyContext(context) {
      return context.sequelize.close();
    },

    resolveScript(params) {
      const { path } = params;
      const { sequelize } = params.context;

      const baseResult = path.endsWith('.cjs')
        ? Umzug.defaultResolver(params)
        : {
            name: params.name,
            up() {
              const sql = readFileSync(path).toString();
              return sequelize.query(sql);
            },
          };

      async function validatePostgresViews() {
        const viewNames = await sequelize.query<{
          viewName: string;
          schemaName: string;
        }>(
          `select
                table_schema as "schemaName",
                table_name as "viewName"
              from information_schema.views
              where LOWER(table_schema) not in ('information_schema', 'pg_catalog')`,
          { type: QueryTypes.SELECT },
        );

        await Promise.all(
          viewNames.map(async (it) =>
            sequelize.query(
              `SELECT * FROM "${it.schemaName}"."${it.viewName}" LIMIT 10`,
              { type: QueryTypes.SELECT },
            ),
          ),
        );
      }

      return wrapMigration({ runAfter: validatePostgresViews }, baseResult);
    },

    getTemplate(filePath: string) {
      return filePath.endsWith('.cjs')
        ? readFileSync(
            pathResolve(SCRIPT_TEMPLATES_DIR_ABSOLUTE_PATH, './sequelize.cjs'),
            'utf8',
          )
        : '';
    },

    async dropDbAndDisconnect() {
      const targetDbconn = new Sequelize(driverOpts);
      await targetDbconn.authenticate();
      await targetDbconn.close();

      const sequelize = new Sequelize({
        ...driverOpts,
        database: maintenanceDatabase,
      });
      await sequelize.query(
        `DROP DATABASE "${driverOpts.database}" WITH (FORCE);`,
      );
      await sequelize.close();
    },

    async prepareDbAndDisconnect() {
      const sequelize = new Sequelize({
        ...driverOpts,
        database: maintenanceDatabase,
      });
      const existing = await sequelize.query(
        `SELECT 1 FROM pg_database WHERE datname = ?`,
        { replacements: [driverOpts.database], type: QueryTypes.SELECT },
      );
      if (existing.length === 0) {
        // DDL identifiers can't be bound; driverOpts.database comes from
        // trusted config (env vars), not user input.
        await sequelize.query(`CREATE DATABASE "${driverOpts.database}";`);
      }
      await sequelize.close();
    },
  };
}
