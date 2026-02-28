/* eslint-disable max-lines */
import { sql, type Kysely } from 'kysely';
import { match } from 'ts-pattern';

import { formatClickhouseQuery } from '../../plugins/warehouse/utils/clickhouseSql.js';
import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import type { ConditionWithResult } from '../../models/rules/RuleModel.js';
import { type RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import { type NormalizedItemData } from '../../services/itemProcessingService/index.js';
import {
  BuiltInThirdPartySignalType,
  SignalType,
  UserCreatedExternalSignalType,
  integrationForSignalType,
  type Integration,
} from '../../services/signalsService/index.js';
import { jsonParse, type JsonOf } from '../../utils/encoding.js';
import {
  type Excluding,
  type FixSingleTableReturnedRowType,
} from '../../utils/kysely.js';
import { getUtcDateOnlyString, YEAR_MS } from '../../utils/time.js';
import { type ConditionSetWithResultAsLogged } from '../analyticsLoggers/ruleExecutionLoggingUtils.js';
import {
  sfDateToDate,
  sfDateToDateOnlyString,
  type RuleExecutionsRow,
  type SfDate,
  type SnowflakePublicSchema,
} from '../../snowflake/types.js';

type RulePassSample = {
  date: Date;
  ts: Date;
  result: ConditionSetWithResultAsLogged | undefined;
  contentId: string;
  itemTypeName: string;
  itemTypeId: string;
  userId: string | null;
  content: JsonOf<NormalizedItemData> | undefined;
  environment: RuleEnvironment;
  policyIds: readonly string[];
};

type SignalWithScore = {
  signalName: string;
  score: string;
  integration: Integration | null;
  subcategory?: string;
};

const SIGNAL_SKIPPED_SCORE = 'N/A (Skipped)';

interface ClickhouseRulePassRateRow {
  date: string;
  total_matches: number | null;
  total_requests: number | null;
}

interface ClickhouseRuleExecutionRow {
  ds: string;
  ts: string;
  item_id: string;
  item_type_name: string | null;
  item_type_id: string;
  item_creator_id: string | null;
  item_creator_type_id: string | null;
  item_data: string | null;
  result: string | null;
  environment: string;
  policy_ids: string[] | null;
}

class RuleActionInsights {
  constructor(
    private readonly dialect: Dependencies['DataWarehouseDialect'],
    private readonly getRuleHistory: Dependencies['getSimplifiedRuleHistory'],
    private readonly warehouse: Dependencies['DataWarehouse'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly contentApiRequestsAdapter: Dependencies['ContentApiRequestsAdapter'],
  ) {}

  private get kyselySnowflake(): Kysely<SnowflakePublicSchema> {
    return this.dialect.getKyselyInstance();
  }

  private isClickhouseProvider(): boolean {
    return this.warehouse.getProvider().toLowerCase() === 'clickhouse';
  }

  private async queryClickhouse<T>(
    statement: string,
    params: readonly unknown[],
  ): Promise<readonly T[]> {
    const formatted = formatClickhouseQuery(statement, params);
    const rows = await this.warehouse.query(formatted, this.tracer);
    return rows as readonly T[];
  }

  async getRulePassRateData(
    ruleId: string,
    orgId: string,
    startDate: Date = new Date(Date.now() - YEAR_MS),
  ) {
    if (this.isClickhouseProvider()) {
      const sql = `
        SELECT
          ds AS date,
          countIf(passed = 1) AS total_matches,
          count() AS total_requests
        FROM analytics.RULE_EXECUTIONS
        WHERE org_id = ?
          AND rule_id = ?
          AND ds > ?
        GROUP BY date
        ORDER BY date
      `;

      const rows = await this.queryClickhouse<ClickhouseRulePassRateRow>(sql, [
        orgId,
        ruleId,
        startDate.toISOString().split('T')[0],
      ]);

      return rows.map((row) => ({
        totalMatches: Number(row.total_matches ?? 0),
        totalRequests: Number(row.total_requests ?? 0),
        date: new Date(`${row.date}T00:00:00.000Z`).toJSON(),
      }));
    }

    // NB: action + submission counts here may cross rule versions,
    // but I think that's what we want?
    const results = await this.kyselySnowflake
      .selectFrom('RULE_EXECUTION_STATISTICS')
      .select((eb) => [
        eb.fn.sum<number>('NUM_PASSES').as('totalMatches'),
        eb.fn.sum<number>('NUM_RUNS').as('totalRequests'),
        eb.fn<SfDate>('date', ['TS_START_INCLUSIVE']).as('date'),
      ])
      .where('ORG_ID', '=', orgId)
      .where('RULE_ID', '=', ruleId)
      .where(({ fn, eb }) =>
        eb(
          fn('date', ['TS_START_INCLUSIVE']),
          '>',
          getUtcDateOnlyString(startDate),
        ),
      )
      .groupBy('date')
      .execute();

    return results.map((result) => ({
      ...result,
      // NB: this cast is likely not correct, as I believe result.date is an
      // SfDate, which means this toJSON method returns a non-standard string
      // result, as SfDate overrides Date.prototype.toJSON(). However, we can't
      // change this now without risking a backwards compatibility break.
      date: (result.date as Date).toJSON(),
    }));
  }

  /**
   * This returns examples of content that passed the rule, either under its
   * current conditionSet or, if requested instead, the conditionSet in effect
   * immediately before that. We support fetching samples from the rule's two
   * most-recent conditionSets so that users can compare whether their latest
   * rule change has improved the results.
   */
  async getRulePassingContentSamples(opts: {
    ruleId: string;
    orgId: string;
    numSamples: number;
    itemIds?: string[];
    dateFilter?: string;
    source: 'latestVersion' | 'priorVersion';
  }): Promise<RulePassSample[]> {
    return this.getRuleContentSamples({
      ...opts,
      passingSamplesOnly: true,
    });
  }

  async getRuleContentSamples(opts: {
    ruleId: string;
    orgId: string;
    numSamples: number;
    itemIds?: string[];
    dateFilter?: string;
    source: 'latestVersion' | 'priorVersion';
    passingSamplesOnly?: boolean;
  }): Promise<RulePassSample[]> {
    const {
      ruleId,
      orgId,
      itemIds,
      numSamples,
      dateFilter,
      source,
      passingSamplesOnly = false,
    } = opts;

    // We only wanna show samples generated by the rule's current + prior
    // conditionSet, as showing other samples will give a misleading impression
    // of the rule's behavior. The only way to do that is to use the rule history
    // service. Note that, even if we wanted to just use the rule's latest
    // version, we'd have to use the history service (rather than reading the
    // latest version from snowflake), b/c Snowflake is only eventually
    // consistent (i.e., after a rule update, it won't see the new version for
    // up to 5 minutes, so we'll show cleary outdated samples.)
    const history = await this.getRuleHistory(['conditionSet'], [ruleId]);

    const { exactVersion: mostRecentVersion } = history.at(-1)!;
    const { exactVersion: priorVersion } = history.at(-2) ?? {};

    if (source === 'priorVersion' && !priorVersion) {
      return [];
    }

    if (this.isClickhouseProvider()) {
      return this.getRuleContentSamplesClickhouse({
        ruleId,
        orgId,
        itemIds,
        numSamples,
        dateFilter,
        source,
        passingSamplesOnly,
        mostRecentVersion,
        priorVersion,
      });
    }

    // Selects executions for this rule, verifying that this is the right org.
    // We'll filter by rule version below.
    const baseQuery = this.kyselySnowflake
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
        'POLICY_IDS as policyIds',
      ])
      .where('RULE_ID', '=', ruleId)
      .where('ORG_ID', '=', orgId)
      .where('ITEM_DATA', 'is not', null)
      .$if(passingSamplesOnly, (qb) => qb.where('PASSED', '=', true))
      .$if(itemIds != null && itemIds.length > 0, (qb) =>
        qb.where('ITEM_ID', 'in', itemIds!),
      )
      .$if(dateFilter != null, (qb) =>
        qb.where('DS', '=', getUtcDateOnlyString(new Date(dateFilter!))),
      )
      .limit(numSamples);

    const finalQuery = match(source)
      .with('latestVersion', () => {
        const dateFilter = (() => {
          const mostRecentVersionDate = new Date(mostRecentVersion);
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return mostRecentVersionDate > oneWeekAgo
            ? mostRecentVersionDate
            : oneWeekAgo;
        })();

        return (
          baseQuery
            .where('RULE_VERSION', '>=', mostRecentVersion)
            // Find the date associated w/ the earliest relevant version (with a
            // maximum of 30 days), as passing that w/ the query will help
            // snowflake prune a lot.
            .where('DS', '>=', getUtcDateOnlyString(dateFilter))
            .orderBy('TS', 'desc')
        );
      })
      .with('priorVersion', () =>
        baseQuery
          .where('RULE_VERSION', '>=', priorVersion!)
          .where('RULE_VERSION', '<', mostRecentVersion)
          .where('DS', '>=', getUtcDateOnlyString(new Date(priorVersion!)))
          .where('DS', '<=', getUtcDateOnlyString(new Date(mostRecentVersion))),
      )
      .exhaustive();

    // Cast to this; justified by where clause on ITEM_DATA above.
    type ResultRow = FixSingleTableReturnedRowType<
      typeof finalQuery,
      Excluding<RuleExecutionsRow, 'ITEM_DATA', null>
    >;

    return (await finalQuery.$narrowType<ResultRow>().execute()).map((it) => ({
      ...it,
      date: sfDateToDate(it.date),
      ts: sfDateToDate(it.ts),
      result: it.result != null ? jsonParse(it.result) : undefined,
    }));
  }

  private async getRuleContentSamplesClickhouse(opts: {
    ruleId: string;
    orgId: string;
    numSamples: number;
    itemIds?: string[];
    dateFilter?: string;
    source: 'latestVersion' | 'priorVersion';
    passingSamplesOnly?: boolean;
    mostRecentVersion: string;
    priorVersion?: string;
  }): Promise<RulePassSample[]> {
    const {
      ruleId,
      orgId,
      numSamples,
      itemIds,
      dateFilter,
      source,
      passingSamplesOnly = false,
      mostRecentVersion,
      priorVersion,
    } = opts;

    const conditions: string[] = [
      'org_id = ?',
      'rule_id = ?',
      'item_data IS NOT NULL',
    ];
    const params: unknown[] = [orgId, ruleId];

    if (passingSamplesOnly) {
      conditions.push('passed = 1');
    }

    if (itemIds != null && itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(', ');
      conditions.push(`item_id IN (${placeholders})`);
      params.push(...itemIds);
    }

    if (dateFilter != null) {
      conditions.push('ds = toDate(?)');
      params.push(getUtcDateOnlyString(new Date(dateFilter)));
    }

    if (source === 'latestVersion') {
      conditions.push('rule_version >= parseDateTime64BestEffort(?)');
      params.push(mostRecentVersion);

      const mostRecentVersionDate = new Date(mostRecentVersion);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const lowerBound =
        mostRecentVersionDate > oneWeekAgo ? mostRecentVersionDate : oneWeekAgo;

      conditions.push('ds >= toDate(?)');
      params.push(getUtcDateOnlyString(lowerBound));
    } else {
      if (!priorVersion) {
        return [];
      }

      conditions.push('rule_version >= parseDateTime64BestEffort(?)');
      conditions.push('rule_version < parseDateTime64BestEffort(?)');
      params.push(priorVersion, mostRecentVersion);

      conditions.push('ds >= toDate(?)');
      conditions.push('ds <= toDate(?)');
      params.push(
        getUtcDateOnlyString(new Date(priorVersion)),
        getUtcDateOnlyString(new Date(mostRecentVersion)),
      );
    }

    const sql = `
      SELECT
        ds,
        ts,
        item_id,
        item_type_name,
        item_type_id,
        item_creator_id,
        item_creator_type_id,
        item_data,
        result,
        environment,
        policy_ids
      FROM analytics.RULE_EXECUTIONS
      WHERE ${conditions.join(' AND ')}
      ORDER BY ts DESC
      LIMIT ${Math.max(1, numSamples)}
    `;

    const rows = await this.queryClickhouse<ClickhouseRuleExecutionRow>(
      sql,
      params,
    );

    return rows.map<RulePassSample>((row) => ({
      date: new Date(`${row.ds}T00:00:00.000Z`),
      ts: new Date(row.ts),
      result:
        row.result != null
          ? jsonParse<JsonOf<ConditionSetWithResultAsLogged>>(row.result as JsonOf<ConditionSetWithResultAsLogged>)
          : undefined,
      contentId: row.item_id,
      itemTypeName: row.item_type_name ?? '',
      itemTypeId: row.item_type_id,
      userId: row.item_creator_id,
      userTypeId: row.item_creator_type_id ?? null,
      content:
        row.item_data != null
          ? (row.item_data as JsonOf<NormalizedItemData>)
          : undefined,
      environment: row.environment as RuleEnvironment,
      policyIds: Array.isArray(row.policy_ids) ? row.policy_ids : [],
    }));
  }

  async getContentSubmissionCountsByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    if (this.isClickhouseProvider()) {
      const results =
        await this.contentApiRequestsAdapter.getSuccessfulRequestCountsByDay(
          orgId,
          startAt,
          new Date(),
        );

      return results.map((result) => ({
        date: result.date,
        count: result.count,
      }));
    }

    const startDateString = getUtcDateOnlyString(startAt);
    const results = await this.kyselySnowflake
      .selectFrom('CONTENT_API_REQUESTS')
      .select([sql`COUNT(*)`.as('count'), 'DS'])
      .where('DS', '>', startDateString)
      .where('ORG_ID', '=', orgId)
      .where('EVENT', '=', 'REQUEST_SUCCEEDED')
      .groupBy('DS')
      .execute();

    return results.map((result) => ({
      date: sfDateToDateOnlyString(result.DS),
      count: result.count,
    }));
  }
}

