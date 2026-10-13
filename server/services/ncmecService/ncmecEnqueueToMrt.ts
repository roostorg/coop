import {
  getScalarType,
  isMediaType,
  type ItemIdentifier,
} from '@roostorg/coop-types';

import { type Dependencies } from '../../iocContainer/index.js';
import { asyncIterableToArray } from '../../utils/collections.js';
import { jsonStringify } from '../../utils/encoding.js';
import {
  __throw,
  assertUnreachable,
  safePick,
  withRetries,
} from '../../utils/misc.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import { type ActionExecutionCorrelationId } from '../analyticsLoggers/ActionExecutionLogger.js';
import { type RuleExecutionCorrelationId } from '../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB } from '../itemInvestigationService/index.js';
import { getValuesFromFields } from '../itemProcessingService/extractItemDataValues.js';
import {
  type ItemSubmission,
  type NormalizedItemData,
} from '../itemProcessingService/index.js';
import {
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  itemSubmissionWithTypeIdentifierToItemSubmission,
  type ItemSubmissionWithTypeIdentifier,
} from '../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  type MrtJobEnqueueSourceInfo,
  type NcmecContentItemSubmission,
  type OriginJobInfo,
  type PostActionsEnqueueSourceInfo,
  type ReportEnqueueSourceInfo,
  type RuleExecutionEnqueueSourceInfo,
} from '../manualReviewToolService/manualReviewToolService.js';
import { type ItemType } from '../moderationConfigService/types/itemTypes.js';
import type NcmecReporting from './ncmecReporting.js';
import {
  resolveNcmecTargetUser,
  type ValidatedNcmecTarget,
} from './resolveNcmecTargetUser.js';

export default class NcmecEnqueueToMrt {
  constructor(
    private partialItemsService: Dependencies['PartialItemsService'],
    private moderationConfigService: Dependencies['ModerationConfigService'],
    private manualReviewToolService: Dependencies['ManualReviewToolService'],
    private itemInvestigationService: Dependencies['ItemInvestigationService'],
    readonly fetchHTTP: Dependencies['fetchHTTP'],
    readonly signingKeyPairService: Dependencies['SigningKeyPairService'],
    private ncmecReporting: NcmecReporting,
  ) {}

