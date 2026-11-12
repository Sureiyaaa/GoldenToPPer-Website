# Phase 1.6B — verified metadata reconciliation

Phase 1.6C supersedes export-related gaps below: see
[security-hardening-phase-1.6c.md](security-hardening-phase-1.6c.md) for the seven
actual CSVs, 38 exact policy removals, published-only replacements and remaining
scope. This Phase 1.6B report is retained as historical evidence.

Date: 2026-11-10. Status: local preparation only; no SQL executed, migration
applied, production probe, record retrieval or deployment. No Privacy & Consent
feature was implemented.

## 1. Evidence and confirmed vulnerabilities

The latest user-supplied metadata establishes these exact RPC signatures, their
postgres owner, SECURITY DEFINER mode and effective role execution. No function
definitions or full table/policy/default-ACL exports were present in the workspace.
The user could not identify an export location. Therefore the summary is accepted
as supplied evidence, not described as an independently queried database result.

| Priority | Finding | Evidence and limit |
| --- | --- | --- |
| Urgent/high, potentially critical | anon/authenticated can execute create_admin_user and update_admin_user as postgres-owned definers | Verified in supplied metadata; internal authorization and successful exploitation remain unknown |
| Critical confidentiality configuration | Prior supplied unrestricted admin_users SELECT includes a table containing credential hashes | Prior supplied grants/policy; deployed API reachability and exposure history still unverified |
| High integrity configuration | Prior supplied unrestricted navbar_projects/our story UPDATE and broad authenticated module_access writes | Prior metadata summary; exact policy names and expressions remain unavailable |
| High integrity configuration | Prior supplied public customer INSERT may bypass actions | Conflicts with local 20261103000000 hardening intent; do not infer actual deployment from filenames |
| Medium | Prior public read-state policies; dormant audit SELECT policy | Read-state grants need export; audit grants reportedly deny browser SELECT already |
| Future-object risk | Broad postgres/supabase_admin defaults in public for anon/authenticated | Newly supplied pg_default_acl summary; exact global rows/grantors not available |
| Deployment risk | Only 20261104060532 and 20261104061451 are tracked remotely | Versions do not match any local migration filename |

SECURITY DEFINER executes with the owner's privileges. Table grants/RLS alone do
not constrain the caller to the application's Server Action checks. Whether RLS
applies inside a function also depends on owner privileges, ownership of accessed
tables and FORCE RLS. Do not label an uninspected body safe or declare proven
account takeover. See [PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html).

## 2. Urgent containment and exact prepared SQL

New independently reviewable file:
`supabase/migrations/20261110005000_restrict_admin_rpc_execution.sql`.

It performs, in a transaction:

```sql
revoke execute on function public.create_admin_user(text, text, boolean, integer)
  from public, anon, authenticated;
revoke execute on function public.update_admin_user(uuid, boolean, integer, text)
  from public, anon, authenticated;
revoke execute on function public.remove_audit_log_entry(bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.create_admin_user(text, text, boolean, integer) to service_role;
grant execute on function public.update_admin_user(uuid, boolean, integer, text) to service_role;
grant execute on function public.remove_audit_log_entry(bigint, text, text) to service_role;
```

Preconditions assert the three exact overloads exist, are postgres-owned and are
SECURITY DEFINER. Postconditions assert effective denial for anon/authenticated
and execution for service_role, detecting inherited/residual execution. PUBLIC
revocation removes the pseudo-role route. No function body, owner, search_path,
argument type, return type or table record is changed. Do not use CASCADE to bypass
unexpected dependency/ACL errors; investigate and abort instead.

Prioritize a separately approved containment review rather than waiting for the
entire consent project. Do not run a broad migration push to apply this file: the
history drift must be handled explicitly. Preserve the audit function's existing
service-only intent. Investigate historical exposure using metadata/logs without
retrieving credential hashes; credential/session response depends on that review.

## 3. Function-level assessment and legitimate callers

| Function | Supplied effective EXECUTE | Legitimate local caller | Remaining body review |
| --- | --- | --- | --- |
| create_admin_user(text,text,boolean,integer) | anon/authenticated/service_role | app/actions/user.ts:createUserAction, requireSuperAdmin before service-role rpc | Validation, hashing, uniqueness, authorization, error/return payloads, dependencies, search_path unknown |
| update_admin_user(uuid,boolean,integer,text) | anon/authenticated/service_role | app/actions/user.ts:updateUserAction, requireSuperAdmin before service-role rpc | Validation, privilege changes, password updates, self/last-super-admin protections and search_path unknown |
| remove_audit_log_entry(bigint,text,text) | service_role; anon/authenticated denied | app/actions/admin_fetchers.ts:deleteAuditLogAction, verified custom session and super-admin, server-derived actor | Audit preservation/atomicity, validation, dependent writes and search_path unknown |

No SQL definitions were located in local migrations or application source. The
Server Action wrappers use the service-role key on the server and do not authorize
ordinary Supabase authenticated users. Their existence does not protect direct RPC
calls under today's grants. Account action payloads still rely on any unverified
database validation plus UI checks; this phase does not claim full input safety.

