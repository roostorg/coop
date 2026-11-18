import { makeEnumLike } from '@roostorg/coop-types';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type ConsumerDirectives } from '../../lib/cache/index.js';
import {
  schema,
  transactionWithRetry,
  type CoopDb,
  type CoopDbOrTx,
} from '../../storage/postgres/drizzle.js';
import { cached } from '../../utils/caching.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { removeUndefinedKeys } from '../../utils/misc.js';
import { replaceEmptyStringWithNull } from '../../utils/string.js';
import {
  type NonEmptyArray,
  type NonEmptyString,
} from '../../utils/typescript-types.js';
import { type ConditionSet } from '../moderationConfigService/index.js';

export const ReportingRuleStatus = makeEnumLike([
  'DRAFT',
  'BACKGROUND',
  'LIVE',
  'ARCHIVED',
]);
export type ReportingRuleStatus = keyof typeof ReportingRuleStatus;

export type ReportingRule = ReadonlyDeep<{
  id: string;
  orgId: string;
  creatorId: string;
  name: string;
  description?: string | null;
  status: ReportingRuleStatus;
  itemTypeIds: string[];
  actionIds: string[];
  policyIds: string[];
  conditionSet: ConditionSet;
  version: string;
}>;
export type ReportingRuleWithoutVersion = Omit<ReportingRule, 'version'>;

export type CreateReportingRuleInput = Readonly<{
  orgId: string;
  name: string;
  creatorId: string;
  description?: string | null;
  status: ReportingRuleStatus;
  itemTypeIds: NonEmptyArray<NonEmptyString>;
  actionIds: readonly string[];
  policyIds: readonly string[];
  conditionSet: ConditionSet;
}>;

export type UpdateReportingRuleInput = Readonly<{
  id: string;
  orgId: string;
  name?: string;
  description?: string | null;
  status?: ReportingRuleStatus;
  itemTypeIds?: NonEmptyArray<NonEmptyString>;
  actionIds?: readonly string[];
  policyIds?: readonly string[];
  conditionSet?: ConditionSet;
}>;

const rr = schema.reportingRules;
const rrv = schema.reportingRuleVersions;
const toItemTypes = schema.reportingRulesToItemTypes;
const toActions = schema.reportingRulesToActions;
const toPolicies = schema.reportingRulesToPolicies;

const reportingRuleSelection = {
  id: rr.id,
  orgId: rr.orgId,
  creatorId: rr.creatorId,
  name: rr.name,
  description: rr.description,
  status: rr.status,
  // jsonb is decoded by pg; the sql<> wrapper only narrows the type.
  conditionSet: sql<ConditionSet>`${rr.conditionSet}`,
};

// Kysely's executeTakeFirstOrThrow message; isReportingRuleNotFoundError
// matches on it.
function throwNoResult(): never {
  throw new Error('no result');
}

export default class ReportingRules {
  private readonly reportingRulesCache;

  constructor(private readonly pgQuery: CoopDb) {
    this.reportingRulesCache = cached({
      producer: async (orgId: string) =>
        this.#getReportingRulesBypassCache(orgId, pgQuery),
      directives: { freshUntilAge: 10 },
    });
  }

