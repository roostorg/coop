#!/usr/bin/env node
import getBottle from '../iocContainer/index.js';
import {
  isWorkerOrJobName,
  WORKER_AND_JOB_NAMES,
} from '../iocContainer/services/workersAndJobs.js';
import { runWorkerOrJob } from './runWorkerOrJobLib.js';

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

runWorkerOrJob(container[workerOrJobName]);
