-- REVIEW ONLY: prepared locally, not applied. Deploy the Phase 1.6 application first.
-- Phase 1.6C: grants and exact policies reconciled against seven CSV exports
-- in goldentopper_supabase_metadata_2026-11-10.zip. No SQL was executed locally.
-- Prerequisite: snapshot table/column/schema/sequence ACLs, policies, role membership,
-- pg_default_acl and function metadata. Prepare the inverse from that snapshot.
-- Never roll back with blanket grants to anon/authenticated.
-- RPC ACL containment is in 20261110005000; scoped defaults in 20261110020000.
-- Function bodies, raw column ACLs, inheritance and Data API settings are still
-- unavailable. See docs/security-hardening-phase-1.6c.md for remaining scope.

begin;

-- No browser policy represents the custom CMS session. Preserve the established
-- service-role RLS bypass; abort rather than silently breaking all server actions.
do $service_role$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role' and (rolbypassrls or rolsuper)) then
    raise exception 'service_role RLS bypass must be verified before hardening';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not c.relrowsecurity
      and c.relname in ('admin_users', 'groups', 'module_access', 'admin_contact_reads',
        'admin_inquire_reads', 'admin_loan_preapp_reads', 'audit_logs', 'client',
        'contact', 'inquire', 'loan_preapp', 'navbar_projects', 'our story')
  ) then
    raise exception 'RLS state differs from reviewed CSV metadata';
  end if;
end
$service_role$;

-- Exact existing names from 03_public_rls_policies.csv, not guessed/catalog-wide.
drop policy if exists "Admin Full Access" on public.admin_users;
drop policy if exists "Allow authenticated users to view admin_users" on public.admin_users;
drop policy if exists "Enable read access for all users" on public.admin_users;

drop policy if exists "Allow updates for authenticated users" on public.groups;
drop policy if exists "Enable insert for authenticated users only" on public.groups;
drop policy if exists "Enable read access for all users" on public.groups;

drop policy if exists "Allow authenticated users to insert module_access" on public.module_access;
drop policy if exists "Allow authenticated users to update module_access" on public.module_access;
drop policy if exists "Allow authenticated users to view module_access" on public.module_access;
drop policy if exists "Enable insert for authenticated users only" on public.module_access;
drop policy if exists "Enable read access for all users" on public.module_access;

drop policy if exists "Admins can delete their own contact reads" on public.admin_contact_reads;
drop policy if exists "Admins can insert their own contact reads" on public.admin_contact_reads;
drop policy if exists "Admins can view their own contact reads" on public.admin_contact_reads;
drop policy if exists "Enable read access for all users" on public.admin_contact_reads;
drop policy if exists "Admins can delete their own inquire reads" on public.admin_inquire_reads;
drop policy if exists "Admins can insert their own inquire reads" on public.admin_inquire_reads;
drop policy if exists "Admins can view their own inquire reads" on public.admin_inquire_reads;
drop policy if exists "Enable read access for all users" on public.admin_inquire_reads;

drop policy if exists "Allow authenticated inserts on audit_logs" on public.audit_logs;
drop policy if exists "Allow authenticated read on audit_logs" on public.audit_logs;
drop policy if exists "Enable insert for authenticated users only" on public.audit_logs;
drop policy if exists "Enable read access for all users" on public.audit_logs;

drop policy if exists "Admin Full Access" on public.client;
drop policy if exists "Public Insert" on public.client;
drop policy if exists "Admin Full Access" on public.contact;
drop policy if exists "Public Insert" on public.contact;
drop policy if exists "Admin Full Access" on public.inquire;
drop policy if exists "Public Insert" on public.inquire;
drop policy if exists "Admin Full Access" on public.loan_preapp;
drop policy if exists "Public Insert" on public.loan_preapp;

drop policy if exists "Allow public read access on navbar_projects" on public.navbar_projects;
drop policy if exists "Enable insert for authenticated users only" on public.navbar_projects;
drop policy if exists "Enable read access for all users" on public.navbar_projects;
drop policy if exists "update navbar projects" on public.navbar_projects;
drop policy if exists "Enable insert for authenticated users only" on public."our story";
drop policy if exists "Enable read access for all users" on public."our story";
drop policy if exists "update" on public."our story";

-- Idempotent replacement names owned by this migration, not existing CSV names.
drop policy if exists gt_public_navigation_read on public.navbar_projects;
create policy gt_public_navigation_read on public.navbar_projects
  for select to anon, authenticated
  using (is_active = true and exists (
    select 1 from public.project_table p
    where p.id = navbar_projects.project_id
      and p.is_active = true and p.deleted_at is null
  ));
drop policy if exists gt_public_story_read on public."our story";
create policy gt_public_story_read on public."our story"
  for select to anon, authenticated
  using (is_active = true and is_archived is null);

