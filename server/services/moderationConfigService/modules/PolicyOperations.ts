import { and, eq, inArray } from 'drizzle-orm';
import { type Writable } from 'type-fest';
import { uid } from 'uid';

import { schema, type CoopDbOrTx } from '../../../storage/postgres/drizzle.js';
import {
  CoopError,
  ErrorType,
  makeNotFoundError,
  makeUnauthorizedError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';
import {
  UserPermission,
  type Invoker,
} from '../../userManagementService/index.js';
import { type Policy } from '../index.js';
import type { PolicyMutationInvoker, PolicyType } from '../types/policies.js';
import { runInTransaction } from './drizzleTx.js';

const policies = schema.policies;

const policyDbSelection = {
  id: policies.id,
  name: policies.name,
  orgId: policies.orgId,
  parentId: policies.parentId,
  createdAt: policies.createdAt,
  updatedAt: policies.updatedAt,
  policyText: policies.policyText,
  enforcementGuidelines: policies.enforcementGuidelines,
  sysPeriod: policies.sysPeriod,
  policyType: policies.policyType,
  semanticVersion: policies.semanticVersion,
  userStrikeCount: policies.userStrikeCount,
  applyUserStrikeCountConfigToChildren:
    policies.applyUserStrikeCountConfigToChildren,
  penalty: policies.penalty,
};

type PolicyDbResult = {
  [
    K in keyof typeof policyDbSelection
  ]: (typeof policyDbSelection)[K]['_']['data'] extends infer D
    ? (typeof policyDbSelection)[K]['_']['notNull'] extends true
      ? D
      : D | null
    : never;
};

function throwNoResult(): never {
  throw new Error('no result');
}

export default class PolicyOperations {
  constructor(
    private readonly pgQuery: CoopDbOrTx,
    private readonly pgQueryReplica: CoopDbOrTx,
    private readonly onDeletePolicyId: (opts: {
      policyId: string;
      orgId: string;
    }) => Promise<void>,
  ) {}

  async getPolicies(opts: { orgId: string; readFromReplica?: boolean }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const results = await pgQuery
      .select(policyDbSelection)
      .from(policies)
      .where(eq(policies.orgId, orgId));

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
    const results = await pgQuery
      .select(policyDbSelection)
      .from(policies)
      .where(and(eq(policies.orgId, orgId), inArray(policies.id, [...ids])));

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
    const rap = schema.rulesAndPolicies;
    const rows = await pgQuery
      .select({ ruleId: rap.ruleId, ...policyDbSelection })
      .from(rap)
      .innerJoin(policies, eq(policies.id, rap.policyId))
      .where(inArray(rap.ruleId, [...ruleIds]));

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
    const [result] = await pgQuery
      .select(policyDbSelection)
      .from(policies)
      .where(and(eq(policies.orgId, orgId), eq(policies.id, policyId)))
      .limit(1);

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
    invokedBy: PolicyMutationInvoker;
  }) {
    const { orgId: org_id, policy, invokedBy } = opts;
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
      invokedBy.orgId !== org_id ||
      ('userId' in invokedBy &&
        !invokedBy.permissions.includes(UserPermission.MANAGE_POLICIES))
    ) {
      throw makeUnauthorizedError(
        'You do not have permission to create policies',
        { shouldErrorSpan: true },
      );
    }

    try {
      const id = uid();
      const newPolicy = await runInTransaction(
        this.pgQuery,
        async (trx) => {
          const parents = await this.#getPolicyParents(trx, org_id);
          this.#validateParent(parents, id, parent_id);
          const [row] = await trx
            .insert(policies)
            .values({
              id,
              name,
              orgId: org_id,
              penalty: 'NONE',
              semanticVersion: 1,
              updatedAt: new Date(),
              ...removeUndefinedKeys({
                parentId: parent_id,
                policyText: policy_text,
                enforcementGuidelines: enforcement_guidelines,
                policyType: policy_type,
                userStrikeCount: user_strike_count,
                applyUserStrikeCountConfigToChildren:
                  apply_user_strike_count_config_to_children,
              }),
            })
            .returning(policyDbSelection);
          return row ?? throwNoResult();
        },
        { isolationLevel: 'serializable' },
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
    invokedBy: PolicyMutationInvoker;
  }) {
    const { orgId, policy, invokedBy } = opts;
    if (
      invokedBy.orgId !== orgId ||
      ('userId' in invokedBy &&
        !invokedBy.permissions.includes(UserPermission.MANAGE_POLICIES))
    ) {
      throw makeUnauthorizedError(
        'You do not have permission to update policies',
        { shouldErrorSpan: true },
      );
    }

    try {
      const updatedPolicy = await runInTransaction(
        this.pgQuery,
        async (trx) => {
          const parents = await this.#getPolicyParents(trx, orgId);
          const current = parents.find(({ id }) => id === policy.id);
          if (current === undefined) {
            throw makeNotFoundError('Policy not found', {
              shouldErrorSpan: true,
            });
          }
          const proposedParent =
            policy.parentId === undefined ? current.parent_id : policy.parentId;
          this.#validateParent(parents, policy.id, proposedParent);
          const [row] = await trx
            .update(policies)
            .set(
              removeUndefinedKeys({
                name: policy.name,
                parentId: policy.parentId,
                policyText: policy.policyText,
                enforcementGuidelines: policy.enforcementGuidelines,
                policyType: policy.policyType,
                userStrikeCount: policy.userStrikeCount ?? undefined,
                applyUserStrikeCountConfigToChildren:
                  policy.applyUserStrikeCountConfigToChildren ?? undefined,
                updatedAt: new Date(),
              }),
            )
            .where(and(eq(policies.orgId, orgId), eq(policies.id, policy.id)))
            .returning(policyDbSelection);
          return row ?? throwNoResult();
        },
        { isolationLevel: 'serializable' },
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

    await this.pgQuery
      .delete(policies)
      .where(and(eq(policies.orgId, orgId), eq(policies.id, policyId)));

    // Kysely's `execute()` on a DELETE always returned one result object, so
    // the old `rowsDeleted.length === 1` check always passed; kept as-is.
    // We don't need to wait for this to complete before returning.
    // Additionally, if it fails, we don't want to throw an error because
    // it's not critical that it succeeds, it's just a 'best effort' cleanup.
    this.onDeletePolicyId({ policyId, orgId }).catch(() => {});
    return true;
  }

  #dbResultToPolicy(it: PolicyDbResult) {
    return it satisfies Writable<Policy> as Policy;
  }

  #getPgQuery(readFromReplica: boolean = false) {
    return readFromReplica ? this.pgQueryReplica : this.pgQuery;
  }

  async #getPolicyParents(trx: CoopDbOrTx, orgId: string) {
    return trx
      .select({ id: policies.id, parent_id: policies.parentId })
      .from(policies)
      .where(eq(policies.orgId, orgId));
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
