import { eq } from 'drizzle-orm';
import { uid } from 'uid';

import {
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
} from '../../services/moderationConfigService/index.js';
import { UserRole } from '../../services/userManagementService/index.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';
import createOrg from './createOrg.js';
import createRule from './createRule.js';
import createUser from './createUser.js';

async function findUserById(db: CoopDb, id: string) {
  const rows = await db
    .select({ id: schema.users.id, orgId: schema.users.orgId })
    .from(schema.users)
    .where(eq(schema.users.id, id));
  return rows.at(0);
}

async function findRuleById(db: CoopDb, id: string) {
  const rows = await db
    .select({
      id: schema.rules.id,
      ruleType: schema.rules.ruleType,
      statusIfUnexpired: schema.rules.statusIfUnexpired,
      alarmStatus: schema.rules.alarmStatus,
    })
    .from(schema.rules)
    .where(eq(schema.rules.id, id));
  return rows.at(0);
}

describe('fixtureHelpers', () => {
  const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        DrizzlePg: deps.DrizzlePg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return { org };
  });

  describe('createUser', () => {
    testWithOrg(
      'defaults: SAML-only loginMethods, ADMIN role, null password, override id honored',
      async ({ deps, org }) => {
        const overrideId = uid();
        const { user } = await createUser(deps.DrizzlePg, org.id, {
          id: overrideId,
        });
        expect(user).toMatchObject({
          id: overrideId,
          orgId: org.id,
          role: UserRole.ADMIN,
          loginMethods: ['saml'],
          password: null,
        });
      },
    );

    testWithOrg('cleanup() actually deletes the row', async ({ deps, org }) => {
      const { user, cleanup } = await createUser(deps.DrizzlePg, org.id);
      expect(await findUserById(deps.DrizzlePg, user.id)).toBeDefined();
      await cleanup();
      expect(await findUserById(deps.DrizzlePg, user.id)).toBeUndefined();
    });
  });

  describe('createRule', () => {
    testWithOrg(
      'defaults: CONTENT type, LIVE status, INSUFFICIENT_DATA alarm, override id/name honored',
      async ({ deps, org }) => {
        const overrideId = uid();
        const overrideName = `RuleFixture_${overrideId}`;
        const rule = await createRule(deps.DrizzlePg, org.id, {
          id: overrideId,
          name: overrideName,
        });
        expect(rule).toMatchObject({
          id: overrideId,
          orgId: org.id,
          name: overrideName,
          alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
          statusIfUnexpired: RuleStatus.LIVE,
        });

        expect(await findRuleById(deps.DrizzlePg, overrideId)).toMatchObject({
          ruleType: RuleType.CONTENT,
          statusIfUnexpired: RuleStatus.LIVE,
          alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
        });
      },
    );

    testWithOrg(
      'extra.alarmStatus !== INSUFFICIENT_DATA triggers the follow-up UPDATE',
      async ({ deps, org }) => {
        const rule = await createRule(deps.DrizzlePg, org.id, {
          alarmStatus: RuleAlarmStatus.ALARM,
        });
        expect(rule.alarmStatus).toBe(RuleAlarmStatus.ALARM);
        const row = await findRuleById(deps.DrizzlePg, rule.id);
        expect(row?.alarmStatus).toBe(RuleAlarmStatus.ALARM);
      },
    );

    testWithOrg(
      'extra.ruleType: USER persists rule_type=USER (and skips item-type junctions)',
      async ({ deps, org }) => {
        const rule = await createRule(deps.DrizzlePg, org.id, {
          ruleType: RuleType.USER,
        });
        const row = await findRuleById(deps.DrizzlePg, rule.id);
        expect(row?.ruleType).toBe(RuleType.USER);

        const { rulesAndItemTypes } = schema;
        const junctions = await deps.DrizzlePg.select({
          itemTypeId: rulesAndItemTypes.itemTypeId,
        })
          .from(rulesAndItemTypes)
          .where(eq(rulesAndItemTypes.ruleId, rule.id));
        expect(junctions).toEqual([]);
      },
    );

    testWithOrg('destroy() removes the row', async ({ deps, org }) => {
      const rule = await createRule(deps.DrizzlePg, org.id);
      const before = await findRuleById(deps.DrizzlePg, rule.id);
      expect(before).toBeDefined();

      await rule.destroy();

      const after = await findRuleById(deps.DrizzlePg, rule.id);
      expect(after).toBeUndefined();
    });

    testWithOrg(
      'auto-creates a creator user when none is supplied',
      async ({ deps, org }) => {
        const rule = await createRule(deps.DrizzlePg, org.id);
        const creator = await findUserById(deps.DrizzlePg, rule.creatorId);
        expect(creator).toBeDefined();
        expect(creator?.orgId).toBe(org.id);
      },
    );
  });
});
