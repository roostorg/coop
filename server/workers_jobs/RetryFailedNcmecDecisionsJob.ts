import _ from 'lodash';
import { v1 as uuidv1 } from 'uuid';

import { inject } from '../iocContainer/utils.js';
import {
  buildSubmitReportParamsFromDecision,
  LEGACY_FALLBACK_INCIDENT_TYPE,
  summarizeNcmecErrorForReviewer,
} from '../services/ncmecService/index.js';
import { toCorrelationId } from '../utils/correlationIds.js';
import { jsonStringify } from '../utils/encoding.js';
import { logErrorJson } from '../utils/logging.js';

export default inject(
  [
    'closeSharedResourcesForShutdown',
    'ManualReviewToolService',
    'NcmecService',
    'getItemTypeEventuallyConsistent',
    'ActionPublisher',
    'ModerationConfigService',
    'UserManagementService',
  ],
  (
    closeSharedResourcesForShutdown,
    manualReviewToolService,
    ncmecService,
    getItemTypeEventuallyConsistent,
    actionPublisher,
    moderationConfigService,
    userManagementService,
  ) => {
    const processDecisionRetry = async (
      row: Awaited<
        ReturnType<typeof manualReviewToolService.getNcmecDecisions>
      >[number],
      usersByOrg: {
        [key: string]: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          role: string;
        }[];
      },
    ) => {
      const itemType = await getItemTypeEventuallyConsistent({
        orgId: row.org_id,
        typeSelector: row.job_payload.payload.item.itemTypeIdentifier,
      });
      const data = row.job_payload.payload.item.data;
      const decisionComponents = row.decision_components;
      const orgId = row.org_id;
      const itemId = row.job_payload.payload.item.itemId;
      const itemTypeId = row.job_payload.payload.item.itemTypeIdentifier.id;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (usersByOrg[orgId] === undefined) {
        usersByOrg[orgId] = await userManagementService.getUsersForOrg(orgId);
      }
      const user = usersByOrg[orgId].find((it) => it.id === itemId);
      if (itemType === undefined || itemType.kind !== 'USER') {
        await ncmecService.insertOrUpdateNcmecReportError({
          jobId: row.job_payload.id,
          userId: itemId,
          userTypeId: itemTypeId,
          status: 'PERMANENT_ERROR',
          error: 'Unable to find item type or found item type is not user',
        });
        return;
      }
      const submitNcmecReportDecisionComponent = decisionComponents.find(
        (it) => it.type === 'SUBMIT_NCMEC_REPORT',
      );
      if (!row.reviewer_id) {
        await ncmecService.insertOrUpdateNcmecReportError({
          jobId: row.job_payload.id,
          userId: itemId,
          userTypeId: itemTypeId,
          status: 'PERMANENT_ERROR',
          error: 'No Reviewer ID in Decision log',
        });
        return;
      }
      if (submitNcmecReportDecisionComponent === undefined) {
        await ncmecService.insertOrUpdateNcmecReportError({
          jobId: row.job_payload.id,
          userId: itemId,
          userTypeId: itemTypeId,
          status: 'PERMANENT_ERROR',
          error: 'No Ncmec Report Component',
        });
        return;
      }
      if (row.job_payload.payload.kind !== 'NCMEC') {
        await ncmecService.insertOrUpdateNcmecReportError({
          jobId: row.job_payload.id,
          userId: itemId,
          userTypeId: itemTypeId,
          status: 'PERMANENT_ERROR',
          error: 'Invalid payload kind',
        });
        return;
      }
      // Tracks whether submitReport was invoked. submitReport persists its
      // own error rows when reportParams.jobId is set, so this worker only
      // records errors from the pre-submitReport phase (payload-build /
      // item-type resolution) to avoid double-incrementing retry_count.
      let submitReportInvoked = false;
      try {
        const reportParams = await buildSubmitReportParamsFromDecision({
          orgId,
          reviewerId: row.reviewer_id,
          reportedItemId: itemId,
          reportedItemTypeId: itemTypeId,
          reportedUserItemType: itemType,
          reportedUserData: data,
          allMediaItems: row.job_payload.payload.allMediaItems,
          decisionComponent: submitNcmecReportDecisionComponent,
          fallbackIncidentType: LEGACY_FALLBACK_INCIDENT_TYPE,
          jobId: row.job_payload.id,
          getItemTypeEventuallyConsistent,
        });
        submitReportInvoked = true;
        const reportResult = await ncmecService.submitReport(
          reportParams,
          false,
        );
        if (
          reportResult === 'UNSUPPORTED_ORG' ||
          reportResult === 'ALL_MEDIA_MISSING' ||
          reportResult === 'FAILURE'
        ) {
          return;
        }
        const actionAndPolicy =
          await ncmecService.getNCMECActionsToRunAndPolicies(orgId);
        if (
          actionAndPolicy != null &&
          actionAndPolicy.actionsToRunIds != null
        ) {
          const actions = await moderationConfigService.getActions({
            orgId,
            ids: actionAndPolicy.actionsToRunIds,
          });
          const policies = await moderationConfigService.getPolicies({
            orgId,
            readFromReplica: true,
          });
          const correlationId = toCorrelationId({
            type: 'mrt-decision',
            id: uuidv1(),
          });
          await actionPublisher.publishActions(
            actions.map((action) => ({
              action,
              matchingRules: undefined,
              ruleEnvironment: undefined,
              policies: policies.filter((policy) => {
                return actionAndPolicy.policyIds.includes(policy.id);
              }),
            })),
            {
              orgId,
              correlationId,
              targetItem: {
                itemId,
                itemType: {
                  id: itemType.id,
                  kind: itemType.kind,
                  name: itemType.name,
                },
              },
              actorId: row.reviewer_id,
              actorEmail: user?.email,
            },
          );
        }
      } catch (e: unknown) {
        if (submitReportInvoked) {
          // submitReport already wrote its own ncmec_reports_errors row.
          // Don't double-write here; let the next batch pick the row up via
          // its retry_count.
          return;
        }
        // Preserve the full detail in logs before we replace it
        // with the reviewer-friendly summary on the row.
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({
          error: e,
          message: jsonStringify({
            context: 'RetryFailedNcmecDecisionsJob.processDecisionRetry',
            jobId: row.job_payload.id,
            orgId,
            userId: itemId,
            userTypeId: itemTypeId,
          }),
        });
        await ncmecService.insertOrUpdateNcmecReportError({
          jobId: row.job_payload.id,
          userId: itemId,
          userTypeId: itemTypeId,
          status: 'RETRYABLE_ERROR',
          error: summarizeNcmecErrorForReviewer(e),
        });
      }
    };

    return {
      type: 'Job' as const,
      async run() {
        // One month before now
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        // End date is 1 hour before now, to give currently running decisions time to finish.
        const endDate = new Date(Date.now() - 60 * 60 * 1000);
        const ncmecDecisions = await manualReviewToolService.getNcmecDecisions({
          startDate,
          endDate,
        });
        const usersWithReports = await ncmecService.getUsersWithNcmecDecision({
          startDate,
        });
        if (ncmecDecisions.length === 0) {
          return;
        }
        const previousErrors = await ncmecService.getNcmecErrorsForJobIds(
          ncmecDecisions.map((it) => it.job_payload.id),
        );
        // Only retry decisions that don't have an applicable NCMEC decision and
        // decisions that don't already have a permanent error or a retry count of
        // 10 or more.
        const decisionsToRetry = ncmecDecisions.filter((it) => {
          return (
            !usersWithReports.some(
              (usersWithReports) =>
                usersWithReports.userId ===
                  it.job_payload.payload.item.itemId &&
                usersWithReports.userItemTypeId ===
                  it.job_payload.payload.item.itemTypeIdentifier.id &&
                usersWithReports.orgId === it.org_id,
            ) &&
            !previousErrors.some(
              (error) =>
                (error.job_id === it.job_payload.id &&
                  error.retry_count >= 10) ||
                (error.job_id === it.job_payload.id &&
                  error.status === 'PERMANENT_ERROR'),
            )
          );
        });
        const usersByOrg: {
          [key: string]: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            role: string;
          }[];
        } = {};
        // Run this sequentially to avoid overloading external systems
        for (const row of decisionsToRetry) {
          await processDecisionRetry(row, usersByOrg);
        }
      },
      async shutdown() {
        await closeSharedResourcesForShutdown();
      },
    };
  },
);
