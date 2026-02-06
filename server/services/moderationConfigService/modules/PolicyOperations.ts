import { type Kysely } from 'kysely';
import { type Writable } from 'type-fest';
import { uid } from 'uid';

import {
  UserPermission,
  type Invoker,
} from '../../../models/types/permissioning.js';
import {
  CoopError,
  ErrorType,
  makeUnauthorizedError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import {
  isUniqueViolationError,
  type FixKyselyRowCorrelation,
  type FixSingleTableReturnedRowType,
} from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
import { type Policy } from '../index.js';
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
  'penalty', // TODO: remove
] as const;

type PolicyDbResult = FixKyselyRowCorrelation<
  ModerationConfigServicePg['public.policies'],
  typeof policyDbSelection
>;

export default class PolicyOperations {
  constructor(
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
    private readonly onDeletePolicyId: (opts: {
      policyId: string;
      orgId: string;
    }) => Promise<void>,
  ) {}

  async getPolicies(opts: { orgId: string; readFromReplica?: boolean }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const query = pgQuery
      .selectFrom('public.policies')
      .select(policyDbSelection)
      .where('org_id', '=', orgId);
    const results = (await query.execute()) as FixSingleTableReturnedRowType<
      typeof query
    >[];

    return results.map((it) => this.#dbResultToPolicy(it));
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
    const result =
      (await query.executeTakeFirst()) as FixSingleTableReturnedRowType<
        typeof query
      >;

    return this.#dbResultToPolicy(result);
  }

  async createPolicy(opts: {
    orgId: string;
    policy: {
      name: string;
      parentId?: string | null;
      policyText?: string | null;
      enforcementGuidelines?: string | null;
      policyType?: PolicyType | null;
    };
    invokedBy: Invoker;
  }) {
    const { orgId: org_id, policy, invokedBy } = opts;
    const {
      name,
      parentId: parent_id,
      policyText: policy_text,
      enforcementGuidelines: enforcement_guidelines,
      policyType: policy_type,
    } = policy;
    if (!invokedBy.permissions.includes(UserPermission.MANAGE_POLICIES)) {
      throw makeUnauthorizedError(
        'You do not have permission to create policies',
        { shouldErrorSpan: true },
      );
    }

    try {
      const newPolicy = await this.pgQuery
        .insertInto('public.policies')
        .values({
          id: uid(),
          name,
          org_id,
          parent_id,
          penalty: 'NONE',
          policy_text,
          enforcement_guidelines,
          policy_type,
          semantic_version: 1,
          updated_at: new Date(),
        })
        .returning(policyDbSelection)
        .executeTakeFirstOrThrow();

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
    invokedBy: Invoker;
  }) {
    const { orgId, policy, invokedBy } = opts;
    if (!invokedBy.permissions.includes(UserPermission.MANAGE_POLICIES)) {
      throw makeUnauthorizedError(
        'You do not have permission to update policies',
        { shouldErrorSpan: true },
      );
    }

    try {
      const updatedPolicy = await this.pgQuery
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
}

export type PolicyErrorType = 'PolicyNameExistsError';

// TODO: throw this error on failed policy creation/update when appropriate.
export const makePolicyNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'A policy with that name already exists in this organization.',
    name: 'PolicyNameExistsError',
    ...data,
  });
