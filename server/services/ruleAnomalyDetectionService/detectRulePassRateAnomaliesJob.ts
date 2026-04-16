import lodash from 'lodash';

import { inject } from '../../iocContainer/utils.js';
import { type NonEmptyArray } from '../../utils/typescript-types.js';
import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import { NotificationType } from '../notificationsService/notificationsService.js';

const { capitalize, keyBy } = lodash;

type OrgAlertRow = {
  id: string;
  on_call_alert_email: string | null;
};

export default inject(
  [
    'KyselyPg',
    'NotificationsService',
    'getCurrentPeriodRuleAlarmStatuses',
    'closeSharedResourcesForShutdown',
  ],
  (
    db,
    notificationsService,
    getCurrentPeriodRuleAlarmStatuses,
    sharedResourceShutdown,
  ) => ({
    type: 'Job' as const,
    async run() {
      const now = new Date();
      const newAlarmStatusByRule = await getCurrentPeriodRuleAlarmStatuses();

      const ruleIds = Object.keys(newAlarmStatusByRule);
      if (ruleIds.length === 0) {
        return;
      }

      const rules = await db
        .selectFrom('public.rules')
        .select([
          'id',
          'org_id',
          'creator_id',
          'name',
          'alarm_status',
          'status_if_unexpired',
        ])
        .where('id', 'in', ruleIds)
        .execute();

      const alarmStatusChangedRules = rules.filter(
        (rule) => rule.alarm_status !== newAlarmStatusByRule[rule.id].status,
      );

      const changedRuleOrgIds = alarmStatusChangedRules.map((it) => it.org_id);
      let orgsForChangedRules: Record<string, OrgAlertRow> = {};
      if (changedRuleOrgIds.length > 0) {
        const orgRows = (await db
          .selectFrom('public.orgs')
          .select(['id', 'on_call_alert_email'])
          .where('id', 'in', [...new Set(changedRuleOrgIds)])
          .execute()) as OrgAlertRow[];
        orgsForChangedRules = keyBy(orgRows, (r) => r.id);
      }

      const notifications = alarmStatusChangedRules
        .filter(
          (it) =>
            it.alarm_status === RuleAlarmStatus.ALARM ||
            newAlarmStatusByRule[it.id].status === RuleAlarmStatus.ALARM,
        )
        .flatMap((rule) => {
          const ruleNowInAlarm =
            newAlarmStatusByRule[rule.id].status === RuleAlarmStatus.ALARM;

          const orgRow = orgsForChangedRules[rule.org_id];
          if (!orgRow) {
            return [];
          }

          return {
            type: ruleNowInAlarm
              ? NotificationType.RulePassRateIncreaseAnomalyStart
              : NotificationType.RulePassRateIncreaseAnomalyEnd,
            data: {
              ruleId: rule.id,
              ruleName: rule.name,
              lastPeriodPassRate:
                newAlarmStatusByRule[rule.id].meta.lastPeriodPassRate,
              secondToLastPeriodPassRate:
                newAlarmStatusByRule[rule.id].meta.secondToLastPeriodPassRate,
            },
            message: `${
              ruleNowInAlarm
                ? `[Alarm Triggered - ${capitalize(
                    String(rule.status_if_unexpired),
                  )} Rule]`
                : `[Alarm Cleared - ${capitalize(
                    String(rule.status_if_unexpired),
                  )} Rule]`
            } ${rule.name} has ${
              ruleNowInAlarm ? 'started' : 'stopped'
            } passing at an anomalous rate.`,
            recipients: [
              { type: 'user_id' as const, value: rule.creator_id },
              ...(orgRow.on_call_alert_email
                ? [
                    {
                      type: 'email_address' as const,
                      value: orgRow.on_call_alert_email,
                    },
                  ]
                : []),
            ],
          } as const;
        });

      const ruleUpdateTasks = alarmStatusChangedRules.map(async (rule) => {
        await db
          .updateTable('public.rules')
          .set({
            alarm_status: newAlarmStatusByRule[rule.id].status,
            alarm_status_set_at: now,
          })
          .where('id', '=', rule.id)
          .execute();
      });

      await Promise.all([
        notifications.length &&
          notificationsService.createNotifications(
            notifications as NonEmptyArray<(typeof notifications)[number]>,
          ),
        ...ruleUpdateTasks,
      ]);
    },
    async shutdown() {
      await sharedResourceShutdown();
    },
  }),
);
