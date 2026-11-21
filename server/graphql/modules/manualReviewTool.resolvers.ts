/* eslint-disable max-lines, max-classes-per-file -- one NestJS resolver class per GraphQL type of the MRT module */
import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import _ from 'lodash';

import { itemSubmissionWithTypeIdentifierToItemSubmission } from '../../services/itemProcessingService/index.js';
import { actionableRelatedActions } from '../../services/manualReviewToolService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import {
  asyncIterableToArray,
  filterNullOrUndefined,
} from '../../utils/collections.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import {
  getEndOfDayInTimezone,
  getStartOfDayInTimezone,
} from '../../utils/time.js';
import {
  type GQLContentAppealManualReviewJobPayloadResolvers,
  type GQLContentManualReviewJobPayloadResolvers,
  type GQLDequeueManualReviewJobResponseResolvers,
  type GQLManualReviewChartSettingsResolvers,
  type GQLManualReviewDecisionComponentResolvers,
  type GQLManualReviewDecisionResolvers,
  type GQLManualReviewJobCommentResolvers,
  type GQLManualReviewJobEnqueueSourceInfoResolvers,
  type GQLManualReviewJobPayloadResolvers,
  type GQLManualReviewJobResolvers,
  type GQLManualReviewQueueResolvers,
  type GQLMutationResolvers,
  type GQLNcmecManualReviewJobPayloadResolvers,
  type GQLQueryResolvers,
  type GQLThreadAppealManualReviewJobPayloadResolvers,
  type GQLThreadManualReviewJobPayloadResolvers,
  type GQLUserAppealManualReviewJobPayloadResolvers,
  type GQLUserManualReviewJobPayloadResolvers,
} from '../generated.js';
import { formatItemSubmissionForGQL } from '../types.js';
import { beforeContentAccess } from '../utils/contentAccess.js';
import {
  forbiddenError,
  unauthenticatedError,
  userInputError,
} from '../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';
import { oneOfInputToTaggedUnion } from '../utils/inputHelpers.js';
import { getManualReviewJobReportCountLoader } from '../utils/manualReviewJobReportCounts.js';
import { assertQueueIsReviewable } from '../utils/manualReviewQueueAuthorization.js';
import { resolverMapOf, type Fn, type P } from '../utils/nestResolverTypes.js';
import { assertManualReviewJobIdsWithinLimit } from './manualReviewTool.js';

const { omit, sumBy } = _;

@Resolver('ManualReviewJobEnqueueSourceInfo')
export class ManualReviewJobEnqueueSourceInfoResolver {
  @ResolveField('__resolveType')
  __resolveType(
    it: P<GQLManualReviewJobEnqueueSourceInfoResolvers, '__resolveType'>[0],
  ): ReturnType<
    Fn<GQLManualReviewJobEnqueueSourceInfoResolvers, '__resolveType'>
  > {
    switch (it.kind) {
      case 'REPORT':
        return 'ReportEnqueueSourceInfo';
      case 'APPEAL':
        return 'AppealEnqueueSourceInfo';
      case 'RULE_EXECUTION':
        return 'RuleExecutionEnqueueSourceInfo';
      case 'MRT_JOB':
        return 'MrtJobEnqueueSourceInfo';
      case 'POST_ACTIONS':
        return 'PostActionsEnqueueSourceInfo';
      default:
        assertUnreachable(it.kind);
    }
  }
}

@Resolver('ManualReviewJobPayload')
export class ManualReviewJobPayloadResolver {
  @ResolveField('__resolveType')
  async __resolveType(
    it: P<GQLManualReviewJobPayloadResolvers, '__resolveType'>[0],
    context: P<GQLManualReviewJobPayloadResolvers, '__resolveType'>[1],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewJobPayloadResolvers, '__resolveType'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    const itemType = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (itemType === undefined) {
      throw new Error('No item type found');
    }

    switch (itemType.kind) {
      case 'CONTENT': {
        return 'appealId' in it
          ? 'ContentAppealManualReviewJobPayload'
          : 'ContentManualReviewJobPayload';
      }
      case 'USER': {
        return 'appealId' in it
          ? 'UserAppealManualReviewJobPayload'
          : it.kind === 'DEFAULT'
            ? 'UserManualReviewJobPayload'
            : 'allMediaItems' in it
              ? 'NcmecManualReviewJobPayload'
              : 'UserManualReviewJobPayload';
      }
      case 'THREAD': {
        return 'appealId' in it
          ? 'ThreadAppealManualReviewJobPayload'
          : 'ThreadManualReviewJobPayload';
      }
      default:
        assertUnreachable(itemType);
    }
  }
}

@Resolver('ContentManualReviewJobPayload')
export class ContentManualReviewJobPayloadResolver {
  @ResolveField('item')
  async item(
    it: P<GQLContentManualReviewJobPayloadResolvers, 'item'>[0],
    _: P<GQLContentManualReviewJobPayloadResolvers, 'item'>[1],
    context: P<GQLContentManualReviewJobPayloadResolvers, 'item'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLContentManualReviewJobPayloadResolvers, 'item'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'CONTENT') {
      throw new Error('Invalid item type in content item type resolver');
    }

    const itemSubmission = itemSubmissionWithTypeIdentifierToItemSubmission(
      it.item,
      type,
    );

    // Matched banks are now stored directly in the item data during submission
    return formatItemSubmissionForGQL(itemSubmission);
  }

  @ResolveField('itemThreadContentItems')
  async itemThreadContentItems(
    it: P<
      GQLContentManualReviewJobPayloadResolvers,
      'itemThreadContentItems'
    >[0],
    _: P<
      GQLContentManualReviewJobPayloadResolvers,
      'itemThreadContentItems'
    >[1],
    context: P<
      GQLContentManualReviewJobPayloadResolvers,
      'itemThreadContentItems'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLContentManualReviewJobPayloadResolvers, 'itemThreadContentItems'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.itemThreadContentItems === undefined) {
      return null;
    }

    return Promise.all(
      it.itemThreadContentItems.map(async (contentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector: contentItemSubmission.itemTypeIdentifier,
        });

        if (type === undefined || type.kind !== 'CONTENT') {
          throw new Error(
            `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
          );
        }

        return formatItemSubmissionForGQL(
          itemSubmissionWithTypeIdentifierToItemSubmission(
            contentItemSubmission,
            type,
          ),
        );
      }),
    );
  }

  @ResolveField('additionalContentItems')
  async additionalContentItems(
    it: P<
      GQLContentManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[0],
    _: P<
      GQLContentManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[1],
    context: P<
      GQLContentManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLContentManualReviewJobPayloadResolvers, 'additionalContentItems'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.additionalContentItems === undefined) {
      return [];
    }
    return 'additionalContentItems' in it
      ? Promise.all(
          it.additionalContentItems.map(async (contentItemSubmission) => {
            const type = await context.services.getItemTypeEventuallyConsistent(
              {
                orgId: user.orgId,
                typeSelector: contentItemSubmission.itemTypeIdentifier,
              },
            );

            if (type === undefined || type.kind !== 'CONTENT') {
              throw new Error(
                `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
              );
            }

            return formatItemSubmissionForGQL(
              itemSubmissionWithTypeIdentifierToItemSubmission(
                contentItemSubmission,
                type,
              ),
            );
          }),
        )
      : [];
  }

  @ResolveField('enqueueSourceInfo')
  async enqueueSourceInfo(
    it: P<GQLContentManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[0],
    _: P<GQLContentManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[1],
    context: P<
      GQLContentManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLContentManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    switch (enqueueSourceInfo.kind) {
      case 'MRT_JOB':
      case 'REPORT':
      case 'POST_ACTIONS':
        return { kind: enqueueSourceInfo.kind };
      case 'RULE_EXECUTION': {
        const rules = await context.dataSources.ruleAPI.getGraphQLRulesForOrg(
          user.orgId,
        );
        return {
          kind: enqueueSourceInfo.kind,
          rules: rules.filter((rule) =>
            enqueueSourceInfo.rules.includes(rule.id),
          ),
        };
      }
      default:
        assertUnreachable(enqueueSourceInfo);
    }
  }
}

@Resolver('ContentAppealManualReviewJobPayload')
export class ContentAppealManualReviewJobPayloadResolver {
  @ResolveField('item')
  async item(
    it: P<GQLContentAppealManualReviewJobPayloadResolvers, 'item'>[0],
    _: P<GQLContentAppealManualReviewJobPayloadResolvers, 'item'>[1],
    context: P<GQLContentAppealManualReviewJobPayloadResolvers, 'item'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLContentAppealManualReviewJobPayloadResolvers, 'item'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'CONTENT') {
      throw new Error('Invalid item type in content item type resolver');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  }

