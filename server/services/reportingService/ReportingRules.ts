import { type ConsumerDirectives } from '../../lib/cache/index.js';
import { makeEnumLike } from '@roostorg/types';
import { sql, type Kysely, type Transaction } from 'kysely';
import { type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

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
import { type ReportingServicePg } from './dbTypes.js';

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

const reportingRuleSelection = [
  'id',
  'org_id as orgId',
  'creator_id as creatorId',
  'name',
  'description',
  'status',
  'condition_set as conditionSet',
] as const;

export default class ReportingRules {
  private readonly reportingRulesCache;

  constructor(private readonly pgQuery: Kysely<ReportingServicePg>) {
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

    return this.pgQuery
      .transaction()
      .execute(async (trx) => {
        const reportingRule = await trx
          .insertInto('reporting_rules.reporting_rules')
          .values({
            id: uuidv1(),
            org_id: orgId,
            name,
            description: replaceEmptyStringWithNull(description),
            status,
            condition_set: conditionSet,
            creator_id: creatorId,
          })
          .returning(reportingRuleSelection)
          .executeTakeFirstOrThrow();

        await trx
          .insertInto('reporting_rules.reporting_rules_to_item_types')
          .values(
            itemTypeIds.map((itemTypeId) => ({
              reporting_rule_id: reportingRule.id,
              item_type_id: itemTypeId,
            })),
          )
          .execute();

        await trx
          .insertInto('reporting_rules.reporting_rules_to_actions')
          .values(
            actionIds.map((actionId) => ({
              action_id: actionId,
              reporting_rule_id: reportingRule.id,
            })),
          )
          .execute();

        if (policyIds.length > 0) {
          await trx
            .insertInto('reporting_rules.reporting_rules_to_policies')
            .values(
              policyIds.map((policyId) => ({
                policy_id: policyId,
                reporting_rule_id: reportingRule.id,
              })),
            )
            .execute();
        }

        return {
          ...reportingRule,
          itemTypeIds: itemTypeIds as string[],
          actionIds,
          policyIds,
        };
      })
      .catch((e) => {
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

    return this.pgQuery
      .transaction()
      .execute(async (trx) => {
        const updatedReportingRule = await trx
          .updateTable('reporting_rules.reporting_rules')
          .set({
            ...(conditionSet ? { condition_set: conditionSet } : {}),
            ...removeUndefinedKeys({
              name,
              description: replaceEmptyStringWithNull(description),
              status,
            }),
          })
          .where('id', '=', id)
          .where('org_id', '=', orgId)
          .returning(reportingRuleSelection)
          .executeTakeFirstOrThrow();

        if (itemTypeIds) {
          await trx
            .deleteFrom('reporting_rules.reporting_rules_to_item_types')
            .where(({ eb, and }) =>
              and([
                eb('reporting_rule_id', '=', id),
                eb('item_type_id', 'not in', itemTypeIds),
              ]),
            )
            .execute();

          await trx
            .insertInto('reporting_rules.reporting_rules_to_item_types')
            .values(
              itemTypeIds.map((itemTypeId) => ({
                reporting_rule_id: id,
                item_type_id: itemTypeId,
              })),
            )
            .onConflict((oc) =>
              oc.columns(['reporting_rule_id', 'item_type_id']).doNothing(),
            )
            .execute();
        }

        if (actionIds) {
          await trx
            .deleteFrom('reporting_rules.reporting_rules_to_actions')
            .where(({ eb, and }) =>
              and([
                eb('reporting_rule_id', '=', id),
                eb('action_id', 'not in', actionIds),
              ]),
            )
            .execute();

          await trx
            .insertInto('reporting_rules.reporting_rules_to_actions')
            .values(
              actionIds.map((actionId) => ({
                reporting_rule_id: id,
                action_id: actionId,
              })),
            )
            .onConflict((oc) =>
              oc.columns(['reporting_rule_id', 'action_id']).doNothing(),
            )
            .execute();
        }

        if (policyIds) {
          await trx
            .deleteFrom('reporting_rules.reporting_rules_to_policies')
            .where('reporting_rule_id', '=', id)
            .execute();

          if (policyIds.length > 0) {
            await trx
              .insertInto('reporting_rules.reporting_rules_to_policies')
              .values(
                policyIds.map((policyId) => ({
                  reporting_rule_id: id,
                  policy_id: policyId,
                })),
              )
              .onConflict((oc) =>
                oc.columns(['reporting_rule_id', 'policy_id']).doNothing(),
              )
              .execute();
          }
        }

        return {
          ...updatedReportingRule,
          itemTypeIds:
            itemTypeIds ?? (await this.#getItemTypeIdsForReportingRule(orgId)),
          actionIds:
            actionIds ?? (await this.#getActionIdsForReportingRule(orgId)),
          policyIds:
            policyIds ?? (await this.#getPolicyIdsForReportingRule(orgId)),
        };
      })
      .catch((e) => {
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

  async deleteReportingRule(input: { id: string }) {
    const { id } = input;

    return this.pgQuery
      .transaction()
      .execute(async (trx) => {
        await trx
          .deleteFrom('reporting_rules.reporting_rules_to_item_types')
          .where('reporting_rule_id', '=', id)
          .execute();
        return true;
      })
      .catch((_error) => false);
  }

  async #getReportingRulesBypassCache(
    orgId: string,
    db: Transaction<ReportingServicePg> | Kysely<ReportingServicePg>,
  ): Promise<ReportingRule[]> {
    const reportingRules = await db
      .selectFrom('reporting_rules.reporting_rule_versions as reporting_rules')
      .innerJoin(
        'reporting_rules.reporting_rules_to_item_types as rules_to_item_types',
        'reporting_rules.id',
        'rules_to_item_types.reporting_rule_id',
      )
      .innerJoin(
        'reporting_rules.reporting_rules_to_actions as rules_to_actions',
        'reporting_rules.id',
        'rules_to_actions.reporting_rule_id',
      )
      .leftJoin(
        'reporting_rules.reporting_rules_to_policies as rules_to_policies',
        'reporting_rules.id',
        'rules_to_policies.reporting_rule_id',
      )
      .where('reporting_rules.org_id', '=', orgId)
      .where('reporting_rules.is_current', '=', true)
      .select([
        ...reportingRuleSelection,
        sql<string[]>`json_agg(distinct rules_to_item_types.item_type_id)`.as(
          'itemTypeIds',
        ),
        sql<string[]>`json_agg(distinct rules_to_actions.action_id)`.as(
          'actionIds',
        ),
        sql<string[]>`json_agg(distinct rules_to_policies.policy_id)`.as(
          'policyIds',
        ),
        'version',
      ])
      .groupBy([
        'reporting_rules.id',
        'reporting_rules.org_id',
        'reporting_rules.creator_id',
        'reporting_rules.name',
        'reporting_rules.description',
        'reporting_rules.status',
        'reporting_rules.condition_set',
        'reporting_rules.version',
      ])
      .execute();

    return reportingRules.map((it) => ({
      ...it,
      policyIds: filterNullOrUndefined(it.policyIds),
    }));
  }

  async #getItemTypeIdsForReportingRule(
    reportingRuleId: string,
    db: Transaction<ReportingServicePg> | Kysely<ReportingServicePg> = this
      .pgQuery,
  ) {
    const results = await db
      .selectFrom('reporting_rules.reporting_rules_to_item_types')
      .select('item_type_id as itemTypeId')
      .where('reporting_rule_id', '=', reportingRuleId)
      .execute();

    return results.map((row) => row.itemTypeId);
  }

  async #getActionIdsForReportingRule(
    reportingRuleId: string,
    db: Transaction<ReportingServicePg> | Kysely<ReportingServicePg> = this
      .pgQuery,
  ) {
    const results = await db
      .selectFrom('reporting_rules.reporting_rules_to_actions')
      .select('action_id as actionId')
      .where('reporting_rule_id', '=', reportingRuleId)
      .execute();

    return results.map((row) => row.actionId);
  }

  async #getPolicyIdsForReportingRule(
    reportingRuleId: string,
    db: Transaction<ReportingServicePg> | Kysely<ReportingServicePg> = this
      .pgQuery,
  ) {
    const results = await db
      .selectFrom('reporting_rules.reporting_rules_to_policies')
      .select('policy_id as policyId')
      .where('reporting_rule_id', '=', reportingRuleId)
      .execute();

    return results.map((row) => row.policyId);
  }
}

export type ReportingRuleErrorType =
  | 'ReportingRuleNameExistsError'
  | 'NotFoundError';

function isReportingRuleNameExistsError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(
      'duplicate key value violates unique constraint "reporting_rules_org_id_name_key"',
    )
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
