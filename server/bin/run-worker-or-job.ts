#!/usr/bin/env node
import _ from 'lodash';

import getBottle from '../iocContainer/index.js';
import {
  isWorkerOrJobName,
  WORKER_AND_JOB_NAMES,
} from '../iocContainer/services/workersAndJobs.js';
import { logErrorJson } from '../utils/logging.js';

// Validate before building the container, so a mistyped name exits without
// opening Postgres, Redis and Scylla connections just to reject the argument.
const workerOrJobName = process.argv[2];
if (!workerOrJobName) {
  // eslint-disable-next-line no-console
  console.error('Missing worker or job name argument.');
  process.exit(1);
}

if (!isWorkerOrJobName(workerOrJobName)) {
  // eslint-disable-next-line no-console
  console.error(
    `Invalid worker or job name argument, available options: ${WORKER_AND_JOB_NAMES.join(', ')}.`,
  );
  process.exit(1);
}

const { container } = await getBottle();

const workerOrJob = container[workerOrJobName];
const controller = new AbortController();

// When the worker/job finishes naturally (which only applies to jobs, as
// workers are meant to run forever), or when it throws an error, or when it
// gets shutdown by kubernetes, we run this function to cleanup gracefully.
// We call shutdown here, rather than in an `abort` listener on the signal so
// that we can await shutdown() finishing.
const onFinish = _.once((errorWhileRunningJobOrWorker?: Error) => {
  let exitWithFailure = Boolean(errorWhileRunningJobOrWorker);

  if (errorWhileRunningJobOrWorker) {
    // eslint-disable-next-line no-restricted-syntax
    logErrorJson({
      message: 'shutdown worker/job after encountering error during run',
      error: errorWhileRunningJobOrWorker,
    });
  }

  try {
    controller.abort();
  } catch (e) {
    exitWithFailure = true;
    // eslint-disable-next-line no-restricted-syntax
    logErrorJson({
      message: 'graceful shutdown failed while running abort signal listeners',
      error: e,
    });
  }

  workerOrJob.shutdown().then(
    () => {
      process.exit(exitWithFailure ? 1 : 0);
    },
    (e) => {
      // eslint-disable-next-line no-restricted-syntax
      logErrorJson({
        message: 'graceful shutdown failed with error',
        error: e,
      });
      process.exit(1);
    },
  );
});

workerOrJob.run(controller.signal).then(
  // For jobs -- but not workers --- shut down when run()'s returned promise
  // is settled. Workers, meanwhile, only shut down if there's actually an error.
  workerOrJob.type === 'Job' ? () => onFinish() : () => {},
  onFinish,
);

process.on('uncaughtException', (err, _) => {
  // eslint-disable-next-line no-restricted-syntax
  logErrorJson({
    message: 'UncaughtException',
    error: err,
  });
  process.exit(1);
});

// Log but don't exit; a stray rejection shouldn't kill the worker.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-restricted-syntax
  logErrorJson({
    message: 'UnhandledRejection',
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });
});

process.once('SIGTERM', onFinish);
process.once('SIGINT', onFinish);