  @ResolveField('additionalContentItems')
  async additionalContentItems(
    it: P<
      GQLContentAppealManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[0],
    _: P<
      GQLContentAppealManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[1],
    context: P<
      GQLContentAppealManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<
          GQLContentAppealManualReviewJobPayloadResolvers,
          'additionalContentItems'
        >
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.additionalContentItems === undefined) {
      return [];
    }
    return 'additionalContentItems' in it
      ? Promise.all(
          it.additionalContentItems.map(async (contentItemSubmission) => {
            const type = await context.services.getItemTypeEventuallyConsistent(
              {
                orgId: user.orgId,
                typeSelector: contentItemSubmission.itemTypeIdentifier,
              },
            );

            if (type === undefined || type.kind !== 'CONTENT') {
              throw new Error(
                `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
              );
            }

            return formatItemSubmissionForGQL(
              itemSubmissionWithTypeIdentifierToItemSubmission(
                contentItemSubmission,
                type,
              ),
            );
          }),
        )
      : [];
  }

  @ResolveField('enqueueSourceInfo')
  async enqueueSourceInfo(
    it: P<
      GQLContentAppealManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[0],
    _: P<
      GQLContentAppealManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[1],
    context: P<
      GQLContentAppealManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLContentAppealManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    return { kind: enqueueSourceInfo.kind };
  }
}

@Resolver('UserManualReviewJobPayload')
export class UserManualReviewJobPayloadResolver {
  @ResolveField('item')
  async item(
    it: P<GQLUserManualReviewJobPayloadResolvers, 'item'>[0],
    _: P<GQLUserManualReviewJobPayloadResolvers, 'item'>[1],
    context: P<GQLUserManualReviewJobPayloadResolvers, 'item'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLUserManualReviewJobPayloadResolvers, 'item'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'USER') {
      throw new Error('Invalid item type in user item type resolver');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  }

  @ResolveField('itemThreadContentItems')
  async itemThreadContentItems(
    it: P<GQLUserManualReviewJobPayloadResolvers, 'itemThreadContentItems'>[0],
    _: P<GQLUserManualReviewJobPayloadResolvers, 'itemThreadContentItems'>[1],
    context: P<
      GQLUserManualReviewJobPayloadResolvers,
      'itemThreadContentItems'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLUserManualReviewJobPayloadResolvers, 'itemThreadContentItems'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.itemThreadContentItems === undefined) {
      return null;
    }
    return Promise.all(
      it.itemThreadContentItems.map(async (contentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector: contentItemSubmission.itemTypeIdentifier,
        });

        if (type === undefined || type.kind !== 'CONTENT') {
          throw new Error(
            `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
          );
        }

        return formatItemSubmissionForGQL(
          itemSubmissionWithTypeIdentifierToItemSubmission(
            contentItemSubmission,
            type,
          ),
        );
      }),
    );
  }

  @ResolveField('additionalContentItems')
  async additionalContentItems(
    it: P<GQLUserManualReviewJobPayloadResolvers, 'additionalContentItems'>[0],
    _: P<GQLUserManualReviewJobPayloadResolvers, 'additionalContentItems'>[1],
    context: P<
      GQLUserManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLUserManualReviewJobPayloadResolvers, 'additionalContentItems'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.additionalContentItems === undefined) {
      return [];
    }
    return Promise.all(
      it.additionalContentItems.map(async (contentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector: contentItemSubmission.itemTypeIdentifier,
        });

        if (type === undefined || type.kind !== 'CONTENT') {
          throw new Error(
            `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
          );
        }

        return formatItemSubmissionForGQL(
          itemSubmissionWithTypeIdentifierToItemSubmission(
            contentItemSubmission,
            type,
          ),
        );
      }),
    );
  }

  @ResolveField('userSubmittedItems')
  async userSubmittedItems(
    it: P<GQLUserManualReviewJobPayloadResolvers, 'userSubmittedItems'>[0],
    _: P<GQLUserManualReviewJobPayloadResolvers, 'userSubmittedItems'>[1],
    context: P<GQLUserManualReviewJobPayloadResolvers, 'userSubmittedItems'>[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLUserManualReviewJobPayloadResolvers, 'userSubmittedItems'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    const items = await asyncIterableToArray(
      context.services.ItemInvestigationService.getItemSubmissionsByCreator({
        orgId: user.orgId,
        itemCreatorIdentifier: {
          id: it.item.itemId,
          typeId: it.item.itemTypeIdentifier.id,
        },
      }),
    );

    const itemSubmissionsForGQL = items.flatMap((itemSubmissions) => {
      const { latestSubmission, priorSubmissions } = itemSubmissions;
      if (latestSubmission.itemType.kind !== 'CONTENT') {
        return [];
      }
      return {
        latest: formatItemSubmissionForGQL(latestSubmission),
        prior: priorSubmissions
          ? itemSubmissions.priorSubmissions?.map(formatItemSubmissionForGQL)
          : [],
      };
    });
    return itemSubmissionsForGQL;
  }

  @ResolveField('enqueueSourceInfo')
  async enqueueSourceInfo(
    it: P<GQLUserManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[0],
    _: P<GQLUserManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[1],
    context: P<GQLUserManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLUserManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    switch (enqueueSourceInfo.kind) {
      case 'MRT_JOB':
      case 'REPORT':
      case 'POST_ACTIONS':
        return { kind: enqueueSourceInfo.kind };
      case 'RULE_EXECUTION': {
        const rules = await context.dataSources.ruleAPI.getGraphQLRulesForOrg(
          user.orgId,
        );
        return {
          kind: enqueueSourceInfo.kind,
          rules: rules.filter((rule) =>
            enqueueSourceInfo.rules.includes(rule.id),
          ),
        };
      }
      default:
        assertUnreachable(enqueueSourceInfo);
    }
  }
}

@Resolver('UserAppealManualReviewJobPayload')
export class UserAppealManualReviewJobPayloadResolver {
  @ResolveField('item')
  async item(
    it: P<GQLUserAppealManualReviewJobPayloadResolvers, 'item'>[0],
    _: P<GQLUserAppealManualReviewJobPayloadResolvers, 'item'>[1],
    context: P<GQLUserAppealManualReviewJobPayloadResolvers, 'item'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLUserAppealManualReviewJobPayloadResolvers, 'item'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'USER') {
      throw new Error('Invalid item type in user item type resolver');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  }

  @ResolveField('additionalContentItems')
  async additionalContentItems(
    it: P<
      GQLUserAppealManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[0],
    _: P<
      GQLUserAppealManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[1],
    context: P<
      GQLUserAppealManualReviewJobPayloadResolvers,
      'additionalContentItems'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<
          GQLUserAppealManualReviewJobPayloadResolvers,
          'additionalContentItems'
        >
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.additionalContentItems === undefined) {
      return [];
    }
    return Promise.all(
      it.additionalContentItems.map(async (contentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector: contentItemSubmission.itemTypeIdentifier,
        });

        if (type === undefined || type.kind !== 'CONTENT') {
          throw new Error(
            `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
          );
        }

        return formatItemSubmissionForGQL(
          itemSubmissionWithTypeIdentifierToItemSubmission(
            contentItemSubmission,
            type,
          ),
        );
      }),
    );
  }

  @ResolveField('enqueueSourceInfo')
  async enqueueSourceInfo(
    it: P<GQLUserAppealManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[0],
    _: P<GQLUserAppealManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[1],
    context: P<
      GQLUserAppealManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLUserAppealManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    return { kind: enqueueSourceInfo.kind };
  }
}

@Resolver('ThreadManualReviewJobPayload')
export class ThreadManualReviewJobPayloadResolver {
  @ResolveField('item')
  async item(
    it: P<GQLThreadManualReviewJobPayloadResolvers, 'item'>[0],
    _: P<GQLThreadManualReviewJobPayloadResolvers, 'item'>[1],
    context: P<GQLThreadManualReviewJobPayloadResolvers, 'item'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLThreadManualReviewJobPayloadResolvers, 'item'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'THREAD') {
      throw new Error('Invalid item type in thread item type resolver');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  }

