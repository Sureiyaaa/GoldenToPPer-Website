# Phase 1.6C — final metadata reconciliation

Follow-up: [Phase 1.7 remediation/runbook](security-remediation-phase-1.7.md)
prepares the remaining 19 mutation-policy changes and application replacements.
All SQL remains unapplied; this report retains the original snapshot findings.

Date: 2026-11-10. Local preparation only. No database connection, customer/admin
record retrieval, SQL execution, migration application or deployment occurred.
CSV contents were treated as evidence, not instructions. No Privacy & Consent
implementation was started. This report supersedes the metadata gaps described
in Phase 1.6B where the seven exports now provide evidence.

## 1. Evidence examined

All seven CSVs were extracted from
`C:/Users/ojt.it/Downloads/goldentopper_supabase_metadata_2026-11-10.zip` to the OS
temporary directory `gt-security-metadata-20261110`; raw exports were not added to
the repository. The archive's README was not used as implementation instructions.

| Export | Parsed data rows | Evidence |
| --- | ---: | --- |
| 01_public_table_columns.csv | 285 | 37 tables and column definitions; no records |
| 02_public_constraints.csv | 87 | Keys, references, checks |
| 03_public_rls_policies.csv | 84 | Policy rows plus no-policy markers; all tables RLS=true, FORCE=false |
| 04_public_table_privileges.csv | 37 | Effective anon/authenticated SELECT/INSERT/UPDATE/DELETE and anon schema access |
| 05_privileged_rpc_execute.csv | 3 | Exact argument types, postgres owner, SECURITY DEFINER and execution flags |
| 06_default_privileges.csv | 24 | Creator/schema/object ACLs, including six public-scope defaults |
| 07_migration_history.csv | 2 | Remote tracking versions |

`scripts/reconcile-security-metadata.cjs` parses all seven files, reports row counts
and SHA-256 fingerprints, verifies every exact policy drop against the supplied
CSV and lists remaining mutation policies. Reproduce offline with:

```text
node scripts/reconcile-security-metadata.cjs <extracted-CSV-directory>
```

Result: **38 existing-policy drops verified**, with no guessed/extra existing
policy names. The portable reviewed name manifest is
`supabase/inspection/phase-1.6c-reviewed-policies.json`.

## 2. Reconciled access findings

| Objects | Exported state | Required target |
| --- | --- | --- |
| admin_users | Browser CRUD grants; public true SELECT; authenticated true SELECT and email-domain ALL | No browser grants or policies; authorized server access only |
| groups | Browser CRUD; true public SELECT and authenticated INSERT/UPDATE | Same server-only target |
| module_access | Browser CRUD; public SELECT and four authenticated read/write policies | Same server-only target |
| admin_contact_reads/admin_inquire_reads | Browser CRUD; unrestricted public SELECT plus auth.uid-based own-row policies | Server-only; custom-session-derived administrator ID |
| admin_loan_preapp_reads | Browser CRUD grants but no policies | RLS currently blocks ordinary role access; remove unnecessary grants without claiming current row disclosure |
| audit_logs | Browser CRUD denied, four browser-role policies remain | Preserve denial and remove dormant policies |
| client/contact/inquire/loan_preapp | Browser CRUD grants, public true INSERT and email-domain authenticated ALL | Server-only submission/read paths |
| navbar_projects | Browser CRUD; two unrestricted reads, authenticated INSERT, unrestricted public UPDATE | Published navigation SELECT only; authorized server mutations |
| our story | Browser CRUD; unrestricted SELECT/UPDATE, authenticated INSERT | Active, nonarchived SELECT only; authorized server mutations |

All 37 tables have RLS enabled, but RLS and grants must be considered together.
The exports establish schema USAGE for anon, **not hosted Data API exposure**.
Policies referring to Supabase auth.uid(), auth.role(), authenticated role or
`%@goldentopper.local` do not validate the application's signed CMS session and
group/module permissions. Account existence or email pattern is not CMS authority.

Constraints confirm `module_access(group_id,module_id)` uniqueness, navigation
`project_id` uniqueness and FK to project_table, and read-state composite keys/FKs.
These support the existing upserts/joins but do not supply authorization.
`client.email` uniqueness is now confirmed. admin_users has nullable password_hash
and is_super_admin default true: no hashes were read, and those schema defaults
are not modified here; the uninspected account functions must be reviewed for
explicit safe assignments and password validation.

