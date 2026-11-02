ALTER TABLE public.api_keys
    ADD COLUMN permissions TEXT[] NOT NULL DEFAULT ARRAY[
        'items:read',
        'items:write',
        'reports:write',
        'appeals:write',
        'actions:execute',
        'config:read'
    ]::TEXT[];
