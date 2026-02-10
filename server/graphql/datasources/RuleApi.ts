/* eslint-disable max-lines */

import { type Exception } from '@opentelemetry/api';
import { makeEnumLike } from '@roostorg/types';
import { DataSource } from 'apollo-datasource';
import { AuthenticationError } from 'apollo-server-express';
import { sql, type Kysely } from 'kysely';
import Sequelize from 'sequelize';
import { uid } from 'uid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import {
  isEmptyResultSetError,
  isUniqueConstraintError,
} from '../../models/errors.js';
import { type User } from '../../models/UserModel.js';
import { type ActionCountsInput } from '../../services/actionStatisticsService/index.js';
import { type AggregationClause } from '../../services/aggregationsService/index.js';
import {
  RuleType,
  type Condition,
  type ConditionInput,
  type ConditionSet,
  type LeafCondition,
  type CoopInput,
  type RuleStatus,
} from '../../services/moderationConfigService/index.js';
import {
  makeRuleHasRunningBacktestsError,
  makeRuleIsMissingContentTypeError,
  makeRuleNameExistsError,
  // TODO: delete the import below when we move the rule mutation logic into the
  // moderation config service, which is where it should be.
  // eslint-disable-next-line import/no-restricted-paths
} from '../../services/moderationConfigService/moderationConfigService.js';
import {
  isSignalId,
  signalIsExternal,
  type ExternalSignalType,
  type SignalId,
} from '../../services/signalsService/index.js';
import { type ConditionSetWithResultAsLogged } from '../../services/analyticsLoggers/index.js';
import { type SnowflakePublicSchema } from '../../snowflake/types.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import {
  jsonParse,
  jsonStringify,
  tryJsonParse,
} from '../../utils/encoding.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { assertUnreachable, patchInPlace } from '../../utils/misc.js';
import { takeLast } from '../../utils/sql.js';
import {
  type Mutable,
  type NonEmptyString,
  type RequiredWithoutNull,
} from '../../utils/typescript-types.js';
import {
  type GQLAggregationClauseInput,
  type GQLConditionInput,
  type GQLConditionInputFieldInput,
  type GQLConditionSetInput,
  type GQLCreateContentRuleInput,
  type GQLCreateUserRuleInput,
  type GQLRunRetroactionInput,
  type GQLUpdateContentRuleInput,
  type GQLUpdateUserRuleInput,
} from '../generated.js';
import { oneOfInputToTaggedUnion } from '../utils/inputHelpers.js';
import { type CursorInfo, type Edge } from '../utils/paginationHandler.js';
import { locationAreaInputToLocationArea } from './LocationBankApi.js';

