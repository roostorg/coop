import { type ItemIdentifier } from '@roostorg/types';
import _ from 'lodash';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  getUserFromActionTargetItem,
  type ActionExecutionData,
  type ActionTargetItem,
} from '../../rule_engine/ActionPublisher.js';
import {
  itemIdentifierToScyllaItemIdentifier,
  scyllaItemIdentifierToItemIdentifier,
  type Scylla,
} from '../../scylla/index.js';
import { type ActionExecutionCorrelationId } from '../analyticsLoggers/ActionExecutionLogger.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import {
  type Action,
  type ModerationConfigService,
} from '../moderationConfigService/index.js';
import { type UserStrikesScyllaRelations } from './dbTypes.js';
import { type IActionExecutionsAdapter } from '../../plugins/warehouse/queries/IActionExecutionsAdapter.js';

const { maxBy } = _;

export class UserStrikeService {
  constructor(
    private readonly scylla: Scylla<UserStrikesScyllaRelations>,
    private readonly moderationConfigService: ModerationConfigService,
    private readonly getUserStrikeTTLinDays: Dependencies['getUserStrikeTTLInDaysEventuallyConsistent'],
    private readonly actionExecutionsAdapter: IActionExecutionsAdapter,
    private readonly publishActions: Dependencies['ActionPublisher']['publishActions'],
  ) {
    this.scylla = scylla;
    this.moderationConfigService = moderationConfigService;
    this.publishActions = publishActions;
  }

  async getUserStrikes(orgId: string, userId: ItemIdentifier) {
    return this.scylla.select({
      from: 'user_strikes',
      select: '*',
      where: [
        ['org_id', '=', orgId],
        ['user_identifier', '=', itemIdentifierToScyllaItemIdentifier(userId)],
      ],
    });
  }
  async getUserStrikeValue(orgId: string, userId: ItemIdentifier) {
    const strikes = await this.scylla.select({
      from: 'user_strikes',
      select: [
        'org_id',
        'user_identifier',
        { aggregate: 'sum', col: 'user_strike_count' },
      ],
      where: [
        ['org_id', '=', orgId],
        ['user_identifier', '=', itemIdentifierToScyllaItemIdentifier(userId)],
      ],
    });
    return strikes[0]?.user_strike_count ?? 0;
  }
  async getAllUserStrikeCountsForOrg(orgId: string) {
    const strikes = await this.scylla.select({
      from: 'user_strikes',
      select: [
        'user_identifier',
        { aggregate: 'sum', col: 'user_strike_count' },
      ],
      where: [['org_id', '=', orgId]],
      groupBy: ['org_id', 'user_identifier'],
    });
    return strikes.map((it) => ({
      user_identifier: scyllaItemIdentifierToItemIdentifier(it.user_identifier),
      strike_count: it.user_strike_count,
    }));
  }

