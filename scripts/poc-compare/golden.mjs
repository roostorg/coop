// Usage: node golden.mjs <baseUrl> <apiKey> <email> <password> <orgId> > out.json
// Records status, selected headers and normalized body for a fixed request set.
const [base, apiKey, email, password, orgId] = process.argv.slice(2);

const HEADERS = [
  'content-type',
  'content-length',
  'etag',
  'cache-control',
  'location',
  'vary',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'access-control-max-age',
  'access-control-expose-headers',
  'content-security-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster',
  'referrer-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-dns-prefetch-control',
  'x-download-options',
  'x-frame-options',
  'x-permitted-cross-domain-policies',
  'x-xss-protection',
  'x-powered-by',
  'content-disposition',
  'connection',
  'keep-alive',
  'accept-ranges',
  'last-modified',
  'www-authenticate',
];

function normCookie(c) {
  // keep name + attributes, drop the value and expiry date
  const [nv, ...attrs] = c.split(';').map((s) => s.trim());
  const name = nv.split('=')[0];
  return [name, ...attrs.filter((a) => !/^expires=/i.test(a))].join('; ');
}

function normBody(text) {
  try {
    const j = JSON.parse(text);
    return JSON.parse(
      JSON.stringify(j).replace(
        /"(requestId|reportId|id|submissionId)":"[^"]*"/g,
        '"$1":"<id>"',
      ),
    );
  } catch {
    return text.length > 400 ? text.slice(0, 400) + '…' : text;
  }
}

