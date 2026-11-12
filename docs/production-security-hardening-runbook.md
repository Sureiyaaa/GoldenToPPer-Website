# Production security hardening — approval runbook

Prepared 2026-11-11. Documentation only: no database connection, SQL execution,
backup, restore or deployment performed. Existing migrations are unchanged.

## Status and decision

Operator reports `05000` applied, effective RPC privileges verified, and account
creation/editing/disabling smoke tests passed. Treat this as operator evidence;
retain the execution receipt. Do not rerun or reverse containment.

**NOT APPROVED for production execution yet.** No separate staging project,
Docker or GitHub integration is required by this plan. Proceeding without staging
requires an explicit change-owner acceptance of the reduced regression assurance;
it does not waive target verification, recoverability or metadata review.

Approval record must name operator, reviewer, exact project reference, application
commit/artifact, three SQL SHA-256 hashes, maintenance window, backup location and
restore evidence, approved recovery scripts, remaining-risk acceptance, and
per-file go/no-go decisions. Do not put keys or connection passwords in the record.

## Reviewed files and required application deployment

Order: deploy the complete hardened application, then `20261110010000`, verify;
then `20261110020000`, verify; then `20261110030000`, verify. Each is a separate
commit boundary. Do not run `supabase db push`, replay older seeds/baselines, or
invent migration-history entries. The previously exported history had only
20261104060532 and 20261104061451, neither matching local filenames. Refresh history;
manual execution of `05000` need not have updated it.

Required deployed behavior (verify the actual artifact, not just local files):

| File | Application prerequisites and preserved paths |
| --- | --- |
| 10000 | `app/actions/admin-access.ts` permission-checked Users/Access, department, navigation read/save/order actions; `app/admin/users/page.tsx` and dashboard consume these instead of browser table access. Story, Inbox, login, audit and public submission operations use authorized server/service-role paths. Public contact/inquiry validation in `admin_fetchers.ts` must be present. |
| 20000 | All future object-creation tooling explicitly supplies grants, RLS and service-role permissions; future functions revoke PUBLIC/anon/authenticated EXECUTE in their creation transaction. No runtime object-creation job may depend on broad defaults. |
| 30000 | Dashboard module visibility and hidden News reads use `admin-access.ts`; `app/admin/news/page.tsx` uses authorized editorial reads. `admin_fetchers.ts` enforces module-specific view/create/edit permissions for Story, promotions, banks and tours; tour updates are project-scoped; website-section checks use stored module codes; public input is bounded/validated. Existing project/News/bank-link actions retain CMS authorization. |

Custom signed CMS sessions and module flags authorize server actions. A Supabase
`authenticated` identity alone never establishes administrator permission. Service
credentials remain server-only. Browser Storage uploads remain an independent path.

Prior local report: 144 tests and TypeScript passed; not rerun for this document,
not evidence of the deployed artifact or real database behavior. Existing ESLint
configuration failure remains disclosed.

## Manual backup without Docker

Supabase Free users should maintain manual off-site exports; do not assume an
accessible managed restore point. Native PostgreSQL `pg_dump`/`pg_restore` and
`psql` work without Docker. Use a supported client matching the server major
version (or a compatible newer dump client). Use the Dashboard's direct connection
or session pooler connection, not transaction pooling. Configure a private libpq
service `gt_prod_backup` with verified host/database/user and SSL verification,
and an OS-protected password file; never paste credentials into SQL Editor/chat.

Human operator procedure only; no assistant access to dump contents is authorized:

1. Use an encrypted, access-restricted folder outside Git/cloud review uploads.
   Pause CMS writes, imports, scheduled jobs and DDL; gate public submissions for
   the window and drain in-flight writes. A website maintenance banner alone does
   not block direct Data API access. Record how traffic/jobs are actually gated.
