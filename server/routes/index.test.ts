import { makeMockedServer } from '../test/setupMockedServer.js';

describe('404 Handling', () => {
  let request: Awaited<ReturnType<typeof makeMockedServer>>['request'],
    shutdown: Awaited<ReturnType<typeof makeMockedServer>>['shutdown'];

  beforeAll(async () => {
    // eslint-disable-next-line better-mutation/no-mutation
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
    // mutate the server to add a dummy route that we can trigger. This must
    // start with /api/v1/ so that requests to it will fall through to our error
    // handler, which is only mounted in an app under /api/v1.
    const { server, request, shutdown } = await makeMockedServer();
    server.get('/api/v1/error', async (_req, res, next) => {
      res.sendStatus(202);
      next(new Error('error after send.'));
    });

    // We have to move this new route to be before the catch all 404 route,
    // which makes it tricky. So we put it right after the three handlers that
    // express adds automatically (to parse query params, create the request
    // object, and (iiuc) normalize trailing path slashes), but before all our
    // handlers.
    const newlyAddedErrorRoute = server._router.stack.pop();
    (server._router.stack as unknown[]).splice(3, 0, newlyAddedErrorRoute);

    try {
      const resp = await request.get('/api/v1/error');
      expect(resp.status).toEqual(202);
      expect(resp.body).toEqual({});
    } finally {
      await shutdown();
    }
  });
});
