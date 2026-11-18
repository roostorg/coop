/* eslint-disable max-lines */

import { makeEnumLike } from '@roostorg/coop-types';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import {
  type ReadonlyDeep,
  type ReadonlyObjectDeep,
} from 'type-fest/source/readonly-deep.js';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../../iocContainer/index.js';
import { type ConsumerDirectives } from '../../../lib/cache/index.js';
import { type RuleExecutionResult } from '../../../rule_engine/RuleEvaluator.js';
import {
  schema,
  transactionWithRetry,
  type CoopDb,
  type CoopDbOrTx,
} from '../../../storage/postgres/drizzle.js';
import { cached } from '../../../utils/caching.js';
import { moveArrayElement } from '../../../utils/collections.js';
import { getSourceType } from '../../../utils/correlationIds.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { equalLengthZip } from '../../../utils/fp-helpers.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';
import { replaceEmptyStringWithNull } from '../../../utils/string.js';
import {
  type NonEmptyArray,
  type NonEmptyString,
} from '../../../utils/typescript-types.js';
import { type ActionExecutionCorrelationId } from '../../analyticsLoggers/ActionExecutionLogger.js';
import { type RuleExecutionCorrelationId } from '../../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { type ItemSubmission } from '../../itemProcessingService/index.js';
import { itemSubmissionWithTypeIdentifierToItemSubmission } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type ConditionSet } from '../../moderationConfigService/index.js';
import { type ManualReviewJobPayload } from '../manualReviewToolService.js';
import type QueueOperations from './QueueOperations.js';

export const RoutingRuleStatus = makeEnumLike(['LIVE']);
export type RoutingRuleStatus = keyof typeof RoutingRuleStatus;

export type RoutingRule = ReadonlyDeep<{
  id: string;
  orgId: string;
  creatorId: string;
  name: string;
  description?: string | null;
  status: RoutingRuleStatus;
  conditionSet: ConditionSet;
  destinationQueueId: string;
  itemTypeIds: string[];
  version: string;
}>;

export type RoutingRuleWithoutVersion = Omit<RoutingRule, 'version'>;

export type CreateRoutingRuleInput = Readonly<{
  orgId: string;
  name: string;
  description?: string | null;
  status: RoutingRuleStatus;
  itemTypeIds: NonEmptyArray<NonEmptyString>;
  creatorId: string;
  conditionSet: ConditionSet;
  destinationQueueId: string;
  sequenceNumber?: number | null;
  isAppealsRule?: boolean;
}>;

export type UpdateRoutingRuleInput = Readonly<{
  id: string;
  orgId: string;
  name?: string;
  description?: string | null;
  status?: RoutingRuleStatus;
  itemTypeIds?: NonEmptyArray<NonEmptyString>;
  conditionSet?: ConditionSet;
  destinationQueueId?: string;
  sequenceNumber?: number | null;
  isAppealsRule?: boolean;
}>;

export type ReorderRoutingRulesInput = {
  orgId: string;
  order: readonly string[];
  isAppealsRule?: boolean;
};

const routingRules = schema.routingRules;
const routingRulesToItemTypes = schema.routingRulesToItemTypes;
const routingRuleVersions = schema.routingRuleVersions;

const routingRuleSelection = {
  id: routingRules.id,
  orgId: routingRules.orgId,
  creatorId: routingRules.creatorId,
  name: routingRules.name,
  description: routingRules.description,
  status: routingRules.status,
  conditionSet: routingRules.conditionSet,
  destinationQueueId: routingRules.destinationQueueId,
};

type RoutingRuleRow = {
  id: string;
  orgId: string;
  creatorId: string;
  name: string;
  description: string | null;
  status: RoutingRuleStatus;
  conditionSet: ConditionSet;
  destinationQueueId: string;
};

export default class JobRouting {
  private readonly routingRulesCache;