const { Op, Transaction } = Sequelize;
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
  result: ConditionSetWithResultAsLogged;
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

            // eslint-disable-next-line switch-statement/require-appropriate-default-case
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
class RuleAPI extends DataSource {
  constructor(
    private readonly knex: Dependencies['Knex'],
    private readonly snowflake: Kysely<SnowflakePublicSchema>,
    public readonly ruleInsights: Dependencies['RuleActionInsights'],
    private readonly actionStats: Dependencies['ActionStatisticsService'],
    private readonly models: Dependencies['Sequelize'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly signalsService: Dependencies['SignalsService'],
  ) {
    super();
  }

  async getGraphQLRuleFromId(id: string, orgId: string) {
    const rule = await this.models.Rule.findByPk(id, { rejectOnEmpty: true });
    if (rule.orgId !== orgId) {
      throw new AuthenticationError(
        'User not authenticated to fetch this rule',
      );
    }

    return rule;
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

    if (ruleType === RuleType.CONTENT && input.contentTypeIds.length === 0) {
      throw makeRuleIsMissingContentTypeError({ shouldErrorSpan: true });
    }

    // Validate that signals used in automated rules are allowed
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (actionIds && actionIds.length > 0) {
      await this.validateSignalsAllowedInAutomatedRules(conditionSet, orgId);
    }

    const rule = this.models.Rule.build({
      id: uid(),
      name,
      description,
      tags: tags.slice(),
      status,
      conditionSet: transformConditionForDB(conditionSet),
      maxDailyActions,
      expirationTime: (expirationTime as Date | null | undefined) ?? undefined,
      creatorId: userId,
      orgId,
      ruleType,
      parentId,
    });

    try {
      await this.models.transactionWithRetry(async () => {
        // Save rule to 'rules' table before adding assocs, to give it
        // a record for foreign keys to reference and test name uniqueness.
        await rule.save();

        if (ruleType === RuleType.CONTENT) {
          await rule.setContentTypes(
            input.contentTypeIds as Mutable<typeof input.contentTypeIds>,
          );
        }

        // The Mutable casts are used to work around a sequelize typings bug.
        await rule.setActions(actionIds as Mutable<typeof actionIds>);
        await rule.setPolicies(policyIds as Mutable<typeof policyIds>);

        // TODO: is this needed?
        await rule.save();
      });
    } catch (e) {
      throw isUniqueConstraintError(e)
        ? makeRuleNameExistsError({ shouldErrorSpan: true })
        : e;
    }

    return rule;
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

  // eslint-disable-next-line complexity
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

    const rule = await this.models.Rule.findOne({
      where: { id, orgId },
      rejectOnEmpty: true,
    }).catch((e) => {
      throw isEmptyResultSetError(e)
        ? makeNotFoundError('Rule not found', {
            detail: `Could not find rule with id ${id}`,
            shouldErrorSpan: true,
          })
        : e;
    });

    if (conditionSet != null && !conditionInputIsValid(conditionSet)) {
      throw new Error('Invalid condition set input');
    }

    // In the case of a content rule update, it's okay if the contentTypeIds isn't
    // provided, since that will just be a no-op via the patchInPlace, but if it
    // is provided, we need to check to make sure there are actually content type
    // IDs present, since an empty list is invalid for content rules.
    if (
      ruleType === 'CONTENT' &&
      input.contentTypeIds &&
      input.contentTypeIds.length === 0
    ) {
      throw makeRuleIsMissingContentTypeError({ shouldErrorSpan: true });
    }

    patchInPlace(rule, {
      name: name ?? undefined,
      description,
      conditionSet:
        conditionSet == null
          ? undefined
          : transformConditionForDB(conditionSet),
      tags: tags?.slice() ?? undefined,
      ruleType,
    });

    if (status && rule.status !== status) {
      rule.status = status;
    }

    if (rule.maxDailyActions !== maxDailyActions) {
      // If maxDailyActions is undefined, it needs to be explicitly converted
      // to null because postgres doesn't understand undefined
      rule.maxDailyActions = maxDailyActions ?? null;
    }

    if (rule.expirationTime !== expirationTime) {
      // If expirationTime is undefined, it needs to be explicitly converted
      // to null because postgres doesn't understand undefined
      rule.expirationTime = (expirationTime as Date | null | undefined) ?? null;
    }

    if (rule.parentId !== parentId) {
      rule.parentId = parentId ?? null;
    }

    // Validate that signals used in automated rules are allowed
    // Check if the rule will have actions meaning automated rule.
    // This ensures we don't allow creating automated rules with signals 
    // that are restricted to routing rules only.
    const willHaveActions = actionIds 
      ? actionIds.length > 0 
      : (await rule.getActions()).length > 0;
    
    if (willHaveActions && conditionSet) {
      await this.validateSignalsAllowedInAutomatedRules(conditionSet, orgId);
    }

    // Before we actually send any updates (which will happen as soon as we call
    // setXXX to set the associations), we need to make sure that there are no
    // active backtests for this rule because, if there are, we should fail the
    // update unless the user's asked to cancel the backtests explicitly.
    if (!cancelRunningBacktests) {
      if (await this.models.Backtest.hasRunningBacktestsForRule(rule.id)) {
        throw makeRuleHasRunningBacktestsError({ shouldErrorSpan: true });
      }
    }

    // Do our updates, in a transaction so that we don't end up with
    // inconsistent state if the name check fails. Technically, I think we'd
    // need to put the hasRunningBacktests call above in this transaction and
    // use SERIALIZABLE to make the update + backtest cancelation logically
    // linearizable w/r/t concurrently started backtests, but that's overkill.
    try {
      await this.models.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
        async () => {
          if (ruleType === 'CONTENT' && input.contentTypeIds) {
            await rule.setContentTypes(
              input.contentTypeIds as Mutable<typeof input.contentTypeIds>,
            );
          }

          // TODO: this is not safe. Let's one org link to a different org's
          // policies/actions.
          if (actionIds) {
            await rule.setActions(actionIds as Mutable<typeof actionIds>);
          }
          if (policyIds) {
            await rule.setPolicies(policyIds as Mutable<typeof policyIds>);
          }

          await rule.save();

          // Finally, if the user asked to delete any running backtests, do it.
          if (cancelRunningBacktests) {
            await this.models.Backtest.cancelRunningBacktestsForRule(rule.id);
          }
        },
      );
    } catch (e) {
      throw isUniqueConstraintError(e)
        ? makeRuleNameExistsError({ shouldErrorSpan: true })
        : e;
    }

    return rule;
  }

