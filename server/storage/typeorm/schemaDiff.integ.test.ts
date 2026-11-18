/**
 * Schema-diff check: asks TypeORM which DDL `synchronize` (or
 * `migration:generate`) would run against a database built by the SQL
 * migrations in /db, and compares it with `schemaDiff.known.sql`.
 *
 * The known diffs are TypeORM limitations, not real drift: it reads
 * `CURRENT_TIMESTAMP`, `tstzrange(...)` and `ARRAY[]::...` defaults back in a
 * form that never equals the entity's, and it assumes every enum lives in its
 * table's schema (so it would DROP and re-ADD four columns whose enum is in
 * `public`). Any other statement means the entities and migrations disagree.
 *
 * TypeORM's schema builder only looks at tables that have a synchronized
 * entity, so a second test checks that every table and view in the database
 * has an entity and that every entity's columns match the real columns. That
 * covers new tables and the `synchronize: false` pseudo-PK tables and views.
 * Triggers and functions aren't modelled and aren't checked.
 *
 * Runs inside a rolled-back transaction because TypeORM's schema reader
 * requires its own `typeorm_metadata` table (used for generated-column
 * expressions and views), which the migrations don't create.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import { createTransactionalTestDb } from '../../test/harness/transactionalPgPool.js';
import { makeTypeormDataSource } from './dataSource.js';
import { entities } from './entities/index.js';

describe('TypeORM entities vs migration-built schema', () => {
  it('needs no DDL beyond the known TypeORM limitations', async () => {
    const tdb = createTransactionalTestDb(getPgConnectionParams());
    await tdb.begin();
    const ds = await makeTypeormDataSource(tdb.pool).initialize();
    try {
      await ds.query(
        `CREATE TABLE IF NOT EXISTS "typeorm_metadata" ("type" varchar NOT NULL, "database" varchar, "schema" varchar, "table" varchar, "name" varchar, "value" text)`,
      );
      // TypeORM compares generated columns against the expression it stored in
      // typeorm_metadata when it created them. Adopting TypeORM means seeding
      // these rows once for every generated column the migrations created.
      await ds.query(
        `INSERT INTO "typeorm_metadata" ("database", "schema", "table", "type", "name", "value")
         SELECT current_database(), table_schema, table_name, 'GENERATED_COLUMN', column_name, generation_expression
         FROM information_schema.columns WHERE is_generated = 'ALWAYS'`,
      );
      const sqlInMemory = await ds.driver.createSchemaBuilder().log();
      const up = sqlInMemory.upQueries.map((q) => q.query);
      const known = fs
        .readFileSync(
          path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            'schemaDiff.known.sql',
          ),
          'utf8',
        )
        .split(';\n')
        .map((q) => q.trim())
        .filter(Boolean);
      expect(up.map((q) => q.trim())).toEqual(known);
    } finally {
      await ds.destroy();
      await tdb.rollback();
      await tdb.end();
    }
  }, 60_000);

  it('has an entity for every table and view, with matching columns', async () => {
    const tdb = createTransactionalTestDb(getPgConnectionParams());
    await tdb.begin();
    const ds = await makeTypeormDataSource(tdb.pool).initialize();
    try {
      const dbColumns: { relation: string; column: string }[] = await ds.query(
        `SELECT n.nspname || '.' || c.relname AS relation, a.attname AS column
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
         WHERE c.relkind IN ('r', 'v', 'm')
           AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
           AND c.relname <> 'SequelizeMeta'`,
      );
      const fromDb = new Set(dbColumns.map((r) => `${r.relation}.${r.column}`));
      const fromEntities = new Set(
        entities.flatMap((entity) => {
          const metadata = ds.getMetadata(entity);
          return metadata.columns.map(
            (column) =>
              `${metadata.schema}.${metadata.tableName}.${column.databaseName}`,
          );
        }),
      );
      expect([...fromDb].filter((c) => !fromEntities.has(c)).sort()).toEqual(
        [],
      );
      expect([...fromEntities].filter((c) => !fromDb.has(c)).sort()).toEqual(
        [],
      );
    } finally {
      await ds.destroy();
      await tdb.rollback();
      await tdb.end();
    }
  }, 60_000);
});
