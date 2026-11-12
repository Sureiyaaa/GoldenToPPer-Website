# Phase 1.6 — implementation and deployment review

Latest reconciliation: [Phase 1.6C](security-hardening-phase-1.6c.md) uses the actual
seven CSV exports and finalizes the targeted policy changes. Earlier results and
metadata gaps below are historical where superseded.

**Phase 1.6B reconciliation:** see [security-hardening-phase-1.6b.md](security-hardening-phase-1.6b.md)
for newly supplied RPC signatures/ACLs, scoped default-privilege changes, confirmed
baseline test failures and their fixture repairs. Both reports describe unapplied
SQL. The original verification results below are historical, not the latest run.

Status: local application changes and a **partial, unapplied** grant-layer migration.
No database requests, migrations, deployments, or production authorization tests
were performed. Privacy & Consent Management is not implemented.

## Application changes

`app/actions/admin-access.ts` introduces:

- `fetchUsersAccessAction`: `admin_manage.can_view` or SUPER_ADMIN; explicit user,
  department and module projections. No password/hash selection.
- `fetchDepartmentPermissionsAction`: same authorization; validated group ID and
  explicit permission projection.
- `fetchAdminNavigationAction`: `edit_project.can_view` or SUPER_ADMIN; returns
  hidden navigation/project state through a service-role query, excluding deleted
  projects. Uses explicit columns.
- `saveNavigationAction`: `edit_project.can_edit` or SUPER_ADMIN; strict field
  allowlist, positive safe integer ID, trimmed bounded text, Boolean visibility,
  and HTTPS/local image validation. Detects missing/failed updates.
- `saveNavigationOrderAction`: same edit permission; validates nonempty, unique
  safe IDs and verifies records before updating only display_order. No upsert.

Both read permissions derive from `getRBACProfile`, which validates the signed
custom CMS session, active account and group; a Supabase authenticated identity
alone grants no CMS access. Existing account/permission mutations still require
`requireSuperAdmin`. Users with `admin_manage.can_view` retain read-only access;
management writes remain super-admin-only.

`app/admin/users/page.tsx` uses these actions instead of browser reads of
admin_users/groups/module_access/modules. `app/admin/dashboard/page.tsx` routes
navigation reads, edits and ordering through the actions. Its browser client is
retained for existing Storage uploads. The existing navigation visibility toggle
already uses `toggleActiveStatus`, which authorizes the edit_project module.
Public navbar queries were not changed.

`app/actions/admin_fetchers.ts` now checks our_story.can_view for list/edit reads,
can_create for creation, and can_edit for updates (with SUPER_ADMIN bypass).
Story save accepts only year/title/description/image, validates four-digit years,
bounded nonempty text, and HTTPS/local image paths, rejects unexpected fields and
invalid IDs, and detects missing/failed updates. New records preserve the existing
is_active=true behavior. Public Story code is unchanged.

Reused infrastructure: custom session/getRBACProfile/getCurrentUser, service-role
Supabase access, existing visibility action, archive/restore controls and audit
calls. No new authentication system or client-side service credential was added.

## Database migration and intentional gaps

Prepared: `supabase/migrations/20261110010000_harden_cms_browser_grants.sql`.

It revokes PUBLIC/anon/authenticated table and column access to administrator,
group, permission, inbox read-state, audit and customer tables; revokes browser
navigation/Story writes while retaining their current public SELECT; explicitly
preserves required service-role operations; and asserts effective denied table
and column privileges for anon/authenticated before commit. It does not delete
data, change columns, disable RLS, change Storage, or alter unrelated tables.

Reviewed existing migrations:

- 20261007000000_add_admin_loan_preapp_reads.sql: service-role read tracking.
- 20261014000000_add_payment_carousel_slides.sql: service-role carousel access.
- 20261103000000_harden_customer_and_project_access.sql: already denies browser
  customer DML and narrows project reads. Supplied customer INSERT access conflicts
  with its intended result; reconcile migration/environment drift before rollout.

