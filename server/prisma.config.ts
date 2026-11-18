import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url:
      process.env.PRISMA_DATABASE_URL ??
      `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT ?? '5432'}/${process.env.DATABASE_NAME}`,
    ...(process.env.PRISMA_SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.PRISMA_SHADOW_DATABASE_URL }
      : {}),
  },
});
