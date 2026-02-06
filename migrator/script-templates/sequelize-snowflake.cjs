'use strict';

// NB: Snowflake migrations should use raw queries, in case Sequelize doesn't
// translate the query correctly. Also, Snowflake only supports 1 SQL statement
// per API call. So Snowflake migrations should use sequential, raw `query` calls.

/**
 * @param {{ context: import("sequelize").QueryInterface }} context
 */
exports.up = async function ({ context }) {
  const query = context.sequelize.query.bind(context.sequelize);
};

/**
 * @param {{ context: import("sequelize").QueryInterface }} context
 */
exports.down = async function ({ context }) {
  const query = context.sequelize.query.bind(context.sequelize);
};