The following are **UNIMPLEMENTED**, not silently assumed safe:

1. Unsafe policy removal: exact policy names, roles, command, permissiveness,
   USING and WITH CHECK expressions were not supplied or checked into the repo.
   Do not guess names or drop policies with an unbounded catalog loop.
2. Phase 1.6B now supplies exact signatures, postgres ownership, SECURITY DEFINER
   status and effective execution for the three RPCs. A separate unapplied
   20261110005000 migration restricts execution. Bodies, search_path, complete ACL
   grantors, other overloads and alternate invocation paths remain unverified.
3. Phase 1.6B confirms postgres/supabase_admin public-schema default grants. The
   separate unapplied 20261110020000 migration scopes revocations to these roles
   in public. Global ACLs and exact grantors remain unavailable. New legal tables
   must deny browser access by default and explicitly grant required service-role
   table/sequence access; only published content may receive public SELECT.
4. Narrower public content policies/projections: current public SELECT is kept to
   avoid breaking pages. Confirm policies actually exclude hidden/archived rows;
   query filters alone do not enforce that restriction.

The migration's grant denial prevents direct access even while dormant policies
remain, but is not protection against privileged functions or later regranting.
Do not call it complete database remediation. Do not apply until the metadata
snapshot, inverse SQL and staging validation are reviewed.

## Required metadata (no table records)

Obtain through an authorized metadata-only review:

- Data API enabled status, exposed schemas, automatic new-table exposure settings.
  The app expects public through .from(), but no config.toml/settings export
  confirms the deployed setting. Do not disable Data API/public: service-role
  .from() also depends on it.
- pg_policies entries for every affected table, including ALL/mixed-role policies.
- Table/column/schema/sequence ACLs and owners; effective role inheritance and
  BYPASSRLS/superuser attributes; RLS/FORCE RLS flags; object-creator roles.
- pg_default_acl at both global and schema scopes for each creator. Global grants
  cannot be cancelled by schema-level default revokes.
- Function metadata above, related views/triggers and SECURITY DEFINER paths.
- Sequence ownership/default dependencies and service-role privileges used by
  inserts and RPCs. This migration intentionally leaves sequences/RPC ACLs alone.
- Applied migration history for the actual target project/environment.

No customer rows, administrator hashes, environment values or secret keys are
needed. Capture definitions/ACLs, not table data.

## Local verification

`tests/security-hardening.test.cjs` executes production actions against synthetic
database/auth doubles and tests real custom-session verification with synthetic
signed cookies. It covers denial before DB access, permission-specific reads and
writes, projections, payload injection, duplicate/invalid order IDs, missing rows,
DB failures, and forged/expired/inactive sessions. These are application tests,
not proof of effective PostgreSQL authorization.

Executed:

- `node --test tests/security-hardening.test.cjs`: 9 tests passed in the initial
  targeted run.
- Targeted security/inbox/loan/payment/project-creation run: 50 passed, 10 failed.
  All new security tests and inbox/loan/payment tests passed. Project-creation
  failures arise in unchanged test/code: its auth mock lacks getRBACProfile used
  by existing projects.ts authorization. No unrelated test fixtures were changed.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- `git diff --check`: passed.
- Targeted ESLint: blocked by existing eslint.config.mjs dependency resolution:
  eslint-config-next/core-web-vitals cannot be imported. No dependencies changed.

Full suite (`node --test tests/*.test.cjs`) completed with failures in three
unchanged areas: the 10 project-creation mock failures above, a News form-validation
assertion, and an Inbox scroll fixture unable to open its .cache loader (EPERM).
The new security suite passed. Existing News isolated browser fixtures also ran;
their successes do not constitute a live CMS smoke test. These unrelated test
failures and the lint configuration issue remain unresolved in this scoped change.

