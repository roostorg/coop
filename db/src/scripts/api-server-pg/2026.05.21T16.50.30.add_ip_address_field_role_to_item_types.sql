-- Issue #468: add an `ipAddress` schema field role to item types so adopters
-- can tag a string IP-address field on user / thread / content items and have
-- Coop surface it as an identifier in moderation flows.
--
-- `ip_address_field` lives on `public.item_types` and its temporal mirror
-- `public.item_types_history`. The materialized view `item_type_versions`
-- joins both tables, so we have to drop and recreate it (with its indexes
-- and the `item_type_latest_versions` view that depends on it) so the new
-- column is selectable. Postgres handles cascading via DROP ... CASCADE.

BEGIN;

ALTER TABLE public.item_types
  ADD COLUMN ip_address_field character varying(255);

ALTER TABLE public.item_types_history
  ADD COLUMN ip_address_field character varying(255);

-- Mirrors the per-role clauses in `valid_field_role_field_type`, but as a
-- standalone constraint so we don't touch the existing one.
ALTER TABLE public.item_types
  ADD CONSTRAINT valid_ip_address_field_field_type CHECK (
    (ip_address_field IS NULL)
    OR jsonb_path_exists(
      (array_to_json(fields))::jsonb,
      '$[*]?(@."name" == $"name" && @."type" == "IP_ADDRESS")'::jsonpath,
      jsonb_build_object('name', ip_address_field)
    )
  );

-- CASCADE drops the four indexes on item_type_versions and the
-- item_type_latest_versions view; both are recreated below.
DROP MATERIALIZED VIEW public.item_type_versions CASCADE;

CREATE MATERIALIZED VIEW public.item_type_versions AS
WITH item_type_versions AS (
  SELECT
    item_types.id,
    item_types.name,
    item_types.description,
    item_types.fields,
    item_types.org_id,
    item_types.sys_period,
    item_types.kind,
    item_types.display_name_field,
    item_types.creator_id_field,
    item_types.thread_id_field,
    item_types.parent_id_field,
    item_types.created_at_field,
    item_types.is_deleted_field,
    item_types.profile_icon_field,
    item_types.background_image_field,
    item_types.ip_address_field,
    item_types.is_default_user
  FROM public.item_types
  UNION ALL
  SELECT
    item_types_history.id,
    item_types_history.name,
    item_types_history.description,
    item_types_history.fields,
    item_types_history.org_id,
    item_types_history.sys_period,
    item_types_history.kind,
    item_types_history.display_name_field,
    item_types_history.creator_id_field,
    item_types_history.thread_id_field,
    item_types_history.parent_id_field,
    item_types_history.created_at_field,
    item_types_history.is_deleted_field,
    item_types_history.profile_icon_field,
    item_types_history.background_image_field,
    item_types_history.ip_address_field,
    item_types_history.is_default_user
  FROM public.item_types_history
), item_type_max_period_starts AS (
  SELECT
    item_type_versions_1.id,
    max(lower(item_type_versions_1.sys_period)) AS max_period_start
  FROM item_type_versions item_type_versions_1
  GROUP BY item_type_versions_1.id
)
SELECT
  item_type_versions.id,
  item_type_versions.name,
  item_type_versions.description,
  item_type_versions.fields,
  item_type_versions.org_id,
  item_type_versions.kind,
  item_type_versions.display_name_field,
  item_type_versions.creator_id_field,
  item_type_versions.thread_id_field,
  item_type_versions.parent_id_field,
  item_type_versions.created_at_field,
  item_type_versions.is_deleted_field,
  item_type_versions.profile_icon_field,
  item_type_versions.background_image_field,
  item_type_versions.ip_address_field,
  item_type_versions.is_default_user,
  lower(item_type_versions.sys_period) AS version,
  (
    (item_type_max_period_starts.max_period_start = lower(item_type_versions.sys_period))
    AND upper_inf(item_type_versions.sys_period)
  ) AS is_current
FROM item_type_versions
JOIN item_type_max_period_starts
  ON ((item_type_max_period_starts.id)::text = (item_type_versions.id)::text)
WITH DATA;

ALTER TABLE public.item_type_versions OWNER TO CURRENT_USER;

CREATE INDEX item_type_versions_id_idx
  ON public.item_type_versions USING btree (id);

CREATE UNIQUE INDEX item_type_versions_id_is_current_idx
  ON public.item_type_versions USING btree (id, is_current)
  WHERE (is_current = true);

CREATE INDEX item_type_versions_is_current_idx
  ON public.item_type_versions USING btree (is_current);

CREATE INDEX item_type_versions_version_idx
  ON public.item_type_versions USING btree (version);

CREATE VIEW public.item_type_latest_versions AS
  SELECT
    item_type_versions.id AS item_type_id,
    to_char((item_type_versions.version AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version
  FROM public.item_type_versions
  WHERE (item_type_versions.is_current = true);

ALTER TABLE public.item_type_latest_versions OWNER TO CURRENT_USER;

COMMIT;
