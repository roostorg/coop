SELECT
  appeals_routing_rule_versions.id AS appeals_routing_rule_id,
  to_char(
    (
      appeals_routing_rule_versions.version AT TIME ZONE 'UTC' :: text
    ),
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' :: text
  ) AS version
FROM
  manual_review_tool.appeals_routing_rule_versions
WHERE
  (appeals_routing_rule_versions.is_current = TRUE);