// Usage: node startup.mjs <serverDir> <port> [runs]
// Startup = process spawn -> first 200 on GET /api/v1/ready (median of runs).
// RSS = VmRSS after startup + 100 GraphQL `{ __typename }` requests (median).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [dir, port, runsArg] = process.argv.slice(2);
const runs = Number(runsArg ?? 5);
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const startups = [];
const rss = [];
for (let i = 0; i < runs; i++) {
  const t0 = performance.now();
  const child = spawn(
    'node',
    ['--env-file-if-exists=.env', './transpiled/bin/www.js'],
    { cwd: dir, env: { ...process.env, PORT: port }, stdio: 'ignore' },
  );
  let up = false;
  while (!up) {
    if (performance.now() - t0 > 60000) throw new Error('server did not start');
    try {
      const r = await fetch(`${base}/api/v1/ready`);
      up = r.status === 200;
    } catch {}
    if (!up) await sleep(10);
  }
  startups.push(performance.now() - t0);
  for (let j = 0; j < 100; j++) {
    await fetch(`${base}/api/v1/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    }).then((r) => r.text());
  }
  const status = readFileSync(`/proc/${child.pid}/status`, 'utf8');
  rss.push(Number(/VmRSS:\s+(\d+)/.exec(status)[1]) / 1024);
  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
}
console.log(
  JSON.stringify({
    dir,
    startupMsMedian: Math.round(median(startups)),
    startupsMs: startups.map(Math.round),
    rssMbMedian: Math.round(median(rss)),
    rssMb: rss.map(Math.round),
  }),
);
