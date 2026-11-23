import fc from 'fast-check';
import { uid } from 'uid';

import {
  RuleStatus,
  RuleType,
} from '../../services/moderationConfigService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import createContentItemTypes from '../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import loginWithPermissions from '../../test/fixtureHelpers/loginWithPermissions.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { tryParseNonEmptyString } from '../../utils/typescript-types.js';
import { transformConditionForDB } from '../datasources/RuleApi.js';

const { MUTATE_LIVE_RULES: LIVE, MUTATE_NON_LIVE_RULES: NON_LIVE } =
  UserPermission;

type ExistingStatus = 'LIVE' | 'DRAFT' | 'EXPIRED_LIVE' | 'MISSING';
type RequestedStatus = 'LIVE' | 'DRAFT' | undefined;

const conditionSet = {
  conjunction: 'AND' as const,
  conditions: [
    {
      input: { type: 'FULL_ITEM' as const },
      comparator: 'IS_NOT_PROVIDED' as const,
    },
  ],
};

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
    },
    org.id,
  );
  return { org, admin, itemTypeId: itemTypes[0].id, actionId: action.id };
});

type Fixture = Parameters<Parameters<typeof testWithOrg>[1]>[0];

// Returns the id of a rule in `status`, or of no rule for MISSING.
type Seed = (fx: Fixture, status: ExistingStatus) => Promise<string>;

const seedRule =
  (ruleType: RuleType): Seed =>
  async ({ deps, org, admin, itemTypeId }, status) => {
    if (status === 'MISSING') {
      return uid();
    }
    const rule = await createRule(deps.KyselyPg, org.id, {
      creator: admin,
      ruleType,
      status: status === 'DRAFT' ? RuleStatus.DRAFT : RuleStatus.LIVE,
      contentTypeIds: ruleType === RuleType.CONTENT ? [itemTypeId] : [],
    });
    if (status === 'EXPIRED_LIVE') {
      await deps.KyselyPg.updateTable('public.rules')
        .set({ expiration_time: new Date(Date.now() - 24 * 60 * 60 * 1000) })
        .where('id', '=', rule.id)
        .execute();
    }
    return rule.id;
  };

// Reporting rules don't expire, so an expired live one is just live.
const seedReportingRule: Seed = async (
  { deps, org, admin, itemTypeId, actionId },
  status,
) => {
  if (status === 'MISSING') {
    return uid();
  }
  const rule = await deps.ReportingService.createReportingRule({
    orgId: org.id,
    name: `reporting-${uid()}`,
    description: null,
    creatorId: admin.id,
    status: status === 'DRAFT' ? 'DRAFT' : 'LIVE',
    itemTypeIds: [tryParseNonEmptyString(itemTypeId)],
    actionIds: [tryParseNonEmptyString(actionId)],
    policyIds: [],
    conditionSet: transformConditionForDB(conditionSet),
  });
  return rule.id;
};

async function ruleNames({ deps, org }: Fixture) {
  const rules = await deps.KyselyPg.selectFrom('public.rules')
    .select('name')
    .where('org_id', '=', org.id)
    .execute();
  const reportingRules = await deps.KyselyPg.selectFrom(
    'reporting_rules.reporting_rules',
  )
    .select('name')
    .where('org_id', '=', org.id)
    .execute();
  return [...rules, ...reportingRules].map((it) => it.name).sort();
}

type Case = {
  name: string;
  createsRule: boolean;
  seed?: Seed;
  request: (
    fx: Fixture,
    id: string,
    status: RequestedStatus,
  ) => { query: string; variables: Record<string, unknown> };
};

const ruleFields = (status: RequestedStatus) => ({
  name: `rule-${uid()}`,
  status: status ?? 'DRAFT',
  conditionSet,
  actionIds: [],
  policyIds: [],
  tags: [],
});

