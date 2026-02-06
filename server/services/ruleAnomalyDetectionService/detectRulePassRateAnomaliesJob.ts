import lodash from 'lodash';

import { inject } from '../../iocContainer/utils.js';
import { type NonEmptyArray } from '../../utils/typescript-types.js';
import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import { NotificationType } from '../notificationsService/notificationsService.js';

const { capitalize, keyBy } = lodash;

export default inject(
  [
    'RuleModel',
    'OrgModel',
    'NotificationsService',
    'getCurrentPeriodRuleAlarmStatuses',
    'closeSharedResourcesForShutdown',
  ],
  (
    Rule,
    Org,
    notificationsService,
    getCurrentPeriodRuleAlarmStatuses,
    sharedResourceShutdown,
  ) => ({
    type: 'Job' as const,
    async run() {
      const now = new Date();
      const newAlarmStatusByRule = await getCurrentPeriodRuleAlarmStatuses();

      // TODO: at some point, we might have to chunk this,
      // but we're very far from that right now. We also don't have to use a
      // transaction, since there's no risk of concurrent updates to rule.alarmStatus.
      const ruleIds = Object.keys(newAlarmStatusByRule);
      const rules = await Rule.findAll({ where: { id: ruleIds } });
      const alarmStatusChangedRules = rules.filter(
        (rule) => rule.alarmStatus !== newAlarmStatusByRule[rule.id].status,
      );

      const changedRuleOrgIds = alarmStatusChangedRules.map((it) => it.orgId);
      const orgsForChangedRules = changedRuleOrgIds.length
        ? keyBy(
            await Org.findAll({
              where: { id: [...new Set(changedRuleOrgIds)] },
            }),
            (it) => it.id,
          )
        : {};

      // Notify the creator of each rule, and the on call alert email (if any).
      const notifications = alarmStatusChangedRules
        .filter(
          // Only alert if we're coming into an ALARM, or going out of one.
          // If we transitioned (e.g.) from "OK" to "INSUFFICIENT_DATA", b/c a
          // rule's conditions got updated, we don't care about that. Similarly,
          // we don't care about INSUFFICIENT_DATA going to "OK".
          (it) =>
            it.alarmStatus === RuleAlarmStatus.ALARM ||
            newAlarmStatusByRule[it.id].status === RuleAlarmStatus.ALARM,
        )
        .map((rule) => {
          const ruleNowInAlarm =
            newAlarmStatusByRule[rule.id].status === RuleAlarmStatus.ALARM;

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
                    rule.statusIfUnexpired,
                  )} Rule]`
                : `[Alarm Cleared - ${capitalize(rule.statusIfUnexpired)} Rule]`
            } ${rule.name} has ${
              ruleNowInAlarm ? 'started' : 'stopped'
            } passing at an anomalous rate.`,
            recipients: [
              { type: 'user_id', value: rule.creatorId },
              ...(orgsForChangedRules[rule.orgId].onCallAlertEmail
                ? [
                    {
                      type: 'email_address' as const,
                      value: orgsForChangedRules[rule.orgId].onCallAlertEmail!,
                    },
                  ]
                : []),
            ],
          } as const;
        });

      const ruleUpdateTasks = alarmStatusChangedRules.map(async (rule) => {
        rule.alarmStatus = newAlarmStatusByRule[rule.id].status;
        rule.alarmStatusSetAt = now;
        return rule.save();
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
