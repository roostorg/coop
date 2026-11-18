import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { type PrismaPgClient } from '../../storage/prisma/index.js';
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
import NcmecEnqueueToMrt from './ncmecEnqueueToMrt.js';
import NcmecReporting, { type NCMECReportParams } from './ncmecReporting.js';
import { type ValidatedNcmecTarget } from './resolveNcmecTargetUser.js';
import {
  retryNcmecSubmission,
  type RetryNcmecSubmissionResult,
} from './retryNcmecSubmission.js';

export class NcmecService {
  private readonly ncmecReporting: NcmecReporting;
  private readonly ncmecEnqueueToMrt: NcmecEnqueueToMrt;

  constructor(
    readonly prisma: PrismaPgClient,
    readonly prismaReadReplica: PrismaPgClient,
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
      prisma,
      prismaReadReplica,
      fetchHTTP,
      signingKeyPairService,
      tracer,
    );
    this.ncmecEnqueueToMrt = new NcmecEnqueueToMrt(
      partialItemsService,
      moderationConfigService,
      manualReviewToolService,
      itemInvestigationService,
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

  async getUserHasExistingNcmecReport(params: {
    orgId: string;
    userId: string;
    userItemTypeId: string;
  }) {
    return this.ncmecReporting.getUserHasExistingNcmeReport(params);
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
          validatedNcmecTarget?: ValidatedNcmecTarget;
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
    return this.prismaReadReplica.ncmec_reports_errors.findMany({
      select: {
        job_id: true,
        retry_count: true,
        user_id: true,
        user_type_id: true,
        status: true,
        last_error: true,
      },
      where: { job_id: { in: jobIds } },
    });
  }

  /** Returns the `(user_id, user_item_type_id)` pairs that already have a
   * successful NCMEC submission for this org. Used to filter MRT decisions
   * down to "failed" submissions (those without a matching report row). */
  async getSuccessfulSubmissionKeysForOrg(orgId: string) {
    const rows = await this.prismaReadReplica.ncmec_reports.groupBy({
      by: ['user_id', 'user_item_type_id'],
      where: { org_id: orgId },
    });
    return rows.map((row) => ({
      userId: row.user_id,
      userItemTypeId: row.user_item_type_id,
    }));
  }

  async insertOrUpdateNcmecReportError(opts: {
    jobId: string;
    userId: string;
    userTypeId: string;
    status: 'RETRYABLE_ERROR' | 'PERMANENT_ERROR';
    error: string;
  }) {
    // Prisma runs this as a single INSERT ... ON CONFLICT DO UPDATE (one
    // model, one unique field in `where`, same value in `create`), so the
    // atomic increment avoids the read-modify-write race when two callers
    // (e.g. background retry job + user-clicked Retry) record an error for
    // the same job_id concurrently.
    await this.prisma.ncmec_reports_errors.upsert({
      where: { job_id: opts.jobId },
      create: {
        job_id: opts.jobId,
        user_id: opts.userId,
        user_type_id: opts.userTypeId,
        status: opts.status,
        last_error: opts.error,
        retry_count: 1,
      },
      update: {
        retry_count: { increment: 1 },
        last_error: opts.error,
        status: opts.status,
      },
    });
  }

  async getNcmecOrgSettings(orgId: string) {
    const result = await this.prisma.ncmec_org_settings.findUnique({
      select: {
        username: true,
        password: true,
        contact_email: true,
        more_info_url: true,
        company_template: true,
        legal_url: true,
        ncmec_preservation_endpoint: true,
        ncmec_additional_info_endpoint: true,
        default_ncmec_queue_id: true,
        default_internet_detail_type: true,
        terms_of_service: true,
        contact_person_email: true,
        contact_person_first_name: true,
        contact_person_last_name: true,
        contact_person_phone: true,
        media_review_requirement: true,
        min_media_to_review: true,
      },
      where: { org_id: orgId },
    });

    if (result === null) {
      return null;
    }
    return {
      username: result.username,
      password: result.password,
      contactEmail: result.contact_email,
      moreInfoUrl: result.more_info_url,
      companyTemplate: result.company_template,
      legalUrl: result.legal_url,
      ncmecPreservationEndpoint: result.ncmec_preservation_endpoint,
      ncmecAdditionalInfoEndpoint: result.ncmec_additional_info_endpoint,
      defaultNcmecQueueId: result.default_ncmec_queue_id,
      defaultInternetDetailType: result.default_internet_detail_type,
      termsOfService: result.terms_of_service,
      contactPersonEmail: result.contact_person_email,
      contactPersonFirstName: result.contact_person_first_name,
      contactPersonLastName: result.contact_person_last_name,
      contactPersonPhone: result.contact_person_phone,
      // varchar column in the schema; the app only ever writes these values.
      mediaReviewRequirement: result.media_review_requirement as
        'ALL' | 'MINIMUM',
      minMediaToReview: result.min_media_to_review,
    };
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
    const settings = {
      username: params.username,
      password: params.password,
      contact_email: params.contactEmail ?? null,
      more_info_url: params.moreInfoUrl ?? null,
      company_template: params.companyTemplate ?? null,
      legal_url: params.legalUrl ?? null,
      ncmec_preservation_endpoint: params.ncmecPreservationEndpoint ?? null,
      ncmec_additional_info_endpoint:
        params.ncmecAdditionalInfoEndpoint ?? null,
      default_ncmec_queue_id: params.defaultNcmecQueueId ?? null,
      default_internet_detail_type: params.defaultInternetDetailType ?? null,
      terms_of_service: params.termsOfService ?? null,
      contact_person_email: params.contactPersonEmail ?? null,
      contact_person_first_name: params.contactPersonFirstName ?? null,
      contact_person_last_name: params.contactPersonLastName ?? null,
      contact_person_phone: params.contactPersonPhone ?? null,
      media_review_requirement: params.mediaReviewRequirement,
      min_media_to_review: params.minMediaToReview ?? null,
    };
    // `actions_to_run_upon_report_creation` and
    // `policies_applied_to_actions_run_on_report_creation` are left out of
    // `create` so they default to NULL: Prisma models Postgres arrays as
    // non-nullable lists and cannot write NULL to them.
    await this.prisma.ncmec_org_settings.upsert({
      where: { org_id: params.orgId },
      create: { org_id: params.orgId, ...settings },
      update: settings,
    });
  }
}

export default inject(
  [
    'PrismaPg',
    'PrismaPgReadReplica',
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
