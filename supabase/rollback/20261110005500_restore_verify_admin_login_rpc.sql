-- MANUAL ROLLBACK ONLY / NOT EXECUTED. Never include in automatic migration runs.
-- WARNING: rollback REOPENS the privileged password-checking RPC to PUBLIC,
-- anon and authenticated, restoring the security exposure. Require explicit
-- operator approval and a demonstrated dependency before using this recovery.
-- Restore only the operator-verified original EXECUTE recipients. This is not a
-- reconstruction of unspecified original ACL grantors or grant options.
-- The forward migration leaves postgres access, body, owner and settings intact.
begin;

do $check_rollback_target$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_roles r on r.oid = p.proowner
    where p.oid = pg_catalog.to_regprocedure('public.verify_admin_login(text,text)')
      and p.prokind = 'f' and p.prosecdef and r.rolname = 'postgres'
  ) then
    raise exception 'Expected verify_admin_login signature/owner/security context missing';
  end if;
end
$check_rollback_target$;

grant execute on function public.verify_admin_login(text, text)
  to public, postgres, anon, authenticated, service_role;

commit;
