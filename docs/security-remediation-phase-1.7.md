# Phase 1.7 — remediation status and execution runbook

Date: 2026-11-10. **Local preparation only. No SQL, staging/production requests,
migrations or deployments were executed.** Privacy & Consent remains suspended.
Database remediation is not complete until real authorization tests pass.

## A. Remediation status

| Control | Local result | Staging | Production |
| --- | --- | --- | --- |
| Three privileged RPC ACLs | Prepared exact revokes/grants; added fail-closed alternate-overload check | Not verified | Not deployed |
| Eleven sensitive tables plus navbar/Story | Existing 38-policy/grant migration retained | Not verified | Not deployed |
| Remaining 19 mutation policies/15 tables | New narrowly scoped migration, exact CSV names | Not verified | Not deployed |
| CMS module writes | Moved from browser to super-admin Server Action | Not verified | Not deployed |
| Hidden News reads | Moved to module-authorized Server Action before tightening public policy | Not verified | Not deployed |
| Promotions/tours | Module/action checks, allowlists, validation and scoped tour updates | Not verified | Not deployed |
| Public inquiry/contact | Server-side validation before service-role access | Synthetic tests only | Not deployed |
| Future public defaults | Existing scoped defaults migration retained | Not verified | Not deployed |
| Function bodies/Storage/views/inheritance/API | Metadata queries prepared; missing evidence prevents verified remediation | Blocked on metadata | Unresolved |

No authorized Supabase connector is available in this session. An offline
configuration identity check found .env.local and .env.development target the same
database as .env.production; .env.staging does not exist. This does not prove no
staging project exists elsewhere, but it prevents safely treating local dev as
staging. No URLs, keys or project refs were printed. Do not run synthetic database
tests or a prerendering build using these existing configurations.

## B. Changed application files and SQL

Application changes in this phase:

- `app/actions/admin-access.ts`: module-management reads, super-admin module
  visibility mutation, explicit authorized News read projection for list/detail.
- `app/admin/dashboard/page.tsx`: module edits/reads and hidden News use actions.
- `app/admin/news/page.tsx`: navigation/detail/created-ID lookup use authorized
  reads. Existing content editing/save flow retained.
- `app/actions/admin_fetchers.ts`: promotion/tour/bank read permission checks;
  promotion create/edit validation; tour create/edit separation, bounded fields,
  accepted Active/Hidden/Inactive/Archived states, project-scoped updates; permanent
  tour deletion rejected in favor of existing archival UI; website visibility
  checks derive permissions from stored module codes, not browser names; inquiry
  and contact schemas validate/normalize public input before DB access. Inquiry
  also verifies the project is active/nondeleted before any customer writes.
  Client update errors stop submission; public failures no longer echo raw DB
  errors, and logs record only error codes rather than customer-bearing details.
- `tests/news-section-images.test.cjs`: mocked new read action in existing isolated
  browser fixture; all its behavioral assertions retained.
- `tests/security-phase-1.7.test.cjs`: positive/negative module, promotion, tour,
  website visibility and public submission tests; migration-scope assertions.
- `scripts/reconcile-security-metadata.cjs`: verifies every follow-up policy DROP
  against actual CSV evidence, including all 19 write policies.
- `scripts/check-security-environments.cjs`: identity comparison without printing
  values or making requests.

Migrations (all unapplied):

1. `20261110005000_restrict_admin_rpc_execution.sql`: independent urgent containment.
   Exact signatures/owners/definer mode checked; anon/authenticated/PUBLIC execute
   revoked; service_role retained; unexpected same-name overloads abort before
   changes. Other-name wrappers still require inventory/body review.
2. `20261110010000_harden_cms_browser_grants.sql`: existing targeted table and
   column privileges, 38 exact policy removals, navbar/Story public replacements.
3. `20261110020000_scope_public_default_privileges.sql`: existing defaults limited
   to postgres/supabase_admin in public, no managed-schema/global changes.
4. **New:** `20261110030000_harden_remaining_cms_mutations.sql`: all 19 remaining
   mutation policies removed; browser table/column write grants revoked; explicit
   service-role operations preserved; unexpected mutation policies abort. Replaces
   broad public reads for banks, News, tours and project-owned detail/map/link
   tables with active/nonarchived/published-parent predicates.

Review assets:

- `supabase/inspection/phase-1.6c-remaining-metadata.sql` (existing specific gaps).
- `supabase/inspection/phase-1.7-function-storage-view-metadata.sql` (new inventory).
- `supabase/verification/phase-1.7-assertions.sql` (new read-only ACL assertions).

## C. Remaining vulnerability assessment

The new migration covers the 19 policies recorded in Phase 1.6C:

- `Admin Full Access` on amenities, banks, child_marker_table,
  extended_description, marker_type_table, news_updates, parent_marker,
  project_banks, project_table, project_tag, tags, unit_layout.
