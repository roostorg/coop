import { uid } from 'uid';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import createContentItemTypes from '../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import loginWithPermissions from '../../test/fixtureHelpers/loginWithPermissions.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
  const { org } = await createOrg(deps);
  const { user: admin } = await createUser(deps.KyselyPg, org.id);
  const { itemTypes } = await createContentItemTypes({
    moderationConfigService: deps.ModerationConfigService,
    orgId: org.id,
    extra: {},
  });
  const itemTypeId = itemTypes[0].id;
  const action = await deps.ActionAPIDataSource.createAction(
    {
      name: `action-${uid()}`,
      itemTypeIds: [itemTypeId],
      callbackUrl: 'https://hooks.example.test/action',
      callbackUrlHeaders: { Authorization: 'Bearer test-secret' },
      callbackUrlBody: { token: 'test-secret' },
    },
    org.id,
  );
  const textBank = await deps.ModerationConfigService.createTextBank(org.id, {
    name: `bank-${uid()}`,
    description: null,
    type: 'STRING',
    strings: ['a'],
  });
  const locationBankId = uid();
  await deps.KyselyPg.insertInto('public.location_banks')
    .values({
      id: locationBankId,
      name: `bank-${uid()}`,
      description: null,
      org_id: org.id,
      owner_id: admin.id,
      updated_at: new Date(),
      full_places_api_responses: [],
    })
    .execute();

  // HMA is an external service, and executing an action calls the action's
  // webhook, so these are stubbed; everything else runs for real.
  const hma = {
    createBank: vi
      .spyOn(deps.HMAHashBankService, 'createBank')
      .mockResolvedValue({ id: 1 } as never),
    updateBank: vi
      .spyOn(deps.HMAHashBankService, 'updateBank')
      .mockResolvedValue({ id: 1 } as never),
    deleteBank: vi
      .spyOn(deps.HMAHashBankService, 'deleteBank')
      .mockResolvedValue(undefined),
    setBankExchangeCredentials: vi
      .spyOn(deps.HMAHashBankService, 'setBankExchangeCredentials')
      .mockResolvedValue({ has_credentials: true } as never),
  };
  const bulkExecuteActions = vi
    .spyOn(deps.ActionAPIDataSource, 'bulkExecuteActions')
    .mockResolvedValue([]);

  return {
    org,
    itemTypeId,
    actionId: action.id,
    textBankId: textBank.id,
    locationBankId,
    hma,
    bulkExecuteActions,
  };
});

type Fixture = Parameters<Parameters<typeof testWithOrg>[1]>[0];

type Case = {
  name: string;
  /** The permission the mutation requires on top of `alsoHeld`. */
  permission: UserPermission;
  alsoHeld?: UserPermission[];
  request: (fx: Fixture) => {
    query: string;
    variables: Record<string, unknown>;
  };
  /** What a successful mutation changes, compared before and after a denial. */
  state: (fx: Fixture) => Promise<unknown>;
};

const actionRow = async ({ deps, actionId }: Fixture) =>
  deps.KyselyPg.selectFrom('public.actions')
    .selectAll()
    .where('id', '=', actionId)
    .executeTakeFirst();
const actionNames = async ({ deps, org }: Fixture) =>
  deps.KyselyPg.selectFrom('public.actions')
    .select('name')
    .where('org_id', '=', org.id)
    .orderBy('name')
    .execute();
const textBanks = async ({ deps, org }: Fixture) =>
  deps.ModerationConfigService.getTextBanks({ orgId: org.id });
const locationBanks = async ({ deps, org }: Fixture) =>
  deps.KyselyPg.selectFrom('public.location_banks')
    .select(['id', 'name'])
    .where('org_id', '=', org.id)
    .orderBy('name')
    .execute();
const stubCalls =
  (stub: (fx: Fixture) => { mock: { calls: unknown[] } }) =>
  async (fx: Fixture) =>
    stub(fx).mock.calls.length;

const updateAction = (input: Record<string, unknown>) => (fx: Fixture) => ({
  query: `mutation ($input: UpdateActionInput!) {
    updateAction(input: $input) { __typename }
  }`,
  variables: { input: { id: fx.actionId, ...input } },
});

