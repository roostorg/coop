import { type UserRole } from './permissioning.js';

/**
 * Default `display_name` and `description` for each system role. Mirrors the
 * seed values in `db/src/scripts/api-server-pg/<...>add_roles_and_role_permissions_tables.sql`
 * so orgs created after the migration ship — which never went through that
 * INSERT — surface the same copy as orgs that were seeded at deploy time.
 *
 * Once an admin saves edits via the role-editor UI the persisted row in
 * `public.roles` takes precedence; this map is fallback only.
 */
export const SystemRoleDefaults: Readonly<
  Record<UserRole, { displayName: string; description: string }>
> = {
  ADMIN: {
    displayName: 'Admin',
    description: 'Manages all users in the org and has every permission.',
  },
  RULES_MANAGER: {
    displayName: 'Rules Manager',
    description:
      'Can modify and run rules and actions, but cannot manage users.',
  },
  MODERATOR_MANAGER: {
    displayName: 'Moderator Manager',
    description: 'Can view MRT, edit queues, and manage moderators.',
  },
  MODERATOR: {
    displayName: 'Moderator',
    description: 'Reviews queues they have been granted access to.',
  },
  CHILD_SAFETY_MODERATOR: {
    displayName: 'Child Safety Moderator',
    description: 'Reviews child safety jobs, including NCMEC.',
  },
  ANALYST: {
    displayName: 'Analyst',
    description:
      'Reads rules and insights; can run backtests and edit non-live rules.',
  },
  EXTERNAL_MODERATOR: {
    displayName: 'External Moderator',
    description: 'Read-only MRT access for external moderation partners.',
  },
};
