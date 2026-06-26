-- Follow-up to #840: now that `@roostorg/coop-types@2.4.0` ships a dedicated
-- `EMAIL_ADDRESS` scalar (#841), tighten the `email_field` field-role CHECK
-- constraint from STRING to EMAIL_ADDRESS so adopters can't map arbitrary
-- string fields (e.g. bio, displayName) into NCMEC reports.
--
-- Safety: any existing `email_field` mappings that point to a STRING-typed
-- field will fail validation after this swap. #840 merged hours before this
-- migration; no adopter has had time to configure the role in production,
-- so no data migration is bundled. If a deployment between #840 and this
-- migration did configure an email role on a STRING field, the migration
-- will throw and the operator will need to either change the schema field
-- type to EMAIL_ADDRESS or null out the email role mapping first.

BEGIN;

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
