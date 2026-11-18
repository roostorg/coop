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
import {
  type Prisma,
  type PrismaPgQueryable,
} from '../../storage/prisma/index.js';
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

/** Matches `public.backtests.status` when generated value is RUNNING. */
function backtestRunningWhere(
  db: PrismaPgQueryable,
): Prisma.backtestsWhereInput {
  return {
    cancelation_date: null,
    OR: [
      { sampling_complete: false },
      {
        content_items_processed: {
          lt: db.backtests.fields.sample_actual_size,
        },
      },
    ],
  };
}

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
  trx: PrismaPgQueryable,
  ruleId: string,
  actionIds: readonly string[],
  // Per-action parameters; actions absent from the map are persisted as `{}`.
  actionParameters?: ReadonlyMap<string, JsonObject>,
) {
  await trx.rules_and_actions.deleteMany({ where: { rule_id: ruleId } });
  if (actionIds.length === 0) {
    return;
  }
  await trx.rules_and_actions.createMany({
    data: actionIds.map((actionId) => ({
      rule_id: ruleId,
      action_id: actionId,
      // `JsonObject` (type-fest) isn't assignable to Prisma's JSON input type.
      action_parameters: actionParameters?.get(actionId) ?? {},
    })),
  });
}

async function replaceRulePolicies(
  trx: PrismaPgQueryable,
  ruleId: string,
  policyIds: readonly string[],
) {
  await trx.rules_and_policies.deleteMany({ where: { rule_id: ruleId } });
  if (policyIds.length === 0) {
    return;
  }
  const now = new Date();
  await trx.rules_and_policies.createMany({
    data: policyIds.map((policyId) => ({
      rule_id: ruleId,
      policy_id: policyId,
      created_at: now,
      updated_at: now,
    })),
  });
}

async function replaceRuleItemTypes(
  trx: PrismaPgQueryable,
  ruleId: string,
  itemTypeIds: readonly string[],
) {
  await trx.rules_and_item_types.deleteMany({ where: { rule_id: ruleId } });
  if (itemTypeIds.length === 0) {
    return;
  }
  await trx.rules_and_item_types.createMany({
    data: itemTypeIds.map((itemTypeId) => ({
      rule_id: ruleId,
      item_type_id: itemTypeId,
    })),
  });
}

