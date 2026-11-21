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
    // Add a dummy route to the Express instance under the Nest app and move it
    // to the front of the stack, so it runs before Nest's routes and its
    // `next(err)` reaches the error handler Nest registers last.
    const { server, request, shutdown } = await makeMockedServer();
    server.get('/api/v1/error', async (_req, res, next) => {
      res.sendStatus(202);
      next(new Error('error after send.'));
    });
    type Layer = { name: string };
    const stack = server.router.stack as Layer[];
    const newlyAddedErrorRoute = stack.at(-1);
    if (newlyAddedErrorRoute === undefined) {
      throw new Error('expected route on stack');
    }
    // eslint-disable-next-line functional/immutable-data -- express test-only router reordering
    server.router.stack = [
      newlyAddedErrorRoute,
      ...stack.slice(0, -1),
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
