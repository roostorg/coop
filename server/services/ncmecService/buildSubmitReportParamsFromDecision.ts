import { makeDateString } from '@roostorg/coop-types';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  getFieldValueForRole,
  type NormalizedItemData,
} from '../itemProcessingService/index.js';
import { type UserItemType } from '../moderationConfigService/types/itemTypes.js';
import { type NCMECReportParams } from './ncmecReporting.js';

/** NCMEC's accepted "Incident Type Category" string used as a safe fallback
 * for legacy decisions whose DB row predates the `incidentType` column. */
export const LEGACY_FALLBACK_INCIDENT_TYPE =
  'Child Pornography (possession, manufacture, and distribution)';

/** Single source of truth for assembling the NCMEC `submitReport` payload
 * from a SUBMIT_NCMEC_REPORT decision component. Three call sites use this:
 *  - the IoC `onRecordDecision` flow (initial submission after a reviewer's
 *    decision)
 *  - the background `RetryFailedNcmecDecisionsJob`
 *  - the user-initiated `retryNcmecSubmission` GraphQL mutation
 *
 * Centralising the assembly here means each site behaves identically: the
 * reviewer's `escalateToHighPriority` and `additionalInfo` are preserved on
 * retry, and any future field added to the decision component is delivered to
 * NCMEC from every code path. */
export interface BuildSubmitReportParamsInput {
  orgId: string;
  reviewerId: string;
  /** ID of the reported user item (the subject of the report). */
  reportedItemId: string;
  /** Item-type ID of the reported user item. */
  reportedItemTypeId: string;
  /** USER-kind item type, already resolved by the caller. The caller is
   * responsible for ensuring `itemType.kind === 'USER'` (this helper does
   * not re-validate); narrowing the type here gives us proper typing for
   * the schema-field-role lookups below. */
  reportedUserItemType: Readonly<UserItemType>;
  /** Raw item data for the reported user (used to read displayName / icon). */
  reportedUserData: NormalizedItemData;
  /** All media items attached to the MRT job; used to resolve each reported
   * media id to its full content item (so we can read its createdAt etc). */
  allMediaItems: ReadonlyArray<{
    contentItem: {
      itemId: string;
      itemTypeIdentifier: { id: string; name?: string };
      data: NormalizedItemData;
    };
  }>;
  /** The SUBMIT_NCMEC_REPORT decision component. */
  decisionComponent: {
    reportedMedia: ReadonlyArray<{
      id: string;
      typeId: string;
      url: string;
      industryClassification: NCMECReportParams['media'][number]['industryClassification'];
      fileAnnotations: NCMECReportParams['media'][number]['fileAnnotations'];
    }>;
    reportedMessages: NCMECReportParams['threads'];
    /** Optional because legacy DB rows predate the `incidentType` column on
     * `decision_components`; callers should pass `fallbackIncidentType` when
     * they want a safe default. */
    incidentType?: string;
    escalateToHighPriority?: string;
    additionalInfo?: string;
  };
  /** Optional fallback used when `decisionComponent.incidentType` is empty
   * (legacy DB rows). Callers that don't want a fallback should omit this. */
  fallbackIncidentType?: string;
  /** MRT decision id; forwarded to `NCMECReportParams.jobId` for failure recording. */
  jobId?: string;
  getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'];
}