  @ResolveField('threadItems')
  async threadItems(
    it: P<GQLThreadManualReviewJobPayloadResolvers, 'threadItems'>[0],
    _: P<GQLThreadManualReviewJobPayloadResolvers, 'threadItems'>[1],
    context: P<GQLThreadManualReviewJobPayloadResolvers, 'threadItems'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLThreadManualReviewJobPayloadResolvers, 'threadItems'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    const itemsWithParents = await asyncIterableToArray(
      context.services.ItemInvestigationService.getThreadSubmissionsByTime({
        orgId: user.orgId,
        threadId: {
          id: it.item.itemId,
          typeId: it.item.itemTypeIdentifier.id,
        },
        limit: 20,
        numParentLevels: 0,
        latestSubmissionsOnly: true,
      }),
    );

    return Promise.all(
      itemsWithParents.map(async (itemWithParents) => {
        const parentSubmissions = await asyncIterableToArray(
          itemWithParents.parents,
        );
        return {
          item: {
            latest: formatItemSubmissionForGQL(
              itemWithParents.latestSubmission,
            ),
            prior: itemWithParents.priorSubmissions
              ? itemWithParents.priorSubmissions.map(formatItemSubmissionForGQL)
              : [],
          },
          parents: parentSubmissions.map((p) => {
            return {
              latest: formatItemSubmissionForGQL(p.latestSubmission),
              prior: p.priorSubmissions
                ? p.priorSubmissions.map(formatItemSubmissionForGQL)
                : [],
            };
          }),
        };
      }),
    );
  }

  @ResolveField('enqueueSourceInfo')
  async enqueueSourceInfo(
    it: P<GQLThreadManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[0],
    _: P<GQLThreadManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[1],
    context: P<
      GQLThreadManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLThreadManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    switch (enqueueSourceInfo.kind) {
      case 'MRT_JOB':
      case 'REPORT':
      case 'POST_ACTIONS':
        return { kind: enqueueSourceInfo.kind };
      case 'RULE_EXECUTION': {
        const rules = await context.dataSources.ruleAPI.getGraphQLRulesForOrg(
          user.orgId,
        );
        return {
          kind: enqueueSourceInfo.kind,
          rules: rules.filter((rule) =>
            enqueueSourceInfo.rules.includes(rule.id),
          ),
        };
      }
      default:
        assertUnreachable(enqueueSourceInfo);
    }
  }
}

@Resolver('ThreadAppealManualReviewJobPayload')
export class ThreadAppealManualReviewJobPayloadResolver {
  @ResolveField('item')
  async item(
    it: P<GQLThreadAppealManualReviewJobPayloadResolvers, 'item'>[0],
    _: P<GQLThreadAppealManualReviewJobPayloadResolvers, 'item'>[1],
    context: P<GQLThreadAppealManualReviewJobPayloadResolvers, 'item'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLThreadAppealManualReviewJobPayloadResolvers, 'item'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'THREAD') {
      throw new Error('Invalid item type in thread item type resolver');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  }

  @ResolveField('enqueueSourceInfo')
  async enqueueSourceInfo(
    it: P<
      GQLThreadAppealManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[0],
    _: P<
      GQLThreadAppealManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[1],
    context: P<
      GQLThreadAppealManualReviewJobPayloadResolvers,
      'enqueueSourceInfo'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLThreadAppealManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    return { kind: enqueueSourceInfo.kind };
  }
}

@Resolver('NcmecManualReviewJobPayload')
export class NcmecManualReviewJobPayloadResolver {
  @ResolveField('reportedMessages')
  reportedMessages(
    it: P<GQLNcmecManualReviewJobPayloadResolvers, 'reportedMessages'>[0],
  ): ReturnType<
    Fn<GQLNcmecManualReviewJobPayloadResolvers, 'reportedMessages'>
  > {
    return (it.reportedMessages ?? []).map((id) => ({
      id: id.id,
      typeId: id.typeId,
    }));
  }

  @ResolveField('item')
  async item(
    it: P<GQLNcmecManualReviewJobPayloadResolvers, 'item'>[0],
    _: P<GQLNcmecManualReviewJobPayloadResolvers, 'item'>[1],
    context: P<GQLNcmecManualReviewJobPayloadResolvers, 'item'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLNcmecManualReviewJobPayloadResolvers, 'item'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'USER') {
      throw new Error('Item on a NCMEC job must be a user item type');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  }

  @ResolveField('allMediaItems')
  async allMediaItems(
    it: P<GQLNcmecManualReviewJobPayloadResolvers, 'allMediaItems'>[0],
    _: P<GQLNcmecManualReviewJobPayloadResolvers, 'allMediaItems'>[1],
    context: P<GQLNcmecManualReviewJobPayloadResolvers, 'allMediaItems'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLNcmecManualReviewJobPayloadResolvers, 'allMediaItems'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    return Promise.all(
      it.allMediaItems.map(async (ncmecContentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector:
            ncmecContentItemSubmission.contentItem.itemTypeIdentifier,
        });
        if (type === undefined) {
          throw new Error(
            `No Content Item Type found for id: ${ncmecContentItemSubmission.contentItem.itemTypeIdentifier.id}`,
          );
        }
        return {
          ...ncmecContentItemSubmission,
          contentItem: formatItemSubmissionForGQL(
            itemSubmissionWithTypeIdentifierToItemSubmission(
              ncmecContentItemSubmission.contentItem,
              type,
            ),
          ),
        };
      }),
    );
  }

  @ResolveField('enqueueSourceInfo')
  async enqueueSourceInfo(
    it: P<GQLNcmecManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[0],
    _: P<GQLNcmecManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[1],
    context: P<GQLNcmecManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLNcmecManualReviewJobPayloadResolvers, 'enqueueSourceInfo'>
      >
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    switch (enqueueSourceInfo.kind) {
      case 'MRT_JOB':
      case 'REPORT':
      case 'POST_ACTIONS':
        return { kind: enqueueSourceInfo.kind };
      case 'RULE_EXECUTION': {
        const rules = await context.dataSources.ruleAPI.getGraphQLRulesForOrg(
          user.orgId,
        );
        return {
          kind: enqueueSourceInfo.kind,
          rules: rules.filter((rule) =>
            enqueueSourceInfo.rules.includes(rule.id),
          ),
        };
      }
      default:
        assertUnreachable(enqueueSourceInfo);
    }
  }
}

