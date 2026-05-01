import { type Insertable, type Kysely, type Updateable, sql } from 'kysely';

import { computeRuleStatusFromRow } from '../../models/rules/ruleTypes.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import { type BacktestStatusDb } from '../../services/coreAppTables.js';
import { makeNotFoundError } from '../../utils/errors.js';
import {
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
  type ConditionSet,
} from '../../services/moderationConfigService/index.js';

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
const backtestRunningPredicate = sql<boolean>`cancelation_date is null
  and (sampling_complete = false or content_items_processed < sample_actual_size)`;

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
  trx: Kysely<CombinedPg>,
  ruleId: string,
  actionIds: readonly string[],
) {
  await trx.deleteFrom('public.rules_and_actions').where('rule_id', '=', ruleId).execute();
  if (actionIds.length === 0) {
    return;
  }
  await trx
    .insertInto('public.rules_and_actions')
    .values(actionIds.map((actionId) => ({ rule_id: ruleId, action_id: actionId })))
    .execute();
}

async function replaceRulePolicies(
  trx: Kysely<CombinedPg>,
  ruleId: string,
  policyIds: readonly string[],
) {
  await trx.deleteFrom('public.rules_and_policies').where('rule_id', '=', ruleId).execute();
  if (policyIds.length === 0) {
    return;
  }
  const now = new Date();
  await trx
    .insertInto('public.rules_and_policies')
    .values(
      policyIds.map((policyId) => ({
        rule_id: ruleId,
        policy_id: policyId,
        created_at: now,
        updated_at: now,
      })),
    )
    .execute();
}

async function replaceRuleItemTypes(
  trx: Kysely<CombinedPg>,
  ruleId: string,
  itemTypeIds: readonly string[],
) {
  await trx.deleteFrom('public.rules_and_item_types').where('rule_id', '=', ruleId).execute();
  if (itemTypeIds.length === 0) {
    return;
  }
  await trx
    .insertInto('public.rules_and_item_types')
    .values(
      itemTypeIds.map((itemTypeId) => ({
        rule_id: ruleId,
        item_type_id: itemTypeId,
      })),
    )
    .execute();
}

export async function kyselyCreateRule(
  trx: Kysely<CombinedPg>,
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
    policyIds: readonly string[];
    contentTypeIds: readonly string[];
  },
): Promise<void> {
  const { status_if_unexpired, expiration_time } = mapRuleStatusToColumns(
    input.status,
    input.expirationTime,
  );
  const now = new Date();

  // `public.rules.created_at` / `updated_at` are NOT NULL in Postgres; Kysely
  // `dbTypes` mark them `GeneratedAlways` so they are omitted from
  // `Insertable`, but inserts must still supply values at runtime. Build the
  // values against an `Insertable & { created_at; updated_at }` so every
  // column is still type-checked, then narrow back to `Insertable` at the
  // call site (a safe widening, not a `never` escape hatch).
  const ruleValues: Insertable<CombinedPg['public.rules']> & {
    created_at: Date;
    updated_at: Date;
  } = {
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
    condition_set: input.conditionSet,
    alarm_status: RuleAlarmStatus.INSUFFICIENT_DATA,
    alarm_status_set_at: now,
    rule_type: input.ruleType,
    parent_id: input.parentId ?? null,
    created_at: now,
    updated_at: now,
  };
  await trx
    .insertInto('public.rules')
    .values(ruleValues as Insertable<CombinedPg['public.rules']>)
    .execute();

  await replaceRuleActions(trx, input.id, input.actionIds);
  await replaceRulePolicies(trx, input.id, input.policyIds);
  if (input.ruleType === RuleType.CONTENT) {
    await replaceRuleItemTypes(trx, input.id, input.contentTypeIds);
  }
}

export async function kyselyUpdateRule(
  trx: Kysely<CombinedPg>,
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
    policyIds: readonly string[] | undefined;
    contentTypeIds: readonly string[] | undefined;
  },
): Promise<void> {
  const existing = await trx
    .selectFrom('public.rules')
    .select(['id', 'status_if_unexpired', 'expiration_time', 'rule_type'])
    .where('id', '=', input.id)
    .where('org_id', '=', input.orgId)
    .executeTakeFirst();

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

  const patch: Updateable<CombinedPg['public.rules']> = {};
  if (input.name != null) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.conditionSet !== undefined) {
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
    await trx
      .updateTable('public.rules')
      .set(patch)
      .where('id', '=', input.id)
      .where('org_id', '=', input.orgId)
      .execute();
  }

  if (input.actionIds != null) {
    await replaceRuleActions(trx, input.id, input.actionIds);
  }
  if (input.policyIds != null) {
    await replaceRulePolicies(trx, input.id, input.policyIds);
  }
  if (input.ruleType === RuleType.CONTENT && input.contentTypeIds != null) {
    await replaceRuleItemTypes(trx, input.id, input.contentTypeIds);
  }
}

export async function kyselyDeleteRule(
  trx: Kysely<CombinedPg>,
  id: string,
  orgId: string,
): Promise<boolean> {
  const row = await trx
    .selectFrom('public.rules')
    .select('id')
    .where('id', '=', id)
    .where('org_id', '=', orgId)
    .executeTakeFirst();
  if (row == null) {
    return false;
  }

  await trx.deleteFrom('public.backtests').where('rule_id', '=', id).execute();
  await trx
    .deleteFrom('public.users_and_favorite_rules')
    .where('rule_id', '=', id)
    .execute();
  await trx.deleteFrom('public.rules').where('id', '=', id).where('org_id', '=', orgId).execute();
  return true;
}

export async function kyselyHasRunningBacktestsForRule(
  kysely: Kysely<CombinedPg>,
  ruleId: string,
): Promise<boolean> {
  const row = await kysely
    .selectFrom('public.backtests')
    .select('id')
    .where('rule_id', '=', ruleId)
    .where(backtestRunningPredicate)
    .executeTakeFirst();
  return row != null;
}

export async function kyselyCancelRunningBacktestsForRule(
  trx: Kysely<CombinedPg>,
  ruleId: string,
): Promise<void> {
  const now = new Date();
  await trx
    .updateTable('public.backtests')
    .set({ cancelation_date: now, updated_at: now })
    .where('rule_id', '=', ruleId)
    .where(backtestRunningPredicate)
    .execute();
}

export async function kyselyListBacktestsForRule(
  kysely: Kysely<CombinedPg>,
  ruleId: string,
  backtestIds?: readonly string[] | null,
): Promise<GraphQLBacktestParent[]> {
  let q = kysely
    .selectFrom('public.backtests')
    .selectAll()
    .where('rule_id', '=', ruleId);
  if (backtestIds != null && backtestIds.length > 0) {
    q = q.where('id', 'in', [...backtestIds]);
  }
  const rows = await q.execute();
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
