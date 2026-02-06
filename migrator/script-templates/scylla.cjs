'use strict';

// NB: The Datastax Cassandra/Scylla Driver only supports 1 SQL statement
// per API call. So Scylla migrations should use sequential, raw `query` calls.

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.up = async function ({ context }) {
  const query = context.execute.bind(context);
};

/**
 * @param {{ context: import("cassandra-driver").Client }} context
 */
exports.down = async function ({ context }) {
  const query = context.execute.bind(context);
};
