#!/usr/bin/env node
import _ from 'lodash';

import getBottle from '../iocContainer/index.js';
import { logErrorJson } from '../utils/logging.js';
import { type WorkerOrJob } from '../workers_jobs/index.js';

const { container } = await getBottle();

const workerOrJobName = process.argv[2];
const workerOrJob = (container as any)[workerOrJobName] as WorkerOrJob;
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

process.once('SIGTERM', onFinish);
process.once('SIGINT', onFinish);
