/**
 * Data Warehouse Abstraction Layer
 * 
 * Provides abstraction for data warehouses: Snowflake, Clickhouse, PostgreSQL, etc.
 * Switch warehouses by setting WAREHOUSE_ADAPTER
 */

export * from './dataWarehouse/index.js';

