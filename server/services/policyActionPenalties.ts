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
 * (action, policy) pair. The general idea is to make the penalties
 * increase exponentially as severity levels increase, but the rate
 * of increase can't be so high that a (severe, severe) penalty is
 * 50x higher than a (high, high) penalty.
 *
 * The easiest way to achieve this exponential behavior is at the individual
 * severity levels, rather than trying to multiply the action penalty
 * by the severity penalty to compound their magnitudes. So the severity
 * levels apply penalty magnitudes as follows:
 *
 * NONE = 0
 * LOW = 1
 * MEDIUM = 3
 * HIGH = 9
 * SEVERE = 27
 *
 * To get the penalty value for an (action, policy) pair, we just add the
 * penalty values of the action and policy because the exponential nature
 * of these penalties has already been taken into account.
 *
 * If the action has no penalty (e.g., "Send to Moderation", "Restore
 * Content"), we never apply any penalty, regardless of the policy penalty.
 * Otherwise, the penalty accounts for both the action + policy penalties.
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
