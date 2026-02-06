import _ from 'lodash';

import getBottle, {
  type Dependencies,
  type PublicInterface,
} from '../../iocContainer/index.js';
import { type Rule as TRule } from '../../models/rules/RuleModel.js';
import { type NotificationsService } from '../../services/notificationsService/notificationsService.js';
import { type GetCurrentPeriodRuleAlarmStatuses } from '../../services/ruleAnomalyDetectionService/getCurrentPeriodRuleAlarmStatuses.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { mocked, type Mocked } from '../../test/mockHelpers/jestMocks.js';
import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import DetectRulePassRateAnomaliesJob from './detectRulePassRateAnomaliesJob.js';

describe('Detect Rule Anomalies', () => {
  describe('worker', () => {
    let OrgModel: Dependencies['Sequelize']['Org'],
      deleteMockData: () => Promise<void>,
      mockDummyRules: Mocked<TRule, 'save'>[],
      mockRuleModel: Mocked<Dependencies['Sequelize']['Rule'], 'findAll'>,
      mockGetCurrentPeriodRuleAlarmStatuses: GetCurrentPeriodRuleAlarmStatuses,
      mockNotificationsService: Mocked<
        PublicInterface<NotificationsService>,
        'createNotifications'
      >;

    beforeAll(async () => {
      /* eslint-disable better-mutation/no-mutation */
      const {
        Sequelize: models,
        ModerationConfigService,
        ApiKeyService,
      } = (await getBottle()).container;
      OrgModel = models.Org;

      // make some fake rules (w/ stable ids so we can match them in a snapshot)
      // in different initial alarm statuses, to test all 9 combinations [i.e.,
      // starting and ending at one of (OK, ALARM, or INSUFFICENT_DATA), where
      // the start and end states can be the same].
      const { org } = await createOrg(models, ModerationConfigService, ApiKeyService);
      const { org: org2 } = await createOrg(
        models,
        ModerationConfigService,
        ApiKeyService,
        undefined,
        { onCallAlertEmail: 'test@gmail.com' },
      );
      const { user: ruleOwner } = await createUser(models, org.id, {
        id: 'cb34377bcc3',
      });
      const { user: ruleOwner2 } = await createUser(models, org.id, {
        id: 'cb34377bcc4',
      });
      const fakeRules = await Promise.all([
        createRule(models, org.id, {
          alarmStatus: RuleAlarmStatus.ALARM,
          id: '9d237a650c1',
          creator: ruleOwner,
        }),
        createRule(models, org.id, {
          alarmStatus: RuleAlarmStatus.ALARM,
          id: '386da8abc3b',
          creator: ruleOwner,
        }),
        createRule(models, org.id, {
          alarmStatus: RuleAlarmStatus.ALARM,
          id: 'd237a650c13',
          creator: ruleOwner,
        }),

        createRule(models, org.id, {
          alarmStatus: RuleAlarmStatus.OK,
          id: '86da8abc3b6',
          creator: ruleOwner,
        }),
        createRule(models, org.id, {
          alarmStatus: RuleAlarmStatus.OK,
          id: 'fdb4ee86f93',
          creator: ruleOwner,
        }),
        createRule(models, org.id, {
          alarmStatus: RuleAlarmStatus.OK,
          id: '237a650c134',
          creator: ruleOwner,
        }),

        createRule(models, org2.id, {
          alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
          id: 'db4ee86f938',
          creator: ruleOwner2,
        }),
        createRule(models, org2.id, {
          alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
          id: '37a650c1342',
          creator: ruleOwner2,
        }),
        createRule(models, org2.id, {
          alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
          id: 'b4ee86f9386',
          creator: ruleOwner2,
        }),
      ]);

      mockDummyRules = fakeRules.map((it) => mocked(it, ['save']));
      mockGetCurrentPeriodRuleAlarmStatuses = async () => {
        const newAlarmStatusByRule =
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          {} as Awaited<ReturnType<GetCurrentPeriodRuleAlarmStatuses>>;

        fakeRules.forEach((rule, i) => {
          newAlarmStatusByRule[rule.id] = {
            status:
              i % 3 === 0
                ? RuleAlarmStatus.ALARM
                : i % 3 === 1
                ? RuleAlarmStatus.OK
                : RuleAlarmStatus.INSUFFICIENT_DATA,
            meta: { lastPeriodPassRate: 0.5, secondToLastPeriodPassRate: 0.4 },
          };
        });
        return newAlarmStatusByRule;
      };

      mockNotificationsService = mocked(
        {
          async createNotifications(_it: any) {},
          async getNotificationsForUser() {
            return [];
          },
        },
        ['createNotifications'],
      );

      mockRuleModel = mocked(models.Rule, ['findAll']);
      mockRuleModel.findAll.mockResolvedValue(mockDummyRules);

      // It might be nice if we could create the mock data at the start of a
      // transaction, run the tests with that transaction open, and then just
      // roll it back at the end to automatically delete and leave the db in a
      // consistent/clean state. That's a little tricky, though, as it requires
      // feeding the transacation object (or keeping a managed transaction
      // callback open) all the way into calling the worker. So, instead, we
      // settle for manually defining this compensating transacaction, which we
      // call at the end.
      deleteMockData = async () => {
        await Promise.all(fakeRules.map(async (it) => it.destroy()));
        await Promise.all([ruleOwner.destroy(), ruleOwner2.destroy()]);
        await Promise.all([org.destroy(), org2.destroy()]);
        await models.sequelize.close();
      };
      /* eslint-enable better-mutation/no-mutation */
    });

    afterAll(async () => {
      return deleteMockData();
    });

    test('should generate the proper notifications + update rules', async () => {
      const worker = DetectRulePassRateAnomaliesJob(
        mockRuleModel,
        OrgModel,
        mockNotificationsService,
        mockGetCurrentPeriodRuleAlarmStatuses,
        jest.fn<() => Promise<void>>(),
      );
      await worker.run();

      // We should've sent 4 notifications: one for each of the two rules that
      // was in alarm and transitioned to 'not alarm' (ok or insufficient data),
      // and one for each of the rules that was in 'not alarm' and went to alarm.
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

      // Except for the rules that stayed the same state (indexes 0, 4, 8), all
      // the rules should've been saved with their new state.
      const newRuleStatuses = await mockGetCurrentPeriodRuleAlarmStatuses();
      mockDummyRules.forEach((rule, i) => {
        if (![0, 4, 8].includes(i)) {
          expect(rule.save).toHaveBeenCalledTimes(1);
          expect(rule.alarmStatus).toEqual(newRuleStatuses[rule.id].status);
        } else {
          expect(rule.save).toHaveBeenCalledTimes(0);
        }
      });
    });
  });
});