2. Export all application `public` schema objects/data/ACLs using a trusted owner
   capable of reading every application table. The archive includes customer data
   and password hashes: do not open rows, share it for code review or commit it.
   Do not use `--no-acl`, `--no-owner` or `--enable-row-security` on the backup.

   ```text
   pg_dump --dbname=service=gt_prod_backup --format=custom --schema=public --file=public-before.dump --verbose
   pg_dump --dbname=service=gt_prod_backup --schema-only --schema=public --file=public-before-schema.sql
   pg_restore --list public-before.dump > public-before.toc.txt
   pg_restore --file=public-before-decoded.sql public-before.dump
   ```

   Check each exit status and warnings before continuing. Keep decoded SQL equally
   protected; it also contains records. The first archive is a consistent snapshot;
   the separate schema export is not the same snapshot, hence the DDL freeze.
3. Export the read-only metadata below separately, including global defaults,
   roles/membership, schema/sequence ACLs, functions, policies and history. Preserve
   raw ACL grantors and grant options. Record migration hashes with PowerShell
   `Get-FileHash -Algorithm SHA256 <exact-file>` and archive hashes likewise.
4. Store an encrypted off-device copy; verify hashes after copying. Inventory all
   28 affected tables, sequence entries, policies, ACL/default-ACL entries and
   application function definitions in the archive/schema inventory. Investigate
   missing objects, RLS-related export errors, or permission warnings.
5. **Restoration verification:** archive listing/decoding proves readability only.
   For an actual restore test, an operator may use a disposable native PostgreSQL
   database (no Docker/new Supabase project), isolated from outbound integrations,
   with compatible extensions and nonlogin stand-ins for required roles/auth
   dependencies. Review executable functions/triggers before restoration. Restore
   only to that disposable database, never to production as a test:

   ```text
   pg_restore --dbname=service=gt_restore_test --exit-on-error --single-transaction public-before.dump
   ```

   Provision dependencies/owners before this command; do not suppress failed
   statements. Verify restored object inventories, constraints/indexes, policies,
   ACLs, default ACLs, sequence values and aggregate row counts against the frozen
   source snapshot privately, without displaying records. A native restore does
   not prove hosted Auth/Storage/API behavior. Record time-to-restore and errors.
   If no disposable destination is available, label restore **UNVERIFIED** and
   keep the recoverability gate blocked; an archive listing is not a substitute.

Scope: this is an application-schema recovery backup, not a complete Supabase
project backup. Schema-filtered dumps do not automatically include external
dependencies, managed Auth data/config, secrets, roles, Storage files or settings.
These migrations do not alter those assets; inventory dependencies and establish
any additional operator-managed backups needed for the agreed recovery scope.
Do not blindly dump/restore managed schemas into a live Supabase project.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups),
[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).

## Read-only SQL preflight: capture before approval

Run manually only after approving metadata collection. Export every result set
privately. These statements read catalogs, not administrator/customer records.
SQL cannot independently prove which Dashboard project is intended: compare the
Dashboard project reference and Connect host with the approved record first.

```sql
begin transaction isolation level repeatable read read only;
select current_database(), current_user, session_user, version(),
       inet_server_addr(), inet_server_port(),
       current_setting('pgrst.db_schemas', true) as api_schemas_hint;
select rolname, rolsuper, rolinherit, rolbypassrls
from pg_roles where rolname in
 ('postgres','supabase_admin','anon','authenticated','service_role');
select roleid::regrole, member::regrole, admin_option from pg_auth_members;
select pg_has_role(current_user,'supabase_admin','MEMBER') as creator_membership;
-- Membership is evidence, not sufficient proof of ALTER DEFAULT PRIVILEGES
-- authority on every server version/managed platform. Obtain owner confirmation.
select nspname, nspowner::regrole, nspacl from pg_namespace
where nspname in ('public','storage','auth');
select c.oid::regclass as object, c.relkind, c.relowner::regrole,
       c.relrowsecurity, c.relforcerowsecurity, c.relacl, c.reloptions
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' order by 1;
select c.oid::regclass as object, a.attname, a.atttypid::regtype,
       a.attidentity, a.attacl, pg_get_expr(d.adbin,d.adrelid) as default_expr
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where n.nspname='public' order by 1,a.attnum;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname,tablename,policyname;
select d.defaclrole::regrole as creator,
       case when d.defaclnamespace=0 then '<global>' else n.nspname end as scope,
       d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
where d.defaclrole in ('postgres'::regrole,'supabase_admin'::regrole);
select p.oid::regprocedure as function, p.proowner::regrole as owner,
       p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p');
-- Definitions can contain embedded secrets: private review, redact before sharing.
select c.oid::regclass as view,c.reloptions,pg_get_viewdef(c.oid,true)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m');
select t.tgrelid::regclass as target,pg_get_triggerdef(t.oid,true)
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal;
select conrelid::regclass as target,conname,pg_get_constraintdef(oid)
from pg_constraint where connamespace='public'::regnamespace;
select pg_describe_object(classid,objid,objsubid) as dependent,
       pg_describe_object(refclassid,refobjid,refobjsubid) as referenced,deptype
from pg_depend where refclassid='pg_class'::regclass and refobjid in
 (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public');
select version from supabase_migrations.schema_migrations order by version;
commit;
```

