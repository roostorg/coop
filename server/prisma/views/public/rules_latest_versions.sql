SELECT
  rule_versions.id AS rule_id,
  to_char(
    (rule_versions.version AT TIME ZONE 'UTC' :: text),
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' :: text
  ) AS version
FROM
  rule_versions
WHERE
  (rule_versions.is_current = TRUE);