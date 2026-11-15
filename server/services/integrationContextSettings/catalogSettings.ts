/**
 * How often Coop refreshes an org's plugin signal catalog in the background.
 * Stored in the integration's config JSON under CATALOG_SETTINGS_KEY and never
 * passed to the plugin's getCredential().
 */
export const CATALOG_SETTINGS_KEY = '__coopCatalog';

const HOUR_MS = 60 * 60 * 1000;

export const CATALOG_REFRESH_INTERVALS = {
  MANUAL: null,
  HOURLY: HOUR_MS,
  EVERY_6_HOURS: 6 * HOUR_MS,
  DAILY: 24 * HOUR_MS,
  WEEKLY: 7 * 24 * HOUR_MS,
} as const;

export type CatalogRefreshInterval = keyof typeof CATALOG_REFRESH_INTERVALS;

export const DEFAULT_CATALOG_REFRESH_INTERVAL: CatalogRefreshInterval = 'DAILY';

export function isCatalogRefreshInterval(
  value: unknown,
): value is CatalogRefreshInterval {
  return (
    typeof value === 'string' && Object.hasOwn(CATALOG_REFRESH_INTERVALS, value)
  );
}

/** Reads the org's saved interval, falling back to the default. */
export function readCatalogRefreshInterval(
  storedConfig: Readonly<Record<string, unknown>> | undefined,
): CatalogRefreshInterval {
  const raw = storedConfig?.[CATALOG_SETTINGS_KEY];
  const interval =
    raw != null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).refreshInterval
      : undefined;
  return isCatalogRefreshInterval(interval)
    ? interval
    : DEFAULT_CATALOG_REFRESH_INTERVAL;
}
