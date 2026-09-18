/**
 * Per-query memory limits sent to ClickHouse with each statement.
 *
 * Values come from `config/dataWarehouse.ts` and are passed in by whoever
 * constructs the adapter. Adapters under `plugins/` deliberately read no
 * environment themselves, so a community-published adapter never has to know
 * how this deployment sources its configuration.
 */
export interface ClickhouseMemorySettings {
  max_bytes_before_external_group_by: string;
  max_bytes_before_external_sort: string;
  max_threads: number;
  max_block_size: string;
}
