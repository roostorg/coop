import { type JsonObject } from 'type-fest';

import {
  type NcmecAdditionalFile,
  type NcmecMediaReport,
  type NcmecMessagesReport,
} from '../../../../services/ncmecService/index.js';
import {
  type NotificationData,
  type NotificationType,
} from '../../../../services/notificationsService/index.js';

/** `org_settings` appeal callback and partial-items request jsonb columns. */
export type OrgSettingsJsonObject = JsonObject;

export type NotificationTypeColumn = NotificationType;
export type NotificationDataColumn = NotificationData<NotificationType>;

// Element types: `.$type<T>()` on a `.array()` column types each element, so
// the column itself is `T[]`.
export type NcmecReportedMediaColumn = NcmecMediaReport;
export type NcmecAdditionalFilesColumn = NcmecAdditionalFile;
export type NcmecReportedMessagesColumn = NcmecMessagesReport;
