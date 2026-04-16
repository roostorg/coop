import {
  UserPenaltySeverity,
  type ModerationConfigService,
} from './moderationConfigService/index.js';

export type PolicyActionPenalties = {
  actionId: string;
  policyId: string;
  penalties: number[];
};

/**
 * Computes the severity of the penalty we should apply for a given
 * (action, policy) pair. See legacy OrgModel documentation.
 */
export function computeActionPolicyPenalty(
  actionPenalty: UserPenaltySeverity,
  policyPenalty: UserPenaltySeverity,
): number {
  const penaltySeverityMap: { [k in UserPenaltySeverity]: number } = {
    [UserPenaltySeverity.NONE]: 0,
    [UserPenaltySeverity.LOW]: 1,
    [UserPenaltySeverity.MEDIUM]: 3,
    [UserPenaltySeverity.HIGH]: 9,
    [UserPenaltySeverity.SEVERE]: 27,
  };

  return actionPenalty === UserPenaltySeverity.NONE
    ? 0
    : penaltySeverityMap[actionPenalty] + penaltySeverityMap[policyPenalty];
}

export async function getPolicyActionPenaltiesForOrg(
  moderationConfigService: ModerationConfigService,
  orgId: string,
): Promise<PolicyActionPenalties[]> {
  const [actions, policies] = await Promise.all([
    moderationConfigService.getActions({ orgId, readFromReplica: true }),
    moderationConfigService.getPolicies({ orgId, readFromReplica: true }),
  ]);

  return policies.flatMap((policy) =>
    actions.map((action) => ({
      actionId: action.id,
      policyId: policy.id,
      penalties: [
        computeActionPolicyPenalty(action.penalty, policy.penalty),
      ],
    })),
  );
}
