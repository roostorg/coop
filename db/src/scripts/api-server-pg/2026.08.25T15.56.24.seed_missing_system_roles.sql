BEGIN;

WITH role_defaults(key, display_name, description) AS (
    VALUES
        ('ADMIN', 'Admin', 'Manages all users in the org and has every permission.'),
        ('RULES_MANAGER', 'Rules Manager', 'Can modify and run rules and actions, but cannot manage users.'),
        ('MODERATOR_MANAGER', 'Moderator Manager', 'Can view MRT, edit queues, and manage moderators.'),
        ('MODERATOR', 'Moderator', 'Reviews queues they have been granted access to.'),
        ('CHILD_SAFETY_MODERATOR', 'Child Safety Moderator', 'Reviews child safety jobs, including NCMEC.'),
        ('ANALYST', 'Analyst', 'Reads rules and insights; can run backtests and edit non-live rules.'),
        ('EXTERNAL_MODERATOR', 'External Moderator', 'Read-only MRT access for external moderation partners.')
),
inserted_roles AS (
    INSERT INTO public.roles (org_id, key, display_name, description, is_system)
    SELECT
        o.id,
        r.key,
        r.display_name,
        r.description,
        true
    FROM public.orgs AS o
    CROSS JOIN role_defaults AS r
    ON CONFLICT (org_id, key) DO NOTHING
    RETURNING id, key
),
role_permission_seed(role_key, permission) AS (
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
SELECT r.id, p.permission
FROM inserted_roles AS r
JOIN role_permission_seed AS p ON p.role_key = r.key;

UPDATE public.users AS u
SET role_id = r.id
FROM public.roles AS r
WHERE u.role_id IS NULL
    AND r.org_id = u.org_id
    AND r.key = u.role
    AND r.is_system = true;

UPDATE public.invite_user_tokens AS t
SET role_id = r.id
FROM public.roles AS r
WHERE t.role_id IS NULL
    AND r.org_id = t.org_id
    AND r.key = t.role
    AND r.is_system = true;

COMMIT;
