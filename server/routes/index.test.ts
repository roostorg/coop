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
    // mutate the server to add a dummy route that we can trigger. This must
    // start with /api/v1/ so that requests to it will fall through to our error
    // handler, which is only mounted in an app under /api/v1.
    const { server, request, shutdown } = await makeMockedServer();
    server.get('/api/v1/error', async (_req, res, next) => {
      res.sendStatus(202);
      next(new Error('error after send.'));
    });

    // Move the new route before the `/api/v1` sub-app mount, otherwise
    // requests to `/api/v1/error` fall through to the sub-app's 404 handler.
    type Layer = { name: string };
    const stack = server.router.stack as Layer[];
    const newlyAddedErrorRoute = stack.at(-1);
    if (newlyAddedErrorRoute === undefined) {
      throw new Error('expected route on stack');
    }
    const apiMountIdx = stack.findIndex((l) => l.name === 'mounted_app');
    if (apiMountIdx === -1) {
      throw new Error('expected /api/v1 sub-app mount on stack');
    }
    const withoutLast = stack.slice(0, -1);
    // eslint-disable-next-line functional/immutable-data -- express test-only router reordering
    server.router.stack = [
      ...withoutLast.slice(0, apiMountIdx),
      newlyAddedErrorRoute,
      ...withoutLast.slice(apiMountIdx),
    ] as typeof server.router.stack;

    try {
      const resp = await request.get('/api/v1/error');
      expect(resp.status).toEqual(202);
      expect(resp.body).toEqual({});
    } finally {
      await shutdown();
    }
  });
});