Use `supabase/inspection/phase-1.6b-metadata.sql` for a reviewed **read-only** export
of exact overloads, owners, proconfig search_path, argument names, ACLs, effective
privileges, policies, column grants, inheritance, defaults and migration versions.
It has not been executed. Definitions require a separate secure local inspection:

```sql
select pg_get_functiondef('public.create_admin_user(text,text,boolean,integer)'::regprocedure);
select pg_get_functiondef('public.update_admin_user(uuid,boolean,integer,text)'::regprocedure);
select pg_get_functiondef('public.remove_audit_log_entry(bigint,text,text)'::regprocedure);
```

Do not paste/store raw definitions in chat, logs or the repository if they contain
secrets or credentials. Supply redacted findings. Inspect dynamic SQL, fully
qualified objects, trusted schemas, temporary-schema resolution, authorization,
null/invalid arguments, privilege assignment and returned/logged sensitive fields.
Do not set search_path blindly: bodies and dependencies must first be understood.

## 4. Table grants, policies and application compatibility

Existing `20261110010000_harden_cms_browser_grants.sql` retains its grant-layer
changes and now references the separate RPC/default files. It covers sensitive
table/column revocations, content mutation revocations, explicit service operations
and effective anon/authenticated table/column assertions. It preserves RLS and
current public reads. It does not claim removal of unsafe policies without names.

| Objects | Browser target | Legitimate path |
| --- | --- | --- |
| admin_users/groups/module_access | No base-table access | app/actions/admin-access.ts reads with admin_manage.can_view; user/permission writes require super-admin |
| navbar_projects | Published SELECT only; no mutation | Public app/components/navbar.tsx; administrator hidden reads/save/order through admin-access.ts and existing project actions |
| our story | Active/nonarchived SELECT only; no mutation | Public app/story/page.tsx; Story actions enforce view/create/edit separately |
| admin_contact_reads/admin_inquire_reads/admin_loan_preapp_reads | No browser access | requireNotificationAccess, session-derived administrator ID, service-role joins/upserts/deletes |
| audit_logs | No browser access | Permission-checked reads, server inserts, restricted removal RPC |
| client/contact/inquire/loan_preapp | No browser DML | Public form Server Actions; authorized server Inbox/detail reads |

The published-only rows above are the target, not a newly verified policy state.
Exact policy cleanup/public SELECT predicates remain blocked on the actual export.
Remove reviewed permissive/ALL policies; adding a narrower permissive policy does
not cancel an existing broad one. Column-level grants are explicitly revoked by
the existing migration. Its effective-privilege assertions catch inherited table
access; function and role metadata review is still required.

The affected browser sensitive reads/navigation writes were removed in Phase 1.6;
code searches confirm the dashboard only names navbar_projects for the already
authorized visibility action. Public navbar/Story code is unchanged. The separate
SystemModulesManager and browser Storage uploads are outside this migration's
grant scope and remain separate review items. No blanket schema lockdown is safe.

## 5. Future defaults — scoped strategy

New file: `20261110020000_scope_public_default_privileges.sql`.

For exactly **postgres** and **supabase_admin**, and exactly **IN SCHEMA public**,
it revokes default table/sequence privileges and function EXECUTE from PUBLIC,
anon and authenticated. Existing objects and service_role defaults are unchanged.
No global defaults or managed schemas are altered. Confirm the executing role is
authorized to change both creators' defaults; do not grant extra membership as a
workaround. Migration failure must roll back the transaction.

This cannot cancel global grants, including PostgreSQL's built-in PUBLIC EXECUTE
default for new functions. Every application object's creation transaction must
therefore explicitly revoke unwanted privileges, enable table RLS, grant approved
operations and assert effective roles. Future public legal content needs a narrow
published projection; drafts and evidence remain server-only. Table grants alone
do not grant sequence/RPC access. Exact global ACLs and grantors remain required
before declaring future defaults safe. See [PostgreSQL default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html).

## 6. Migration-history reconciliation

Remote versions supplied: **20261104060532**, **20261104061451**. Neither exists in
the local directory. Local versions:

```text
20261007000000  loan read-state table
20261014000000  payment carousel structure
20261014010000  payment carousel seed
20261016000000  article content
20261016010000  article layout
20261016020000  article sections
20261019000000  news cover visibility
20261103000000  customer/project access hardening
20261110000000  amenity disclaimers
20261110005000  NEW RPC containment (unapplied)
20261110010000  Phase 1.6 browser grants (unapplied)
20261110020000  NEW scoped defaults (unapplied)
```

This confirms a mismatch, not that older schema changes are absent. Possible
causes include manual SQL, different deployment branches, renamed/squashed history
or another project. None is proven. Obtain target project/environment identity,
remote migration names and securely reviewed statements, actual schema/constraints/
triggers/policies/defaults, and repository/deployment history. Compare each local
migration's intended effects before deciding any history repair.