const cases: Case[] = [
  {
    name: 'createAction',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: ({ itemTypeId }) => ({
      query: `mutation ($input: CreateActionInput!) {
        createAction(input: $input) { __typename }
      }`,
      variables: {
        input: {
          name: `action-${uid()}`,
          itemTypeIds: [itemTypeId],
          callbackUrl: 'https://hooks.example.test/new',
        },
      },
    }),
    state: actionNames,
  },
  {
    name: 'updateAction',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: updateAction({ name: `renamed-${uid()}` }),
    state: actionRow,
  },
  {
    name: 'deleteAction',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: ({ actionId }) => ({
      query: `mutation ($id: ID!) { deleteAction(id: $id) }`,
      variables: { id: actionId },
    }),
    state: actionRow,
  },
  ...[
    { callbackUrl: 'https://attacker.example.test/hook' },
    { callbackUrlHeaders: null },
    { callbackUrlHeaders: { Authorization: 'Bearer other' } },
    { callbackUrlBody: { token: 'other' } },
  ].map((change): Case => ({
    name: `updateAction changing ${Object.keys(change)[0]}`,
    permission: UserPermission.MANAGE_ORG,
    alsoHeld: [UserPermission.MUTATE_LIVE_RULES],
    request: updateAction(change),
    state: actionRow,
  })),
  {
    name: 'bulkExecuteActions',
    permission: UserPermission.MANUALLY_ACTION_CONTENT,
    request: ({ actionId, itemTypeId }) => ({
      query: `mutation ($input: ExecuteBulkActionInput!) {
        bulkExecuteActions(input: $input) { __typename }
      }`,
      variables: {
        input: {
          itemIds: ['item'],
          actionIds: [actionId],
          itemTypeId,
          policyIds: [],
        },
      },
    }),
    state: stubCalls((fx) => fx.bulkExecuteActions),
  },
  {
    name: 'createTextBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: () => ({
      query: `mutation ($input: CreateTextBankInput!) {
        createTextBank(input: $input) { success }
      }`,
      variables: {
        input: { name: `bank-${uid()}`, type: 'STRING', strings: ['b'] },
      },
    }),
    state: textBanks,
  },
  {
    name: 'updateTextBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: ({ textBankId }) => ({
      query: `mutation ($input: UpdateTextBankInput!) {
        updateTextBank(input: $input) { success }
      }`,
      variables: { input: { id: textBankId, strings: ['b'] } },
    }),
    state: textBanks,
  },
  {
    name: 'deleteTextBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: ({ textBankId }) => ({
      query: `mutation ($id: ID!) { deleteTextBank(id: $id) }`,
      variables: { id: textBankId },
    }),
    state: textBanks,
  },
  {
    name: 'createLocationBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: () => ({
      query: `mutation ($input: CreateLocationBankInput!) {
        createLocationBank(input: $input) { __typename }
      }`,
      variables: { input: { name: `bank-${uid()}`, locations: [] } },
    }),
    state: locationBanks,
  },
  {
    name: 'updateLocationBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: ({ locationBankId }) => ({
      query: `mutation ($input: UpdateLocationBankInput!) {
        updateLocationBank(input: $input) { __typename }
      }`,
      variables: { input: { id: locationBankId, name: `renamed-${uid()}` } },
    }),
    state: locationBanks,
  },
  {
    name: 'deleteLocationBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: ({ locationBankId }) => ({
      query: `mutation ($id: ID!) { deleteLocationBank(id: $id) }`,
      variables: { id: locationBankId },
    }),
    state: locationBanks,
  },
  {
    name: 'createHashBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: () => ({
      query: `mutation ($input: CreateHashBankInput!) {
        createHashBank(input: $input) { __typename }
      }`,
      variables: { input: { name: `bank-${uid()}`, enabled_ratio: 1 } },
    }),
    state: stubCalls((fx) => fx.hma.createBank),
  },
  {
    name: 'createHashBank with exchange credentials',
    permission: UserPermission.MANAGE_ORG,
    alsoHeld: [UserPermission.MUTATE_LIVE_RULES],
    request: () => ({
      query: `mutation ($input: CreateHashBankInput!) {
        createHashBank(input: $input) { __typename }
      }`,
      variables: {
        input: {
          name: `bank-${uid()}`,
          enabled_ratio: 1,
          exchange: {
            api_name: 'api',
            config_json: '{}',
            credentials_json: '{"token":"t"}',
          },
        },
      },
    }),
    state: stubCalls((fx) => fx.hma.createBank),
  },
  {
    name: 'updateHashBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: () => ({
      query: `mutation ($input: UpdateHashBankInput!) {
        updateHashBank(input: $input) { __typename }
      }`,
      variables: { input: { id: '1', name: `renamed-${uid()}` } },
    }),
    state: stubCalls((fx) => fx.hma.updateBank),
  },
  {
    name: 'deleteHashBank',
    permission: UserPermission.MUTATE_LIVE_RULES,
    request: () => ({
      query: `mutation ($id: ID!) { deleteHashBank(id: $id) }`,
      variables: { id: '1' },
    }),
    state: stubCalls((fx) => fx.hma.deleteBank),
  },
  {
    name: 'updateHashBankExchangeCredentials',
    permission: UserPermission.MANAGE_ORG,
    request: () => ({
      query: `mutation ($bankId: ID!, $credentialsJson: String!) {
        updateHashBankExchangeCredentials(
          bankId: $bankId
          credentialsJson: $credentialsJson
        ) { __typename }
      }`,
      variables: { bankId: '1', credentialsJson: '{"token":"t"}' },
    }),
    state: stubCalls((fx) => fx.hma.setBankExchangeCredentials),
  },
  {
    name: 'updateAppealSettings',
    permission: UserPermission.MANAGE_ORG,
    request: () => ({
      query: `mutation ($input: AppealSettingsInput!) {
        updateAppealSettings(input: $input) { __typename }
      }`,
      variables: {
        input: { appealsCallbackUrl: 'https://attacker.example.test/appeal' },
      },
    }),
    state: async ({ deps, org }) =>
      deps.OrgSettingsService.getAppealSettings(org.id),
  },
  {
    name: 'setAllUserStrikeThresholds',
    permission: UserPermission.MANAGE_ORG,
    request: () => ({
      query: `mutation ($input: SetAllUserStrikeThresholdsInput!) {
        setAllUserStrikeThresholds(input: $input) { __typename }
      }`,
      variables: { input: { thresholds: [{ threshold: 1, actions: [] }] } },
    }),
    state: async ({ deps, org }) =>
      deps.ModerationConfigService.getUserStrikeThresholdsForOrg(org.id),
  },
  {
    name: 'updateUserStrikeTTL',
    permission: UserPermission.MANAGE_ORG,
    request: () => ({
      query: `mutation ($input: UpdateUserStrikeTTLInput!) {
        updateUserStrikeTTL(input: $input) { __typename }
      }`,
      variables: { input: { ttlDays: 7 } },
    }),
    state: async ({ deps, org }) =>
      deps.OrgSettingsService.userStrikeTTLInDays(org.id),
  },
];

