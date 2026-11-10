import fc from 'fast-check';
import { Headers } from 'undici';
import { vi } from 'vitest';

import * as networking from '../../services/networkingService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import createContentItemTypes from '../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createSession from '../../test/fixtureHelpers/createSession.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { jsonStringify } from '../../utils/encoding.js';
import { kyselyUpdateRolePermissions } from '../datasources/rolePersistence.js';
import { resolvers } from './ncmec.js';

const Mutation = resolvers.Mutation as {
  updateNcmecOrgSettings: (
    parent: unknown,
    args: { input: Record<string, unknown> },
    ctx: unknown,
  ) => Promise<unknown>;
};

const VALID_INPUT = {
  username: 'cyber-user',
  password: 'cyber-pass',
  contactEmail: 'reporter@example.com',
};

function makeCtx(permissions: readonly UserPermission[]) {
  const updateNcmecOrgSettings = vi.fn(async () => undefined);
  const ctx = {
    getUser: () => ({
      id: 'user-1',
      orgId: 'org-1',
      getPermissions: () => permissions,
    }),
    services: { NcmecService: { updateNcmecOrgSettings } },
  };
  return { ctx, updateNcmecOrgSettings };
}

describe('updateNcmecOrgSettings media review policy', () => {
  it('defaults to ALL and drops any supplied threshold', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      { input: { ...VALID_INPUT, minMediaToReview: 5 } },
      ctx,
    );
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaReviewRequirement: 'ALL',
        minMediaToReview: null,
      }),
    );
  });

  it('persists the threshold when requirement is MINIMUM', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      {
        input: {
          ...VALID_INPUT,
          mediaReviewRequirement: 'MINIMUM',
          minMediaToReview: 3,
        },
      },
      ctx,
    );
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaReviewRequirement: 'MINIMUM',
        minMediaToReview: 3,
      }),
    );
  });

  it('defaults MINIMUM threshold to 1 when omitted', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      { input: { ...VALID_INPUT, mediaReviewRequirement: 'MINIMUM' } },
      ctx,
    );
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaReviewRequirement: 'MINIMUM',
        minMediaToReview: 1,
      }),
    );
  });

  it('rejects a non-positive MINIMUM threshold', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await expect(
      Mutation.updateNcmecOrgSettings(
        {},
        {
          input: {
            ...VALID_INPUT,
            mediaReviewRequirement: 'MINIMUM',
            minMediaToReview: 0,
          },
        },
        ctx,
      ),
    ).rejects.toThrow('minMediaToReview');
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });

  it('rejects a fractional MINIMUM threshold', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await expect(
      Mutation.updateNcmecOrgSettings(
        {},
        {
          input: {
            ...VALID_INPUT,
            mediaReviewRequirement: 'MINIMUM',
            minMediaToReview: 1.5,
          },
        },
        ctx,
      ),
    ).rejects.toThrow('minMediaToReview');
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });

  it('rejects an unknown requirement value', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await expect(
      Mutation.updateNcmecOrgSettings(
        {},
        { input: { ...VALID_INPUT, mediaReviewRequirement: 'SOME' } },
        ctx,
      ),
    ).rejects.toThrow('mediaReviewRequirement');
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });
});

