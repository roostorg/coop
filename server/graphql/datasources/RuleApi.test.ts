import { uid } from 'uid';

import createContentItemTypes from '../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import {
  type GQLCreateContentRuleInput,
  type GQLCreateUserRuleInput,
  type GQLUpdateContentRuleInput,
  type GQLUpdateUserRuleInput,
} from '../generated.js';

const minimalConditionSet = {
  conjunction: 'AND' as const,
  conditions: [
    {
      input: { type: 'FULL_ITEM' as const },
      comparator: 'IS_NOT_PROVIDED' as const,
    },
  ],
};

describe('RuleAPI', () => {
  const testWithRuleApiFixture = makeTransactionalTestWithFixture(
    async ({ deps }) => {
      const { ModerationConfigService } = deps;
      const { org } = await createOrg(
        {
          KyselyPg: deps.KyselyPg,
          ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );
      const { user } = await createUser(deps.KyselyPg, org.id);
      const { itemTypes } = await createContentItemTypes({
        moderationConfigService: ModerationConfigService,
        orgId: org.id,
        includeCreator: true,
        extra: {},
      });

      return { org, user, itemTypes };
    },
  );

  testWithRuleApiFixture(
    'createContentRule + getGraphQLRuleFromId round-trip',
    async ({ deps, user, org, itemTypes }) => {
      const name = `Content rule ${uid()}`;
      const rule = await deps.RuleAPIDataSource.createContentRule(
        {
          name,
          description: null,
          status: 'DRAFT',
          contentTypeIds: [itemTypes[0].id],
          conditionSet: minimalConditionSet,
          actionIds: [],
          policyIds: [],
          tags: [],
          maxDailyActions: null,
        } satisfies GQLCreateContentRuleInput,
        user.id,
        org.id,
      );

      const fetched = await deps.RuleAPIDataSource.getGraphQLRuleFromId(
        rule.id,
        org.id,
      );
      expect(fetched.id).toBe(rule.id);
      expect(fetched.name).toBe(name);
    },
  );

  testWithRuleApiFixture(
    'createUserRule + getGraphQLRuleFromId round-trip',
    async ({ deps, user, org }) => {
      const name = `User rule ${uid()}`;
      const rule = await deps.RuleAPIDataSource.createUserRule(
        {
          name,
          description: null,
          status: 'DRAFT',
          conditionSet: minimalConditionSet,
          actionIds: [],
          policyIds: [],
          tags: [],
          maxDailyActions: null,
        } satisfies GQLCreateUserRuleInput,
        user.id,
        org.id,
      );

      const fetched = await deps.RuleAPIDataSource.getGraphQLRuleFromId(
        rule.id,
        org.id,
      );
      expect(fetched.id).toBe(rule.id);
      expect(fetched.name).toBe(name);
    },
  );

  testWithRuleApiFixture(
    'updateUserRule without expirationTime leaves expirationTime unchanged',
    async ({ deps, user, org }) => {
      const future = new Date('2099-06-15T12:00:00.000Z');
      const rule = await deps.RuleAPIDataSource.createUserRule(
        {
          name: `Expiration partial ${uid()}`,
          description: null,
          status: 'DRAFT',
          conditionSet: minimalConditionSet,
          actionIds: [],
          policyIds: [],
          tags: [],
          maxDailyActions: null,
          expirationTime: future,
        } satisfies GQLCreateUserRuleInput,
        user.id,
        org.id,
      );

      await deps.RuleAPIDataSource.updateUserRule({
        input: {
          id: rule.id,
          name: 'renamed-without-expiration-touch',
        } satisfies GQLUpdateUserRuleInput,
        orgId: org.id,
      });

      const plain = await deps.ModerationConfigService.getRuleByIdAndOrg(
        rule.id,
        org.id,
        { readFromReplica: false },
      );
      expect(plain).not.toBeNull();
      expect(plain!.expirationTime?.getTime()).toBe(future.getTime());
    },
  );

  testWithRuleApiFixture(
    'updateUserRule with status EXPIRED and omitted expirationTime sets expirationTime near now',
    async ({ deps, user, org }) => {
      const rule = await deps.RuleAPIDataSource.createUserRule(
        {
          name: `Expire status ${uid()}`,
          description: null,
          status: 'DRAFT',
          conditionSet: minimalConditionSet,
          actionIds: [],
          policyIds: [],
          tags: [],
          maxDailyActions: null,
        } satisfies GQLCreateUserRuleInput,
        user.id,
        org.id,
      );

      const before = Date.now();
      await deps.RuleAPIDataSource.updateUserRule({
        input: {
          id: rule.id,
          status: 'EXPIRED',
        } satisfies GQLUpdateUserRuleInput,
        orgId: org.id,
      });
      const after = Date.now();

      const plain = await deps.ModerationConfigService.getRuleByIdAndOrg(
        rule.id,
        org.id,
        { readFromReplica: false },
      );
      expect(plain).not.toBeNull();
      expect(plain!.expirationTime).not.toBeNull();
      const expMs = plain!.expirationTime!.getTime();
      expect(expMs).toBeGreaterThanOrEqual(before);
      expect(expMs).toBeLessThanOrEqual(after + 2000);
    },
  );

  testWithRuleApiFixture(
    'duplicate rule name yields RuleNameExistsError',
    async ({ deps, user, org }) => {
      const name = `Dup name ${uid()}`;
      await deps.RuleAPIDataSource.createUserRule(
        {
          name,
          description: null,
          status: 'DRAFT',
          conditionSet: minimalConditionSet,
          actionIds: [],
          policyIds: [],
          tags: [],
          maxDailyActions: null,
        } satisfies GQLCreateUserRuleInput,
        user.id,
        org.id,
      );

      await expect(
        deps.RuleAPIDataSource.createUserRule(
          {
            name,
            description: null,
            status: 'DRAFT',
            conditionSet: minimalConditionSet,
            actionIds: [],
            policyIds: [],
            tags: [],
            maxDailyActions: null,
          } satisfies GQLCreateUserRuleInput,
          user.id,
          org.id,
        ),
      ).rejects.toMatchObject({ name: 'RuleNameExistsError' });
    },
  );

  testWithRuleApiFixture(
    'updateContentRule fails when a running backtest exists and cancelRunningBacktests is false',
    async ({ deps, user, org, itemTypes }) => {
      const rule = await deps.RuleAPIDataSource.createContentRule(
        {
          name: `Backtest guard ${uid()}`,
          description: null,
          status: 'DRAFT',
          contentTypeIds: [itemTypes[0].id],
          conditionSet: minimalConditionSet,
          actionIds: [],
          policyIds: [],
          tags: [],
          maxDailyActions: null,
        } satisfies GQLCreateContentRuleInput,
        user.id,
        org.id,
      );

      const now = new Date();
      await deps.KyselyPg.insertInto('public.backtests')
        .values({
          id: uid(),
          rule_id: rule.id,
          creator_id: user.id,
          sample_desired_size: 10,
          sample_start_at: now,
          sample_end_at: now,
          updated_at: now,
        })
        .execute();

      await expect(
        deps.RuleAPIDataSource.updateContentRule({
          input: {
            id: rule.id,
            name: 'should-not-apply',
            cancelRunningBacktests: false,
          } satisfies GQLUpdateContentRuleInput,
          orgId: org.id,
        }),
      ).rejects.toMatchObject({ name: 'RuleHasRunningBacktestsError' });
    },
  );

  testWithRuleApiFixture(
    'deleteRule removes the rule row',
    async ({ deps, user, org }) => {
      const rule = await deps.RuleAPIDataSource.createUserRule(
        {
          name: `Delete me ${uid()}`,
          description: null,
          status: 'DRAFT',
          conditionSet: minimalConditionSet,
          actionIds: [],
          policyIds: [],
          tags: [],
          maxDailyActions: null,
        } satisfies GQLCreateUserRuleInput,
        user.id,
        org.id,
      );

      const ok = await deps.RuleAPIDataSource.deleteRule({
        id: rule.id,
        orgId: org.id,
      });
      expect(ok).toBe(true);

      const plain = await deps.ModerationConfigService.getRuleByIdAndOrg(
        rule.id,
        org.id,
        { readFromReplica: false },
      );
      expect(plain).toBeNull();
    },
  );
});