describe('configuration mutations authorization through the GraphQL API', () => {
  describe.each(cases)(
    '$name',
    ({ permission, alsoHeld = [], request, state }) => {
      testWithOrg(`requires ${permission}`, async (fx) => {
        const { setPermissions } = await loginWithPermissions(
          fx,
          fx.org.id,
          Object.values(UserPermission).filter((it) => it !== permission),
        );
        const before = await state(fx);
        const denied = await fx.request
          .post('/api/v1/graphql')
          .send(request(fx));
        expect(denied.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
        expect(await state(fx)).toEqual(before);

        await setPermissions([...alsoHeld, permission]);
        const allowed = await fx.request
          .post('/api/v1/graphql')
          .send(request(fx));
        expect(allowed.body.errors).toBeUndefined();
        expect(await state(fx)).not.toEqual(before);
      });
    },
  );
});

testWithOrg(
  'lets MUTATE_LIVE_RULES save an action whose callback is unchanged',
  async (fx) => {
    await loginWithPermissions(fx, fx.org.id, [
      UserPermission.MUTATE_LIVE_RULES,
    ]);
    const response = await fx.request.post('/api/v1/graphql').send(
      updateAction({
        name: `renamed-${uid()}`,
        callbackUrl: 'https://hooks.example.test/action',
        callbackUrlHeaders: { Authorization: 'Bearer test-secret' },
        callbackUrlBody: { token: 'test-secret' },
      })(fx),
    );
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.updateAction.__typename).toBe(
      'MutateActionSuccessResponse',
    );
  },
);

describe('configuration secrets through the GraphQL API', () => {
  const secrets = `query ($id: ID!) {
    action(id: $id) {
      ... on CustomAction { callbackUrlHeaders callbackUrlBody }
    }
    appealSettings { appealsCallbackHeaders appealsCallbackBody }
  }`;

  testWithOrg(
    'returns webhook headers and bodies only with MANAGE_ORG',
    async (fx) => {
      await fx.deps.OrgSettingsService.updateAppealSettings({
        orgId: fx.org.id,
        callbackUrl: 'https://hooks.example.test/appeal',
        callbackHeaders: { Authorization: 'Bearer appeal-secret' },
        callbackBody: { token: 'appeal-secret' },
      });
      const { setPermissions } = await loginWithPermissions(
        fx,
        fx.org.id,
        Object.values(UserPermission).filter(
          (it) => it !== UserPermission.MANAGE_ORG,
        ),
      );
      const hidden = await fx.request
        .post('/api/v1/graphql')
        .send({ query: secrets, variables: { id: fx.actionId } });
      expect(hidden.body.data).toEqual({
        action: { callbackUrlHeaders: null, callbackUrlBody: null },
        appealSettings: {
          appealsCallbackHeaders: null,
          appealsCallbackBody: null,
        },
      });

      await setPermissions([UserPermission.MANAGE_ORG]);
      const shown = await fx.request
        .post('/api/v1/graphql')
        .send({ query: secrets, variables: { id: fx.actionId } });
      expect(shown.body.data).toEqual({
        action: {
          callbackUrlHeaders: { Authorization: 'Bearer test-secret' },
          callbackUrlBody: { token: 'test-secret' },
        },
        appealSettings: {
          appealsCallbackHeaders: { Authorization: 'Bearer appeal-secret' },
          appealsCallbackBody: { token: 'appeal-secret' },
        },
      });
    },
  );
});
