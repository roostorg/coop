--
-- Data for Name: orgs; Type: TABLE DATA; Schema: public; Owner: postgres
-- Description: Add Newsmast organization
--

INSERT INTO public.orgs VALUES ('a1b2c3d4e5f', 'exampleadmin@newsmast.org', 'Newsmast', 'newsmast.org', 'nm1k3y5a7b', '2026-04-08 00:00:00+00', '2026-04-08 00:00:00+00', NULL);

--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.api_keys VALUES ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'a1b2c3d4e5f', 'MIGRATION_PLACEHOLDER_a1b2c3d4e5f_1775347200.000000', 'Main API Key', 'Primary API key for organization (generated during migration)', true, '2026-04-08 00:00:00+00', '2026-04-08 00:00:00+00', NULL, NULL);

--
-- Data for Name: org_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.org_settings VALUES ('a1b2c3d4e5f', NULL, false, false, NULL, NULL, NULL, false, 90, false, NULL, NULL, false, false, NULL);

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('b2c3d4e5f6a', 'exampleadmin@newsmast.org', '$2a$05$56bnx4Xm6SfDIUHMCQy.lupVOJEHv6Ru23ljWo8r1TpjGDfT4BWee', 'Newsmast', 'Admin', 'ADMIN', true, false, '2026-04-08 00:00:00+00', '2026-04-08 00:00:00+00', 'a1b2c3d4e5f', '{password}');
