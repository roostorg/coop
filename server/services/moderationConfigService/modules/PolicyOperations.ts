import { uid } from 'uid';

import {
  type Prisma,
  type PrismaPgQueryable,
} from '../../../storage/prisma/index.js';
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
import { runInPrismaTransaction } from '../prismaTransaction.js';
import type { PolicyMutationInvoker, PolicyType } from '../types/policies.js';

// `sys_period` is a tstzrange column that Prisma can't read (Unsupported), so
// unlike the Kysely selection it is not part of the row.
const policyPrismaSelect = {
  id: true,
  name: true,
  org_id: true,
  parent_id: true,
  created_at: true,
  updated_at: true,
  policy_text: true,
  enforcement_guidelines: true,
  policy_type: true,
  semantic_version: true,
  user_strike_count: true,
  apply_user_strike_count_config_to_children: true,
  penalty: true,
} as const satisfies Prisma.policiesSelect;

type PolicyPrismaRow = Prisma.policiesGetPayload<{
  select: typeof policyPrismaSelect;
}>;

export default class PolicyOperations {
  constructor(
    private readonly pgQuery: PrismaPgQueryable,
    private readonly pgQueryReplica: PrismaPgQueryable,
    private readonly onDeletePolicyId: (opts: {
      policyId: string;
      orgId: string;
    }) => Promise<void>,
  ) {}

  async getPolicies(opts: { orgId: string; readFromReplica?: boolean }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const results = await pgQuery.policies.findMany({
      select: policyPrismaSelect,
      where: { org_id: orgId },
    });

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
    const results = await pgQuery.policies.findMany({
      select: policyPrismaSelect,
      where: { org_id: orgId, id: { in: [...ids] } },
    });

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
    const rows = await pgQuery.rules_and_policies.findMany({
      select: { rule_id: true, policies: { select: policyPrismaSelect } },
      where: { rule_id: { in: [...ruleIds] } },
    });

    const out: Record<string, Policy[]> = {};
    for (const row of rows) {
      const policy = this.#dbResultToPolicy(row.policies);
      (out[row.rule_id] ??= []).push(policy);
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
    const result = await pgQuery.policies.findFirst({
      select: policyPrismaSelect,
      where: { org_id: orgId, id: policyId },
    });

    return result === null ? undefined : this.#dbResultToPolicy(result);
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
      const newPolicy = await runInPrismaTransaction(
        this.pgQuery,
        { isolationLevel: 'Serializable' },
        async (trx) => {
          const policies = await this.#getPolicyParents(trx, org_id);
          this.#validateParent(policies, id, parent_id);
          return trx.policies.create({
            data: {
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
            },
            select: policyPrismaSelect,
          });
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
      const updatedPolicy = await runInPrismaTransaction(
        this.pgQuery,
        { isolationLevel: 'Serializable' },
        async (trx) => {
          const policies = await this.#getPolicyParents(trx, orgId);
          const current = policies.find(({ id }) => id === policy.id);
          if (current === undefined) {
            throw makeNotFoundError('Policy not found', {
              shouldErrorSpan: true,
            });
          }
          const proposedParent =
            policy.parentId === undefined ? current.parent_id : policy.parentId;
          this.#validateParent(policies, policy.id, proposedParent);
          return trx.policies.update({
            data: removeUndefinedKeys({
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
            where: { org_id: orgId, id: policy.id },
            select: policyPrismaSelect,
          });
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

    await this.pgQuery.policies.deleteMany({
      where: { org_id: orgId, id: policyId },
    });

    // Unconditional, as in the Kysely implementation, whose check on the
    // length of `execute()`'s result (always one DeleteResult) always passed.
    // We don't need to wait for this to complete before returning.
    // Additionally, if it fails, we don't want to throw an error because
    // it's not critical that it succeeds, it's just a 'best effort' cleanup.
    this.onDeletePolicyId({ policyId, orgId }).catch(() => {});
    return true;
  }

  #dbResultToPolicy(it: PolicyPrismaRow): Policy {
    return {
      id: it.id,
      name: it.name,
      orgId: it.org_id,
      parentId: it.parent_id,
      createdAt: it.created_at,
      updatedAt: it.updated_at,
      policyText: it.policy_text,
      enforcementGuidelines: it.enforcement_guidelines,
      policyType: it.policy_type,
      semanticVersion: it.semantic_version,
      userStrikeCount: it.user_strike_count,
      applyUserStrikeCountConfigToChildren:
        it.apply_user_strike_count_config_to_children,
      penalty: it.penalty,
    };
  }

  #getPgQuery(readFromReplica: boolean = false) {
    return readFromReplica ? this.pgQueryReplica : this.pgQuery;
  }

  async #getPolicyParents(trx: PrismaPgQueryable, orgId: string) {
    return trx.policies.findMany({
      select: { id: true, parent_id: true },
      where: { org_id: orgId },
    });
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
