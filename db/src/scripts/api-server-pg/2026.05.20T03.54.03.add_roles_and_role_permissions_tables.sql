-- Add per-org `roles` and `role_permissions` tables and link them from
-- `users.role_id` / `invite_user_tokens.role_id`. Additive and idempotent;
-- the legacy `role` varchar columns remain in place.

CREATE TABLE IF NOT EXISTS public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id varchar(255) NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    key varchar(255) NOT NULL,
    display_name varchar(255) NOT NULL,
    description text,
    is_system boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT roles_org_key_unique UNIQUE (org_id, key)
);

ALTER TABLE public.roles OWNER TO CURRENT_USER;

CREATE INDEX IF NOT EXISTS roles_org_id_idx ON public.roles (org_id);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission varchar(255) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

ALTER TABLE public.role_permissions OWNER TO CURRENT_USER;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;

ALTER TABLE public.invite_user_tokens
    ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_role_id_idx ON public.users (role_id);
CREATE INDEX IF NOT EXISTS invite_user_tokens_role_id_idx ON public.invite_user_tokens (role_id);

-- Seed the seven system roles for every existing org. Values mirror
-- `UserPermissionsForRole` in server/services/userManagementService/permissioning.ts.
INSERT INTO public.roles (org_id, key, display_name, description, is_system)
SELECT
    o.id,
    r.key,
    r.display_name,
    r.description,
    true
FROM public.orgs o
CROSS JOIN (
    VALUES
        ('ADMIN', 'Admin', 'Manages all users in the org and has every permission.'),
        ('RULES_MANAGER', 'Rules Manager', 'Can modify and run rules and actions, but cannot manage users.'),
        ('MODERATOR_MANAGER', 'Moderator Manager', 'Can view MRT, edit queues, and manage moderators.'),
        ('MODERATOR', 'Moderator', 'Reviews queues they have been granted access to.'),
        ('CHILD_SAFETY_MODERATOR', 'Child Safety Moderator', 'Reviews child safety jobs, including NCMEC.'),
        ('ANALYST', 'Analyst', 'Reads rules and insights; can run backtests and edit non-live rules.'),
        ('EXTERNAL_MODERATOR', 'External Moderator', 'Read-only MRT access for external moderation partners.')
) AS r(key, display_name, description)
ON CONFLICT (org_id, key) DO NOTHING;

WITH role_permission_seed(role_key, permission) AS (
    VALUES
        ('ADMIN', 'MANAGE_ORG'),
        ('ADMIN', 'MUTATE_LIVE_RULES'),
        ('ADMIN', 'MUTATE_NON_LIVE_RULES'),
        ('ADMIN', 'RUN_RETROACTION'),
        ('ADMIN', 'RUN_BACKTEST'),
        ('ADMIN', 'VIEW_INSIGHTS'),
        ('ADMIN', 'MANUALLY_ACTION_CONTENT'),
        ('ADMIN', 'VIEW_MRT'),
        ('ADMIN', 'VIEW_MRT_DATA'),
        ('ADMIN', 'VIEW_CHILD_SAFETY_DATA'),
        ('ADMIN', 'EDIT_MRT_QUEUES'),
        ('ADMIN', 'MANAGE_POLICIES'),
        ('ADMIN', 'VIEW_INVESTIGATION'),
        ('ADMIN', 'VIEW_RULES_DASHBOARD'),
        ('ADMIN', 'MANAGE_ROLES'),
        ('ADMIN', 'MANAGE_USERS'),
        ('ADMIN', 'MANAGE_ROUTING_RULES'),

        ('RULES_MANAGER', 'MUTATE_LIVE_RULES'),
        ('RULES_MANAGER', 'MUTATE_NON_LIVE_RULES'),
        ('RULES_MANAGER', 'RUN_RETROACTION'),
        ('RULES_MANAGER', 'RUN_BACKTEST'),
        ('RULES_MANAGER', 'VIEW_INSIGHTS'),
        ('RULES_MANAGER', 'MANUALLY_ACTION_CONTENT'),
        ('RULES_MANAGER', 'MANAGE_POLICIES'),
        ('RULES_MANAGER', 'VIEW_INVESTIGATION'),
        ('RULES_MANAGER', 'VIEW_RULES_DASHBOARD'),

        ('ANALYST', 'MUTATE_NON_LIVE_RULES'),
        ('ANALYST', 'RUN_BACKTEST'),
        ('ANALYST', 'VIEW_INSIGHTS'),
        ('ANALYST', 'VIEW_INVESTIGATION'),
        ('ANALYST', 'VIEW_RULES_DASHBOARD'),

        ('MODERATOR_MANAGER', 'VIEW_MRT'),
        ('MODERATOR_MANAGER', 'VIEW_MRT_DATA'),
        ('MODERATOR_MANAGER', 'EDIT_MRT_QUEUES'),
        ('MODERATOR_MANAGER', 'MANAGE_ROUTING_RULES'),
        ('MODERATOR_MANAGER', 'MANAGE_POLICIES'),
        ('MODERATOR_MANAGER', 'VIEW_INVESTIGATION'),
        ('MODERATOR_MANAGER', 'VIEW_RULES_DASHBOARD'),
        ('MODERATOR_MANAGER', 'VIEW_CHILD_SAFETY_DATA'),
        ('MODERATOR_MANAGER', 'MANUALLY_ACTION_CONTENT'),

        ('MODERATOR', 'VIEW_MRT'),
        ('MODERATOR', 'VIEW_MRT_DATA'),
        ('MODERATOR', 'MANAGE_POLICIES'),
        ('MODERATOR', 'MANUALLY_ACTION_CONTENT'),
        ('MODERATOR', 'VIEW_INVESTIGATION'),
        ('MODERATOR', 'VIEW_RULES_DASHBOARD'),

        ('CHILD_SAFETY_MODERATOR', 'VIEW_MRT'),
        ('CHILD_SAFETY_MODERATOR', 'VIEW_MRT_DATA'),
        ('CHILD_SAFETY_MODERATOR', 'VIEW_CHILD_SAFETY_DATA'),
        ('CHILD_SAFETY_MODERATOR', 'MANAGE_POLICIES'),
        ('CHILD_SAFETY_MODERATOR', 'MANUALLY_ACTION_CONTENT'),
        ('CHILD_SAFETY_MODERATOR', 'VIEW_INVESTIGATION'),
        ('CHILD_SAFETY_MODERATOR', 'VIEW_RULES_DASHBOARD'),

        ('EXTERNAL_MODERATOR', 'VIEW_MRT')
)
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, s.permission
FROM role_permission_seed s
JOIN public.roles r
    ON r.key = s.role_key
    AND r.is_system = true
ON CONFLICT (role_id, permission) DO NOTHING;

UPDATE public.users u
SET role_id = r.id
FROM public.roles r
WHERE r.org_id = u.org_id
    AND r.key = u.role
    AND r.is_system = true
    AND u.role_id IS NULL;

UPDATE public.invite_user_tokens t
SET role_id = r.id
FROM public.roles r
WHERE r.org_id = t.org_id
    AND r.key = t.role
    AND r.is_system = true
    AND t.role_id IS NULL;