@Resolver('ManualReviewQueue')
export class ManualReviewQueueResolver {
  @ResolveField('jobs')
  async jobs(
    queue: P<GQLManualReviewQueueResolvers, 'jobs'>[0],
    {
      ids: jobIds,
      limit,
      lockToken,
    }: P<GQLManualReviewQueueResolvers, 'jobs'>[1],
    context: P<GQLManualReviewQueueResolvers, 'jobs'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLManualReviewQueueResolvers, 'jobs'>>>> {
    const user = await assertQueueIsReviewable(queue, context);

    const { orgId, id: queueId } = queue;

    if (jobIds == null) {
      return context.services.ManualReviewToolService.getAllJobsForQueue({
        orgId,
        queueId,
        limit: limit ?? undefined,
      });
    }
    assertManualReviewJobIdsWithinLimit(jobIds);

    // Empty array means "filter to no IDs" -> result is always []. Short-circuit
    // so we don't open a Bull/Redis queue handle per reviewable queue on every
    // MRT page load before a job has been dequeued.
    if (jobIds.length === 0) {
      return [];
    }

    const jobs = await context.services.ManualReviewToolService.getJobsForQueue(
      {
        orgId,
        queueId,
        jobIds,
        isAppealsQueue: queue.isAppealsQueue,
      },
    );
    if (lockToken == null) {
      return jobs;
    }

    return Promise.all(
      jobs.map(async (job) =>
        context.services.ManualReviewToolService.resolveContentForReview({
          job,
          queueId,
          reviewerId: user.id,
          reviewerOrgId: user.orgId,
          lockToken,
          isAppealsQueue: queue.isAppealsQueue,
        }),
      ),
    );
  }

  @ResolveField('pendingJobCount')
  async pendingJobCount(
    queue: P<GQLManualReviewQueueResolvers, 'pendingJobCount'>[0],
    _: P<GQLManualReviewQueueResolvers, 'pendingJobCount'>[1],
    context: P<GQLManualReviewQueueResolvers, 'pendingJobCount'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewQueueResolvers, 'pendingJobCount'>>>
  > {
    await assertQueueIsReviewable(queue, context);

    const { orgId, id: queueId } = queue;
    return context.services.ManualReviewToolService.getPendingJobCount({
      orgId,
      queueId,
    });
  }

  @ResolveField('oldestJobCreatedAt')
  async oldestJobCreatedAt(
    queue: P<GQLManualReviewQueueResolvers, 'oldestJobCreatedAt'>[0],
    _: P<GQLManualReviewQueueResolvers, 'oldestJobCreatedAt'>[1],
    context: P<GQLManualReviewQueueResolvers, 'oldestJobCreatedAt'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewQueueResolvers, 'oldestJobCreatedAt'>>>
  > {
    await assertQueueIsReviewable(queue, context);

    const { orgId, id: queueId } = queue;
    return context.services.ManualReviewToolService.getOldestJobCreatedAt({
      orgId,
      queueId,
      isAppealsQueue: queue.isAppealsQueue,
    });
  }

  @ResolveField('explicitlyAssignedReviewers')
  async explicitlyAssignedReviewers(
    queue: P<GQLManualReviewQueueResolvers, 'explicitlyAssignedReviewers'>[0],
    _: P<GQLManualReviewQueueResolvers, 'explicitlyAssignedReviewers'>[1],
    context: P<GQLManualReviewQueueResolvers, 'explicitlyAssignedReviewers'>[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLManualReviewQueueResolvers, 'explicitlyAssignedReviewers'>
      >
    >
  > {
    const user = await assertQueueIsReviewable(queue, context);
    const { id: userId, orgId } = user;

    const userIds = (
      await context.services.ManualReviewToolService.getUsersWhoCanSeeQueue({
        queueId: queue.id,
        userId,
        orgId,
      })
    ).map((it) => it.userId);
    return context.dataSources.userAPI.getGraphQLUsersFromIds(userIds);
  }

  @ResolveField('assignedRoleIds')
  async assignedRoleIds(
    queue: P<GQLManualReviewQueueResolvers, 'assignedRoleIds'>[0],
    _: P<GQLManualReviewQueueResolvers, 'assignedRoleIds'>[1],
    context: P<GQLManualReviewQueueResolvers, 'assignedRoleIds'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewQueueResolvers, 'assignedRoleIds'>>>
  > {
    const user = await assertQueueIsReviewable(queue, context);
    return context.services.ManualReviewToolService.getAssignedRoleIdsForQueue({
      queueId: queue.id,
      orgId: user.orgId,
    });
  }

  @ResolveField('hiddenActionIds')
  async hiddenActionIds(
    queue: P<GQLManualReviewQueueResolvers, 'hiddenActionIds'>[0],
    _: P<GQLManualReviewQueueResolvers, 'hiddenActionIds'>[1],
    context: P<GQLManualReviewQueueResolvers, 'hiddenActionIds'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewQueueResolvers, 'hiddenActionIds'>>>
  > {
    const user = await assertQueueIsReviewable(queue, context);
    const { orgId } = user;
    const { id: queueId } = queue;

    return context.services.ManualReviewToolService.getHiddenActionsForQueue({
      orgId,
      queueId,
    });
  }

  @ResolveField('clearReportsTriggerActionIds')
  async clearReportsTriggerActionIds(
    queue: P<GQLManualReviewQueueResolvers, 'clearReportsTriggerActionIds'>[0],
    _: P<GQLManualReviewQueueResolvers, 'clearReportsTriggerActionIds'>[1],
    context: P<
      GQLManualReviewQueueResolvers,
      'clearReportsTriggerActionIds'
    >[2],
  ): Promise<
    Awaited<
      ReturnType<
        Fn<GQLManualReviewQueueResolvers, 'clearReportsTriggerActionIds'>
      >
    >
  > {
    const user = await assertQueueIsReviewable(queue, context);
    return context.services.ManualReviewToolService.getClearReportsTriggerActionsForQueue(
      {
        orgId: user.orgId,
        queueId: queue.id,
      },
    );
  }
}

@Resolver('ManualReviewDecision')
export class ManualReviewDecisionResolver {
  @ResolveField('decisionReason')
  async decisionReason(
    decision: P<GQLManualReviewDecisionResolvers, 'decisionReason'>[0],
    _: P<GQLManualReviewDecisionResolvers, 'decisionReason'>[1],
    context: P<GQLManualReviewDecisionResolvers, 'decisionReason'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewDecisionResolvers, 'decisionReason'>>>
  > {
    if (!context.services.ContentAccessService.enabled)
      return decision.decisionReason ?? null;
    const user = context.getUser();
    if (user == null) throw unauthenticatedError('Authenticated user required');
    if (decision.decisionReason == null) return null;
    // DecisionAnalytics scopes these records to the authenticated organization.
    await beforeContentAccess(context, user.orgId, {
      resourceType: 'review_decision',
      resourceId: decision.id,
      field: 'decisionReason',
    });
    return decision.decisionReason;
  }
}

@Resolver('ManualReviewJobComment')
export class ManualReviewJobCommentResolver {
  @ResolveField('commentText')
  async commentText(
    comment: P<GQLManualReviewJobCommentResolvers, 'commentText'>[0],
    _: P<GQLManualReviewJobCommentResolvers, 'commentText'>[1],
    context: P<GQLManualReviewJobCommentResolvers, 'commentText'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewJobCommentResolvers, 'commentText'>>>
  > {
    if (!context.services.ContentAccessService.enabled)
      return comment.commentText;
    const user = context.getUser();
    if (user == null) throw unauthenticatedError('Authenticated user required');
    // CommentOperations scopes these records to the authenticated organization.
    await beforeContentAccess(context, user.orgId, {
      resourceType: 'review_comment',
      resourceId: comment.id,
      field: 'commentText',
    });
    return comment.commentText;
  }

  @ResolveField('author')
  async author(
    comment: P<GQLManualReviewJobCommentResolvers, 'author'>[0],
    _: P<GQLManualReviewJobCommentResolvers, 'author'>[1],
    context: P<GQLManualReviewJobCommentResolvers, 'author'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewJobCommentResolvers, 'author'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    try {
      return await context.dataSources.userAPI.getGraphQLUserFromId({
        id: comment.authorId,
        orgId: user.orgId,
      });
    } catch {
      return null;
    }
  }
}

@Resolver('ManualReviewJob')
export class ManualReviewJobResolver {
  @ResolveField('payload')
  async payload(
    job: P<GQLManualReviewJobResolvers, 'payload'>[0],
    _: P<GQLManualReviewJobResolvers, 'payload'>[1],
    context: P<GQLManualReviewJobResolvers, 'payload'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLManualReviewJobResolvers, 'payload'>>>> {
    await beforeContentAccess(context, job.orgId, {
      resourceType: 'review_job',
      resourceId: job.id,
      field: 'payload',
    });
    return job.payload;
  }

  @ResolveField('comments')
  async comments(
    job: P<GQLManualReviewJobResolvers, 'comments'>[0],
    _: P<GQLManualReviewJobResolvers, 'comments'>[1],
    context: P<GQLManualReviewJobResolvers, 'comments'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLManualReviewJobResolvers, 'comments'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    return context.services.ManualReviewToolService.getJobComments({
      orgId: user.orgId,
      jobId: job.id,
    });
  }

  @ResolveField('numTimesReported')
  async numTimesReported(
    job: P<GQLManualReviewJobResolvers, 'numTimesReported'>[0],
    _: P<GQLManualReviewJobResolvers, 'numTimesReported'>[1],
    context: P<GQLManualReviewJobResolvers, 'numTimesReported'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLManualReviewJobResolvers, 'numTimesReported'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    const item = job.payload.item;
    const itemId =
      'itemId' in item ? item.itemId : (item as { id?: string }).id;
    if (typeof itemId !== 'string' || itemId === '') {
      return 0;
    }
    return getManualReviewJobReportCountLoader(context).load(itemId);
  }
}

@Resolver('DequeueManualReviewJobResponse')
export class DequeueManualReviewJobResponseResolver {
  @ResolveField('__resolveType')
  __resolveType(
    _response: P<
      GQLDequeueManualReviewJobResponseResolvers,
      '__resolveType'
    >[0],
  ): ReturnType<
    Fn<GQLDequeueManualReviewJobResponseResolvers, '__resolveType'>
  > {
    return 'DequeueManualReviewJobSuccessResponse';
  }
}

@Resolver('Query')
export class ManualReviewToolQueryResolver {
  @Query('getDecisionCounts')
  async getDecisionCounts(
    @Parent() _: P<GQLQueryResolvers, 'getDecisionCounts'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getDecisionCounts'>[1],
    @Context() context: P<GQLQueryResolvers, 'getDecisionCounts'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'getDecisionCounts'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    return context.services.ManualReviewToolService.getDecisionCounts({
      ...input,
      groupBy: input.groupBy.map((it) => it.toLowerCase()),
      filterBy: {
        ...input.filterBy,
        startDate: new Date(input.filterBy.startDate),
        endDate: new Date(input.filterBy.endDate),
        filteredDecisionActionType: input.filterBy.filteredDecisionActionType
          ? input.filterBy.filteredDecisionActionType
          : undefined,
      },
      timeZone: input.timeZone,
      orgId: user.orgId,
    });
  }

  @Query('getJobCreationCounts')
  async getJobCreationCounts(
    @Parent() _: P<GQLQueryResolvers, 'getJobCreationCounts'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getJobCreationCounts'>[1],
    @Context() context: P<GQLQueryResolvers, 'getJobCreationCounts'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getJobCreationCounts'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getJobCreationCounts({
        timeDivision: input.timeDivision,
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        timeZone: input.timeZone,
        orgId: user.orgId,
      });
    return result.map((it) => ({
      count: it.count,
      time: it.time,
      ...('item_type_id' in it ? { itemTypeId: it.item_type_id } : {}),
      ...('policy_id' in it ? { policyId: it.policy_id } : {}),
      ...('rule_id' in it ? { ruleId: it.rule_id } : {}),
      ...('queue_id' in it ? { queueId: it.queue_id } : {}),
      ...('source' in it ? { source: it.source } : {}),
    }));
  }

  @Query('getResolvedJobCounts')
  async getResolvedJobCounts(
    @Parent() _: P<GQLQueryResolvers, 'getResolvedJobCounts'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getResolvedJobCounts'>[1],
    @Context() context: P<GQLQueryResolvers, 'getResolvedJobCounts'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getResolvedJobCounts'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getResolvedJobCounts({
        timeDivision: input.timeDivision,
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        timeZone: input.timeZone,
        orgId: user.orgId,
      });
    return result.map((it) => ({
      count: it.count,
      time: it.time,
      ...('reviewer_id' in it ? { reviewerId: it.reviewer_id } : {}),
      ...('queue_id' in it ? { queueId: it.queue_id } : {}),
    }));
  }

  @Query('getSkippedJobCounts')
  async getSkippedJobCounts(
    @Parent() _: P<GQLQueryResolvers, 'getSkippedJobCounts'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getSkippedJobCounts'>[1],
    @Context() context: P<GQLQueryResolvers, 'getSkippedJobCounts'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getSkippedJobCounts'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getSkippedJobCounts({
        timeDivision: input.timeDivision,
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          userIds: input.filterBy.reviewerIds,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        timeZone: input.timeZone,
        orgId: user.orgId,
      });
    return result.map((it) => ({
      count: it.count,
      time: it.time,
      ...('user_id' in it ? { reviewerId: it.user_id } : {}),
      ...('queue_id' in it ? { queueId: it.queue_id } : {}),
    }));
  }

  @Query('getResolvedJobsForUser')
  async getResolvedJobsForUser(
    @Parent() _: P<GQLQueryResolvers, 'getResolvedJobsForUser'>[0],
    @Args() { timeZone }: P<GQLQueryResolvers, 'getResolvedJobsForUser'>[1],
    @Context() context: P<GQLQueryResolvers, 'getResolvedJobsForUser'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getResolvedJobsForUser'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const counts =
      await context.services.ManualReviewToolService.getResolvedJobCounts({
        timeDivision: 'DAY',
        groupBy: ['reviewer_id'],
        filterBy: {
          reviewerIds: [user.id],
          queueIds: [],
          // Time at midnight in UTC
          startDate: getStartOfDayInTimezone(timeZone),
          endDate: getEndOfDayInTimezone(timeZone),
        },
        timeZone,
        orgId: user.orgId,
      });
    if (counts.length === 0) {
      return 0;
    }
    return sumBy(counts, 'count');
  }

  @Query('getSkippedJobsForUser')
  async getSkippedJobsForUser(
    @Parent() _: P<GQLQueryResolvers, 'getSkippedJobsForUser'>[0],
    @Args() { timeZone }: P<GQLQueryResolvers, 'getSkippedJobsForUser'>[1],
    @Context() context: P<GQLQueryResolvers, 'getSkippedJobsForUser'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getSkippedJobsForUser'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const counts =
      await context.services.ManualReviewToolService.getSkippedJobCounts({
        timeDivision: 'DAY',
        groupBy: ['reviewer_id'],
        filterBy: {
          userIds: [user.id],
          queueIds: [],
          // Time at midnight in UTC
          startDate: getStartOfDayInTimezone(timeZone),
          endDate: getEndOfDayInTimezone(timeZone),
        },
        timeZone,
        orgId: user.orgId,
      });
    if (counts.length === 0) {
      return 0;
    }
    return sumBy(counts, 'count');
  }

  @Query('getTimeToAction')
  async getTimeToAction(
    @Parent() _: P<GQLQueryResolvers, 'getTimeToAction'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getTimeToAction'>[1],
    @Context() context: P<GQLQueryResolvers, 'getTimeToAction'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'getTimeToAction'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getDecisionTimeToAction({
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        orgId: user.orgId,
      });
    return result.map((it) => ({
      timeToAction: it.time_to_action ? Math.round(it.time_to_action) : 0,
      queueId: it.queue_id,
    }));
  }

  @Query('getHandleTime')
  async getHandleTime(
    @Parent() _: P<GQLQueryResolvers, 'getHandleTime'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getHandleTime'>[1],
    @Context() context: P<GQLQueryResolvers, 'getHandleTime'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'getHandleTime'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const startDate = new Date(input.filterBy.startDate);
    const endDate = new Date(input.filterBy.endDate);
    if (startDate.getTime() > endDate.getTime()) {
      throw userInputError('startDate must not be after endDate');
    }
    const result = await context.services.ManualReviewToolService.getHandleTime(
      {
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          startDate,
          endDate,
        },
        orgId: user.orgId,
      },
    );
    return result.map((it) => ({
      handleTimeSeconds:
        it.handle_time != null ? Math.round(it.handle_time) : null,
      queueId: 'queue_id' in it ? it.queue_id : null,
      reviewerId: 'reviewer_id' in it ? it.reviewer_id : null,
    }));
  }

  @Query('getTotalPendingJobsCount')
  async getTotalPendingJobsCount(
    @Parent() _: P<GQLQueryResolvers, 'getTotalPendingJobsCount'>[0],
    @Args() __: P<GQLQueryResolvers, 'getTotalPendingJobsCount'>[1],
    @Context() context: P<GQLQueryResolvers, 'getTotalPendingJobsCount'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getTotalPendingJobsCount'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const reviewableQueues =
      await context.services.ManualReviewToolService.getReviewableQueuesForUser(
        {
          invoker: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
        },
      );

    return context.services.ManualReviewToolService.getTotalPendingJobCountForQueues(
      user.orgId,
      reviewableQueues.map((q) => q.id),
    );
  }

  @Query('getRecentDecisions')
  async getRecentDecisions(
    @Parent() _: P<GQLQueryResolvers, 'getRecentDecisions'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getRecentDecisions'>[1],
    @Context() context: P<GQLQueryResolvers, 'getRecentDecisions'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'getRecentDecisions'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const permissions = user.getPermissions();
    const { filter, page } = input;
    const recentDecisions =
      await context.services.ManualReviewToolService.getRecentDecisions({
        userPermissions: permissions,
        orgId: user.orgId,
        input: {
          userSearchString: filter.userSearchString ?? undefined,
          decisions: filter.decisions
            ? filterNullOrUndefined(
                filter.decisions.map((it) =>
                  it.userOrRelatedActionDecision
                    ? {
                        type: 'CUSTOM_ACTION',
                        actionIds: it.userOrRelatedActionDecision.actionIds,
                      }
                    : it.ignoreDecision
                      ? { type: 'IGNORE' }
                      : it.submitNcmecReportDecision
                        ? { type: 'SUBMIT_NCMEC_REPORT' }
                        : it.transformJobAndRecreateInQueueDecision
                          ? { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE' }
                          : it.acceptAppealDecision
                            ? {
                                type: 'ACCEPT_APPEAL',
                              }
                            : it.rejectAppealDecision
                              ? {
                                  type: 'REJECT_APPEAL',
                                }
                              : undefined,
                ),
              )
            : undefined,
          policyIds: filter.policyIds ?? undefined,
          reviewerIds: filter.reviewerIds ?? undefined,
          queueIds: filter.queueIds ?? undefined,
          startTime: filter.startTime ? new Date(filter.startTime) : undefined,
          endTime: filter.endTime ? new Date(filter.endTime) : undefined,
          page: page ?? 0,
        },
      });
    return recentDecisions;
  }

  @Query('getDecidedJob')
  async getDecidedJob(
    @Parent() _: P<GQLQueryResolvers, 'getDecidedJob'>[0],
    @Args() { id }: P<GQLQueryResolvers, 'getDecidedJob'>[1],
    @Context() context: P<GQLQueryResolvers, 'getDecidedJob'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'getDecidedJob'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.getDecidedJob({
      orgId: user.orgId,
      id,
    });
  }

  @Query('getDecidedJobFromJobId')
  async getDecidedJobFromJobId(
    @Parent() _: P<GQLQueryResolvers, 'getDecidedJobFromJobId'>[0],
    @Args() { id }: P<GQLQueryResolvers, 'getDecidedJobFromJobId'>[1],
    @Context() context: P<GQLQueryResolvers, 'getDecidedJobFromJobId'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getDecidedJobFromJobId'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.getDecidedJobFromJobId({
      orgId: user.orgId,
      jobId: id,
      userPermissions: user.getPermissions(),
    });
  }

  @Query('manualReviewQueue')
  async manualReviewQueue(
    @Parent() _: P<GQLQueryResolvers, 'manualReviewQueue'>[0],
    @Args() { id }: P<GQLQueryResolvers, 'manualReviewQueue'>[1],
    @Context() context: P<GQLQueryResolvers, 'manualReviewQueue'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'manualReviewQueue'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
    }

    const reviewableQueues =
      await context.services.ManualReviewToolService.getReviewableQueuesForUser(
        {
          invoker: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
          queueIds: [id],
        },
      );
    return reviewableQueues[0] ?? null;
  }

  @Query('getCommentsForJob')
  async getCommentsForJob(
    @Parent() _: P<GQLQueryResolvers, 'getCommentsForJob'>[0],
    @Args() { jobId }: P<GQLQueryResolvers, 'getCommentsForJob'>[1],
    @Context() context: P<GQLQueryResolvers, 'getCommentsForJob'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'getCommentsForJob'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
    }
    return context.services.ManualReviewToolService.getJobComments({
      orgId: user.orgId,
      jobId,
    });
  }

