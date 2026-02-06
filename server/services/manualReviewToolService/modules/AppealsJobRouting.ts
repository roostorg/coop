/* eslint-disable max-lines */

import { type ConsumerDirectives } from '../../../lib/cache/index.js';
import {
  sql,
  type CaseWhenBuilder,
  type Kysely,
  type Transaction,
} from 'kysely';
import { type ReadonlyObjectDeep } from 'type-fest/source/readonly-deep.js';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../../iocContainer/index.js';
import { type RuleExecutionResult } from '../../../rule_engine/RuleEvaluator.js';
import { type ActionExecutionCorrelationId } from '../../analyticsLoggers/ActionExecutionLogger.js';
import { type RuleExecutionCorrelationId } from '../../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { cached } from '../../../utils/caching.js';
import { moveArrayElement } from '../../../utils/collections.js';
import { __throw, removeUndefinedKeys } from '../../../utils/misc.js';
import { replaceEmptyStringWithNull } from '../../../utils/string.js';
import { type ItemSubmission } from '../../itemProcessingService/index.js';
import { itemSubmissionWithTypeIdentifierToItemSubmission } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';
import { type ManualReviewAppealJobPayload } from '../manualReviewToolService.js';
import {
  makeRoutingRuleNameExistsError,
  makeRoutingRuleNotFoundError,
  type CreateRoutingRuleInput,
  type ReorderRoutingRulesInput,
  type RoutingRule,
  type UpdateRoutingRuleInput,
} from './JobRouting.js';
import type QueueOperations from './QueueOperations.js';

const routingRuleSelection = [
  'id',
  'org_id as orgId',
  'creator_id as creatorId',
  'name',
  'description',
  'status',
  'condition_set as conditionSet',
  'destination_queue_id as destinationQueueId',
] as const;

export default class AppealsJobRouting {
  private readonly appealsRoutingRulesCache;

  constructor(
    private readonly pgQuery: Kysely<ManualReviewToolServicePg>,
    private readonly queueOps: QueueOperations,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly ruleEvaluator: Dependencies['RuleEvaluator'],
  ) {
    this.appealsRoutingRulesCache = cached({
      producer: async (orgId: string) =>
        this.#getAppealsRoutingRulesBypassCache(orgId, pgQuery),
      directives: { freshUntilAge: 15, maxStale: [0, 2, 2] },
    });
  }

