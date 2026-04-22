/* eslint-disable max-lines */

import { type Exception } from '@opentelemetry/api';
import { makeEnumLike } from '@roostorg/types';

import { type Kysely } from 'kysely';
import { uid } from 'uid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type Backtest } from '../../models/rules/BacktestModel.js';
import { type User } from '../../models/UserModel.js';
import { type ActionCountsInput } from '../../services/actionStatisticsService/index.js';
import { type AggregationClause } from '../../services/aggregationsService/index.js';
import { type ConditionSetWithResultAsLogged } from '../../services/analyticsLoggers/index.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import {
  RuleType,
  type Condition,
  type ConditionInput,
  type ConditionSet,
  type CoopInput,
  type LeafCondition,
  type RuleStatus,
} from '../../services/moderationConfigService/index.js';
import {
  makeRuleHasRunningBacktestsError,
  makeRuleIsMissingContentTypeError,
  makeRuleNameExistsError,
} from '../../services/moderationConfigService/index.js';
import {
  isSignalId,
  signalIsExternal,
  type SignalId,
} from '../../services/signalsService/index.js';
import {
  type DataWarehousePublicSchema,
  warehouseDateToDate,
} from '../../storage/dataWarehouse/warehouseSchema.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import { jsonParse, jsonStringify, tryJsonParse } from '../../utils/encoding.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import { takeLast } from '../../utils/sql.js';
import {
  type NonEmptyString,
  type RequiredWithoutNull,
} from '../../utils/typescript-types.js';
import {
  type GQLAggregationClauseInput,
  type GQLConditionInput,
  type GQLConditionInputFieldInput,
  type GQLConditionSetInput,
  type GQLCreateBacktestInput,
  type GQLCreateContentRuleInput,
  type GQLCreateUserRuleInput,
  type GQLRunRetroactionInput,
  type GQLUpdateContentRuleInput,
  type GQLUpdateUserRuleInput,
} from '../generated.js';
import { oneOfInputToTaggedUnion } from '../utils/inputHelpers.js';
import { type CursorInfo, type Edge } from '../utils/paginationHandler.js';
import { buildGraphqlRuleParent } from './buildGraphqlRuleParent.js';
import {
  kyselyCancelRunningBacktestsForRule,
  kyselyCreateRule,
  kyselyDeleteRule,
  kyselyHasRunningBacktestsForRule,
  kyselyListBacktestsForRule,
  kyselyUpdateRule,
} from './ruleKyselyPersistence.js';
import { locationAreaInputToLocationArea } from './LocationBankApi.js';
import { unauthenticatedError } from '../utils/errors.js';
import { isUniqueViolationError } from '../../utils/kysely.js';
import {
  makeKyselyTransactionWithRetry,
  type KyselyTransactionWithRetry,
} from '../../utils/kyselyTransactionWithRetry.js';

/**
 * Normalize the GraphQL `expirationTime` input scalar into a shape our
 * persistence layer can apply partially:
 *
 * - `undefined` → don't touch the column on update.
 * - `null`      → clear the expiration.
 * - otherwise   → coerce the scalar (string or Date) into a `Date`.
 */
