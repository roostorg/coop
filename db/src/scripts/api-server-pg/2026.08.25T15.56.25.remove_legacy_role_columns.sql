BEGIN;

-- Prevent role assignments from changing between preflight validation and DDL.
LOCK TABLE public.roles, public.users, public.invite_user_tokens IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.users AS u
        LEFT JOIN public.roles AS r ON r.id = u.role_id
        WHERE u.role_id IS NULL
            OR r.id IS NULL
            OR r.org_id IS DISTINCT FROM u.org_id
            OR r.is_system IS DISTINCT FROM true
            OR r.key IS NULL
            OR r.key NOT IN (
                'ADMIN',
                'RULES_MANAGER',
                'MODERATOR_MANAGER',
                'MODERATOR',
                'CHILD_SAFETY_MODERATOR',
                'ANALYST',
                'EXTERNAL_MODERATOR'
            )
    ) THEN
        RAISE EXCEPTION 'public.users contains an invalid role_id: role_id must be non-null, reference public.roles(id), belong to the same org, and identify a system role with a recognized key';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.invite_user_tokens AS t
        LEFT JOIN public.roles AS r ON r.id = t.role_id
        WHERE t.role_id IS NULL
            OR r.id IS NULL
            OR r.org_id IS DISTINCT FROM t.org_id
            OR r.is_system IS DISTINCT FROM true
            OR r.key IS NULL
            OR r.key NOT IN (
                'ADMIN',
                'RULES_MANAGER',
                'MODERATOR_MANAGER',
                'MODERATOR',
                'CHILD_SAFETY_MODERATOR',
                'ANALYST',
                'EXTERNAL_MODERATOR'
            )
    ) THEN
        RAISE EXCEPTION 'public.invite_user_tokens contains an invalid role_id: role_id must be non-null, reference public.roles(id), belong to the same org, and identify a system role with a recognized key';
    END IF;
END
$$;

ALTER TABLE public.users
    ALTER COLUMN role_id SET NOT NULL;

ALTER TABLE public.invite_user_tokens
    ALTER COLUMN role_id SET NOT NULL;

ALTER TABLE public.users
    DROP CONSTRAINT users_role_id_fkey,
    ADD CONSTRAINT users_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;

ALTER TABLE public.invite_user_tokens
    DROP CONSTRAINT invite_user_tokens_role_id_fkey,
    ADD CONSTRAINT invite_user_tokens_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;

ALTER TABLE public.users
    DROP COLUMN role;

ALTER TABLE public.invite_user_tokens
    DROP COLUMN role;

COMMIT;
