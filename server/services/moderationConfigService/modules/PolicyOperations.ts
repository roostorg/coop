import { type Kysely, type Transaction } from 'kysely';
import { type Writable } from 'type-fest';
import { uid } from 'uid';

import {
  CoopError,
  ErrorType,
  makeNotFoundError,
  makeUnauthorizedError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import {
  isUniqueViolationError,
  type FixKyselyRowCorrelation,
} from '../../../utils/kysely.js';
import {
  makeKyselyTransactionWithRetry,
  type KyselyTransactionWithRetry,
} from '../../../utils/kyselyTransactionWithRetry.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';
import {
  UserPermission,
  type Invoker,
} from '../../userManagementService/index.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
import { type Policy } from '../index.js';
import { type ModerationConfigMutationActor } from '../types/mutationActor.js';
import type { PolicyType } from '../types/policies.js';

const policyDbSelection = [
  'id',
  'name',
  'org_id as orgId',
  'parent_id as parentId',
  'created_at as createdAt',
  'updated_at as updatedAt',
  'policy_text as policyText',
  'enforcement_guidelines as enforcementGuidelines',
  'sys_period as sysPeriod',
  'policy_type as policyType',
  'semantic_version as semanticVersion',
  'user_strike_count as userStrikeCount',
  'apply_user_strike_count_config_to_children as applyUserStrikeCountConfigToChildren',
  'penalty',
] as const;

const policyJoinDbSelection = [
  'rap.rule_id as ruleId',
  'p.id',
  'p.name',
  'p.org_id as orgId',
  'p.parent_id as parentId',
  'p.created_at as createdAt',
  'p.updated_at as updatedAt',
  'p.policy_text as policyText',
  'p.enforcement_guidelines as enforcementGuidelines',
  'p.sys_period as sysPeriod',
  'p.policy_type as policyType',
  'p.semantic_version as semanticVersion',
  'p.user_strike_count as userStrikeCount',
  'p.apply_user_strike_count_config_to_children as applyUserStrikeCountConfigToChildren',
  'p.penalty',
] as const;

type PolicyDbResult = FixKyselyRowCorrelation<
  ModerationConfigServicePg['public.policies'],
  typeof policyDbSelection
>;

export default class PolicyOperations {
  private readonly transactionWithRetry: KyselyTransactionWithRetry<ModerationConfigServicePg>;

  constructor(
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
    private readonly onDeletePolicyId: (opts: {
      policyId: string;
      orgId: string;
    }) => Promise<void>,
  ) {
    this.transactionWithRetry = makeKyselyTransactionWithRetry(this.pgQuery);
  }

  async getPolicies(opts: { orgId: string; readFromReplica?: boolean }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const query = pgQuery
      .selectFrom('public.policies')
      .select(policyDbSelection)
      .where('org_id', '=', orgId);
    const results = (await query.execute()) as PolicyDbResult[];

    return results.map((it) => this.#dbResultToPolicy(it));
  }

  async getPoliciesByIds(opts: {
    orgId: string;
    ids: readonly string[];
    readFromReplica?: boolean;
  }): Promise<Policy[]> {
    const { orgId, ids, readFromReplica } = opts;
    if (ids.length === 0) {
      return [];
    }
    const pgQuery = this.#getPgQuery(readFromReplica ?? true);
    const results = (await pgQuery
      .selectFrom('public.policies')
      .select(policyDbSelection)
      .where('org_id', '=', orgId)
      .where('id', 'in', [...ids])
      .execute()) as PolicyDbResult[];

    return results.map((it) => this.#dbResultToPolicy(it));
  }

  async getPoliciesByRuleIds(opts: {
    ruleIds: readonly string[];
    readFromReplica?: boolean;
  }): Promise<Record<string, Policy[]>> {
    const { ruleIds, readFromReplica } = opts;
    if (ruleIds.length === 0) {
      return {};
    }
    const pgQuery = this.#getPgQuery(readFromReplica ?? true);
    type Row = PolicyDbResult & { ruleId: string };
    const rows = (await pgQuery
      .selectFrom('public.rules_and_policies as rap')
      .innerJoin('public.policies as p', 'p.id', 'rap.policy_id')
      .select(policyJoinDbSelection)
      .where('rap.rule_id', 'in', [...ruleIds])
      .execute()) as Row[];

    const out: Record<string, Policy[]> = {};
    for (const row of rows) {
      const { ruleId, ...policyFields } = row;
      const policy = this.#dbResultToPolicy(policyFields);
      (out[ruleId] ??= []).push(policy);
    }
    return out;
  }

  async getPolicy(opts: {
    orgId: string;
    policyId: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, policyId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const query = pgQuery
      .selectFrom('public.policies')
      .select(policyDbSelection)
      .where('org_id', '=', orgId)
      .where('id', '=', policyId);
    const result = await query.executeTakeFirst();

    return result === undefined ? undefined : this.#dbResultToPolicy(result);
  }

  async createPolicy(opts: {
    orgId: string;
    policy: {
      name: string;
      parentId?: string | null;
      policyText?: string | null;
      enforcementGuidelines?: string | null;
      policyType?: PolicyType | null;
      userStrikeCount?: number;
      applyUserStrikeCountConfigToChildren?: boolean;
    };
    actor: ModerationConfigMutationActor;
  }) {
    const { orgId: org_id, policy, actor } = opts;
    const {
      name,
      parentId: parent_id,
      policyText: policy_text,
      enforcementGuidelines: enforcement_guidelines,
      policyType: policy_type,
      userStrikeCount: user_strike_count,
      applyUserStrikeCountConfigToChildren:
        apply_user_strike_count_config_to_children,
    } = policy;
    if (
      actor.orgId !== org_id ||
      (actor.type === 'user' &&
        !actor.permissions.includes(UserPermission.MANAGE_POLICIES))
    ) {
      throw makeUnauthorizedError(
        'You do not have permission to create policies',
        { shouldErrorSpan: true },
      );
    }

    try {
      const id = uid();
      const newPolicy = await this.transactionWithRetry(
        { isolationLevel: 'serializable' },
        async (trx) => {
          const policies = await this.#lockPolicies(trx, org_id);
          this.#validateParent(policies, id, parent_id);
          return trx
            .insertInto('public.policies')
            .values({
              id,
              name,
              org_id,
              penalty: 'NONE',
              semantic_version: 1,
              updated_at: new Date(),
              ...removeUndefinedKeys({
                parent_id,
                policy_text,
                enforcement_guidelines,
                policy_type,
                user_strike_count,
                apply_user_strike_count_config_to_children,
              }),
            })
            .returning(policyDbSelection)
            .executeTakeFirstOrThrow();
        },
      );

      return this.#dbResultToPolicy(newPolicy);
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makePolicyNameExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async updatePolicy(opts: {
    orgId: string;
    policy: {
      id: string;
      name?: string;
      parentId?: string | null;
      policyText?: string | null;
      enforcementGuidelines?: string | null;
      policyType?: PolicyType | null;
      userStrikeCount?: number | null;
      applyUserStrikeCountConfigToChildren?: boolean | null;
    };
    actor: ModerationConfigMutationActor;
  }) {
    const { orgId, policy, actor } = opts;
    if (
      actor.orgId !== orgId ||
      (actor.type === 'user' &&
        !actor.permissions.includes(UserPermission.MANAGE_POLICIES))
    ) {
      throw makeUnauthorizedError(
        'You do not have permission to update policies',
        { shouldErrorSpan: true },
      );
    }

    try {
      const updatedPolicy = await this.transactionWithRetry(
        { isolationLevel: 'serializable' },
        async (trx) => {
          const policies = await this.#lockPolicies(trx, orgId);
          const current = policies.find(({ id }) => id === policy.id);
          if (current === undefined) {
            throw makeNotFoundError('Policy not found', {
              shouldErrorSpan: true,
            });
          }
          const proposedParent =
            policy.parentId === undefined ? current.parent_id : policy.parentId;
          this.#validateParent(policies, policy.id, proposedParent);
          return trx
            .updateTable('public.policies')
            .set(
              removeUndefinedKeys({
                name: policy.name,
                parent_id: policy.parentId,
                policy_text: policy.policyText,
                enforcement_guidelines: policy.enforcementGuidelines,
                policy_type: policy.policyType,
                user_strike_count: policy.userStrikeCount ?? undefined,
                apply_user_strike_count_config_to_children:
                  policy.applyUserStrikeCountConfigToChildren ?? undefined,
                updated_at: new Date(),
              }),
            )
            .where('org_id', '=', orgId)
            .where('id', '=', policy.id)
            .returning(policyDbSelection)
            .executeTakeFirstOrThrow();
        },
      );

      return this.#dbResultToPolicy(updatedPolicy);
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makePolicyNameExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async deletePolicy(opts: {
    orgId: string;
    policyId: string;
    invokedBy: Invoker;
  }) {
    const { orgId, policyId, invokedBy } = opts;
    if (!invokedBy.permissions.includes(UserPermission.MANAGE_POLICIES)) {
      throw makeUnauthorizedError(
        'You do not have permission to delete policies',
        { shouldErrorSpan: true },
      );
    }

    const rowsDeleted = await this.pgQuery
      .deleteFrom('public.policies')
      .where('org_id', '=', orgId)
      .where('id', '=', policyId)
      .execute();

    if (rowsDeleted.length === 1) {
      // We don't need to wait for this to complete before returning.
      // Additionally, if it fails, we don't want to throw an error because
      // it's not critical that it succeeds, it's just a 'best effort' cleanup.
      this.onDeletePolicyId({ policyId, orgId }).catch(() => {});
      return true;
    }

    return false;
  }

  #dbResultToPolicy(it: PolicyDbResult) {
    return it satisfies Writable<Policy> as Policy;
  }

  #getPgQuery(readFromReplica: boolean = false) {
    return readFromReplica ? this.pgQueryReplica : this.pgQuery;
  }

  async #lockPolicies(
    trx: Transaction<ModerationConfigServicePg>,
    orgId: string,
  ) {
    return trx
      .selectFrom('public.policies')
      .select(['id', 'parent_id'])
      .where('org_id', '=', orgId)
      .orderBy('id')
      .forUpdate()
      .execute();
  }

  #validateParent(
    policies: readonly { id: string; parent_id: string | null }[],
    policyId: string,
    parentId: string | null | undefined,
  ) {
    if (parentId == null) return;
    const parents = new Map(
      policies.map((policy) => [policy.id, policy.parent_id]),
    );
    if (!parents.has(parentId))
      throw makeInvalidPolicyParentError({ shouldErrorSpan: true });
    parents.set(policyId, parentId);
    const visited = new Set<string>();
    let cursor: string | null | undefined = policyId;
    while (cursor != null) {
      if (visited.has(cursor))
        throw makePolicyHierarchyCycleError({ shouldErrorSpan: true });
      visited.add(cursor);
      cursor = parents.get(cursor);
    }
  }
}

export type PolicyErrorType =
  | 'PolicyNameExistsError'
  | 'InvalidPolicyParentError'
  | 'PolicyHierarchyCycleError';

// TODO: throw this error on failed policy creation/update when appropriate.
export const makePolicyNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'A policy with that name already exists in this organization.',
    name: 'PolicyNameExistsError',
    ...data,
  });

export const makeInvalidPolicyParentError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'The selected parent policy is invalid.',
    name: 'InvalidPolicyParentError',
    ...data,
  });

export const makePolicyHierarchyCycleError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.Conflict],
    title: 'The policy hierarchy cannot contain a cycle.',
    name: 'PolicyHierarchyCycleError',
    ...data,
  });
