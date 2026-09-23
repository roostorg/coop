-- Add per-queue role-based access for the manual review tool. A queue becomes
-- accessible to a reviewer when their persisted role is assigned here, in
-- addition to any individual grant in `users_and_accessible_queues`. This
-- migration is additive and idempotent.

CREATE TABLE IF NOT EXISTS manual_review_tool.roles_and_accessible_queues (
    queue_id character varying(255) NOT NULL
        REFERENCES manual_review_tool.manual_review_queues(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (queue_id, role_id)
);

ALTER TABLE manual_review_tool.roles_and_accessible_queues OWNER TO CURRENT_USER;

CREATE INDEX IF NOT EXISTS roles_and_accessible_queues_role_id_idx
    ON manual_review_tool.roles_and_accessible_queues (role_id);