export async function kyselyCreateRule(
  trx: PrismaPgQueryable,
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

  const ruleValues: Prisma.rulesUncheckedCreateInput = {
    id: input.id,
    name: input.name,
    description: input.description,
    status_if_unexpired,
    tags: [...input.tags],
    max_daily_actions: input.maxDailyActions,
    daily_actions_run: 0,
    last_action_date: null,
    org_id: input.orgId,
    creator_id: input.creatorId,
    expiration_time,
    // Domain type isn't assignable to Prisma's JSON input type.
    condition_set: input.conditionSet,
    alarm_status: RuleAlarmStatus.INSUFFICIENT_DATA,
    alarm_status_set_at: now,
    rule_type: input.ruleType,
    parent_id: input.parentId ?? null,
    created_at: now,
    updated_at: now,
  };
  await trx.rules.create({ data: ruleValues });

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
  trx: PrismaPgQueryable,
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
  const existing = await trx.rules.findFirst({
    select: {
      id: true,
      status_if_unexpired: true,
      expiration_time: true,
      rule_type: true,
    },
    where: { id: input.id, org_id: input.orgId },
  });

  if (existing == null) {
    throw makeNotFoundError('Rule not found', {
      detail: `Could not find rule with id ${input.id}`,
      shouldErrorSpan: true,
    });
  }

  const existingStatusIfUnexpired = existing.status_if_unexpired as Exclude<
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
  let expiration_time: Date | null = existing.expiration_time;

  const { status, expirationTime: expirationTimeInput } = input;
  const existingStatus = computeRuleStatusFromRow(
    existing.expiration_time,
    existingStatusIfUnexpired,
  );
  if (status && existingStatus !== status) {
    const mapped = mapRuleStatusToColumns(status, existing.expiration_time);
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

  const patch: Prisma.rulesUncheckedUpdateManyInput = {};
  if (input.name != null) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.conditionSet !== undefined) {
    // Domain type isn't assignable to Prisma's JSON input type.
    patch.condition_set = input.conditionSet;
  }
  if (input.tags !== undefined) {
    patch.tags = input.tags;
  }
  if (input.maxDailyActions !== undefined) {
    patch.max_daily_actions = input.maxDailyActions;
  }
  if (input.parentId !== undefined) {
    patch.parent_id = input.parentId;
  }
  if (input.ruleType !== existing.rule_type) {
    patch.rule_type = input.ruleType;
  }
  if (statusIfUnexpiredChanged) {
    patch.status_if_unexpired = status_if_unexpired;
  }
  if (expirationTimeChanged) {
    patch.expiration_time = expiration_time;
  }

  if (Object.keys(patch).length > 0) {
    await trx.rules.updateMany({
      data: patch,
      where: { id: input.id, org_id: input.orgId },
    });
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
  trx: PrismaPgQueryable,
  id: string,
  orgId: string,
): Promise<boolean> {
  const row = await trx.rules.findFirst({
    select: { id: true },
    where: { id, org_id: orgId },
  });
  if (row == null) {
    return false;
  }

  await trx.backtests.deleteMany({ where: { rule_id: id } });
  await trx.users_and_favorite_rules.deleteMany({ where: { rule_id: id } });
  await trx.rules.deleteMany({ where: { id, org_id: orgId } });
  return true;
}

export async function kyselyHasRunningBacktestsForRule(
  db: PrismaPgQueryable,
  ruleId: string,
): Promise<boolean> {
  const row = await db.backtests.findFirst({
    select: { id: true },
    where: { rule_id: ruleId, ...backtestRunningWhere(db) },
  });
  return row != null;
}

export async function kyselyCancelRunningBacktestsForRule(
  trx: PrismaPgQueryable,
  ruleId: string,
): Promise<void> {
  const now = new Date();
  await trx.backtests.updateMany({
    data: { cancelation_date: now, updated_at: now },
    where: { rule_id: ruleId, ...backtestRunningWhere(trx) },
  });
}

export async function kyselyListBacktestsForRule(
  db: PrismaPgQueryable,
  ruleId: string,
  backtestIds?: readonly string[] | null,
): Promise<GraphQLBacktestParent[]> {
  const rows = await db.backtests.findMany({
    where: {
      rule_id: ruleId,
      ...(backtestIds != null && backtestIds.length > 0
        ? { id: { in: [...backtestIds] } }
        : {}),
    },
  });
  return rows.map((r) => mapBacktestRowToGqlParent(r));
}

export function mapBacktestRowToGqlParent(r: {
  id: string;
  rule_id: string;
  creator_id: string;
  sample_desired_size: number;
  sample_actual_size: number;
  sample_start_at: Date;
  sample_end_at: Date;
  sampling_complete: boolean;
  content_items_processed: number;
  content_items_matched: number;
  status: BacktestStatusDb;
  created_at: Date;
  updated_at: Date;
  cancelation_date: Date | null;
}): GraphQLBacktestParent {
  // Queues deliver sampled items at-least-once, so processed/matched counters
  // can rarely exceed sample_actual_size. Clamp the values exposed to clients.
  const correctedContentItemsProcessed = Math.min(
    r.sample_actual_size,
    r.content_items_processed,
  );
  const correctedContentItemsMatched = Math.min(
    correctedContentItemsProcessed,
    r.content_items_matched,
  );
  return {
    id: r.id,
    ruleId: r.rule_id,
    creatorId: r.creator_id,
    sampleDesiredSize: r.sample_desired_size,
    sampleActualSize: r.sample_actual_size,
    sampleStartAt: r.sample_start_at,
    sampleEndAt: r.sample_end_at,
    samplingComplete: r.sampling_complete,
    contentItemsProcessed: r.content_items_processed,
    contentItemsMatched: r.content_items_matched,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cancelationDate: r.cancelation_date,
    correctedContentItemsProcessed,
    correctedContentItemsMatched,
  };
}
