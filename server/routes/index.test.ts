import fc from 'fast-check';
import { vi } from 'vitest';

import createOrg from '../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../test/harness/transactionalTest.js';
import { makeMockedServer } from '../test/setupMockedServer.js';

describe.each(['policies', 'actions', 'item_types'])(
  'GET %s API-key authentication',
  (resource) => {
    const testWithKeys = makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org, apiKey: revokedKey } = await createOrg(deps);
      const { apiKey } = await deps.ApiKeyService.rotateApiKey(
        org.id,
        'active',
        null,
        null,
      );
      return { apiKey, revokedKey };
    });

    testWithKeys(
      'accepts only an active key in the x-api-key header',
      async ({ request, deps, apiKey, revokedKey }) => {
        const reads = [
          vi.spyOn(deps.ModerationConfigService, 'getPolicies'),
          vi.spyOn(deps.ModerationConfigService, 'getActions'),
          vi.spyOn(deps.ModerationConfigService, 'getActionItemTypeIds'),
          vi.spyOn(deps.ModerationConfigService, 'getItemTypes'),
        ];
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 0, max: apiKey.length - 1 }),
            async (index) => {
              const tamperedKey =
                apiKey.slice(0, index) +
                (apiKey[index] === 'a' ? 'b' : 'a') +
                apiKey.slice(index + 1);
              for (const key of [
                undefined,
                '',
                'invalid-key',
                tamperedKey,
                revokedKey,
              ]) {
                reads.forEach((read) => read.mockClear());
                const attempt = request
                  .get(`/api/v1/${resource}/`)
                  .query({ apiKey, orgId: 'untrusted-org' })
                  .set('Authorization', `Bearer ${apiKey}`);
                if (key !== undefined) attempt.set('x-api-key', key);
                const response = await attempt.expect(401);
                expect(response.body).toEqual({
                  errors: [
                    expect.objectContaining({
                      status: 401,
                      title: 'Invalid API Key',
                    }),
                  ],
                });
                for (const read of reads) expect(read).not.toHaveBeenCalled();
              }
              await request
                .get(`/api/v1/${resource}/`)
                .set('x-api-key', apiKey)
                .expect(200);
            },
          ),
          { numRuns: 20, examples: [[0], [apiKey.length - 1]] },
        );
      },
    );
  },
);

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