function normalizeExpirationInput(
  value: string | Date | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

const SortOrder = makeEnumLike(['ASC', 'DESC']);
type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

// GraphQl exposed type for a rule execution.
// TODO: make sure schema matches result here.
export type RuleExecutionResult = {
  date: string;
  ts: string;
  contentId: string;
  itemTypeName: string;
  itemTypeId: string;
  userId?: string;
  userTypeId?: string;
  content: string;
  result: ConditionSetWithResultAsLogged | null;
  environment: RuleStatus;
  passed: boolean;
  ruleId: string;
  ruleName: string;
  tags: string[];
};

export function transformConditionForDB<
  T extends GQLConditionInput | GQLConditionSetInput,
>(condition: T): T extends GQLConditionSetInput ? ConditionSet : Condition {
  if (!conditionInputIsValid(condition)) {
    throw new Error('Invalid condition input');
  }

  if ('conditions' in condition) {
    return {
      ...condition,
      conjunction: condition.conjunction,
      conditions: condition.conditions.map(
        transformConditionForDB,
      ) as ConditionSet['conditions'],
    };
  }

  return transformLeafConditionForDB(
    condition,
  ) as T extends GQLConditionSetInput ? ConditionSet : Condition;
}

/**
 * When a LeafCondition is sent to us as input in a graphql mutation,
 * the shape of the GQL input objects needs to be mapped to our internal
 * representation of a LeafCondition (as used in the RuleModel/db/TS).
 *
 * NB: for google place locations stored in matchingValues, we convert them
 * to valid LocationArea objects, but don't bother fetching the extra google
 * place info (as that'd be quite a lot of extra data to store in the rule's
 * json blob, which could have performance impacts, and it'd be quite
 * slow/wasteful to fetch it for every location on every rule update).
 */
function transformLeafConditionForDB(
  leafCondition: ValidatedGQLLeafConditionInput,
): LeafCondition {
  return {
    ...leafCondition,
    input: transformConditionInput(leafCondition.input),
    ...(() => {
      const { comparator, signal, matchingValues } = leafCondition;

      if (comparator === 'IS_NOT_PROVIDED') {
        if (signal) {
          throw new Error(
            'Cannot use is not provided on a condition with a signal',
          );
        }
        return {
          comparator,
          signal: undefined,
          matchingValues: undefined,
          threshold: undefined,
        };
      }

      return {
        comparator,
        matchingValues: matchingValues
          ? {
              ...matchingValues,
              locations: matchingValues.locations?.map(
                locationAreaInputToLocationArea,
              ),
            }
          : undefined,
        signal:
          signal &&
          (() => {
            const { id, name, subcategory, type } = signal;
            const idParsed = tryJsonParse(id);
            if (!isSignalId(idParsed) || !signalIsExternal(idParsed)) {
              throw new Error('Invalid signal id');
            }
            const signalInfo = {
              id: jsonStringify(idParsed),
              name,
              subcategory,
            };

            switch (type) {
              case 'AGGREGATION':
                const aggregationClauseInput =
                  signal.args?.AGGREGATION?.aggregationClause;
                if (!aggregationClauseInput) {
                  throw new Error('Missing signal args');
                }
                return {
                  ...signalInfo,
                  type,
                  args: {
                    aggregationClause: parseAggregationClauseInput(
                      aggregationClauseInput,
                    ),
                  },
                };
              default:
                return {
                  ...signalInfo,
                  type,
                  args: undefined,
                };
            }
          })(),
        threshold: leafCondition.threshold,
      };
    })(),
  };
}

function transformConditionInput(conditionInput: GQLConditionInputFieldInput) {
  // TODO: fix the logic here rather than disabling the lint rule. We
  // genuinely have some validation gaps.
  // eslint-disable-next-line switch-statement/require-appropriate-default-case
  switch (conditionInput.type) {
    case 'CONTENT_DERIVED_FIELD':
      const spec = conditionInput.spec!;
      const specSource = oneOfInputToTaggedUnion(spec.source, {
        contentField: 'CONTENT_FIELD',
        fullItem: 'FULL_ITEM',
        contentCoopInput: 'CONTENT_COOP_INPUT',
      });

      return {
        ...(conditionInput as GQLConditionInputFieldInput & {
          type: 'CONTENT_DERIVED_FIELD';
        }),
        spec: {
          ...spec,
          // This cast is needed because TS (from the generated types)
          // thinks that input.spec.name is a GQLCoopInput enum, and the
          // values of that type are things like ALL_TEXT etc, whereas the
          // runtime values for our CoopInput type are 'All text' etc.
          // What TS doesn't know is that an apollo resolver has mapped the
          // GQL output values back to our saved runtime values, which makes
          // this safe.
          source: specSource as
            | Exclude<typeof specSource, { type: 'CONTENT_COOP_INPUT' }>
            | { type: 'CONTENT_COOP_INPUT'; name: CoopInput },
        },
      };
    default:
      // TS is actually right to complain here, because our GQL types for
      // LeafCondition.input let a lot of invalid values through (the GQL
      // types are pretty loose, because we haven't yet made them a proper
      // GQL input union), and our coarse validation routine doesn't fully
      // compensate for the looseness. But, for now, we just assume the
      // frontend is sending valid data and do this cast.
      return conditionInput as ConditionInput;
  }
}

function parseAggregationClauseInput(
  aggregationClause: GQLAggregationClauseInput,
): AggregationClause {
  return {
    id: uid(),
    conditionSet:
      aggregationClause.conditionSet &&
      transformConditionForDB(aggregationClause.conditionSet),
    aggregation: {
      type: aggregationClause.aggregation.type,
    },
    groupBy: aggregationClause.groupBy.map((it) => transformConditionInput(it)),
    window: {
      sizeMs: aggregationClause.window.sizeMs,
      hopMs: aggregationClause.window.hopMs,
    },
  };
}

/**
 * GraphQL Object for a Rule
 */
class RuleAPI {
  private readonly warehouse: Kysely<DataWarehousePublicSchema>;
  private readonly kysely: Kysely<CombinedPg>;
  private readonly kyselyTransactionWithRetry: KyselyTransactionWithRetry<CombinedPg>;

  private readonly graphQlRuleParentDeps: Parameters<
    typeof buildGraphqlRuleParent
  >[1];

  constructor(
    dialect: Dependencies['DataWarehouseDialect'],
    public readonly ruleInsights: Dependencies['RuleActionInsights'],
    private readonly actionStats: Dependencies['ActionStatisticsService'],
    private readonly kyselyPg: Dependencies['KyselyPg'],
    private readonly models: Dependencies['Sequelize'],
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly signalsService: Dependencies['SignalsService'],
  ) {
    this.warehouse =
      dialect.getKyselyInstance() as Kysely<DataWarehousePublicSchema>;
    this.kysely = this.kyselyPg as Kysely<CombinedPg>;
    this.kyselyTransactionWithRetry = makeKyselyTransactionWithRetry(
      this.kysely,
    );
    this.graphQlRuleParentDeps = {
      moderationConfigService: this.moderationConfigService,
      // TODO(Kysely migration): replace with a ModerationConfigService /
      // user-service-backed lookup once users are migrated off Sequelize.
      findUserByIdAndOrg: async (opts) =>
        this.models.User.findOne({ where: opts.where }),
    };
  }

  async getGraphQLRuleFromId(id: string, orgId: string) {
    const plain = await this.moderationConfigService.getRuleByIdAndOrg(id, orgId);
    if (plain == null) {
      throw unauthenticatedError('User not authenticated to fetch this rule');
    }

    return buildGraphqlRuleParent(plain, this.graphQlRuleParentDeps);
  }

  async createContentRule(
    input: GQLCreateContentRuleInput,
    userId: string,
    orgId: string,
  ) {
    return this.createRule(
      { ...input, ruleType: RuleType.CONTENT },
      userId,
      orgId,
    );
  }

  async createUserRule(
    input: GQLCreateUserRuleInput,
    userId: string,
    orgId: string,
  ) {
    return this.createRule(
      { ...input, ruleType: RuleType.USER },
      userId,
      orgId,
    );
  }

  private async createRule(
    input:
      | (GQLCreateContentRuleInput & { ruleType: typeof RuleType.CONTENT })
      | (GQLCreateUserRuleInput & { ruleType: typeof RuleType.USER }),
    userId: string,
    orgId: string,
  ) {
    const {
      name,
      description,
      status,
      conditionSet,
      actionIds,
      policyIds,
      tags,
      ruleType,
      maxDailyActions,
      expirationTime,
      parentId,
    } = input;

    const contentTypeIds: readonly string[] =
      input.ruleType === RuleType.CONTENT ? input.contentTypeIds : [];
    if (ruleType === RuleType.CONTENT && contentTypeIds.length === 0) {
      throw makeRuleIsMissingContentTypeError({ shouldErrorSpan: true });
    }

    // Validate that signals used in automated rules are allowed
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (actionIds && actionIds.length > 0) {
      await this.validateSignalsAllowedInAutomatedRules(conditionSet, orgId);
    }

    const ruleId = uid();

    try {
      await this.kyselyTransactionWithRetry(async (trx) => {
        await kyselyCreateRule(trx, {
          id: ruleId,
          name,
          description: description ?? null,
          status,
          conditionSet: transformConditionForDB(conditionSet),
          tags: tags.slice(),
          maxDailyActions: maxDailyActions ?? null,
          expirationTime: normalizeExpirationInput(expirationTime),
          creatorId: userId,
          orgId,
          ruleType,
          parentId,
          actionIds,
          policyIds,
          contentTypeIds,
        });
      });
    } catch (e) {
      throw isUniqueViolationError(e)
        ? makeRuleNameExistsError({ shouldErrorSpan: true })
        : e;
    }

    const plain = await this.moderationConfigService.getRuleByIdAndOrg(
      ruleId,
      orgId,
      { readFromReplica: false },
    );
    if (plain == null) {
      throw new Error('Rule was created but could not be reloaded');
    }
    return buildGraphqlRuleParent(plain, this.graphQlRuleParentDeps);
  }

  async updateContentRule(opts: {
    input: GQLUpdateContentRuleInput;
    orgId: string;
  }) {
    const { input, orgId } = opts;
    return this.updateRule({
      input: { ...input, ruleType: RuleType.CONTENT },
      orgId,
    });
  }

  async updateUserRule(opts: { input: GQLUpdateUserRuleInput; orgId: string }) {
    const { input, orgId } = opts;
    return this.updateRule({
      input: { ...input, ruleType: RuleType.USER },
      orgId,
    });
  }

  private async updateRule(opts: {
    input:
      | (GQLUpdateContentRuleInput & { ruleType: typeof RuleType.CONTENT })
      | (GQLUpdateUserRuleInput & { ruleType: typeof RuleType.USER });
    orgId: string;
  }) {
    const { input, orgId } = opts;
    const {
      id,
      name,
      description,
      status,
      conditionSet,
      actionIds,
      policyIds,
      tags,
      ruleType,
      maxDailyActions,
      expirationTime,
      cancelRunningBacktests,
      parentId,
    } = input;

    const existing = await this.moderationConfigService.getRuleByIdAndOrg(
      id,
      orgId,
      { readFromReplica: false },
    );
    if (existing == null) {
      throw makeNotFoundError('Rule not found', {
        detail: `Could not find rule with id ${id}`,
        shouldErrorSpan: true,
      });
    }

    if (conditionSet != null && !conditionInputIsValid(conditionSet)) {
      throw new Error('Invalid condition set input');
    }

    // In the case of a content rule update, it's okay if the contentTypeIds
    // isn't provided, since that will be a no-op in persistence. But if it
    // *is* provided, we need to check there are actually content type IDs
    // present, since an empty list is invalid for content rules.
    const contentTypeIds =
      input.ruleType === RuleType.CONTENT ? input.contentTypeIds : undefined;
    if (contentTypeIds != null && contentTypeIds.length === 0) {
      throw makeRuleIsMissingContentTypeError({ shouldErrorSpan: true });
    }

    // Validate that signals used in automated rules are allowed
    // Check if the rule will have actions meaning automated rule.
    // This ensures we don't allow creating automated rules with signals
    // that are restricted to routing rules only.
    const willHaveActions = actionIds
      ? actionIds.length > 0
      : (await this.moderationConfigService.getActionsForRuleId(id)).length > 0;

    if (willHaveActions && conditionSet) {
      await this.validateSignalsAllowedInAutomatedRules(conditionSet, orgId);
    }

    // Before we actually send any updates (which will happen as soon as we call
    // setXXX to set the associations), we need to make sure that there are no
    // active backtests for this rule because, if there are, we should fail the
    // update unless the user's asked to cancel the backtests explicitly.
    if (!cancelRunningBacktests) {
      if (await kyselyHasRunningBacktestsForRule(this.kysely, id)) {
        throw makeRuleHasRunningBacktestsError({ shouldErrorSpan: true });
      }
    }

    // Do our updates, in a transaction so that we don't end up with
    // inconsistent state if the name check fails. Technically, I think we'd
    // need to put the hasRunningBacktests call above in this transaction and
    // use SERIALIZABLE to make the update + backtest cancelation logically
    // linearizable w/r/t concurrently started backtests, but that's overkill.
    try {
      await this.kysely
        .transaction()
        .setIsolationLevel('repeatable read')
        .execute(async (trx) => {
          await kyselyUpdateRule(trx, {
            id,
            orgId,
            name,
            description,
            conditionSet:
              conditionSet == null
                ? undefined
                : transformConditionForDB(conditionSet),
            tags: tags?.slice(),
            ruleType,
            status: status ?? undefined,
            maxDailyActions,
            expirationTime: normalizeExpirationInput(expirationTime),
            parentId,
            actionIds: actionIds ?? undefined,
            policyIds: policyIds ?? undefined,
            contentTypeIds: contentTypeIds ?? undefined,
          });
          if (cancelRunningBacktests) {
            await kyselyCancelRunningBacktestsForRule(trx, id);
          }
        });
    } catch (e) {
      throw isUniqueViolationError(e)
        ? makeRuleNameExistsError({ shouldErrorSpan: true })
        : e;
    }

    const plain = await this.moderationConfigService.getRuleByIdAndOrg(id, orgId, {
      readFromReplica: false,
    });
    if (plain == null) {
      throw new Error('Rule was updated but could not be reloaded');
    }
    return buildGraphqlRuleParent(plain, this.graphQlRuleParentDeps);
  }

  async deleteRule(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;

    try {
      await this.kysely.transaction().execute(async (trx) => {
        await kyselyDeleteRule(trx, id, orgId);
      });
    } catch (exception) {
      const activeSpan = this.tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(exception as Exception);
      }
      return false;
    }
    return true;
  }

  async getAllRuleInsights(orgId: string) {
    const results = await Promise.allSettled([
      this.actionStats.getActionedSubmissionCountsByDay(orgId),
      this.actionStats.getActionedSubmissionCountsByPolicyByDay(orgId),
      this.actionStats.getActionedSubmissionCountsByTagByDay(orgId),
      this.actionStats.getActionedSubmissionCountsByActionByDay(orgId),
      this.ruleInsights.getContentSubmissionCountsByDay(orgId),
    ]);

    const valueOrEmpty = <T>(
      r: PromiseSettledResult<readonly T[]>,
    ): readonly T[] => (r.status === 'fulfilled' ? r.value : []);

    return {
      actionedSubmissionsByDay: valueOrEmpty(results[0]),
      actionedSubmissionsByPolicyByDay: valueOrEmpty(results[1]),
      actionedSubmissionsByTagByDay: valueOrEmpty(results[2]),
      actionedSubmissionsByActionByDay: valueOrEmpty(results[3]),
      totalSubmissionsByDay: valueOrEmpty(
        results[4] as PromiseSettledResult<
          readonly { date: string; count: number }[]
        >,
      ),
    };
  }

  async getPoliciesSortedByViolationCount(input: {
    filterBy: {
      startDate: Date;
      endDate: Date;
    };
    timeZone: string;
    orgId: string;
  }) {
    return this.actionStats.getPoliciesSortedByViolationCount(input);
  }
  async getActionStatistics(input: ActionCountsInput) {
    const { filterBy } = input;
    // if we need to filter some actions when also grouping, we must use the base table
    // and can't use the materialized views that only aggregate by one field
    if (
      filterBy.actionIds.length ||
      filterBy.itemTypeIds.length ||
      filterBy.itemTypeIds.length ||
      filterBy.sources.length
    ) {
      return this.actionStats.getAllActionCountsGroupBy(input);
    }
    switch (input.groupBy) {
      case 'RULE_ID':
        return this.actionStats.getAllActionCountsGroupByRule(input);
      case 'POLICY_ID':
        return this.actionStats.getAllActionCountsGroupByPolicy(input);
      case 'ACTION_ID':
        return this.actionStats.getAllActionCountsGroupByActionId(input);
      case 'ITEM_TYPE_ID':
        return this.actionStats.getAllActionCountsGroupByItemTypeId(input);
      case 'ACTION_SOURCE':
        return this.actionStats.getAllActionCountsGroupBySource(input);
      default:
        assertUnreachable(input.groupBy);
    }
  }

  /**
   * TODO(BACKTEST_RETROACTION): Re-enable the Kysely + warehouse + RuleEngine flow when product UI
   * exposes backtests again and we can routinely validate against real CONTENT_API_REQUESTS data and
   * RULE_EXECUTIONS logging in dev/staging. Restore `RuleEngine` + `getItemTypeEventuallyConsistent`
   * on this class, `kyselyInsertBacktestRow` / `kyselyUpdateBacktestSamplingOutcome` in
   * `ruleKyselyPersistence.ts`, and the deleted private helpers (`getContentItemTypeIdsForRule`,
   * `runSampledRuleExecutions`, `queryWarehouseSubmissionsForRule`).
   */
  async createBacktest(_input: GQLCreateBacktestInput, _user: User): Promise<Backtest> {
    throw new Error(
      'createBacktest is temporarily disabled (TODO BACKTEST_RETROACTION: no UI / env to validate).',
    );
  }

  async getBacktestResults(
    backtestId: string,
    count: number,
    takeFrom: 'start' | 'end',
    cursor?: CursorInfo<{ ts: number }>,
    sortByTs: SortOrder = SortOrder.DESC,
  ): Promise<Edge<RuleExecutionResult, { ts: number }>[]> {
    // There are a 12 cases here, i.e., (takeFrom start or end) x
    // (no cursor, after cursor, before cursor) x (sort asc, desc).
    // But our pagination helpers let us handle reasonably simply, in steps.
    // First, we must define the result query if we weren't doing any pagination:
    const correlationId = toCorrelationId({
      type: 'backtest',
      id: backtestId,
    });

    let filteredResultsQuery = this.warehouse
      .selectFrom('RULE_EXECUTIONS')
      .select([
        'DS as date',
        'TS as ts',
        'ITEM_ID as contentId',
        'ITEM_TYPE_NAME as itemTypeName',
        'ITEM_TYPE_ID as itemTypeId',
        'ITEM_CREATOR_ID as userId',
        'ITEM_CREATOR_TYPE_ID as userTypeId',
        'ITEM_DATA as content',
        'RESULT as result',
        'ENVIRONMENT as environment',
        'PASSED as passed',
        'RULE_ID as ruleId',
        'RULE as ruleName',
        'TAGS as tags',
      ])
      .where('CORRELATION_ID', '=', correlationId);

    if (cursor) {
      filteredResultsQuery = filteredResultsQuery.where(
        'TS',
        (sortByTs === SortOrder.DESC && cursor.direction === 'after') ||
          (sortByTs === SortOrder.ASC && cursor.direction === 'before')
          ? '<'
          : '>',
        new Date(cursor.value.ts),
      );
    }

    const desiredSort = {
      column: 'ts',
      order: sortByTs === SortOrder.ASC ? 'asc' : 'desc',
    } as const;

    // Finally, filteredResultsQuery represents the _set_ of potentially valid
    // items, but it's not yet sorted or limited to the page size. So, to do
    // that... if we're taking from the start, then we add simple SQL sorting
    // and limiting to our results; however, if we're taking from the end, we
    // have to use our helper that implements "takeLast" in SQL.
    const finalQuery =
      takeFrom === 'start'
        ? filteredResultsQuery
            .orderBy('ts', desiredSort.order)
            .limit(count)
        : takeLast(this.warehouse, filteredResultsQuery, [desiredSort], count);

    const results = await finalQuery.execute();

    return results.map<Edge<RuleExecutionResult, { ts: number }>>((it) => ({
      node: {
        date: warehouseDateToDate(it.date).toISOString(),
        ts: warehouseDateToDate(it.ts).toISOString(),
        contentId: it.contentId,
        itemTypeName: it.itemTypeName ?? '',
        itemTypeId: it.itemTypeId,
        userId: it.userId ?? undefined,
        userTypeId: it.userTypeId ?? undefined,
        content: (it.content ?? '') as string,
        result: it.result ? jsonParse(it.result) : null,
        environment: it.environment as RuleStatus,
        passed: it.passed,
        ruleId: it.ruleId,
        ruleName: it.ruleName,
        tags: [...it.tags],
      },
      cursor: { ts: warehouseDateToDate(it.ts).valueOf() },
    }));
  }

  async getBacktestsForRule(
    ruleId: string,
    backtestIds?: readonly string[] | null,
  ) {
    return kyselyListBacktestsForRule(this.kysely, ruleId, backtestIds);
  }

  /**
   * NB: This retroaction code is not production-ready. It should only
   * be used for our Slack demo because it has a limit of 100 pieces
   * of content on which it will run. That prevents us from accidentally
   * turning this on and overloading our node servers, and is sufficient
   * for the Slack demo.
   *
   * TODO(BACKTEST_RETROACTION): Same as `createBacktest` — re-enable when UI and env
   * support validation.
   */
  async runRetroaction(_input: GQLRunRetroactionInput, _user: User): Promise<{ _: boolean }> {
    throw new Error(
      'runRetroaction is temporarily disabled (TODO BACKTEST_RETROACTION: no UI / env to validate).',
    );
  }

  /**
   * Validates that all signals used in the condition set are allowed in automated rules.
   * Throws an error if any restricted signal is found.
   */
  private async validateSignalsAllowedInAutomatedRules(
    conditionSet: GQLConditionSetInput,
    orgId: string,
  ): Promise<void> {
    const signalIds = this.extractSignalIdsFromConditionSet(conditionSet);

    for (const signalId of signalIds) {
      const signal = await this.signalsService.getSignal({
        signalId,
        orgId,
      });

      if (signal && !signal.allowedInAutomatedRules) {
        throw new Error(
          `Signal "${signal.displayName}" cannot be used in automated rules with actions. ` +
            `This signal is restricted to routing rules only.`,
        );
      }
    }
  }

  /**
   * Extracts all signal IDs from a condition set recursively
   */
  private extractSignalIdsFromConditionSet(
    conditionSet: GQLConditionSetInput,
  ): SignalId[] {
    const signalIds: SignalId[] = [];

    const processCondition = (condition: GQLConditionInput) => {
      if ('conditions' in condition && condition.conditions) {
        // It's a condition set, recurse
        for (const subCondition of condition.conditions) {
          processCondition(subCondition);
        }
      } else if ('signal' in condition && condition.signal) {
        // It's a leaf condition with a signal (type is String to support plugin signals)
        const { type, id } = condition.signal;
        let signalId: SignalId;
        if (type === 'CUSTOM') {
          // CUSTOM signals require an id field. The id comes from validated GraphQL
          // input where it's a required Scalars['ID'], so we can safely cast it.
          signalId = { type: 'CUSTOM' as const, id: id as NonEmptyString };
        } else {
          // Built-in and plugin signals: type is the signal type string
          signalId = { type };
        }
        signalIds.push(signalId);
      }
    };

    // Start processing from the root
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (conditionSet.conditions) {
      for (const condition of conditionSet.conditions) {
        processCondition(condition);
      }
    }

    return signalIds;
  }
}

