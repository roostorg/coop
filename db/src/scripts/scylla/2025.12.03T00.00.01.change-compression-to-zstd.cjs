'use strict';

// NB: The Datastax Cassandra/Scylla Driver only supports 1 SQL statement
// per API call. So Scylla migrations should use sequential, raw `query` calls.

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.up = async function ({ context }) {
  const query = context.execute.bind(context);

  /**
    * Moving from LZ4 compression to Zstd to improve the compression ratio of
    * our data, as scylla storage costs are quite high. Zstd almost always
    * gives better space savings at the expense of higher
    * compression/decompression times Given that our Scylla cluster has a lot
    * of idle CPU, the tradeoff here should only favor us and provide cost
    * savings while not stressing out the cluster or extending query times too
    * much. A good discussion of the tradeoffs for scylla compression
    * strategies is here:
    * https://www.scylladb.com/2019/10/07/compression-in-scylla-part-two/
    *
    * After testing, confirmed that all materialized views need to be manually
    * updated with the desired compression settings (which makes sense).
  */
  await query(`
    ALTER TABLE item_submission_by_thread WITH compression = {'sstable_compression': 'ZstdCompressor', 'compression_level': 1, 'chunk_length_in_kb': 16 };
    `);
  await query(`
    ALTER TABLE user_strikes WITH compression = {'sstable_compression': 'ZstdCompressor', 'compression_level': 1, 'chunk_length_in_kb': 16 };
    `);
  await query(`
    ALTER TABLE rule_action_execution_times WITH compression = {'sstable_compression': 'ZstdCompressor', 'compression_level': 1, 'chunk_length_in_kb': 16 };
    `);
  await query(`
    ALTER MATERIALIZED VIEW item_submission_by_thread_and_time WITH compression = {'sstable_compression': 'ZstdCompressor', 'compression_level': 1, 'chunk_length_in_kb': 16 };
    `);
  await query(`
    ALTER MATERIALIZED VIEW item_submission_by_creator WITH compression = {'sstable_compression': 'ZstdCompressor', 'compression_level': 1, 'chunk_length_in_kb': 16 };
    `);
};

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.down = async function ({ context }) {
  const query = context.execute.bind(context);
};