Not executed: live login/Turnstile, interactive CMS browser smoke tests, production
build/prerender (may read configured databases), SQL application, database ACL
tests, RPC invocation or staging authorization tests. No isolated staging project
was identified and authorized; no production services were probed.

## Staging acceptance checklist

Use synthetic records and separate test accounts. Run only in an isolated,
explicitly authorized staging environment after snapshotting metadata.

| Surface | Positive test | Negative test |
| --- | --- | --- |
| Login | Valid synthetic admin + CAPTCHA signs in | Forged/expired cookie and inactive admin denied |
| Users & Access | Permitted viewer sees explicit metadata | No session/unrelated module denied; no hash projection |
| Departments | Viewer reads; super-admin saves | Viewer and ordinary Supabase JWT cannot write permissions |
| Navbar CMS | Editor saves title/tagline/logo/visibility and order, sees hidden projects | Viewer cannot mutate; injection/invalid IDs rejected |
| Public navbar | Published entries render with project joins | Direct browser updates denied; hidden data checked independently |
| Story CMS | Create/edit according to separate flags | Wrong module/flag and privileged payload fields denied |
| Public Story | Active nonarchived content renders | Public UPDATE denied; hidden/archived reads checked |
| Inbox | Authorized list/details and own read/unread succeed | Unrelated admins denied; cannot forge another admin ID |
| Inquiry/contact/loan | Valid synthetic submissions through actions persist | Direct anon/authenticated table writes denied |
| Audit | Authorized server reads/writes work | Direct anon/authenticated reads and privileged RPCs denied |

Also verify column grants, alternate functions/views, every privileged RPC
overload, inherited privileges and sequence dependencies. Assert unchanged rows
for denied mutations, not just response status: RLS may return zero affected rows.
Verify safe grants on newly created synthetic objects after default ACL changes.
Re-run metadata assertions after all migrations and deployment tooling finish.

## Deployment and rollback instructions (review only)

1. Obtain missing metadata, prepare exact policy/RPC/default-ACL follow-up changes,
   and create a reviewed inverse from the target ACL/policy snapshot. Do not edit
   applied migration history. Confirm this migration timestamp is unused.
2. In staging, deploy the application replacements before restricting grants.
   Verify actual reads/writes, permission changes and session revocation.
3. Apply the reviewed migration and approved metadata-dependent follow-ups only
   in staging. Run all positive/negative tests. Review ACLs and Data API settings.
4. Approve production separately; this task does not authorize deployment or SQL.
5. A failed transaction rolls back automatically. After commit, use a compensating
   migration built from the captured snapshot. Restore only reviewed required
   permissions. Prefer disabling a broken management feature or fixing its server
   path to reopening credential access/public writes.
6. Do not redeploy older browser-write code against hardened grants. Revalidate
   app/database compatibility after any rollback. No blanket GRANT ALL rollback.

## Remaining compatibility/security limits

- Navigation reordering still uses multiple update requests, matching the previous
  persistence model. It is not atomic; a failure can leave a partial order. The
  action reports this explicitly; reload before retry. A transactional RPC needs
  verified schema/function design in a later change.
- Navigation/Story audit calls remain separate from mutations and are not an
  immutable transactional ledger. Do not reuse that guarantee for consent evidence.
- Image uploads remain browser Storage operations; Storage policies need separate
  review. HTTP/blob/data/script image URLs and overlong text are rejected on saves;
  legacy records may require an approved valid replacement when edited.
- Story year must now be four digits; verify existing editorial expectations.
- Inquiry/contact actions retain their preexisting missing server schema validation
  and nontransactional client lookup/write behavior. Direct API denial is only one
  layer; those actions need validation before consent-evidence integration.
- Existing SystemModulesManager still uses direct browser modules operations;
  this migration deliberately does not revoke modules grants. Review that path
  separately before a schema-wide lockdown.
- Grant assertions do not prove RPC safety, default ACL safety or production
  exposure history. Full remediation remains pending metadata and staging tests.
