// Usage: node startup-container.mjs <image> <port> <envFile> [runs]
// Startup = `docker run` -> first 200 on GET /api/v1/ready (median of runs).
// RSS = VmRSS of the container's node process after startup + 100 GraphQL
// `{ __typename }` requests (median). Same container overhead for every image.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [image, port, envFile, runsArg] = process.argv.slice(2);
const runs = Number(runsArg ?? 5);
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8' }).trim();

const startups = [];
const rss = [];
for (let i = 0; i < runs; i++) {
  const name = `poc-startup-${process.pid}-${i}`;
  const t0 = performance.now();
  try {
    docker(
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '--network',
      'host',
      '--env-file',
      envFile,
      '-e',
      `PORT=${port}`,
      image,
    );
    let up = false;
    while (!up) {
      if (performance.now() - t0 > 90000)
        throw new Error('server did not start');
      try {
        up = (await fetch(`${base}/api/v1/ready`)).status === 200;
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
    const pid = docker('inspect', '-f', '{{.State.Pid}}', name);
    const nodePid = execFileSync('pgrep', ['-P', pid], { encoding: 'utf8' })
      .trim()
      .split('\n')[0];
    const status = readFileSync(`/proc/${nodePid}/status`, 'utf8');
    rss.push(Number(/VmRSS:\s+(\d+)/.exec(status)[1]) / 1024);
  } finally {
    // Stop the container even when the run failed (timeout, pgrep miss).
    docker('stop', '-t', '40', name);
  }
}
console.log(
  JSON.stringify({
    image,
    startupMsMedian: Math.round(median(startups)),
    startupsMs: startups.map(Math.round),
    rssMbMedian: Math.round(median(rss)),
    rssMb: rss.map(Math.round),
  }),
);