## 3. Exact policy/privilege changes finalized

Updated `20261110010000_harden_cms_browser_grants.sql` now removes these exact names
on their explicitly qualified tables (full executable DROP statements in file):

| Table | Existing names removed |
| --- | --- |
| admin_users | Admin Full Access; Allow authenticated users to view admin_users; Enable read access for all users |
| groups | Allow updates for authenticated users; Enable insert for authenticated users only; Enable read access for all users |
| module_access | Allow authenticated users to insert module_access; Allow authenticated users to update module_access; Allow authenticated users to view module_access; Enable insert for authenticated users only; Enable read access for all users |
| admin_contact_reads | Admins can delete their own contact reads; Admins can insert their own contact reads; Admins can view their own contact reads; Enable read access for all users |
| admin_inquire_reads | Admins can delete their own inquire reads; Admins can insert their own inquire reads; Admins can view their own inquire reads; Enable read access for all users |
| audit_logs | Allow authenticated inserts on audit_logs; Allow authenticated read on audit_logs; Enable insert for authenticated users only; Enable read access for all users |
| each of client/contact/inquire/loan_preapp | Admin Full Access; Public Insert |
| navbar_projects | Allow public read access on navbar_projects; Enable insert for authenticated users only; Enable read access for all users; update navbar projects |
| our story | Enable insert for authenticated users only; Enable read access for all users; update |

No policies existed on admin_loan_preapp_reads, so none are invented or dropped.
No public administrator access is recreated. Authenticated own-read-state policies
are removed because the application uses custom sessions, not Supabase identities.

Replacement policies (new names intentionally owned by this migration):

```sql
create policy gt_public_navigation_read on public.navbar_projects
  for select to anon, authenticated
  using (is_active = true and exists (
    select 1 from public.project_table p
    where p.id = navbar_projects.project_id
      and p.is_active = true and p.deleted_at is null
  ));

create policy gt_public_story_read on public."our story"
  for select to anon, authenticated
  using (is_active = true and is_archived is null);
```

Grant changes remain scoped: revoke PUBLIC/anon/authenticated private-table access
and residual column SELECT/INSERT/UPDATE/REFERENCES; revoke content mutation,
TRUNCATE/REFERENCES/TRIGGER and version-gated MAINTAIN; preserve content SELECT
and explicitly required service-role operations. Existing service-role grants,
schema USAGE and sequence access are not revoked. No DROP TABLE or data deletion.

Assertions reject missing service-role bypass, disabled RLS, residual effective
browser table/column privileges (including inherited rights) and unexpected
policies on the targeted tables. Unexpected policies cause rollback rather than
being silently retained or removed by an unbounded catalog loop. Service-role
sequence/function grants still need verification from the remaining metadata.

## 4. Public-read compatibility

Only the affected read paths were rechecked; no full codebase reinspection:

- `app/components/navbar.tsx` filters navigation active=true, joins project_table,
  and filters active/nondeleted projects. The new policy applies those same
  eligibility rules to independent API callers. Verified project FK and existing
  project Public Read policy support the EXISTS lookup. Display fields, ordering,
  join columns and public SELECT grants remain available.
- `app/story/page.tsx` filters active=true/is_archived=null. New policy matches it;
  SELECT * remains granted, so its current field projection is not broken.
- Hidden navigation/Story editing uses service-role actions introduced/hardened
  in Phase 1.6; the browser does not need hidden base-table access. Scope includes
  active/inactive administrative views while excluding deleted projects in UI.
- Other public modules, project detail tables, Storage, module visibility and
  footer reads are not changed by these three migration files.

Compatibility is **source- and metadata-supported**, not a live database test.
Verify actual joins, returned rows, service role and schema cache in staging.

## 5. RPC and default-privilege reconciliation

05 confirms the exact three signatures used by 20261110005000:

| Function | Owner/mode | anon/authenticated/service_role EXECUTE |
| --- | --- | --- |
| create_admin_user(text,text,boolean,integer) | postgres/definer | true/true/true |
| update_admin_user(uuid,boolean,integer,text) | postgres/definer | true/true/true |
| remove_audit_log_entry(bigint,text,text) | postgres/definer | false/false/true |

