SELECT
  routing_rule_versions.id AS routing_rule_id,
  to_char(
    (
      routing_rule_versions.version AT TIME ZONE 'UTC' :: text
    ),
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' :: text
  ) AS version
FROM
  manual_review_tool.routing_rule_versions
WHERE
  (routing_rule_versions.is_current = TRUE);