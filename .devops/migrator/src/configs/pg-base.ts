import { readFileSync } from 'fs';
import { resolve as pathResolve } from 'path';
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
}): DatabaseConfig<PostgresSupportedScriptFormats, PostgresContext> {
  const { driverOpts, scriptsDirectory, defaultScriptFormat } = opts;

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
      // Verify that the user provided valid credentials for the db we're
      // trying to drop, and that it exists, by trying to connect to it;
      // throw if we can't.
      const targetDbconn = new Sequelize(driverOpts);
      await targetDbconn.authenticate();
      await targetDbconn.close();

      // Now, connect to the default `postgres` db, rather than the db that we
      // want to drop, because, in postgres, the database currently connected
      // to cannot be dropped.
      const postgresDbConn = new Sequelize({
        ...driverOpts,
        database: 'postgres',
      });
      const dbName = driverOpts.database;

      await postgresDbConn.query(`DROP DATABASE "${dbName}" WITH (FORCE);`);
      await postgresDbConn.close();
    },

    async prepareDbAndDisconnect() {
      const sequelize = new Sequelize({ ...driverOpts, database: 'postgres' });
      const databases = await sequelize.query(
        `SELECT * FROM pg_database WHERE datname='${driverOpts.database}'`,
      );
      if ((databases[1] as any).rows.length === 0) {
        await sequelize.query(`CREATE DATABASE "${driverOpts.database}";`);
      }
      await sequelize.close();
    },
  };
}