Inspect definition bodies for unsafe dynamic SQL, unqualified objects/search_path,
alternate privileged wrappers, explicit safe administrator flags and sensitive
returns. Catalog dependencies do not find every dynamic SQL/body reference.
Review views, materialized views and Storage policies for alternate exposure.
Confirm Dashboard Data API enabled/exposed schemas; a NULL setting proves nothing.
Confirm effective service-role public-schema USAGE and sequence USAGE where inserts
need nextval. No sequence or schema grant is repaired by these migrations.

Compare all current SELECT policies as well as mutation policies with the exported
84-row inventory: permissive policies combine with OR. `30000` rejects residual
mutation policies, but an unexpected broad SELECT policy can survive it. Verify
parent project visibility policy and archive/date/null field types. Missing or
renamed tables/columns, extra restrictive policies and inherited grants require
review, not changes to bypass assertions. `20000` must not be forced by granting
extra managed-role membership; if authorized execution is unavailable, hold that
file and separately approve a revised scope rather than partially executing it.

## Read-only postflight (also capture baseline before each change)

Run the following catalog checks before and after. Before changes, violations are
expected; after the relevant file, none are acceptable. No row-level test writes
or customer reads are included. Include `begin read only;` / `commit;` around each
batch if executing it independently in SQL Editor.

```sql
begin read only;
-- All three retained RPCs: browser false, service true, including after recovery.
select p.oid::regprocedure, r.role,
       has_function_privilege(r.role,p.oid,'EXECUTE') as executable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role)
where n.nspname='public' and p.proname in
 ('create_admin_user','update_admin_user','remove_audit_log_entry');

-- Zero rows after 10000 for private objects; after 30000 for all content objects.
with targets(name,private) as (values
 ('admin_users',true),('groups',true),('module_access',true),
 ('admin_contact_reads',true),('admin_inquire_reads',true),
 ('admin_loan_preapp_reads',true),('audit_logs',true),('client',true),
 ('contact',true),('inquire',true),('loan_preapp',true),
 ('navbar_projects',false),('our story',false),('amenities',false),
 ('banks',false),('child_marker_table',false),('extended_description',false),
 ('marker_type_table',false),('modules',false),('news_updates',false),
 ('parent_marker',false),('project_banks',false),('project_table',false),
 ('project_tag',false),('promotions',false),('tags',false),
 ('unit_layout',false),('virtual_tours',false)
), checks as (
 select t.*,r.role,p.privilege,
        to_regclass(format('public.%I',t.name)) as object
 from targets t cross join (values ('anon'),('authenticated')) r(role)
 cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
                    ('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
 where t.private or p.privilege<>'SELECT'
)
select name,role,privilege,'missing object or residual grant' as violation
from checks where object is null
or has_table_privilege(role,object,privilege)
or (privilege in ('SELECT','INSERT','UPDATE','REFERENCES')
    and has_any_column_privilege(role,object,privilege));

-- All public content tables must retain table SELECT for both browser roles.
select c.oid::regclass,r.role,has_table_privilege(r.role,c.oid,'SELECT') as readable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated')) r(role)
where n.nspname='public' and c.relname in
 ('navbar_projects','our story','amenities','banks','child_marker_table',
 'extended_description','marker_type_table','modules','news_updates','parent_marker',
 'project_banks','project_table','project_tag','promotions','tags','unit_layout','virtual_tours');

-- No residual scoped browser defaults after 20000. Global entries reviewed apart.
select d.defaclrole::regrole,d.defaclobjtype,a.*
from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) a
where n.nspname='public' and d.defaclrole in
 ('postgres'::regrole,'supabase_admin'::regrole)
and d.defaclobjtype in ('r','S','f')
and a.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid);

-- Service ACLs/RLS: compare against each file's explicit GRANT list; no losses.
select c.oid::regclass,c.relrowsecurity,
       has_schema_privilege('service_role','public','USAGE') as schema_usage,
       has_table_privilege('service_role',c.oid,'SELECT') as sel,
       has_table_privilege('service_role',c.oid,'INSERT') as ins,
       has_table_privilege('service_role',c.oid,'UPDATE') as upd,
       has_table_privilege('service_role',c.oid,'DELETE') as del
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') order by 1;
select c.oid::regclass,
       has_sequence_privilege('service_role',c.oid,'USAGE') as usage,
       has_sequence_privilege('service_role',c.oid,'SELECT') as sel
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='S';
-- PG17+ only: run separately after confirming server version, scoped to targets.
-- select c.oid::regclass,r.role from pg_class c
-- join pg_namespace n on n.oid=c.relnamespace
-- cross join (values ('anon'),('authenticated')) r(role)
-- where n.nspname='public' and c.relkind in ('r','p')
-- and has_table_privilege(r.role,c.oid,'MAINTAIN');
commit;
```