describe('NCMEC read surfaces require VIEW_CHILD_SAFETY_DATA', () => {
  const unrelatedPermissions = Object.values(UserPermission).filter(
    (permission) => permission !== UserPermission.VIEW_CHILD_SAFETY_DATA,
  );
  beforeEach(() => {
    vi.spyOn(networking, 'fetchHTTP').mockRejectedValue(
      new Error('Unexpected external request'),
    );
  });
  afterEach(() => vi.mocked(networking.fetchHTTP).mockRestore());

  const testWithReports = makeTransactionalTestWithFixture(
    async ({ deps, server }) => {
      const local = await createOrg(deps);
      const foreign = await createOrg(deps);
      const { user } = await createUser(deps.KyselyPg, local.org.id, {
        approvedByAdmin: true,
        loginMethods: ['password'],
        password: 'Ncmec-test-password',
      });
      const createReport = async (tenant: typeof local, index: number) => {
        // Non-test reports by another reviewer are visible to authorized org members.
        const { user: reviewer } = await createUser(
          deps.KyselyPg,
          tenant.org.id,
        );
        const marker = `synthetic-protected-${index}`;
        const report = {
          reportId: `${marker}-report`,
          userId: `${marker}-user`,
          reportXml: `${marker}-xml`,
          reportedMedia: [
            { id: `${marker}-media`, xml: `${marker}-media-xml` },
          ],
          additionalFiles: [
            {
              xml: `${marker}-file-xml`,
              url: `https://example.invalid/${marker}`,
              ncmecFileId: `${marker}-file`,
            },
          ],
          reportedMessages: [
            {
              csv: `${marker}-csv`,
              ncmecFileId: `${marker}-messages`,
              fileName: `${marker}.csv`,
            },
          ],
        };
        await deps.KyselyPg.insertInto('ncmec_reporting.ncmec_reports')
          .values({
            org_id: tenant.org.id,
            report_id: report.reportId,
            user_id: report.userId,
            user_item_type_id: tenant.defaultUserItemType.id,
            reviewer_id: reviewer.id,
            report_xml: report.reportXml,
            reported_media: report.reportedMedia,
            additional_files: report.additionalFiles,
            reported_messages: report.reportedMessages,
            is_test: false,
          })
          .execute();
        return report;
      };
      const reports = [
        await createReport(local, 0),
        await createReport(foreign, 1),
      ];
      const {
        itemTypes: [messageType],
      } = await createContentItemTypes({
        moderationConfigService: deps.ModerationConfigService,
        orgId: local.org.id,
        extra: {},
      });
      vi.mocked(networking.fetchHTTP).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: {
          conversations: [
            {
              threadId: 'synthetic-protected-thread',
              typeId: 'thread-type',
              messages: [
                {
                  id: 'synthetic-protected-message',
                  typeId: messageType.id,
                  data: { field1: 'synthetic-protected-text' },
                  ipAddress: { ip: '192.0.2.47', port: 4321 },
                },
              ],
            },
          ],
        },
      });
      const session = await createSession(
        server,
        user.email,
        'Ncmec-test-password',
      );
      return { local, user, session, reports };
    },
  );
  const reportFields = `reportId userId reportXml reportedMedia { id xml }
    additionalFiles { xml url ncmecFileId } reportedMessages { csv ncmecFileId fileName }`;
  const threadFields = `threadId threadTypeId messages { message { id data } ipAddress { ip port } }`;

  for (const surface of [
    'ncmecReports',
    'ncmecReportById',
    'ncmecThreads',
  ] as const) {
    for (const fragments of [false, true]) {
      testWithReports(
        `${surface} protects the entire ${fragments ? 'aliased fragment' : 'plain'} response`,
        async ({ deps, local, user, request, session, reports }) => {
          const fields =
            surface === 'ncmecThreads' ? threadFields : reportFields;
          const selection = fragments ? '...ProtectedFields' : fields;
          const root =
            surface === 'ncmecReports'
              ? `myOrg { result: ncmecReports { ${selection} } }`
              : surface === 'ncmecReportById'
                ? `result: ncmecReportById(reportId: "${reports[0].reportId}") { ${selection} }`
                : `result: ncmecThreads(userId: { id: "reported-user", typeId: "${local.defaultUserItemType.id}" }, reportedMessages: []) { ${selection} }`;
          const query = `{ ${root} } ${fragments ? `fragment ProtectedFields on ${surface === 'ncmecThreads' ? 'ThreadWithMessagesAndIpAddress' : 'NCMECReport'} { ${fields} }` : ''}`;
          await fc.assert(
            fc.asyncProperty(
              fc.subarray(unrelatedPermissions),
              async (permissions) => {
                for (const actor of [request, session]) {
                  await kyselyUpdateRolePermissions(deps.KyselyPg, {
                    orgId: user.orgId,
                    roleKey: user.role,
                    permissions,
                  });
                  const denied = await actor
                    .post('/api/v1/graphql')
                    .send({ query })
                    .expect(200);
                  expect(denied.body.errors).toEqual([
                    expect.objectContaining({
                      extensions: expect.objectContaining({
                        code:
                          actor === request ? 'UNAUTHENTICATED' : 'FORBIDDEN',
                      }),
                    }),
                  ]);
                  expect(jsonStringify(denied.body)).not.toContain(
                    'synthetic-protected',
                  );
                  expect(jsonStringify(denied.body)).not.toContain(
                    '192.0.2.47',
                  );
                }
                await kyselyUpdateRolePermissions(deps.KyselyPg, {
                  orgId: user.orgId,
                  roleKey: user.role,
                  permissions: [
                    ...permissions,
                    UserPermission.VIEW_CHILD_SAFETY_DATA,
                  ],
                });
                const allowed = await session
                  .post('/api/v1/graphql')
                  .send({ query })
                  .expect(200);
                const expected =
                  surface === 'ncmecReports'
                    ? { myOrg: { result: [reports[0]] } }
                    : surface === 'ncmecReportById'
                      ? { result: reports[0] }
                      : {
                          result: [
                            {
                              threadId: 'synthetic-protected-thread',
                              threadTypeId: 'thread-type',
                              messages: [
                                {
                                  message: {
                                    id: 'synthetic-protected-message',
                                    data: {
                                      field1: 'synthetic-protected-text',
                                    },
                                  },
                                  ipAddress: { ip: '192.0.2.47', port: 4321 },
                                },
                              ],
                            },
                          ],
                        };
                expect(allowed.body).toEqual({ data: expected });
                expect(jsonStringify(allowed.body)).not.toContain(
                  'synthetic-protected-1',
                );
                if (surface === 'ncmecReportById') {
                  const other = await session.post('/api/v1/graphql').send({
                    query: query.replace(
                      reports[0].reportId,
                      reports[1].reportId,
                    ),
                  });
                  expect(other.body).toEqual({ data: { result: null } });
                }
              },
            ),
            { numRuns: 10, examples: [[[]], [unrelatedPermissions]] },
          );
        },
      );
    }
  }
});
