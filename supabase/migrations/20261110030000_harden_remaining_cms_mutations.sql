-- REVIEW ONLY / UNAPPLIED. Phase 1.7 application changes MUST precede this file.
-- Exact existing names from 03_public_rls_policies.csv (2026-11-10).
-- Prerequisites: 20261110010000; snapshot ACLs/policies; reconcile remote history.
-- No Storage policies/functions are guessed. Public content reads remain enabled.
begin;

do $preflight$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role' and (rolbypassrls or rolsuper)) then
    raise exception 'Verify service-role bypass before CMS hardening';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not c.relrowsecurity and c.relname in (
      'amenities','banks','child_marker_table','extended_description','marker_type_table',
      'modules','news_updates','parent_marker','project_banks','project_table',
      'project_tag','promotions','tags','unit_layout','virtual_tours')) then
    raise exception 'CMS RLS state differs from reviewed metadata';
  end if;
end
$preflight$;

-- All 19 remaining browser-role mutation policies across the 15 verified tables.
drop policy if exists "Admin Full Access" on public.amenities;
drop policy if exists "Admin Full Access" on public.banks;
drop policy if exists "Allow authenticated inserts on banks" on public.banks;
drop policy if exists "Allow authenticated updates on banks" on public.banks;
drop policy if exists "Admin Full Access" on public.child_marker_table;
drop policy if exists "Admin Full Access" on public.extended_description;
drop policy if exists "Admin Full Access" on public.marker_type_table;
drop policy if exists "Allow Admin Edits" on public.modules;
drop policy if exists "Admin Full Access" on public.news_updates;
drop policy if exists "Admin Full Access" on public.parent_marker;
drop policy if exists "Admin Full Access" on public.project_banks;
drop policy if exists "Allow authenticated deletes on project_banks" on public.project_banks;
drop policy if exists "Allow authenticated inserts on project_banks" on public.project_banks;
drop policy if exists "Admin Full Access" on public.project_table;
drop policy if exists "Admin Full Access" on public.project_tag;
drop policy if exists "Allow full access for authenticated users" on public.promotions;
drop policy if exists "Admin Full Access" on public.tags;
drop policy if exists "Admin Full Access" on public.unit_layout;
drop policy if exists "Allow admin full access on virtual_tours" on public.virtual_tours;

-- Published-only reads. Existing CMS hidden reads now use authorized server paths.
drop policy if exists "Allow public read on banks" on public.banks;
drop policy if exists "Public Read" on public.banks;
drop policy if exists gt_public_banks_read on public.banks;
create policy gt_public_banks_read on public.banks for select to anon, authenticated
  using (is_active = true and is_archived is null);
drop policy if exists "Public Read" on public.news_updates;
drop policy if exists gt_public_news_read on public.news_updates;
create policy gt_public_news_read on public.news_updates for select to anon, authenticated
  using (is_active = true and is_archived is null);
drop policy if exists "Allow public read access on virtual_tours" on public.virtual_tours;
drop policy if exists gt_public_tours_read on public.virtual_tours;
create policy gt_public_tours_read on public.virtual_tours for select to anon, authenticated
  using (status = 'Active' and exists (select 1 from public.project_table p
    where p.id = virtual_tours.project_id and p.is_active = true and p.deleted_at is null));

-- Child-table RLS does not inherit parent visibility automatically. The verified
-- project_id FKs support explicit published-project checks on direct reads too.
drop policy if exists "Public Read" on public.amenities;
drop policy if exists gt_public_amenities_read on public.amenities;
create policy gt_public_amenities_read on public.amenities for select to anon, authenticated
  using (exists (select 1 from public.project_table p where p.id = amenities.project_id and p.is_active = true and p.deleted_at is null));
drop policy if exists "Public Read" on public.child_marker_table;
drop policy if exists gt_public_child_markers_read on public.child_marker_table;
create policy gt_public_child_markers_read on public.child_marker_table for select to anon, authenticated
  using (exists (select 1 from public.project_table p where p.id = child_marker_table.project_id and p.is_active = true and p.deleted_at is null));
drop policy if exists "Public Read" on public.extended_description;
drop policy if exists gt_public_project_description_read on public.extended_description;
create policy gt_public_project_description_read on public.extended_description for select to anon, authenticated
  using (exists (select 1 from public.project_table p where p.id = extended_description.project_id and p.is_active = true and p.deleted_at is null));