  async applyUserStrikeFromPublishedActions<
    T extends ActionExecutionCorrelationId,
    U extends ActionTargetItem,
  >(
    triggeredActions: Omit<
      Omit<ActionExecutionData<T>, 'action'> & { action: Action },
      'orgId' | 'correlationId' | 'targetItem'
    >[],
    executionContext: {
      orgId: string;
      correlationId: T;
      targetItem: U;
      sync?: boolean;
      actorId?: string;
      actorEmail?: string;
    },
  ) {
    const targetUser = getUserFromActionTargetItem(executionContext.targetItem);
    const mostSeverePolicy =
      this.findMostSeverePolicyViolationFromActions(triggeredActions);

    if (
      mostSeverePolicy === undefined ||
      mostSeverePolicy.userStrikeCount === 0 ||
      targetUser == null
    ) {
      return;
    }
    // this variable is not really necessary, but helps
    // TS keep track of the properly narrowed type of
    // `mostSeverePolicy.userStrikeCount`, which can only be a number by this point
    const currentStrikesToApply = mostSeverePolicy.userStrikeCount;

    // we should get the user's current violation count
    // before applying the strike to avoid double counting
    const currentUserStrikes = await this.getUserStrikeValue(
      executionContext.orgId,
      targetUser,
    );

    await this.applyUserStrike(
      executionContext.orgId,
      targetUser,
      mostSeverePolicy.id,
      mostSeverePolicy.userStrikeCount,
    );

    // find threshold rules
    const orgThresholds =
      await this.moderationConfigService.getUserStrikeThresholdsForOrg(
        executionContext.orgId,
      );

    if (orgThresholds.length === 0) {
      return;
    }
    // To find which, if any, threshold rules to apply to this user, we
    // 1. find all threshold rules that specify a threshold that is greater
    //    than the user's current strike count (meaning this current strike
    //    application could trigger the threshold rule)
    // 2. find all the thresholds that have been crossed by applying the current
    //    strike to the user
    // 3. find the greatest/most severe threshold rule that has been crossed.
    //    i.e. we will not apply multiple threshold rules if multiple are
    //    crossed at once, only the last/most severe one
    const thresholdRuleToApply = orgThresholds
      .filter((it) => it.threshold > currentUserStrikes)
      .filter(
        (it) => currentUserStrikes + currentStrikesToApply >= it.threshold,
      )
      // sort by threshold in descending order
      .sort((a, b) => b.threshold - a.threshold)[0];

    // construst the actions to publish
    const actionsToPublish = await this.moderationConfigService.getActions({
      orgId: executionContext.orgId,
      ids: thresholdRuleToApply.actions,
      readFromReplica: true,
    });
    const actionExecutionDataArray = actionsToPublish.map((action) => ({
      action,
      orgId: executionContext.orgId,
      targetItem: executionContext.targetItem,
      policies: [],
      matchingRules: undefined,
      ruleEnvironment: undefined,
    }));
    await this.publishActions(actionExecutionDataArray, {
      orgId: executionContext.orgId,
      correlationId: toCorrelationId({
        type: 'user-strike-action-execution',
        id: uid(),
      }),
      targetItem: executionContext.targetItem,
      actorId: undefined,
      actorEmail: undefined,
    });
  }

  findMostSeverePolicyViolationFromActions<
    T extends ActionExecutionCorrelationId,
  >(
    triggeredActions: Omit<
      Omit<ActionExecutionData<T>, 'action'> & { action: Action },
      'orgId' | 'correlationId' | 'targetItem'
    >[],
  ) {
    const mostSeverePolicyPerAction = filterNullOrUndefined(
      triggeredActions.map((action) => {
        if (action.action.applyUserStrikes === false) {
          return undefined;
        }
        return maxBy(action.policies, (policy) => policy.userStrikeCount);
      }),
    );
    return maxBy(mostSeverePolicyPerAction, (policy) => policy.userStrikeCount);
  }

  async applyUserStrike(
    orgId: string,
    userId: ItemIdentifier,
    policyId: string,
    numStrikes: number,
  ) {
    const ttlInDays = await this.getUserStrikeTTLinDays(orgId);

    await this.scylla.insert({
      into: 'user_strikes',
      row: {
        user_identifier: itemIdentifierToScyllaItemIdentifier(userId),
        created_at: new Date(),
        policy_id: policyId,
        org_id: orgId,
        user_strike_count: numStrikes,
      },
      // The table has a default TTL of 90 Days, which we will usually override
      // with the org's configured TTL. In the case we don't find one, we can
      // just let the database use the TTL instead of specifying a default in the
      // insert statement.
      ttlInSeconds: ttlInDays ? ttlInDays * 24 * 60 * 60 : undefined,
    });
  }

  async getRecentUserStrikeActions(opts: {
    orgId: string;
    filterBy?: {
      startDate?: Date;
      endDate?: Date;
    };
    limit?: number;
  }) {
    const { orgId, filterBy, limit } = opts;
    const results = await this.actionExecutionsAdapter.getRecentUserStrikeActions({
      orgId,
      filterBy,
      limit,
    });
    return filterNullOrUndefined(
      results.map((it) =>
        it.itemId && it.itemTypeId
          ? {
              actionId: it.actionId,
              itemId: it.itemId,
              itemTypeId: it.itemTypeId,
              source: it.source,
              time: it.occurredAt,
            }
          : undefined,
      ),
    );
  }
}
