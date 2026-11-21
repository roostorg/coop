import { inArray } from 'drizzle-orm';
import { vi, type Mocked } from 'vitest';

import { type PublicInterface } from '../../iocContainer/index.js';
import { type NotificationsService } from '../../services/notificationsService/notificationsService.js';
import { type GetCurrentPeriodRuleAlarmStatuses } from '../../services/ruleAnomalyDetectionService/getCurrentPeriodRuleAlarmStatuses.js';
import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import DetectRulePassRateAnomaliesJob from './detectRulePassRateAnomaliesJob.js';

describe('Detect Rule Anomalies', () => {
  describe('worker', () => {
    const testWithFixture = makeTransactionalTestWithFixture(
      async ({ deps }) => {
        const { ModerationConfigService, ApiKeyService, DrizzlePg } = deps;

        // Make some fake rules (w/ stable ids so we can match them in a snapshot)
        // in different initial alarm statuses, to test all 9 combinations [i.e.,
        // starting and ending at one of (OK, ALARM, or INSUFFICENT_DATA), where
        // the start and end states can be the same]. The rows are written inside
        // the test transaction and rolled back afterward, so the stable ids never
        // leak across runs.
        const { org } = await createOrg({
          DrizzlePg,
          ModerationConfigService,
          ApiKeyService,
        });
        const { org: org2 } = await createOrg(
          {
            DrizzlePg,
            ModerationConfigService,
            ApiKeyService,
          },
          undefined,
          { onCallAlertEmail: 'test@gmail.com' },
        );
        const { user: ruleOwner } = await createUser(DrizzlePg, org.id, {
          id: 'cb34377bcc3',
        });
        const { user: ruleOwner2 } = await createUser(DrizzlePg, org.id, {
          id: 'cb34377bcc4',
        });
        const fakeRules = await Promise.all([
          createRule(DrizzlePg, org.id, {
            alarmStatus: RuleAlarmStatus.ALARM,
            id: '9d237a650c1',
            creator: ruleOwner,
          }),
          createRule(DrizzlePg, org.id, {
            alarmStatus: RuleAlarmStatus.ALARM,
            id: '386da8abc3b',
            creator: ruleOwner,
          }),
          createRule(DrizzlePg, org.id, {
            alarmStatus: RuleAlarmStatus.ALARM,
            id: 'd237a650c13',
            creator: ruleOwner,
          }),

          createRule(DrizzlePg, org.id, {
            alarmStatus: RuleAlarmStatus.OK,
            id: '86da8abc3b6',
            creator: ruleOwner,
          }),
          createRule(DrizzlePg, org.id, {
            alarmStatus: RuleAlarmStatus.OK,
            id: 'fdb4ee86f93',
            creator: ruleOwner,
          }),
          createRule(DrizzlePg, org.id, {
            alarmStatus: RuleAlarmStatus.OK,
            id: '237a650c134',
            creator: ruleOwner,
          }),

          createRule(DrizzlePg, org2.id, {
            alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
            id: 'db4ee86f938',
            creator: ruleOwner2,
          }),
          createRule(DrizzlePg, org2.id, {
            alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
            id: '37a650c1342',
            creator: ruleOwner2,
          }),
          createRule(DrizzlePg, org2.id, {
            alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
            id: 'b4ee86f9386',
            creator: ruleOwner2,
          }),
        ]);

        const mockGetCurrentPeriodRuleAlarmStatuses: GetCurrentPeriodRuleAlarmStatuses =
          async () => {
            const newAlarmStatusByRule =
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              {} as Awaited<ReturnType<GetCurrentPeriodRuleAlarmStatuses>>;

            fakeRules.forEach((rule, i) => {
              // eslint-disable-next-line functional/immutable-data
              newAlarmStatusByRule[rule.id] = {
                status:
                  i % 3 === 0
                    ? RuleAlarmStatus.ALARM
                    : i % 3 === 1
                      ? RuleAlarmStatus.OK
                      : RuleAlarmStatus.INSUFFICIENT_DATA,
                meta: {
                  lastPeriodPassRate: 0.5,
                  secondToLastPeriodPassRate: 0.4,
                },
              };
            });
            return newAlarmStatusByRule;
          };

        const mockNotificationsService: Mocked<
          PublicInterface<NotificationsService>
        > = {
          createNotifications: vi.fn(),
          getNotificationsForUser: vi.fn(),
        };

        return {
          DrizzlePg,
          fakeRules,
          mockNotificationsService,
          mockGetCurrentPeriodRuleAlarmStatuses,
        };
      },
    );

    testWithFixture(
      'should generate the proper notifications + update rules',
      async ({
        DrizzlePg,
        fakeRules,
        mockNotificationsService,
        mockGetCurrentPeriodRuleAlarmStatuses,
      }) => {
        const newStatuses = await mockGetCurrentPeriodRuleAlarmStatuses();
        const worker = DetectRulePassRateAnomaliesJob(
          DrizzlePg,
          mockNotificationsService,
          mockGetCurrentPeriodRuleAlarmStatuses,
          vi.fn<() => Promise<void>>(),
        );
        await worker.run();

        const mockCreateNotifications =
          mockNotificationsService.createNotifications;

        expect(mockCreateNotifications).toHaveBeenCalledTimes(1);
        expect(
          mockCreateNotifications.mock.calls[0][0]
            .slice(0)
            .sort((a, b) => a.data.ruleId.localeCompare(b.data.ruleId)),
        ).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "lastPeriodPassRate": 0.5,
              "ruleId": "386da8abc3b",
              "ruleName": "Dummy_Rule_Name_386da8abc3b",
              "secondToLastPeriodPassRate": 0.4,
            },
            "message": "[Alarm Cleared - Live Rule] Dummy_Rule_Name_386da8abc3b has stopped passing at an anomalous rate.",
            "recipients": [
              {
                "type": "user_id",
                "value": "cb34377bcc3",
              },
            ],
            "type": "RULE_PASS_RATE_INCREASE_ANOMALY_END",
          },
          {
            "data": {
              "lastPeriodPassRate": 0.5,
              "ruleId": "86da8abc3b6",
              "ruleName": "Dummy_Rule_Name_86da8abc3b6",
              "secondToLastPeriodPassRate": 0.4,
            },
            "message": "[Alarm Triggered - Live Rule] Dummy_Rule_Name_86da8abc3b6 has started passing at an anomalous rate.",
            "recipients": [
              {
                "type": "user_id",
                "value": "cb34377bcc3",
              },
            ],
            "type": "RULE_PASS_RATE_INCREASE_ANOMALY_START",
          },
          {
            "data": {
              "lastPeriodPassRate": 0.5,
              "ruleId": "d237a650c13",
              "ruleName": "Dummy_Rule_Name_d237a650c13",
              "secondToLastPeriodPassRate": 0.4,
            },
            "message": "[Alarm Cleared - Live Rule] Dummy_Rule_Name_d237a650c13 has stopped passing at an anomalous rate.",
            "recipients": [
              {
                "type": "user_id",
                "value": "cb34377bcc3",
              },
            ],
            "type": "RULE_PASS_RATE_INCREASE_ANOMALY_END",
          },
          {
            "data": {
              "lastPeriodPassRate": 0.5,
              "ruleId": "db4ee86f938",
              "ruleName": "Dummy_Rule_Name_db4ee86f938",
              "secondToLastPeriodPassRate": 0.4,
            },
            "message": "[Alarm Triggered - Live Rule] Dummy_Rule_Name_db4ee86f938 has started passing at an anomalous rate.",
            "recipients": [
              {
                "type": "user_id",
                "value": "cb34377bcc4",
              },
              {
                "type": "email_address",
                "value": "test@gmail.com",
              },
            ],
            "type": "RULE_PASS_RATE_INCREASE_ANOMALY_START",
          },
        ]
      `);

        const rulesAfter = await DrizzlePg.select({
          id: schema.rules.id,
          alarmStatus: schema.rules.alarmStatus,
        })
          .from(schema.rules)
          .where(
            inArray(
              schema.rules.id,
              fakeRules.map((r) => r.id),
            ),
          );
        expect(rulesAfter).toHaveLength(fakeRules.length);
        for (const rule of rulesAfter) {
          expect(rule.alarmStatus).toBe(newStatuses[rule.id].status);
        }
      },
    );
  });
});
