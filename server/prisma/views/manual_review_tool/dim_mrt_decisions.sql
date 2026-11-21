WITH decisions AS (
  SELECT
    manual_review_decisions.org_id,
    (dc.dc ->> 'type' :: text) AS TYPE,
    (ACTION.value ->> 'id' :: text) AS action_id,
    (policy.value ->> 'id' :: text) AS policy_id,
    (
      (
        (
          manual_review_decisions.job_payload -> 'payload' :: text
        ) -> 'item' :: text
      ) ->> 'itemId' :: text
    ) AS item_id,
    (
      (
        (
          (
            manual_review_decisions.job_payload -> 'payload' :: text
          ) -> 'item' :: text
        ) -> 'itemTypeIdentifier' :: text
      ) ->> 'id' :: text
    ) AS item_type_id,
    manual_review_decisions.queue_id,
    manual_review_decisions.reviewer_id,
    manual_review_decisions.created_at,
    (
      manual_review_decisions.job_payload ->> 'id' :: text
    ) AS job_id
  FROM
    manual_review_tool.manual_review_decisions,
    (
      LATERAL unnest(manual_review_decisions.decision_components) dc(dc)
      CROSS JOIN LATERAL jsonb_array_elements((dc.dc -> 'actions' :: text)) ACTION(value)
    ),
    LATERAL jsonb_array_elements((dc.dc -> 'policies' :: text)) policy(value)
  WHERE
    ((dc.dc ->> 'type' :: text) = 'CUSTOM_ACTION' :: text)
  UNION
  ALL
  SELECT
    manual_review_decisions.org_id,
    (dc.dc ->> 'type' :: text) AS TYPE,
    NULL :: text AS action_id,
    NULL :: text AS policy_id,
    (
      (
        (
          manual_review_decisions.job_payload -> 'payload' :: text
        ) -> 'item' :: text
      ) ->> 'itemId' :: text
    ) AS item_id,
    (
      (
        (
          (
            manual_review_decisions.job_payload -> 'payload' :: text
          ) -> 'item' :: text
        ) -> 'itemTypeIdentifier' :: text
      ) ->> 'id' :: text
    ) AS item_type_id,
    manual_review_decisions.queue_id,
    manual_review_decisions.reviewer_id,
    manual_review_decisions.created_at,
    (
      manual_review_decisions.job_payload ->> 'id' :: text
    ) AS job_id
  FROM
    manual_review_tool.manual_review_decisions,
    LATERAL unnest(manual_review_decisions.decision_components) dc(dc)
  WHERE
    (
      (dc.dc ->> 'type' :: text) <> 'CUSTOM_ACTION' :: text
    )
  UNION
  ALL
  SELECT
    DISTINCT manual_review_decisions.org_id,
    'RELATED_ACTION' :: text AS TYPE,
    ACTION.value AS action_id,
    policy.value AS policy_id,
    item_id.value AS item_id,
    (
      unnested_data.unnested_data ->> 'itemTypeId' :: text
    ) AS item_type_id,
    manual_review_decisions.queue_id,
    manual_review_decisions.reviewer_id,
    manual_review_decisions.created_at,
    (
      manual_review_decisions.job_payload ->> 'id' :: text
    ) AS job_id
  FROM
    manual_review_tool.manual_review_decisions,
    LATERAL unnest(manual_review_decisions.related_actions) unnested_data(unnested_data),
    LATERAL jsonb_array_elements_text((unnested_data.unnested_data -> 'itemIds' :: text)) item_id(value),
    LATERAL jsonb_array_elements_text(
      (unnested_data.unnested_data -> 'actionIds' :: text)
    ) ACTION(value),
    LATERAL jsonb_array_elements_text(
      (unnested_data.unnested_data -> 'policyIds' :: text)
    ) policy(value)
)
SELECT
  DISTINCT decisions.org_id,
  decisions.item_id,
  decisions.action_id,
  decisions.policy_id,
  decisions.type,
  decisions.item_type_id,
  decisions.queue_id,
  decisions.reviewer_id,
  date(decisions.created_at) AS ds,
  decisions.job_id,
  decisions.created_at AS decided_at
FROM
  decisions
WHERE
  (
    (decisions.item_id IS NOT NULL)
    AND (decisions.item_type_id IS NOT NULL)
  );