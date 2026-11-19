import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const fixturePath = fileURLToPath(
  new URL('../test/stubs/runTrivialWorkerOrJob.ts', import.meta.url),
);

async function runFixture(kind: string, signal?: NodeJS.Signals) {
  const child = spawn(
    process.execPath,
    ['--loader', 'ts-node/esm', fixturePath, kind],
    {
      env: {
        ...process.env,
        TS_NODE_TRANSPILE_ONLY: 'true',
        NODE_NO_WARNINGS: '1',
      },
    },
  );

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const exited = once(child, 'exit') as Promise<
    [number | null, NodeJS.Signals | null]
  >;

  if (signal) {
    // Signal only once the handlers are installed; before that, the signal's
    // default action would kill the child.
    const ready = new Promise<void>((resolve) => {
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        if (stdout.includes('ready\n')) {
          resolve();
        }
      });
    });
    await Promise.race([
      ready,
      exited.then(([code]) => {
        throw new Error(`child exited ${code} before ready: ${stderr}`);
      }),
    ]);
    child.kill(signal);
  }

  const [code] = await exited;
  return { code, stderr };
}

describe('runWorkerOrJob', () => {
  it.each([
    ['worker', 'SIGTERM'],
    ['worker', 'SIGINT'],
    ['job', 'SIGTERM'],
  ] as const)(
    'shuts down a %s on %s with exit code 0 and no error log',
    async (kind, signal) => {
      const { code, stderr } = await runFixture(kind, signal);

      expect(stderr).toBe('');
      expect(code).toBe(0);
    },
    20_000,
  );

  it('exits 1 and logs the error when a job fails', async () => {
    const { code, stderr } = await runFixture('failing-job');

    expect(stderr).toContain(
      'shutdown worker/job after encountering error during run',
    );
    expect(stderr).toContain('job failed');
    expect(code).toBe(1);
  }, 20_000);
});
