/**
 * Exercises the proposed hand-off from Umzug/SequelizeMeta to TypeORM
 * migrations against a database built by the current SQL migrations: a
 * baseline migration that only checks SequelizeMeta, then an ordinary forward
 * migration and its rollback. Everything runs inside a rolled-back transaction.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import { createTransactionalTestDb } from '../../test/harness/transactionalPgPool.js';
import { makeTypeormDataSource } from './dataSource.js';
import { Baseline1763400000000 } from './migrations/1763400000000-Baseline.js';

class AddProbeColumn1763400000001 implements MigrationInterface {
  name = 'AddProbeColumn1763400000001';
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(
      `ALTER TABLE public.orgs ADD COLUMN typeorm_probe text`,
    );
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query(
      `ALTER TABLE public.orgs DROP COLUMN typeorm_probe`,
    );
  }
}

describe('TypeORM migrations on a SequelizeMeta database', () => {
  it('baselines, migrates forward and rolls back', async () => {
    const tdb = createTransactionalTestDb(getPgConnectionParams());
    await tdb.begin();
    const ds = makeTypeormDataSource(tdb.pool);
    ds.setOptions({
      migrations: [Baseline1763400000000, AddProbeColumn1763400000001],
      migrationsTableName: 'typeorm_migrations',
      migrationsTransactionMode: 'each',
    });
    await ds.initialize();
    const hasProbe = async () =>
      (
        await ds.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'typeorm_probe'`,
        )
      ).length === 1;
    try {
      const ran = await ds.runMigrations();
      expect(ran.map((m) => m.name)).toEqual([
        'Baseline1763400000000',
        'AddProbeColumn1763400000001',
      ]);
      expect(await hasProbe()).toBe(true);
      expect(await ds.showMigrations()).toBe(false);

      await ds.undoLastMigration();
      expect(await hasProbe()).toBe(false);
      const history: { name: string }[] = await ds.query(
        `SELECT name FROM typeorm_migrations ORDER BY id`,
      );
      expect(history.map((h) => h.name)).toEqual(['Baseline1763400000000']);
      // The SequelizeMeta history is left untouched.
      const [{ count }] = await ds.query(
        `SELECT count(*)::int AS count FROM "SequelizeMeta"`,
      );
      expect(count).toBeGreaterThan(0);
    } finally {
      await ds.destroy();
      await tdb.rollback();
      await tdb.end();
    }
  }, 60_000);
});
