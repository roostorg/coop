import { type ItemIdentifier } from '@roostorg/coop-types';
import _Ajv from 'ajv-draft-04';
import { sql, type Kysely } from 'kysely';

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
import {
  retryNcmecSubmission,
  type RetryNcmecSubmissionResult,
} from './retryNcmecSubmission.js';

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

  /** Org-scoped retry for a previously-failed NCMEC submission. See
   * `retryNcmecSubmission.ts` for the orchestration; this is a thin wrapper
   * that supplies dependencies. */
  async retrySubmission(opts: {
    orgId: string;
    decisionId: string;
    requestingReviewerId: string;
  }): Promise<RetryNcmecSubmissionResult> {
    return retryNcmecSubmission(
      {
        manualReviewToolService: this.manualReviewToolService,
        ncmecReporting: this.ncmecReporting,
        getItemTypeEventuallyConsistent: this.getItemTypeEventuallyConsistent,
      },
      opts,
    );
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
    const settings = await this.getNcmecOrgSettings(input.orgId);
    const targetQueueId = settings?.defaultNcmecQueueId ?? undefined;
    return this.ncmecEnqueueToMrt.enqueueForHumanReviewIfApplicable({
      ...input,
      targetQueueId,
    });
  }

  async getNCMECActionsToRunAndPolicies(orgId: string) {
    return this.ncmecReporting.getNCMECActionsToRunAndPolicies(orgId);
  }

  async getNcmecErrorsForJobIds(jobIds: string[]) {
    if (jobIds.length === 0) {
      return [];
    }
    return this.pqQueryReadReplica
      .selectFrom('ncmec_reporting.ncmec_reports_errors')
      .select([
        'job_id',
        'retry_count',
        'user_id',
        'user_type_id',
        'status',
        'last_error',
      ])
      .where('job_id', 'in', jobIds)
      .execute();
  }

  /** Returns the `(user_id, user_item_type_id)` pairs that already have a
   * successful NCMEC submission for this org. Used to filter MRT decisions
   * down to "failed" submissions (those without a matching report row). */
  async getSuccessfulSubmissionKeysForOrg(orgId: string) {
    return this.pqQueryReadReplica
      .selectFrom('ncmec_reporting.ncmec_reports')
      .select(['user_id as userId', 'user_item_type_id as userItemTypeId'])
      .where('org_id', '=', orgId)
      .groupBy(['user_id', 'user_item_type_id'])
      .execute();
  }

  async insertOrUpdateNcmecReportError(opts: {
    jobId: string;
    userId: string;
    userTypeId: string;
    status: 'RETRYABLE_ERROR' | 'PERMANENT_ERROR';
    error: string;
  }) {
    // Atomic increment in `doUpdateSet` avoids the read-modify-write race
    // when two callers (e.g. background retry job + user-clicked Retry)
    // attempt to record an error for the same job_id concurrently.
    return this.pgQuery
      .insertInto('ncmec_reporting.ncmec_reports_errors')
      .values({
        job_id: opts.jobId,
        user_id: opts.userId,
        user_type_id: opts.userTypeId,
        status: opts.status,
        last_error: opts.error,
        retry_count: 1,
      })
      .onConflict((oc) =>
        oc.columns(['job_id']).doUpdateSet({
          retry_count: sql`ncmec_reporting.ncmec_reports_errors.retry_count + 1`,
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
        'default_ncmec_queue_id as defaultNcmecQueueId',
        'default_internet_detail_type as defaultInternetDetailType',
        'terms_of_service as termsOfService',
        'contact_person_email as contactPersonEmail',
        'contact_person_first_name as contactPersonFirstName',
        'contact_person_last_name as contactPersonLastName',
        'contact_person_phone as contactPersonPhone',
        'media_review_requirement as mediaReviewRequirement',
        'min_media_to_review as minMediaToReview',
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
    defaultNcmecQueueId: string | null;
    defaultInternetDetailType: string | null;
    termsOfService: string | null;
    contactPersonEmail: string | null;
    contactPersonFirstName: string | null;
    contactPersonLastName: string | null;
    contactPersonPhone: string | null;
    mediaReviewRequirement: 'ALL' | 'MINIMUM';
    minMediaToReview: number | null;
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
        default_ncmec_queue_id: params.defaultNcmecQueueId ?? null,
        default_internet_detail_type: params.defaultInternetDetailType ?? null,
        terms_of_service: params.termsOfService ?? null,
        contact_person_email: params.contactPersonEmail ?? null,
        contact_person_first_name: params.contactPersonFirstName ?? null,
        contact_person_last_name: params.contactPersonLastName ?? null,
        contact_person_phone: params.contactPersonPhone ?? null,
        media_review_requirement: params.mediaReviewRequirement,
        min_media_to_review: params.minMediaToReview ?? null,
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
          default_ncmec_queue_id: params.defaultNcmecQueueId ?? null,
          default_internet_detail_type:
            params.defaultInternetDetailType ?? null,
          terms_of_service: params.termsOfService ?? null,
          contact_person_email: params.contactPersonEmail ?? null,
          contact_person_first_name: params.contactPersonFirstName ?? null,
          contact_person_last_name: params.contactPersonLastName ?? null,
          contact_person_phone: params.contactPersonPhone ?? null,
          media_review_requirement: params.mediaReviewRequirement,
          min_media_to_review: params.minMediaToReview ?? null,
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
