import { makeEnumLike } from '@roostorg/types';

export type Invoker = {
  readonly userId: string;
  readonly permissions: readonly UserPermission[];
  readonly orgId: string;
};

export enum UserPermission {
  // Highest level permission given only to Admins
  MANAGE_ORG = 'MANAGE_ORG',
  // Allows a user to publish/update Live rules
  MUTATE_LIVE_RULES = 'MUTATE_LIVE_RULES',
  // Allows a user to update/test Draft & Background rules
  MUTATE_NON_LIVE_RULES = 'MUTATE_NON_LIVE_RULES',
  // Allows a user to run retroaction on a Live rule
  RUN_RETROACTION = 'RUN_RETROACTION',
  // Allows a user to run a backtest on any rule
  RUN_BACKTEST = 'RUN_BACKTEST',
  // Allows a user to view insights on any rule
  VIEW_INSIGHTS = 'VIEW_INSIGHTS',
  // Allows a user to run a bulk-actioning job
  MANUALLY_ACTION_CONTENT = 'MANUALLY_ACTION_CONTENT',

  // Allows a user to list MRT queues,
  // without necessarily being able to see any of their jobs/contents.
  VIEW_MRT = 'VIEW_MRT',

  // Allows a user to view the contents of MRT queues (in the form of prior
  // decisions) and view certain analytics/reports. This _excludes_ viewing
  // NCMEC job data.
  VIEW_MRT_DATA = 'VIEW_MRT_DATA',

  // Allows a child safety moderator or admin to view child safety related data.
  // This extends VIEW_MRT_DATA to NCMEC.
  VIEW_CHILD_SAFETY_DATA = 'VIEW_CHILD_SAFETY_DATA',

  // Allows a user to create and edit MRT queues, including changing which users
  // have permission to review items in a queue. Any user with this permission
  // implicitly can review (i.e., decide on) jobs in any queue, even if they're
  // not explicitly associated with it in the db, as the ability to edit a queue
  // means they could've added themselves to it.
  EDIT_MRT_QUEUES = 'EDIT_MRT_QUEUES',

  // Allows users to add, update, or delete a policy definition
  MANAGE_POLICIES = 'MANAGE_POLICIES',

  // Allows users to use Investigation tool
  VIEW_INVESTIGATION = 'VIEW_INVESTIGATION',
  VIEW_RULES_DASHBOARD = 'VIEW_RULES_DASHBOARD',
}

const UserRoles = [
  // Admins manage all users within their orgs, and they
  // have every permission available.
  'ADMIN',
  // Rules managers can modify and run rules and actions,
  // but cannot manage/modify users in their org.
  'RULES_MANAGER',
  // Moderator managers can only view MRT and can view and edit queues along
  // with permissions of Moderators
  'MODERATOR_MANAGER',
  // Moderators can only view MRT, and can only review queues that they've been
  // given permission to see by admins and moderator managers
  'MODERATOR',
  // Moderators who review child safety jobs need access to all child safety
  // related pages, including the "NCMEC Reports" page. Legally, other
  // moderators (and analysts, rules managers, etc.) shouldn't be able to
  // see any child safety data that may be CSAM.
  'CHILD_SAFETY_MODERATOR',
  // Analysts can see all rules and their insights, modify
  // and test background rules, and run backtests on live
  // rules, but cannot edit/publish live rules.
  'ANALYST',
  // Can only view MRT and safety settings
  'EXTERNAL_MODERATOR',
];
export const UserRole = makeEnumLike(UserRoles);
export type UserRole = keyof typeof UserRole;

/**
 * Maps UserRoles to all the UserPermissions that each Role has
 */
export const UserPermissionsForRole = new Map<UserRole, UserPermission[]>([
  [UserRole.ADMIN, Object.values(UserPermission)],
  [
    UserRole.RULES_MANAGER,
    [
      UserPermission.MUTATE_LIVE_RULES,
      UserPermission.MUTATE_NON_LIVE_RULES,
      UserPermission.RUN_RETROACTION,
      UserPermission.RUN_BACKTEST,
      UserPermission.VIEW_INSIGHTS,
      UserPermission.MANUALLY_ACTION_CONTENT,
      UserPermission.MANAGE_POLICIES,
      UserPermission.VIEW_INVESTIGATION,
      UserPermission.VIEW_RULES_DASHBOARD,
    ],
  ],
  [
    UserRole.ANALYST,
    [
      UserPermission.MUTATE_NON_LIVE_RULES,
      UserPermission.RUN_BACKTEST,
      UserPermission.VIEW_INSIGHTS,
      UserPermission.VIEW_INVESTIGATION,
      UserPermission.VIEW_RULES_DASHBOARD,
    ],
  ],
  [
    UserRole.MODERATOR_MANAGER,
    [
      UserPermission.VIEW_MRT,
      UserPermission.VIEW_MRT_DATA,
      UserPermission.EDIT_MRT_QUEUES,
      UserPermission.MANAGE_POLICIES,
      UserPermission.VIEW_INVESTIGATION,
      UserPermission.VIEW_RULES_DASHBOARD,
      UserPermission.VIEW_CHILD_SAFETY_DATA,
      UserPermission.MANUALLY_ACTION_CONTENT,
    ],
  ],
  [
    UserRole.MODERATOR,
    [
      UserPermission.VIEW_MRT,
      UserPermission.VIEW_MRT_DATA,
      UserPermission.MANAGE_POLICIES,
      UserPermission.MANUALLY_ACTION_CONTENT,
      UserPermission.VIEW_INVESTIGATION,
      UserPermission.VIEW_RULES_DASHBOARD,
    ],
  ],
  [
    UserRole.CHILD_SAFETY_MODERATOR,
    [
      UserPermission.VIEW_MRT,
      UserPermission.VIEW_MRT_DATA,
      UserPermission.VIEW_CHILD_SAFETY_DATA,
      UserPermission.MANAGE_POLICIES,
      UserPermission.MANUALLY_ACTION_CONTENT,
      UserPermission.VIEW_INVESTIGATION,
      UserPermission.VIEW_RULES_DASHBOARD,
    ],
  ],
  [UserRole.EXTERNAL_MODERATOR, [UserPermission.VIEW_MRT]],
]);

// all defined.
export function hasPermission(permission: UserPermission, role: UserRole) {
  return getPermissionsForRole(role).includes(permission);
}

export function getPermissionsForRole(role: UserRole) {
  return UserPermissionsForRole.get(role) ?? [];
}
