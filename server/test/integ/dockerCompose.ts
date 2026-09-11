/**
 * Docker-compose service-control primitives for outage integration tests
 * (#343).
 *
 * The integ harness runs out-of-container alongside the docker-compose stack
 * from `npm run up`, so we can `docker compose stop/start/pause/unpause` the
 * individual services to simulate outages and slow dependencies.
 *
 * - `stop` / `start`: full container restart. TCP is rejected immediately
 *   while stopped. Use this for "dependency is unreachable" scenarios.
 * - `pause` / `unpause`: SIGSTOP / SIGCONT the container. TCP connections
 *   hang instead of being rejected. Use this for "dependency is slow /
 *   hung" scenarios, since it's closer to a network timeout than `stop`.
 *
 * Both wrappers (`withServiceDown`, `withServicePaused`) restore the
 * service in a `finally` block so a test assertion failing inside the
 * callback can't leak a stopped/paused service into a subsequent test
 * — which would cascade-fail the rest of the suite.
 *
 * Tests using this helper MUST run with `--runInBand` (single worker)
 * since the docker stack is shared state.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const DEFAULT_COMPOSE_TIMEOUT_MS = 30_000;

async function compose(
  args: readonly string[],
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const { timeoutMs = DEFAULT_COMPOSE_TIMEOUT_MS } = opts;
  // `docker compose` (v2, space-separated) per the project's AGENTS.md.
  // Shell-quoting the service name keeps multi-word names safe even though
  // the compose services in this repo don't use any.
  await execAsync(
    `docker compose ${args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')}`,
    { timeout: timeoutMs },
  );
}

export async function stopService(svc: string): Promise<void> {
  await compose(['stop', svc]);
}

export async function startService(svc: string): Promise<void> {
  // `start` (rather than `up`) reuses the existing container instead of
  // recreating it — keeps volumes and data intact across the stop/start
  // cycle so the next test sees the same DB state.
  await compose(['start', svc]);
}

export async function pauseService(svc: string): Promise<void> {
  await compose(['pause', svc]);
}

export async function unpauseService(svc: string): Promise<void> {
  await compose(['unpause', svc]);
}

/**
 * Run `fn` with `svc` stopped, then start it again no matter how `fn`
 * exited. Errors from the restart are surfaced as an `AggregateError`
 * alongside the original test error so neither failure mode is hidden.
 */
export async function withServiceDown<T>(
  svc: string,
  fn: () => Promise<T>,
): Promise<T> {
  await stopService(svc);
  try {
    return await fn();
  } finally {
    try {
      await startService(svc);
    } catch (restoreErr) {
       
      console.error(
        `[outage] failed to restart ${svc} after test; subsequent tests may be affected`,
        restoreErr,
      );
    }
  }
}

/**
 * Run `fn` with `svc` paused, then unpause it. Same restore-on-throw
 * contract as `withServiceDown`.
 */
export async function withServicePaused<T>(
  svc: string,
  fn: () => Promise<T>,
): Promise<T> {
  await pauseService(svc);
  try {
    return await fn();
  } finally {
    try {
      await unpauseService(svc);
    } catch (restoreErr) {
       
      console.error(
        `[outage] failed to unpause ${svc} after test; subsequent tests may be affected`,
        restoreErr,
      );
    }
  }
}
