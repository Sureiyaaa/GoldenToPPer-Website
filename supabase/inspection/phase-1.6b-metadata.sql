-- READ-ONLY TEMPLATE, NOT EXECUTED. Metadata only; no application-table records.
-- Review output securely before sharing. Do not include secrets, passwords,
-- password hashes, customer rows, or unredacted function bodies in chat/logs.

-- Enumerate ALL overloads and effective execution privileges, without bodies.
select p.oid::regprocedure as signature, r.rolname as owner, p.prosecdef,
       l.lanname as language, p.proargnames, p.proacl,
       array(select setting from unnest(p.proconfig) as setting
             where setting like 'search_path=%') as function_search_path,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname in ('create_admin_user', 'update_admin_user', 'remove_audit_log_entry')
order by p.proname, p.oid;

-- Function-body inspection is a SEPARATE secure local review:
-- pg_get_functiondef('public.create_admin_user(text,text,boolean,integer)'::regprocedure)
-- pg_get_functiondef('public.update_admin_user(uuid,boolean,integer,text)'::regprocedure)
-- pg_get_functiondef('public.remove_audit_log_entry(bigint,text,text)'::regprocedure)
-- Do not persist raw definitions in this repo. Report only redacted findings on
-- authorization, validation, dynamic SQL, object qualification, credential use,
-- error/return data, and search_path. Inspect dependent functions as necessary.

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;

select c.oid::regclass as object, r.rolname as owner, c.relkind,
       c.relrowsecurity, c.relforcerowsecurity, c.relacl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
join pg_roles r on r.oid = c.relowner
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
order by c.relname;

select c.oid::regclass as object, a.attname, a.attacl
from pg_attribute a join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
  and a.attacl is not null
order by c.relname, a.attnum;

select nspname, nspowner::regrole as owner, nspacl
from pg_namespace where nspname = 'public';

-- Include GLOBAL rows; schema-level REVOKE cannot cancel their grants.
select d.defaclrole::regrole as creator,
       case when d.defaclnamespace = 0 then '<global>' else n.nspname end as scope,
       d.defaclobjtype, d.defaclacl,
       x.grantor::regrole as grantor,
       case when x.grantee = 0 then 'PUBLIC' else x.grantee::regrole::text end as grantee,
       x.privilege_type, x.is_grantable
from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) x
where d.defaclrole in ('postgres'::regrole, 'supabase_admin'::regrole)
  and (d.defaclnamespace = 0 or n.nspname = 'public')
order by 1, 2, 3;

select rolname, rolsuper, rolinherit, rolbypassrls
from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'postgres', 'supabase_admin');
select roleid::regrole as granted_role, member::regrole as member, admin_option
from pg_auth_members order by 1, 2;

-- Environment/migration identity only, not statements that could contain secrets.
select version from supabase_migrations.schema_migrations order by version;
-- Obtain Data API enabled/exposed-schema/automatic-exposure settings separately
-- through an authorized settings-only export. No API request is made by this file.
