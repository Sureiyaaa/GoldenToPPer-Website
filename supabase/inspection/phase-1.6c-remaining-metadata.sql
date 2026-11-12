-- Specific remaining metadata only; NOT EXECUTED. No customer or admin-user rows.
-- Inspect definitions privately: redact embedded secrets before sharing findings.

-- Bodies, function-level settings, exact ACL/grantors and any other overloads.
select p.oid::regprocedure as signature, r.rolname as owner, p.prosecdef,
       p.proacl,
       array(select setting from unnest(p.proconfig) as setting
             where setting like 'search_path=%') as configured_search_path,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.proname in (
  'create_admin_user', 'update_admin_user', 'remove_audit_log_entry'
) and p.prokind = 'f'
order by 1;

-- Raw relation/column ACLs incl. service_role, grantors, non-DML rights.
select c.oid::regclass as object, c.relowner::regrole as owner,
       c.relkind, c.relacl, a.attname, a.attacl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
left join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relname in (
  'admin_users', 'groups', 'module_access', 'admin_contact_reads',
  'admin_inquire_reads', 'admin_loan_preapp_reads', 'audit_logs',
  'client', 'contact', 'inquire', 'loan_preapp', 'navbar_projects', 'our story'
)
order by 1, a.attnum;

-- Insert sequence dependencies/ACLs; identity-generated IDs are not distinguished
-- by the supplied column_default=null values.
select t.oid::regclass as table_name, a.attname, a.attidentity,
       s.oid::regclass as sequence_name, s.relacl as sequence_acl,
       s.relowner::regrole as sequence_owner
from pg_class t join pg_namespace n on n.oid = t.relnamespace
join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
left join pg_depend d on d.refobjid = t.oid and d.refobjsubid = a.attnum
  and d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i')
left join pg_class s on s.oid = d.objid and s.relkind = 'S'
where n.nspname = 'public' and t.relname in (
  'admin_users', 'groups', 'module_access', 'audit_logs', 'client',
  'contact', 'inquire', 'loan_preapp', 'navbar_projects', 'our story'
) and (a.attidentity <> '' or s.oid is not null)
order by 1, a.attnum;

-- Effective role attributes and inheritance. No pg_authid/password fields.
select rolname, rolsuper, rolinherit, rolbypassrls
from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'postgres', 'supabase_admin');
select roleid::regrole as granted_role, member::regrole as member, admin_option
from pg_auth_members order by 1, 2;

-- Global defaults only: omitted schema rows do not establish global defaults.
select d.defaclrole::regrole as creator, d.defaclobjtype, d.defaclacl
from pg_default_acl d
where d.defaclnamespace = 0
  and d.defaclrole in ('postgres'::regrole, 'supabase_admin'::regrole)
order by 1, 2;

-- Policy mode missing from CSV; RLS flags were exported. Owners are queried above.
select tablename, policyname, permissive from pg_policies
where schemaname = 'public' and tablename in (
  'admin_users', 'groups', 'module_access', 'admin_contact_reads',
  'admin_inquire_reads', 'audit_logs', 'client', 'contact', 'inquire',
  'loan_preapp', 'navbar_projects', 'our story'
) order by tablename, policyname;

-- Only column names of migration tracking metadata: do not assume optional fields.
select column_name, data_type from information_schema.columns
where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
order by ordinal_position;
-- If 'name' is confirmed, separately retrieve version/name for the two known
-- versions. Review statements privately only if present; do not publish raw code.

-- Deployed settings evidence (may return null; null is not proof of non-exposure).
select current_setting('pgrst.db_schemas', true) as database_visible_api_schemas;
-- Confirm Data API enabled/exposed schemas via an authorized settings-only export
-- if this value is null or gateway overrides exist. No reliable SQL-only proof
-- of hosted API settings is asserted here.