  async getReportingRules(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }): Promise<ReadonlyDeep<ReportingRule[]>> {
    const { orgId, directives } = opts;
    return this.reportingRulesCache(orgId, directives);
  }

  async createReportingRule(
    input: CreateReportingRuleInput,
  ): Promise<ReportingRuleWithoutVersion> {
    const {
      orgId,
      name,
      description,
      status,
      conditionSet,
      creatorId,
      itemTypeIds,
      actionIds,
      policyIds,
    } = input;

    return transactionWithRetry(this.pgQuery, async (trx) => {
      const [reportingRule] = await trx
        .insert(rr)
        .values({
          id: uuidv1(),
          orgId,
          name,
          description: replaceEmptyStringWithNull(description),
          status,
          conditionSet,
          creatorId,
        })
        .returning(reportingRuleSelection);
      if (reportingRule === undefined) {
        throwNoResult();
      }

      await trx.insert(toItemTypes).values(
        itemTypeIds.map((itemTypeId) => ({
          reportingRuleId: reportingRule.id,
          itemTypeId,
        })),
      );

      // An empty actionIds throws, as before: Kysely emitted invalid SQL,
      // Drizzle throws "values() must be called with at least one value".
      await trx.insert(toActions).values(
        actionIds.map((actionId) => ({
          actionId,
          reportingRuleId: reportingRule.id,
        })),
      );

      if (policyIds.length > 0) {
        await trx.insert(toPolicies).values(
          policyIds.map((policyId) => ({
            policyId,
            reportingRuleId: reportingRule.id,
          })),
        );
      }

      return {
        ...reportingRule,
        itemTypeIds,
        actionIds,
        policyIds,
      };
    }).catch((e) => {
      throw isReportingRuleNameExistsError(e)
        ? makeReportingRuleNameExistsError({
            detail:
              'The reporting rule was not created because a rule with this name already exists.',
            cause: e,
            shouldErrorSpan: true,
          })
        : e;
    });
  }

  async updateReportingRule(
    input: UpdateReportingRuleInput,
  ): Promise<ReportingRuleWithoutVersion> {
    const {
      id,
      orgId,
      name,
      description,
      status,
      conditionSet,
      itemTypeIds,
      actionIds,
      policyIds,
    } = input;

    return transactionWithRetry(this.pgQuery, async (trx) => {
      const [updatedReportingRule] = await trx
        .update(rr)
        .set({
          ...(conditionSet ? { conditionSet } : {}),
          ...removeUndefinedKeys({
            name,
            description: replaceEmptyStringWithNull(description),
            status,
          }),
        })
        .where(and(eq(rr.id, id), eq(rr.orgId, orgId)))
        .returning(reportingRuleSelection);
      if (updatedReportingRule === undefined) {
        throwNoResult();
      }

      if (itemTypeIds) {
        await trx
          .delete(toItemTypes)
          .where(
            and(
              eq(toItemTypes.reportingRuleId, id),
              notInArray(toItemTypes.itemTypeId, [...itemTypeIds]),
            ),
          );

        await trx
          .insert(toItemTypes)
          .values(
            itemTypeIds.map((itemTypeId) => ({
              reportingRuleId: id,
              itemTypeId,
            })),
          )
          .onConflictDoNothing({
            target: [toItemTypes.reportingRuleId, toItemTypes.itemTypeId],
          });
      }

      if (actionIds) {
        // Empty actionIds: Kysely's `not in ()` failed here; Drizzle's
        // notInArray([]) is `true`, and the empty insert below throws instead.
        await trx
          .delete(toActions)
          .where(
            and(
              eq(toActions.reportingRuleId, id),
              notInArray(toActions.actionId, [...actionIds]),
            ),
          );

        await trx
          .insert(toActions)
          .values(
            actionIds.map((actionId) => ({
              reportingRuleId: id,
              actionId,
            })),
          )
          .onConflictDoNothing({
            target: [toActions.reportingRuleId, toActions.actionId],
          });
      }

      if (policyIds) {
        await trx.delete(toPolicies).where(eq(toPolicies.reportingRuleId, id));

        if (policyIds.length > 0) {
          await trx
            .insert(toPolicies)
            .values(
              policyIds.map((policyId) => ({
                reportingRuleId: id,
                policyId,
              })),
            )
            .onConflictDoNothing({
              target: [toPolicies.reportingRuleId, toPolicies.policyId],
            });
        }
      }

      // Fallback reads go through `trx` and key on the rule's `id`.
      return {
        ...updatedReportingRule,
        itemTypeIds:
          itemTypeIds ?? (await this.#getItemTypeIdsForReportingRule(id, trx)),
        actionIds:
          actionIds ?? (await this.#getActionIdsForReportingRule(id, trx)),
        policyIds:
          policyIds ?? (await this.#getPolicyIdsForReportingRule(id, trx)),
      };
    }).catch((e) => {
      if (isReportingRuleNameExistsError(e)) {
        throw makeReportingRuleNameExistsError({
          detail:
            'The update for this reporting rule was not recorded because the new name already exists as the name of another rule.',
          cause: e,
          shouldErrorSpan: true,
        });
      }

      if (isReportingRuleNotFoundError(e)) {
        throw makeReportingRuleNotFoundError({
          detail: 'The reporting rule does not exist.',
          cause: e,
          shouldErrorSpan: true,
        });
      }

      throw e;
    });
  }

  async deleteReportingRule(input: {
    id: string;
    orgId: string;
  }): Promise<boolean> {
    const { id, orgId } = input;

    return transactionWithRetry(this.pgQuery, async (trx) => {
      // Verify ownership inside the txn before touching any join rows.
      // Skipping this would let a foreign-org `id` wipe that other org's
      // join rows (the join tables have no org column) before the scoped
      // parent delete no-ops.
      const [owned] = await trx
        .select({ id: rr.id })
        .from(rr)
        .where(and(eq(rr.id, id), eq(rr.orgId, orgId)))
        .limit(1);
      if (owned === undefined) {
        return false;
      }

      await trx.delete(toItemTypes).where(eq(toItemTypes.reportingRuleId, id));
      await trx.delete(toActions).where(eq(toActions.reportingRuleId, id));
      await trx.delete(toPolicies).where(eq(toPolicies.reportingRuleId, id));

      const deleteResult = await trx
        .delete(rr)
        .where(and(eq(rr.id, id), eq(rr.orgId, orgId)));

      return deleteResult.rowCount === 1;
    });
  }

  async #getReportingRulesBypassCache(
    orgId: string,
    db: CoopDbOrTx,
  ): Promise<ReportingRule[]> {
    const reportingRules = await db
      .select({
        id: sql<string>`${rrv.id}`,
        orgId: sql<string>`${rrv.orgId}`,
        creatorId: sql<string>`${rrv.creatorId}`,
        name: sql<string>`${rrv.name}`,
        description: rrv.description,
        status: sql<ReportingRuleStatus>`${rrv.status}`,
        conditionSet: sql<ConditionSet>`${rrv.conditionSet}`,
        itemTypeIds: sql<
          string[]
        >`json_agg(distinct ${toItemTypes.itemTypeId})`,
        actionIds: sql<string[]>`json_agg(distinct ${toActions.actionId})`,
        policyIds: sql<
          (string | null)[]
        >`json_agg(distinct ${toPolicies.policyId})`,
        version: rrv.version,
      })
      .from(rrv)
      .innerJoin(toItemTypes, eq(rrv.id, toItemTypes.reportingRuleId))
      .innerJoin(toActions, eq(rrv.id, toActions.reportingRuleId))
      .leftJoin(toPolicies, eq(rrv.id, toPolicies.reportingRuleId))
      .where(and(eq(rrv.orgId, orgId), eq(rrv.isCurrent, true)))
      .groupBy(
        rrv.id,
        rrv.orgId,
        rrv.creatorId,
        rrv.name,
        rrv.description,
        rrv.status,
        rrv.conditionSet,
        rrv.version,
      );

    return reportingRules.map((it) => ({
      ...it,
      policyIds: filterNullOrUndefined(it.policyIds),
      // ReportingRule.version is typed as a string, but (as with Kysely) the
      // timestamptz comes back decoded to a Date.
      version: it.version as unknown as string,
    }));
  }

  async #getItemTypeIdsForReportingRule(
    reportingRuleId: string,
    db: CoopDbOrTx = this.pgQuery,
  ) {
    const results = await db
      .select({ itemTypeId: toItemTypes.itemTypeId })
      .from(toItemTypes)
      .where(eq(toItemTypes.reportingRuleId, reportingRuleId));

    return results.map((row) => row.itemTypeId);
  }

  async #getActionIdsForReportingRule(
    reportingRuleId: string,
    db: CoopDbOrTx = this.pgQuery,
  ) {
    const results = await db
      .select({ actionId: toActions.actionId })
      .from(toActions)
      .where(eq(toActions.reportingRuleId, reportingRuleId));

    return results.map((row) => row.actionId);
  }

  async #getPolicyIdsForReportingRule(
    reportingRuleId: string,
    db: CoopDbOrTx = this.pgQuery,
  ) {
    const results = await db
      .select({ policyId: toPolicies.policyId })
      .from(toPolicies)
      .where(eq(toPolicies.reportingRuleId, reportingRuleId));

    return results.map((row) => row.policyId);
  }
}

export type ReportingRuleErrorType =
  'ReportingRuleNameExistsError' | 'NotFoundError';

// Drizzle wraps the pg error in a DrizzleQueryError whose own message is
// "Failed query: ..."; the pg message is on `cause`.
function isReportingRuleNameExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes(
      'duplicate key value violates unique constraint "reporting_rules_org_id_name_key"',
    ) ||
      isReportingRuleNameExistsError(error.cause))
  );
}

function isReportingRuleNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes('no result');
}

export const makeReportingRuleNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'A reporting rule with this name already exists.',
    name: 'ReportingRuleNameExistsError',
    ...data,
  });

export const makeReportingRuleNotFoundError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 404,
    type: [ErrorType.InvalidUserInput],
    title: 'A reporting rule with this ID is not found',
    name: 'NotFoundError',
    ...data,
  });
