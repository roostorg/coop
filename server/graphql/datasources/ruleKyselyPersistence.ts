import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { type JsonObject } from 'type-fest';

import { type BacktestStatusDb } from '../../services/coreAppTables.js';
import {
  computeRuleStatusFromRow,
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
  type Action,
  type ConditionSet,
  type PlainRuleWithLatestVersion,
  type Policy,
} from '../../services/moderationConfigService/index.js';
import { schema, type CoopDbOrTx } from '../../storage/postgres/drizzle.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { type GraphQLUserParent } from './userKyselyPersistence.js';

/**
 * GraphQL Rule parent: plain row fields plus the three resolver getters our
 * Rule / ContentRule / UserRule / RuleInsights resolvers actually use. The
 * codegen mapper for those four GraphQL types points here.
 */
export type GraphQLRuleParent = PlainRuleWithLatestVersion & {
  getCreator(): Promise<GraphQLUserParent>;
  getActions(): Promise<Action[]>;
  getActionParameters(): Promise<
    { actionId: string; parameters: JsonObject }[]
  >;
  getPolicies(): Promise<Policy[]>;
};

export type GraphQLBacktestParent = {
  id: string;
  ruleId: string;
  creatorId: string;
  sampleDesiredSize: number;
  sampleActualSize: number;
  sampleStartAt: Date;
  sampleEndAt: Date;
  samplingComplete: boolean;
  contentItemsProcessed: number;
  contentItemsMatched: number;
  status: BacktestStatusDb;
  createdAt: Date;
  updatedAt: Date;
  cancelationDate: Date | null;
  correctedContentItemsProcessed: number;
  correctedContentItemsMatched: number;
};

const {
  backtests,
  rules,
  rulesAndActions,
  rulesAndItemTypes,
  rulesAndPolicies,
  usersAndFavoriteRules,
} = schema;

/** Matches `public.backtests.status` when generated value is RUNNING. */
const backtestRunningPredicate = and(
  isNull(backtests.cancelationDate),
  or(
    eq(backtests.samplingComplete, false),
    lt(backtests.contentItemsProcessed, backtests.sampleActualSize),
  ),
);

/**
 * Applies the legacy `status` virtual-setter semantics from the Sequelize Rule
 * model: setting `status = EXPIRED` promotes `expiration_time` to max(existing, now);
 * any other status maps 1:1 onto `status_if_unexpired`.
 */
function mapRuleStatusToColumns(
  status: RuleStatus,
  expirationTime: Date | null | undefined,
): {
  status_if_unexpired: Exclude<RuleStatus, typeof RuleStatus.EXPIRED>;
  expiration_time: Date | null;
} {
  if (status === RuleStatus.EXPIRED) {
    const et =
      expirationTime != null
        ? new Date(Math.max(expirationTime.getTime(), Date.now()))
        : new Date();
    return {
      status_if_unexpired: RuleStatus.DRAFT,
      expiration_time: et,
    };
  }
  return {
    status_if_unexpired: status,
    expiration_time: expirationTime ?? null,
  };
}

async function replaceRuleActions(
  trx: CoopDbOrTx,
  ruleId: string,
  actionIds: readonly string[],
  // Per-action parameters; actions absent from the map are persisted as `{}`.
  actionParameters?: ReadonlyMap<string, JsonObject>,
) {
  await trx.delete(rulesAndActions).where(eq(rulesAndActions.ruleId, ruleId));
  if (actionIds.length === 0) {
    return;
  }
  await trx.insert(rulesAndActions).values(
    actionIds.map((actionId) => ({
      ruleId,
      actionId,
      actionParameters: actionParameters?.get(actionId) ?? {},
    })),
  );
}

