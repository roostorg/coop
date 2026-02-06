import { GQLUserRole } from '../../graphql/generated';
import { assertUnreachable } from '../../utils/misc';

export function getRoleDescription(role: GQLUserRole) {
  switch (role) {
    case GQLUserRole.Admin:
      return (
        'Admins manage their entire organizations. They have full control over ' +
        "all of the organization's resources and settings within Coop."
      );
    case GQLUserRole.RulesManager:
      return (
        'Rules Managers can create, edit, and deploy Rules, and ' +
        'they can view all metrics related to Rules. They cannot create, ' +
        'edit, or delete other organization-level settings, including Actions, ' +
        'Item Types, Manual Review Queues, or other Users in the organization.'
      );
    case GQLUserRole.ModeratorManager: {
      return (
        'Moderator managers can view and edit queues within ' +
        'the Manual Review Tool. They have full control over the, ' +
        'permissions that moderators have, and the Routing Rules that ' +
        'determine how to route each incoming job to the right queue.'
      );
    }
    case GQLUserRole.Moderator: {
      return (
        'Moderators can view the Manual Review tool, but are ' +
        "only able to review jobs from queues that they've been given " +
        'permission to see. They can also view overall Manual Review metrics. ' +
        'They cannot see any Child Safety-related jobs or decisions.'
      );
    }
    case GQLUserRole.ChildSafetyModerator: {
      return (
        'Child Safety Moderators have the same permissions as Moderators, but they ' +
        'are also able to review Child Safety jobs and can see previous Child Safety decisions.'
      );
    }
    case GQLUserRole.Analyst:
      return (
        'Analysts can view metrics for all Rules, create or edit ' +
        'Draft and Background Rules, and run Backtests. They cannot create ' +
        'or edit Live Rules, run Retroaction on Live rules, or edit any ' +
        'other resources (Actions, Content Types, Signals, other Users, ' +
        'etc.). In short, they can experiment with Background Rules and view ' +
        'Rule metrics, but cannot affect any Live Rules or other features ' +
        'that actually mutate your data.'
      );
    case GQLUserRole.ExternalModerator:
      return (
        'External Moderators can only review jobs in the Manual Review tool. ' +
        'They cannot see any decisions or use any other tooling'
      );
    default:
      assertUnreachable(role);
  }
}