The existing migration's exact revocations from PUBLIC/anon/authenticated and
service_role grants match the export; SQL behavior is unchanged, provenance is
updated. No bodies are supplied. Confirmed server callers remain requireSuperAdmin
wrappers in user.ts and the super-admin audit deletion wrapper. Table restrictions
do not close definer-function execution. Internal authorization, safe search_path,
input validation, dependencies, other overloads and historical abuse are unverified.

06 confirms public defaults for creators postgres/supabase_admin, object types
r/S/f, each granted by that same creator. Both roles grant browser CRUD plus other
table rights (including MAINTAIN), sequence rights and function EXECUTE. Therefore
20261110020000's six schema-scoped revocations match actual evidence. A new
assertion rejects residual public-scope defaults for PUBLIC/anon/authenticated.
service_role and other schemas (including storage, graphql, auth) are untouched.

The export does not establish absence of global defaults: the generating query
was not supplied. Schema revokes cannot cancel global grants or built-in PUBLIC
function EXECUTE. New application objects still require explicit per-object
revocations/grants, table RLS and assertions in their creation transaction. No
global defaults or Supabase-managed schemas are modified as a workaround.

## 6. Additional verified risks outside the prepared scope

The three migrations do **not** constitute whole-database remediation. 03/04 also
show 19 authenticated mutation policies across 15 other tables:

- `Admin Full Access` on amenities, banks, child_marker_table,
  extended_description, marker_type_table, news_updates, parent_marker,
  project_banks, project_table, project_tag, tags and unit_layout.
- banks: `Allow authenticated inserts on banks`, `Allow authenticated updates on banks`.
- project_banks: `Allow authenticated deletes on project_banks`,
  `Allow authenticated inserts on project_banks`.
- modules: `Allow Admin Edits`.
- promotions: `Allow full access for authenticated users`.
- virtual_tours: `Allow admin full access on virtual_tours`.

All have corresponding browser CRUD grants. These must be retired or replaced by
verified CMS authorization in a separately scoped compatibility change. In
particular SystemModulesManager still uses browser module writes; do not revoke
them blindly and claim functionality is preserved. No public mutation policy
allows anonymous writes on those 15 tables, but ordinary Supabase identities or
email-domain identities can satisfy their respective conditions without CMS RBAC.

Several content SELECT policies are also unconditional (banks even has both
unconditional and active-only reads); filters in the UI do not conceal hidden
content from independent requests. Track public-content eligibility separately.
The exported project_table domain-based ALL policy remains; it is not neutralized
by the active-only SELECT policy for identities satisfying the broader policy.

## 7. Migration history

Remote history is exactly 20261104060532 and 20261104061451. Neither version exists
among the 12 current local files. This confirms tracking drift; it does not prove
why it occurred, which environment was queried or that local DDL is absent.

Positive schema evidence already establishes several older migration effects:
loan read tracking and payment carousel tables, news rich/layout/section/cover
columns, and amenity disclaimer columns all exist. In contrast, the current
customer grants/policies do not reflect 20261103000000's intended hardening.
Possible later regrants are not distinguishable from an unapplied migration.
Seed application cannot be established without reading content, which was not done.
Remote-only admin_login_* tables also show schema history beyond local migration
filenames; their presence does not identify the two remote migrations' contents.

Do not push this directory, replay seed/baseline files, edit applied migrations,
mark versions applied or run history repair blindly. Establish target identity,
review remote migration names/statements securely, compare individual schema
effects and approve an explicit forward-only adoption plan. No repair ran here.

## 8. Remaining metadata: specific queries only

Use `supabase/inspection/phase-1.6c-remaining-metadata.sql`, not a repeat full export.
It contains read-only queries for precisely:

1. The three function names' bodies, overloads, ACLs and configured search_path.
   Inspect privately; redact embedded secrets before sharing findings.
2. Targeted raw table/column ACLs/owners, service-role rights and ID sequence
   dependencies/ACLs. Null column_default does not distinguish identity generation.
