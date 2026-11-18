import fs from 'fs';

const f = fs
  .readdirSync(process.argv[2])
  .find((x) => x.endsWith('.cpuprofile'));
const p = JSON.parse(fs.readFileSync(process.argv[2] + '/' + f));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const dt = new Map();
p.samples.forEach((id, i) =>
  dt.set(id, (dt.get(id) ?? 0) + (p.timeDeltas[i] ?? 0)),
);
const buckets = {};
let total = 0;
for (const [id, t] of dt) {
  const n = byId.get(id);
  const url = n.callFrame.url;
  const m = url.match(
    /node_modules\/(@[^/]+\/[^/]+|[^/@][^/]*)\/(?!.*node_modules)/,
  );
  const k =
    n.callFrame.functionName === '(idle)'
      ? '(idle)'
      : m
        ? m[1]
        : url.includes('/transpiled/')
          ? 'coop'
          : url
            ? 'node-internal'
            : n.callFrame.functionName;
  buckets[k] = (buckets[k] ?? 0) + t;
  if (k !== '(idle)') total += t;
}
console.log('busy ms', Math.round(total / 1000));
Object.entries(buckets)
  .filter(([k]) => k !== '(idle)')
  .sort((a, b) => b[1] - a[1])
  .slice(0, 60)
  .forEach(([k, t]) =>
    console.log(k.padEnd(28), ((100 * t) / total).toFixed(1) + '%'),
  );