const cases: Case[] = [
  {
    name: 'createContentRule',
    createsRule: true,
    request: ({ itemTypeId }, _, status) => ({
      query: `mutation ($input: CreateContentRuleInput!) {
        createContentRule(input: $input) { __typename }
      }`,
      variables: {
        input: { ...ruleFields(status), contentTypeIds: [itemTypeId] },
      },
    }),
  },
  {
    name: 'createUserRule',
    createsRule: true,
    request: (_, __, status) => ({
      query: `mutation ($input: CreateUserRuleInput!) {
        createUserRule(input: $input) { __typename }
      }`,
      variables: { input: ruleFields(status) },
    }),
  },
  {
    name: 'updateContentRule',
    createsRule: false,
    seed: seedRule(RuleType.CONTENT),
    request: (_, id, status) => ({
      query: `mutation ($input: UpdateContentRuleInput!) {
        updateContentRule(input: $input) { __typename }
      }`,
      variables: { input: { id, status, name: `renamed-${uid()}` } },
    }),
  },
  {
    name: 'updateUserRule',
    createsRule: false,
    seed: seedRule(RuleType.USER),
    request: (_, id, status) => ({
      query: `mutation ($input: UpdateUserRuleInput!) {
        updateUserRule(input: $input) { __typename }
      }`,
      variables: { input: { id, status, name: `renamed-${uid()}` } },
    }),
  },
  {
    name: 'deleteRule',
    createsRule: false,
    seed: seedRule(RuleType.CONTENT),
    request: (_, id) => ({
      query: `mutation ($id: ID!) { deleteRule(id: $id) }`,
      variables: { id },
    }),
  },
  {
    name: 'createReportingRule',
    createsRule: true,
    request: ({ itemTypeId, actionId }, _, status) => ({
      query: `mutation ($input: CreateReportingRuleInput!) {
        createReportingRule(input: $input) { __typename }
      }`,
      variables: {
        input: {
          name: `reporting-${uid()}`,
          status: status ?? 'DRAFT',
          conditionSet,
          itemTypeIds: [itemTypeId],
          actionIds: [actionId],
          policyIds: [],
        },
      },
    }),
  },
  {
    name: 'updateReportingRule',
    createsRule: false,
    seed: seedReportingRule,
    request: (_, id, status) => ({
      query: `mutation ($input: UpdateReportingRuleInput!) {
        updateReportingRule(input: $input) { __typename }
      }`,
      variables: { input: { id, status, name: `renamed-${uid()}` } },
    }),
  },
  {
    name: 'deleteReportingRule',
    createsRule: false,
    seed: seedReportingRule,
    request: (_, id) => ({
      query: `mutation ($id: ID!) { deleteReportingRule(id: $id) }`,
      variables: { id },
    }),
  },
];

describe('rule mutations authorization through the GraphQL API', () => {
  describe.each(cases)('$name', ({ name, createsRule, seed, request }) => {
    testWithOrg(
      'requires MUTATE_LIVE_RULES for a live rule and either rule permission otherwise',
      async (fx) => {
        const { setPermissions } = await loginWithPermissions(
          fx,
          fx.org.id,
          [],
        );

        await fc.assert(
          fc.asyncProperty(
            fc.subarray(Object.values(UserPermission)),
            fc.constantFrom<ExistingStatus>(
              'LIVE',
              'DRAFT',
              'EXPIRED_LIVE',
              'MISSING',
            ),
            fc.constantFrom<RequestedStatus>('LIVE', 'DRAFT', undefined),
            async (permissions, existingStatus, requestedStatus) => {
              // An update that moves an expired rule's expiration time makes
              // it live again, so an expired live rule counts as live.
              const touchesLiveRule =
                (requestedStatus === 'LIVE' && !name.startsWith('delete')) ||
                (!createsRule &&
                  (existingStatus === 'LIVE' ||
                    existingStatus === 'EXPIRED_LIVE'));
              const allowed =
                permissions.includes(LIVE) ||
                (permissions.includes(NON_LIVE) && !touchesLiveRule);

              const id = (await seed?.(fx, existingStatus)) ?? '';
              const before = await ruleNames(fx);
              await setPermissions(permissions);
              const response = await fx.request
                .post('/api/v1/graphql')
                .send(request(fx, id, requestedStatus));
              const code = response.body.errors?.[0]?.extensions?.code;
              if (allowed && existingStatus === 'MISSING') {
                expect(code).not.toBe('FORBIDDEN');
              } else if (allowed) {
                expect(response.body.errors).toBeUndefined();
                const [result] = Object.values(response.body.data) as unknown[];
                expect(
                  result === true ||
                    (result as { __typename?: string }).__typename?.endsWith(
                      'SuccessResponse',
                    ),
                ).toBe(true);
              } else {
                expect(code).toBe('FORBIDDEN');
                expect(await ruleNames(fx)).toEqual(before);
              }
            },
          ),
          {
            numRuns: 20,
            examples: [
              [[LIVE], 'MISSING', 'DRAFT'],
              [[NON_LIVE], 'DRAFT', 'LIVE'],
              [[NON_LIVE], 'LIVE', undefined],
              [[NON_LIVE], 'EXPIRED_LIVE', undefined],
              [[NON_LIVE], 'MISSING', undefined],
              [[UserPermission.VIEW_MRT], 'DRAFT', 'DRAFT'],
            ],
          },
        );
      },
    );
  });
});
