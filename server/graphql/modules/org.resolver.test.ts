import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { vi } from 'vitest';

import { type Action } from '../../services/moderationConfigService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { jsonStringify } from '../../utils/encoding.js';
import { kyselyUpdateRolePermissions } from '../datasources/rolePersistence.js';
import { kyselyUserFindById } from '../datasources/userKyselyPersistence.js';
import allResolvers from '../resolvers.js';
import typeDefs from '../schema.js';
import { makeGqlServices } from '../services.js';
import { authSchemaWrapper } from '../utils/authorization.js';
import { formatGraphQLError } from '../utils/formatError.js';
import { resolveOrgActions, resolvers } from './org.js';

function makeAction(
  id: string,
  actionType: Action['actionType'],
  orgId: string,
): Action {
  const base = {
    id,
    orgId,
    name: id,
    description: null,
    penalty: 'NONE' as const,
    applyUserStrikes: false,
  };
  if (actionType === 'CUSTOM_ACTION') {
    return {
      ...base,
      actionType,
      callbackUrl: 'https://example.com',
      callbackUrlBody: null,
      callbackUrlHeaders: null,
      customMrtApiParams: null,
    };
  }
  return { ...base, actionType };
}

describe('Org resolvers', () => {
  describe('resolveOrgActions', () => {
    function makeContext(opts: {
      orgId: string;
      callerOrgId?: string;
      actionTypes: Array<{ id: string; actionType: Action['actionType'] }>;
      hasNCMECReportingEnabled: boolean;
    }) {
      const actions = opts.actionTypes.map((a) =>
        makeAction(a.id, a.actionType, opts.orgId),
      );
      const getActions = vi.fn(async () => actions);
      const hasNCMECReportingEnabled = vi.fn(
        async () => opts.hasNCMECReportingEnabled,
      );
      const ctx = {
        getUser: () => ({ orgId: opts.callerOrgId ?? opts.orgId }),
        services: {
          ModerationConfigService: { getActions },
          NcmecService: { hasNCMECReportingEnabled },
        },
      };
      return { ctx, getActions, hasNCMECReportingEnabled };
    }

    it('hides ENQUEUE_TO_NCMEC built-in when NCMEC reporting is disabled', async () => {
      const { ctx } = makeContext({
        orgId: 'org-1',
        actionTypes: [
          { id: 'a-custom', actionType: 'CUSTOM_ACTION' },
          { id: 'a-mrt', actionType: 'ENQUEUE_TO_MRT' },
          { id: 'a-author', actionType: 'ENQUEUE_AUTHOR_TO_MRT' },
          { id: 'a-ncmec', actionType: 'ENQUEUE_TO_NCMEC' },
        ],
        hasNCMECReportingEnabled: false,
      });

      const result = await resolveOrgActions({ id: 'org-1' }, {}, ctx);
      expect(result.map((it) => it.id).sort()).toEqual([
        'a-author',
        'a-custom',
        'a-mrt',
      ]);
    });

    it('returns ENQUEUE_TO_NCMEC built-in when NCMEC reporting is enabled', async () => {
      const { ctx } = makeContext({
        orgId: 'org-1',
        actionTypes: [
          { id: 'a-mrt', actionType: 'ENQUEUE_TO_MRT' },
          { id: 'a-ncmec', actionType: 'ENQUEUE_TO_NCMEC' },
        ],
        hasNCMECReportingEnabled: true,
      });

      const result = await resolveOrgActions({ id: 'org-1' }, {}, ctx);
      expect(result.map((it) => it.id).sort()).toEqual(['a-mrt', 'a-ncmec']);
    });

    it('rejects when caller org does not match the requested org (IDOR guard)', async () => {
      const { ctx, getActions, hasNCMECReportingEnabled } = makeContext({
        orgId: 'org-1',
        callerOrgId: 'other-org',
        actionTypes: [],
        hasNCMECReportingEnabled: false,
      });

      await expect(resolveOrgActions({ id: 'org-1' }, {}, ctx)).rejects.toThrow(
        'User required.',
      );
      expect(getActions).not.toHaveBeenCalled();
      expect(hasNCMECReportingEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Org sensitive GraphQL fields', () => {
    // Supply arbitrary parents without weakening any production object resolver.
    const schema = mapSchema(
      makeExecutableSchema({
        typeDefs: [typeDefs, 'extend type Query { testOrg(id: ID!): Org }'],
        resolvers: [
          allResolvers,
          {
            Query: {
              testOrg: (_: unknown, { id }: { id: string }) => ({ id }),
            },
          },
        ],
      }),
      {
        [MapperKind.QUERY_ROOT_FIELD]: (field, _, _type, schema) =>
          authSchemaWrapper(field, schema),
      },
    );
    const apollo = new ApolloServer({
      schema,
      formatError: formatGraphQLError,
    });
    beforeAll(async () => apollo.start());
    afterAll(async () => apollo.stop());

    const testWithSecrets = makeTransactionalTestWithFixture(
      async ({ deps }) => {
        const local = await createOrg(deps);
        const foreign = await createOrg(deps);
        const { user } = await createUser(deps.KyselyPg, local.org.id);
        for (const tenant of [local, foreign]) {
          await deps.SigningKeyPairService.createAndStoreSigningKeys(
            tenant.org.id,
          );
          await deps.DataSources.integrationAPI.setConfigByIntegrationId(
            'OPEN_AI',
            { apiKey: `synthetic-integration-${tenant.org.id}` },
            tenant.org.id,
          );
          await deps.KyselyPg.insertInto('ncmec_reporting.ncmec_reports')
            .values({
              org_id: tenant.org.id,
              report_id: `report-${tenant.org.id}`,
              user_id: 'reported-user',
              user_item_type_id: tenant.defaultUserItemType.id,
              report_xml: `synthetic-report-${tenant.org.id}`,
              reported_media: [
                { id: 'synthetic-media', xml: 'synthetic-media-xml' },
              ],
              is_test: false,
            })
            .execute();
        }
        const execute = async (
          selection: string,
          orgId: string,
          authenticated = true,
        ) => {
          const caller = authenticated
            ? await kyselyUserFindById(deps.KyselyPg, user.id)
            : null;
          const response = await apollo.executeOperation(
            {
              query: `query($orgId: ID!) { testOrg(id: $orgId) { ${selection} } }`,
              variables: { orgId },
            },
            {
              contextValue: {
                getUser: () => caller,
                services: makeGqlServices(deps),
                dataSources: deps.DataSources,
              },
            },
          );
          if (response.body.kind !== 'single')
            throw new Error('Expected single GraphQL response');
          return response.body.singleResult;
        };
        return { local, foreign, user, execute };
      },
    );
    for (const [field, selection, permission] of [
      ['apiKey', 'apiKey', UserPermission.MANAGE_ORG],
      ['publicSigningKey', 'publicSigningKey', UserPermission.MANAGE_ORG],
      [
        'integrationConfigs',
        'integrationConfigs { name apiCredential { ... on OpenAiIntegrationApiCredential { apiKey } } }',
        UserPermission.MANAGE_ORG,
      ],
      [
        'ncmecReports',
        'ncmecReports { reportXml }',
        UserPermission.VIEW_CHILD_SAFETY_DATA,
      ],
    ] as const) {
      testWithSecrets(
        `${field} requires both the capability and matching parent ownership`,
        async ({ deps, local, foreign, user, execute }) => {
          await kyselyUpdateRolePermissions(deps.KyselyPg, {
            orgId: user.orgId,
            roleKey: user.role,
            permissions: [permission],
          });
          const own = await execute(selection, local.org.id);
          expect(own.errors).toBeUndefined();
          if (field === 'apiKey') {
            const key = await deps.KyselyPg.selectFrom('public.api_keys')
              .select('key_hash')
              .where('org_id', '=', local.org.id)
              .executeTakeFirstOrThrow();
            expect(own.data).toEqual({ testOrg: { apiKey: key.key_hash } });
          } else if (field === 'publicSigningKey') {
            expect(own.data).toEqual({
              testOrg: {
                publicSigningKey: expect.stringContaining('BEGIN PUBLIC KEY'),
              },
            });
          } else {
            expect(jsonStringify(own)).toContain(
              field === 'ncmecReports'
                ? `synthetic-report-${local.org.id}`
                : `synthetic-integration-${local.org.id}`,
            );
          }
          expect(jsonStringify(own)).not.toContain(foreign.org.id);
          const foreignResponse = await execute(selection, foreign.org.id);
          const anonymous = await execute(selection, local.org.id, false);
          await kyselyUpdateRolePermissions(deps.KyselyPg, {
            orgId: user.orgId,
            roleKey: user.role,
            permissions: Object.values(UserPermission).filter(
              (value) => value !== permission,
            ),
          });
          const forbidden = await execute(selection, local.org.id);
          for (const [response, code] of [
            [foreignResponse, 'UNAUTHENTICATED'],
            [anonymous, 'UNAUTHENTICATED'],
            [forbidden, 'FORBIDDEN'],
          ] as const) {
            expect(response.data).toEqual({ testOrg: null });
            expect(response.errors).toEqual([
              expect.objectContaining({
                extensions: expect.objectContaining({ code }),
              }),
            ]);
            expect(jsonStringify(response)).not.toContain('synthetic-');
            expect(jsonStringify(response)).not.toContain('BEGIN PUBLIC KEY');
            expect(jsonStringify(response)).not.toContain(local.apiKey);
            expect(jsonStringify(response)).not.toContain(foreign.apiKey);
          }
        },
      );
    }
  });

  describe('Org.usersWhoCanReviewEveryQueue is not readable cross-tenant (PII leak guard)', () => {
    function makeCtx(opts: { orgId: string; callerOrgId?: string | null }) {
      const getOrgUsersForGraphQL = vi.fn(async () => []);
      const ctx = {
        getUser: () =>
          opts.callerOrgId === null
            ? null
            : { id: 'user-1', orgId: opts.callerOrgId ?? opts.orgId },
        dataSources: {
          orgAPI: { getOrgUsersForGraphQL },
        },
      };
      return { ctx, getOrgUsersForGraphQL };
    }

    const orgParent = { id: 'org-1' };
    const Org = resolvers.Org as Record<
      'usersWhoCanReviewEveryQueue',
      (
        parent: typeof orgParent,
        args: unknown,
        ctx: unknown,
      ) => Promise<unknown>
    >;

    it('throws when the caller belongs to a different org (IDOR guard)', async () => {
      const { ctx, getOrgUsersForGraphQL } = makeCtx({
        orgId: 'org-1',
        callerOrgId: 'other-org',
      });
      await expect(
        Org.usersWhoCanReviewEveryQueue(orgParent, {}, ctx),
      ).rejects.toThrow('User required.');
      expect(getOrgUsersForGraphQL).not.toHaveBeenCalled();
    });

    it('throws when there is no authenticated user', async () => {
      const { ctx, getOrgUsersForGraphQL } = makeCtx({
        orgId: 'org-1',
        callerOrgId: null,
      });
      await expect(
        Org.usersWhoCanReviewEveryQueue(orgParent, {}, ctx),
      ).rejects.toThrow('User required.');
      expect(getOrgUsersForGraphQL).not.toHaveBeenCalled();
    });
  });

  describe('Org.mrtQueues is membership-scoped', () => {
    function makeCtx(opts: { callerOrgId?: string | null }) {
      const getReviewableQueuesForUser = vi.fn(async () => [
        { id: 'q-1', orgId: 'org-1', name: 'q-1' },
      ]);
      const getAllQueuesForOrgAndDangerouslyBypassPermissioning = vi.fn(
        async () => {
          throw new Error('resolver must not bypass permissioning');
        },
      );
      const ctx = {
        getUser: () =>
          opts.callerOrgId === null
            ? null
            : {
                id: 'user-1',
                orgId: opts.callerOrgId ?? 'org-1',
                getPermissions: () => [UserPermission.VIEW_MRT],
              },
        services: {
          ManualReviewToolService: {
            getReviewableQueuesForUser,
            getAllQueuesForOrgAndDangerouslyBypassPermissioning,
          },
        },
      };
      return {
        ctx,
        getReviewableQueuesForUser,
        getAllQueuesForOrgAndDangerouslyBypassPermissioning,
      };
    }

    const orgParent = { id: 'org-1' };
    const Org = resolvers.Org as Record<
      'mrtQueues',
      (
        parent: typeof orgParent,
        args: unknown,
        ctx: unknown,
      ) => Promise<unknown>
    >;

    it('delegates to getReviewableQueuesForUser, not the bypass helper', async () => {
      const {
        ctx,
        getReviewableQueuesForUser,
        getAllQueuesForOrgAndDangerouslyBypassPermissioning,
      } = makeCtx({});
      await expect(Org.mrtQueues(orgParent, {}, ctx)).resolves.toEqual([
        { id: 'q-1', orgId: 'org-1', name: 'q-1' },
      ]);
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
      });
      expect(
        getAllQueuesForOrgAndDangerouslyBypassPermissioning,
      ).not.toHaveBeenCalled();
    });

    it('throws the IDOR guard when the caller is in a different org', async () => {
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        callerOrgId: 'other-org',
      });
      await expect(Org.mrtQueues(orgParent, {}, ctx)).rejects.toThrow(
        'User required',
      );
      expect(getReviewableQueuesForUser).not.toHaveBeenCalled();
    });

    it('throws when there is no authenticated user', async () => {
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        callerOrgId: null,
      });
      await expect(Org.mrtQueues(orgParent, {}, ctx)).rejects.toThrow(
        'User required',
      );
      expect(getReviewableQueuesForUser).not.toHaveBeenCalled();
    });
  });
});
