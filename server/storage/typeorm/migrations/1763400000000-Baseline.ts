import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Hand-off point from the Umzug/SequelizeMeta history. Every SQL migration in
 * db/src/scripts/api-server-pg up to and including the one named below must
 * already be applied; this migration refuses to run otherwise, and does
 * nothing else.
 */
export const LAST_SEQUELIZE_MIGRATION =
  '2026.11.17T17.03.20.drop_is_demo_org.sql';

export class Baseline1763400000000 implements MigrationInterface {
  name = 'Baseline1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { name: string }[] = await queryRunner.query(
      `SELECT name FROM "public"."SequelizeMeta" WHERE name = $1`,
      [LAST_SEQUELIZE_MIGRATION],
    );
    if (rows.length === 0) {
      throw new Error(
        `Apply the SQL migrations through ${LAST_SEQUELIZE_MIGRATION} with the db runner before running TypeORM migrations.`,
      );
    }
  }

  public async down(): Promise<void> {
    throw new Error(
      'The baseline cannot be reverted; roll back with the db runner.',
    );
  }
}