- banks authenticated insert/update; project_banks authenticated delete/insert.
- modules `Allow Admin Edits`; promotions `Allow full access for authenticated users`;
  virtual_tours `Allow admin full access on virtual_tours`.

The ordinary Supabase authenticated role/email-domain patterns do not validate
custom CMS authority. Future mutation access is through server checks. The only
remaining direct browser public-table mutation found in the previous scoped
trace, SystemModulesManager, is now removed. Browser **Storage** calls remain and
must not be confused with table mutations.

Existing project/news/bank-link actions already check their CMS module permissions;
their field allowlists are retained. Previously session-only promotion/tour writes
are now action-specific. Bulk tour updates cannot move a tour from another project
by supplying its ID. Module visibility accepts Boolean values and derives content
module permission from the database. Security/account modules cannot be toggled
through the system visibility action.

Public compatibility:

- Navbar/Story published-only predicates remain from Phase 1.6C.
- Banks/News exclude hidden/archived rows; administrators read hidden rows through
  service-role actions.
- Tours require Active status and a published project; Hidden and Archived states
  remain available to authorized editors.
- Amenities, unit layouts, map markers/descriptions/project links require a
  published parent. Marker types follow their child marker's project. Bank links
  also require an active, nonarchived bank. Shared tags and module visibility flags
  remain readable. A nullable/unlinked project reference is intentionally not public.
- Public homepage/project components are unchanged; staging must verify nested
  reads and map/tour rendering against these RLS predicates.

Still unresolved or explicitly unverified:

1. Functions: no bodies/search_path/dependency metadata. Cannot prove alternate
   differently named definer wrappers are safe. Never change unknown bodies or
   blindly set search_path. Review validation, explicit role handling, hashing,
   object qualification, dynamic SQL and sensitive returns. Account table default
   is_super_admin=true makes explicit safe assignments especially important.
2. Storage: browser uploads/replacement removals exist in homepage, projects,
   virtual tours, navbar, Story, banks and payment editors. News has a separately
   authorized upload action. No storage.objects/buckets policy/ACL export was
   provided; no Storage policy names, ownership scopes or object prefixes are
   guessed. Do not revoke browser Storage access until uploads are moved or a
   verified custom-auth-compatible mechanism is deployed and tested.
3. Views: no exposed view/definer inventory. Owner-executed views/functions may
   bypass table protections. Inventory definitions privately; do not query rows.
4. Roles/API: column ACLs, sequence rights, inheritance, default-ACL authority and
   hosted exposed schemas remain unverified. The new SQL assertions are guards,
   not evidence they have run.
5. Public forms: validation closes malformed payloads but is not identity proof
   or bot throttling. Existing email reuse/phone-refresh behavior and multi-request
   client/submission writes remain; they are not a transactional consent ledger.
6. Audit/order/tour bulk saves use separate requests and are not atomic. Failures
   may leave partial updates. Audit event payloads are not an immutable ledger.
7. Broad public homepage configuration reads are unchanged; review hidden content
   semantics separately before claiming every CMS field is confidential.

## D. Local verification and staging plan

Commands executed locally (no live data):

```text
node scripts/check-security-environments.cjs
node scripts/reconcile-security-metadata.cjs <extracted-CSV-directory>
node --test tests/security-phase-1.7.test.cjs
node --test tests/*.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
git diff --check
```

Reconciliation: 38 existing targeted DROP statements plus **32 follow-up DROP
statements** match the CSV; the latter contain 19 mutations and 13 broad reads.
New targeted tests: 7/7 passed. Final full suite: **144 passed, 0 failed, 0 skipped**;
TypeScript passed. Tests use synthetic doubles/isolated local browser fixtures. No test
was weakened to bypass an authorization gate. Existing ESLint config/dependency
resolution remains a known separate check failure; no dependencies were changed.

Staging has **not** been run. Setup prerequisites:

1. Human owner identifies or creates a dedicated Supabase staging project and
   isolated app preview. This task did not create infrastructure/accounts.
2. Use schema/metadata only; no production customer copy. Store synthetic
   administrator, content and submission fixtures there. Bootstrap the first
   synthetic super-admin through an approved trusted operator path, not public RPC.
3. Configure separate staging Supabase URL/keys, session-signing secret context,
   Storage bucket, CAPTCHA test/preview setup, app origin and disabled outbound
   messaging/payment/bank integrations. Production secrets must not be reused.
4. Human verifies project identity independently; an environment name alone is
   insufficient. Deny production refs in the test harness. Do not use current
   .env.local/.env.development as staging.
5. Retrieve the two inspection templates through an authorized metadata connection;
   privately review function/view definitions, Storage policies and inheritance.
   Redact embedded secrets from anything shared; no customer/password-hash rows.