let cookie = '';
async function call(name, method, path, { headers = {}, body, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined && !raw
        ? { 'content-type': 'application/json' }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const h = {};
  for (const k of HEADERS) {
    const v = res.headers.get(k);
    if (v !== null)
      h[k] =
        k === 'etag'
          ? v.startsWith('W/')
            ? '<weak>'
            : '<strong>'
          : k === 'last-modified'
            ? '<present>'
            : v;
  }
  const sc = res.headers.getSetCookie();
  if (sc.length) h['set-cookie'] = sc.map(normCookie);
  return {
    name,
    method,
    path,
    status: res.status,
    headers: h,
    body: normBody(text),
    _sc: sc,
  };
}

const gql = (query, variables) => ({ query, variables });
const results = [];
const push = (r) => {
  const { _sc, ...rest } = r;
  results.push(rest);
  return r;
};
const key = { 'x-api-key': apiKey };
const origin = { origin: 'https://ui.example' };

push(await call('ready', 'GET', '/api/v1/ready'));
push(await call('ready HEAD', 'HEAD', '/api/v1/ready'));
push(await call('ready uppercase path', 'GET', '/API/V1/READY'));
push(await call('ready trailing slash', 'GET', '/api/v1/ready/'));
push(await call('404 GET in api', 'GET', '/api/v1/missing-route'));
push(
  await call('404 POST in api', 'POST', '/api/v1/missing-route', { body: {} }),
);
push(await call('404 outside api', 'GET', '/nope'));
push(
  await call('CORS simple with origin', 'GET', '/api/v1/ready', {
    headers: origin,
  }),
);
push(
  await call('CORS preflight graphql', 'OPTIONS', '/api/v1/graphql', {
    headers: {
      ...origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-api-key',
    },
  }),
);
push(
  await call(
    'CORS preflight unknown route',
    'OPTIONS',
    '/api/v1/missing-route',
    {
      headers: { ...origin, 'access-control-request-method': 'POST' },
    },
  ),
);
push(await call('graphql GET no query', 'GET', '/api/v1/graphql'));
push(
  await call('graphql typename', 'POST', '/api/v1/graphql', {
    body: gql('{ __typename }'),
  }),
);
push(
  await call('graphql me unauth', 'POST', '/api/v1/graphql', {
    body: gql('{ me { id email } }'),
  }),
);
push(
  await call(
    'graphql CSRF-blocked GET',
    'GET',
    '/api/v1/graphql?query=%7B__typename%7D',
  ),
);
push(
  await call(
    'graphql GET with preflight header',
    'GET',
    '/api/v1/graphql?query=%7B__typename%7D',
    { headers: { 'apollo-require-preflight': 'true' } },
  ),
);
push(
  await call('graphql malformed json', 'POST', '/api/v1/graphql', {
    body: '{"query":',
    raw: true,
    headers: { 'content-type': 'application/json' },
  }),
);
push(
  await call('graphql depth limit', 'POST', '/api/v1/graphql', {
    body: gql(
      '{ me { org { users { org { users { org { users { org { users { org { id } } } } } } } } } } }',
    ),
  }),
);
const login = push(
  await call('graphql login wrong password', 'POST', '/api/v1/graphql', {
    body: gql('mutation($i: LoginInput!) { login(input: $i) { __typename } }', {
      i: { email, password: 'wrong-password' },
    }),
  }),
);
const ok = await call('graphql login', 'POST', '/api/v1/graphql', {
  body: gql('mutation($i: LoginInput!) { login(input: $i) { __typename } }', {
    i: { email, password },
  }),
});
push(ok);
cookie = ok._sc.map((c) => c.split(';')[0]).join('; ');
push(
  await call('graphql me authed', 'POST', '/api/v1/graphql', {
    headers: { cookie },
    body: gql('{ me { email permissions } }'),
  }),
);
push(
  await call('graphql policies authed', 'POST', '/api/v1/graphql', {
    headers: { cookie },
    body: gql('{ myOrg { name policies { name } } }'),
  }),
);
push(
  await call(
    'csv export no session',
    'GET',
    '/api/v1/moderation_activity/export',
  ),
);
push(
  await call(
    'csv export cross-site',
    'GET',
    '/api/v1/moderation_activity/export',
    { headers: { cookie, 'sec-fetch-site': 'cross-site' } },
  ),
);
push(
  await call(
    'csv export bad input',
    'GET',
    '/api/v1/moderation_activity/export?input=notjson',
    { headers: { cookie } },
  ),
);
push(
  await call(
    'csv export ok',
    'GET',
    '/api/v1/moderation_activity/export?input=' + encodeURIComponent('{}'),
    { headers: { cookie } },
  ),
);
push(
  await call('items no key', 'POST', '/api/v1/items/async', {
    body: { items: [] },
  }),
);
push(
  await call('items bad key', 'POST', '/api/v1/items/async', {
    headers: { 'x-api-key': 'nope' },
    body: { items: [] },
  }),
);
push(
  await call('items bad body no key', 'POST', '/api/v1/items/async', {
    body: { nope: 1 },
  }),
);
push(
  await call('items no body', 'POST', '/api/v1/items/async', { headers: key }),
);
push(
  await call('items text body', 'POST', '/api/v1/items/async', {
    headers: { ...key, 'content-type': 'text/plain' },
    body: 'hello',
    raw: true,
  }),
);
push(
  await call('items malformed json', 'POST', '/api/v1/items/async', {
    headers: { ...key, 'content-type': 'application/json' },
    body: '{"items": [',
    raw: true,
  }),
);
push(
  await call('items unknown type', 'POST', '/api/v1/items/async', {
    headers: key,
    body: { items: [{ id: '1', typeId: 'nope', data: {} }] },
  }),
);
push(
  await call('items empty list', 'POST', '/api/v1/items/async', {
    headers: key,
    body: { items: [] },
  }),
);
push(
  await call(
    'items empty list trailing slash',
    'POST',
    '/api/v1/items/async/',
    { headers: key, body: { items: [] } },
  ),
);
push(
  await call('items empty string field', 'POST', '/api/v1/items/async', {
    headers: key,
    body: {
      items: [{ id: '1', typeName: 'User', data: { id: '1', name: '' } }],
    },
  }),
);
push(await call('policies', 'GET', '/api/v1/policies/', { headers: key }));
push(await call('item_types', 'GET', '/api/v1/item_types', { headers: key }));
push(await call('actions', 'GET', '/api/v1/actions', { headers: key }));
push(
  await call('actions POST invalid', 'POST', '/api/v1/actions', {
    headers: key,
    body: { actionId: 'x' },
  }),
);
push(
  await call('actions POST unknown action', 'POST', '/api/v1/actions', {
    headers: key,
    body: { actionId: 'x', itemId: 'i', itemTypeId: 't' },
  }),
);
push(
  await call('user_scores missing params', 'GET', '/api/v1/user_scores', {
    headers: key,
  }),
);
push(
  await call('user_scores', 'GET', '/api/v1/user_scores?id=u1&typeId=t1', {
    headers: key,
  }),
);
push(
  await call(
    'user_scores bracket qs',
    'GET',
    '/api/v1/user_scores?id[a]=u1&typeId=t1',
    { headers: key },
  ),
);
push(
  await call('content invalid', 'POST', '/api/v1/content', {
    headers: key,
    body: { contentType: 'x' },
  }),
);
push(
  await call('content unknown type', 'POST', '/api/v1/content', {
    headers: key,
    body: { contentType: 'x', contentId: '1', content: {} },
  }),
);
push(
  await call('report invalid', 'POST', '/api/v1/report', {
    headers: key,
    body: {},
  }),
);
push(
  await call('appeal invalid', 'POST', '/api/v1/report/appeal', {
    headers: key,
    body: {},
  }),
);
push(
  await call(
    'integration logo unknown',
    'GET',
    '/api/v1/integration-logos/nope',
  ),
);
push(
  await call('saml login (not enabled)', 'GET', `/api/v1/saml/login/${orgId}`),
);
push(
  await call(
    'saml callback (not enabled)',
    'POST',
    `/api/v1/saml/login/${orgId}/callback`,
    {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'SAMLResponse=abc',
      raw: true,
    },
  ),
);
push(
  await call('graphql logout', 'POST', '/api/v1/graphql', {
    headers: { cookie },
    body: gql('mutation { logout }'),
  }),
);
push(
  await call('graphql me after logout', 'POST', '/api/v1/graphql', {
    headers: { cookie },
    body: gql('{ me { id } }'),
  }),
);

console.log(JSON.stringify(results, null, 2));
