-- The `gdpr_delete_requests` table backed an HTTP endpoint that accepted GDPR
-- erasure requests but never processed them. The endpoint and table are
-- being removed: self-hosting adopters own their deployment and handle
-- deletion through their own admin tooling or SQL access.

DROP TABLE IF EXISTS public.gdpr_delete_requests;