export default inject(
  [
    'DataWarehouseDialect',
    'RuleActionInsights',
    'ActionStatisticsService',
    'KyselyPg',
    'Sequelize',
    'ModerationConfigService',
    'Tracer',
    'SignalsService',
  ],
  RuleAPI,
);
export type { RuleAPI };

/**
 * Our ConditionInput in GraphQL is forced to be not type safe, so we must
 * validate it here. For convenience, we also allow this to accept a
 * ConditionSetInput, which has the same shape as valid ConditionInputs that are
 * used to represent ConditionSets.
 */
function conditionInputIsValid(
  it: GQLConditionInput | GQLConditionSetInput,
): it is ValidatedGQLConditionInput {
  return (
    (it.conjunction != null &&
      it.conditions != null &&
      Object.keys(it).length === 2) ||
    (!('conjunction' in it) && !('conditions' in it) && it.input != null)
  );
}

type ValidatedGQLConditionInput =
  | ValidatedGQLConditionSetInput
  | ValidatedGQLLeafConditionInput;

type ValidatedGQLConditionSetInput = RequiredWithoutNull<
  Pick<GQLConditionInput, 'conditions' | 'conjunction'>
>;

type ValidatedGQLLeafConditionInput = Omit<
  GQLConditionInput,
  'conditions' | 'conjunction'
> &
  RequiredWithoutNull<Pick<GQLConditionInput, 'input'>>;