  async enqueueForHumanReviewIfApplicable(
    input: {
      orgId: string;
      createdAt: Date;
      item: ItemSubmissionWithTypeIdentifier;
      correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
      reenqueuedFrom?: OriginJobInfo;
      /** When set, NCMEC jobs are enqueued to this queue instead of the org default. */
      targetQueueId?: string;
    } & (
      | {
          enqueueSource: 'RULE_EXECUTION';
          enqueueSourceInfo: RuleExecutionEnqueueSourceInfo;
          reenqueuedFrom?: undefined;
        }
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
          enqueueSource: 'POST_ACTIONS';
          enqueueSourceInfo: PostActionsEnqueueSourceInfo;
          reenqueuedFrom?: undefined;
        }
    ),
  ) {
    const { orgId, createdAt } = input;

    const validatedNcmecTarget =
      input.enqueueSource === 'MRT_JOB'
        ? input.validatedNcmecTarget
        : undefined;
    const { reportedItemType, targetUser } =
      validatedNcmecTarget ?? (await this.#resolveNcmecTarget(input));

    const reportedItem = itemSubmissionWithTypeIdentifierToItemSubmission(
      input.item,
      reportedItemType,
    );

    const hasExistingReport =
      await this.ncmecReporting.getUserHasExistingNcmeReport({
        orgId,
        userId: targetUser.userIdentifier.id,
        userItemTypeId: targetUser.userItemType.id,
      });
    if (hasExistingReport) {
      return { status: 'SKIPPED' };
    }

    const userSubmissionResult =
      reportedItemType.kind === 'USER'
        ? { success: true as const, submission: reportedItem }
        : await this.#getFullUserSubmission({
            orgId,
            userIdentifier: targetUser.userIdentifier,
          });

    let userSubmission;
    if (userSubmissionResult.success) {
      userSubmission = userSubmissionResult.submission;
    } else {
      // Create a minimal user submission for manual review
      // even if we couldn't fetch full data
      userSubmission = this.#createMinimalUserSubmission({
        reportedItem,
        userIdentifier: targetUser.userIdentifier,
        userItemType: targetUser.userItemType,
      });
    }

    try {
      await withRetries(
        {
          maxRetries: 5,
          initialTimeMsBetweenRetries: 5,
          maxTimeMsBetweenRetries: 500,
          jitter: true,
        },
        async () => {
          const prePreservationResponse = await this.fetchHTTP({
            url: 'https://tas-infra-ml.net/data/coop/content/pre-preserve',
            method: 'post',
            handleResponseBody: 'discard',
            body: jsonStringify({
              userId: userSubmission.itemId,
              typeId: userSubmission.itemType.id,
            }),
            signWith: this.signingKeyPairService.sign.bind(
              this.signingKeyPairService,
              input.orgId,
            ),
          });
          if (prePreservationResponse.status !== 200) {
            throw new Error('Pre-preservation failed');
          }
        },
      )();
    } catch (e) {
      // Pre-preservation call failed (expected for test/local environments)
    }

    const reportedItemIdentifier =
      userSubmission.itemId !== input.item.itemId ||
      userSubmission.itemType.id !== input.item.itemTypeIdentifier.id
        ? {
            id: input.item.itemId,
            typeId: input.item.itemTypeIdentifier.id,
          }
        : undefined;

    const allMediaItems = await this.#getAllMediaForUser(
      input.orgId,
      userSubmission,
      reportedItemIdentifier,
      // Pass the originally reported item so we can use it as fallback
      input.item,
      reportedItemType,
    );

    // TODO: Write this to a data warehouse table and enqueue based off of a job instead
    await this.manualReviewToolService.enqueue(
      {
        orgId,
        createdAt,
        // TODO: Pass policies through NcmecService.eventuallyEnqueue into
        // the data warehouse and ultimately into here. Note that
        // NcmecService.eventuallyEnqueue is called inside submitReport, which has
        // access to the policies passed in with the report, and inside the
        // ActionPublisher, which has the policies that come along with the
        // action. This should be sufficient to pass the policies through to here.
        policyIds: [],
        payload: {
          kind: 'NCMEC',
          item: itemSubmissionToItemSubmissionWithTypeIdentifier(
            userSubmission,
          ),
          allMediaItems,
          ...(reportedItemIdentifier
            ? { reportedMessages: [reportedItemIdentifier] }
            : {}),
          reportHistory: [],
        },
        correlationId: input.correlationId,
        // Safe pick to preserve correlation
        ...safePick(input, [
          'enqueueSource',
          'enqueueSourceInfo',
          'reenqueuedFrom',
        ]),
      },
      input.targetQueueId,
    );
    return { status: 'ENQUEUED' };
  }

  async #resolveNcmecTarget(input: {
    orgId: string;
    item: ItemSubmissionWithTypeIdentifier;
  }): Promise<ValidatedNcmecTarget> {
    const reportedItemType = await this.moderationConfigService.getItemType({
      orgId: input.orgId,
      itemTypeSelector: input.item.itemTypeIdentifier,
    });

    if (reportedItemType === undefined) {
      throw new Error(
        `No item type for org ${input.orgId} with ID ${input.item.itemTypeIdentifier.id}`,
      );
    }

    const targetUser = await resolveNcmecTargetUser({
      orgId: input.orgId,
      itemId: input.item.itemId,
      itemType: reportedItemType,
      data: input.item.data,
      moderationConfigService: this.moderationConfigService,
    });

    if (!targetUser.success) {
      const reason = targetUser.reason;
      switch (reason) {
        case 'MISSING_CREATOR':
          throw new Error(
            'Cannot create NCMEC job: Content item does not have a creatorId field configured. ' +
              'Please add the creatorId role to the owner/creator field in your item type schema.',
          );
        case 'CREATOR_ITEM_TYPE_NOT_FOUND':
          throw new Error(
            `Cannot create NCMEC job: User item type ${targetUser.creatorIdentifier.typeId} not found.`,
          );
        case 'CREATOR_ITEM_TYPE_NOT_USER':
          throw new Error(
            `Cannot create NCMEC job: Item type ${targetUser.creatorIdentifier.typeId} is not a USER type (it's ${targetUser.creatorItemType.kind}).`,
          );
        case 'UNSUPPORTED_ITEM_TYPE':
          throw new Error(
            `Cannot create NCMEC job: Cannot determine user from item type ${reportedItemType.kind}. ` +
              'Please report the USER directly.',
          );
        default:
          return assertUnreachable(reason);
      }
    }

    return { reportedItemType, targetUser };
  }

  async #getMediaFromReportedItem(
    reportedItem: ItemSubmissionWithTypeIdentifier,
    reportedItemType: ItemType,
  ): Promise<NcmecContentItemSubmission[]> {
    const mediaFields = reportedItemType.schema.filter((field) =>
      isMediaType(getScalarType(field)),
    );

    if (mediaFields.length === 0) {
      return [];
    }

    const mediaValues = getValuesFromFields(reportedItem.data, mediaFields);

    if (mediaValues.length === 0) {
      return [];
    }

    return [
      {
        contentItem: reportedItem,
        isConfirmedCSAM: false,
        isReported: true,
      },
    ];
  }

  async #getAllMediaForUser(
    orgId: string,
    user: ItemSubmission,
    reportedItemIdentifier?: ItemIdentifier,
    reportedItemSubmission?: ItemSubmissionWithTypeIdentifier,
    reportedItemType?: ItemType,
  ): Promise<NcmecContentItemSubmission[]> {
    let itemsWithPossibleMedia: Array<{
      latestSubmission: ItemSubmission;
      priorSubmissions?: ItemSubmission[];
    }> = [];

    try {
      itemsWithPossibleMedia = await asyncIterableToArray(
        this.itemInvestigationService.getItemSubmissionsByCreator({
          orgId,
          itemCreatorIdentifier: { id: user.itemId, typeId: user.itemType.id },
          latestSubmissionsOnly: true,
          limit: RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB,
        }),
      );
    } catch (e) {
      // Database not available (e.g., local dev without Cassandra/Scylla)
      // Use the reported item directly
      if (reportedItemSubmission && reportedItemType) {
        return this.#getMediaFromReportedItem(
          reportedItemSubmission,
          reportedItemType,
        );
      }
    }

    let latestItems = itemsWithPossibleMedia.map((it) => it.latestSubmission);

    // Check if we need to add the reported item
    if (reportedItemIdentifier) {
      const hasReportedItem = latestItems.some(
        (it) =>
          it.itemId === reportedItemIdentifier.id &&
          it.itemType.id === reportedItemIdentifier.typeId,
      );

      if (!hasReportedItem) {
        if (reportedItemSubmission) {
          // Convert ItemSubmissionWithTypeIdentifier to ItemSubmission for consistency
          const itemType =
            reportedItemType ??
            (await this.moderationConfigService.getItemType({
              orgId,
              itemTypeSelector: { id: reportedItemIdentifier.typeId },
            }));

          if (itemType) {
            const reportedItemAsSubmission =
              itemSubmissionWithTypeIdentifierToItemSubmission(
                reportedItemSubmission,
                itemType,
              );
            latestItems = [reportedItemAsSubmission, ...latestItems];
          }
        } else {
          // Fall back to fetching from Item Investigation Service
          const reportedItemResult =
            await this.itemInvestigationService.getItemByIdentifier({
              orgId,
              itemIdentifier: reportedItemIdentifier,
              latestSubmissionOnly: true,
            });

          if (reportedItemResult?.latestSubmission) {
            latestItems = [reportedItemResult.latestSubmission, ...latestItems];
          }
        }
      }
    }

    const mediaFromContentItems = latestItems
      .filter((it) => {
        const mediaFields = it.itemType.schema.filter((field) =>
          isMediaType(getScalarType(field)),
        );
        const mediaValues = getValuesFromFields(it.data, mediaFields);
        return mediaValues.length > 0;
      })
      .map((it) => {
        const contentItem =
          itemSubmissionToItemSubmissionWithTypeIdentifier(it);
        return {
          contentItem,
          isConfirmedCSAM: false, // TODO: Move to configuration system
          isReported:
            reportedItemIdentifier !== undefined &&
            reportedItemIdentifier.id === it.itemId &&
            reportedItemIdentifier.typeId === it.itemType.id,
        };
      });
    const mediaFieldsOnUser = user.itemType.schema.filter((field) =>
      isMediaType(getScalarType(field)),
    );
    const mediaFromUserItem =
      mediaFieldsOnUser.length > 0 &&
      getValuesFromFields(user.data, mediaFieldsOnUser).length > 0
        ? [
            {
              contentItem:
                itemSubmissionToItemSubmissionWithTypeIdentifier(user),
              isConfirmedCSAM: false,
              isReported: false,
            },
          ]
        : [];

    return [...mediaFromContentItems, ...mediaFromUserItem];
  }

  // We need to fetch all of this org's item types that have any media fields
  // so we can filter out content_api_requests query down to those item types.
  // The only item types we care about are the ones that we can attribute to the
  // user being reviewed, and since threads don't have the concept of a `creator`,
  // we don't know how to find threads that this user "created" or "owns". So we
  // don't look for threads. We also don't look for users because we know what item
  // type this user corresponds to. So we just look for content types.
  async #getFullUserSubmission(opts: {
    orgId: string;
    userIdentifier: ItemIdentifier;
  }): Promise<
    { success: true; submission: ItemSubmission } | { success: false }
  > {
    const { orgId, userIdentifier } = opts;

    const userItem = await (async (): Promise<ItemSubmission | null> => {
      const fetchedUser = await this.#getItemSubmissionforItemId(
        orgId,
        userIdentifier,
      );

      // If partial items endpoint is not available, try fallbacks
      if (!fetchedUser) {
        // Fallback: Check item investigation service for previously submitted user data
        const investigatedUserResult =
          await this.itemInvestigationService.getItemByIdentifier({
            orgId,
            itemIdentifier: userIdentifier,
            latestSubmissionOnly: true,
          });

        if (investigatedUserResult?.latestSubmission) {
          // The adapter already returns ItemSubmission, not ItemSubmissionWithTypeIdentifier
          return investigatedUserResult.latestSubmission;
        }

        // User data not available from any source
        return null;
      }

      return fetchedUser;
    })();

    if (!userItem) {
      return { success: false };
    }

    return { success: true, submission: userItem };
  }

  #createMinimalUserSubmission(opts: {
    reportedItem: ItemSubmission;
    userIdentifier: ItemIdentifier;
    userItemType: ItemType & { kind: 'USER' };
  }): ItemSubmission {
    const { reportedItem, userIdentifier, userItemType } = opts;
    // The human reviewer will need to manually add more info.
    const minimalData: Record<string, unknown> = {
      userId: userIdentifier.id,
    };

    return instantiateOpaqueType<ItemSubmission>({
      itemId: userIdentifier.id,
      itemType: userItemType,
      data: minimalData as NormalizedItemData,
      submissionTime: new Date(),
      submissionId: reportedItem.submissionId,
      creator: undefined,
    });
  }

  async #getItemSubmissionforItemId(orgId: string, itemId: ItemIdentifier) {
    try {
      const result = (
        await this.partialItemsService.getPartialItems(orgId, [itemId])
      )[0] satisfies ItemSubmission as ItemSubmission | undefined;
      return result;
    } catch (e) {
      // If partial items endpoint is not configured, return undefined
      // This allows graceful fallback to item investigation service
      return undefined;
    }
  }
}
