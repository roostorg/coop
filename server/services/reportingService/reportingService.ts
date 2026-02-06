import { type ConsumerDirectives } from '../../lib/cache/index.js';
import { type ItemIdentifier } from '@roostorg/types';
import { type Kysely } from 'kysely';
import { match } from 'ts-pattern';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import {
  fromCorrelationId,
  type CorrelationId,
} from '../../utils/correlationIds.js';
import { YEAR_MS } from '../../utils/time.js';
import { type Bind1 } from '../../utils/typescript-types.js';
import {
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  type ItemSubmission,
} from '../itemProcessingService/index.js';
import { type ReportingServicePg } from './dbTypes.js';
import ReportingRuleEngine from './reportingRuleEngine.js';
import {
  buildSimplifiedHistoryQuery,
  getSimplifiedRuleHistory,
  type VersionedField,
} from './reportingRuleHistoryHelpers.js';
import ReportingRules, {
  type CreateReportingRuleInput,
  type UpdateReportingRuleInput,
} from './ReportingRules.js';
import { jsonStringify } from '../../utils/encoding.js';
import {
  type IReportingAnalyticsAdapter,
  type ReportingRulePassRateInput,
  type ReportingRulePassingContentSampleInput,
} from '../../plugins/warehouse/queries/IReportingAnalyticsAdapter.js';

export type ReporterKind = 'rule' | 'user';
export type Reporter =
  | { kind: 'rule'; id: string }
  | { kind: 'user'; typeId: string; id: string };

export type Appealer = { typeId: string; id: string };

export type ReportSubmission = {
  requestId: CorrelationId<'submit-report'>;
  orgId: string;
  reporter: Reporter;
  reportedAt: Date;
  reportedForReason?: {
    policyId?: string;
    reason?: string;
  };
  reportedItem: ItemSubmission;
  reportedItemThread?: ItemSubmission[];
  reportedItemsInThread?: ItemIdentifier[];
  additionalItemSubmissions?: ItemSubmission[];
  skipJobEnqueue: boolean;
};

export type AppealSubmission = {
  requestId: CorrelationId<'submit-appeal'>;
  appealId: string;
  orgId: string;
  appealedBy: Appealer;
  appealedAt: Date;
  appealReason?: string;
  actionsTaken: string[];
  actionedItem: ItemSubmission;
  additionalItemSubmissions?: ItemSubmission[];
  skipJobEnqueue: boolean;
};

export type ReportingRuleExecutionSourceType = 'submit-report';

export type ReportingRuleExecutionCorrelationId =
  CorrelationId<ReportingRuleExecutionSourceType>;

