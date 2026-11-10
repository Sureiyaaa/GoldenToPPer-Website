-- REVIEW ONLY / UNAPPLIED. Independently review this urgent containment subset.
-- Signatures, postgres ownership and SECURITY DEFINER status were supplied in
-- Phase 1.6B. Bodies/search_path remain unverified; no function is redefined.
-- Phase 1.6C: signatures/owners/security/EXECUTE flags independently reconciled
-- with supplied 05_privileged_rpc_execute.csv; all three match this migration.
-- Reconcile remote migration history before using any migration runner.
-- Snapshot function ACLs (including grantors) and prepare reviewed rollback first.
begin;

-- The CSV lists three overloads. An unexpected overload is a release blocker,
-- not a reason to silently leave an alternate privileged entry point open.
do $overload_inventory$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_admin_user', 'update_admin_user', 'remove_audit_log_entry'
    ) and p.oid not in (
      coalesce(to_regprocedure('public.create_admin_user(text,text,boolean,integer)')::oid, 0),
      coalesce(to_regprocedure('public.update_admin_user(uuid,boolean,integer,text)')::oid, 0),
      coalesce(to_regprocedure('public.remove_audit_log_entry(bigint,text,text)')::oid, 0)
    )
  ) then
    raise exception 'Unreviewed administrator/audit overload: inspect metadata before containment';
  end if;
end
$overload_inventory$;

do $check_functions$
declare
  signature text;
  target oid;
begin
  foreach signature in array array[
    'public.create_admin_user(text,text,boolean,integer)',
    'public.update_admin_user(uuid,boolean,integer,text)',
    'public.remove_audit_log_entry(bigint,text,text)'
  ] loop
    target := to_regprocedure(signature);
    if target is null then
      raise exception 'Expected RPC missing: %', signature;
    end if;
    if not exists (
      select 1 from pg_proc p join pg_roles r on r.oid = p.proowner
      where p.oid = target and p.prosecdef and r.rolname = 'postgres'
    ) then
      raise exception 'RPC owner/security context differs from reviewed metadata: %', signature;
    end if;
  end loop;
end
$check_functions$;

-- PUBLIC is the pseudo-role, not the public schema. Its EXECUTE grant can
-- otherwise keep anon/authenticated access alive after their direct revocation.
revoke execute on function public.create_admin_user(text, text, boolean, integer)
  from public, anon, authenticated;
revoke execute on function public.update_admin_user(uuid, boolean, integer, text)
  from public, anon, authenticated;
revoke execute on function public.remove_audit_log_entry(bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.create_admin_user(text, text, boolean, integer) to service_role;
grant execute on function public.update_admin_user(uuid, boolean, integer, text) to service_role;
grant execute on function public.remove_audit_log_entry(bigint, text, text) to service_role;

do $verify_functions$
declare
  signature text;
  role_name text;
begin
  foreach signature in array array[
    'public.create_admin_user(text,text,boolean,integer)',
    'public.update_admin_user(uuid,boolean,integer,text)',
    'public.remove_audit_log_entry(bigint,text,text)'
  ] loop
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_function_privilege(role_name, signature, 'EXECUTE') then
        raise exception 'Inherited or residual RPC access for % on %', role_name, signature;
      end if;
    end loop;
    if not has_function_privilege('service_role', signature, 'EXECUTE') then
      raise exception 'Missing service_role execution on %', signature;
    end if;
  end loop;
end
$verify_functions$;

commit;