async function replaceRulePolicies(
  trx: CoopDbOrTx,
  ruleId: string,
  policyIds: readonly string[],
) {
  await trx.delete(rulesAndPolicies).where(eq(rulesAndPolicies.ruleId, ruleId));
  if (policyIds.length === 0) {
    return;
  }
  const now = new Date();
  await trx.insert(rulesAndPolicies).values(
    policyIds.map((policyId) => ({
      ruleId,
      policyId,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

async function replaceRuleItemTypes(
  trx: CoopDbOrTx,
  ruleId: string,
  itemTypeIds: readonly string[],
) {
  await trx
    .delete(rulesAndItemTypes)
    .where(eq(rulesAndItemTypes.ruleId, ruleId));
  if (itemTypeIds.length === 0) {
    return;
  }
  await trx
    .insert(rulesAndItemTypes)
    .values(itemTypeIds.map((itemTypeId) => ({ ruleId, itemTypeId })));
}

export async function kyselyCreateRule(
  trx: CoopDbOrTx,
  input: {
    id: string;
    name: string;
    description: string | null;
    status: RuleStatus;
    conditionSet: ConditionSet;
    tags: readonly string[];
    maxDailyActions: number | null;
    expirationTime: Date | null | undefined;
    creatorId: string;
    orgId: string;
    ruleType: RuleType;
    parentId: string | null | undefined;
    actionIds: readonly string[];
    actionParameters?: ReadonlyMap<string, JsonObject>;
    policyIds: readonly string[];
    contentTypeIds: readonly string[];
  },
): Promise<void> {
  const { status_if_unexpired, expiration_time } = mapRuleStatusToColumns(
    input.status,
    input.expirationTime,
  );
  const now = new Date();

  await trx.insert(rules).values({
    id: input.id,
    name: input.name,
    description: input.description,
    statusIfUnexpired: status_if_unexpired,
    tags: [...input.tags],
    maxDailyActions: input.maxDailyActions,
    dailyActionsRun: 0,
    lastActionDate: null,
    orgId: input.orgId,
    creatorId: input.creatorId,
    expirationTime: expiration_time,
    conditionSet: input.conditionSet,
    alarmStatus: RuleAlarmStatus.INSUFFICIENT_DATA,
    alarmStatusSetAt: now,
    ruleType: input.ruleType,
    parentId: input.parentId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await replaceRuleActions(
    trx,
    input.id,
    input.actionIds,
    input.actionParameters,
  );
  await replaceRulePolicies(trx, input.id, input.policyIds);
  if (input.ruleType === RuleType.CONTENT) {
    await replaceRuleItemTypes(trx, input.id, input.contentTypeIds);
  }
}

export async function kyselyUpdateRule(
  trx: CoopDbOrTx,
  input: {
    id: string;
    orgId: string;
    name?: string | null;
    description: string | null | undefined;
    conditionSet: ConditionSet | undefined;
    tags: string[] | undefined;
    ruleType: RuleType;
    status?: RuleStatus | null;
    maxDailyActions: number | null | undefined;
    expirationTime: Date | null | undefined;
    parentId: string | null | undefined;
    actionIds: readonly string[] | undefined;
    actionParameters?: ReadonlyMap<string, JsonObject>;
    policyIds: readonly string[] | undefined;
    contentTypeIds: readonly string[] | undefined;
  },
): Promise<void> {
  const existing = (
    await trx
      .select({
        id: rules.id,
        statusIfUnexpired: rules.statusIfUnexpired,
        expirationTime: rules.expirationTime,
        ruleType: rules.ruleType,
      })
      .from(rules)
      .where(and(eq(rules.id, input.id), eq(rules.orgId, input.orgId)))
      .limit(1)
  ).at(0);

  if (existing == null) {
    throw makeNotFoundError('Rule not found', {
      detail: `Could not find rule with id ${input.id}`,
      shouldErrorSpan: true,
    });
  }

  const existingStatusIfUnexpired = existing.statusIfUnexpired as Exclude<
    RuleStatus,
    typeof RuleStatus.EXPIRED
  >;

  // Track intended status / expiration changes separately from the existing
  // row values so we only write columns that actually change. This matches
  // Sequelize's "dirty attribute" flush semantics and, crucially, avoids
  // clobbering an existing `expiration_time` when the caller doesn't pass
  // one (the GraphQL input makes `expirationTime` optional).
  let statusIfUnexpiredChanged = false;
  let status_if_unexpired: Exclude<RuleStatus, typeof RuleStatus.EXPIRED> =
    existingStatusIfUnexpired;
  let expirationTimeChanged = false;
  let expiration_time: Date | null = existing.expirationTime;

  const { status, expirationTime: expirationTimeInput } = input;
  const existingStatus = computeRuleStatusFromRow(
    existing.expirationTime,
    existingStatusIfUnexpired,
  );
  if (status && existingStatus !== status) {
    const mapped = mapRuleStatusToColumns(status, existing.expirationTime);
    if (status === RuleStatus.EXPIRED) {
      expiration_time = mapped.expiration_time;
      expirationTimeChanged = true;
    } else {
      status_if_unexpired = mapped.status_if_unexpired;
      statusIfUnexpiredChanged = true;
    }
  }

  // Explicit `expirationTime` input wins over any status-driven expiration
  // derived above. Only overwrite when the caller actually sent a value —
  // `undefined` means "don't touch this column".
  if (expirationTimeInput !== undefined) {
    expiration_time = expirationTimeInput;
    expirationTimeChanged = true;
  }

  const patch: Partial<typeof rules.$inferInsert> = {};
  if (input.name != null) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.conditionSet !== undefined) {
    patch.conditionSet = input.conditionSet;
  }
  if (input.tags !== undefined) {
    patch.tags = input.tags;
  }
  if (input.maxDailyActions !== undefined) {
    patch.maxDailyActions = input.maxDailyActions;
  }
  if (input.parentId !== undefined) {
    patch.parentId = input.parentId;
  }
  if (input.ruleType !== existing.ruleType) {
    patch.ruleType = input.ruleType;
  }
  if (statusIfUnexpiredChanged) {
    patch.statusIfUnexpired = status_if_unexpired;
  }
  if (expirationTimeChanged) {
    patch.expirationTime = expiration_time;
  }

  if (Object.keys(patch).length > 0) {
    await trx
      .update(rules)
      .set(patch)
      .where(and(eq(rules.id, input.id), eq(rules.orgId, input.orgId)));
  }

  if (input.actionIds != null) {
    await replaceRuleActions(
      trx,
      input.id,
      input.actionIds,
      input.actionParameters,
    );
  }
  if (input.policyIds != null) {
    await replaceRulePolicies(trx, input.id, input.policyIds);
  }
  if (input.ruleType === RuleType.CONTENT && input.contentTypeIds != null) {
    await replaceRuleItemTypes(trx, input.id, input.contentTypeIds);
  }
}

export async function kyselyDeleteRule(
  trx: CoopDbOrTx,
  id: string,
  orgId: string,
): Promise<boolean> {
  const row = (
    await trx
      .select({ id: rules.id })
      .from(rules)
      .where(and(eq(rules.id, id), eq(rules.orgId, orgId)))
      .limit(1)
  ).at(0);
  if (row == null) {
    return false;
  }

  await trx.delete(backtests).where(eq(backtests.ruleId, id));
  await trx
    .delete(usersAndFavoriteRules)
    .where(eq(usersAndFavoriteRules.ruleId, id));
  await trx.delete(rules).where(and(eq(rules.id, id), eq(rules.orgId, orgId)));
  return true;
}

export async function kyselyHasRunningBacktestsForRule(
  db: CoopDbOrTx,
  ruleId: string,
): Promise<boolean> {
  const row = (
    await db
      .select({ id: backtests.id })
      .from(backtests)
      .where(and(eq(backtests.ruleId, ruleId), backtestRunningPredicate))
      .limit(1)
  ).at(0);
  return row != null;
}

export async function kyselyCancelRunningBacktestsForRule(
  trx: CoopDbOrTx,
  ruleId: string,
): Promise<void> {
  const now = new Date();
  await trx
    .update(backtests)
    .set({ cancelationDate: now, updatedAt: now })
    .where(and(eq(backtests.ruleId, ruleId), backtestRunningPredicate));
}

export async function kyselyListBacktestsForRule(
  db: CoopDbOrTx,
  ruleId: string,
  backtestIds?: readonly string[] | null,
): Promise<GraphQLBacktestParent[]> {
  const rows = await db
    .select()
    .from(backtests)
    .where(
      and(
        eq(backtests.ruleId, ruleId),
        backtestIds != null && backtestIds.length > 0
          ? inArray(backtests.id, [...backtestIds])
          : undefined,
      ),
    );
  return rows.map((r) => mapBacktestRowToGqlParent(r));
}

export function mapBacktestRowToGqlParent(
  r: typeof backtests.$inferSelect,
): GraphQLBacktestParent {
  // Queues deliver sampled items at-least-once, so processed/matched counters
  // can rarely exceed sample_actual_size. Clamp the values exposed to clients.
  const correctedContentItemsProcessed = Math.min(
    r.sampleActualSize,
    r.contentItemsProcessed,
  );
  const correctedContentItemsMatched = Math.min(
    correctedContentItemsProcessed,
    r.contentItemsMatched,
  );
  return {
    id: r.id,
    ruleId: r.ruleId,
    creatorId: r.creatorId,
    sampleDesiredSize: r.sampleDesiredSize,
    sampleActualSize: r.sampleActualSize,
    sampleStartAt: r.sampleStartAt,
    sampleEndAt: r.sampleEndAt,
    samplingComplete: r.samplingComplete,
    contentItemsProcessed: r.contentItemsProcessed,
    contentItemsMatched: r.contentItemsMatched,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    cancelationDate: r.cancelationDate,
    correctedContentItemsProcessed,
    correctedContentItemsMatched,
  };
}
