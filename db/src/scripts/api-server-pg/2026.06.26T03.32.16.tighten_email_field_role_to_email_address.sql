-- Follow-up to #840: now that `@roostorg/coop-types@2.4.0` ships a dedicated
-- `EMAIL_ADDRESS` scalar (#841), tighten the `email_field` field-role CHECK
-- constraint from STRING to EMAIL_ADDRESS so adopters can't map arbitrary
-- string fields (e.g. bio, displayName) into NCMEC reports.
--
-- Deployments between #840 and this migration may have configured the
-- `email` role to point at a STRING field. The new CHECK would reject
-- those rows and block the migration, so the data step below clears any
-- such mapping (setting `email_field` back to NULL) and emits a NOTICE
-- per affected row so operators can see which item type's mapping was
-- dropped and reconfigure via the admin UI if needed. The actual data in
-- the underlying STRING field is untouched; only the role pointer is
-- cleared.
--
-- Operators: after applying this migration, scan the `db:update` output
-- for lines beginning with `[postgres NOTICE]`. Each one names the item
-- type (id, name, org_id) whose `email_field` mapping was cleared.
-- Reconfigure those item types in the admin UI if NCMEC reporting was
-- relying on them. The forwarding of pg NOTICE events to the migration
-- runner output is provided by the `afterConnect` hook in
-- `db/src/configs/pg-base.ts` (added in this same PR).

BEGIN;

DO $$
DECLARE
    affected RECORD;
BEGIN
    FOR affected IN
        SELECT id, org_id, name, email_field
        FROM public.item_types
        WHERE email_field IS NOT NULL
          AND NOT jsonb_path_exists(
            (array_to_json(fields))::jsonb,
            '$[*]?(@."name" == $"name" && @."type" == "EMAIL_ADDRESS")'::jsonpath,
            jsonb_build_object('name', email_field)
          )
    LOOP
        RAISE NOTICE 'Clearing email_field=% from item_type id=% (name=%, org=%): no EMAIL_ADDRESS field of that name exists. Reconfigure via admin UI if needed.',
            affected.email_field, affected.id, affected.name, affected.org_id;

        UPDATE public.item_types
        SET email_field = NULL
        WHERE id = affected.id;
    END LOOP;
END $$;

ALTER TABLE public.item_types
  DROP CONSTRAINT valid_email_field_field_type;

ALTER TABLE public.item_types
  ADD CONSTRAINT valid_email_field_field_type CHECK (
    (email_field IS NULL)
    OR jsonb_path_exists(
      (array_to_json(fields))::jsonb,
      '$[*]?(@."name" == $"name" && @."type" == "EMAIL_ADDRESS")'::jsonpath,
      jsonb_build_object('name', email_field)
    )
  );

COMMIT;
