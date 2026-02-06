import { type ItemIdentifier } from '@roostorg/types';

import { type ActionExecutionCorrelationId } from '../../analyticsLoggers/ActionExecutionLogger.js';
import { type RuleExecutionCorrelationId } from '../../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { assertUnreachable } from '../../../utils/misc.js';
import { type Satisfies } from '../../../utils/typescript-types.js';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
} from '../../itemProcessingService/extractItemDataValues.js';
import { type ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type ItemType } from '../../moderationConfigService/index.js';
import { type PartialItemsService } from '../../partialItemsService/index.js';
import { type UserStatisticsService } from '../../userStatisticsService/userStatisticsService.js';
import {
  type AppealEnqueueSourceInfo,
  type ManualReviewAppealJobPayload,
  type ManualReviewJobEnqueueSource,
  type ManualReviewJobPayload,
  type MrtJobEnqueueSourceInfo,
  type NcmecContentItemSubmission,
  type OriginJobInfo,
  type PostActionsEnqueueSourceInfo,
  type ReportEnqueueSourceInfo,
  type ReportHistory,
  type RuleExecutionEnqueueSourceInfo,
} from '../manualReviewToolService.js';

export type NCMECManualReviewJobInput = {
  orgId: string;
  createdAt: Date;
  enqueueSource: 'REPORT' | 'RULE_EXECUTION' | 'POST_ACTIONS';
  enqueueSourceInfo:
    | ReportEnqueueSourceInfo
    | RuleExecutionEnqueueSourceInfo
    | PostActionsEnqueueSourceInfo;
  payload: ManualReviewJobPayloadInput & { kind: 'NCMEC' };
  correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
  policyIds: string[];
};

export type ManualReviewJobPayloadInput = Satisfies<
  | {
      kind: 'DEFAULT';
      item: ItemSubmissionWithTypeIdentifier;
      itemThreadContentItems?: ItemSubmissionWithTypeIdentifier[];
      additionalContentItems?: ItemSubmissionWithTypeIdentifier[];
      reportedItems?: ItemIdentifier[];
      reportedForReason?: string | null;
      reporterIdentifier?: ItemIdentifier | null;
      reportedForReasons?: Array<{
        reporterId?: ItemIdentifier;
        reason?: string;
      }>;
      reportHistory: ReportHistory;
    }
  | {
      kind: 'NCMEC';
      item: ItemSubmissionWithTypeIdentifier; // must be a user
      // Slightly misnamed - a list of the user's media that have been deemed urgent enough to show
      allMediaItems: NcmecContentItemSubmission[];
      reportHistory: ReportHistory;
    },
  { kind: string }
>;

export type ManualReviewAppealJobPayloadInput = {
  kind: 'APPEAL';
  item: ItemSubmissionWithTypeIdentifier;
  appealId: string;
  additionalContentItems?: ItemSubmissionWithTypeIdentifier[];
  actionsTaken: string[];
  actionedItem?: ItemIdentifier[];
  appealerIdentifier?: ItemIdentifier | null;
  appealReason?: string;
};

export type ManualReviewAppealJobInput = {
  orgId: string;
  correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
  createdAt: Date;
  enqueueSource: 'APPEAL';
  enqueueSourceInfo: AppealEnqueueSourceInfo;
  payload: ManualReviewAppealJobPayloadInput & { kind: 'APPEAL' };
  policyIds: string[];
};

export type ManualReviewJobInput = Satisfies<
  | {
      orgId: string;
      correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
      createdAt: Date;
      enqueueSource: 'REPORT';
      enqueueSourceInfo: ReportEnqueueSourceInfo;
      payload: ManualReviewJobPayloadInput & { kind: 'DEFAULT' };
      policyIds: string[];
    }
  | {
      orgId: string;
      correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
      createdAt: Date;
      enqueueSource: 'RULE_EXECUTION';
      enqueueSourceInfo: RuleExecutionEnqueueSourceInfo;
      payload: ManualReviewJobPayloadInput & { kind: 'DEFAULT' };
      policyIds: string[];
    }
  | {
      orgId: string;
      correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
      createdAt: Date;
      enqueueSource: 'POST_ACTIONS';
      enqueueSourceInfo: PostActionsEnqueueSourceInfo;
      payload: ManualReviewJobPayloadInput & { kind: 'DEFAULT' };
      policyIds: string[];
    }
  | NCMECManualReviewJobInput
  | {
      orgId: string;
      correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
      reenqueuedFrom: OriginJobInfo;
      createdAt: Date;
      enqueueSource: 'MRT_JOB';
      enqueueSourceInfo: MrtJobEnqueueSourceInfo;
      payload: ManualReviewJobPayloadInput;
      policyIds: string[];
    },
  {
    enqueueSource: ManualReviewJobEnqueueSource;
    createdAt: Date;
    orgId: string;
    correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
  }
>;

export default class JobEnrichment {
  constructor(
    private readonly partialItemsService: PartialItemsService,
    private readonly userStatisticsService: UserStatisticsService,
  ) {}