Re-run the preflight policy query after each file. For `10000`, its 13 targets
must have only `gt_public_navigation_read` / `gt_public_story_read` on the two
public tables, no policies on the 11 private tables. For `30000`, all 15 targets
must have SELECT-only policies; compare every surviving predicate and role with
the reviewed expected state. Its 11 new `gt_public_*_read` policies must match the
file exactly, alongside approved unchanged SELECT policies. Require RLS enabled
on every affected table and service_role bypass true. Re-run MAINTAIN check on
PG17+; zero affected-target results. Save raw before/after evidence.

## Recovery prepared per target, before approval

No exact executable inverse can honestly be finalized without the current raw
ACLs/grantors/policy definitions and authority information. The exports below are
inputs to a reviewed target-specific recovery script, not permission to restore
the old vulnerabilities. Prepare, hash and independently review those scripts
before opening the execution window.

| File | Safe post-commit recovery procedure |
| --- | --- |
| 10000 | Keep all private/browser denials and RPC containment. For a broken authorized operation, compare saved service/schema/sequence ACLs and deployed action with the expected service operation. Repair only the verified missing service permission or deploy the corrected authorized action. For legitimate public navigation/Story omissions, review the exact parent/active/archive predicate and issue a narrowly approved SELECT-policy correction. Never restore private reads or public form/table writes. |
| 20000 | Freeze new object creation. Inventory objects created since commit (release/tooling ledger; PostgreSQL has no universal object creation timestamp); defaults do not change existing objects. Give only intended roles explicit grants on identified new objects. Correct creator-specific defaults narrowly if necessary, preserving browser denial and global/managed-schema scope. Do not regrant the former broad defaults. |
| 30000 | Keep browser mutation revocations. For broken CMS writes, fix authorized service grants/actions. For missing published content or nested links/maps, compare saved and current policy predicates and grant paths; approve a minimal published-only SELECT fix. Never restore the broad Admin Full Access policies. Disable only the affected UI feature while repairing. |

Before commit, an error aborts that file's transaction; confirm rollback completed.
If SQL Editor leaves an aborted transaction, the operator ends it with ROLLBACK
before any new attempt. After commit, ROLLBACK cannot undo the change. If connection
status is uncertain, inspect effective catalogs first; do not assume success or
rerun blindly. The three files are not all-or-nothing together.

Do not restore a whole data archive over live production to repair grants. That
could overwrite new submissions and reinstate dangerous policies/function ACLs.
Catastrophic data recovery requires a separate approved outage/restore plan,
dependency ordering and reconciliation of writes after the backup. Preserve the
already-applied RPC denials throughout recovery. App rollback must retain the
new server paths; an older browser-write app is incompatible with hardened grants.

