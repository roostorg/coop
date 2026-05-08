import { uid } from 'uid';

import { kyselyUserFindById } from '../../graphql/datasources/userKyselyPersistence.js';
import {
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
} from '../../services/moderationConfigService/index.js';
import { UserRole } from '../../services/userManagementService/index.js';
import { makeMockedServer } from '../setupMockedServer.js';
import { makeTestWithFixture } from '../utils.js';
import createOrg from './createOrg.js';
import createRule from './createRule.js';
import createUser from './createUser.js';

describe('fixtureHelpers', () => {
  const testWithOrg = makeTestWithFixture(async () => {
    const { deps, shutdown } = await makeMockedServer();
    const { org, cleanup: orgCleanup } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return {
      deps,
      org,
      async cleanup() {
        await orgCleanup();
        await shutdown();
      },
    };
  });

  describe('createUser', () => {
    testWithOrg(
      'defaults: SAML-only loginMethods, ADMIN role, null password, override id honored',
      async ({ deps, org }) => {
        const overrideId = uid();
        const { user, cleanup } = await createUser(deps.KyselyPg, org.id, {
          id: overrideId,
        });
        try {
          expect(user).toMatchObject({
            id: overrideId,
            orgId: org.id,
            role: UserRole.ADMIN,
            loginMethods: ['saml'],
            password: null,
          });
        } finally {
          await cleanup();
        }
      },
    );

    testWithOrg('cleanup() actually deletes the row', async ({ deps, org }) => {
      const { user, cleanup } = await createUser(deps.KyselyPg, org.id);
      expect(await kyselyUserFindById(deps.KyselyPg, user.id)).toBeDefined();
      await cleanup();
      expect(await kyselyUserFindById(deps.KyselyPg, user.id)).toBeUndefined();
    });
  });

  describe('createRule', () => {
    testWithOrg(
      'defaults: CONTENT type, LIVE status, INSUFFICIENT_DATA alarm, override id/name honored',
      async ({ deps, org }) => {
        const overrideId = uid();
        const overrideName = `RuleFixture_${overrideId}`;
        const rule = await createRule(deps.KyselyPg, org.id, {
          id: overrideId,
          name: overrideName,
        });
        try {
          expect(rule).toMatchObject({
            id: overrideId,
            orgId: org.id,
            name: overrideName,
            alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
            statusIfUnexpired: RuleStatus.LIVE,
          });

          const row = await deps.KyselyPg.selectFrom('public.rules')
            .select(['rule_type', 'status_if_unexpired', 'alarm_status'])
            .where('id', '=', overrideId)
            .executeTakeFirstOrThrow();
          expect(row.rule_type).toBe(RuleType.CONTENT);
          expect(row.status_if_unexpired).toBe(RuleStatus.LIVE);
          expect(row.alarm_status).toBe(RuleAlarmStatus.INSUFFICIENT_DATA);
        } finally {
          await rule.destroy();
        }
      },
    );

    testWithOrg(
      'extra.alarmStatus !== INSUFFICIENT_DATA triggers the follow-up UPDATE',
      async ({ deps, org }) => {
        const rule = await createRule(deps.KyselyPg, org.id, {
          alarmStatus: RuleAlarmStatus.ALARM,
        });
        try {
          expect(rule.alarmStatus).toBe(RuleAlarmStatus.ALARM);
          const row = await deps.KyselyPg.selectFrom('public.rules')
            .select('alarm_status')
            .where('id', '=', rule.id)
            .executeTakeFirstOrThrow();
          expect(row.alarm_status).toBe(RuleAlarmStatus.ALARM);
        } finally {
          await rule.destroy();
        }
      },
    );

    testWithOrg(
      'extra.ruleType: USER persists rule_type=USER (and skips item-type junctions)',
      async ({ deps, org }) => {
        const rule = await createRule(deps.KyselyPg, org.id, {
          ruleType: RuleType.USER,
        });
        try {
          const row = await deps.KyselyPg.selectFrom('public.rules')
            .select('rule_type')
            .where('id', '=', rule.id)
            .executeTakeFirstOrThrow();
          expect(row.rule_type).toBe(RuleType.USER);

          const junctions = await deps.KyselyPg.selectFrom(
            'public.rules_and_item_types',
          )
            .select('item_type_id')
            .where('rule_id', '=', rule.id)
            .execute();
          expect(junctions).toEqual([]);
        } finally {
          await rule.destroy();
        }
      },
    );

    testWithOrg('destroy() removes the row', async ({ deps, org }) => {
      const rule = await createRule(deps.KyselyPg, org.id);
      const before = await deps.KyselyPg.selectFrom('public.rules')
        .select('id')
        .where('id', '=', rule.id)
        .executeTakeFirst();
      expect(before).toBeDefined();

      await rule.destroy();

      const after = await deps.KyselyPg.selectFrom('public.rules')
        .select('id')
        .where('id', '=', rule.id)
        .executeTakeFirst();
      expect(after).toBeUndefined();
    });

    testWithOrg(
      'auto-creates a creator user when none is supplied',
      async ({ deps, org }) => {
        const rule = await createRule(deps.KyselyPg, org.id);
        try {
          const creator = await kyselyUserFindById(
            deps.KyselyPg,
            rule.creatorId,
          );
          expect(creator).toBeDefined();
          expect(creator?.orgId).toBe(org.id);
        } finally {
          await rule.destroy();
        }
      },
    );
  });
});
