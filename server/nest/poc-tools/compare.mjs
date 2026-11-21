// Usage: node compare.mjs <serverDir> <port> <outPrefix>
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [dir, port, out] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}/api/v1`;
const env = { ...process.env, PORT: port };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  const t0 = performance.now();
  const p = spawn('node', ['--env-file=.env', 'transpiled/bin/www.js'], {
    cwd: dir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  p.stdout.on('data', (d) => (log += d));
  p.stderr.on('data', (d) => (log += d));
  for (;;) {
    try {
      const r = await fetch(base + '/ready');
      if (r.status === 200) break;
    } catch {}
    if (p.exitCode != null) throw new Error('exited: ' + log.slice(-2000));
    await sleep(10);
  }
  return { p, ms: performance.now() - t0, log: () => log };
}
const stop = async (p) => {
  p.kill('SIGTERM');
  await new Promise((r) => p.once('exit', r));
};
const rss = (pid) =>
  Math.round(
    Number(
      fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1],
    ) / 1024,
  );

const startups = [];
for (let i = 0; i < Number(process.env.STARTS ?? 5); i++) {
  const s = await start();
  startups.push(Math.round(s.ms));
  await stop(s.p);
}
startups.sort((a, b) => a - b);
if (!startups.length) startups.push(0, 0, 0);

const s = await start();
const rssBoot = rss(s.p.pid);
const gql = (body, headers = {}) =>
  fetch(base + '/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
for (let i = 0; i < 100; i++)
  await (await gql({ query: '{ __typename myOrg { id } }' })).text();
const rss100 = rss(s.p.pid);

// SDL via introspection
const {
  getIntrospectionQuery,
  buildClientSchema,
  printSchema,
  lexicographicSortSchema,
} = await import(dir + '/node_modules/graphql/index.js');
const intro = await (await gql({ query: getIntrospectionQuery() })).json();
if (intro.data)
  fs.writeFileSync(
    out + '.sdl.graphql',
    printSchema(lexicographicSortSchema(buildClientSchema(intro.data))),
  );

// REST / HTTP golden responses
const IGNORE = new Set([
  'date',
  'etag',
  'keep-alive',
  'connection',
  'x-powered-by-ignored',
]);
const cases = [
  ['GET /ready', '/ready', {}],
  ['GET /READY/ (case, trailing slash)', '/READY/', {}],
  ['POST /missing-route', '/missing-route', { method: 'POST' }],
  ['GET /missing-route', '/missing-route', {}],
  [
    'POST /items/async no key',
    '/items/async',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"items":[]}',
    },
  ],
  [
    'POST /items/async bad key',
    '/items/async/',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'nope' },
      body: '{"items":[]}',
    },
  ],
  [
    'POST /items/async bad body+no key',
    '/items/async',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"items":[{"id":1}]}',
    },
  ],
  [
    'POST /items/async malformed json',
    '/items/async',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"items":',
    },
  ],
  [
    'POST /report bad body',
    '/report',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  ],
  [
    'POST /report/appeal bad body',
    '/report/appeal',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  ],
  [
    'POST /report/appeal no key',
    '/report/appeal',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        appealId: 'a',
        appealedBy: { typeId: 't', id: 'u' },
        appealedAt: 'x',
        actionedItem: { id: 'i', typeId: 't', data: {} },
        actionsTaken: [],
      }),
    },
  ],
  ['GET /policies no key (legacy)', '/policies', {}],
  [
    'GET /saml/login/unknown-org',
    '/saml/login/unknown-org',
    { redirect: 'manual' },
  ],
  [
    'GET /saml/login/x?SAMLResponse',
    '/saml/login/x?SAMLResponse=abc',
    { redirect: 'manual' },
  ],
  [
    'POST /saml/login/x/callback',
    '/saml/login/x/callback',
    {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'SAMLResponse=abc',
    },
  ],
  [
    'OPTIONS /graphql preflight',
    '/graphql',
    {
      method: 'OPTIONS',
      headers: {
        origin: 'http://x.test',
        'access-control-request-method': 'POST',
      },
    },
  ],
  [
    'POST /graphql unauth myOrg',
    '/graphql',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"query":"{ myOrg { id } }"}',
    },
  ],
  [
    'POST /graphql unauth MRT query',
    '/graphql',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"query":"{ getTotalPendingJobsCount }"}',
    },
  ],
  [
    'POST /graphql login bad pw',
    '/graphql',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation($i: LoginInput!){ login(input:$i){ __typename } }',
        variables: { i: { email: 'nobody@example.com', password: 'x' } },
      }),
    },
  ],
  [
    'POST /graphql depth limit',
    '/graphql',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ myOrg { users { orgId } policies { parent { parent { parent { parent { parent { parent { parent { parent { parent { id } } } } } } } } } } } }',
      }),
    },
  ],
  [
    'POST /graphql syntax error',
    '/graphql',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"query":"{ myOrg { "}',
    },
  ],
  ['GET /graphql (landing)', '/graphql', { headers: { accept: 'text/html' } }],
];
const golden = [];
for (const [name, path, init] of cases) {
  const r = await fetch(base + path, init);
  const headers = Object.fromEntries(
    [...r.headers].filter(([k]) => !IGNORE.has(k)).sort(),
  );
  let body = await r.text();
  body = body
    .replace(/"requestId":"[^"]+"/g, '"requestId":"<id>"')
    .replace(/"stacktrace":\[[^\]]*\]/g, '"stacktrace":[…]');
  golden.push({ name, status: r.status, headers, body: body.slice(0, 600) });
}
fs.writeFileSync(out + '.golden.json', JSON.stringify(golden, null, 2));
await stop(s.p);
console.log(
  JSON.stringify({
    dir,
    startupMsMedian: startups[2],
    startups,
    rssBootMB: rssBoot,
    rssAfter100GqlMB: rss100,
  }),
);
