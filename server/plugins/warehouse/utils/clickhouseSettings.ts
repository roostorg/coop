import { safeGetEnvInt } from '../../../iocContainer/utils.js';

const DEFAULT_MAX_BYTES_BEFORE_EXTERNAL = 1_500_000_000;

export interface ClickhouseMemorySettings {
  max_bytes_before_external_group_by: string;
  max_bytes_before_external_sort: string;
  max_threads: number;
  max_block_size: string;
}

export function getClickhouseMemorySettings(): ClickhouseMemorySettings {
  return {
    max_bytes_before_external_group_by: String(
      safeGetEnvInt(
        'CLICKHOUSE_MAX_BYTES_BEFORE_EXTERNAL_GROUP_BY',
        DEFAULT_MAX_BYTES_BEFORE_EXTERNAL,
      ),
    ),
    max_bytes_before_external_sort: String(
      safeGetEnvInt(
        'CLICKHOUSE_MAX_BYTES_BEFORE_EXTERNAL_SORT',
        DEFAULT_MAX_BYTES_BEFORE_EXTERNAL,
      ),
    ),
    max_threads: safeGetEnvInt('CLICKHOUSE_MAX_THREADS', 2),
    max_block_size: String(safeGetEnvInt('CLICKHOUSE_MAX_BLOCK_SIZE', 32768)),
  };
}
