-- Normalised catalog listing (columns, constraints, indexes, triggers, functions,
-- views, matviews, enums, comments, sequences, extensions) used to compare two
-- databases object by object. Usage: psql -d <db> -q -f catalog.sql
\pset format unaligned
\pset tuples_only on
with ns as (select oid, nspname from pg_namespace where nspname not in ('pg_catalog','information_schema','pg_toast') and nspname not like 'pg_temp%' and nspname not like 'pg_toast%')
select 'COL '||n.nspname||'.'||c.relname||'.'||a.attname||' '||format_type(a.atttypid,a.atttypmod)||case when a.attnotnull then ' NOT NULL' else '' end||coalesce(' DEFAULT '||pg_get_expr(d.adbin,d.adrelid),'')||case when a.attgenerated='s' then ' GENERATED' else '' end||case when a.attidentity<>'' then ' IDENTITY '||a.attidentity::text else '' end
from pg_attribute a join pg_class c on c.oid=a.attrelid join ns n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped and c.relname<>'SequelizeMeta'
union all
select 'CON '||n.nspname||'.'||cl.relname||' '||co.conname||' '||pg_get_constraintdef(co.oid) from pg_constraint co join pg_class cl on cl.oid=co.conrelid join ns n on n.oid=cl.relnamespace where cl.relname<>'SequelizeMeta'
union all
select 'IDX '||schemaname||'.'||indexname||' '||regexp_replace(indexdef,'^CREATE (UNIQUE )?INDEX \S+ ','CREATE \1INDEX ') from pg_indexes where schemaname in (select nspname from ns) and tablename<>'SequelizeMeta'
union all
select 'TRG '||n.nspname||'.'||c.relname||' '||t.tgname||' '||pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join ns n on n.oid=c.relnamespace where not t.tgisinternal
union all
select 'FN '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(pg_get_functiondef(p.oid)) from pg_proc p join ns n on n.oid=p.pronamespace where p.prokind <> 'a'
union all
select 'VIEW '||schemaname||'.'||viewname||' '||md5(definition) from pg_views where schemaname in (select nspname from ns)
union all
select 'MATVIEW '||schemaname||'.'||matviewname||' '||md5(definition) from pg_matviews
union all
select 'ENUM '||n.nspname||'.'||t.typname||' '||string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_type t join ns n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid group by n.nspname,t.typname
union all
select 'COMMENT '||n.nspname||'.'||c.relname||coalesce('.'||a.attname,'')||' '||md5(ds.description) from pg_description ds join pg_class c on c.oid=ds.objoid join ns n on n.oid=c.relnamespace left join pg_attribute a on a.attrelid=c.oid and a.attnum=ds.objsubid and ds.objsubid>0
union all
select 'SEQ '||schemaname||'.'||sequencename from pg_sequences
union all
select 'EXT '||extname from pg_extension
order by 1;
