import type { Snowflake } from 'snowflake-promise';

export type { Snowflake };

let SnowflakePromise: typeof Snowflake | null = null;

try {
  const module = await import('snowflake-promise');

  SnowflakePromise = module.Snowflake;
} catch (error) {
  // Intentionally ignored: snowflake-promise is an optional dependency
}

export function requireSnowflake(): typeof Snowflake {
  if (!SnowflakePromise) {
    throw new Error('snowflake-promise is required but not installed');
  }
  return SnowflakePromise;
}
