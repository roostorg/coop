import { runWorkerOrJob } from '../../bin/runWorkerOrJobLib.js';

// Child process for bin/runWorkerOrJobLib.test.ts. argv[2] picks what to run:
// `worker` and `job` run until aborted; `failing-job` rejects at once.
const kind = process.argv[2];

// The interval keeps the process alive, as a real worker's open connections do.
const waitForAbort = async (signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const keepAlive = setInterval(() => {}, 1_000);
    signal?.addEventListener(
      'abort',
      () => {
        clearInterval(keepAlive);
        resolve();
      },
      { once: true },
    );
  });

runWorkerOrJob({
  type: kind === 'worker' ? 'Worker' : 'Job',
  async run(signal) {
    if (kind === 'failing-job') {
      throw new Error('job failed');
    }
    return waitForAbort(signal);
  },
  async shutdown() {},
});

process.stdout.write('ready\n');
