/* eslint-disable max-lines */

import { makeEnumLike } from '@roostorg/coop-types';
import {
  type ReadonlyDeep,
  type ReadonlyObjectDeep,
} from 'type-fest/source/readonly-deep.js';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../../iocContainer/index.js';
import { type ConsumerDirectives } from '../../../lib/cache/index.js';
import { type RuleExecutionResult } from '../../../rule_engine/RuleEvaluator.js';
import {
  assertNonEmptyIdList,
  Prisma,
  type PrismaPgClient,
  type PrismaPgQueryable,
} from '../../../storage/prisma/index.js';
import { cached } from '../../../utils/caching.js';
import { moveArrayElement } from '../../../utils/collections.js';
import { getSourceType } from '../../../utils/correlationIds.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { equalLengthZip } from '../../../utils/fp-helpers.js';
import {
  getPgErrorDetails,
  isUniqueViolationError,
} from '../../../utils/kysely.js';
import { __throw, removeUndefinedKeys } from '../../../utils/misc.js';
import {
  makePrismaTransactionWithRetry,
  type PrismaTransactionWithRetry,
} from '../../../utils/prismaTransactionWithRetry.js';
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

export const routingRuleSelect = {
  id: true,
  org_id: true,
  creator_id: true,
  name: true,
  description: true,
  status: true,
  condition_set: true,
  destination_queue_id: true,
} as const;

export type RoutingRuleRow = {
  id: string;
  org_id: string;
  creator_id: string;
  name: string;
  description: string | null;
  status: RoutingRuleStatus;
  condition_set: Prisma.JsonValue;
  destination_queue_id: string;
};

/**
 * Shared with AppealsJobRouting. `condition_set` comes back from Prisma as
 * untyped JSON; Kysely's table type declared it as ConditionSet.
 */
export function toRoutingRuleWithoutItemTypes(row: RoutingRuleRow) {
  return {
    id: row.id,
    orgId: row.org_id,
    creatorId: row.creator_id,
    name: row.name,
    description: row.description,
    status: row.status,
    conditionSet: row.condition_set as unknown as ConditionSet,
    destinationQueueId: row.destination_queue_id,
  };
}

/** A current rule version with its item types, as the routing read returns it. */
export type RoutingRuleVersionRow = {
  id: string;
  orgId: string;
  creatorId: string;
  name: string;
  description: string | null;
  status: RoutingRuleStatus;
  conditionSet: ConditionSet;
  destinationQueueId: string;
  itemTypeIds: string[];
  // The matview column is timestamptz, so the driver returns a Date at
  // runtime (as it did under Kysely, whose table type also claimed string).
  version: string;
};

/**
 * Thrown inside the update transaction when no rule matched; stands in for
 * Kysely's NoResultError from executeTakeFirstOrThrow.
 */
export class RoutingRuleNoResultError extends Error {
  constructor() {
    super('no result');
    this.name = 'RoutingRuleNoResultError';
  }
}

export default class JobRouting {
  private readonly routingRulesCache;
  private readonly transactionWithRetry: PrismaTransactionWithRetry;

