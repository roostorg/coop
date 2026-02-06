/**
 * @fileoverview Connects to pg via sequelize and exposes some helper functions
 * for running queries in a transaction.
 *
 * Critically, this code is not in models/index.ts in order to avoid a circular
 * dependency with model definitions that use the transactionWithRetry helper.
 */
import clsHooked from 'cls-hooked';
import pkg, { type Transaction, type TransactionOptions } from 'sequelize';

import { safeGet } from '../utils/misc.js';

const { Sequelize } = pkg;
const {
  DATABASE_HOST,
  DATABASE_READ_ONLY_HOST,
  DATABASE_PORT = 5432,
  DATABASE_NAME = 'development',
  DATABASE_USER = 'postgres',
  DATABASE_PASSWORD,
  SEQUELIZE_PRINT_LOGS,
} = process.env;

// Set up CLS so that we can ambiently link queries into the same transaction.
// See https://sequelize.org/docs/v6/other-topics/transactions/
Sequelize.useCLS(clsHooked.createNamespace('sequelize'));

export const makeSequelize = () =>
  new Sequelize(DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD, {
    port: Number(DATABASE_PORT),
    // eslint-disable-next-line no-console
    logging: SEQUELIZE_PRINT_LOGS === 'true' ? console.log : false,
    dialect: 'postgres',
    replication: {
      read: [{ host: DATABASE_READ_ONLY_HOST }],
      write: { host: DATABASE_HOST },
    },
    pool: {
      max: 150,
      acquire: 15_000,
      // This timeout was made crazy long so that queries which take a long time
      // to respond don't cause Sequelize to release the connection back to the
      // pool and/or close it. We needed this for loading location bank
      // locations, which were previously stored as 40mb json blobs, which pg
      // could take ~1 minute to respond with (or more when the db was under
      // heavy load). Going forward, we don't want to have idle connections for
      // this long (and should warn if a connection is idle in connection for
      // more than, idk, ~5s), but having a long idle timeout is still probably
      // better than canceling the query and releasing the connection. However,
      // we also don't want this to be too long, so that a server instance that
      // briefly needs to open a lot of connections (e.g., to warm its caches on
      // startup) doesn't hold those connections for longer than necessary,
      // which'll add db load and [in future] potentially lead to hitting the
      // db's max connection limit as new server instances are autoscaled in.
      idle: 300_000,
      // TODO: set maxUses once we start auto scaling the number of read replicas.
      // See https://github.com/sequelize/sequelize-pool#using-maxuses-option
      // Think about how/if we'll do this w/ our kysely connection pools.
    },
    dialectOptions: {
      //ssl: true,
      query_timeout: 1_000_000,
      idle_in_transaction_session_timeout: 300_000,
    },
  });

export function maketransactionWithRetry(
  sequelize: pkg.Sequelize,
): TransactionWithRetry {
  /**
   * Run a Sequelize transaction, and auto-retry up to two times if it fails due
   * to a serialization error. Sequelize's should really have this built-in See
   * https://stackoverflow.com/questions/68427796/sequelize-transaction-retry-doenst-work-as-expected
   *
   * See https://www.postgresql.org/docs/current/transaction-iso.html
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function transactionWithRetry(...args: any[]) {
    let remainingTries = 3;
    while (remainingTries > 0) {
      try {
        remainingTries -= 1;
        return await sequelize.transaction(...args);
      } catch (e: unknown) {
        if (safeGet(e, ['original', 'code']) === '40001') {
          await sequelize.query('ROLLBACK');
        } else {
          throw e;
        }
      }
    }

    throw new Error('Retry limit exceeded.');
  };
}

type TransactionWithRetry = {
  <T>(
    options: TransactionOptions,
    autoCallback: (t: Transaction) => PromiseLike<T>,
  ): Promise<T>;
  <T>(autoCallback: (t: Transaction) => PromiseLike<T>): Promise<T>;
};
