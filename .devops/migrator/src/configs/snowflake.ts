import { readFileSync } from 'fs';
import { dirname, join as pathJoin, resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';
import {
  makeSequelizeUmzugStorage,
  SCRIPT_TEMPLATES_DIR_ABSOLUTE_PATH,
  wrapMigration,
  type DatabaseConfig,
} from '@roostorg/db-migrator';
import { Sequelize, type Options, type QueryInterface } from 'sequelize';
import { Umzug } from 'umzug';

const __dirname = dirname(fileURLToPath(import.meta.url));
const relativePath = (it: string) => pathJoin(__dirname, it);

const driverOpts = {
  database: process.env.SNOWFLAKE_DB_NAME!,
  username: process.env.SNOWFLAKE_USERNAME!,
  password: process.env.SNOWFLAKE_PASSWORD!,
  logging: console.log,
  dialect: 'snowflake',
  schema: 'PUBLIC',
  dialectOptions: {
    account: String(process.env.SNOWFLAKE_ACCOUNT),
    schema: 'PUBLIC',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    role: process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN',
    // The max time one statement can run before the client will assume
    // it's disconnected from snowflake and timeout.
    timeout: 7_200_000, // 2hr.
    // Enable multi-statement execution for all queries
    // This allows running .sql files with multiple statements
    clientSessionKeepAlive: true,
    enableArrowResultFormat: false,
  },
  pool: {
    max: 10, // 20 is the hard limit in snowflake for number of waiters on a lock
    acquire: 300_000_000, // effectively unlimited
  },
} satisfies Options;

export default {
  defaultScriptFormat: 'cjs',
  supportedScriptFormats: ['cjs', 'sql'],
  scriptsDirectory: relativePath('../scripts/snowflake'),
  supportedEnvironments: ['staging', 'prod'],
  createStorage() {
    return makeSequelizeUmzugStorage(new Sequelize(driverOpts), {
      schema: driverOpts.schema,
    });
  },
  createContext() {
    return new Sequelize(driverOpts).getQueryInterface();
  },
  destroyContext(it) {
    return it.sequelize.close();
  },
  getTemplate(filePath) {
    return filePath.endsWith('.cjs')
      ? readFileSync(
          pathResolve(
            SCRIPT_TEMPLATES_DIR_ABSOLUTE_PATH,
            './sequelize-snowflake.cjs',
          ),
          'utf8',
        )
      : '';
  },
  resolveScript(params) {
    // Unlike in pg, we don't (for now) do any post-migration validation
    // (e.g., on views), but we do (re)set the db + schema at the start of
    // every migration so that the migration doesn't have to worry about a
    // prior migration having possibly switched to a different context.
    const { path } = params;
    const { sequelize } = params.context;
    const { database, schema } = driverOpts;

    const baseResult = path.endsWith('.cjs')
      ? Umzug.defaultResolver(params)
      : {
          name: params.name,
          async up() {
            const sql = readFileSync(path).toString();
            
            // Snowflake doesn't support multi-statement execution in a single query via Sequelize
            // We need to split and execute statements individually
            // Split by semicolon but preserve procedure bodies (which contain semicolons)
            const statements: string[] = [];
            let currentStatement = '';
            let inProcedure = false;
            let procedureQuoteChar = '';
            
            for (const line of sql.split('\n')) {
              const trimmed = line.trim();
              
              // Skip comment lines
              if (trimmed.startsWith('--') || trimmed.length === 0) {
                continue;
              }
              
              currentStatement += line + '\n';
              
              // Track if we're inside a procedure/function body
              if (trimmed.match(/^(CREATE|create).*(PROCEDURE|FUNCTION|procedure|function)/i)) {
                inProcedure = true;
              }
              
              // Look for the procedure/function body delimiter
              if (inProcedure && trimmed.match(/^AS\s+['"]$/i)) {
                procedureQuoteChar = trimmed.slice(-1);
              }
              
              // Check if we're exiting the procedure
              if (inProcedure && procedureQuoteChar && trimmed === `${procedureQuoteChar};`) {
                inProcedure = false;
                procedureQuoteChar = '';
                statements.push(currentStatement.trim());
                currentStatement = '';
                continue;
              }
              
              // Regular statement end (not in procedure)
              if (!inProcedure && trimmed.endsWith(';')) {
                statements.push(currentStatement.trim());
                currentStatement = '';
              }
            }
            
            // Add any remaining statement
            if (currentStatement.trim()) {
              statements.push(currentStatement.trim());
            }
            
            // Execute each statement
            for (const statement of statements) {
              if (statement.length > 0) {
                await sequelize.query(statement);
              }
            }
          },
        };

    async function resetActiveSchemaAndDb() {
      await sequelize.query(`USE DATABASE "${database}";`);
      await sequelize.query(`USE SCHEMA "${schema}";`);
    }

    return wrapMigration({ runBefore: resetActiveSchemaAndDb }, baseResult);
  },
  async dropDbAndDisconnect() {
    const sequelize = new Sequelize(driverOpts);

    await sequelize.query(`DROP DATABASE "${driverOpts.database}";`);
    await sequelize.close();
  },
  async prepareDbAndDisconnect() {
    const sequelize = new Sequelize(driverOpts);
    const { SNOWFLAKE_CLONE_SOURCE_DATABASE } = process.env;
    await sequelize.query(
      `CREATE DATABASE IF NOT EXISTS "${driverOpts.database}"${
        SNOWFLAKE_CLONE_SOURCE_DATABASE
          ? ' CLONE ' + SNOWFLAKE_CLONE_SOURCE_DATABASE
          : ''
      };`,
    );
    await sequelize.close();
  },
} satisfies DatabaseConfig<'sql' | 'cjs', QueryInterface> as DatabaseConfig<
  'sql' | 'cjs',
  QueryInterface
>;
