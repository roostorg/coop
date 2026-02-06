/**
 * Data Warehouse Storage Abstraction
 * 
 * This module provides an abstraction layer for data warehouse operations,
 * allowing easy switching between different providers (Snowflake, Clickhouse, etc.)
 */

export {
  type IDataWarehouse,
  type IDataWarehouseDialect,
  type DataWarehouseConnectionSettings,
  type DataWarehousePoolSettings,
  type TransactionFunction,
} from './IDataWarehouse.js';

export {
  SnowflakeKyselyAdapter,
  type SnowflakeConnectionSettings,
} from './SnowflakeAdapter.js';

export {
  ClickhouseKyselyAdapter,
  type ClickhouseConnectionSettings,
} from './ClickhouseAdapter.js';

export {
  DataWarehouseFactory,
  type DataWarehouseProvider,
  type IDataWarehouseProvider,
  type DataWarehouseConfig,
} from './DataWarehouseFactory.js';

