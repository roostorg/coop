import { type ColumnType } from 'kysely';

import {
  type NotificationData,
  type NotificationType,
} from './notificationsService.js';

export type NotificationsServicePg = {
  // NB: In pg, we don't store all recipients from creation (for now),
  // but we do store the user id.
  // TODO: move this table to a dedicated schema.
  notifications: {
    id: string;
    // NB: db does not enforce this beyond that it's a string,
    // but we wanna make sure our writes do.
    type: NotificationType;
    message: string;
    data: NotificationData<NotificationType>; // Ditto, db just checks this is json.
    readAt: Date | null;
    createdAt: ColumnType<Date, never, never>;
    userId: string;
  };
};
