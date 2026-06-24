-- Adds `item_ip_address` to `analytics.CONTENT_API_REQUESTS` to support
-- investigating by IP address over the analytics lookback window (longer than
-- Scylla's 30-day TTL).
--
-- The value is denormalized at write time by the server (extracted from the
-- item's `ipAddress` schema field role) rather than parsed out of `item_data`
-- JSON at query time, because the field holding the IP is org/item-type
-- specific. It defaults to '' so existing rows remain queryable without a
-- backfill and older code paths that don't send it keep working.
--
-- The bloom_filter data-skipping index keeps high-cardinality IP equality
-- lookups from scanning every granule.

ALTER TABLE analytics.CONTENT_API_REQUESTS
  ADD COLUMN IF NOT EXISTS item_ip_address String DEFAULT '';

ALTER TABLE analytics.CONTENT_API_REQUESTS
  ADD INDEX IF NOT EXISTS item_ip_address_idx item_ip_address TYPE bloom_filter GRANULARITY 4;