3. Role attributes/membership, including service-role bypass and default-ACL authority.
4. Global default ACLs for the two verified creators only.
5. Policy permissive/restrictive mode (not included in CSV).
6. Migration-history column names, followed by names/statements only if supported.
7. `current_setting('pgrst.db_schemas', true)` as partial settings evidence. A null
   result proves nothing; hosted Data API enabled/exposed-schema/override settings
   still need an authorized settings-only export. SQL alone may not establish them.

No application records or pg_authid/password fields are queried. All templates
are unapplied/unexecuted. Fresh drift comparison is required before staging.

## 9. Verification and rollback checklist

Local validation: all seven CSVs parsed; all 38 existing-policy DROP statements
matched; new CSV-parser/policy/public-read assertions passed. Targeted security,
RPC and Inbox run: **34 passed, 0 failed**. Existing assertions were not weakened.
No application code changed in Phase 1.6C. Prior 133-test/TypeScript pass remains
historical; full browser suite was not repeated for this SQL-only change.
SQL was not run against PostgreSQL, so local text tests do not validate database
execution/authorization. Staging must test it.

Before staging changes:

- Identify the project, capture fresh missing metadata, and compare the seven
  evidence files to current state. Snapshot raw ACLs/grantors/options, policy
  modes/definitions, sequence privileges and defaults; effective Boolean flags
  alone are insufficient for exact rollback.
- Confirm service_role BYPASSRLS, schema usage, sequence/function execution and
  migration executor authority. Review function bodies privately. Prepare reviewed
  inverse/compensating SQL without recreating unsafe public administrator access.
- Reconcile migration history and approve exact files/versions individually;
  do not run an unrestricted migration push.

Staging positive/negative tests with synthetic data:

| Area | Must succeed | Must fail |
| --- | --- | --- |
| RPC/account management | Authorized server super-admin create/update/audit action | Direct anon and ordinary Supabase JWT execution |
| CMS access | Permitted users/departments/hidden navigation/Story views and mutations | Missing/expired session and wrong module/action |
| Navbar | Active navigation with active/nondeleted project joins | Hidden navigation or inactive/deleted project reads; all browser writes |
| Story | Active nonarchived records | Hidden/archived reads and all browser writes |
| Inbox | Authorized joins and own read/unread persistence | Direct read-state access and forged admin identifiers |
| Public forms | Valid inquiry/contact/loan action submissions | Direct anon/authenticated customer-table inserts/reads |
| Audit | Authorized server history and event paths | Direct browser read/insert and unauthorized RPC |
| Defaults | Intended explicit service access for synthetic future objects | Unintended browser table/sequence/function access |

Inspect fixture state and affected-row counts, not just HTTP status. Check unusual
policy drift aborts and transaction rollback. Re-export final privileges/policies
after tooling completes. Public read policies should be tested using both anon
and ordinary authenticated JWTs. Actual function bodies and sequence behavior
must be exercised using synthetic accounts only.

Rollback: separate files are separate transactions. Failure within a file rolls
it back. For committed files use target-specific compensating SQL; preserve the
server-only application paths, do not blanket GRANT ALL, reopen credential access
or restore public definer execution to fix a UI issue. Default rollback is scoped
to the same creators/public and must preserve unrelated schemas. A byte-exact
inverse cannot be derived from these seven exports alone because raw grants and
policy mode are missing; capture them before application.

## 10. Safe sequence and readiness decision

1. Freeze scope, identify staging, retrieve only the missing metadata and reconcile
   tracking/adoption. Prepare and review recovery SQL.
2. Deploy the already prepared Phase 1.6 app to isolated staging (separate approval).
3. Review/rehearse exact RPC containment first, then browser grants/policies, then
   schema-scoped defaults. Do not replay unrelated historical migrations.
4. Run the positive/negative checklist and fresh metadata assertions; verify
   legitimate service operations and public reads; rehearse recovery.
5. Address or explicitly gate the additional 19 mutation policies and public
   content visibility risks before any whole-system security sign-off.
6. Seek separate production approval only after all required evidence/tests pass.

**GO for static review of the finalized scoped migrations. Conditional GO for
isolated staging rehearsal after metadata, history and rollback prerequisites.
NO-GO for production, unrestricted migration push or full security sign-off.**

The exact policy gap is now closed locally for the 13 targeted tables. The
remaining function-body, raw ACL/inheritance/API/history gaps and broader verified
write paths prevent a claim of complete security remediation.