drop policy if exists "Public Read" on public.parent_marker;
drop policy if exists gt_public_parent_markers_read on public.parent_marker;
create policy gt_public_parent_markers_read on public.parent_marker for select to anon, authenticated
  using (exists (select 1 from public.project_table p where p.id = parent_marker.project_id and p.is_active = true and p.deleted_at is null));
drop policy if exists "Public Read" on public.project_tag;
drop policy if exists gt_public_project_tags_read on public.project_tag;
create policy gt_public_project_tags_read on public.project_tag for select to anon, authenticated
  using (exists (select 1 from public.project_table p where p.id = project_tag.project_id and p.is_active = true and p.deleted_at is null));
drop policy if exists "Public Read" on public.unit_layout;
drop policy if exists gt_public_unit_layout_read on public.unit_layout;
create policy gt_public_unit_layout_read on public.unit_layout for select to anon, authenticated
  using (exists (select 1 from public.project_table p where p.id = unit_layout.project_id and p.is_active = true and p.deleted_at is null));
drop policy if exists "Public Read" on public.marker_type_table;
drop policy if exists gt_public_marker_types_read on public.marker_type_table;
create policy gt_public_marker_types_read on public.marker_type_table for select to anon, authenticated
  using (exists (select 1 from public.child_marker_table c join public.project_table p on p.id = c.project_id
    where c.id = marker_type_table.child_marker_id and p.is_active = true and p.deleted_at is null));
drop policy if exists "Allow public read on project_banks" on public.project_banks;
drop policy if exists "Public Read" on public.project_banks;
drop policy if exists gt_public_project_banks_read on public.project_banks;
create policy gt_public_project_banks_read on public.project_banks for select to anon, authenticated
  using (exists (select 1 from public.project_table p where p.id = project_banks.project_id and p.is_active = true and p.deleted_at is null)
    and exists (select 1 from public.banks b where b.id = project_banks.banks_id and b.is_active = true and b.is_archived is null));
-- Shared tags and module flags remain readable; navbar requires inactive flags.

do $cms_acl$
declare
  target text;
  column_record record;
  browser_role text;
  privilege_name text;
begin
  foreach target in array array[
    'amenities','banks','child_marker_table','extended_description','marker_type_table',
    'modules','news_updates','parent_marker','project_banks','project_table',
    'project_tag','promotions','tags','unit_layout','virtual_tours'
  ] loop
    execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from public, anon, authenticated', target);
    if current_setting('server_version_num')::integer >= 170000 then
      execute format('revoke maintain on table public.%I from public, anon, authenticated', target);
    end if;
    for column_record in select a.attname from pg_attribute a
      where a.attrelid = format('public.%I', target)::regclass and a.attnum > 0 and not a.attisdropped
    loop
      execute format('revoke insert (%I), update (%I), references (%I) on table public.%I from public, anon, authenticated',
        column_record.attname, column_record.attname, column_record.attname, target);
    end loop;
    if target = 'modules' then
      execute format('grant select, update on table public.%I to service_role', target);
    elsif target in ('banks', 'promotions', 'virtual_tours') then
      execute format('grant select, insert, update on table public.%I to service_role', target);
    else
      execute format('grant select, insert, update, delete on table public.%I to service_role', target);
    end if;
    foreach browser_role in array array['anon','authenticated'] loop
      foreach privilege_name in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(browser_role, format('public.%I', target), privilege_name) then
          raise exception 'Residual CMS mutation grant: % % %', browser_role, target, privilege_name;
        end if;
        if privilege_name in ('INSERT','UPDATE','REFERENCES') and
          has_any_column_privilege(browser_role, format('public.%I', target), privilege_name) then
          raise exception 'Residual CMS column grant: % % %', browser_role, target, privilege_name;
        end if;
      end loop;
      if current_setting('server_version_num')::integer >= 170000 then
        if has_table_privilege(browser_role, format('public.%I', target), 'MAINTAIN') then
          raise exception 'Residual CMS MAINTAIN grant';
        end if;
      end if;
    end loop;
    if exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = target and cmd <> 'SELECT') then
      raise exception 'Unexpected CMS mutation policy on %: refresh metadata', target;
    end if;
  end loop;
end
$cms_acl$;

commit;