  @Query('getExistingJobsForItem')
  async getExistingJobsForItem(
    @Parent() _: P<GQLQueryResolvers, 'getExistingJobsForItem'>[0],
    @Args() params: P<GQLQueryResolvers, 'getExistingJobsForItem'>[1],
    @Context() context: P<GQLQueryResolvers, 'getExistingJobsForItem'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getExistingJobsForItem'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const reviewableQueues =
      await context.services.ManualReviewToolService.getReviewableQueuesForUser(
        {
          invoker: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
        },
      );

    return context.services.ManualReviewToolService.getExistingJobsForItem({
      orgId: user.orgId,
      itemId: params.itemId,
      itemTypeId: params.itemTypeId,
      queueIds: reviewableQueues.map((queue) => queue.id),
    });
  }

  @Query('getDecisionsTable')
  async getDecisionsTable(
    @Parent() _: P<GQLQueryResolvers, 'getDecisionsTable'>[0],
    @Args() params: P<GQLQueryResolvers, 'getDecisionsTable'>[1],
    @Context() context: P<GQLQueryResolvers, 'getDecisionsTable'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLQueryResolvers, 'getDecisionsTable'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.getDecisionCountsTable({
      orgId: user.orgId,
      groupBy: params.input.groupBy.toLowerCase(),
      filterBy: {
        ...params.input.filterBy,
        startDate: new Date(params.input.filterBy.startDate),
        endDate: new Date(params.input.filterBy.endDate),
      },
      timeZone: params.input.timeZone,
    });
  }

