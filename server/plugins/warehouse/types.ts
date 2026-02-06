export interface WarehouseQueryResult {
  [column: string]: unknown;
}

export type WarehouseQueryFn = <T = WarehouseQueryResult>(
  sql: string,
  params?: readonly unknown[],
) => Promise<readonly T[]>;

export type WarehouseTransactionFn<T> = (
  query: WarehouseQueryFn,
) => Promise<T>;