## Execution checklist — human approval gates

1. **Gate A: preparation approval.** Confirm project identity and named operator;
   review fresh metadata, complete backup/restore evidence, per-file recovery,
   service-role schema/sequence paths, managed-role default authority, function/
   view/Storage exposure and all SELECT predicates. Resolve blockers below.
2. Approve complete application artifact and migration hashes; deploy the app
   first under a planned maintenance window. Freeze admin content/permission
   writes, jobs, schema changes and submissions as planned; drain old app instances
   and require CMS browser refreshes. Retain a compatible prior artifact.
3. Check public pages and authorized read paths against the deployed app. Confirm
   server credentials/session signing, runtime origin and CAPTCHA configuration.
   Never log tokens, passwords, record payloads or raw sensitive DB errors.
4. **Gate B: per-file execution approval.** In the verified production SQL Editor,
   paste the entire exact reviewed `10000` file, including BEGIN/COMMIT; do not run
   selected fragments. Inspect success, run postflight, check login/Users & Access,
   departments/navigation/Story/Inbox and public content. Pause on any mismatch.
   Choose a low-traffic window; catalog/DDL locks can block requests. Any timeout
   or lock-wait concern stops progress; do not kill sessions or change timeout
   policy without a reviewed operator action.
5. Only after the previous gate passes, execute the full `20000` file. Inspect
   scoped/global default differences and confirm no unexpected scope changes.
   Then execute full `30000`; verify its policy/ACL results and public nested reads.
   Stop after any failure rather than proceeding to the next file.
6. Use read-only catalog checks for production negative authorization confirmation;
   do not attempt anonymous account creation or customer-table writes. Existing
   RPC smoke tests remain evidence. Any further synthetic CMS/form write tests
   require a separate explicit operator-approved test/cleanup plan; this runbook
   does not authorize production test data. Owner must record reduced confidence
   where real positive/negative tests have not been performed.
7. Check public homepage/projects/navbar/Story, banks/News/promotions/tours/maps;
   CMS hidden editorial views; upload workflow and audit/Inbox read paths. Do not
   export private records. For forms and write operations, use approved prior test
   evidence or separately authorized controlled checks, never claim unrun checks.
8. Re-export catalog state, retain SQL Editor receipts and hashes in a release
   ledger, confirm `05000` RPC denial remains. Do not alter tracking history in
   this rollout. Resume gated traffic/jobs incrementally; monitor permission errors,
   5xx, submission failures, content emptiness, uploads and audit health against
   baseline. Assign owner/observation period and explicit completion sign-off.

**Stop immediately** for target mismatch, unverified backup/recovery, unauthorized
creator role, unknown policy/column/function drift, residual inherited grants,
missing service access, exposed alternate privileged wrapper, unexpected SELECT
exposure, lock/transaction uncertainty, public/CMS regression or grant reintroduction.

## Unresolved approval blockers

- Fresh raw target metadata, owner/role authority and exact recovery artifacts have
  not been supplied; old Boolean CSV exports cannot reconstruct grantors/options.
- Backup/export completeness and an actual disposable restore have not been
  demonstrated. No backup or restore was performed by this preparation task.
- Actual deployed app revision and runtime behavior of the remaining CMS paths
  have not been verified; local synthetic tests are insufficient proof.
- Function bodies/search paths/dynamic dependencies, exposed views, Storage
  policies, inherited privileges and hosted Data API settings remain unreviewed.
  Classify unrelated residual risks separately, but any alternate path to protected
  administrator/customer data or CMS mutation blocks security acceptance.
- `supabase_admin` default-ACL authority is unconfirmed. Global function defaults
  remain intentionally outside `20000`; per-object creation controls are required.
- No staging regression run exists. An owner may accept that residual deployment
  risk explicitly, but this report does not fabricate production test evidence.

No production approval is implied by preparing this document. Privacy & Consent
implementation remains out of scope. Stop after document review and resolving
the approval gates; all execution remains a separate human-authorized action.
