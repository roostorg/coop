SELECT
  job_creations.id,
  job_creations.org_id,
  job_creations.queue_id,
  job_creations.item_id,
  job_creations.item_type_id,
  job_creations.created_at,
  (
    job_creations.enqueue_source_info ->> 'kind' :: text
  ) AS source_kind,
  rule_id.value AS rule_id,
  policy_id.policy_id
FROM
  (
    (
      manual_review_tool.job_creations
      LEFT JOIN LATERAL jsonb_array_elements_text(
        (
          job_creations.enqueue_source_info -> 'rules' :: text
        )
      ) rule_id(value) ON (TRUE)
    )
    LEFT JOIN LATERAL unnest(job_creations.policy_ids) policy_id(policy_id) ON (TRUE)
  );