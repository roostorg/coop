import type { ItemIdentifier } from '@roostorg/types';
import _Ajv from 'ajv-draft-04';
import { type Kysely } from 'kysely';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type ActionExecutionCorrelationId } from '../analyticsLoggers/ActionExecutionLogger.js';
import { type RuleExecutionCorrelationId } from '../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { type ItemSubmissionWithTypeIdentifier } from '../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  type ManualReviewJobEnqueueSource,
  type ManualReviewJobEnqueueSourceInfo,
  type MrtJobEnqueueSourceInfo,
  type OriginJobInfo,
  type PostActionsEnqueueSourceInfo,
  type ReportEnqueueSourceInfo,
  type RuleExecutionEnqueueSourceInfo,
} from '../manualReviewToolService/manualReviewToolService.js';
import { type NcmecReportingServicePg } from './dbTypes.js';
import NcmecEnqueueToMrt from './ncmecEnqueueToMrt.js';
import NcmecReporting, { type NCMECReportParams } from './ncmecReporting.js';

export const ncmecProdQueues = [
  '08d99d80-fda3-11ee-93c7-2de73bc8984f',
  '63d2e0d0-ea93-11ed-800c-990ec859ff6d',
  'c97f8120-f1e7-11ee-b69a-8b0608a5cb1c',
  '4e4d04a0-dcac-11ee-a507-bd7289da2601',
  '0d2811b0-21e2-11ef-b6ce-43fd0fde2b7f',
];

export class NcmecService {
  private readonly ncmecReporting: NcmecReporting;
  private readonly ncmecEnqueueToMrt: NcmecEnqueueToMrt;

  constructor(
    readonly pgQuery: Kysely<NcmecReportingServicePg>,
    readonly pqQueryReadReplica: Kysely<NcmecReportingServicePg>,
    readonly fetchHTTP: Dependencies['fetchHTTP'],
    readonly partialItemsService: Dependencies['PartialItemsService'],
    readonly moderationConfigService: Dependencies['ModerationConfigService'],
    readonly signingKeyPairService: Dependencies['SigningKeyPairService'],
    readonly manualReviewToolService: Dependencies['ManualReviewToolService'],
    readonly tracer: Dependencies['Tracer'],
    readonly itemInvestigationService: Dependencies['ItemInvestigationService'],
    readonly getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'],
  ) {
    this.ncmecReporting = new NcmecReporting(
      pgQuery,
      pqQueryReadReplica,
      fetchHTTP,
      signingKeyPairService,
      moderationConfigService,
      getItemTypeEventuallyConsistent,
      tracer,
    );
    this.ncmecEnqueueToMrt = new NcmecEnqueueToMrt(
      partialItemsService,
      moderationConfigService,
      manualReviewToolService,
      itemInvestigationService,
      fetchHTTP,
      signingKeyPairService,
      this.ncmecReporting,
    );
  }

  async submitReport(reportParams: NCMECReportParams, isTest: boolean) {
    return this.ncmecReporting.submitReport(reportParams, isTest);
  }

  async hasNCMECReportingEnabled(orgId: string) {
    return this.ncmecReporting.hasNCMECReportingEnabled(orgId);
  }

  async getNcmecReports(opts: { orgId: string; reviewerId: string }) {
    return this.ncmecReporting.getNcmecReports(opts);
  }

  async getUsersWithNcmecDecision(opts: { startDate: Date }) {
    return this.ncmecReporting.getUsersWithNcmecDecision(opts);
  }

  async getNcmecReportById(opts: { orgId: string; reportId: string }) {
    return this.ncmecReporting.getNcmecReportById(opts);
  }

  async getNcmecMessages(
    orgId: string,
    userId: ItemIdentifier,
    reportedMedia: readonly ItemIdentifier[],
  ) {
    return this.ncmecReporting.getNcmecMessages(orgId, userId, reportedMedia);
  }

  async enqueueForHumanReviewIfApplicable(
    input: {
      orgId: string;
      createdAt: Date;
      enqueueSource: ManualReviewJobEnqueueSource;
      enqueueSourceInfo: ManualReviewJobEnqueueSourceInfo;
      correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
      item: ItemSubmissionWithTypeIdentifier;
      reenqueuedFrom?: OriginJobInfo;
    } & (
      | {
          enqueueSource: 'REPORT';
          enqueueSourceInfo: ReportEnqueueSourceInfo;
          reenqueuedFrom?: undefined;
        }
      | {
          enqueueSource: 'MRT_JOB';
          enqueueSourceInfo: MrtJobEnqueueSourceInfo;
          reenqueuedFrom: OriginJobInfo;
        }
      | {
          enqueueSource: 'RULE_EXECUTION';
          enqueueSourceInfo: RuleExecutionEnqueueSourceInfo;
          reenqueuedFrom?: undefined;
        }
      | {
          enqueueSource: 'POST_ACTIONS';
          enqueueSourceInfo: PostActionsEnqueueSourceInfo;
          reenqueuedFrom?: undefined;
        }
    ),
  ) {
    return this.ncmecEnqueueToMrt.enqueueForHumanReviewIfApplicable(input);
  }

