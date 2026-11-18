SELECT
  reporting_rule_versions.id AS reporting_rule_id,
  to_char(
    (
      reporting_rule_versions.version AT TIME ZONE 'UTC' :: text
    ),
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' :: text
  ) AS version
FROM
  reporting_rules.reporting_rule_versions
WHERE
  (reporting_rule_versions.is_current = TRUE);