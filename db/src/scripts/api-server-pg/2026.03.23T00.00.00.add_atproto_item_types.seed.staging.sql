--
-- Seed AT Protocol item types for test orgs (staging only).
-- These item types enable the Tap firehose connector to ingest
-- AT Protocol posts and account data for moderation review.
--
-- Field role constraints require specific types:
--   creator_id_field  → RELATED_ITEM
--   thread_id_field   → RELATED_ITEM
--   parent_id_field   → RELATED_ITEM
--   display_name_field → STRING
--   profile_icon_field → IMAGE
--   background_image_field → IMAGE
--

-- ATproto-post (CONTENT) for the first test org
INSERT INTO public.item_types (
  id, org_id, name, description, kind, fields, created_at,
  display_name_field, creator_id_field, thread_id_field, parent_id_field,
  created_at_field, profile_icon_field, is_default_user,
  background_image_field, is_deleted_field
) VALUES (
  'atp_post_e7c89', 'e7c89ce7729', 'ATproto-post',
  'AT Protocol post from the Bluesky firehose',
  'CONTENT',
  ARRAY[
    '{"name": "text", "type": "STRING", "required": true, "container": null}'::jsonb,
    '{"name": "authorDid", "type": "RELATED_ITEM", "required": true, "container": null}'::jsonb,
    '{"name": "authorHandle", "type": "STRING", "required": false, "container": null}'::jsonb,
    '{"name": "rkey", "type": "STRING", "required": true, "container": null}'::jsonb,
    '{"name": "cid", "type": "STRING", "required": false, "container": null}'::jsonb,
    '{"name": "createdAt", "type": "DATETIME", "required": true, "container": null}'::jsonb,
    '{"name": "atUri", "type": "URL", "required": true, "container": null}'::jsonb,
    '{"name": "images", "type": "ARRAY", "required": false, "container": {"containerType": "ARRAY", "keyScalarType": null, "valueScalarType": "IMAGE"}}'::jsonb,
    '{"name": "replyParent", "type": "RELATED_ITEM", "required": false, "container": null}'::jsonb,
    '{"name": "replyRoot", "type": "RELATED_ITEM", "required": false, "container": null}'::jsonb,
    '{"name": "langs", "type": "ARRAY", "required": false, "container": {"containerType": "ARRAY", "keyScalarType": null, "valueScalarType": "STRING"}}'::jsonb,
    '{"name": "isLive", "type": "BOOLEAN", "required": true, "container": null}'::jsonb
  ],
  NOW(),
  NULL,            -- display_name_field
  'authorDid',     -- creator_id_field (RELATED_ITEM)
  'replyRoot',     -- thread_id_field (RELATED_ITEM)
  'replyParent',   -- parent_id_field (RELATED_ITEM)
  'createdAt',     -- created_at_field
  NULL,            -- profile_icon_field
  false,           -- is_default_user
  NULL,            -- background_image_field
  NULL             -- is_deleted_field
);

-- ATproto-account (USER) for the first test org
INSERT INTO public.item_types (
  id, org_id, name, description, kind, fields, created_at,
  display_name_field, creator_id_field, thread_id_field, parent_id_field,
  created_at_field, profile_icon_field, is_default_user,
  background_image_field, is_deleted_field
) VALUES (
  'atp_acct_e7c89', 'e7c89ce7729', 'ATproto-account',
  'AT Protocol account from the Bluesky network',
  'USER',
  ARRAY[
    '{"name": "did", "type": "STRING", "required": true, "container": null}'::jsonb,
    '{"name": "handle", "type": "STRING", "required": true, "container": null}'::jsonb,
    '{"name": "displayName", "type": "STRING", "required": false, "container": null}'::jsonb,
    '{"name": "description", "type": "STRING", "required": false, "container": null}'::jsonb,
    '{"name": "avatar", "type": "IMAGE", "required": false, "container": null}'::jsonb,
    '{"name": "banner", "type": "IMAGE", "required": false, "container": null}'::jsonb,
    '{"name": "createdAt", "type": "DATETIME", "required": false, "container": null}'::jsonb,
    '{"name": "isActive", "type": "BOOLEAN", "required": true, "container": null}'::jsonb
  ],
  NOW(),
  'handle',        -- display_name_field (STRING)
  NULL,            -- creator_id_field (USER kind cannot have creator_id_field)
  NULL,            -- thread_id_field
  NULL,            -- parent_id_field
  'createdAt',     -- created_at_field
  'avatar',        -- profile_icon_field (IMAGE)
  false,           -- is_default_user
  'banner',        -- background_image_field (IMAGE)
  NULL             -- is_deleted_field
);