  async getNCMECActionsToRunAndPolicies(orgId: string) {
    return this.ncmecReporting.getNCMECActionsToRunAndPolicies(orgId);
  }

  async getNcmecErrorsForJobIds(jobIds: string[]) {
    return this.pqQueryReadReplica
      .selectFrom('ncmec_reporting.ncmec_reports_errors')
      .select(['job_id', 'retry_count', 'user_id', 'user_type_id', 'status'])
      .where('job_id', 'in', jobIds)
      .execute();
  }

  async insertOrUpdateNcmecReportError(opts: {
    jobId: string;
    userId: string;
    userTypeId: string;
    status: 'RETRYABLE_ERROR' | 'PERMANENT_ERROR';
    error: string;
  }) {
    const retryCountRow = await this.pqQueryReadReplica
      .selectFrom('ncmec_reporting.ncmec_reports_errors')
      .select('retry_count')
      .where('job_id', '=', opts.jobId)
      .executeTakeFirst();
    return this.pgQuery
      .insertInto('ncmec_reporting.ncmec_reports_errors')
      .values({
        job_id: opts.jobId,
        user_id: opts.userId,
        user_type_id: opts.userTypeId,
        status: opts.status,
        last_error: opts.error,
        retry_count: retryCountRow ? retryCountRow.retry_count + 1 : 1,
      })
      .onConflict((oc) =>
        oc.columns(['job_id']).doUpdateSet({
          retry_count: retryCountRow ? retryCountRow.retry_count + 1 : 1,
          last_error: opts.error,
          status: opts.status,
        }),
      )
      .execute();
  }

  async getNcmecOrgSettings(orgId: string) {
    const result = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .select([
        'username',
        'password',
        'contact_email as contactEmail',
        'more_info_url as moreInfoUrl',
        'company_template as companyTemplate',
        'legal_url as legalUrl',
        'ncmec_preservation_endpoint as ncmecPreservationEndpoint',
        'ncmec_additional_info_endpoint as ncmecAdditionalInfoEndpoint',
      ])
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    return result ?? null;
  }

  async updateNcmecOrgSettings(params: {
    orgId: string;
    username: string;
    password: string;
    contactEmail: string | null;
    moreInfoUrl: string | null;
    companyTemplate: string | null;
    legalUrl: string | null;
    ncmecPreservationEndpoint: string | null;
    ncmecAdditionalInfoEndpoint: string | null;
  }) {
    await this.pgQuery
      .insertInto('ncmec_reporting.ncmec_org_settings')
      .values({
        org_id: params.orgId,
        username: params.username,
        password: params.password,
        contact_email: params.contactEmail ?? undefined,
        more_info_url: params.moreInfoUrl ?? undefined,
        company_template: params.companyTemplate ?? undefined,
        legal_url: params.legalUrl ?? undefined,
        ncmec_preservation_endpoint:
          params.ncmecPreservationEndpoint ?? undefined,
        ncmec_additional_info_endpoint:
          params.ncmecAdditionalInfoEndpoint ?? undefined,
        actions_to_run_upon_report_creation: null,
        policies_applied_to_actions_run_on_report_creation: null,
      })
      .onConflict((oc) =>
        oc.column('org_id').doUpdateSet({
          username: params.username,
          password: params.password,
          contact_email: params.contactEmail ?? undefined,
          more_info_url: params.moreInfoUrl ?? undefined,
          company_template: params.companyTemplate ?? undefined,
          legal_url: params.legalUrl ?? undefined,
          ncmec_preservation_endpoint:
            params.ncmecPreservationEndpoint ?? undefined,
          ncmec_additional_info_endpoint:
            params.ncmecAdditionalInfoEndpoint ?? undefined,
        }),
      )
      .execute();
  }
}

export default inject(
  [
    'KyselyPg',
    'KyselyPgReadReplica',
    'fetchHTTP',
    'PartialItemsService',
    'ModerationConfigService',
    'SigningKeyPairService',
    'ManualReviewToolService',
    'Tracer',
    'ItemInvestigationService',
    'getItemTypeEventuallyConsistent',
  ],
  NcmecService,
);
