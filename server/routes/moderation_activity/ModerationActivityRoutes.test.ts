import { vi } from 'vitest';

import { type ActivityRow } from '../../services/moderationActivityFeed/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { jsonStringify } from '../../utils/encoding.js';

const PASSWORD = 'Export-route-test-password-123!';
const EXPORT_PATH = '/api/v1/moderation_activity/export';

const decision = (id: string, reviewerId: string): ActivityRow => ({
  kind: 'DECISION',
  id,
  ts: new Date('2026-08-05T14:00:00Z'),
  payload: {
    id,
    jobId: `job-${id}`,
    queueId: null,
    reviewerId,
    decisions: [{ type: 'IGNORE' }],
    decisionReason: null,
    assignedAt: null,
    jobCreatedAt: null,
  },
});

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

const rawExportUrl = (input: unknown) =>
  `${EXPORT_PATH}?${new URLSearchParams({ input: jsonStringify(input) })}`;

const exportUrl = (input: Record<string, unknown>) =>
  rawExportUrl({ startTime: daysAgo(30), ...input });

describe('GET /moderation_activity/export', () => {
  const testExport = makeTransactionalTestWithFixture(
    async ({ deps, request }) => {
      const { org } = await createOrg(deps);
      const { user: admin } = await createUser(deps.KyselyPg, org.id, {
        approvedByAdmin: true,
        loginMethods: ['password'],
        password: PASSWORD,
      });
      const stubFeed = (pages: ActivityRow[][] = [], failAfter = false) =>
        vi
          .spyOn(deps.ModerationActivityFeed, 'iterateAll')
          .mockImplementation(async function* () {
            yield* pages;
            if (failAfter) {
              throw new Error('clickhouse down');
            }
          });
      const login = async () =>
        request
          .post('/api/v1/graphql')
          .send({
            query: `mutation Login($input: LoginInput!) {
              login(input: $input) { __typename }
            }`,
            variables: { input: { email: admin.email, password: PASSWORD } },
          })
          .expect(200);
      return { org, admin, stubFeed, login };
    },
  );

  testExport('returns 401 without a session', async ({ request }) => {
    await request.get(exportUrl({})).expect(401);
  });

  testExport(
    'streams every page as a CSV download with reviewer names',
    async ({ request, deps, org, admin, stubFeed, login }) => {
      const { user: unapproved } = await createUser(deps.KyselyPg, org.id, {
        approvedByAdmin: false,
      });
      stubFeed([
        [decision('d-1', admin.id), decision('d-2', '')],
        [decision('d-3', unapproved.id)],
      ]);
      await login();

      const res = await request
        .get(exportUrl({ view: 'DECISIONS' }))
        .expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="decisions.csv"',
      );
      const lines = res.text.trimEnd().split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[1]).toContain(`"${admin.firstName} ${admin.lastName}"`);
      expect(lines[2]).toContain('"Automatic"');
      expect(lines[3]).toContain(
        `"${unapproved.firstName} ${unapproved.lastName}"`,
      );
    },
  );

  testExport(
    'passes the session user and filters over a full 400-day range',
    async ({ request, org, admin, stubFeed, login }) => {
      const iterateAll = stubFeed();
      await login();

      await request
        .get(
          exportUrl({
            view: 'ALL',
            reviewerIds: ['u-1'],
            startTime: '2025-01-01T00:00:00.000Z',
            endTime: '2026-02-05T00:00:00.000Z',
            decisions: [
              { type: 'IGNORE' },
              { type: 'CUSTOM_ACTION', actionIds: ['act-1'] },
            ],
          }),
        )
        .expect(200);

      const args = iterateAll.mock.calls[0][0];
      expect(args.orgId).toBe(org.id);
      expect(args.view).toBe('ALL');
      expect(args.userPermissions).toEqual(admin.getPermissions());
      expect(args.input.reviewerIds).toEqual(['u-1']);
      expect(args.input.startTime).toEqual(new Date('2025-01-01T00:00:00Z'));
      expect(args.input.decisions).toEqual([
        { type: 'IGNORE', actionIds: undefined },
        { type: 'CUSTOM_ACTION', actionIds: ['act-1'] },
      ]);
    },
  );

  testExport('rejects invalid input with 400', async ({ request, login }) => {
    await login();
    const badInputs = [
      {},
      { startTime: '2025-01-01T00:00:00Z', endTime: '2026-02-06T00:00:00Z' },
      { startTime: daysAgo(401) },
      { startTime: '2026-02-01T00:00:00Z', endTime: '2026-01-01T00:00:00Z' },
      { startTime: 'yesterday-ish' },
      { startTime: daysAgo(30), reviewerIds: 5 },
      { startTime: daysAgo(30), decisions: [{ ignoreDecision: { _: true } }] },
    ];
    for (const input of badInputs) {
      await request.get(rawExportUrl(input)).expect(400);
    }
    await request.get(`${EXPORT_PATH}?input=%7Bnot-json`).expect(400);
  });

  testExport(
    'refuses requests started by another site',
    async ({ request, stubFeed, login }) => {
      const iterateAll = stubFeed();
      await login();

      for (const site of ['cross-site', 'same-site']) {
        await request
          .get(exportUrl({}))
          .set('Sec-Fetch-Site', site)
          .expect(403);
      }
      await request
        .get(exportUrl({}))
        .set('Sec-Fetch-Site', 'same-origin')
        .expect(200);
      expect(iterateAll).toHaveBeenCalledTimes(1);
    },
  );

  testExport(
    'cuts the download off and logs if the feed fails mid-stream',
    async ({ request, deps, admin, stubFeed, login }) => {
      stubFeed([[decision('d-1', admin.id)]], true);
      await login();
      const addActiveSpan = vi.spyOn(deps.Tracer, 'addActiveSpan');

      await expect(
        request.get(exportUrl({ view: 'DECISIONS' })).buffer(true),
      ).rejects.toThrow();
      await vi.waitFor(() => {
        expect(addActiveSpan).toHaveBeenCalledWith(
          { resource: 'app', operation: 'handleError' },
          expect.any(Function),
        );
      });
    },
  );
});
