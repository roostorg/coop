/**
 * Snowflake Kysely dialect and shared connection settings.
 * The runtime warehouse logic now lives under server/plugins/warehouse/.
 */

import { Kysely } from 'kysely';
import { SnowflakeDialect } from '../../snowflake/KyselyDialect.js';
import {
  type IDataWarehouseDialect,
  type DataWarehouseConnectionSettings,
  type DataWarehousePoolSettings,
} from './IDataWarehouse.js';

/**
 * Snowflake-specific connection settings
 */
export interface SnowflakeConnectionSettings
  extends DataWarehouseConnectionSettings {
  account: string;
  warehouse: string;
  arrayBindingThreshold?: number;
}

/** Snowflake Kysely dialect adapter */
export class SnowflakeKyselyAdapter implements IDataWarehouseDialect {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly kysely: Kysely<any>;

  constructor(
    connectionSettings: SnowflakeConnectionSettings,
    poolSettings?: DataWarehousePoolSettings,
  ) {
    this.kysely = new Kysely({
      dialect: new SnowflakeDialect({
        connection: {
          account: connectionSettings.account,
          username: connectionSettings.username,
          password: connectionSettings.password,
          database: connectionSettings.database,
          role: connectionSettings.role ?? 'ACCOUNTADMIN',
          schema: connectionSettings.schema ?? 'PUBLIC',
          warehouse: connectionSettings.warehouse,
          arrayBindingThreshold:
            connectionSettings.arrayBindingThreshold ?? Number.MAX_VALUE,
        },
        pool: poolSettings,
      }),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKyselyInstance(): Kysely<any> {
    return this.kysely;
  }

  async destroy(): Promise<void> {
    await this.kysely.destroy();
  }
}

