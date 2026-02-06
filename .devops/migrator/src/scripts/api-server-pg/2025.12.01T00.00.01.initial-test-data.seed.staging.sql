--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4 (Debian 15.4-2.pgdg120+1)
-- Dumped by pg_dump version 15.4 (Debian 15.4-2.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: scheduled_jobs_info; Type: TABLE DATA; Schema: jobs; Owner: postgres
--



--
-- Data for Name: appeals_routing_rule_history; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: manual_review_queues; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--

INSERT INTO manual_review_tool.manual_review_queues VALUES ('1', 'Test queue', '2025-12-09 15:40:34.91487+00', '2025-12-09 15:40:34.91487+00', 'e7c89ce7729', true, NULL, false, false);
INSERT INTO manual_review_tool.manual_review_queues VALUES ('2', 'Test queue', '2025-12-09 15:40:34.91487+00', '2025-12-09 15:40:34.91487+00', '34bff959d00', true, NULL, false, false);
INSERT INTO manual_review_tool.manual_review_queues VALUES ('3', 'Test queue', '2025-12-09 15:40:34.91487+00', '2025-12-09 15:40:34.91487+00', '6cd8223106e', true, NULL, false, false);
INSERT INTO manual_review_tool.manual_review_queues VALUES ('4', 'Test queue', '2025-12-09 15:40:34.91487+00', '2025-12-09 15:40:34.91487+00', 'dadbb4c07b0', true, NULL, false, false);


--
-- Data for Name: appeals_routing_rules; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: appeals_routing_rules_to_item_types; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: dim_mrt_decisions_materialized; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: job_comments; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: job_creations; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: manual_review_decisions; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: manual_review_hidden_item_fields; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: manual_review_tool_settings; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: moderator_skips; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: queues_and_hidden_actions; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: routing_rule_history; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: routing_rules; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: routing_rules_to_item_types; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: users_and_accessible_queues; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: users_and_favorite_mrt_queues; Type: TABLE DATA; Schema: manual_review_tool; Owner: postgres
--



--
-- Data for Name: models; Type: TABLE DATA; Schema: models_service; Owner: postgres
--



--
-- Data for Name: org_to_partially_labeled_dataset; Type: TABLE DATA; Schema: models_service; Owner: postgres
--



--
-- Data for Name: unknown_labeled_items; Type: TABLE DATA; Schema: models_service; Owner: postgres
--



--
-- Data for Name: ncmec_org_settings; Type: TABLE DATA; Schema: ncmec_reporting; Owner: postgres
--



--
-- Data for Name: ncmec_reports; Type: TABLE DATA; Schema: ncmec_reporting; Owner: postgres
--



--
-- Data for Name: ncmec_reports_errors; Type: TABLE DATA; Schema: ncmec_reporting; Owner: postgres
--



--
-- Data for Name: orgs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.orgs VALUES ('e7c89ce7729', 'test@example.com', 'Test Org', 'test.com', 'yi5c2z2l1h', '2022-01-10 02:20:19.33+00', '2022-01-10 02:20:19.33+00', NULL);
INSERT INTO public.orgs VALUES ('34bff959d00', 'test2@example.com', 'Test Org 2', 'test2.com', 'y0q7c9w19d', '2022-01-24 22:22:30.371+00', '2022-01-24 22:22:31.082+00', NULL);
INSERT INTO public.orgs VALUES ('dadbb4c07b0', 'test3@example.com', 'Test Org 3', 'test3.com', '2ihd6c8jbl', '2022-02-17 07:32:12.248+00', '2022-02-17 07:32:12.921+00', NULL);
INSERT INTO public.orgs VALUES ('6cd8223106e', 'test4@example.com', 'Test Org 4', 'test4.com', '8637e1iq1j', '2022-02-17 07:38:20.642+00', '2022-02-17 07:38:21.307+00', NULL);


--
-- Data for Name: actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.actions VALUES ('1873b2f15cc', 'Apply Warning Cover', 'Apply a warning cover to all media in the piece of content indicating that the media contains harmful or disturbing imagery or false information', 'https://api.mywebsite.com/apply_warning_cover', '2022-01-16 22:47:55.781+00', '2022-01-16 22:47:55.781+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('2f15cc91242', 'Enqueue for Human Review', 'This sends a piece of content to our human moderation queues to get manually reviewed.', 'https://api.mywebsite.com/enqueue', '2022-01-16 22:50:51.342+00', '2022-01-16 22:50:51.342+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('3b2f15cc912', 'Ban User for 24 Hours', 'Bans a user for 24 hours. The user will be able to log into their account, but will not be able to use any features, create content or communicate with other users', 'https://api.mywebsite.com/ban_user_one_day', '2022-01-16 22:49:35.099+00', '2022-01-16 22:49:35.099+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('73b2f15cc91', 'Ban User', 'Bans the user who created the content from the platform forever', 'https://api.mywebsite.com/ban_user', '2022-01-16 22:49:10.156+00', '2022-01-16 22:49:10.156+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('8481310e8c4', 'Delete', 'Deletes a piece of content', 'https://api.mywebsite.com/v1/delete', '2022-01-10 23:28:24.612+00', '2022-02-11 20:53:25.512+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('873b2f15cc9', 'Apply Informational Label', 'Applies an informational label on a post', 'https://api.mywebsite.com/apply_informational_label', '2022-01-16 22:48:41.106+00', '2022-01-16 22:48:41.106+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('b2f15cc9124', 'Block IP Address', 'Blocks the IP address of the user who created the content from ever logging in again.', 'https://api.mywebsite.com/block_ip', '2022-01-16 22:50:11.865+00', '2022-01-16 22:50:11.865+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('f15cc912427', 'Block Message', 'This blocks a message from being delivered until a human moderator reviews it.', 'https://api.mywebsite.com/block_message', '2022-01-16 22:51:20.293+00', '2022-01-16 22:51:20.293+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');
INSERT INTO public.actions VALUES ('f1873b2f15c', 'Demote', 'Reduces a post''s distribution by demoting it in feed ranking models.', 'https://api.mywebsite.com/demote', '2022-01-16 22:47:06.601+00', '2022-02-13 01:45:44.271+00', 'e7c89ce7729', NULL, NULL, 'NONE', '["2025-12-09 15:40:35.197741+00",)', 'CUSTOM_ACTION', '{}', false, '{}');


--
-- Data for Name: item_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.item_types VALUES ('1dcf1873b2f', 'e7c89ce7729', 'Private Message', 'A message sent in a private chat thread', 'CONTENT', '{"{\"name\": \"text\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"images\", \"type\": \"ARRAY\", \"required\": true, \"container\": {\"containerType\": \"ARRAY\", \"keyScalarType\": null, \"valueScalarType\": \"IMAGE\"}}","{\"name\": \"recipient_ids\", \"type\": \"ARRAY\", \"required\": true, \"container\": {\"containerType\": \"ARRAY\", \"keyScalarType\": null, \"valueScalarType\": \"STRING\"}}","{\"name\": \"are_recipients_connected\", \"type\": \"BOOLEAN\", \"required\": true, \"container\": null}","{\"name\": \"num_previous_messages\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}"}', '2022-01-16 22:40:49.482+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:33.177741+00",)', false, NULL, NULL);
INSERT INTO public.item_types VALUES ('91dcf1873b2', 'e7c89ce7729', 'Comment', 'Comment that appears under a Post', 'CONTENT', '{"{\"name\": \"text\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"images\", \"type\": \"ARRAY\", \"required\": true, \"container\": {\"containerType\": \"ARRAY\", \"keyScalarType\": null, \"valueScalarType\": \"IMAGE\"}}","{\"name\": \"owner_id\", \"type\": \"ID\", \"required\": true, \"container\": null}","{\"name\": \"num_likes\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}","{\"name\": \"num_replies\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}","{\"name\": \"recipient_ids\", \"type\": \"ARRAY\", \"required\": true, \"container\": {\"containerType\": \"ARRAY\", \"keyScalarType\": null, \"valueScalarType\": \"STRING\"}}"}', '2022-01-16 22:40:04.8+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:33.177741+00",)', false, NULL, NULL);
INSERT INTO public.item_types VALUES ('a8481310e8c', 'e7c89ce7729', 'Post', 'A post that shows up in the Feed', 'CONTENT', '{"{\"name\": \"text\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"images\", \"type\": \"ARRAY\", \"required\": true, \"container\": {\"containerType\": \"ARRAY\", \"keyScalarType\": null, \"valueScalarType\": \"IMAGE\"}}","{\"name\": \"owner_id\", \"type\": \"ID\", \"required\": true, \"container\": null}","{\"name\": \"num_likes\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}","{\"name\": \"num_comments\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}","{\"name\": \"num_user_reports\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}"}', '2022-01-10 23:28:03.651+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:33.177741+00",)', false, NULL, NULL);
INSERT INTO public.item_types VALUES ('dcf1873b2f1', 'e7c89ce7729', 'Profile', 'A user''s overall account profile', 'CONTENT', '{"{\"name\": \"name\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"email\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"bio\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"profile_age\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}","{\"name\": \"profile_picture\", \"type\": \"IMAGE\", \"required\": true, \"container\": null}","{\"name\": \"num_connections\", \"type\": \"NUMBER\", \"required\": true, \"container\": null}"}', '2022-01-16 22:42:10.563+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:33.177741+00",)', false, NULL, NULL);
INSERT INTO public.item_types VALUES ('6f8f8612205', 'e7c89ce7729', 'SimpleComment', NULL, 'CONTENT', '{"{\"name\": \"text\", \"type\": \"STRING\", \"required\": true, \"container\": null}"}', '2022-04-13 00:32:19.099+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:33.177741+00",)', false, NULL, NULL);
INSERT INTO public.item_types VALUES ('34d959ffb43', '34bff959d00', 'User', 'Default user', 'USER', '{"{\"name\": \"name\", \"type\": \"STRING\", \"required\": false, \"container\": null}"}', '2023-06-19 05:49:34.306197+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:36.127299+00",)', true, NULL, NULL);
INSERT INTO public.item_types VALUES ('0270c4bbdad', 'dadbb4c07b0', 'User', 'Default user', 'USER', '{"{\"name\": \"name\", \"type\": \"STRING\", \"required\": false, \"container\": null}"}', '2023-06-19 05:49:34.306197+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:36.127299+00",)', true, NULL, NULL);
INSERT INTO public.item_types VALUES ('502ec98c7e', 'e7c89ce7729', 'User', 'Default user', 'USER', '{"{\"name\": \"name\", \"type\": \"STRING\", \"required\": false, \"container\": null}"}', '2023-06-19 05:49:34.306197+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:36.127299+00",)', true, NULL, NULL);
INSERT INTO public.item_types VALUES ('50013228dc6', '6cd8223106e', 'User', 'Default user', 'USER', '{"{\"name\": \"name\", \"type\": \"STRING\", \"required\": false, \"container\": null}"}', '2023-06-19 05:49:34.306197+00', NULL, NULL, NULL, NULL, NULL, NULL, '["2025-12-09 15:40:36.127299+00",)', true, NULL, NULL);


--
-- Data for Name: actions_and_item_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:47:55.795+00', '2022-01-16 22:47:55.795+00', '1873b2f15cc', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:51.386+00', '2022-01-16 22:50:51.386+00', '2f15cc91242', '1dcf1873b2f', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:51.386+00', '2022-01-16 22:50:51.386+00', '2f15cc91242', '91dcf1873b2', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:51.386+00', '2022-01-16 22:50:51.386+00', '2f15cc91242', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:51.386+00', '2022-01-16 22:50:51.386+00', '2f15cc91242', 'dcf1873b2f1', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:35.112+00', '2022-01-16 22:49:35.112+00', '3b2f15cc912', '1dcf1873b2f', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:35.112+00', '2022-01-16 22:49:35.112+00', '3b2f15cc912', '91dcf1873b2', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:35.112+00', '2022-01-16 22:49:35.112+00', '3b2f15cc912', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:35.112+00', '2022-01-16 22:49:35.112+00', '3b2f15cc912', 'dcf1873b2f1', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:10.163+00', '2022-01-16 22:49:10.163+00', '73b2f15cc91', '1dcf1873b2f', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:10.163+00', '2022-01-16 22:49:10.163+00', '73b2f15cc91', '91dcf1873b2', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:10.163+00', '2022-01-16 22:49:10.163+00', '73b2f15cc91', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:49:10.163+00', '2022-01-16 22:49:10.163+00', '73b2f15cc91', 'dcf1873b2f1', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-02-11 20:42:52.246+00', '2022-02-11 20:42:52.246+00', '8481310e8c4', '1dcf1873b2f', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-02-11 20:42:52.246+00', '2022-02-11 20:42:52.246+00', '8481310e8c4', '91dcf1873b2', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-02-11 20:42:52.246+00', '2022-02-11 20:42:52.246+00', '8481310e8c4', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-02-11 20:42:52.246+00', '2022-02-11 20:42:52.246+00', '8481310e8c4', 'dcf1873b2f1', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:48:41.127+00', '2022-01-16 22:48:41.127+00', '873b2f15cc9', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:11.881+00', '2022-01-16 22:50:11.881+00', 'b2f15cc9124', '1dcf1873b2f', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:11.881+00', '2022-01-16 22:50:11.881+00', 'b2f15cc9124', '91dcf1873b2', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:11.881+00', '2022-01-16 22:50:11.881+00', 'b2f15cc9124', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:50:11.881+00', '2022-01-16 22:50:11.881+00', 'b2f15cc9124', 'dcf1873b2f1', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:51:20.309+00', '2022-01-16 22:51:20.309+00', 'f15cc912427', '1dcf1873b2f', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:47:06.613+00', '2022-01-16 22:47:06.613+00', 'f1873b2f15c', '91dcf1873b2', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:47:06.613+00', '2022-01-16 22:47:06.613+00', 'f1873b2f15c', 'a8481310e8c', '["2025-12-09 15:40:35.641374+00",)');
INSERT INTO public.actions_and_item_types VALUES ('2022-01-16 22:47:06.613+00', '2022-01-16 22:47:06.613+00', 'f1873b2f15c', 'dcf1873b2f1', '["2025-12-09 15:40:35.641374+00",)');


--
-- Data for Name: actions_and_item_types_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: actions_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('4bff959d009', 'test2@example.com', '$2a$05$VLNaHGWh7n1Zh6tYhr7H0.c06BlURlpNkxaW4wQC3hg8RUM3L0ZS6', 'Test', 'User 2', 'ADMIN', true, false, '2022-01-24 22:22:48.337+00', '2022-01-24 22:22:48.337+00', '34bff959d00', '{password}');
INSERT INTO public.users VALUES ('7c89ce77297', 'test@example.com', '$2a$05$VLNaHGWh7n1Zh6tYhr7H0.c06BlURlpNkxaW4wQC3hg8RUM3L0ZS6', 'Test', 'User', 'ADMIN', true, false, '2022-01-10 02:20:19.335+00', '2022-01-10 02:20:19.335+00', 'e7c89ce7729', '{password}');
INSERT INTO public.users VALUES ('cd8223106e0', 'test4@example.com', '$2a$05$VLNaHGWh7n1Zh6tYhr7H0.c06BlURlpNkxaW4wQC3hg8RUM3L0ZS6', 'Test ', 'User 4', 'ADMIN', true, false, '2022-02-17 07:38:36.069+00', '2022-02-17 07:38:36.069+00', '6cd8223106e', '{password}');


--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.api_keys VALUES ('49cfa451-1a5e-4093-91d4-fcfc647af087', '6cd8223106e', 'MIGRATION_PLACEHOLDER_6cd8223106e_1765294908.942080', 'Main API Key', 'Primary API key for organization (generated during migration)', true, '2025-12-09 15:41:48.94208+00', '2025-12-09 15:41:48.94208+00', NULL, NULL);
INSERT INTO public.api_keys VALUES ('c90db67f-8e8e-40dd-bf0f-16127507d1dd', '34bff959d00', 'MIGRATION_PLACEHOLDER_34bff959d00_1765294908.942080', 'Main API Key', 'Primary API key for organization (generated during migration)', true, '2025-12-09 15:41:48.94208+00', '2025-12-09 15:41:48.94208+00', NULL, NULL);
INSERT INTO public.api_keys VALUES ('74165f69-9b50-4391-b656-8141ed87fd0c', 'e7c89ce7729', 'MIGRATION_PLACEHOLDER_e7c89ce7729_1765294908.942080', 'Main API Key', 'Primary API key for organization (generated during migration)', true, '2025-12-09 15:41:48.94208+00', '2025-12-09 15:41:48.94208+00', NULL, NULL);
INSERT INTO public.api_keys VALUES ('9f6d7643-50ac-45e6-8f04-27c4d1cafbec', 'dadbb4c07b0', 'MIGRATION_PLACEHOLDER_dadbb4c07b0_1765294908.942080', 'Main API Key', 'Primary API key for organization (generated during migration)', true, '2025-12-09 15:41:48.94208+00', '2025-12-09 15:41:48.94208+00', NULL, NULL);


--
-- Data for Name: rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rules VALUES ('9800eb88a94', 'Delete Holocaust Denial', 'This rule deletes all content that contains common Holocaust Denial phrases', 'LIVE', '{hate,antisemitism}', 1000, 6, '2022-02-14', '2022-02-13 02:03:21.952+00', '2022-02-14 20:21:11.218+00', 'e7c89ce7729', '7c89ce77297', NULL, '{"conditions": [{"input": {"name": "All text", "type": "CONTENT_COOP_INPUT"}, "signal": {"id": "{\"type\":\"TEXT_SIMILARITY_SCORE\"}", "type": "TEXT_SIMILARITY_SCORE"}, "threshold": 0.8, "comparator": "GREATER_THAN_OR_EQUALS", "matchingValues": {"strings": ["holohoax", "6mwe", "6 million wasn''t enough", "6 million weren''t enough", "6 gorillion", "muh holocaust"]}}], "conjunction": "AND"}', 'INSUFFICIENT_DATA', '2025-12-09 15:40:32.671801+00', '["2025-12-09 15:40:36.678959+00",)', 'CONTENT', NULL, NULL);


--
-- Data for Name: backtests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: gdpr_delete_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: invite_user_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: item_types_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: location_banks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: location_bank_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: media_banks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: org_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.org_settings VALUES ('e7c89ce7729', NULL, false, false, NULL, NULL, NULL, false, 90, false, NULL, NULL, false, false, NULL);
INSERT INTO public.org_settings VALUES ('34bff959d00', NULL, false, false, NULL, NULL, NULL, false, 90, false, NULL, NULL, false, false, NULL);
INSERT INTO public.org_settings VALUES ('6cd8223106e', NULL, false, false, NULL, NULL, NULL, false, 90, false, NULL, NULL, false, false, NULL);
INSERT INTO public.org_settings VALUES ('dadbb4c07b0', NULL, false, false, NULL, NULL, NULL, false, 90, false, NULL, NULL, false, false, NULL);


--
-- Data for Name: policies; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: policy_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rules_and_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rules_and_actions VALUES ('2022-02-13 02:03:21.966+00', '2022-02-13 02:03:21.966+00', '2f15cc91242', '9800eb88a94', '["2025-12-09 15:40:32.761966+00",)');
INSERT INTO public.rules_and_actions VALUES ('2022-02-13 02:03:21.966+00', '2022-02-13 02:03:21.966+00', 'f15cc912427', '9800eb88a94', '["2025-12-09 15:40:32.761966+00",)');


--
-- Data for Name: rules_and_actions_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rules_and_item_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rules_and_item_types VALUES ('2022-02-13 02:03:21.964+00', '2022-02-13 02:03:21.964+00', '91dcf1873b2', '9800eb88a94', '["2025-12-09 15:40:32.761966+00",)');
INSERT INTO public.rules_and_item_types VALUES ('2022-02-13 02:03:21.964+00', '2022-02-13 02:03:21.964+00', 'a8481310e8c', '9800eb88a94', '["2025-12-09 15:40:32.761966+00",)');


--
-- Data for Name: rules_and_item_types_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rules_and_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rules_and_policies_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rules_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rules_history VALUES ('9800eb88a94', 'Delete Holocaust Denial', 'LIVE', '{hate,antisemitism}', 1000, 'e7c89ce7729', '7c89ce77297', NULL, '{"conditions": [{"input": {"name": "All text", "scalarType": "STRING", "isCustomFieldOnContentType": null}, "signal": {"id": "{\"type\":\"TEXT_SIMILARITY_SCORE\"}", "type": "TEXT_SIMILARITY_SCORE"}, "threshold": 0.8, "comparator": "GREATER_THAN_OR_EQUALS", "matchingValues": {"strings": ["holohoax", "6mwe", "6 million wasn''t enough", "6 million weren''t enough", "6 gorillion", "muh holocaust"]}}], "conjunction": "AND"}', '["2025-12-09 15:40:32.761966+00","2025-12-09 15:40:33.697668+00")', NULL, 'CONTENT', NULL, NULL);
INSERT INTO public.rules_history VALUES ('9800eb88a94', 'Delete Holocaust Denial', 'LIVE', '{hate,antisemitism}', 1000, 'e7c89ce7729', '7c89ce77297', NULL, '{"conditions": [{"input": {"name": "All text", "type": "CONTENT_COOP_INPUT"}, "signal": {"id": "TEXT_SIMILARITY_SCORE", "type": "TEXT_SIMILARITY_SCORE"}, "threshold": 0.8, "comparator": "GREATER_THAN_OR_EQUALS", "matchingValues": {"strings": ["holohoax", "6mwe", "6 million wasn''t enough", "6 million weren''t enough", "6 gorillion", "muh holocaust"]}}], "conjunction": "AND"}', '["2025-12-09 15:40:33.697668+00","2025-12-09 15:40:36.678959+00")', 'This rule deletes all content that contains common Holocaust Denial phrases', 'CONTENT', NULL, NULL);


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: signing_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: snowflake_outbox; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: text_banks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_strike_thresholds; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: users_and_favorite_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: view_maintenance_metadata; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.view_maintenance_metadata VALUES ('manual_review_tool.dim_mrt_decisions_materialized', '-infinity');


--
-- Data for Name: reporting_rule_history; Type: TABLE DATA; Schema: reporting_rules; Owner: postgres
--



--
-- Data for Name: reporting_rules; Type: TABLE DATA; Schema: reporting_rules; Owner: postgres
--



--
-- Data for Name: reporting_rules_to_actions; Type: TABLE DATA; Schema: reporting_rules; Owner: postgres
--



--
-- Data for Name: reporting_rules_to_item_types; Type: TABLE DATA; Schema: reporting_rules; Owner: postgres
--



--
-- Data for Name: reporting_rules_to_policies; Type: TABLE DATA; Schema: reporting_rules; Owner: postgres
--


--
-- Data for Name: open_ai_configs; Type: TABLE DATA; Schema: signal_auth_service; Owner: postgres
--



--
-- Data for Name: models_eligible_as_signals; Type: TABLE DATA; Schema: signals_service; Owner: postgres
--



--
-- Data for Name: org_default_user_interface_settings; Type: TABLE DATA; Schema: user_management_service; Owner: postgres
--

INSERT INTO user_management_service.org_default_user_interface_settings VALUES ('e7c89ce7729', true, true, 2);
INSERT INTO user_management_service.org_default_user_interface_settings VALUES ('34bff959d00', true, true, 2);
INSERT INTO user_management_service.org_default_user_interface_settings VALUES ('dadbb4c07b0', true, true, 2);
INSERT INTO user_management_service.org_default_user_interface_settings VALUES ('6cd8223106e', true, true, 2);


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: user_management_service; Owner: postgres
--



--
-- Data for Name: user_interface_settings; Type: TABLE DATA; Schema: user_management_service; Owner: postgres
--



--
-- Data for Name: user_scores; Type: TABLE DATA; Schema: user_statistics_service; Owner: postgres
--



--
-- Name: invite_user_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invite_user_tokens_id_seq', 1, false);


--
-- Name: user_strike_thresholds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_strike_thresholds_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