function makeReportingService(
  dataWarehouseAnalytics: Dependencies['DataWarehouseAnalytics'],
  reportingAnalyticsAdapter: IReportingAnalyticsAdapter,
  pgQuery: Kysely<ReportingServicePg>,
  ruleEvaluator: Dependencies['RuleEvaluator'],
  reportingRuleExecutionLogger: Dependencies['ReportingRuleExecutionLogger'],
  actionPublisher: Dependencies['ActionPublisher'],
  getActionsByIdEventuallyConsistent: Dependencies['getActionsByIdEventuallyConsistent'],
  getPoliciesByIdEventuallyConsistent: Dependencies['getPoliciesByIdEventuallyConsistent'],
  tracer: Dependencies['Tracer'],
) {
  const reportingRules = new ReportingRules(pgQuery);
  const reportingRuleEngine = new ReportingRuleEngine(
    ruleEvaluator,
    reportingRuleExecutionLogger,
    actionPublisher,
    getActionsByIdEventuallyConsistent,
    getPoliciesByIdEventuallyConsistent,
    tracer,
    reportingRules,
  );

  return {
    async submitReport(submission: ReportSubmission): Promise<void> {
      const {
        requestId,
        orgId,
        reportedItem,
        reporter,
        reportedForReason,
        reportedItemThread,
        reportedItemsInThread,
        additionalItemSubmissions,
        skipJobEnqueue,
      } = submission;

      const reportRow = {
        ts: new Date(),
        org_id: orgId,
        request_id: fromCorrelationId(requestId),
        reporter_kind: reporter.kind,
        reported_at: submission.reportedAt,
        reported_item_id: reportedItem.itemId,
        reported_item_data: reportedItem.data,
        reported_item_type_id: reportedItem.itemType.id,
        reported_item_type_kind: reportedItem.itemType.kind,
        // nb: this is intentionally logged as a string not json, because it
        // contains JSON nulls, which are not snowflake safe.
        reported_item_type_schema: reportedItem.itemType.schema,
        reported_item_type_schema_variant:
          reportedItem.itemType.schemaVariant,
        reported_item_type_version: reportedItem.itemType.version,
        reported_item_type_schema_field_roles:
          reportedItem.itemType.schemaFieldRoles,
        ...(reporter.kind === 'user'
          ? {
              reporter_user_id: reporter.id,
              reporter_user_item_type_id: reporter.typeId,
            }
          : {}),
        ...(reportedItemThread
          ? {
              reported_item_thread: reportedItemThread.map((it) =>
                itemSubmissionToLegacyReportItem(it),
              ),
            }
          : {}),
        ...(reportedItemsInThread
          ? {
              reported_items_in_thread: reportedItemsInThread,
            }
          : {}),
        ...(additionalItemSubmissions
          ? {
              additional_items: additionalItemSubmissions.map((it) =>
                itemSubmissionToLegacyReportItem(it),
              ),
            }
          : {}),
        ...(reportedForReason?.policyId
          ? { policy_id: reportedForReason.policyId }
          : {}),
        ...(reportedForReason?.reason
          ? { reported_for_reason: reportedForReason.reason }
          : {}),
        skip_job_enqueue: skipJobEnqueue,
      } satisfies Record<string, unknown>;

      try {
        await dataWarehouseAnalytics.bulkWrite(
          'REPORTING_SERVICE.REPORTS',
          [reportRow],
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          '[ReportingService] Failed to write REPORTING_SERVICE.REPORTS row',
          {
            orgId,
            requestId: fromCorrelationId(requestId),
            error: error instanceof Error ? error.message : error,
            row: jsonStringify(reportRow),
          },
        );
        throw error;
      }
    },

    async submitAppeal(submission: AppealSubmission): Promise<void> {
      const {
        appealId,
        requestId,
        orgId,
        actionedItem,
        appealedBy,
        appealReason,
        actionsTaken,
        additionalItemSubmissions,
        skipJobEnqueue,
      } = submission;

      const appealRow = {
        ts: new Date(),
        org_id: orgId,
        request_id: fromCorrelationId(requestId),
        appeal_id: appealId,
        appealed_at: submission.appealedAt,
        appeal_reason: appealReason,
        actions_taken: actionsTaken,
        actioned_item_id: actionedItem.itemId,
        actioned_item_data: actionedItem.data,
        actioned_item_type_id: actionedItem.itemType.id,
        actioned_item_type_kind: actionedItem.itemType.kind,
        // nb: this is intentionally logged as a string not json, because it
        // contains JSON nulls, which are not snowflake safe.
        actioned_item_type_schema: actionedItem.itemType.schema,
        actioned_item_type_schema_variant:
          actionedItem.itemType.schemaVariant,
        actioned_item_type_version: actionedItem.itemType.version,
        actioned_item_type_schema_field_roles:
          actionedItem.itemType.schemaFieldRoles,
        ...{
          appealed_by_user_id: appealedBy.id,
          appealed_by_user_item_type_id: appealedBy.typeId,
        },
        ...(additionalItemSubmissions
          ? {
              additional_items: additionalItemSubmissions.map((it) =>
                itemSubmissionToItemSubmissionWithTypeIdentifier(it),
              ),
            }
          : {}),
        skip_job_enqueue: skipJobEnqueue,
      } satisfies Record<string, unknown>;

      try {
        await dataWarehouseAnalytics.bulkWrite(
          'REPORTING_SERVICE.APPEALS',
          [appealRow],
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          '[ReportingService] Failed to write REPORTING_SERVICE.APPEALS row',
          {
            orgId,
            appealId,
            requestId: fromCorrelationId(requestId),
            error: error instanceof Error ? error.message : error,
            row: jsonStringify(appealRow),
          },
        );
        throw error;
      }
    },

    async getTotalIngestedReportsByDay(orgId: string) {
      return reportingAnalyticsAdapter.getTotalIngestedReportsByDay(orgId);
    },

    async getReportingRulePassRateData(opts: {
      orgId: string;
      ruleId: string;
      startDate?: Date;
    }) {
      const {
        orgId,
        ruleId,
        startDate = new Date(Date.now() - YEAR_MS),
      } = opts;
      const input: ReportingRulePassRateInput = {
        orgId,
        ruleId,
        startDate,
      };
      return reportingAnalyticsAdapter.getReportingRulePassRateData(input);
    },

    async getReportingRuleHistory<K extends VersionedField>(
      ...getHistoryArgs: Parameters<Bind1<typeof getSimplifiedRuleHistory<K>>>
    ) {
      return getSimplifiedRuleHistory<K>(
        async (...buildQueryArgs) =>
          buildSimplifiedHistoryQuery(pgQuery, ...buildQueryArgs).execute(),
        ...getHistoryArgs,
      );
    },

    async getReportingRulePassingContentSamples(opts: {
      orgId: string;
      ruleId: string;
      itemIds?: readonly string[];
      numSamples: number;
      source: 'latestVersion' | 'priorVersion';
    }) {
      const { orgId, ruleId, itemIds, numSamples, source } = opts;
      // We only wanna show samples generated by the rule's current + prior
      // conditionSet, as showing other samples will give a misleading impression
      // of the rule's behavior. The only way to do that is to use the rule history
      // service. Note that, even if we wanted to just use the rule's latest
      // version, we'd have to use the history service (rather than reading the
      // latest version from snowflake), b/c Snowflake is only eventually
      // consistent (i.e., after a rule update, it won't see the new version for
      // up to 5 minutes, so we'll show cleary outdated samples.)
      const history = await this.getReportingRuleHistory(
        ['conditionSet'],
        [ruleId],
      );

      // Selects executions for this rule, verifying that this is the right org.
      // We'll filter by rule version below.
      const { exactVersion: mostRecentVersion } = history.at(-1)!;
      const { exactVersion: priorVersion } = history.at(-2) ?? {};

      if (source === 'priorVersion' && !priorVersion) {
        return [];
      }

      const filter = match(source)
        .with('latestVersion', () => {
          const dateFilter = (() => {
            const mostRecentVersionDate = new Date(mostRecentVersion);
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return mostRecentVersionDate > oneWeekAgo
              ? mostRecentVersionDate
              : oneWeekAgo;
          })();

          return {
            type: 'latestVersion' as const,
            minVersion: mostRecentVersion,
            minDate: dateFilter,
          };
        })
        .with('priorVersion', () => ({
          type: 'priorVersion' as const,
          fromVersion: priorVersion!,
          toVersion: mostRecentVersion,
          fromDate: new Date(priorVersion!),
          toDate: new Date(mostRecentVersion),
        }))
        .exhaustive();

      const adapterInput: ReportingRulePassingContentSampleInput = {
        orgId,
        ruleId,
        itemIds,
        numSamples,
        filter,
      };

      return reportingAnalyticsAdapter.getReportingRulePassingContentSamples(
        adapterInput,
      );
    },

    async getReportingRules(opts: {
      orgId: string;
      directives?: ConsumerDirectives;
    }) {
      return reportingRules.getReportingRules(opts);
    },

    async createReportingRule(opts: CreateReportingRuleInput) {
      return reportingRules.createReportingRule(opts);
    },

    async updateReportingRule(opts: UpdateReportingRuleInput) {
      return reportingRules.updateReportingRule(opts);
    },

    async deleteReportingRule(opts: { orgId: string; id: string }) {
      return reportingRules.deleteReportingRule(opts);
    },

    async runEnabledRules(
      itemSubmission: ItemSubmission,
      executionsCorrelationId: ReportingRuleExecutionCorrelationId,
    ) {
      return reportingRuleEngine.runEnabledRules(
        itemSubmission,
        executionsCorrelationId,
      );
    },

    async getNumTimesReported(opts: { orgId: string; itemId: string }) {
      const { orgId, itemId } = opts;
      return reportingAnalyticsAdapter.getNumTimesReported(orgId, itemId);
    },
  };
}

export default inject(
  [
    'DataWarehouseAnalytics',
    'ReportingAnalyticsAdapter',
    'KyselyPg',
    'RuleEvaluator',
    'ReportingRuleExecutionLogger',
    'ActionPublisher',
    'getActionsByIdEventuallyConsistent',
    'getPoliciesByIdEventuallyConsistent',
    'Tracer',
  ],
  makeReportingService,
);
export type ReportingService = ReturnType<typeof makeReportingService>;

function itemSubmissionToLegacyReportItem(it: ItemSubmission) {
  return {
    id: it.itemId,
    data: it.data,
    submisssionId: it.submissionId,
    typeIdentifier: {
      id: it.itemType.id,
      version: it.itemType.version,
      schemaVariant: it.itemType.schemaVariant,
    },
  };
}