  constructor(
    private readonly db: CoopDb,
    private readonly queueOps: QueueOperations,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly ruleEvaluator: Dependencies['RuleEvaluator'],
    private readonly routingRuleExecutionLogger: Dependencies['RoutingRuleExecutionLogger'],
  ) {
    this.routingRulesCache = cached({
      producer: async (orgId: string) =>
        this.#getRoutingRulesBypassCache(orgId, db),
      directives: { freshUntilAge: 15, maxStale: [0, 2, 2] },
    });
  }

  async getRoutingRules(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }) {
    const { orgId, directives } = opts;

    return this.routingRulesCache(orgId, directives);
  }

  async createRoutingRule(input: CreateRoutingRuleInput) {
    const {
      orgId,
      name,
      description,
      status,
      conditionSet,
      destinationQueueId,
      creatorId,
      itemTypeIds,
      sequenceNumber,
    } = input;

    // NB: we don't need to store this, since it returns void, but it will throw
    // if the queue doesn't exist
    await this.queueOps.checkQueueExists(orgId, destinationQueueId);

    return transactionWithRetry(this.db, async (tx) => {
      const nextSequenceNumber = tx
        .select({
          next: sql<number>`coalesce(max(${routingRules.sequenceNumber}), 0) + 1`,
        })
        .from(routingRules)
        .where(eq(routingRules.orgId, orgId));

      const [routingRule] = (await tx
        .insert(routingRules)
        .values({
          id: uuidv1(),
          orgId,
          name,
          description: replaceEmptyStringWithNull(description),
          status,
          conditionSet,
          destinationQueueId,
          creatorId,
          sequenceNumber: sql`(${nextSequenceNumber})`,
        })
        .returning(routingRuleSelection)) as [RoutingRuleRow];

      await tx.insert(routingRulesToItemTypes).values(
        itemTypeIds.map((itemTypeId) => ({
          routingRuleId: routingRule.id,
          itemTypeId,
        })),
      );

      if (sequenceNumber) {
        await this.#reorderOneRoutingRule(
          orgId,
          routingRule.id,
          sequenceNumber,
          tx,
        );
      }

      return {
        ...routingRule,
        itemTypeIds,
      };
    }).catch((e) => {
      throw isRoutingRuleNameExistsError(e)
        ? makeRoutingRuleNameExistsError({
            detail:
              'The routing rule was not recorded because the name ' +
              'already exists.',
            cause: e,
            shouldErrorSpan: true,
          })
        : e;
    });
  }

  async updateRoutingRule(input: UpdateRoutingRuleInput) {
    const {
      id,
      orgId,
      name,
      description,
      status,
      conditionSet,
      itemTypeIds,
      destinationQueueId,
      sequenceNumber,
    } = input;

    // NB: we don't need to store this, since it returns void, but it will throw
    // if the queue doesn't exist. In this case, we only check if the queue
    // exists if a destinationQueueId is passed in (since it's not required on
    // updated...if a key is null, it would be a no-op for that key)
    if (destinationQueueId) {
      await this.queueOps.checkQueueExists(orgId, destinationQueueId);
    }

    return transactionWithRetry(this.db, async (tx) => {
      const [updatedRoutingRule] = (await tx
        .update(routingRules)
        .set(
          removeUndefinedKeys({
            name,
            description: replaceEmptyStringWithNull(description),
            status,
            conditionSet,
            destinationQueueId,
          }),
        )
        .where(and(eq(routingRules.id, id), eq(routingRules.orgId, orgId)))
        .returning(routingRuleSelection)) as [RoutingRuleRow | undefined];

      if (!updatedRoutingRule) {
        throw makeRoutingRuleNotFoundError({
          detail:
            'The provided routing rule was not found. Please ' +
            'refresh the page and try again.',
          shouldErrorSpan: true,
        });
      }

      if (itemTypeIds) {
        // delete item types that will no longer be used
        await tx
          .delete(routingRulesToItemTypes)
          .where(
            and(
              eq(routingRulesToItemTypes.routingRuleId, id),
              notInArray(routingRulesToItemTypes.itemTypeId, itemTypeIds),
            ),
          );

        // insert new item types, ignore if they're already there
        await tx
          .insert(routingRulesToItemTypes)
          .values(
            itemTypeIds.map((itemTypeId) => ({
              routingRuleId: id,
              itemTypeId,
            })),
          )
          .onConflictDoNothing({
            target: [
              routingRulesToItemTypes.routingRuleId,
              routingRulesToItemTypes.itemTypeId,
            ],
          });
      }

      if (sequenceNumber) {
        await this.#reorderOneRoutingRule(orgId, id, sequenceNumber, tx);
      }

      return {
        ...updatedRoutingRule,
        itemTypeIds:
          itemTypeIds ?? (await this.#getItemTypeIdsForRoutingRule(id, tx)),
      };
    }).catch((e) => {
      if (isRoutingRuleNameExistsError(e))
        throw makeRoutingRuleNameExistsError({
          detail:
            'The update for the routing rule was not recorded because ' +
            'the new name already exists.',
          cause: e,
          shouldErrorSpan: true,
        });

      throw e;
    });
  }

  /**
   * This method is used to delete a routing rule.
   * @param input - An object containing the id of the routing rule to be
   *   deleted.
   * @returns A promise that resolves to a boolean indicating the success of the
   *   operation.
   */
  async deleteRoutingRule(input: {
    id: string;
    orgId: string;
  }): Promise<boolean> {
    const { id, orgId } = input;
    const deleted = await transactionWithRetry(this.db, async (tx) =>
      tx
        .delete(routingRules)
        .where(and(eq(routingRules.id, id), eq(routingRules.orgId, orgId)))
        .returning({ id: routingRules.id }),
    );
    return deleted.length === 1;
  }

  async reorderRoutingRules(
    input: ReorderRoutingRulesInput,
    db: CoopDbOrTx = this.db,
  ) {
    // get existing rules in any order
    const rules = await db
      .select({
        id: routingRules.id,
        sequenceNumber: routingRules.sequenceNumber,
      })
      .from(routingRules)
      .where(eq(routingRules.orgId, input.orgId));

    // assign new indices to old indices
    const sequenceMapping = rules.map((rule) => ({
      old: rule.sequenceNumber,
      new: input.order.indexOf(rule.id),
    }));

    // Note that we can't just do multiple updates because
    // there will be a unique sequence_number constraint violation,
    // even despite it being marked as `deferrable initially deferred`.
    // As an added benefit, the CASE WHEN ... END query is also faster.
    if (sequenceMapping.length > 0) {
      await db
        .update(routingRules)
        .set({
          sequenceNumber: sql`case ${sql.join(
            sequenceMapping.map(
              (seqChange) =>
                sql`when ${routingRules.sequenceNumber} = ${seqChange.old} then ${seqChange.new}::integer`,
            ),
            sql` `,
          )} else ${routingRules.sequenceNumber} end`,
        })
        .where(eq(routingRules.orgId, input.orgId));
    }

    // Reuse the existing getRoutingRules function to get the rules in the new
    // order. Alternatively, we could have had a 'returning' clause on the
    // update, but then we would've needed to sort the rules in memory or do
    // something like this: https://stackoverflow.com/a/25650188/1261879.
    // Plus, a separate query to retrieve itemTypeIds for each rule would be
    // needed anyway, so the complexity didn't seem worth it.
    return this.#getRoutingRulesBypassCache(input.orgId, db);
  }

  async #getRoutingRulesOrder(orgId: string, db: CoopDbOrTx = this.db) {
    return (
      await db
        .select({ id: routingRules.id })
        .from(routingRules)
        .where(eq(routingRules.orgId, orgId))
        .orderBy(routingRules.sequenceNumber)
    ).map((rule) => rule.id);
  }

  async #reorderOneRoutingRule(
    orgId: string,
    routingRuleId: string,
    newSequenceNumber: number,
    db: CoopDbOrTx = this.db,
  ) {
    const currentOrder = await this.#getRoutingRulesOrder(orgId, db);

    // sequence numbers start with 1
    if (newSequenceNumber >= 1 && newSequenceNumber <= currentOrder.length) {
      const oldSequenceNumber = currentOrder.indexOf(routingRuleId);

      if (oldSequenceNumber !== -1) {
        const newOrder = moveArrayElement(
          currentOrder,
          oldSequenceNumber,
          newSequenceNumber,
        );

        await this.reorderRoutingRules(
          {
            orgId,
            order: newOrder,
          },
          db,
        );
      }
    }
  }

  /**
   * This method is used to get item type IDs for a specific routing rule.
   * @param ruleId - The ID of the routing rule for which to fetch the item type
   *   IDs.
   * @param db - The database transaction object.
   * @returns A promise that resolves to an array of item type IDs.
   */
  async #getItemTypeIdsForRoutingRule(
    routingRuleId: string,
    db: CoopDbOrTx = this.db,
  ) {
    const results = await db
      .select({ itemTypeId: routingRulesToItemTypes.itemTypeId })
      .from(routingRulesToItemTypes)
      .where(eq(routingRulesToItemTypes.routingRuleId, routingRuleId));

    return results.map((row) => row.itemTypeId);
  }

  /**
   * This function runs the routing rules for a given item submission. It runs
   * the rules in the order provided, skipping any that don't apply to the item
   * type, and returns the destinationQueueId of the first passing rule (if any).
   *
   * @param routingRules - The list of routing rules to run
   * @param itemSubmission - The item submission to run the rules against
   * @param correlationId - The correlation ID to use for logging
   * @param mrtJobKind - The kind of MRT job being processed (DEFAULT vs NCMEC)
   */
  async #runRoutingRules(opts: {
    routingRules: readonly ReadonlyObjectDeep<RoutingRule>[];
    itemSubmission: ItemSubmission;
    policyIds: string[];
    correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
    mrtJobKind: ManualReviewJobPayload['kind'];
  }): Promise<string | null> {
    const {
      routingRules,
      itemSubmission,
      correlationId,
      mrtJobKind,
      policyIds,
    } = opts;

    const sourceType = getSourceType(correlationId);

    const evaluationContext = this.ruleEvaluator.makeRuleExecutionContext({
      orgId: itemSubmission.itemType.orgId,
      input: { ...itemSubmission, policyIds, sourceType },
    });

    const isApplicableRule = (
      rule: ReadonlyObjectDeep<RoutingRule>,
      input: ItemSubmission,
    ) => rule.itemTypeIds.includes(input.itemType.id);

    // run rules in order so we can skip running ones after first one passes.
    const results: ReadonlyObjectDeep<RuleExecutionResult>[] = [];
    let destinationQueueId: string | null = null;
    for (const rule of routingRules) {
      const shouldRunRule =
        !destinationQueueId && isApplicableRule(rule, itemSubmission);

      const ruleResult = shouldRunRule
        ? await this.ruleEvaluator.runRule(rule.conditionSet, evaluationContext)
        : { passed: false, conditionResults: rule.conditionSet };

      results.push(ruleResult);
      if (destinationQueueId == null && ruleResult.passed) {
        destinationQueueId = rule.destinationQueueId;
      }
    }

    const rulesToResults = new Map(equalLengthZip(routingRules, results));

    await this.routingRuleExecutionLogger.logRoutingRuleExecutions(
      [...rulesToResults.entries()].map(([rule, result]) => ({
        orgId: evaluationContext.org.id,
        routingRule: {
          id: rule.id,
          name: rule.name,
          version: rule.version,
          destinationQueueId: rule.destinationQueueId,
        },
        ruleInput: itemSubmission,
        result: result.conditionResults,
        correlationId,
        passed: result.passed,
        manualReviewJobKind: mrtJobKind,
      })),
    );

    return destinationQueueId;
  }

  /**
   * Return type annotation is intentional to make sure we're always throwing,
   * rather than returning undefined, if we can't find a default queue.
   */
  async getQueueIdForJob(input: {
    orgId: string;
    correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
    payload: ManualReviewJobPayload;
    policyIds: string[];
    routingRuleCacheDirectives?: ConsumerDirectives;
  }): Promise<string> {
    const {
      orgId,
      correlationId,
      payload,
      policyIds,
      routingRuleCacheDirectives,
    } = input;

    const routingRules = await this.getRoutingRules({
      orgId,
      directives: routingRuleCacheDirectives,
    });

    const type = await this.moderationConfigService.getItemType({
      orgId,
      itemTypeSelector: payload.item.itemTypeIdentifier,
    });
    if (!type) {
      throw Error("Couldn't find item type");
    }

    const itemSubmission = itemSubmissionWithTypeIdentifierToItemSubmission(
      payload.item,
      type,
    );

    const destinationQueueId = await this.#runRoutingRules({
      routingRules,
      itemSubmission,
      policyIds,
      correlationId,
      mrtJobKind: payload.kind,
    });

    return (
      destinationQueueId ?? (await this.queueOps.getDefaultQueueIdForOrg(orgId))
    );
  }

  async #getRoutingRulesBypassCache(orgId: string, db: CoopDbOrTx) {
    const v = routingRuleVersions;
    // The materialized view's columns are all nullable in the model; rows
    // that are current always come from routing_rules, so they are non-null.
    // `version` is a Date at runtime (as it was under Kysely), though
    // RoutingRule types it as string.
    return (await db
      .select({
        id: v.id,
        orgId: v.orgId,
        creatorId: v.creatorId,
        name: v.name,
        description: v.description,
        status: v.status,
        conditionSet: v.conditionSet,
        destinationQueueId: v.destinationQueueId,
        itemTypeIds: sql<
          string[]
        >`json_agg(${routingRulesToItemTypes.itemTypeId})`,
        version: v.version,
      })
      .from(v)
      .innerJoin(
        routingRulesToItemTypes,
        eq(v.id, routingRulesToItemTypes.routingRuleId),
      )
      .where(and(eq(v.orgId, orgId), eq(v.isCurrent, true)))
      .groupBy(
        v.id,
        v.orgId,
        v.creatorId,
        v.name,
        v.description,
        v.status,
        v.conditionSet,
        v.destinationQueueId,
        v.version,
        v.sequenceNumber,
      )
      .orderBy(v.sequenceNumber)) as unknown as (RoutingRuleRow & {
      itemTypeIds: string[];
      version: string;
    })[];
  }

  async close() {
    return this.routingRulesCache.close();
  }
}

