import { makeMockedServer } from '../test/setupMockedServer.js';

// Header- and routing-level behaviour of the HTTP layer that API clients and
// browsers depend on, independent of any one route's handler.
describe('HTTP layer', () => {
  let request: Awaited<ReturnType<typeof makeMockedServer>>['request'],
    shutdown: Awaited<ReturnType<typeof makeMockedServer>>['shutdown'];

  beforeAll(async () => {
    ({ request, shutdown } = await makeMockedServer());
  });

  afterAll(async () => {
    await shutdown();
  });

  test('the health check answers with security and CORS headers', async () => {
    const res = await request.get('/api/v1/ready').expect(200);
    expect(res.text).toBe('Healthy');
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    // cors(): every response, with or without an Origin header.
    expect(res.headers['access-control-allow-origin']).toBe('*');
    // helmet()
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('answers CORS preflights for any path', async () => {
    const res = await request
      .options('/api/v1/missing-route')
      .set('Origin', 'https://ui.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-api-key')
      .expect(204);
    expect(res.headers).toMatchObject({
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
      'access-control-allow-headers': 'content-type,x-api-key',
      vary: 'Access-Control-Request-Headers',
      'content-length': '0',
    });
  });

  test('answers unknown paths outside /api/v1 with an HTML 404', async () => {
    const res = await request.get('/nope').expect(404);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.text).toContain('<pre>Cannot GET /nope</pre>');
  });

  test('matches paths case-sensitively', async () => {
    await request.get('/API/V1/READY').expect(404);
  });

  test('serves GraphQL on paths under /graphql', async () => {
    const res = await request
      .post('/api/v1/graphql/extra')
      .send({ query: '{ __typename }' })
      .expect(200);
    expect(res.body).toEqual({ data: { __typename: 'Query' } });
  });

  test('ignores non-JSON bodies on GraphQL', async () => {
    await request
      .post('/api/v1/graphql')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('query=%7B__typename%7D')
      .expect(400);
  });
});