export async function buildSubmitReportParamsFromDecision(
  input: BuildSubmitReportParamsInput,
): Promise<NCMECReportParams> {
  const {
    orgId,
    reviewerId,
    reportedItemId,
    reportedItemTypeId,
    reportedUserItemType,
    reportedUserData,
    allMediaItems,
    decisionComponent,
    fallbackIncidentType,
    jobId,
    getItemTypeEventuallyConsistent,
  } = input;

  // Reading these via getFieldValueForRole keeps the helper agnostic to the
  // org's field-naming conventions; if the role isn't mapped, the field is
  // simply omitted from the report.
  const displayName = getFieldValueForRole(
    reportedUserItemType.schema,
    reportedUserItemType.schemaFieldRoles,
    'displayName',
    reportedUserData,
  );
  const profilePicUrl = getFieldValueForRole(
    reportedUserItemType.schema,
    reportedUserItemType.schemaFieldRoles,
    'profileIcon',
    reportedUserData,
  );
  const reportedUserIp = getFieldValueForRole(
    reportedUserItemType.schema,
    reportedUserItemType.schemaFieldRoles,
    'ipAddress',
    reportedUserData,
  );

  // Pre-index allMediaItems by (itemId, typeId) so the per-decisionComponent
  // lookup below is O(1) instead of O(n) for every reportedMedia entry. The
  // composite key avoids the same-id-different-type collision the lookup
  // already guards against.
  const mediaIndexKey = (itemId: string, typeId: string) =>
    `${itemId}\u0000${typeId}`;
  const mediaByIdAndType = new Map(
    allMediaItems.map((m) => [
      mediaIndexKey(m.contentItem.itemId, m.contentItem.itemTypeIdentifier.id),
      m,
    ]),
  );

  const media = await Promise.all(
    decisionComponent.reportedMedia.map(async (it) => {
      const reportedItem = mediaByIdAndType.get(
        mediaIndexKey(it.id, it.typeId),
      );
      if (reportedItem === undefined) {
        throw new Error('Unable to find reported media in job payload');
      }
      const mediaItemType = await getItemTypeEventuallyConsistent({
        orgId,
        typeSelector: reportedItem.contentItem.itemTypeIdentifier,
      });
      if (mediaItemType === undefined) {
        throw new Error('Unable to find item type for reported media');
      }
      const roleCreatedAt = getFieldValueForRole(
        mediaItemType.schema,
        mediaItemType.schemaFieldRoles,
        'createdAt',
        reportedItem.contentItem.data,
      );
      // Fall back to "now" when `createdAt` is missing or unparseable (e.g.
      // legacy rows that predate the field, or a `createdAt` schema field
      // role mapped to a non-date column). Better to send the retry
      // timestamp than to permanently block the report.
      const createdAt =
        roleCreatedAt !== undefined && !Number.isNaN(Date.parse(roleCreatedAt))
          ? roleCreatedAt
          : makeDateString(new Date().toISOString());
      if (createdAt === undefined) {
        throw new Error('No created at for reported media');
      }
      const mediaIp = getFieldValueForRole(
        mediaItemType.schema,
        mediaItemType.schemaFieldRoles,
        'ipAddress',
        reportedItem.contentItem.data,
      );
      return {
        id: it.id,
        typeId: it.typeId,
        url: it.url,
        createdAt,
        industryClassification: it.industryClassification,
        fileAnnotations: it.fileAnnotations,
        ...(mediaIp ? { ipAddress: mediaIp } : {}),
      };
    }),
  );

  const trimmedIncidentType = (decisionComponent.incidentType ?? '').trim();
  const incidentType =
    trimmedIncidentType !== ''
      ? trimmedIncidentType
      : (fallbackIncidentType ?? '');

  return {
    reportedUser: {
      id: reportedItemId,
      typeId: reportedItemTypeId,
      ...(displayName ? { displayName } : {}),
      ...(profilePicUrl ? { profilePicture: profilePicUrl.url } : {}),
      ...(reportedUserIp ? { ipAddress: reportedUserIp } : {}),
    },
    orgId,
    media,
    reviewerId,
    threads: decisionComponent.reportedMessages,
    incidentType,
    ...(decisionComponent.escalateToHighPriority != null &&
    decisionComponent.escalateToHighPriority.trim() !== ''
      ? {
          escalateToHighPriority:
            decisionComponent.escalateToHighPriority.trim(),
        }
      : {}),
    ...(decisionComponent.additionalInfo != null &&
    decisionComponent.additionalInfo.trim() !== ''
      ? { additionalInfo: decisionComponent.additionalInfo.trim() }
      : {}),
    ...(jobId !== undefined ? { jobId } : {}),
  };
}