6. Reconcile exact schema/sequence/trigger effects and prepare recovery SQL before
   application. Run full application HTTP/DB tests in that isolated environment.

## E. Migration reconciliation and explicit execution method

Remote tracking remains 20261104060532 and 20261104061451. Neither matches local
filenames; there are now 13 local migrations. Do not run `supabase db push`.
Older table/column effects exist in the exported schema, so missing history does
not mean missing DDL. Conversely current customer policies/grants contradict the
intended older 20261103000000 result. Cause and the two remote statements remain
unknown. See Phase 1.6C for the already completed effect comparison.

Additional dependencies to verify: identity generation/sequences for IDs whose
exported column_default was null; navigation trigger/FK behavior; service-role
schema/sequence access; actual policies and owner/bypass flags; view/function
wrappers. No historical baseline or seed file should be replayed.

Execution strategy for human review: use **an explicit allowlist of the four
reviewed files**, one transaction/file, on a verified connection service. Capture
exact Git revision and SHA-256 bytes in an independent release ledger. Do not
fabricate migration-history entries or mark historical files applied. A separate
history-adoption proposal must reconcile names/statements/effects before CLI-driven
migrations resume.

The prepared changes include uncommitted/untracked files. Human review must first
produce an approved commit or complete artifact containing those files; deploying
the current HEAD alone will omit the remediation. Record the artifact's hashes,
not just the pre-existing baseline revision. This task did not commit or publish.

## F. Human-approved execution runbook

### Lane 1 — urgent RPC containment, independent of broader CMS work

This lane must not wait solely for unrelated Storage/content tasks.

1. **Human approval gate:** identify target/project/change window and named operator;
   approve exact RPC file/hash and recovery plan. No approval is implied by this doc.
2. Snapshot exact three RPC ACLs/grantors/options, owners, definer flags/signatures,
   same-name overload inventory and relevant membership. Privately retain bodies
   without exposing hardcoded credentials. Check service callers use service_role.
3. On isolated staging, execute only 20261110005000. Unknown overload/owner/flags
   must abort; never weaken the preflight or use CASCADE to force it through.
4. Verify effective EXECUTE denial for anon/authenticated and retained service_role.
   Exercise synthetic account create/update and audit removal through authorized
   Server Actions; ordinary users and invalid CMS sessions must fail. Check for
   alternate wrappers. Record actual HTTP and DB results, not mocked tests.
5. If staging succeeds, request **separate explicit production containment approval**
   for this one file. Production negative checks should use metadata, not attempted
   account creation against real data. Monitor login/admin-management errors and
   permission-denied events; no passwords, tokens or request payload logging.
6. Do not roll back to public EXECUTE if account management fails. Disable the
   affected UI operation, repair authorized service execution/caller configuration,
   or issue a reviewed narrow compensating change. Preserve containment.

Example approved staging command (documentation only; not executed). Configure
PGSERVICE/PGPASSFILE securely; no connection string/password in shell history:

```powershell
Get-FileHash -Algorithm SHA256 supabase/migrations/20261110005000_restrict_admin_rpc_execution.sql
psql service=gt_staging --no-psqlrc -v ON_ERROR_STOP=1 -f supabase/migrations/20261110005000_restrict_admin_rpc_execution.sql
```

Do not substitute a production service without the separate human approval above.
Bodies still require review; restricting the known public entry points does not
certify uninspected wrappers safe.

### Lane 2 — application and broader database hardening

1. **Approval/snapshot gate:** verify project identity and protected backups/restore
   points. Have the human owner confirm a recoverable managed backup; no assistant
   export of customer records is authorized. Capture schema/ACL/policy/default/
   function/view/trigger metadata and grantors in secure storage outside the repo.
2. Review remaining metadata and dependencies. Generate target-specific inverses
   from raw snapshots, not Boolean CSV privileges. Test a compensating recovery
   in staging. Do not recreate public administrator credentials/access as recovery.
3. Deploy the complete Phase 1.6/1.7 app to isolated staging **before** table/public
   read restrictions. Verify module management and hidden News now use actions.
4. Execute reviewed files explicitly: 20261110010000, 20261110020000, then
   20261110030000. RPC 20261110005000 should already be contained. Never replay old
   baseline/seed scripts. Each file has its own BEGIN/COMMIT; no all-files atomicity.
5. Run read-only assertions and actual positive/negative fixture tests. Example:

```powershell
psql service=gt_staging --no-psqlrc -v ON_ERROR_STOP=1 -f supabase/verification/phase-1.7-assertions.sql
```

6. Verify public homepage/project/navbar/Story; inquiry/contact/loan actions;
   login, Users & Access, departments, modules, navigation, Story, News, banks,
   promotions, virtual tours, Inbox and audit. Test image uploads/replacements.
   Test anon and ordinary JWT writes; wrong-module viewer/editor; revoked/expired
   session; hidden/archived content and published nested links/maps. Assert both
   response and unchanged synthetic state for denials (RLS may return zero rows).
