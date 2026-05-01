-- Backfill per-org built-in actions for existing orgs. New orgs get them via
-- ModerationConfigService.upsertBuiltInActions. Idempotent on (org_id, action_type).
INSERT INTO public.actions (
  id,
  name,
  description,
  org_id,
  action_type,
  callback_url,
  callback_url_headers,
  callback_url_body,
  penalty,
  apply_user_strikes,
  applies_to_all_items_of_kind,
  updated_at
)
SELECT
  substr(md5(o.id || ':ENQUEUE_TO_MRT'), 1, 11),
  'Enqueue Item to Manual Review',
  'Sends the matched item directly to a manual review queue, routed by the org''s MRT routing rules.',
  o.id,
  'ENQUEUE_TO_MRT'::public.action_type,
  NULL,
  NULL,
  NULL,
  'NONE'::public.user_penalty_severity,
  false,
  ARRAY['CONTENT', 'USER', 'THREAD']::public.item_type_kind[],
  CURRENT_TIMESTAMP
FROM public.orgs o
WHERE NOT EXISTS (
  SELECT 1 FROM public.actions a
   WHERE a.org_id = o.id
     AND a.action_type = 'ENQUEUE_TO_MRT'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.actions (
  id,
  name,
  description,
  org_id,
  action_type,
  callback_url,
  callback_url_headers,
  callback_url_body,
  penalty,
  apply_user_strikes,
  applies_to_all_items_of_kind,
  updated_at
)
SELECT
  substr(md5(o.id || ':ENQUEUE_AUTHOR_TO_MRT'), 1, 11),
  'Enqueue Author for Manual Review',
  'Sends the author of the matched content to a manual review queue, with the matched item attached as context.',
  o.id,
  'ENQUEUE_AUTHOR_TO_MRT'::public.action_type,
  NULL,
  NULL,
  NULL,
  'NONE'::public.user_penalty_severity,
  false,
  ARRAY['CONTENT']::public.item_type_kind[],
  CURRENT_TIMESTAMP
FROM public.orgs o
WHERE NOT EXISTS (
  SELECT 1 FROM public.actions a
   WHERE a.org_id = o.id
     AND a.action_type = 'ENQUEUE_AUTHOR_TO_MRT'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.actions (
  id,
  name,
  description,
  org_id,
  action_type,
  callback_url,
  callback_url_headers,
  callback_url_body,
  penalty,
  apply_user_strikes,
  applies_to_all_items_of_kind,
  updated_at
)
SELECT
  substr(md5(o.id || ':ENQUEUE_TO_NCMEC'), 1, 11),
  'Enqueue for NCMEC Review',
  'Sends the user associated with the matched item to the NCMEC review flow, gathering their media for reporting.',
  o.id,
  'ENQUEUE_TO_NCMEC'::public.action_type,
  NULL,
  NULL,
  NULL,
  'NONE'::public.user_penalty_severity,
  false,
  ARRAY['CONTENT', 'USER']::public.item_type_kind[],
  CURRENT_TIMESTAMP
FROM public.orgs o
WHERE NOT EXISTS (
  SELECT 1 FROM public.actions a
   WHERE a.org_id = o.id
     AND a.action_type = 'ENQUEUE_TO_NCMEC'
)
ON CONFLICT DO NOTHING;
