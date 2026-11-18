import { BaseCommand } from '@adonisjs/core/ace';
import type { CommandOptions } from '@adonisjs/core/types/ace';

import {
  isWorkerOrJobName,
  WORKER_AND_JOB_NAMES,
} from '../iocContainer/services/workersAndJobs.js';
import { logErrorJson } from '../utils/logging.js';
import { type WorkerOrJob } from '../workers_jobs/index.js';

/**
 * `node ace worker:run <name>` runs a worker until it's stopped, or a job
 * until it finishes. `bin/run-worker-or-job.js <name>`, which the worker
 * image and Kubernetes manifests call, forwards to this command.
 *
 * On SIGTERM/SIGINT, a failure, or a job finishing, the command aborts the
 * signal passed to `run()`, awaits `shutdown()`, and exits non-zero if
 * anything failed.
 */
export default class RunWorkerOrJob extends BaseCommand {
  static override commandName = 'worker:run';
  static override description =
    'Run a worker (until stopped) or a job (until it finishes)';
  static override options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  };

  static {
    this.defineArgument('workerOrJobName', {
      type: 'string',
      description: `One of: ${WORKER_AND_JOB_NAMES.join(', ')}`,
    });
  }

  declare workerOrJobName: string;

  override async run() {
    const name = this.workerOrJobName;
    if (!isWorkerOrJobName(name)) {
      this.logger.error(
        `Invalid worker or job name argument, available options: ${WORKER_AND_JOB_NAMES.join(', ')}.`,
      );
      this.exitCode = 1;
      await this.terminate();
      return;
    }

    const workerOrJob: WorkerOrJob = await this.app.container.make(name);
    const controller = new AbortController();
    let failed = false;

    // `terminate()` runs these hooks; process.exitCode is set from
    // `this.exitCode` by AdonisJS' ace process.
    this.app.terminating(async () => {
      try {
        controller.abort();
      } catch (e) {
        failed = true;
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({
          message:
            'graceful shutdown failed while running abort signal listeners',
          error: e,
        });
      }
      try {
        await workerOrJob.shutdown();
      } catch (e) {
        failed = true;
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({
          message: 'graceful shutdown failed with error',
          error: e,
        });
      }
      this.exitCode = failed ? 1 : 0;
    });
    this.app.listen('SIGTERM', async () => this.terminate());
    this.app.listen('SIGINT', async () => this.terminate());

    workerOrJob.run(controller.signal).then(
      // Jobs shut down when run() settles; workers only on error or signal.
      async () => {
        if (workerOrJob.type === 'Job') {
          await this.terminate();
        }
      },
      async (error: unknown) => {
        failed = true;
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({
          message: 'shutdown worker/job after encountering error during run',
          error,
        });
        await this.terminate();
      },
    );
  }
}
