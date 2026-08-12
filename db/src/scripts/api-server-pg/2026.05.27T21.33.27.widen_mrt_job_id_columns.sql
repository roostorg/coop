-- Widen MRT job-id and item-id columns to text.
--
-- `job_creations.id` stores the external JobId, which is double-b64-encoded
-- as `b64(b64(typeId) + '.' + b64(itemId)) + ':' + b64(guid)`. Caller-defined
-- item ids longer than ~70 chars overflow varchar(255), and the insert is
-- silently swallowed by the enqueue path, leaving the recovery table
-- (`recoverMrtQueueLib.ts`) out of sync with Redis. `job_comments.job_id`
-- and `moderator_skips.job_id` store the same external JobId.
--
-- `item_id` / `item_type_id` are platform-defined and not length-bounded by
-- us, so we widen them too. `manual_review_decisions.id` is already `uuid`
-- (it only stores the guid portion via `jobIdToGuid`).
--
-- varchar -> text is binary-coercible (no table rewrite), but Postgres
-- still refuses ALTER COLUMN TYPE when a view depends on the column, hence
-- the drop/recreate around `flattened_job_creations`.


DROP VIEW manual_review_tool.flattened_job_creations;

ALTER TABLE manual_review_tool.job_creations
    ALTER COLUMN id           TYPE text,
    ALTER COLUMN item_id      TYPE text,
    ALTER COLUMN item_type_id TYPE text;

ALTER TABLE manual_review_tool.job_comments
    ALTER COLUMN job_id TYPE text;

ALTER TABLE manual_review_tool.moderator_skips
    ALTER COLUMN job_id TYPE text;

CREATE VIEW manual_review_tool.flattened_job_creations AS
 SELECT job_creations.id,
    job_creations.org_id,
    job_creations.queue_id,
    job_creations.item_id,
    job_creations.item_type_id,
    job_creations.created_at,
    (job_creations.enqueue_source_info ->> 'kind'::text) AS source_kind,
    rule_id.value AS rule_id,
    policy_id.policy_id
   FROM ((manual_review_tool.job_creations
     LEFT JOIN LATERAL jsonb_array_elements_text((job_creations.enqueue_source_info -> 'rules'::text)) rule_id(value) ON (true))
     LEFT JOIN LATERAL unnest(job_creations.policy_ids) policy_id(policy_id) ON (true));

ALTER TABLE manual_review_tool.flattened_job_creations OWNER TO CURRENT_USER;
