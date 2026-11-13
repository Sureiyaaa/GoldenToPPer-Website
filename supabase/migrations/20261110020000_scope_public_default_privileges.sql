-- REVIEW ONLY / UNAPPLIED. Execution scope: postgres-owned defaults only.
-- Phase 1.6C evidence includes postgres and supabase_admin public-schema defaults.
-- The executing postgres role can manage only its own defaults. supabase_admin
-- defaults are DEFERRED security work requiring an already-authorized operator;
-- do not grant additional role memberships or elevated permissions to run them.
-- Non-public entries (storage/extensions/graphql/graphql_public/realtime/auth)
-- are untouched. Limit changes to postgres public-schema ACLs. No global default
-- or Supabase-managed schema changes. This affects FUTURE objects only.
-- Prerequisite: capture pg_default_acl (including global rows/grantors), role
-- membership and creator tooling. Execution may require an authorized owner;
-- do not grant extra role membership to make this migration succeed.
begin;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

do $verify_scoped_defaults$
begin
  if exists (
    select 1 from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where n.nspname = 'public'
      and d.defaclrole = 'postgres'::regrole
      and d.defaclobjtype in ('r', 'S', 'f')
      and a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)
  ) then
    raise exception 'Residual postgres public-schema defaults for browser/PUBLIC roles: review grantors';
  end if;
end
$verify_scoped_defaults$;

-- IMPORTANT: per-schema REVOKE cannot cancel global grants or the built-in
-- PUBLIC EXECUTE default for newly created functions. Global ACL rows were not
-- supplied and are deliberately not changed. Every new application function
-- MUST revoke PUBLIC/anon/authenticated EXECUTE and grant approved roles in the
-- same creation transaction. Each new table/sequence likewise needs explicit
-- ACLs, RLS and role assertions. Keep service_role defaults unchanged; grant
-- service_role explicitly per object instead of depending on defaults.
-- This scoped migration alone is NOT proof of effective safe future defaults.

commit;
