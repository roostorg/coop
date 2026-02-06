import { DataTypes, type ModelOptions, type Sequelize } from 'sequelize';
import { RunnableMigration, SequelizeStorage } from 'umzug';

export function makeSequelizeUmzugStorage(
  sequelize: Sequelize,
  opts: ModelOptions,
) {
  return new SequelizeStorage({
    sequelize,
    model: sequelize.define(
      'SequelizeMeta',
      {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          primaryKey: true,
          autoIncrement: false,
        },
      },
      { timestamps: true, ...opts },
    ),
  });
}

export function wrapMigration<T>(
  hooks: {
    runBefore?: () => void | Promise<void>;
    runAfter?: () => void | Promise<void>;
  },
  migration: RunnableMigration<T>,
) {
  return {
    ...migration,
    async up(params) {
      await hooks.runBefore?.();
      await migration.up(params);
      await hooks.runAfter?.();
    },
    ...(migration.down
      ? {
          async down(params) {
            await hooks.runBefore?.();
            await migration.down!(params);
            await hooks.runAfter?.();
          },
        }
      : {}),
  } satisfies RunnableMigration<T>;
}
