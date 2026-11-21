import { makeEnumLike } from '@roostorg/coop-types';
import { type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type ConsumerDirectives } from '../../lib/cache/index.js';
import {
  assertNonEmptyIdList,
  Prisma,
  type PrismaPgClient,
  type PrismaPgQueryable,
} from '../../storage/prisma/index.js';
import { cached } from '../../utils/caching.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { getPgErrorDetails } from '../../utils/kysely.js';
import { removeUndefinedKeys } from '../../utils/misc.js';
import {
  makePrismaTransactionWithRetry,
  type PrismaTransactionWithRetry,
} from '../../utils/prismaTransactionWithRetry.js';
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

const reportingRuleSelect = {
  id: true,
  org_id: true,
  creator_id: true,
  name: true,
  description: true,
  status: true,
  condition_set: true,
} as const satisfies Prisma.reporting_rulesSelect;

type SelectedReportingRuleRow = Prisma.reporting_rulesGetPayload<{
  select: typeof reportingRuleSelect;
}>;

function toReportingRule(row: SelectedReportingRuleRow) {
  return {
    id: row.id,
    orgId: row.org_id,
    creatorId: row.creator_id,
    name: row.name,
    description: row.description,
    status: row.status,
    // JSON columns come back as Prisma.JsonValue; the column only ever holds
    // a ConditionSet.
    conditionSet: row.condition_set as ConditionSet,
  };
}

class ReportingRuleNotFound extends Error {}

export default class ReportingRules {
  private readonly reportingRulesCache;
  private readonly transactionWithRetry: PrismaTransactionWithRetry;

