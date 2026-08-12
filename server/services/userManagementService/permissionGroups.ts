import { UserPermission } from './permissioning.js';

/**
 * Server-owned grouping + ordering of {@link UserPermission} values for the
 * role-editor UI. New permissions without an explicit group fall through
 * to "Other" via {@link getPermissionGroups}.
 */
export type PermissionGroupItem = {
  permission: UserPermission;
  label: string;
  description: string;
};

export type PermissionGroup = {
  key: string;
  label: string;
  description: string;
  permissions: readonly PermissionGroupItem[];
};

const ORG_GROUP: PermissionGroup = {
  key: 'ORGANIZATION_MANAGEMENT',
  label: 'Organization Management',
  description:
    'Highest-impact permissions. Grant only to users who should be able to ' +
    'reconfigure the organization itself.',
  permissions: [
    {
      permission: UserPermission.MANAGE_ORG,
      label: 'Manage Organization Settings',
      description: 'Can modify organization-level settings',
    },
    {
      permission: UserPermission.MANAGE_USERS,
      label: 'Manage Users',
      description: 'Can add, edit, or remove users',
    },
    {
      permission: UserPermission.MANAGE_ROLES,
      label: 'Manage Roles',
      description: 'Can modify role permissions',
    },
  ],
};

const RULES_GROUP: PermissionGroup = {
  key: 'RULES_MANAGEMENT',
  label: 'Rules Management',
  description: 'Authoring, running, and analyzing rules.',
  permissions: [
    {
      permission: UserPermission.MUTATE_NON_LIVE_RULES,
      label: 'Create Draft Rules',
      description: 'Can create or edit Draft and Background Rules',
    },
    {
      permission: UserPermission.MUTATE_LIVE_RULES,
      label: 'Create Live Rules',
      description: 'Can create, edit, and deploy Live Rules',
    },
    {
      permission: UserPermission.RUN_BACKTEST,
      label: 'Run Backtests',
      description: 'Can run Backtests on Rules',
    },
    {
      permission: UserPermission.RUN_RETROACTION,
      label: 'Run Retroaction',
      description: 'Can run Retroaction on Live Rules',
    },
    {
      permission: UserPermission.VIEW_INSIGHTS,
      label: 'View Rules Metrics',
      description: 'Can view metrics for all Rules',
    },
    {
      permission: UserPermission.VIEW_RULES_DASHBOARD,
      label: 'View Rules Dashboard',
      description: 'Can access the rules dashboard surface',
    },
    {
      permission: UserPermission.MANAGE_POLICIES,
      label: 'Manage Policies',
      description: 'Can add, update, and delete policy definitions',
    },
  ],
};

const MANUAL_REVIEW_GROUP: PermissionGroup = {
  key: 'MANUAL_REVIEW',
  label: 'Manual Review',
  description: 'Reviewing queues and acting on jobs in the MRT.',
  permissions: [
    {
      permission: UserPermission.VIEW_MRT,
      label: 'View Manual Review Tool',
      description:
        'Can see that queues exist, without necessarily seeing their contents',
    },
    {
      permission: UserPermission.VIEW_MRT_DATA,
      label: 'View Manual Review Metrics',
      description: 'Can view metrics for Manual Reviews',
    },
    {
      permission: UserPermission.EDIT_MRT_QUEUES,
      label: 'Manage Queues And Routing',
      description: 'Can view and edit Manual Review queues and routing rules',
    },
    {
      permission: UserPermission.MANAGE_ROUTING_RULES,
      label: 'Manage Routing Rules',
      description: 'Can manage Routing Rules for job distribution',
    },
    {
      permission: UserPermission.MANUALLY_ACTION_CONTENT,
      label: 'Manually Action Content',
      description:
        'Can run bulk-actioning jobs and take direct moderation action',
    },
    {
      permission: UserPermission.VIEW_CHILD_SAFETY_DATA,
      label: 'View Child Safety Content',
      description: 'Can see Child Safety-related jobs and decisions',
    },
  ],
};

const INVESTIGATION_GROUP: PermissionGroup = {
  key: 'INVESTIGATION',
  label: 'Investigation',
  description: 'Tooling for ad-hoc investigation across signals.',
  permissions: [
    {
      permission: UserPermission.VIEW_INVESTIGATION,
      label: 'View Investigation Tool',
      description: 'Can use the investigation tool to query across signals',
    },
  ],
};

const ALL_GROUPS: readonly PermissionGroup[] = [
  ORG_GROUP,
  RULES_GROUP,
  MANUAL_REVIEW_GROUP,
  INVESTIGATION_GROUP,
];

/**
 * Canonical permission groups plus an "Other" catch-all for ungrouped
 * {@link UserPermission} values.
 */
export function getPermissionGroups(): readonly PermissionGroup[] {
  const grouped = new Set(
    ALL_GROUPS.flatMap((g) => g.permissions.map((p) => p.permission)),
  );
  const ungrouped = Object.values(UserPermission).filter(
    (p) => !grouped.has(p),
  );
  if (ungrouped.length === 0) {
    return ALL_GROUPS.map(cloneGroup);
  }
  return [
    ...ALL_GROUPS.map(cloneGroup),
    {
      key: 'OTHER',
      label: 'Other',
      description:
        'Permissions that have not yet been grouped. These remain functional; ' +
        'add them to a group in `permissionGroups.ts` to give them copy.',
      permissions: ungrouped.map((permission) => ({
        permission,
        label: permission,
        description: '',
      })),
    },
  ];
}

function cloneGroup(group: PermissionGroup): PermissionGroup {
  return {
    ...group,
    permissions: group.permissions.map((p) => ({ ...p })),
  };
}