export default inject(
  [
    'DataWarehouseDialect',
    'getSimplifiedRuleHistory',
    'DataWarehouse',
    'Tracer',
    'ContentApiRequestsAdapter',
  ],
  RuleActionInsights,
);
export { type RuleActionInsights, type SignalWithScore };

type GatherSignalsConditionWithResult =
  | GatherSignalsConditionSetWithResult
  | GatherSignalsLeafConditionWithResult;

type GatherSignalsLeafConditionWithResult = {
  signal?: {
    name: string;
    type: string;
    subcategory?: string | null;
  } | null;
  result?: { score?: string | null } | null;
};

type GatherSignalsConditionSetWithResult = {
  conditions: GatherSignalsConditionWithResult[];
};

/** Includes built-in third-party, user-created, and plugin signal types (string). */
const signalResultShouldBeDisplayed = (type: string) =>
  Object.hasOwn(BuiltInThirdPartySignalType, type) ||
  Object.hasOwn(UserCreatedExternalSignalType, type) ||
  !Object.hasOwn(SignalType, type); // plugin signal types not in SignalType enum

/**
 * When we display signal results in the UI (specifically in the rule samples
 * table), we want to only show one column per signal. However, if a rule has
 * many conditions that each use the same signal (e.g. a rule that runs every
 * item type through a given Coop AI model, where each item type needs its own
 * condition), then we only want to have one column in the table that displays
 * the Coop AI model scores, rather than one column per item type. Note that
 * having one column per item type would be especially confusing because the
 * column names are derived from the signal names, not from the item type names,
 * so all of the columns would have the exact same signal name, resulting in
 * seemingly duplicate columns, each with different values in the rows.
 *
 * To deal with this, we want to get one unique (signal name, score) pair for
 * each signal. We always want at least one pair so that no rows have empty
 * values. So we start by inserting the first pair we find for each signal (i.e.
 * the signal result from the very first condition in the rule), even if that
 * condition wasn't run, so the pair will either be (signal name, real score) or
 * (signal name, 'N/A (Skipped)'). Then, for each subsequent condition, we
 * overwrite that pair with the next pair unless the score for the next
 * condition is 'N/A (Skipped)'. It's a bit redundant, but it works and the code
 * is relatively simple.
 */
