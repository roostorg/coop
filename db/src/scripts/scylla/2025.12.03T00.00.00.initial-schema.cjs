'use strict';

// NB: The Datastax Cassandra/Scylla Driver only supports 1 SQL statement
// per API call. So Scylla migrations should use sequential, raw `query` calls.

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.up = async function ({ context }) {
  const query = context.execute.bind(context);
  const allowedCompactionStrategies = new Set([
    'SizeTieredCompactionStrategy',
    'LeveledCompactionStrategy',
    'TimeWindowCompactionStrategy',
    'IncrementalCompactionStrategy'
  ]);

  await query(
    'CREATE TYPE IF NOT EXISTS item_identifier (id text, type_id text);',
  );

  await query(
    'CREATE TYPE IF NOT EXISTS item_identifier (id text, type_id text);',
  );

  /**
   * using the recommended and superior tombstone removal method:
   * https://www.scylladb.com/2022/06/30/preventing-data-resurrection-with-repair-based-tombstone-garbage-collection/
   */
  await query(`CREATE TABLE IF NOT EXISTS item_submission_by_thread (
	org_id text,
	request_id text,
	submission_id text,
  item_identifier frozen <item_identifier>,
	item_type_version text,
	item_type_schema_variant text,
	item_type_schema text,
	item_type_schema_field_roles text,
	item_type_name text,
	item_data text,
	item_creator_identifier frozen<item_identifier>,
  item_submission_time timestamp,
	item_synthetic_created_at timestamp,
	item_synthetic_created_hour timestamp,
	synthetic_thread_id text,
	thread_identifier frozen<item_identifier>,
	parent_identifier frozen<item_identifier>,
	PRIMARY KEY ((org_id, synthetic_thread_id), parent_identifier, item_synthetic_created_at, item_identifier, submission_id)
) WITH CLUSTERING ORDER BY (parent_identifier ASC, item_synthetic_created_at DESC)
		AND cdc = {'enabled':true}
		AND compression = {'sstable_compression': 'LZ4Compressor'}
    AND default_time_to_live = 2592000
    AND tombstone_gc = {'mode' : '${
      process.env.SCYLLA_HAS_ENTERPRISE_FEATURES === 'true'
        ? 'repair'
        : 'immediate'
    }' }
    ${allowedCompactionStrategies.has(process.env.SCYLLA_COMPACTION_STRATEGY ?? '')
      ? `AND compaction = { 'class': '${process.env.SCYLLA_COMPACTION_STRATEGY}' }`
      : ''
    };`);

  await query(`CREATE MATERIALIZED VIEW IF NOT EXISTS item_submission_by_thread_and_time
  AS SELECT * FROM item_submission_by_thread
  WHERE item_identifier IS NOT NULL AND org_id IS NOT NULL
  AND submission_id IS NOT NULL AND synthetic_thread_id IS NOT NULL
  AND item_synthetic_created_at IS NOT NULL AND parent_identifier IS NOT NULL
  PRIMARY KEY((org_id, synthetic_thread_id), item_synthetic_created_at, item_identifier, parent_identifier, submission_id)
  WITH CLUSTERING ORDER BY (item_synthetic_created_at DESC);`);

  await query(`CREATE MATERIALIZED VIEW IF NOT EXISTS item_submission_by_creator AS
	SELECT * FROM item_submission_by_thread
	WHERE org_id IS NOT NULL AND item_creator_identifier IS NOT NULL
	AND item_synthetic_created_at IS NOT NULL AND item_identifier IS NOT NULL
	AND synthetic_thread_id IS NOT NULL AND parent_identifier IS NOT NULL
	AND submission_id IS NOT NULL
	PRIMARY KEY((org_id, item_creator_identifier), item_synthetic_created_at, item_identifier, synthetic_thread_id, parent_identifier, submission_id)
	WITH compression = { 'sstable_compression': 'LZ4Compressor', 'chunk_length_in_kb': 128 };`);

  await query(`CREATE TABLE IF NOT EXISTS user_strikes (
	org_id text,
  user_identifier frozen <item_identifier>,
  created_at timestamp,
	policy_id text,
  action_correlation_id text,
  user_strike_count int,
	PRIMARY KEY ((org_id, user_identifier), created_at, policy_id)
) WITH CLUSTERING ORDER BY (created_at DESC)
		AND compression = {'sstable_compression': 'LZ4Compressor'}
    AND default_time_to_live = 7776000
    ${allowedCompactionStrategies.has(process.env.SCYLLA_COMPACTION_STRATEGY ?? '')
      ? `AND compaction = { 'class': '${process.env.SCYLLA_COMPACTION_STRATEGY}' }`
      : ''
    };`);
  await query(`CREATE INDEX ON user_strikes(org_id)`);

  await query(
    'CREATE INDEX on item_submission_by_thread(item_identifier);',
  );

  await query(`CREATE TABLE IF NOT EXISTS rule_action_execution_times (
	org_id text,
  user_identifier frozen <item_identifier>,
  rule_id text,
  last_action_execution_time timestamp,
	PRIMARY KEY ((org_id, user_identifier), rule_id)
) WITH compression = {'sstable_compression': 'LZ4Compressor'}
    AND default_time_to_live = 7776000
    ${allowedCompactionStrategies.has(process.env.SCYLLA_COMPACTION_STRATEGY ?? '')
      ? `AND compaction = { 'class': '${process.env.SCYLLA_COMPACTION_STRATEGY}' }`
      : ''
    };`);
};

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.down = async function ({ context }) {
  const query = context.execute.bind(context);
};