export type RoutingRuleErrorType =
  | 'RoutingRuleNameExistsError'
  | 'ReorderRoutingRulesError'
  | 'QueueDoesNotExistError';

/**
 * True for a unique violation on `constraintName`, whether `error` is the pg
 * error itself or Drizzle's DrizzleQueryError wrapping it as `cause`.
 */
export function isUniqueViolationOnConstraint(
  error: unknown,
  constraintName: string,
) {
  if (!isUniqueViolationError(error)) {
    return false;
  }
  const constraintOf = (e: unknown) =>
    typeof e === 'object' && e !== null
      ? (e as { constraint?: unknown }).constraint
      : undefined;
  return (
    constraintOf(error) === constraintName ||
    constraintOf((error as { cause?: unknown }).cause) === constraintName
  );
}

function isRoutingRuleNameExistsError(error: unknown) {
  return isUniqueViolationOnConstraint(error, 'routing_rules_org_id_name_key');
}

export const makeRoutingRuleNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'A routing rule with this name already exists.',
    name: 'RoutingRuleNameExistsError',
    ...data,
  });

export const makeRoutingRuleNotFoundError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 404,
    type: [ErrorType.InvalidUserInput],
    title: 'A routing rule with this ID is not found',
    name: 'NotFoundError',
    ...data,
  });