  async enrichJobPayload(
    input: ManualReviewJobInput,
    type: ItemType,
  ): Promise<ManualReviewJobPayload> {
    const isNcmecJob = input.payload.kind === 'NCMEC';
    if (isNcmecJob && !(type.kind === 'USER' || type.kind === 'CONTENT')) {
      throw new Error(
        'Only users and content (not threads) can be enqueued for NCMEC review',
      );
    }
    // Generic enrichment for all orgs
    const genericallyEnrichedPayload = await this.#genericEnrichJobPayload(
      input,
      type,
    );
    return this.#orgSpecificEnrichJobPayload(
      input.orgId,
      genericallyEnrichedPayload,
    );
  }
  async enrichAppealPayload(
    input: ManualReviewAppealJobInput,
  ): Promise<ManualReviewAppealJobPayload> {
    const commonPayload = {
      ...input.payload,
      appealReason: input.payload.appealReason ?? undefined,
      appealerIdentifier: input.payload.appealerIdentifier ?? undefined,
      policyIds: input.policyIds,
      enqueueSourceInfo: input.enqueueSourceInfo,
    };
    return commonPayload;
  }

  // eslint-disable-next-line complexity
  async #genericEnrichJobPayload(
    input: ManualReviewJobInput,
    type: ItemType,
  ): Promise<ManualReviewJobPayload> {
    if (input.payload.kind === 'NCMEC') {
      return {
        userScore: await this.userStatisticsService.getUserScore(input.orgId, {
          id: input.payload.item.itemId,
          typeId: input.payload.item.itemTypeIdentifier.id,
        }),
        ...input.payload,
        enqueueSourceInfo: input.enqueueSourceInfo,
      };
    }
    const commonPayload = {
      ...input.payload,
      reportedForReason: input.payload.reportedForReason ?? undefined,
      reporterIdentifier: input.payload.reporterIdentifier ?? undefined,
      policyIds: input.policyIds,
      enqueueSourceInfo: input.enqueueSourceInfo,
    };
    return (async () => {
      switch (type.kind) {
        case 'CONTENT':
        case 'USER':
          return {
            ...commonPayload,
            userScore: await (async () => {
              const userScoreItemIdentifier =
                type.kind === 'CONTENT'
                  ? getFieldValueForRole(
                      type.schema,
                      type.schemaFieldRoles,
                      'creatorId',
                      input.payload.item.data,
                    )
                  : {
                      id: input.payload.item.itemId,
                      typeId: input.payload.item.itemTypeIdentifier.id,
                    };

              return userScoreItemIdentifier
                ? this.userStatisticsService.getUserScore(
                    input.orgId,
                    userScoreItemIdentifier,
                  )
                : undefined;
            })(),
            additionalContentItems:
              'additionalContentItems' in input.payload &&
              input.payload.additionalContentItems
                ? input.payload.additionalContentItems
                : [],
            itemThreadContentItems:
              'itemThreadContentItems' in input.payload &&
              input.payload.itemThreadContentItems &&
              input.payload.itemThreadContentItems.length > 0
                ? input.payload.itemThreadContentItems
                : undefined,
            reportedForReasons:
              'reportedForReasons' in input.payload &&
              input.payload.reportedForReasons
                ? input.payload.reportedForReasons
                : [],
            reportHistory:
              'reportHistory' in input.payload
                ? input.payload.reportHistory
                : [],
          };
        case 'THREAD':
          return {
            ...commonPayload,
            userScore: undefined,
            itemThreadContentItems:
              'itemThreadContentItems' in input.payload &&
              input.payload.itemThreadContentItems &&
              input.payload.itemThreadContentItems.length > 0
                ? input.payload.itemThreadContentItems
                : undefined,
            reportedForReasons:
              'reportedForReasons' in input.payload &&
              input.payload.reportedForReasons
                ? input.payload.reportedForReasons
                : [],
            reportHistory:
              'reportHistory' in input.payload
                ? input.payload.reportHistory
                : [],
          };
        default:
          assertUnreachable(type);
      }
    })();
  }

  async #orgSpecificEnrichJobPayload(
    orgId: string,
    payload: ManualReviewJobPayload,
  ): Promise<ManualReviewJobPayload> {
    // Query the partial items endpoint if the severity score is
    // >= 5 and use its data to update the item
    const itemData = payload.item.data;
    const severityScore = getFieldValueOrValues<'NUMBER'>(itemData, {
      type: 'NUMBER',
      name: 'severity_score',
      required: false,
      container: null,
    })?.value;
    if (severityScore === undefined || severityScore < 5) {
      return payload;
    }
    const updatedItem = await this.partialItemsService.getPartialItem(orgId, {
      id: payload.item.itemId,
      typeId: payload.item.itemTypeIdentifier.id,
    });
    return {
      ...payload,
      item: {
        ...payload.item,
        // Merge the items, preferring data from the partial items endpoint
        data: {
          ...payload.item.data,
          ...(updatedItem !== undefined ? updatedItem.data : {}),
        },
      },
    };
  }
}