revoke all privileges on table
  public.admin_users, public.groups, public.module_access,
  public.admin_contact_reads, public.admin_inquire_reads,
  public.admin_loan_preapp_reads, public.audit_logs,
  public.client, public.contact, public.inquire, public.loan_preapp
from public, anon, authenticated;

-- Keep public SELECT unchanged for navigation/story; remove direct mutations.
revoke insert, update, delete, truncate, references, trigger on table
  public.navbar_projects, public."our story"
from public, anon, authenticated;

-- PostgreSQL 17+ adds MAINTAIN (the supplied default ACLs contain its 'm' flag).
do $maintain_acl$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on table public.navbar_projects, public."our story" from public, anon, authenticated';
  end if;
end
$maintain_acl$;
grant select on table public.navbar_projects, public."our story" to anon, authenticated;

-- Column grants survive table-level REVOKE. Enumerate only the allowlisted tables.
do $column_acl$
declare
  item record;
  private_table boolean;
begin
  for item in
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in (
      'admin_users', 'groups', 'module_access', 'admin_contact_reads',
      'admin_inquire_reads', 'admin_loan_preapp_reads', 'audit_logs',
      'client', 'contact', 'inquire', 'loan_preapp', 'navbar_projects', 'our story'
    )
  loop
    private_table := item.table_name not in ('navbar_projects', 'our story');
    if private_table then
      execute format('revoke select (%I) on table public.%I from public, anon, authenticated', item.column_name, item.table_name);
    end if;
    execute format('revoke insert (%I), update (%I), references (%I) on table public.%I from public, anon, authenticated',
      item.column_name, item.column_name, item.column_name, item.table_name);
  end loop;
end
$column_acl$;

-- Preserve the service-role application paths. Existing service-role privileges
-- are not revoked. Sequences and RPC EXECUTE ACLs are deliberately unchanged.
grant select, insert, update on table public.admin_users, public.groups, public.module_access,
  public.navbar_projects, public."our story" to service_role;
grant select, insert, update, delete on table public.admin_contact_reads,
  public.admin_inquire_reads, public.admin_loan_preapp_reads to service_role;
grant select, insert on table public.audit_logs, public.contact, public.inquire,
  public.loan_preapp to service_role;
grant select, insert, update on table public.client to service_role;

-- Fail closed if role inheritance/remaining ACLs defeat this grant-layer change.
do $verify_acl$
declare
  table_name text;
  role_name text;
  privilege_name text;
  column_name text;
begin
  foreach table_name in array array[
    'admin_users', 'groups', 'module_access', 'admin_contact_reads',
    'admin_inquire_reads', 'admin_loan_preapp_reads', 'audit_logs',
    'client', 'contact', 'inquire', 'loan_preapp', 'navbar_projects', 'our story'
  ] loop
    foreach role_name in array array['anon', 'authenticated'] loop
      if current_setting('server_version_num')::integer >= 170000 then
        if has_table_privilege(role_name, format('public.%I', table_name), 'MAINTAIN') then
          raise exception 'Unexpected MAINTAIN privilege for % on %', role_name, table_name;
        end if;
      end if;
      foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if privilege_name = 'SELECT' and table_name in ('navbar_projects', 'our story') then
          continue;
        end if;
        if has_table_privilege(role_name, format('public.%I', table_name), privilege_name) then
          raise exception 'Unexpected % privilege for % on %', privilege_name, role_name, table_name;
        end if;
        if privilege_name in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES') then
          for column_name in
            select a.attname from pg_attribute a
            where a.attrelid = format('public.%I', table_name)::regclass
              and a.attnum > 0 and not a.attisdropped
          loop
            if has_column_privilege(role_name, format('public.%I', table_name), column_name, privilege_name) then
              raise exception 'Unexpected column privilege for % on %.%', role_name, table_name, column_name;
            end if;
          end loop;
        end if;
      end loop;
    end loop;
  end loop;
end
$verify_acl$;

-- Unexpected policy drift must be reviewed, not silently kept or broadly dropped.
do $verify_policies$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public'
    and tablename in (
      'admin_users', 'groups', 'module_access', 'admin_contact_reads',
      'admin_inquire_reads', 'admin_loan_preapp_reads', 'audit_logs',
      'client', 'contact', 'inquire', 'loan_preapp', 'navbar_projects', 'our story'
    )
    and not (
      (tablename = 'navbar_projects' and policyname = 'gt_public_navigation_read') or
      (tablename = 'our story' and policyname = 'gt_public_story_read')
    )
  ) then
    raise exception 'Unexpected policy on hardened tables: refresh and review metadata';
  end if;
end
$verify_policies$;

-- RPC EXECUTE containment: separate 20261110005000 migration; bodies still pending.
-- Scoped defaults: separate 20261110020000 migration; global ACLs not modified.
-- No unrelated public-table policies, schema/sequence/RPC ACLs, or data changed.

commit;