7. Re-export effective state after tooling completes and verify no regrants.
   Check new synthetic tables/functions/sequences under both creator roles for
   unintended access; schema revokes alone cannot remove global function defaults.
8. **Production approval gate:** operator/change owner reviews exact artifacts,
   fixture evidence, snapshots, outstanding risks and rehearsed recovery. Execute
   only approved files after app rollout; production confirmation remains
   metadata/smoke checks that avoid customer/hash retrieval and synthetic writes.
9. Monitor server permission failures, 5xx rates, public content load errors,
   submission failure rates, Storage failures, module/News load errors, and audit
   health using redacted metrics. Compare against a pre-change baseline. Recheck
   independent RPC containment remains intact throughout any recovery.

### Stop conditions and recovery

Expected compatibility changes and mitigations:

| Change | Mitigation |
| --- | --- |
| A viewer can no longer change module visibility or edit another module | Verify department flags with a trusted super-admin; do not grant generic authenticated writes |
| Hidden News/bank/tour records disappear from public APIs | Use authorized CMS actions for editorial views; verify active public pages and nested relationships |
| Orphan/unlinked project details become nonpublic | Review synthetic FK/reference fixtures before rollout; do not broaden RLS to expose hidden projects |
| Invalid/overlong payloads, temporary image URLs or malformed IDs are rejected | Correct form values/replace legacy unsupported image URLs; retain validation and safe errors |
| Bulk tour save exceeds 200 units or 100 areas/unit | Confirm real editorial limits in staging; approve a deliberate limit adjustment if needed |
| Module/News action deployment missing while grants are restricted | Stop rollout and deploy the reviewed server paths; never restore browser writes |
| Storage uploads fail independently of table operations | Inspect exact bucket/object policies and approved upload workflow; Storage was not modified here |
| Multi-request ordering/bulk save partially fails | Reload actual persisted state and repair through authorized operations; do not assume transactionality |

Stop on wrong project/config, missing backup/ACL snapshot, unexpected overload,
policy/owner/role/schema drift, migration assertion failure, service operation or
public page regression, new grant reintroduction, or any negative test succeeding.
Do not mark the rollout complete with unexecuted checks.

Before COMMIT, transaction failure rolls back that file. After COMMIT, apply a
reviewed forward fix/compensating migration scoped to the target snapshot. Retain
RPC and private-table denials; temporarily disable a broken CMS operation rather
than reopen anonymous writes. Rolling app code back to browser writes is not
compatible with hardened grants. Never use blanket GRANT ALL, restore public
hash reads, or change global defaults as a troubleshooting shortcut.

A byte-exact target inverse is **blocked** on raw ACL/grantor/policy-mode/role
metadata; no fabricated inverse is included. Production SQL remains unauthorized.

## G. Security acceptance checklist

| Acceptance criterion | Current result |
| --- | --- |
| Local full tests and TypeScript | Results below; not database proof |
| Exact RPC metadata matches and unknown overloads blocked | Prepared assertions, unexecuted |
| Anonymous hashes/private records denied | Prepared migration, real verification pending |
| Ordinary Supabase identities cannot manage CMS permissions/content | Prepared four-file controls; staging pending |
| Authorized service operations and super-admin management succeed | Synthetic tests; staging pending |
| Public content/valid submissions remain functional | Synthetic/source checks; staging pending |
| Hidden/archived reads denied including relationships | New policy SQL; real fixture tests pending |
| Storage, exposed views, function bodies and inherited paths reviewed | Missing metadata, FAIL for final acceptance |
| Safe creator defaults verified on actual future objects | Pending staging |
| History adoption and target recovery rehearsed | Pending human review/raw metadata |
| Production execution explicitly approved | No approval; not deployed |

## H. Readiness decision

**Prepared for local review and isolated staging setup/rehearsal. Not staging
verified, not production-ready, not fully remediated.** Urgent RPC containment is
an independent approval lane and need not wait for unrelated CMS work; it still
requires its target snapshots, actual role/service tests and explicit approval.
Whole-system acceptance remains blocked by the metadata and real authorization
tests above. Privacy & Consent must remain suspended.

## Final local results

Final-state full suite: **144/144 passed**, no failures or skips, including local
browser fixtures. TypeScript and `git diff --check` passed. A targeted 22-test run
also passed after adding published-project inquiry validation. The offline CSV
comparison verified 38 earlier and 32 follow-up existing-policy removals. No
staging tests, SQL execution, deployment, live CAPTCHA/login or production
prerender build were performed. Existing env files target production and were
not used for tests. These results do not establish deployed database safety.
