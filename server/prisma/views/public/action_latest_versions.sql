SELECT
  action_versions.id AS action_id,
  to_char(
    (action_versions.version AT TIME ZONE 'UTC' :: text),
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' :: text
  ) AS version
FROM
  action_versions
WHERE
  (action_versions.is_current = TRUE);