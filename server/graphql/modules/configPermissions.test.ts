import { uid } from 'uid';

import { RuleStatus } from '../../services/moderationConfigService/index.js';
import { UserRole } from '../../services/userManagementService/index.js';
import createContentItemTypes from '../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type MockedServer } from '../../test/setupMockedServer.js';

const password = 'Config-permissions-test-password-123!';

async function loginAs(
  { deps, request }: Pick<MockedServer, 'deps' | 'request'>,
  orgId: string,
  role: UserRole,
) {
  const { user } = await createUser(deps.KyselyPg, orgId, {
    role,
    approvedByAdmin: true,
    loginMethods: ['password'],
    password,
  });
  const login = await request.post('/api/v1/graphql').send({
    query: `mutation Login($input: LoginInput!) {
      login(input: $input) { __typename }
    }`,
    variables: { input: { email: user.email, password } },
  });
  expect(login.body.data?.login.__typename).toBe('LoginSuccessResponse');
}

const conditionSet = {
  conjunction: 'AND' as const,
  conditions: [
    {
      input: { type: 'FULL_ITEM' as const },
      comparator: 'IS_NOT_PROVIDED' as const,
    },
  ],
};

describe('configuration permissions through the GraphQL API', () => {
  const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(deps);
    const { user: admin } = await createUser(deps.KyselyPg, org.id);
    const { itemTypes } = await createContentItemTypes({
      moderationConfigService: deps.ModerationConfigService,
      orgId: org.id,
      extra: {},
    });
    const action = await deps.ActionAPIDataSource.createAction(
      {
        name: `action-${uid()}`,
        itemTypeIds: [itemTypes[0].id],
        callbackUrl: 'https://hooks.example.test/action',
        callbackUrlHeaders: { Authorization: 'Bearer test-secret' },
        callbackUrlBody: { token: 'test-secret' },
      },
      org.id,
    );
    return { org, admin, itemType: itemTypes[0], action };
  });

  const readActionSecrets = `query Action($id: ID!) {
    action(id: $id) {
      ... on CustomAction { callbackUrlHeaders callbackUrlBody }
    }
  }`;

  testWithOrg(
    'hides action webhook headers and body from roles without Manage Org',
    async ({ deps, request, org, action }) => {
      for (const role of [
        UserRole.EXTERNAL_MODERATOR,
        UserRole.MODERATOR,
        UserRole.ANALYST,
        UserRole.RULES_MANAGER,
      ]) {
        await loginAs({ deps, request }, org.id, role);
        const response = await request
          .post('/api/v1/graphql')
          .send({ query: readActionSecrets, variables: { id: action.id } });
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.action).toEqual({
          callbackUrlHeaders: null,
          callbackUrlBody: null,
        });
      }

      await loginAs({ deps, request }, org.id, UserRole.ADMIN);
      const response = await request
        .post('/api/v1/graphql')
        .send({ query: readActionSecrets, variables: { id: action.id } });
      expect(response.body.data.action).toEqual({
        callbackUrlHeaders: { Authorization: 'Bearer test-secret' },
        callbackUrlBody: { token: 'test-secret' },
      });
    },
  );

  testWithOrg(
    'rejects action changes from an External Moderator',
    async ({ deps, request, org, action }) => {
      await loginAs({ deps, request }, org.id, UserRole.EXTERNAL_MODERATOR);
      const response = await request.post('/api/v1/graphql').send({
        query: `mutation UpdateAction($input: UpdateActionInput!) {
          updateAction(input: $input) { __typename }
        }`,
        variables: {
          input: { id: action.id, callbackUrl: 'https://other.example.test' },
        },
      });
      expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

      const stored = await deps.KyselyPg.selectFrom('public.actions')
        .select('callback_url')
        .where('id', '=', action.id)
        .executeTakeFirstOrThrow();
      expect(stored.callback_url).toBe('https://hooks.example.test/action');
    },
  );

  testWithOrg(
    "lets a Rules Manager edit an action but not its callback or a bank's exchange credentials",
    async ({ deps, request, org, action }) => {
      const updateAction = `mutation UpdateAction($input: UpdateActionInput!) {
        updateAction(input: $input) { __typename }
      }`;
      await loginAs({ deps, request }, org.id, UserRole.RULES_MANAGER);

      const rename = await request.post('/api/v1/graphql').send({
        query: updateAction,
        variables: { input: { id: action.id, name: `renamed-${uid()}` } },
      });
      expect(rename.body.errors).toBeUndefined();
      expect(rename.body.data.updateAction.__typename).toBe(
        'MutateActionSuccessResponse',
      );

      for (const change of [
        { callbackUrl: 'https://attacker.example.test/hook' },
        { callbackUrlHeaders: null },
        { callbackUrlBody: { token: 'other' } },
      ]) {
        const response = await request.post('/api/v1/graphql').send({
          query: updateAction,
          variables: { input: { id: action.id, ...change } },
        });
        expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
      }
      const stored = await deps.KyselyPg.selectFrom('public.actions')
        .select(['callback_url', 'callback_url_headers', 'callback_url_body'])
        .where('id', '=', action.id)
        .executeTakeFirstOrThrow();
      expect(stored).toEqual({
        callback_url: 'https://hooks.example.test/action',
        callback_url_headers: { Authorization: 'Bearer test-secret' },
        callback_url_body: { token: 'test-secret' },
      });

      const credentials = await request.post('/api/v1/graphql').send({
        query: `mutation SetCredentials($bankId: ID!, $credentialsJson: String!) {
          updateHashBankExchangeCredentials(
            bankId: $bankId
            credentialsJson: $credentialsJson
          ) { __typename }
        }`,
        variables: { bankId: '1', credentialsJson: '{"token":"t"}' },
      });
      expect(credentials.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    },
  );

  const renameRule = `mutation Rename($input: UpdateContentRuleInput!) {
    updateContentRule(input: $input) { __typename }
  }`;

  testWithOrg(
    'lets an Analyst edit draft rules but not live or expired live ones',
    async ({ deps, request, org, admin, itemType }) => {
      const draft = await createRule(deps.KyselyPg, org.id, {
        creator: admin,
        status: RuleStatus.DRAFT,
        contentTypeIds: [itemType.id],
      });
      const live = await createRule(deps.KyselyPg, org.id, {
        creator: admin,
        status: RuleStatus.LIVE,
        contentTypeIds: [itemType.id],
      });
      const expiredLive = await createRule(deps.KyselyPg, org.id, {
        creator: admin,
        status: RuleStatus.LIVE,
        contentTypeIds: [itemType.id],
      });
      await deps.KyselyPg.updateTable('public.rules')
        .set({ expiration_time: new Date(Date.now() - 24 * 60 * 60 * 1000) })
        .where('id', '=', expiredLive.id)
        .execute();

      await loginAs({ deps, request }, org.id, UserRole.ANALYST);

      const expiredStatus = await request.post('/api/v1/graphql').send({
        query: `query Rule($id: ID!) { rule(id: $id) { status statusIfUnexpired } }`,
        variables: { id: expiredLive.id },
      });
      expect(expiredStatus.body.data.rule).toEqual({
        status: 'EXPIRED',
        statusIfUnexpired: 'LIVE',
      });

      const draftResponse = await request.post('/api/v1/graphql').send({
        query: renameRule,
        variables: { input: { id: draft.id, name: `renamed-${uid()}` } },
      });
      expect(draftResponse.body.errors).toBeUndefined();
      expect(draftResponse.body.data.updateContentRule.__typename).toBe(
        'MutateContentRuleSuccessResponse',
      );

      for (const rule of [live, expiredLive]) {
        const response = await request.post('/api/v1/graphql').send({
          query: renameRule,
          variables: { input: { id: rule.id, name: `renamed-${uid()}` } },
        });
        expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
        const stored = await deps.KyselyPg.selectFrom('public.rules')
          .select('name')
          .where('id', '=', rule.id)
          .executeTakeFirstOrThrow();
        expect(stored.name).toBe(rule.name);
      }
    },
  );

  testWithOrg(
    'lets a Rules Manager create, edit and delete text banks but not an Analyst',
    async ({ deps, request, org }) => {
      const bank = await deps.ModerationConfigService.createTextBank(org.id, {
        name: `bank-${uid()}`,
        description: null,
        type: 'STRING',
        strings: ['a'],
      });
      const mutations = [
        {
          query: `mutation Create($input: CreateTextBankInput!) {
            createTextBank(input: $input) { success }
          }`,
          variables: {
            input: { name: `bank-${uid()}`, type: 'STRING', strings: ['b'] },
          },
        },
        {
          query: `mutation Update($input: UpdateTextBankInput!) {
            updateTextBank(input: $input) { success }
          }`,
          variables: { input: { id: bank.id, strings: ['b'] } },
        },
        {
          query: `mutation Delete($id: ID!) { deleteTextBank(id: $id) }`,
          variables: { id: bank.id },
        },
      ];
      const storedBanks = async () =>
        deps.ModerationConfigService.getTextBanks({ orgId: org.id });

      await loginAs({ deps, request }, org.id, UserRole.ANALYST);
      for (const mutation of mutations) {
        const response = await request.post('/api/v1/graphql').send(mutation);
        expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
      }
      expect(await storedBanks()).toEqual([
        expect.objectContaining({ id: bank.id, strings: ['a'] }),
      ]);

      await loginAs({ deps, request }, org.id, UserRole.RULES_MANAGER);
      for (const mutation of mutations) {
        const response = await request.post('/api/v1/graphql').send(mutation);
        expect(response.body.errors).toBeUndefined();
      }
      expect(await storedBanks()).toEqual([
        expect.objectContaining({ strings: ['b'] }),
      ]);
    },
  );

  testWithOrg(
    'stops an Analyst from changing or deleting a live reporting rule',
    async ({ deps, request, org, itemType, action }) => {
      await loginAs({ deps, request }, org.id, UserRole.ADMIN);
      const created = await request.post('/api/v1/graphql').send({
        query: `mutation Create($input: CreateReportingRuleInput!) {
          createReportingRule(input: $input) {
            ... on MutateReportingRuleSuccessResponse { data { id name } }
          }
        }`,
        variables: {
          input: {
            name: `reporting-${uid()}`,
            status: 'LIVE',
            conditionSet,
            itemTypeIds: [itemType.id],
            actionIds: [action.id],
            policyIds: [],
          },
        },
      });
      expect(created.body.errors).toBeUndefined();
      const reportingRule = created.body.data.createReportingRule.data as {
        id: string;
        name: string;
      };

      await loginAs({ deps, request }, org.id, UserRole.ANALYST);

      const update = await request.post('/api/v1/graphql').send({
        query: `mutation Rename($input: UpdateReportingRuleInput!) {
          updateReportingRule(input: $input) { __typename }
        }`,
        variables: {
          input: { id: reportingRule.id, name: `renamed-${uid()}` },
        },
      });
      expect(update.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

      const remove = await request.post('/api/v1/graphql').send({
        query: `mutation Delete($id: ID!) { deleteReportingRule(id: $id) }`,
        variables: { id: reportingRule.id },
      });
      expect(remove.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

      // A live rule stays live even when it has no remaining action links.
      await deps.KyselyPg.deleteFrom(
        'reporting_rules.reporting_rules_to_actions',
      )
        .where('reporting_rule_id', '=', reportingRule.id)
        .execute();
      const updateUnlinked = await request.post('/api/v1/graphql').send({
        query: `mutation Rename($input: UpdateReportingRuleInput!) {
          updateReportingRule(input: $input) { __typename }
        }`,
        variables: {
          input: { id: reportingRule.id, name: `renamed-${uid()}` },
        },
      });
      expect(updateUnlinked.body.errors?.[0]?.extensions?.code).toBe(
        'FORBIDDEN',
      );

      const stored = await deps.KyselyPg.selectFrom(
        'reporting_rules.reporting_rules',
      )
        .select('name')
        .where('id', '=', reportingRule.id)
        .executeTakeFirstOrThrow();
      expect(stored.name).toBe(reportingRule.name);
    },
  );
});