  constructor(private readonly prisma: PrismaPgClient) {
    this.reportingRulesCache = cached({
      producer: async (orgId: string) =>
        this.#getReportingRulesBypassCache(orgId, prisma),
      directives: { freshUntilAge: 10 },
    });
    this.transactionWithRetry = makePrismaTransactionWithRetry(this.prisma);
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

    return this.transactionWithRetry(async (tx) => {
      const reportingRule = await tx.reporting_rules.create({
        data: {
          id: uuidv1(),
          org_id: orgId,
          name,
          description: replaceEmptyStringWithNull(description),
          status,
          condition_set: conditionSet,
          creator_id: creatorId,
        },
        select: reportingRuleSelect,
      });

      await tx.reporting_rules_to_item_types.createMany({
        data: itemTypeIds.map((itemTypeId) => ({
          reporting_rule_id: reportingRule.id,
          item_type_id: itemTypeId,
        })),
      });

      await tx.reporting_rules_to_actions.createMany({
        data: actionIds.map((actionId) => ({
          action_id: actionId,
          reporting_rule_id: reportingRule.id,
        })),
      });

      if (policyIds.length > 0) {
        await tx.reporting_rules_to_policies.createMany({
          data: policyIds.map((policyId) => ({
            policy_id: policyId,
            reporting_rule_id: reportingRule.id,
          })),
        });
      }

      return {
        ...toReportingRule(reportingRule),
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

    return this.transactionWithRetry(async (tx) => {
      const updatedReportingRule = (
        await tx.reporting_rules.updateManyAndReturn({
          where: { id, org_id: orgId },
          data: {
            ...(conditionSet ? { condition_set: conditionSet } : {}),
            ...removeUndefinedKeys({
              name,
              description: replaceEmptyStringWithNull(description),
              status,
            }),
          },
          select: reportingRuleSelect,
        })
      ).at(0);
      if (updatedReportingRule === undefined) {
        throw new ReportingRuleNotFound();
      }

      if (itemTypeIds) {
        assertNonEmptyIdList('itemTypeIds', itemTypeIds);
        await tx.reporting_rules_to_item_types.deleteMany({
          where: {
            reporting_rule_id: id,
            item_type_id: { notIn: itemTypeIds },
          },
        });

        await tx.reporting_rules_to_item_types.createMany({
          data: itemTypeIds.map((itemTypeId) => ({
            reporting_rule_id: id,
            item_type_id: itemTypeId,
          })),
          skipDuplicates: true,
        });
      }

      if (actionIds) {
        assertNonEmptyIdList('actionIds', actionIds);
        await tx.reporting_rules_to_actions.deleteMany({
          where: {
            reporting_rule_id: id,
            action_id: { notIn: [...actionIds] },
          },
        });

        await tx.reporting_rules_to_actions.createMany({
          data: actionIds.map((actionId) => ({
            reporting_rule_id: id,
            action_id: actionId,
          })),
          skipDuplicates: true,
        });
      }

      if (policyIds) {
        await tx.reporting_rules_to_policies.deleteMany({
          where: { reporting_rule_id: id },
        });

        if (policyIds.length > 0) {
          await tx.reporting_rules_to_policies.createMany({
            data: policyIds.map((policyId) => ({
              reporting_rule_id: id,
              policy_id: policyId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Fallback reads go through `tx` and key on the rule's `id`.
      return {
        ...toReportingRule(updatedReportingRule),
        itemTypeIds:
          itemTypeIds ?? (await this.#getItemTypeIdsForReportingRule(id, tx)),
        actionIds:
          actionIds ?? (await this.#getActionIdsForReportingRule(id, tx)),
        policyIds:
          policyIds ?? (await this.#getPolicyIdsForReportingRule(id, tx)),
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

      if (e instanceof ReportingRuleNotFound) {
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

    return this.transactionWithRetry(async (tx) => {
      // Verify ownership inside the txn before touching any join rows.
      // Skipping this would let a foreign-org `id` wipe that other org's
      // join rows (the join tables have no org column) before the scoped
      // parent delete no-ops.
      const owned = await tx.reporting_rules.findFirst({
        select: { id: true },
        where: { id, org_id: orgId },
      });
      if (owned === null) {
        return false;
      }

      await tx.reporting_rules_to_item_types.deleteMany({
        where: { reporting_rule_id: id },
      });

      await tx.reporting_rules_to_actions.deleteMany({
        where: { reporting_rule_id: id },
      });

      await tx.reporting_rules_to_policies.deleteMany({
        where: { reporting_rule_id: id },
      });

      const deleteResult = await tx.reporting_rules.deleteMany({
        where: { id, org_id: orgId },
      });

      return deleteResult.count === 1;
    });
  }

  async #getReportingRulesBypassCache(
    orgId: string,
    db: PrismaPgQueryable,
  ): Promise<ReportingRule[]> {
    // prisma-raw: json_agg(distinct ...) aggregates over joins onto a matview
    const reportingRules = await db.$queryRaw<
      {
        id: string;
        orgId: string;
        creatorId: string;
        name: string;
        description: string | null;
        status: ReportingRuleStatus;
        conditionSet: ConditionSet;
        itemTypeIds: string[];
        actionIds: string[];
        policyIds: (string | null)[];
        version: string;
      }[]
    >(Prisma.sql`
      SELECT
        reporting_rules.id,
        reporting_rules.org_id AS "orgId",
        reporting_rules.creator_id AS "creatorId",
        reporting_rules.name,
        reporting_rules.description,
        reporting_rules.status::text AS status,
        reporting_rules.condition_set AS "conditionSet",
        json_agg(DISTINCT rules_to_item_types.item_type_id) AS "itemTypeIds",
        json_agg(DISTINCT rules_to_actions.action_id) AS "actionIds",
        json_agg(DISTINCT rules_to_policies.policy_id) AS "policyIds",
        reporting_rules.version
      FROM reporting_rules.reporting_rule_versions AS reporting_rules
      INNER JOIN reporting_rules.reporting_rules_to_item_types AS rules_to_item_types
        ON reporting_rules.id = rules_to_item_types.reporting_rule_id
      INNER JOIN reporting_rules.reporting_rules_to_actions AS rules_to_actions
        ON reporting_rules.id = rules_to_actions.reporting_rule_id
      LEFT JOIN reporting_rules.reporting_rules_to_policies AS rules_to_policies
        ON reporting_rules.id = rules_to_policies.reporting_rule_id
      WHERE reporting_rules.org_id = ${orgId}
        AND reporting_rules.is_current = true
      GROUP BY
        reporting_rules.id,
        reporting_rules.org_id,
        reporting_rules.creator_id,
        reporting_rules.name,
        reporting_rules.description,
        reporting_rules.status,
        reporting_rules.condition_set,
        reporting_rules.version
    `);

    return reportingRules.map((it) => ({
      ...it,
      policyIds: filterNullOrUndefined(it.policyIds),
    }));
  }

  async #getItemTypeIdsForReportingRule(
    reportingRuleId: string,
    db: PrismaPgQueryable = this.prisma,
  ) {
    const results = await db.reporting_rules_to_item_types.findMany({
      select: { item_type_id: true },
      where: { reporting_rule_id: reportingRuleId },
    });

    return results.map((row) => row.item_type_id);
  }

  async #getActionIdsForReportingRule(
    reportingRuleId: string,
    db: PrismaPgQueryable = this.prisma,
  ) {
    const results = await db.reporting_rules_to_actions.findMany({
      select: { action_id: true },
      where: { reporting_rule_id: reportingRuleId },
    });

    return results.map((row) => row.action_id);
  }

  async #getPolicyIdsForReportingRule(
    reportingRuleId: string,
    db: PrismaPgQueryable = this.prisma,
  ) {
    const results = await db.reporting_rules_to_policies.findMany({
      select: { policy_id: true },
      where: { reporting_rule_id: reportingRuleId },
    });

    return results.map((row) => row.policy_id);
  }
}

export type ReportingRuleErrorType =
  'ReportingRuleNameExistsError' | 'NotFoundError';

function isReportingRuleNameExistsError(error: unknown) {
  const details = getPgErrorDetails(error);
  return (
    details?.code === '23505' &&
    details.constraint === 'reporting_rules_org_id_name_key'
  );
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
