import getBottle, {
  type Dependencies,
  type PublicInterface,
} from '../../iocContainer/index.js';
import { type NotificationsService } from '../../services/notificationsService/notificationsService.js';
import { type GetCurrentPeriodRuleAlarmStatuses } from '../../services/ruleAnomalyDetectionService/getCurrentPeriodRuleAlarmStatuses.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { type Mocked } from '../../test/mockHelpers/jestMocks.js';
import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import DetectRulePassRateAnomaliesJob from './detectRulePassRateAnomaliesJob.js';

function makeMockKyselyForRules(
  fakeRules: Array<{
    id: string;
    orgId: string;
    creatorId: string;
    name: string;
    alarmStatus: RuleAlarmStatus;
    statusIfUnexpired: string;
  }>,
  orgRows: Array<{ id: string; on_call_alert_email: string | null }>,
) {
  const updateExecute = jest.fn().mockResolvedValue(undefined);
  const mockDb = {
    selectFrom: jest.fn((table: string) => {
      const chain: {
        select: jest.Mock;
        where: jest.Mock;
        execute: jest.Mock;
      } = {
        select: jest.fn(),
        where: jest.fn(),
        execute: jest.fn(),
      };
      chain.select.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      chain.execute.mockImplementation(async () => {
        if (table === 'public.rules') {
          return fakeRules.map((r) => ({
            id: r.id,
            org_id: r.orgId,
            creator_id: r.creatorId,
            name: r.name,
            alarm_status: r.alarmStatus,
            status_if_unexpired: r.statusIfUnexpired,
          }));
        }
        if (table === 'public.orgs') {
          return orgRows;
        }
        return [];
      });
      return chain;
    }),
    updateTable: jest.fn(() => ({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          execute: updateExecute,
        }),
      }),
    })),
    __updateExecute: updateExecute,
  };
  return mockDb;
}

describe('Detect Rule Anomalies', () => {
  describe('worker', () => {
    let deleteMockData: () => Promise<void>,
      mockDummyRules: Array<{
        id: string;
        orgId: string;
        creatorId: string;
        name: string;
        alarmStatus: RuleAlarmStatus;
        statusIfUnexpired: string;
      }>,
      mockKysely: ReturnType<typeof makeMockKyselyForRules>,
      mockGetCurrentPeriodRuleAlarmStatuses: GetCurrentPeriodRuleAlarmStatuses,
      mockNotificationsService: Mocked<
        PublicInterface<NotificationsService>,
        'createNotifications'
      >;

    beforeAll(async () => {
      /* eslint-disable functional/immutable-data */
      const {
        Sequelize: models,
        ModerationConfigService,
        ApiKeyService,
        KyselyPg,
      } = (await getBottle()).container;

      // make some fake rules (w/ stable ids so we can match them in a snapshot)
      // in different initial alarm statuses, to test all 9 combinations [i.e.,
      // starting and ending at one of (OK, ALARM, or INSUFFICENT_DATA), where
      // the start and end states can be the same].
      const { org, cleanup: orgCleanup } = await createOrg({
        KyselyPg,
        ModerationConfigService,
        ApiKeyService,
      });
      const { org: org2, cleanup: org2Cleanup } = await createOrg(
        {
          KyselyPg,
          ModerationConfigService,
          ApiKeyService,
        },
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

      mockDummyRules = fakeRules.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        creatorId: r.creatorId,
        name: r.name,
        alarmStatus: r.alarmStatus,
        statusIfUnexpired: r.statusIfUnexpired,
      }));

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

      mockNotificationsService = {
        createNotifications: jest.fn(),
        getNotificationsForUser: jest.fn(),
      } as unknown as Mocked<
        PublicInterface<NotificationsService>,
        'createNotifications'
      >;

      mockKysely = makeMockKyselyForRules(mockDummyRules, [
        { id: org.id, on_call_alert_email: null },
        { id: org2.id, on_call_alert_email: 'test@gmail.com' },
      ]);

      deleteMockData = async () => {
        await Promise.all(fakeRules.map(async (it) => it.destroy()));
        await Promise.all([ruleOwner.destroy(), ruleOwner2.destroy()]);
        await orgCleanup();
        await org2Cleanup();
        await models.sequelize.close();
      };
      /* eslint-enable functional/immutable-data */
    });

    afterAll(async () => {
      return deleteMockData();
    });

    test('should generate the proper notifications + update rules', async () => {
      const worker = DetectRulePassRateAnomaliesJob(
        mockKysely as unknown as Dependencies['KyselyPg'],
        mockNotificationsService,
        mockGetCurrentPeriodRuleAlarmStatuses,
        jest.fn<() => Promise<void>>(),
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

      await mockGetCurrentPeriodRuleAlarmStatuses();
      const expectedUpdates = mockDummyRules.filter(
        (_rule, i) => ![0, 4, 8].includes(i),
      ).length;
      expect(mockKysely.updateTable).toHaveBeenCalledTimes(expectedUpdates);
    });
  });
});
