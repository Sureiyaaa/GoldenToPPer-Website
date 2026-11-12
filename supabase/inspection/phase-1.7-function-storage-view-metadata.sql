-- READ-ONLY / NOT EXECUTED. Run only through an approved metadata connection.
-- This supplements phase-1.6c-remaining-metadata.sql. No customer, admin account,
-- Storage object rows or credential values are selected. Review code privately.

-- Inventory ALL exposed-schema functions, not just the three known RPC names.
select p.oid::regprocedure as signature, p.proowner::regrole as owner,
       p.prosecdef, p.proacl,
       array(select value from unnest(p.proconfig) value where value like 'search_path=%') as search_path,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by 1;
-- For definer functions/alternate wrappers identified here, privately inspect
-- pg_get_functiondef(verified_oid). Redact credentials, literals and secrets before
-- sharing findings. Do not set search_path blindly before dependency review.

-- Storage configuration and exact policies, NOT image/object records.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'images';
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'storage' and tablename in ('objects', 'buckets')
order by tablename, policyname;
select c.oid::regclass as object, c.relacl, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage' and c.relname in ('objects', 'buckets');

-- View definitions are code, not view records. Keep raw definitions private if
-- they contain embedded credentials. security_invoker is in reloptions.
select c.oid::regclass as view_name, c.relowner::regrole as owner, c.relacl,
       c.reloptions, pg_get_viewdef(c.oid, true) as definition
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m') order by 1;

-- Identity/trigger metadata required to reconcile effects without replaying DDL.
select c.oid::regclass as table_name, t.tgname,
       t.tgfoid::regprocedure as function_signature, t.tgenabled
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal order by 1, 2;
