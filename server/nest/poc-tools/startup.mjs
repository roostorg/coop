import { spawn } from 'node:child_process';

const dirs = { main: process.argv[2], branch: process.argv[3] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = { main: [], branch: [] };
for (let i = 0; i < 7; i++)
  for (const [k, dir] of Object.entries(dirs)) {
    const port = k === 'main' ? 8092 : 8091;
    const t0 = performance.now();
    const p = spawn('node', ['--env-file=.env', 'transpiled/bin/www.js'], {
      cwd: dir,
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
    });
    for (;;) {
      try {
        if (
          (await fetch(`http://127.0.0.1:${port}/api/v1/ready`)).status === 200
        )
          break;
      } catch {}
      await sleep(5);
    }
    res[k].push(Math.round(performance.now() - t0));
    p.kill('SIGTERM');
    await new Promise((r) => p.once('exit', r));
  }
for (const k of Object.keys(res)) {
  const s = [...res[k]].sort((a, b) => a - b);
  console.log(k, 'median', s[3], 'all', res[k].join(' '));
}