  constructor(
    private readonly prisma: PrismaPgClient,
    private readonly queueOps: QueueOperations,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly ruleEvaluator: Dependencies['RuleEvaluator'],
    private readonly routingRuleExecutionLogger: Dependencies['RoutingRuleExecutionLogger'],
  ) {
    this.routingRulesCache = cached({
      producer: async (orgId: string) =>
        this.#getRoutingRulesBypassCache(orgId, prisma),
      directives: { freshUntilAge: 15, maxStale: [0, 2, 2] },
    });
    this.transactionWithRetry = makePrismaTransactionWithRetry(this.prisma);
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

    return this.transactionWithRetry(async (trx) => {
      // Kysely computed this in an INSERT ... (SELECT max(...)) subquery;
      // Prisma's create can't embed a subquery, so it's a separate read in
      // the same transaction (same race window under READ COMMITTED).
      const { _max } = await trx.routing_rules.aggregate({
        where: { org_id: orgId },
        _max: { sequence_number: true },
      });
      const routingRule = toRoutingRuleWithoutItemTypes(
        await trx.routing_rules.create({
          select: routingRuleSelect,
          data: {
            id: uuidv1(),
            org_id: orgId,
            name,
            description: replaceEmptyStringWithNull(description),
            status,
            condition_set: conditionSet,
            destination_queue_id: destinationQueueId,
            creator_id: creatorId,
            sequence_number: (_max.sequence_number ?? 0) + 1,
          },
        }),
      );

      await trx.routing_rules_to_item_types.createMany({
        data: itemTypeIds.map((itemTypeId) => ({
          routing_rule_id: routingRule.id,
          item_type_id: itemTypeId,
        })),
      });

      if (sequenceNumber) {
        await this.#reorderOneRoutingRule(
          orgId,
          routingRule.id,
          sequenceNumber,
          trx,
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

    return this.transactionWithRetry(async (trx) => {
      const [updatedRow] = (await trx.routing_rules.updateManyAndReturn({
        select: routingRuleSelect,
        where: { id, org_id: orgId },
        data: removeUndefinedKeys({
          name,
          description: replaceEmptyStringWithNull(description),
          status,
          condition_set: conditionSet,
          destination_queue_id: destinationQueueId,
        }),
      })) as (RoutingRuleRow | undefined)[];
      if (updatedRow === undefined) {
        throw new RoutingRuleNoResultError();
      }
      const updatedRoutingRule = toRoutingRuleWithoutItemTypes(updatedRow);

      if (itemTypeIds) {
        assertNonEmptyIdList('itemTypeIds', itemTypeIds);
        // delete item types that will no longer be used
        await trx.routing_rules_to_item_types.deleteMany({
          where: { routing_rule_id: id, item_type_id: { notIn: itemTypeIds } },
        });

        // insert new item types, ignore if they're already there
        await trx.routing_rules_to_item_types.createMany({
          data: itemTypeIds.map((itemTypeId) => ({
            routing_rule_id: id,
            item_type_id: itemTypeId,
          })),
          skipDuplicates: true,
        });
      }

      if (sequenceNumber) {
        await this.#reorderOneRoutingRule(orgId, id, sequenceNumber, trx);
      }

      return {
        ...updatedRoutingRule,
        itemTypeIds:
          itemTypeIds ?? (await this.#getItemTypeIdsForRoutingRule(id, trx)),
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

      if (isRoutingRuleNotFoundError(e))
        throw makeRoutingRuleNotFoundError({
          detail:
            'The provided routing rule was not found. Please ' +
            'refresh the page and try again.',
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
    const result = await this.transactionWithRetry(async (trx) =>
      trx.routing_rules.deleteMany({ where: { id, org_id: orgId } }),
    );
    return result.count === 1;
  }

  async reorderRoutingRules(
    input: ReorderRoutingRulesInput,
    db: PrismaPgQueryable = this.prisma,
  ) {
    // get existing rules in any order
    const rules = await db.routing_rules.findMany({
      select: { id: true, sequence_number: true },
      where: { org_id: input.orgId },
    });

    // assign new indices to old indices
    const sequenceMapping = rules.map((rule) => ({
      old: rule.sequence_number,
      new: input.order.indexOf(rule.id),
    }));

    // Note that we can't just do multiple updates because
    // there will be a unique sequence_number constraint violation,
    // even despite it being marked as `deferrable initially deferred`.
    // As an added benefit, the CASE WHEN ... END query is also faster.
    // An org with no rules has nothing to renumber (Kysely emitted an invalid
    // `CASE ELSE ... END` here).
    if (sequenceMapping.length > 0) {
      // prisma-raw: CASE expression in UPDATE SET
      await db.$executeRaw(Prisma.sql`
        UPDATE manual_review_tool.routing_rules
        SET sequence_number = CASE ${Prisma.join(
          sequenceMapping.map(
            (seqChange) =>
              Prisma.sql`WHEN sequence_number = ${seqChange.old}::int THEN ${seqChange.new}::int`,
          ),
          ' ',
        )} ELSE sequence_number END
        WHERE org_id = ${input.orgId}
      `);
    }

    // Reuse the existing getRoutingRules function to get the rules in the new
    // order. Alternatively, we could have had a 'returning' clause on the
    // update, but then we would've needed to sort the rules in memory or do
    // something like this: https://stackoverflow.com/a/25650188/1261879.
    // Plus, a separate query to retrieve itemTypeIds for each rule would be
    // needed anyway, so the complexity didn't seem worth it.
    return this.#getRoutingRulesBypassCache(input.orgId, db);
  }

  async #getRoutingRulesOrder(
    orgId: string,
    db: PrismaPgQueryable = this.prisma,
  ) {
    return (
      await db.routing_rules.findMany({
        select: { id: true },
        where: { org_id: orgId },
        orderBy: { sequence_number: 'asc' },
      })
    ).map((rule) => rule.id);
  }

  async #reorderOneRoutingRule(
    orgId: string,
    routingRuleId: string,
    newSequenceNumber: number,
    db: PrismaPgQueryable = this.prisma,
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
    db: PrismaPgQueryable = this.prisma,
  ) {
    const results = await db.routing_rules_to_item_types.findMany({
      select: { item_type_id: true },
      where: { routing_rule_id: routingRuleId },
    });

    return results.map((row) => row.item_type_id);
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

  async #getRoutingRulesBypassCache(orgId: string, db: PrismaPgQueryable) {
    // prisma-raw: json_agg aggregate over a matview join (views have no relations)
    return db.$queryRaw<RoutingRuleVersionRow[]>(Prisma.sql`
      SELECT
        routing_rules.id,
        routing_rules.org_id AS "orgId",
        routing_rules.creator_id AS "creatorId",
        routing_rules.name,
        routing_rules.description,
        routing_rules.status::text AS status,
        routing_rules.condition_set AS "conditionSet",
        routing_rules.destination_queue_id AS "destinationQueueId",
        json_agg(rules_to_item_types.item_type_id) AS "itemTypeIds",
        routing_rules.version
      FROM manual_review_tool.routing_rule_versions AS routing_rules
      INNER JOIN manual_review_tool.routing_rules_to_item_types AS rules_to_item_types
        ON routing_rules.id = rules_to_item_types.routing_rule_id
      WHERE routing_rules.org_id = ${orgId}
        AND routing_rules.is_current = true
      GROUP BY
        routing_rules.id,
        routing_rules.org_id,
        routing_rules.creator_id,
        routing_rules.name,
        routing_rules.description,
        routing_rules.status,
        routing_rules.condition_set,
        routing_rules.destination_queue_id,
        routing_rules.version,
        routing_rules.sequence_number
      ORDER BY routing_rules.sequence_number
    `);
  }

  async close() {
    return this.routingRulesCache.close();
  }
}

export type RoutingRuleErrorType =
  | 'RoutingRuleNameExistsError'
  | 'ReorderRoutingRulesError'
  | 'QueueDoesNotExistError';

function isRoutingRuleNameExistsError(error: unknown) {
  return (
    isUniqueViolationError(error) &&
    getPgErrorDetails(error)?.constraint === 'routing_rules_org_id_name_key'
  );
}

export function isRoutingRuleNotFoundError(error: unknown) {
  return error instanceof RoutingRuleNoResultError;
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
