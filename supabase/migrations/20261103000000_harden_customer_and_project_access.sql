-- Harden direct PostgREST access to customer records and project mutations.
-- Public contact/inquiry submissions and admin editing use service-role server
-- actions, so they do not require direct browser table writes.
-- Deployment prerequisite: export the affected pg_policies and grants first.
-- The transaction rolls back atomically on failure; a post-commit policy rollback
-- must use that reviewed snapshot rather than recreating insecure policies blindly.

begin;

alter table public.client enable row level security;
alter table public.contact enable row level security;
alter table public.inquire enable row level security;
alter table public.loan_preapp enable row level security;
alter table public.project_table enable row level security;

-- Customer records are readable and mutable only through server actions. The
-- public forms already use those actions, so no browser role needs direct DML.
revoke select, insert, update, delete on table
  public.client,
  public.contact,
  public.inquire,
  public.loan_preapp
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.client,
  public.contact,
  public.inquire,
  public.loan_preapp
to service_role;

-- Remove any column-level grants that would survive a table-level REVOKE.
do $customer_column_grants$
declare
  column_record record;
begin
  for column_record in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('client', 'contact', 'inquire', 'loan_preapp')
  loop
    execute format(
      'revoke select (%I), update (%I) on table public.%I from public, anon, authenticated',
      column_record.column_name,
      column_record.column_name,
      column_record.table_name
    );
  end loop;
end
$customer_column_grants$;

-- Remove customer policies that could silently reactivate sensitive reads or
-- mutations if broad table grants are added again later.
do $customer_policies$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('client', 'contact', 'inquire', 'loan_preapp')
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
      and roles && array['anon', 'authenticated', 'public']::name[]
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$customer_policies$;

-- All project mutations stay behind the custom-session/RBAC server actions.
revoke insert, update, delete on table public.project_table from public, anon, authenticated;
grant select, insert, update, delete on table public.project_table to service_role;

-- Remove all browser-role project policies. Recreate only a known active-project
-- SELECT policy below; this also removes email-domain write policies regardless
-- of their names or expressions.
do $project_client_policies$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_table'
      and roles && array['anon', 'authenticated', 'public']::name[]
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$project_client_policies$;

create policy project_table_public_read_active
  on public.project_table
  for select
  to anon, authenticated
  using (is_active = true and deleted_at is null);

-- RLS controls which project rows are public; column grants control what each
-- allowed row can reveal. Keep these columns aligned with explicit public app
-- queries. merchant_id remains available through the allowlisted payment action,
-- not through direct PostgREST project-table access.
revoke select on table public.project_table from public, anon, authenticated;

do $project_column_grants$
declare
  column_record record;
begin
  for column_record in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_table'
  loop
    execute format(
      'revoke select (%I), update (%I) on table public.project_table from public, anon, authenticated',
      column_record.column_name,
      column_record.column_name
    );
  end loop;
end
$project_column_grants$;

grant select (
  id,
  title,
  slug,
  status,
  address,
  city,
  country,
  sqm,
  unit_total,
  image,
  img_awards,
  map_icon,
  virtual_tour_url,
  is_active,
  deleted_at
) on table public.project_table to anon, authenticated;

-- Fail the migration instead of committing a partially hardened grant state.
do $verify_access$
declare
  customer_table text;
begin
  foreach customer_table in array array['client', 'contact', 'inquire', 'loan_preapp']
  loop
    if has_table_privilege('anon', format('public.%I', customer_table), 'SELECT')
      or has_table_privilege('anon', format('public.%I', customer_table), 'INSERT')
      or has_table_privilege('anon', format('public.%I', customer_table), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', customer_table), 'DELETE')
      or has_table_privilege('authenticated', format('public.%I', customer_table), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', customer_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', customer_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', customer_table), 'DELETE')
      or has_any_column_privilege('anon', format('public.%I', customer_table), 'SELECT,UPDATE')
      or has_any_column_privilege('authenticated', format('public.%I', customer_table), 'SELECT,UPDATE') then
      raise exception 'Customer table % still has a direct client privilege', customer_table;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.project_table', 'INSERT')
    or has_table_privilege('anon', 'public.project_table', 'UPDATE')
    or has_table_privilege('anon', 'public.project_table', 'DELETE')
    or has_table_privilege('authenticated', 'public.project_table', 'INSERT')
    or has_table_privilege('authenticated', 'public.project_table', 'UPDATE')
    or has_table_privilege('authenticated', 'public.project_table', 'DELETE')
    or has_any_column_privilege('anon', 'public.project_table', 'UPDATE')
    or has_any_column_privilege('authenticated', 'public.project_table', 'UPDATE') then
    raise exception 'project_table still has a direct client write privilege';
  end if;

  if has_column_privilege('anon', 'public.project_table', 'merchant_id', 'SELECT')
    or has_column_privilege('authenticated', 'public.project_table', 'merchant_id', 'SELECT') then
    raise exception 'merchant_id is still directly selectable from project_table';
  end if;
end
$verify_access$;

commit;