  async deleteRule(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;

    try {
      const rule = await this.models.Rule.findOne({ where: { id, orgId } });
      await rule?.destroy();
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
    const [
      actionedSubmissionsByDay,
      actionedSubmissionsByPolicyByDay,
      actionedSubmissionsByTagByDay,
      actionedSubmissionsByActionByDay,
      totalSubmissionsByDay,
    ] = await Promise.all([
      this.actionStats.getActionedSubmissionCountsByDay(orgId),
      this.actionStats.getActionedSubmissionCountsByPolicyByDay(orgId),
      this.actionStats.getActionedSubmissionCountsByTagByDay(orgId),
      this.actionStats.getActionedSubmissionCountsByActionByDay(orgId),
      this.ruleInsights.getContentSubmissionCountsByDay(orgId),
    ]);

    return {
      actionedSubmissionsByDay,
      actionedSubmissionsByPolicyByDay,
      actionedSubmissionsByTagByDay,
      actionedSubmissionsByActionByDay,
      totalSubmissionsByDay,
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

  async createBacktest(_input: any, _user: User) {
    throw new Error('Not Implemented');

    // const id = uid();
    // const rule = await this.models.Rule.findByPk(input.ruleId, {
    //   rejectOnEmpty: true,
    // });
    // const ruleContentTypes = await rule.getContentTypes();

    // if (!ruleContentTypes.length) {
    //   throw new Error(
    //     "Rule is not attached to any content types, so we're " +
    //       'unable to select content to use for the backtest.',
    //   );
    // }

    // const backest = this.models.Backtest.build({
    //   id,
    //   ruleId: input.ruleId,
    //   sampleDesiredSize: input.sampleDesiredSize,
    //   sampleStartAt: new Date(input.sampleStartAt),
    //   sampleEndAt: new Date(input.sampleEndAt),
    //   creatorId: user.id,
    // });

    // await backest.save();

    // // Start sampling and enqueueing the sampled items, but do this without
    // // awaiting so that we can return to the frontend immediately.
    // //
    // // Our query ignores legacy submissions that didn't store their content type
    // // schema at the time of submission, as we can't interpret those reliably
    // // when backtesting. This also has the effect of excluding all rows which
    // // didn't log their submission id or item type id (which is what we want,
    // // since those fields are required, and we started logging them before
    // // logging `schema`). The use of FixSingleTableSelectRowType gets the types
    // // to be aware of all our WHERE clause filters and their implications for
    // // the other columns.
    // // prettier-ignore
    // this.getItemSubmissionsFromSnowflake({
    //   orgId: user.orgId,
    //   randomSample: true,
    //   numRows: input.sampleDesiredSize,
    //   startAt: new Date(input.sampleStartAt),
    //   endAt: new Date(input.sampleEndAt),
    //   itemTypeIds: ruleContentTypes.map(ct => ct.id),
    // }).then(async (submissions) => {
    //     const ruleSetExecutionJobs = submissions.map((it) => ({
    //       orgId: user.orgId,
    //       ruleIds: [input.ruleId],
    //       itemSubmission: it,
    //       environment: RuleEnvironment.BACKTEST,
    //       correlationId: toCorrelationId({ type: 'backtest', id }),
    //     }));

    //     const { failures } = await this.ruleScheduler.enqueueRuleSetExecutions(
    //       ruleSetExecutionJobs,
    //     );

    //     const sampleActualSize = submissions.length - failures.length;
    //     await backest.update({ sampleActualSize, samplingComplete: true });
    //   })
    //   .catch((e) => {
    //     const span = this.tracer.getActiveSpan();
    //     span?.recordException(e);
    //   });

    // return backest;
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
    const allResultsQuery = this.knex('RULE_EXECUTIONS')
      .select({
        // This select is aliasing each column to the corresponding object key,
        // so we have to do fewer renames from snowflakes ALL_CAPS_SNAKE_CASE
        // when we return the final result.
        date: 'DS',
        ts: 'TS',
        contentId: 'ITEM_ID',
        contentType: 'ITEM_TYPE_NAME',
        userId: 'ITEM_CREATOR_ID',
        content: 'ITEM_DATA',
        result: 'RESULT',
      })
      .where(
        'CORRELATION_ID',
        toCorrelationId({ type: 'backtest', id: backtestId }),
      );

    // Now, we can filter down the results to those that satisfy
    // the cursor's before/after requirements, if there is a cursor.
    // Note that how we do this filtering depends on how the results are sorted,
    // because the sorting conceptually happens "before" pagination, and it
    // effects what's "before" and what's "after" a given cursor.
    //
    // Specifically, if the results are sorted descending and we're looking for
    // values _after_ the cursor, then we're looking for timestamp values that
    // are less than the cursor. Similarly, if we're sorting ascending and
    // looking for items before the cursor, then those items must have ts values
    // less than the cursor. In the other cases, it's the opposite.
    const filteredResultsQuery = !cursor
      ? allResultsQuery
      : allResultsQuery.andWhere(
          'TS',
          (sortByTs === SortOrder.DESC && cursor.direction === 'after') ||
            (sortByTs === SortOrder.ASC && cursor.direction === 'before')
            ? '<'
            : '>',
          new Date(cursor.value.ts),
        );

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
        ? filteredResultsQuery.orderBy([desiredSort]).limit(count)
        : takeLast(filteredResultsQuery, [desiredSort], count);

    const results = (
      await sql`${sql.raw(finalQuery.toString())}`.execute(this.snowflake)
    ).rows;

    return results.map((it: any) => ({
      node: { ...it, result: it.result ? jsonParse(it.result) : null },
      cursor: { ts: new Date(it.ts).valueOf() },
    }));
  }

  async getBacktestsForRule(
    ruleId: string,
    backtestIds?: readonly string[] | null,
  ) {
    return this.models.Backtest.findAll({
      where: {
        ruleId,
        ...(backtestIds ? { id: { [Op.in]: backtestIds } } : {}),
      },
    });
  }

  /**
   * NB: This retroaction code is not production-ready. It should only
   * be used for our Slack demo because it has a limit of 100 pieces
   * of content on which it will run. That prevents us from accidentally
   * turning this on and overloading our node servers, and is sufficient
   * for the Slack demo.
   */
  async runRetroaction(_input: GQLRunRetroactionInput, _user: User) {
    throw new Error('Not Implemented');

    // const rule = await this.models.Rule.findByPk(input.ruleId, {
    //   rejectOnEmpty: true,
    // });
    // const ruleContentTypes = await rule.getContentTypes();

    // if (!ruleContentTypes.length) {
    //   throw new Error(
    //     "Rule is not attached to any content types, so we're " +
    //       'unable to select content to use for the backtest.',
    //   );
    // }

    // const id = uid();
    // const submissions = await this.getItemSubmissionsFromSnowflake({
    //   orgId: user.orgId,
    //   itemTypeIds: ruleContentTypes.map((ct) => ct.id),
    //   randomSample: false,
    //   numRows: 100, // TODO: Remove the limit, and instead batch this query
    //   startAt: new Date(input.startAt),
    //   endAt: new Date(input.endAt),
    // });

    // try {
    // const { failures } = await this.ruleScheduler.enqueueRuleSetExecutions(
    //   submissions.map((it) => ({
    //     orgId: user.orgId,
    //     ruleIds: [input.ruleId],
    //     itemSubmission: it,
    //     environment: RuleEnvironment.RETROACTION,
    //     correlationId: toCorrelationId({ type: 'retroaction', id }),
    //   })),
    // );

    // return { _: !failures.length };
    // } catch (e) {
    //   this.tracer.getActiveSpan()?.recordException(e as Exception);
    //   return { _: false };
    // }
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
          `This signal is restricted to routing rules only.`
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
        // It's a leaf condition with a signal
        const { type, id } = condition.signal;
        // GQLSignalType values map to ExternalSignalType (conditions can only
        // contain user-visible external signals). Cast is safe since this comes
        // from validated GraphQL input.
        let signalId: SignalId;
        if (type === 'CUSTOM') {
          // CUSTOM signals require an id field. The id comes from validated GraphQL
          // input where it's a required Scalars['ID'], so we can safely cast it.
          signalId = { type: 'CUSTOM' as const, id: id as NonEmptyString };
        } else {
          // Built-in signals only need the type
          signalId = { type: type as Exclude<ExternalSignalType, 'CUSTOM'> };
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
    'Knex',
    'KyselySnowflake',
    'RuleActionInsights',
    'ActionStatisticsService',
    'Sequelize',
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

