#!/usr/bin/env node
/**
 * `node bin/run-worker-or-job.js <name>`: the worker image's entry point, kept
 * so existing Kubernetes manifests and compose files work unchanged. Forwards
 * to the `worker:run` ace command (ace_commands/run_worker_or_job.ts).
 */
import { makeCoopIgnitor } from '../adonis/createApp.js';
import {
  isWorkerOrJobName,
  WORKER_AND_JOB_NAMES,
} from '../iocContainer/services/workersAndJobs.js';

// Validate before building the app, so a mistyped name exits without
// connecting to anything.
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

const ignitor = makeCoopIgnitor();
await ignitor.ace().handle(['worker:run', workerOrJobName]);
