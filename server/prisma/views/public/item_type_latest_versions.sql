SELECT
  item_type_versions.id AS item_type_id,
  to_char(
    (
      item_type_versions.version AT TIME ZONE 'UTC' :: text
    ),
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' :: text
  ) AS version
FROM
  item_type_versions
WHERE
  (item_type_versions.is_current = TRUE);