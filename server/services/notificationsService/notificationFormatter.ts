import { type ReadonlyDeep } from 'type-fest';

import {
  NotificationType,
  type NotificationData,
} from './notificationsService.js';

/**
 * This is responsible for formatting/rendering notifications.
 *
 * For now, we only have anomaly detection notifications, so this is
 * very simple, but eventually we'll have many, and they'll each need
 * to parse their notif payloads differently, and render differently.
 */
export function formatNotification<T extends NotificationType>(
  notification: {
    data: ReadonlyDeep<NotificationData<T>>;
    type: ReadonlyDeep<T>;
  },
  url: string,
): { text: string } | { html: string } | { text: string; html: string } {
  const { data, type } = notification;
  // The default case here isn't using assertUnreachable because we want to be
  // defensive against db types that aren't known to TS.
  // eslint-disable-next-line switch-statement/require-appropriate-default-case
  switch (type) {
    case NotificationType.RulePassRateIncreaseAnomalyStart:
    case NotificationType.RulePassRateIncreaseAnomalyEnd:
      const {
        ruleId,
        ruleName,
        lastPeriodPassRate,
        secondToLastPeriodPassRate,
      } = data;

      const supportEmail = process.env.SUPPORT_EMAIL ?? 'support@example.com';
      const rateDetails =
        lastPeriodPassRate && secondToLastPeriodPassRate
          ? `In the past hour, the rule's pass rate went up${
              lastPeriodPassRate === 0
                ? ''
                : ` by <strong>${roundToThreeDecimals(
                    ((lastPeriodPassRate - secondToLastPeriodPassRate) /
                      lastPeriodPassRate) *
                      100.0,
                  )}%</strong> from the previous hour`
            }.
            <br/>
            <ul>
              <li>Pass rate in the last hour: <strong>${roundToThreeDecimals(
                lastPeriodPassRate * 100,
              )}%</strong></li>
              <li>Pass rate in the previous hour: <strong>${roundToThreeDecimals(
                secondToLastPeriodPassRate * 100,
              )}%</strong></li>
            </ul>`
          : null;

      return {
        html: `
          Hi there,
          <br/>
          <br/>
          The rule "<strong>${ruleName}</strong>" has started passing at an anomalous rate.
          <br/>
          <br/>
          ${rateDetails}
          <a href="${url}/dashboard/rules/proactive/info/${ruleId}">Click here to see the rule.</a>
          <br/>
          <br/>
          Sincerely,<br/>
          Coop Anomaly Detection Service<br/>
          <a href="mailto:${supportEmail}">${supportEmail}</a>
        `,
      };
    default:
      return {
        // eslint-disable-next-line no-restricted-syntax
        text: JSON.stringify(it, undefined, 2),
      };
  }
}

function roundToThreeDecimals(num: number) {
  return Math.round(num * 1000) / 1000;
}