function getUniqueSignalResults(signalResults: SignalWithScore[]) {
  const signalResultsMap = new Map<string, SignalWithScore>();
  for (const signalResult of signalResults) {
    const { signalName, subcategory } = signalResult;
    const signalIdentifier = `${signalName}${subcategory ?? ''}`;
    const existingResult = signalResultsMap.get(signalIdentifier);
    if (
      existingResult == null ||
      existingResult.score === SIGNAL_SKIPPED_SCORE
    ) {
      signalResultsMap.set(signalIdentifier, signalResult);
    }
  }
  return Array.from(signalResultsMap.values());
}

/**
 * This function traverses through all the leaves of the condition
 * passed in and gathers any (signal name, score) pair that should
 * be displayed in a new column in the table. This is useful for
 * adding columns for things like 3rd party API scores and text similarity
 * scores. That way, users can filter/sort the rows using those scores
 */
export function gatherSignalsFromResult(
  conditionWithResult: ConditionWithResult,
): SignalWithScore[] {
  if ('conditions' in conditionWithResult) {
    return getUniqueSignalResults(
      conditionWithResult.conditions.flatMap((it) =>
        gatherSignalsFromResult(it),
      ),
    );
  }

  if (
    !conditionWithResult.signal ||
    !signalResultShouldBeDisplayed(conditionWithResult.signal.type)
  ) {
    return [];
  }

  const score = conditionWithResult.result?.score;
  const name = conditionWithResult.signal.name;
  return [
    {
      // Unfortunately we have some rows in RULE_EXECUTIONS where, in the
      // `result` column, condition signals are stored without a `name` prop.
      // This is because we were accidentally created some rules where the
      // rule's signals didn't store the signal names, which we've now fixed,
      // but those RULE_EXECUTION logs are still around. So we need to handle
      // those malformed rows. For simplicity, we'll just display the name "Coop
      // AI Model" instead of fetching the model's name from an external service,
      // which would require injecting some dependencies that really shouldn't
      // be injected here.
      signalName: name ?? 'Unknown Signal',
      subcategory: conditionWithResult.signal.subcategory ?? undefined,
      // Round to 3 decimal places if the score is a number. Otherwise just
      // display the whole score string (e.g. for Spectrum scores, which are
      // strings like "High", "Low", "Not Detected")
      score: score
        ? isNaN(Number(score))
          ? score
          : Number(score).toFixed(3)
        : SIGNAL_SKIPPED_SCORE,
      integration: integrationForSignalType(conditionWithResult.signal.type),
    },
  ];
}
