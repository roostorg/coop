SELECT
  policy_versions.id AS policy_id,
  to_char(
    (policy_versions.version AT TIME ZONE 'UTC' :: text),
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' :: text
  ) AS version
FROM
  policy_versions
WHERE
  (policy_versions.is_current = TRUE);