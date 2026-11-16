import fc from 'fast-check';
import { vi } from 'vitest';

import * as networking from '../../services/networkingService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
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
      const createReport = async (tenant: typeof local, label: string) => {
        // Non-test reports by another reviewer are visible to authorized org members.
        const { user: reviewer } = await createUser(
          deps.KyselyPg,
          tenant.org.id,
        );
        const marker = `synthetic-protected-${label}`;
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
      const localReport = await createReport(local, 'local');
      const foreignReport = await createReport(foreign, 'foreign');
      const session = await createSession(
        server,
        user.email,
        'Ncmec-test-password',
      );
      const variables = {
        reportId: localReport.reportId,
        userId: {
          id: localReport.userId,
          typeId: local.defaultUserItemType.id,
        },
      };
      return { user, session, localReport, foreignReport, variables };
    },
  );
  const reportsQuery = /* GraphQL */ `
    query {
      myOrg {
        reports: ncmecReports {
          ...ReportFields
        }
      }
    }
    fragment ReportFields on NCMECReport {
      reportId
      userId
      reportXml
      reportedMedia {
        id
        xml
      }
      additionalFiles {
        xml
        url
        ncmecFileId
      }
      reportedMessages {
        csv
        ncmecFileId
        fileName
      }
    }
  `;
  const reportByIdQuery = /* GraphQL */ `
    query ($reportId: ID!) {
      report: ncmecReportById(reportId: $reportId) {
        ...ReportFields
      }
    }
    fragment ReportFields on NCMECReport {
      reportId
      userId
      reportXml
      reportedMedia {
        id
        xml
      }
      additionalFiles {
        xml
        url
        ncmecFileId
      }
      reportedMessages {
        csv
        ncmecFileId
        fileName
      }
    }
  `;
  const threadsQuery = /* GraphQL */ `
    query ($userId: ItemIdentifierInput!) {
      threads: ncmecThreads(userId: $userId, reportedMessages: []) {
        ...ThreadFields
      }
    }
    fragment ThreadFields on ThreadWithMessagesAndIpAddress {
      threadId
      threadTypeId
      messages {
        message {
          id
          data
        }
        ipAddress {
          ip
          port
        }
      }
    }
  `;

  for (const [surface, query] of [
    ['ncmecReports', reportsQuery],
    ['ncmecReportById', reportByIdQuery],
    ['ncmecThreads', threadsQuery],
  ]) {
    describe(surface, () => {
      testWithReports(
        'rejects unauthenticated reads without disclosing protected fields',
        async ({ request, variables }) => {
          const response = await request
            .post('/api/v1/graphql')
            .send({ query, variables })
            .expect(200);

          expect(response.body.errors).toEqual([
            expect.objectContaining({
              extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
            }),
          ]);
          expect(jsonStringify(response.body)).not.toContain(
            'synthetic-protected',
          );
        },
      );

      testWithReports(
        'requires VIEW_CHILD_SAFETY_DATA regardless of other permissions',
        async ({ deps, user, session, variables }) => {
          await fc.assert(
            fc.asyncProperty(
              fc.subarray(unrelatedPermissions),
              async (permissions) => {
                await kyselyUpdateRolePermissions(deps.KyselyPg, {
                  orgId: user.orgId,
                  roleKey: user.role,
                  permissions,
                });

                const response = await session
                  .post('/api/v1/graphql')
                  .send({ query, variables })
                  .expect(200);

                expect(response.body.errors).toEqual([
                  expect.objectContaining({
                    extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
                  }),
                ]);
                expect(jsonStringify(response.body)).not.toContain(
                  'synthetic-protected',
                );
              },
            ),
            { numRuns: 10, examples: [[[]], [unrelatedPermissions]] },
          );
        },
      );
    });
  }

  testWithReports(
    'VIEW_CHILD_SAFETY_DATA lists only reports from the caller organization',
    async ({ deps, user, session, localReport }) => {
      await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: user.orgId,
        roleKey: user.role,
        permissions: [UserPermission.VIEW_CHILD_SAFETY_DATA],
      });

      const response = await session
        .post('/api/v1/graphql')
        .send({ query: reportsQuery })
        .expect(200);

      expect(response.body).toEqual({
        data: { myOrg: { reports: [localReport] } },
      });
    },
  );

  testWithReports(
    'VIEW_CHILD_SAFETY_DATA reads a report from the caller organization',
    async ({ deps, user, session, localReport }) => {
      await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: user.orgId,
        roleKey: user.role,
        permissions: [UserPermission.VIEW_CHILD_SAFETY_DATA],
      });

      const response = await session
        .post('/api/v1/graphql')
        .send({
          query: reportByIdQuery,
          variables: { reportId: localReport.reportId },
        })
        .expect(200);

      expect(response.body).toEqual({ data: { report: localReport } });
    },
  );

  testWithReports(
    'VIEW_CHILD_SAFETY_DATA cannot read a report from another organization',
    async ({ deps, user, session, foreignReport }) => {
      await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: user.orgId,
        roleKey: user.role,
        permissions: [UserPermission.VIEW_CHILD_SAFETY_DATA],
      });

      const response = await session
        .post('/api/v1/graphql')
        .send({
          query: reportByIdQuery,
          variables: { reportId: foreignReport.reportId },
        })
        .expect(200);

      expect(response.body).toEqual({ data: { report: null } });
    },
  );

  testWithReports(
    'returns no conversations for an authorized caller without making external requests',
    async ({ deps, user, session, variables }) => {
      await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: user.orgId,
        roleKey: user.role,
        permissions: [UserPermission.VIEW_CHILD_SAFETY_DATA],
      });

      const response = await session
        .post('/api/v1/graphql')
        .send({
          query: threadsQuery,
          variables: { userId: variables.userId },
        })
        .expect(200);

      expect(response.body).toEqual({ data: { threads: [] } });
      expect(networking.fetchHTTP).not.toHaveBeenCalled();
    },
  );
});
