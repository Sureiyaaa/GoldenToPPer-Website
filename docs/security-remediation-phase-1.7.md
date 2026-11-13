# Phase 1.7 - completed remediation and release synchronization

Status updated 2026-11-13 (Asia/Manila). The earlier preparation-only, unapplied
and production-not-ready decisions are superseded for the five scoped migrations.
The full earlier report and execution/recovery instructions were copied outside
the public repository before replacement with this release summary.

## Production completion

The operator confirms manual execution of 05000, 05500, 10000, revised
postgres-only 20000 and 30000, with targeted database checks passing. Reported
Super Admin, non-Super Admin, CMS editing, public form submission and public
website smoke tests passed. These results are operator evidence, not claims of
new SQL execution or independent production verification by this repository task.

| Control | Completed scope |
| --- | --- |
| Privileged and login RPCs | 05000/05500 contain reviewed browser execution paths |
| Sensitive tables and navigation/Story | 10000 restricts browser access while retaining approved public reads |
| Remaining CMS mutation policies | 30000 removes 19 reviewed mutation policies across 15 tables |
| Public-read policies | 30000 replaces 13 old SELECT policies with 11 approved policies, retaining four reviewed reads |
| Future public-schema defaults | 20000 changes postgres defaults only; supabase_admin remains deferred |

## Application behavior retained

CMS module writes and hidden News reads use authorized server actions.
Promotion, bank, Story and tour operations enforce module/action permissions;
tour updates remain project-scoped. Public inquiry/contact validation and
published-project checks precede service-role access. Approved public content
reads retain active/archive/published-parent predicates.

This release also includes the intentional fixes in app/components/navbar.tsx
(disabled desktop/mobile public login links) and app/homeclient.tsx (placeholders
for missing/blank news images). Disabling a link does not enforce route access.
README.md no longer publishes the obsolete credential block. Actual credentials
must never be added to public documentation.

## Public release and private recovery

Publish the postgres-only migration revision and updated security-rpc regression
test with the corrected public status records. No migration replay accompanies
the PR. The historical migration headers are not the production status ledger.

Retain full 10000/30000 recovery documentation, repair scripts, raw production
baseline snapshots and their dependent recovery tests privately as complete
packages. They are excluded from the public release. Keep exact executed SQL,
hashes, deployed revision, receipts, backup/restore evidence and operator records
in access-controlled, backed-up storage. A local archive is not proof of off-site
retention. Recovery SQL was reviewed statically, not executed by this task.

## Remaining work and verification boundary

Migration-history discrepancies remain subject to a separate evidence-backed
adoption plan. The earlier remote versions 20261104060532 and 20261104061451 have
no matching local migration filenames; no fresh post-rollout tracking export was
inspected. Never infer missing DDL from missing tracking or replay older seeds.

supabase_admin default ACLs and global/default function privileges remain outside
the executed 20000 scope. Explicit safe object-creation privileges, RLS and
function EXECUTE revocations remain necessary. Function bodies, Storage, exposed
views, inherited access and recoverability require separate retained evidence;
the scoped rollout is not whole-system security certification.

Local security regression and TypeScript checks are separate from production
smoke evidence. No staging/build/restore result is inferred from mocked tests.
General cleanup, comprehensive documentation and Privacy & Consent work remain
outside this release. See the [production status record](production-security-hardening-runbook.md).
