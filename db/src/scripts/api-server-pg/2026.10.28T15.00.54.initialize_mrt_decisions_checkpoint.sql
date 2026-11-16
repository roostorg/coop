INSERT INTO public.view_maintenance_metadata (table_name, last_insert)
VALUES ('manual_review_tool.dim_mrt_decisions_materialized', '-infinity')
ON CONFLICT (table_name) DO NOTHING;
