/**
 * Data Warehouse Storage Abstraction
 *
 * This module provides an abstraction layer for data warehouse operations,
 * allowing easy switching between different providers (Clickhouse, etc.)
 */

export {
  type IDataWarehouse,
  type IDataWarehouseDialect,
  type DataWarehouseConnectionSettings,
  type DataWarehousePoolSettings,
  type TransactionFunction,
} from './IDataWarehouse.js';

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

