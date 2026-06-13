-- Gates the NCMEC Messages tab in manual review on a per-org setting. Replaces a hardcoded user-id allowlist 
-- in the client that was the only thing preventing arbitrary moderators from reading message contents and IP 
-- addresses via the `ncmecThreads` GraphQL query.

ALTER TABLE manual_review_tool.manual_review_tool_settings 
    ADD COLUMN IF NOT EXISTS ncmec_messages_enabled boolean DEFAULT false NOT NULL;