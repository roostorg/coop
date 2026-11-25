import { makeMockedServer } from '../test/setupMockedServer.js';

describe('404 Handling', () => {
  let request: Awaited<ReturnType<typeof makeMockedServer>>['request'],
    shutdown: Awaited<ReturnType<typeof makeMockedServer>>['shutdown'];

  beforeAll(async () => {
    ({ request, shutdown } = await makeMockedServer());
  });

  afterAll(async () => {
    await shutdown();
  });

  test('returns the expected response', async () => {
    return request
      .post('/api/v1/missing-route')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchInlineSnapshot(`
          {
            "errors": [
              {
                "status": 404,
                "title": "Requested route not found.",
                "type": [
                  "/errors/not-found",
                ],
              },
            ],
          }
        `);
      });
  });
});

describe('Error handling', () => {
  test("errors thrown after sending a response shouldn't lead to sending status twice", async () => {
    // A route that flushes its response and then fails, like a handler that
    // replies 202 and keeps working in the background.
    const { request, shutdown } = await makeMockedServer({
      extraRoutes(router) {
        router.get('/api/v1/error', async ({ response }) => {
          response.status(202).send('Accepted');
          response.finish();
          throw new Error('error after send.');
        });
      },
    });

    try {
      const resp = await request.get('/api/v1/error');
      expect(resp.status).toEqual(202);
      expect(resp.body).toEqual({});
    } finally {
      await shutdown();
    }
  });
});