Do not replay baseline DDL or seed scripts, edit applied history, mark versions
applied, run migration repair, or blindly push this directory. Prepare a reviewed
forward-only adoption plan based on actual effects. None was executed here.

## 7. Regression reconciliation

Baseline commit: **9c63d487e958d8d6b2e0dc6e9ef717780aa40b76**. The baseline runner
reads committed sources with git show without checking out/overwriting working
files. It also restores committed test fixtures for comparisons.

Commands:

```text
node scripts/run-security-regression-baseline.cjs
node scripts/run-security-regression-baseline.cjs tests/customer-inbox-scroll.test.cjs
```

The first reproduced **17 pass / 11 fail**; the second reproduced the Inbox EPERM
failure. Thus all 12 previously reported failures occur against committed source.

| Failures | Confirmed cause | Repair |
| --- | --- | --- |
| 10 project tests | auth mock lacks getRBACProfile already used by projects.ts | Model the existing session/RBAC dependency; retain every behavior assertion and add denial-before-DB coverage |
| 1 News test | synthetic form values omit required article_layout | Supply the valid layout and add invalid-layout rejection; leave production schema unchanged |
| 1 Inbox browser test | existing .cache/inbox-scroll loader is unwritable; even a fresh child directory under .cache is denied | Generate fixture in OS temp with explicit dependency resolution and bounded fixture serving; keep all geometry/accessibility assertions |

After repairs: project/News/security/Inbox unit tests **55/55 passed**; RPC wrapper
and SQL-scope checks **4/4 passed**; Inbox browser fixture **1/1 passed** including
desktop/mobile geometry, keyboard, scrolling, filters and refresh boundaries.
No application logic, permission gate or assertion was weakened to obtain a pass.
Final full-suite rerun (`node --test tests/*.test.cjs`): **133 passed, 0 failed,
0 skipped**, including isolated browser fixtures. TypeScript
(`node node_modules/typescript/bin/tsc --noEmit --incremental false`) passed.
`git diff --check` passed with only Git line-ending conversion notices. The
previously identified ESLint configuration/dependency failure is unchanged and
was not rerun because no lint configuration or application code changed here.

SQL checks inspect prepared text; mock RPC tests test application authorization
and argument routing only. Neither executes SQL nor proves database privileges.
Live CAPTCHA/login, actual database/RPC operations, credential review and staging
authorization tests remain unexecuted. No production build was used to probe data.

## 8. Staging verification checklist

1. Identify an isolated authorized staging project and snapshot metadata/ACLs.
2. Reconcile history before selecting individual reviewed forward changes. Verify
   exact RPC owner/security/signature preconditions without invoking them.
3. Deploy the Phase 1.6 application replacements to staging before table lockdown.
4. Review/apply RPC containment there, then verify effective denied EXECUTE for
   anon/authenticated and retained service_role execution. Enumerate other
   overloads/alternate functions. No real administrator hashes or customer rows.
5. With synthetic accounts, verify super-admin account creation/update/removal
   wrappers succeed and non-super-admin/missing/expired sessions fail. Verify
   normal Supabase JWTs do not grant CMS permissions. Use synthetic rows only for
   negative direct RPC tests; inspect state as well as HTTP status.
6. Apply reviewed table changes; verify login, Users & Access, departments,
   hidden navbar editing/order, public navbar/Story, Story flags, Inbox/read-state,
   audit views and inquiry/contact/loan paths. Assert direct browser denials.
7. Complete policy cleanup from exported names. Check hidden/archived public
   content and alternate views/functions; query filters are not authorization.
8. Review scoped defaults under each actual creator; create temporary synthetic
   objects only in staging to test effective future grants. Check global rows,
   PUBLIC function execution, tooling regrants, and required service grants.
9. Re-export effective ACL/policy/default state after migration tooling completes,
   document approvals and test rollback in staging before production approval.

## 9. Rollback requirements

Snapshot exact pre-change function/table/column/schema/sequence/default ACLs,
grantors/grant options, policies and relevant role membership. Review inverse SQL
for that specific target; it cannot be reconstructed from the summary. These
changes preserve function definitions and data, so no data restore is planned.

Transaction failure rolls back that file; separate migration files are not one
transaction. After commit, use a compensating migration and verify the resulting
effective permissions. Do not restore public admin RPC execution or hash access
to repair a UI issue. Prefer a server-path fix or temporarily disabling account
management. Preserve application replacements; rolling back to browser-write code
against denied grants breaks compatibility. Roll back default ACLs by exact scope
and creator, never blanket GRANT ALL or global ACL changes. No rollback ran here.

## 10. Staging readiness decision

**Ready for an isolated, approved containment rehearsal after target metadata and
rollback capture; not ready for an unrestricted migration push or production.**

Exact three-RPC containment is prepared and preserves the locally confirmed
service-role callers. Full security sign-off remains blocked on body/search_path
review, complete policy/ACL/default exports, history adoption, and actual database
positive/negative tests. Application fixture regressions have been investigated
against the baseline and repaired. Privacy & Consent work remains deferred.
