# Phase 1.6C - reconciliation and production completion

Status updated 2026-11-13 (Asia/Manila). This public summary supersedes the
2026-11-10 preparation-only status. The full earlier reconciliation report was
copied outside the public repository before removal of operational detail.

## Completed scoped changes

The operator confirms production execution and targeted database verification of
05000, 05500, 10000, revised postgres-only 20000, and 30000. Super Admin,
non-Super Admin, CMS editing, form submission and public website smoke tests
passed according to the operator. These are reported production results, separate
from local mocked/source tests. Do not rerun the migrations for this release.

The original reconciliation verified 38 existing policy removals for the 13
10000 targets. The remaining CMS mutation scope was subsequently addressed by
30000; it is no longer pending production application. Approved navigation/Story
reads and authorized server paths remain part of the intended hardened behavior.
See [Phase 1.7](security-remediation-phase-1.7.md) for the application scope.

## Migration 20000 scope correction

The original review described six statements for postgres and supabase_admin.
The executed revision contains only three postgres/public-schema default-ACL
revocations and a postgres-only assertion. The repository revision and regression
test preserve that scope. supabase_admin changes are deferred to an
already-authorized operator without new role memberships or elevation.

Global/default function privileges and managed schemas are outside this change.
Schema-scoped revocations cannot cancel global grants or PostgreSQL's built-in
PUBLIC EXECUTE default. New objects still require explicit safe privileges, RLS
and function EXECUTE revocations in their creation transaction.

## Audit history and private evidence

Raw production metadata, detailed policy/ACL inventories, source-export hashes,
recovery procedures and operator records belong in private storage. Preserve the
original report and full recovery packages with integrity hashes; publish only
this scoped status summary. Recovery preparation does not establish a successful
restore or hosted-runtime recovery rehearsal.

The earlier history export contained 20261104060532 and 20261104061451, neither
matching local migration filenames. A fresh post-rollout history export and
statement/effect comparison are still needed before future history adoption.
Manual execution is not evidence that tracking entries were recorded. No history
repair, baseline/seed replay or automatic migration push is authorized here.

## Acceptance boundary

The five-change production rollout is operator-confirmed complete. Function-body,
Storage, exposed-view, inherited-access and recoverability assessments remain
separate evidence requirements; no whole-database certification is implied.
See the [production status record](production-security-hardening-runbook.md) for
the release evidence boundary and private retention requirements.
