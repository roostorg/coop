import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Hand-off point from the Umzug/SequelizeMeta history. Refuses to run unless
 * the SQL migration named below (the last one before the hand-off) is
 * recorded in SequelizeMeta, and does nothing else. It doesn't check earlier
 * migrations individually, or detect SQL migrations applied afterwards.
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
