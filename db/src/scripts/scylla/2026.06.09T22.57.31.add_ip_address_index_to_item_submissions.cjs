'use strict';

// NB: The Datastax Cassandra/Scylla Driver only supports 1 SQL statement
// per API call. So Scylla migrations should use sequential, raw `query` calls.

// Adds reverse-lookup support for investigating by IP address.
//
// `item_ip_address` is denormalized onto each item submission at write time by
// the server (extracted from the item's `ipAddress` schema field role). The
// `item_submission_by_ip` materialized view then makes "find every item
// associated with this IP" a partition lookup, mirroring the existing
// `item_submission_by_creator` view that powers creator-based investigation.
//
// Rows without an IP (the common case) are excluded from the view by the
// `item_ip_address IS NOT NULL` filter, exactly like the creator view. The view
// inherits the base table's 30-day TTL.

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.up = async function ({ context }) {
  const query = context.execute.bind(context);

  await query(
    'ALTER TABLE item_submission_by_thread ADD item_ip_address text;',
  );

  await query(`CREATE MATERIALIZED VIEW IF NOT EXISTS item_submission_by_ip AS
	SELECT * FROM item_submission_by_thread
	WHERE org_id IS NOT NULL AND item_ip_address IS NOT NULL
	AND item_synthetic_created_at IS NOT NULL AND item_identifier IS NOT NULL
	AND synthetic_thread_id IS NOT NULL AND parent_identifier IS NOT NULL
	AND submission_id IS NOT NULL
	PRIMARY KEY((org_id, item_ip_address), item_synthetic_created_at, item_identifier, synthetic_thread_id, parent_identifier, submission_id)
	WITH CLUSTERING ORDER BY (item_synthetic_created_at DESC)
	AND compression = { 'sstable_compression': 'LZ4Compressor', 'chunk_length_in_kb': 128 };`);
};

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.down = async function ({ context }) {
  const query = context.execute.bind(context);

  await query('DROP MATERIALIZED VIEW IF EXISTS item_submission_by_ip;');
  await query('ALTER TABLE item_submission_by_thread DROP item_ip_address;');
};
