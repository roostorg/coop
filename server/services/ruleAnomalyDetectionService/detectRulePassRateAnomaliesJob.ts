import { eq, inArray } from 'drizzle-orm';
import lodash from 'lodash';

import { inject } from '../../iocContainer/utils.js';
import { schema } from '../../storage/postgres/drizzle.js';
import { type NonEmptyArray } from '../../utils/typescript-types.js';
import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import { NotificationType } from '../notificationsService/notificationsService.js';

const { capitalize, keyBy } = lodash;

export default inject(
  [
    'DrizzlePg',
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

      const { rules: rulesTable, orgs } = schema;
      const rules = await db
        .select({
          id: rulesTable.id,
          orgId: rulesTable.orgId,
          creatorId: rulesTable.creatorId,
          name: rulesTable.name,
          alarmStatus: rulesTable.alarmStatus,
          statusIfUnexpired: rulesTable.statusIfUnexpired,
        })
        .from(rulesTable)
        .where(inArray(rulesTable.id, ruleIds));

      const alarmStatusChangedRules = rules.filter(
        (rule) => rule.alarmStatus !== newAlarmStatusByRule[rule.id].status,
      );

      const changedRuleOrgIds = alarmStatusChangedRules.map((it) => it.orgId);
      let orgsForChangedRules: Record<
        string,
        { id: string; onCallAlertEmail: string | null }
      > = {};
      if (changedRuleOrgIds.length > 0) {
        const orgRows = await db
          .select({ id: orgs.id, onCallAlertEmail: orgs.onCallAlertEmail })
          .from(orgs)
          .where(inArray(orgs.id, [...new Set(changedRuleOrgIds)]));
        orgsForChangedRules = keyBy(orgRows, (r) => r.id);
      }

      const notifications = alarmStatusChangedRules
        .filter(
          (it) =>
            it.alarmStatus === RuleAlarmStatus.ALARM ||
            newAlarmStatusByRule[it.id].status === RuleAlarmStatus.ALARM,
        )
        .flatMap((rule) => {
          const ruleNowInAlarm =
            newAlarmStatusByRule[rule.id].status === RuleAlarmStatus.ALARM;

          // Use a "Partial" view to make the index access return the honest
          // "org row | undefined" so the runtime guard stays meaningful.
          const orgRow = (
            orgsForChangedRules as Partial<typeof orgsForChangedRules>
          )[rule.orgId];
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
                    String(rule.statusIfUnexpired),
                  )} Rule]`
                : `[Alarm Cleared - ${capitalize(
                    String(rule.statusIfUnexpired),
                  )} Rule]`
            } ${rule.name} has ${
              ruleNowInAlarm ? 'started' : 'stopped'
            } passing at an anomalous rate.`,
            recipients: [
              { type: 'user_id' as const, value: rule.creatorId },
              ...(orgRow.onCallAlertEmail
                ? [
                    {
                      type: 'email_address' as const,
                      value: orgRow.onCallAlertEmail,
                    },
                  ]
                : []),
            ],
          } as const;
        });

      const ruleUpdateTasks = alarmStatusChangedRules.map(async (rule) => {
        await db
          .update(rulesTable)
          .set({
            alarmStatus: newAlarmStatusByRule[rule.id].status,
            alarmStatusSetAt: now,
          })
          .where(eq(rulesTable.id, rule.id));
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