  @Query('getSkipsForRecentDecisions')
  async getSkipsForRecentDecisions(
    @Parent() _: P<GQLQueryResolvers, 'getSkipsForRecentDecisions'>[0],
    @Args() { input }: P<GQLQueryResolvers, 'getSkipsForRecentDecisions'>[1],
    @Context() context: P<GQLQueryResolvers, 'getSkipsForRecentDecisions'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLQueryResolvers, 'getSkipsForRecentDecisions'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const filter = input.filter;

    return context.services.ManualReviewToolService.getSkippedJobsForRecentDecisions(
      {
        orgId: user.orgId,
        input: {
          userSearchString: filter.userSearchString ?? undefined,
          decisions: filter.decisions
            ? filterNullOrUndefined(
                filter.decisions.map((it) =>
                  it.userOrRelatedActionDecision
                    ? {
                        type: 'CUSTOM_ACTION',
                        actionIds: it.userOrRelatedActionDecision.actionIds,
                      }
                    : it.ignoreDecision
                      ? { type: 'IGNORE' }
                      : it.submitNcmecReportDecision
                        ? { type: 'SUBMIT_NCMEC_REPORT' }
                        : it.transformJobAndRecreateInQueueDecision
                          ? { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE' }
                          : it.acceptAppealDecision
                            ? {
                                type: 'ACCEPT_APPEAL',
                              }
                            : it.rejectAppealDecision
                              ? {
                                  type: 'REJECT_APPEAL',
                                }
                              : undefined,
                ),
              )
            : undefined,
          policyIds: filter.policyIds ?? undefined,
          reviewerIds: filter.reviewerIds ?? undefined,
          queueIds: filter.queueIds ?? undefined,
        },
      },
    );
  }
}

@Resolver('Mutation')
export class ManualReviewToolMutationResolver {
  @Mutation('dequeueManualReviewJob')
  async dequeueManualReviewJob(
    @Parent() _: P<GQLMutationResolvers, 'dequeueManualReviewJob'>[0],
    @Args() { queueId }: P<GQLMutationResolvers, 'dequeueManualReviewJob'>[1],
    @Context() context: P<GQLMutationResolvers, 'dequeueManualReviewJob'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'dequeueManualReviewJob'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
    }

    const reviewableQueues =
      await context.services.ManualReviewToolService.getReviewableQueuesForUser(
        {
          invoker: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
          queueIds: [queueId],
        },
      );
    if (reviewableQueues.length === 0) {
      throw forbiddenError('User does not have access to this queue');
    }

    const { id: userId, orgId } = user;
    const nextJob =
      await context.services.ManualReviewToolService.dequeueNextJob({
        orgId,
        queueId,
        userId,
      });
    if (!nextJob) {
      return null;
    }

    return {
      ...nextJob,
      numPendingJobs:
        await context.services.ManualReviewToolService.getPendingJobCount({
          orgId,
          queueId,
        }),
    };
  }

  @Mutation('submitManualReviewDecision')
  async submitManualReviewDecision(
    @Parent() _: P<GQLMutationResolvers, 'submitManualReviewDecision'>[0],
    @Args() params: P<GQLMutationResolvers, 'submitManualReviewDecision'>[1],
    @Context()
    context: P<GQLMutationResolvers, 'submitManualReviewDecision'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'submitManualReviewDecision'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
    }

    const { id: userId, orgId, email: userEmail } = user;

    const {
      queueId,
      jobId,
      lockToken,
      reportedItemDecisionComponents,
      relatedItemActions,
      decisionReason,
      reportHistory,
    } = params.input;

    await assertQueueIsReviewable({ id: queueId, orgId }, context);

    const decisionPayloads = reportedItemDecisionComponents.map(
      (reportedItemDecisionComponent) => {
        const decision = oneOfInputToTaggedUnion(
          reportedItemDecisionComponent,
          {
            userAction: 'CUSTOM_ACTION',
            ignore: 'IGNORE',
            submitNcmecReport: 'SUBMIT_NCMEC_REPORT',
            transformJobAndRecreateInQueue:
              'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE',
            rejectAppeal: 'REJECT_APPEAL',
            acceptAppeal: 'ACCEPT_APPEAL',
          },
        );
        return (() => {
          switch (decision.type) {
            case 'CUSTOM_ACTION':
              return {
                ...omit(decision, ['policyIds', 'actionIds']),
                policies: decision.policyIds.map((id) => ({
                  id,
                })),
                actions: decision.actionIds.map((actionId) => ({
                  id: actionId,
                })),
                actionIdsToMrtApiParamDecisionPayload:
                  decision.actionIdsToMrtApiParamDecisionPayload ?? undefined,
              };
            case 'ACCEPT_APPEAL':
            case 'REJECT_APPEAL':
            case 'IGNORE':
            case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
              return decision;
            case 'SUBMIT_NCMEC_REPORT':
              return {
                ...decision,
                escalateToHighPriority:
                  decision.escalateToHighPriority ?? undefined,
                additionalInfo: decision.additionalInfo ?? undefined,
              };

            default:
              assertUnreachable(decision);
          }
        })();
      },
    );

