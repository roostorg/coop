import { defineConfig } from 'drizzle-kit';

const env = process.env;

export default defineConfig({
  dialect: 'postgresql',
  schema: './storage/postgres/schema/schema.ts',
  out: env.DRIZZLE_OUT ?? './storage/postgres/drizzle',
  dbCredentials: {
    host: env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(env.DATABASE_PORT ?? 5432),
    user: env.DATABASE_USER ?? 'postgres',
    password: env.DATABASE_PASSWORD ?? '',
    database: env.DATABASE_NAME ?? 'postgres',
    ssl: false,
  },
  schemaFilter: [
    'public',
    'jobs',
    'manual_review_tool',
    'models_service',
    'ncmec_reporting',
    'reporting_rules',
    'signal_auth_service',
    'signals_service',
    'user_management_service',
    'user_statistics_service',
  ],
  tablesFilter: ['*', '!SequelizeMeta'],
  migrations: { table: '__drizzle_migrations', schema: 'drizzle' },
});
