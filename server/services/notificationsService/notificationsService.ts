import { type Exception } from '@opentelemetry/api';
import { type Kysely } from 'kysely';
import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';
import { uid } from 'uid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type NonEmptyArray } from '../../utils/typescript-types.js';
import { CoopEmailAddress } from '../sendEmailService/sendEmailService.js';
import { type NotificationsServicePg } from './dbTypes.js';
import { formatNotification } from './notificationFormatter.js';

const { omit } = _;

export enum NotificationType {
  RulePassRateIncreaseAnomalyStart = 'RULE_PASS_RATE_INCREASE_ANOMALY_START',
  RulePassRateIncreaseAnomalyEnd = 'RULE_PASS_RATE_INCREASE_ANOMALY_END',
}

type RuleAnomalyData = {
  ruleId: string;
  // We include the ruleName for simplicity so we don't have to query the
  // `rules` table, which shouldn't need to be accessed from the Notifications
  // Service.
  ruleName: string;
  lastPeriodPassRate: number | undefined;
  secondToLastPeriodPassRate: number | undefined;
};

export type NotificationData<T extends NotificationType> = {
  [NotificationType.RulePassRateIncreaseAnomalyStart]: RuleAnomalyData;
  [NotificationType.RulePassRateIncreaseAnomalyEnd]: RuleAnomalyData;
}[T];

// NB: notifications are stored in postgres, but we intentionally don't make a
// sequelize model, as they should only be accessed through the notification
// service. My hunch is that these will quickly move out of (the API's)
// postgress anyway, as notifications tend to end up warranting their own
// microservice. We also store notifications in postgres with camel cased keys,
// since there's very little reason not to, and it saves us from needing a
// key conversion layer.
export type Notification<T extends NotificationType = NotificationType> = {
  id: string;
  type: T;
  message: string;
  data: NotificationData<T>;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * A recipient, as implied by the name, represents _who_ should see a
 * notification; it has nothing to do with which channels should the
 * notification be sent to.
 *
 * So, if a notification is targeted at one user, there should be one recipient
 * with `type: user_id`, and that's it, even if the notification should be sent
 * to that user's email, and show up in the UI, and trigger a push notification.
 *
 * The only reason "email_address" is a recipient type is because sometimes an
 * email address really does pick out a group of people, and only incidentally
 * specifies a delivery channel. Consider emails like oncall-sre@example.com
 */
type Recipient =
  | { type: 'user_id'; value: string }
  | { type: 'email_address'; value: string };

type CreateNotificationInput<T extends NotificationType> = Pick<
  Notification<T>,
  'type' | 'message' | 'data'
> & { recipients: Recipient[] };

class NotificationsService {
  constructor(
    private readonly query: Kysely<NotificationsServicePg>,
    private readonly sendEmail: Dependencies['sendEmail'],
    private readonly configService: Dependencies['ConfigService'],
    private readonly tracer: Dependencies['Tracer'],
  ) {}

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return (
      this.query
        .selectFrom('notifications')
        // Don't select userId since it isn't technically part of the
        // Notification type and we don't want callers to depend on it.
        .select(['id', 'type', 'message', 'data', 'readAt', 'createdAt'])
        .where('userId', '=', userId)
        .execute()
    );
  }

  async createNotifications<T extends NotificationType>(
    notifications: ReadonlyDeep<NonEmptyArray<CreateNotificationInput<T>>>,
  ) {
    // Eventually, users might have notification preferences, which we'd
    // incorporate here to filter who gets which notifications/on what channels,
    // by notification type.
    const toUserNotifications = notifications.flatMap((notification) =>
      notification.recipients
        .filter((it) => it.type === 'user_id')
        .map((recipient) => ({
          id: uid(),
          userId: recipient.value,
          ...omit(notification, ['recipients']),
        })),
    );

    const emailMessages = notifications
      .flatMap((notification) =>
        notification.recipients
          .filter((recipient) => recipient.type === 'email_address')
          .map((recipient) => ({
            ...notification,
            emailAddress: recipient.value,
          })),
      )
      .map((it) => ({
        to: it.emailAddress,
        from: { name: 'Coop', email: CoopEmailAddress.NoReply },
        subject: it.message,
        ...formatNotification(it, this.configService.uiUrl),
      }));

    // Send emails on a best-effort basis, with no retry or logging if one email
    // gets lost. Ditto for writing the notifications. This is fine for now.
    await Promise.all([
      ...emailMessages.map(async (msg) => this.sendEmail(msg).catch(() => {})),
      this.query
        .insertInto('notifications')
        .values(toUserNotifications)
        .execute()
        .catch((e) => {
          const activeSpan = this.tracer.getActiveSpan();
          if (activeSpan?.isRecording()) {
            activeSpan.recordException(e as Exception);
          }
        }),
    ]);
  }
}

export default inject(
  ['KyselyPg', 'sendEmail', 'ConfigService', 'Tracer'],
  NotificationsService,
);
export { type NotificationsService };
