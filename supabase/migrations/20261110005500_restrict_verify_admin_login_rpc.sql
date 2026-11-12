-- REVIEW ONLY / UNAPPLIED. Exact production signature/owner/definer status and
-- absence of overloads confirmed by the operator. Application login uses bcrypt
-- in a server action and does not call this RPC.
-- ACL-only containment: do not change the body, owner or function settings.
-- Capture the original raw ACL (grantors/options included) before execution.
begin;

do $check_verify_admin_login$
declare
  target oid := pg_catalog.to_regprocedure('public.verify_admin_login(text,text)');
begin
  if target is null then
    raise exception 'Expected public.verify_admin_login(text,text) missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_roles r on r.oid = p.proowner
    where p.oid = target and p.prokind = 'f'
      and p.prosecdef and r.rolname = 'postgres'
  ) then
    raise exception 'verify_admin_login owner/security context differs from reviewed metadata';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'verify_admin_login'
      and p.oid <> target
  ) then
    raise exception 'Unreviewed verify_admin_login overload: inspect metadata before containment';
  end if;
end
$check_verify_admin_login$;

-- PUBLIC is the pseudo-role. Revoke its grant as well as the direct role grants.
revoke execute on function public.verify_admin_login(text, text)
  from public, anon, authenticated;
grant execute on function public.verify_admin_login(text, text) to service_role;

do $verify_login_rpc_acl$
declare
  signature text := 'public.verify_admin_login(text,text)';
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if pg_catalog.has_function_privilege(role_name, signature, 'EXECUTE') then
      raise exception 'Inherited or residual verify_admin_login execution for %', role_name;
    end if;
  end loop;
  if not pg_catalog.has_function_privilege('service_role', signature, 'EXECUTE') then
    raise exception 'Missing service_role execution on verify_admin_login';
  end if;
end
$verify_login_rpc_acl$;

commit;
