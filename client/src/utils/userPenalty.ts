import { GQLUserPenaltySeverity } from '../graphql/generated';

export const UserPenaltySeverityOrder = [
  GQLUserPenaltySeverity.None,
  GQLUserPenaltySeverity.Low,
  GQLUserPenaltySeverity.Medium,
  GQLUserPenaltySeverity.High,
  GQLUserPenaltySeverity.Severe,
];

export function getSeverityColor(severity: GQLUserPenaltySeverity) {
  switch (severity) {
    case GQLUserPenaltySeverity.None:
      return 'border-coop-blue text-coop-blue';
    case GQLUserPenaltySeverity.Low:
    case GQLUserPenaltySeverity.Medium:
      return 'border-coop-orange text-coop-orange';
    case GQLUserPenaltySeverity.High:
    case GQLUserPenaltySeverity.Severe:
      return 'border-coop-alert-red text-coop-alert-red';
  }
}
