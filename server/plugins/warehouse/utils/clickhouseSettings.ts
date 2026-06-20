import { safeGetEnvInt } from '../../../iocContainer/utils.js';

// Spilling large GROUP BY / ORDER BY operations to disk keeps a heavy query
// below the server-wide memory limit, so it degrades gracefully instead of being
// killed by ClickHouse's OvercommitTracker. Default ~1.5 GB; override per
// deployment via env vars to match the ClickHouse host's available RAM.
const DEFAULT_MAX_BYTES_BEFORE_EXTERNAL = 1_500_000_000;

export interface ClickhouseMemorySettings {
  max_bytes_before_external_group_by: string;
  max_bytes_before_external_sort: string;
}

/**
 * Builds the ClickHouse client memory settings from env vars, falling back to
 * sane defaults. Values are returned as strings because the client types
 * `UInt64` settings as `string`.
 */
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
  };
}