  async getAppealsRoutingRules(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }) {
    const { orgId, directives } = opts;

    return this.appealsRoutingRulesCache(orgId, directives);
  }

  async createAppealsRoutingRule(input: CreateRoutingRuleInput) {
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

    return this.pgQuery
      .transaction()
      .execute(async (trx) => {
        const routingRule = await trx
          .insertInto('manual_review_tool.appeals_routing_rules')
          .values(({ selectFrom }) => ({
            id: uuidv1(),
            org_id: orgId,
            name,
            description: replaceEmptyStringWithNull(description),
            status,
            condition_set: conditionSet,
            destination_queue_id: destinationQueueId,
            creator_id: creatorId,
            sequence_number: selectFrom(
              'manual_review_tool.appeals_routing_rules',
            )
              .where('org_id', '=', orgId)
              .select(
                sql<number>`coalesce(max(sequence_number), 0) + 1`.as(
                  'sequence_number',
                ),
              ),
          }))
          .returning(routingRuleSelection)
          .executeTakeFirstOrThrow();

        await trx
          .insertInto('manual_review_tool.appeals_routing_rules_to_item_types')
          .values(
            itemTypeIds.map((itemTypeId) => ({
              appeals_routing_rule_id: routingRule.id,
              item_type_id: itemTypeId,
            })),
          )
          .returning('item_type_id as itemTypeId')
          .execute();

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
      })
      .catch((e) => {
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

  async updateAppealsRoutingRule(input: UpdateRoutingRuleInput) {
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

    return this.pgQuery
      .transaction()
      .execute(async (trx) => {
        const updatedRoutingRule = await trx
          .updateTable('manual_review_tool.appeals_routing_rules')
          .set(
            removeUndefinedKeys({
              name,
              description: replaceEmptyStringWithNull(description),
              status,
              condition_set: conditionSet,
              destination_queue_id: destinationQueueId,
            }),
          )
          .where('id', '=', id)
          .where('org_id', '=', orgId)
          .returning(routingRuleSelection)
          .executeTakeFirstOrThrow();

        if (itemTypeIds) {
          // delete item types that will no longer be used
          await trx
            .deleteFrom(
              'manual_review_tool.appeals_routing_rules_to_item_types',
            )
            .where(({ eb, and }) =>
              and([
                eb('appeals_routing_rule_id', '=', id),
                eb('item_type_id', 'not in', itemTypeIds),
              ]),
            )
            .execute();

          // insert new item types, ignore if they're already there
          await trx
            .insertInto(
              'manual_review_tool.appeals_routing_rules_to_item_types',
            )
            .values(
              itemTypeIds.map((itemTypeId) => ({
                appeals_routing_rule_id: id,
                item_type_id: itemTypeId,
              })),
            )
            .onConflict((oc) =>
              oc
                .columns(['appeals_routing_rule_id', 'item_type_id'])
                .doNothing(),
            )
            .execute();
        }

        if (sequenceNumber) {
          await this.#reorderOneRoutingRule(orgId, id, sequenceNumber, trx);
        }

        return {
          ...updatedRoutingRule,
          itemTypeIds:
            itemTypeIds ??
            (await this.#getItemTypeIdsForAppealsRoutingRule(id, trx)),
        };
      })
      .catch((e) => {
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
  async deleteAppealsRoutingRule(input: { id: string }) {
    const { id } = input;
    await this.pgQuery.transaction().execute(async (trx) => {
      try {
        await trx
          .deleteFrom('manual_review_tool.appeals_routing_rules')
          .where('id', '=', id)
          .executeTakeFirstOrThrow();

        return true;
      } catch (error) {
        return false;
      }
    });

    return true;
  }

  async reorderAppealsRoutingRules(
    input: ReorderRoutingRulesInput,
    db:
      | Transaction<ManualReviewToolServicePg>
      | Kysely<ManualReviewToolServicePg> = this.pgQuery,
  ) {
    // get existing rules in any order
    const rules = await db
      .selectFrom('manual_review_tool.appeals_routing_rules')
      .select(['id', 'sequence_number as sequenceNumber'])
      .where('org_id', '=', input.orgId)
      .execute();

    // assign new indices to old indices
    const sequenceMapping = rules.map((rule) => ({
      old: rule.sequenceNumber,
      new: input.order.indexOf(rule.id),
    }));

    // Note that we can't just do multiple updates because
    // there will be a unique sequence_number constraint violation,
    // even despite it being marked as `deferrable initially deferred`.
    // As an added benefit, the CASE WHEN ... END query is also faster.
    await db
      .updateTable('manual_review_tool.appeals_routing_rules')
      .set((eb) => ({
        sequence_number: sequenceMapping
          .reduce(
            (acc, seqChange) =>
              acc
                .when('sequence_number', '=', seqChange.old)
                .then(seqChange.new),
            // .case() is of type CaseBuilder, but .case().when().then() is of
            // type CaseWhenBuilder, so we either have to set the accumulator
            // to .case.when().then() and slice the array of changes to skip
            // step 1, or cast the accumulator to CaseWhenBuilder. The latter
            // seems cleaner.
            eb.case() as unknown as CaseWhenBuilder<
              ManualReviewToolServicePg,
              'manual_review_tool.appeals_routing_rules',
              unknown,
              number
            >,
          )
          .else(eb.ref('sequence_number'))
          .end(),
      }))
      .execute();

    return this.#getAppealsRoutingRulesBypassCache(input.orgId, db);
  }

  async #getAppealsRoutingRulesOrder(
    orgId: string,
    db:
      | Transaction<ManualReviewToolServicePg>
      | Kysely<ManualReviewToolServicePg> = this.pgQuery,
  ) {
    return (
      await db
        .selectFrom('manual_review_tool.appeals_routing_rules')
        .select(['id'])
        .where('org_id', '=', orgId)
        .orderBy('sequence_number', 'asc')
        .execute()
    ).map((rule) => rule.id);
  }

  async #reorderOneRoutingRule(
    orgId: string,
    routingRuleId: string,
    newSequenceNumber: number,
    db:
      | Transaction<ManualReviewToolServicePg>
      | Kysely<ManualReviewToolServicePg> = this.pgQuery,
  ) {
    const currentOrder = await this.#getAppealsRoutingRulesOrder(orgId, db);

    // sequence numbers start with 1
    if (newSequenceNumber >= 1 && newSequenceNumber <= currentOrder.length) {
      const oldSequenceNumber = currentOrder.indexOf(routingRuleId);

      if (oldSequenceNumber !== -1) {
        const newOrder = moveArrayElement(
          currentOrder,
          oldSequenceNumber,
          newSequenceNumber,
        );

        await this.reorderAppealsRoutingRules(
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
  async #getItemTypeIdsForAppealsRoutingRule(
    routingRuleId: string,
    db:
      | Transaction<ManualReviewToolServicePg>
      | Kysely<ManualReviewToolServicePg> = this.pgQuery,
  ) {
    const results = await db
      .selectFrom('manual_review_tool.appeals_routing_rules_to_item_types')
      .select('item_type_id as itemTypeId')
      .where('appeals_routing_rule_id', '=', routingRuleId)
      .execute();

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
  async #runAppealsRoutingRules(opts: {
    routingRules: readonly ReadonlyObjectDeep<RoutingRule>[];
    itemSubmission: ItemSubmission;
    policyIds: string[];
    correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
    mrtJobKind: ManualReviewAppealJobPayload['kind'];
  }): Promise<string | null> {
    const {
      routingRules,
      itemSubmission,
      //correlationId,
      //mrtJobKind,
      policyIds,
    } = opts;

    const evaluationContext = this.ruleEvaluator.makeRuleExecutionContext({
      orgId: itemSubmission.itemType.orgId,
      input: { ...itemSubmission, policyIds },
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

    return destinationQueueId;
  }

  /**
   * Return type annotation is intentional to make sure we're always throwing,
   * rather than returning undefined, if we can't find a default queue.
   */
  async getQueueIdForJob(input: {
    orgId: string;
    correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
    payload: ManualReviewAppealJobPayload;
    policyIds: string[];
    routingRuleCacheDirectives?: ConsumerDirectives;
  }): Promise<string> {
    const {
      payload,
      orgId,
      correlationId,
      policyIds,
      routingRuleCacheDirectives,
    } = input;

    const routingRules = await this.getAppealsRoutingRules({
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

    const destinationQueueId = await this.#runAppealsRoutingRules({
      routingRules,
      itemSubmission,
      policyIds,
      correlationId,
      mrtJobKind: payload.kind,
    });

    return (
      destinationQueueId ??
      (await this.queueOps.getDefaultAppealsQueueIdForOrg(orgId))
    );
  }

  async #getAppealsRoutingRulesBypassCache(
    orgId: string,
    db:
      | Transaction<ManualReviewToolServicePg>
      | Kysely<ManualReviewToolServicePg>,
  ) {
    return db
      .selectFrom(
        'manual_review_tool.appeals_routing_rule_versions as routing_rules',
      )
      .innerJoin(
        'manual_review_tool.appeals_routing_rules_to_item_types as rules_to_item_types',
        'routing_rules.id',
        'rules_to_item_types.appeals_routing_rule_id',
      )
      .where('routing_rules.org_id', '=', orgId)
      .where('routing_rules.is_current', '=', true)
      .select([
        ...routingRuleSelection,
        sql<string[]>`json_agg(rules_to_item_types.item_type_id)`.as(
          'itemTypeIds',
        ),
        'version',
      ])
      .groupBy([
        'routing_rules.id',
        'routing_rules.org_id',
        'routing_rules.creator_id',
        'routing_rules.name',
        'routing_rules.description',
        'routing_rules.status',
        'routing_rules.condition_set',
        'routing_rules.destination_queue_id',
        'routing_rules.version',
        'routing_rules.sequence_number',
      ])
      .orderBy('routing_rules.sequence_number')
      .execute();
  }

  async close() {
    return this.appealsRoutingRulesCache.close();
  }
}

export type RoutingRuleErrorType =
  | 'RoutingRuleNameExistsError'
  | 'ReorderRoutingRulesError'
  | 'QueueDoesNotExistError';

function isRoutingRuleNameExistsError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(
      'duplicate key value violates unique constraint "appeals_routing_rules_org_id_name_key"',
    )
  );
}

function isRoutingRuleNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes('no result');
}
