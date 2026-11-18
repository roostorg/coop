import { eq, inArray, sql } from 'drizzle-orm';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
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
    private readonly db: CoopDb,
    private readonly dbReadReplica: CoopDb,
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
      db,
      dbReadReplica,
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
    const errors = schema.ncmecReportsErrors;
    return this.dbReadReplica
      .select({
        job_id: errors.jobId,
        retry_count: errors.retryCount,
        user_id: errors.userId,
        user_type_id: errors.userTypeId,
        status: errors.status,
        last_error: errors.lastError,
      })
      .from(errors)
      .where(inArray(errors.jobId, jobIds));
  }

  /** Returns the `(user_id, user_item_type_id)` pairs that already have a
   * successful NCMEC submission for this org. Used to filter MRT decisions
   * down to "failed" submissions (those without a matching report row). */
  async getSuccessfulSubmissionKeysForOrg(orgId: string) {
    const reports = schema.ncmecReports;
    return this.dbReadReplica
      .select({
        userId: reports.userId,
        userItemTypeId: reports.userItemTypeId,
      })
      .from(reports)
      .where(eq(reports.orgId, orgId))
      .groupBy(reports.userId, reports.userItemTypeId);
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
    const errors = schema.ncmecReportsErrors;
    return this.db
      .insert(errors)
      .values({
        jobId: opts.jobId,
        userId: opts.userId,
        userTypeId: opts.userTypeId,
        status: opts.status,
        lastError: opts.error,
        retryCount: 1,
      })
      .onConflictDoUpdate({
        target: errors.jobId,
        set: {
          retryCount: sql`${errors.retryCount} + 1`,
          lastError: opts.error,
          status: opts.status,
        },
      });
  }

  async getNcmecOrgSettings(orgId: string) {
    const settings = schema.ncmecOrgSettings;
    const result = (
      await this.db
        .select({
          username: settings.username,
          password: settings.password,
          contactEmail: settings.contactEmail,
          moreInfoUrl: settings.moreInfoUrl,
          companyTemplate: settings.companyTemplate,
          legalUrl: settings.legalUrl,
          ncmecPreservationEndpoint: settings.ncmecPreservationEndpoint,
          ncmecAdditionalInfoEndpoint: settings.ncmecAdditionalInfoEndpoint,
          defaultNcmecQueueId: settings.defaultNcmecQueueId,
          defaultInternetDetailType: settings.defaultInternetDetailType,
          termsOfService: settings.termsOfService,
          contactPersonEmail: settings.contactPersonEmail,
          contactPersonFirstName: settings.contactPersonFirstName,
          contactPersonLastName: settings.contactPersonLastName,
          contactPersonPhone: settings.contactPersonPhone,
          mediaReviewRequirement: settings.mediaReviewRequirement,
          minMediaToReview: settings.minMediaToReview,
        })
        .from(settings)
        .where(eq(settings.orgId, orgId))
        .limit(1)
    ).at(0);

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
    const fields = {
      username: params.username,
      password: params.password,
      contactEmail: params.contactEmail ?? null,
      moreInfoUrl: params.moreInfoUrl ?? null,
      companyTemplate: params.companyTemplate ?? null,
      legalUrl: params.legalUrl ?? null,
      ncmecPreservationEndpoint: params.ncmecPreservationEndpoint ?? null,
      ncmecAdditionalInfoEndpoint: params.ncmecAdditionalInfoEndpoint ?? null,
      defaultNcmecQueueId: params.defaultNcmecQueueId ?? null,
      defaultInternetDetailType: params.defaultInternetDetailType ?? null,
      termsOfService: params.termsOfService ?? null,
      contactPersonEmail: params.contactPersonEmail ?? null,
      contactPersonFirstName: params.contactPersonFirstName ?? null,
      contactPersonLastName: params.contactPersonLastName ?? null,
      contactPersonPhone: params.contactPersonPhone ?? null,
      mediaReviewRequirement: params.mediaReviewRequirement,
      minMediaToReview: params.minMediaToReview ?? null,
    };
    await this.db
      .insert(schema.ncmecOrgSettings)
      .values({
        orgId: params.orgId,
        ...fields,
        actionsToRunUponReportCreation: null,
        policiesAppliedToActionsRunOnReportCreation: null,
      })
      .onConflictDoUpdate({
        target: schema.ncmecOrgSettings.orgId,
        set: fields,
      });
  }
}

export default inject(
  [
    'DrizzlePg',
    'DrizzlePgReadReplica',
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
