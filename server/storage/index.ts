/**
 * Data Warehouse Abstraction Layer
 *
 * Provides abstraction for data warehouses: Clickhouse, PostgreSQL, etc.
 * Switch warehouses by setting ANALYTICS_DIALECT
 */

export * from './dataWarehouse/index.js';