    try {
      const reportHistoryNoNullFields = reportHistory.map((report) => ({
        reportId: report.reportId,
        reason: report.reason === null ? undefined : report.reason,
        reporterId: report.reporterId === null ? undefined : report.reporterId,
        reportedAt: new Date(report.reportedAt),
        policyId: report.policyId === null ? undefined : report.policyId,
      }));

      const { warnings } =
        await context.services.ManualReviewToolService.submitDecision({
          reportHistory: [...reportHistoryNoNullFields],
          queueId,
          jobId,
          lockToken,
          decisionComponents: decisionPayloads,
          relatedActions: actionableRelatedActions(
            relatedItemActions.map((relatedAction) => ({
              actionIds: [...relatedAction.actionIds],
              itemIds: [...relatedAction.itemIds],
              itemTypeId: relatedAction.itemTypeId,
              policyIds: [...relatedAction.policyIds],
              ...(relatedAction.actionIdsToMrtApiParamDecisionPayload != null
                ? {
                    actionIdsToMrtApiParamDecisionPayload:
                      relatedAction.actionIdsToMrtApiParamDecisionPayload,
                  }
                : {}),
            })),
          ),
          reviewerId: userId,
          reviewerEmail: userEmail,
          orgId,
          decisionReason: decisionReason ?? undefined,
        });
      return gqlSuccessResult(
        { success: true, warnings },
        'SubmitDecisionSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, 'JobHasAlreadyBeenSubmittedError') ||
        isCoopErrorOfType(e, 'SubmittedJobActionNotFoundError') ||
        isCoopErrorOfType(e, 'NoJobWithIdInQueueError') ||
        isCoopErrorOfType(e, 'RecordingJobDecisionFailedError') ||
        isCoopErrorOfType(e, 'MissingRequiredDecisionReasonError') ||
        isCoopErrorOfType(e, 'MissingRequiredPolicyForDecisionError') ||
        isCoopErrorOfType(e, 'NcmecEscalationUnavailableError')
      ) {
        return gqlErrorResult(e);
      }
      if (isCoopErrorOfType(e, 'BadRequestError')) {
        throw userInputError(e.detail ?? e.title);
      }

      throw e;
    }
  }

  @Mutation('createManualReviewQueue')
  async createManualReviewQueue(
    @Parent() _: P<GQLMutationResolvers, 'createManualReviewQueue'>[0],
    @Args() params: P<GQLMutationResolvers, 'createManualReviewQueue'>[1],
    @Context() context: P<GQLMutationResolvers, 'createManualReviewQueue'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'createManualReviewQueue'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const {
      name,
      description,
      userIds,
      roleIds,
      hiddenActionIds,
      isAppealsQueue,
      autoCloseJobs,
      jobSortType,
      clearReportsDisposition,
      clearReportsScope,
      clearReportsTriggerActionIds,
    } = params.input;

    // createManualReviewQueue expects userIds to be unique so as to not violate the DB primary key for users_and_accessible_queues
    const userIdsWithCurrentUser = Array.from(new Set([...userIds, user.id]));
    try {
      const queue =
        await context.services.ManualReviewToolService.createManualReviewQueue({
          description: description ?? null,
          name,
          userIds: userIdsWithCurrentUser,
          roleIds,
          hiddenActionIds,
          isAppealsQueue,
          autoCloseJobs,
          jobSortType: jobSortType ?? undefined,
          clearReportsDisposition,
          clearReportsScope: clearReportsScope ?? undefined,
          clearReportsTriggerActionIds:
            clearReportsTriggerActionIds ?? undefined,
          invokedBy: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
        });

      const res = gqlSuccessResult(
        { data: queue },
        'MutateManualReviewQueueSuccessResponse',
      );
      return res;
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'ManualReviewQueueNameExistsError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  }

  @Mutation('updateManualReviewQueue')
  async updateManualReviewQueue(
    @Parent() _: P<GQLMutationResolvers, 'updateManualReviewQueue'>[0],
    @Args() params: P<GQLMutationResolvers, 'updateManualReviewQueue'>[1],
    @Context() context: P<GQLMutationResolvers, 'updateManualReviewQueue'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'updateManualReviewQueue'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)) {
      throw forbiddenError('User does not have permission to edit MRT queues');
    }

    const {
      id: queueId,
      name,
      description,
      userIds,
      roleIds,
      actionIdsToHide,
      actionIdsToUnhide,
      autoCloseJobs,
      jobSortType,
      clearReportsDisposition,
      clearReportsScope,
      clearReportsTriggerActionIds,
    } = params.input;
    try {
      const queue =
        await context.services.ManualReviewToolService.updateManualReviewQueue({
          queueId,
          orgId: user.orgId,
          description,
          name: name ?? undefined,
          // Include the user who's creating the queue as having permission to see
          // the queue
          userIds: [...userIds, user.id],
          roleIds,
          actionIdsToHide,
          actionIdsToUnhide,
          autoCloseJobs,
          jobSortType: jobSortType ?? undefined,
          clearReportsDisposition,
          clearReportsScope: clearReportsScope ?? undefined,
          clearReportsTriggerActionIds:
            clearReportsTriggerActionIds ?? undefined,
        });
      return gqlSuccessResult(
        { data: queue },
        'MutateManualReviewQueueSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'ManualReviewQueueNameExistsError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  }

  @Mutation('deleteManualReviewQueue')
  async deleteManualReviewQueue(
    @Parent() _: P<GQLMutationResolvers, 'deleteManualReviewQueue'>[0],
    @Args() params: P<GQLMutationResolvers, 'deleteManualReviewQueue'>[1],
    @Context() context: P<GQLMutationResolvers, 'deleteManualReviewQueue'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'deleteManualReviewQueue'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)) {
      throw forbiddenError('User does not have permission to edit MRT queues');
    }

    return context.services.ManualReviewToolService.deleteManualReviewQueue(
      user.orgId,
      params.id,
    );
  }

  @Mutation('addAccessibleQueuesToUser')
  async addAccessibleQueuesToUser(
    @Parent() _: P<GQLMutationResolvers, 'addAccessibleQueuesToUser'>[0],
    @Args() params: P<GQLMutationResolvers, 'addAccessibleQueuesToUser'>[1],
    @Context() context: P<GQLMutationResolvers, 'addAccessibleQueuesToUser'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'addAccessibleQueuesToUser'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)) {
      throw forbiddenError('User does not have permission to edit MRT queues');
    }

    await context.services.ManualReviewToolService.addAccessibleQueuesForUser({
      orgId: user.orgId,
      userId: params.input.userId,
      queueIds: params.input.queueIds,
    });

    // TODO: try/catch and return failure cases
    return gqlSuccessResult(
      { _: true },
      'MutateAccessibleQueuesForUserSuccessResponse',
    );
  }

  @Mutation('removeAccessibleQueuesToUser')
  async removeAccessibleQueuesToUser(
    @Parent() _: P<GQLMutationResolvers, 'removeAccessibleQueuesToUser'>[0],
    @Args() params: P<GQLMutationResolvers, 'removeAccessibleQueuesToUser'>[1],
    @Context()
    context: P<GQLMutationResolvers, 'removeAccessibleQueuesToUser'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLMutationResolvers, 'removeAccessibleQueuesToUser'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)) {
      throw forbiddenError('User does not have permission to edit MRT queues');
    }

    await context.services.ManualReviewToolService.removeAccessibleQueuesForUser(
      {
        orgId: user.orgId,
        userId: params.input.userId,
        queueIds: params.input.queueIds,
      },
    );

    // TODO: try/catch and return failure cases
    return gqlSuccessResult(
      { _: true },
      'MutateAccessibleQueuesForUserSuccessResponse',
    );
  }

  @Mutation('deleteAllJobsFromQueue')
  async deleteAllJobsFromQueue(
    @Parent() _: P<GQLMutationResolvers, 'deleteAllJobsFromQueue'>[0],
    @Args() params: P<GQLMutationResolvers, 'deleteAllJobsFromQueue'>[1],
    @Context() context: P<GQLMutationResolvers, 'deleteAllJobsFromQueue'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'deleteAllJobsFromQueue'>>>
  > {
    //TODO: this needs to write a decision now so we can send
    // a report decision callback to users for each of the jobs/reportIds
    // that are being deleted
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    // Admin-only: irreversible (pending payloads only live in Redis).
    // Recovery is via `server/bin/recover-mrt-queue.ts`.
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError('Only org admins can delete all jobs from a queue');
    }
    try {
      await context.services.ManualReviewToolService.deleteAllJobsFromQueue({
        orgId: user.orgId,
        queueId: params.queueId,
        userPermissions: user.getPermissions(),
      });
      return gqlSuccessResult(
        { _: true },
        'DeleteAllJobsFromQueueSuccessResponse',
      );
    } catch (e) {
      if (isCoopErrorOfType(e, 'DeleteAllJobsUnauthorizedError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  }

  @Mutation('invalidateReportsFromReporter')
  async invalidateReportsFromReporter(
    @Parent() _: P<GQLMutationResolvers, 'invalidateReportsFromReporter'>[0],
    @Args()
    { input }: P<GQLMutationResolvers, 'invalidateReportsFromReporter'>[1],
    @Context()
    context: P<GQLMutationResolvers, 'invalidateReportsFromReporter'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLMutationResolvers, 'invalidateReportsFromReporter'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const permissions = user.getPermissions();
    if (!permissions.includes(UserPermission.EDIT_MRT_QUEUES)) {
      throw forbiddenError(
        'User does not have permission to invalidate reports',
      );
    }

    return context.services.ManualReviewToolService.invalidateReportsFromReporter(
      {
        orgId: user.orgId,
        reporter: { typeId: input.reporter.typeId, id: input.reporter.id },
        reason: input.reason ?? undefined,
        jobId: input.jobId ?? undefined,
        invokedBy: {
          userId: user.id,
          permissions,
          orgId: user.orgId,
        },
      },
    );
  }

  @Mutation('createManualReviewJobComment')
  async createManualReviewJobComment(
    @Parent() _: P<GQLMutationResolvers, 'createManualReviewJobComment'>[0],
    @Args() params: P<GQLMutationResolvers, 'createManualReviewJobComment'>[1],
    @Context()
    context: P<GQLMutationResolvers, 'createManualReviewJobComment'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLMutationResolvers, 'createManualReviewJobComment'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    try {
      const { jobId, commentText } = params.input;
      const comment =
        await context.services.ManualReviewToolService.addJobComment({
          orgId: user.orgId,
          jobId,
          commentText,
          authorId: user.id,
        });

      return gqlSuccessResult(
        { comment },
        'AddManualReviewJobCommentSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  }

  @Mutation('deleteManualReviewJobComment')
  async deleteManualReviewJobComment(
    @Parent() _: P<GQLMutationResolvers, 'deleteManualReviewJobComment'>[0],
    @Args() params: P<GQLMutationResolvers, 'deleteManualReviewJobComment'>[1],
    @Context()
    context: P<GQLMutationResolvers, 'deleteManualReviewJobComment'>[2],
  ): Promise<
    Awaited<
      ReturnType<Fn<GQLMutationResolvers, 'deleteManualReviewJobComment'>>
    >
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const { id: userId, orgId } = user;
    try {
      const { jobId, commentId } = params.input;
      await context.services.ManualReviewToolService.deleteJobComment({
        orgId,
        jobId,
        userId,
        commentId,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  @Mutation('logSkip')
  async logSkip(
    @Parent() _: P<GQLMutationResolvers, 'logSkip'>[0],
    @Args() { input }: P<GQLMutationResolvers, 'logSkip'>[1],
    @Context() context: P<GQLMutationResolvers, 'logSkip'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLMutationResolvers, 'logSkip'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    try {
      await context.services.ManualReviewToolService.logSkip({
        orgId: user.orgId,
        jobId: input.jobId,
        queueId: input.queueId,
        userId: user.id,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  @Mutation('releaseJobLock')
  async releaseJobLock(
    @Parent() _: P<GQLMutationResolvers, 'releaseJobLock'>[0],
    @Args() { input }: P<GQLMutationResolvers, 'releaseJobLock'>[1],
    @Context() context: P<GQLMutationResolvers, 'releaseJobLock'>[2],
  ): Promise<Awaited<ReturnType<Fn<GQLMutationResolvers, 'releaseJobLock'>>>> {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    try {
      await context.services.ManualReviewToolService.releaseJobLock({
        orgId: user.orgId,
        jobId: input.jobId,
        queueId: input.queueId,
        lockToken: input.lockToken,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  @Mutation('setJobPriorityWeights')
  async setJobPriorityWeights(
    @Parent() _: P<GQLMutationResolvers, 'setJobPriorityWeights'>[0],
    @Args() params: P<GQLMutationResolvers, 'setJobPriorityWeights'>[1],
    @Context() context: P<GQLMutationResolvers, 'setJobPriorityWeights'>[2],
  ): Promise<
    Awaited<ReturnType<Fn<GQLMutationResolvers, 'setJobPriorityWeights'>>>
  > {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError(
        'User does not have permission to manage org settings',
      );
    }
    await context.services.ManualReviewToolService.setJobPriorityWeights({
      orgId: user.orgId,
      weights: params.input.weights,
    });
    return gqlSuccessResult(
      { _: true },
      'SetJobPriorityWeightsSuccessResponse',
    );
  }
}

@Resolver('ManualReviewDecisionComponent')
export class ManualReviewDecisionComponentResolver {
  @ResolveField('__resolveType')
  __resolveType(
    it: P<GQLManualReviewDecisionComponentResolvers, '__resolveType'>[0],
  ): ReturnType<
    Fn<GQLManualReviewDecisionComponentResolvers, '__resolveType'>
  > {
    switch (it.type) {
      case 'IGNORE':
        return 'IgnoreDecisionComponent';
      case 'CUSTOM_ACTION':
      case 'RELATED_ACTION':
        return 'UserOrRelatedActionDecisionComponent';
      case 'SUBMIT_NCMEC_REPORT':
        return 'SubmitNCMECReportDecisionComponent';
      case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
        return 'TransformJobAndRecreateInQueueDecisionComponent';
      case 'ACCEPT_APPEAL':
        return 'AcceptAppealDecisionComponent';
      case 'REJECT_APPEAL':
        return 'RejectAppealDecisionComponent';
      case 'AUTOMATIC_CLOSE':
        return 'AutomaticCloseDecisionComponent';
      default:
        assertUnreachable(it.type);
    }
  }
}

@Resolver('ManualReviewChartSettings')
export class ManualReviewChartSettingsResolver {
  @ResolveField('__resolveType')
  __resolveType(
    it: P<GQLManualReviewChartSettingsResolvers, '__resolveType'>[0],
  ): ReturnType<Fn<GQLManualReviewChartSettingsResolvers, '__resolveType'>> {
    switch (it.metric) {
      case 'DECISIONS':
        return 'GetDecisionCountSettings';
      case 'JOBS':
        return 'GetJobCreationCountSettings';
      default:
        assertUnreachable(it.metric);
    }
  }
}

/** The NestJS resolver classes of the MRT module, registered in `CoopGraphqlModule`. */
export const manualReviewToolResolverClasses = [
  ManualReviewJobEnqueueSourceInfoResolver,
  ManualReviewJobPayloadResolver,
  ContentManualReviewJobPayloadResolver,
  ContentAppealManualReviewJobPayloadResolver,
  UserManualReviewJobPayloadResolver,
  UserAppealManualReviewJobPayloadResolver,
  ThreadManualReviewJobPayloadResolver,
  ThreadAppealManualReviewJobPayloadResolver,
  NcmecManualReviewJobPayloadResolver,
  ManualReviewQueueResolver,
  ManualReviewDecisionResolver,
  ManualReviewJobCommentResolver,
  ManualReviewJobResolver,
  DequeueManualReviewJobResponseResolver,
  ManualReviewToolQueryResolver,
  ManualReviewToolMutationResolver,
  ManualReviewDecisionComponentResolver,
  ManualReviewChartSettingsResolver,
];

/** Plain resolver map built from the classes, for unit tests that call resolvers directly. */
export const resolvers = {
  ManualReviewJobEnqueueSourceInfo: resolverMapOf(
    new ManualReviewJobEnqueueSourceInfoResolver(),
  ),
  ManualReviewJobPayload: resolverMapOf(new ManualReviewJobPayloadResolver()),
  ContentManualReviewJobPayload: resolverMapOf(
    new ContentManualReviewJobPayloadResolver(),
  ),
  ContentAppealManualReviewJobPayload: resolverMapOf(
    new ContentAppealManualReviewJobPayloadResolver(),
  ),
  UserManualReviewJobPayload: resolverMapOf(
    new UserManualReviewJobPayloadResolver(),
  ),
  UserAppealManualReviewJobPayload: resolverMapOf(
    new UserAppealManualReviewJobPayloadResolver(),
  ),
  ThreadManualReviewJobPayload: resolverMapOf(
    new ThreadManualReviewJobPayloadResolver(),
  ),
  ThreadAppealManualReviewJobPayload: resolverMapOf(
    new ThreadAppealManualReviewJobPayloadResolver(),
  ),
  NcmecManualReviewJobPayload: resolverMapOf(
    new NcmecManualReviewJobPayloadResolver(),
  ),
  ManualReviewQueue: resolverMapOf(new ManualReviewQueueResolver()),
  ManualReviewDecision: resolverMapOf(new ManualReviewDecisionResolver()),
  ManualReviewJobComment: resolverMapOf(new ManualReviewJobCommentResolver()),
  ManualReviewJob: resolverMapOf(new ManualReviewJobResolver()),
  DequeueManualReviewJobResponse: resolverMapOf(
    new DequeueManualReviewJobResponseResolver(),
  ),
  Query: resolverMapOf(new ManualReviewToolQueryResolver()),
  Mutation: resolverMapOf(new ManualReviewToolMutationResolver()),
  ManualReviewDecisionComponent: resolverMapOf(
    new ManualReviewDecisionComponentResolver(),
  ),
  ManualReviewChartSettings: resolverMapOf(
    new ManualReviewChartSettingsResolver(),
  ),
};
