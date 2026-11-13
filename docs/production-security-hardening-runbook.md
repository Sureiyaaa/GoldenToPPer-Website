# Production security hardening - completed rollout

Status updated 2026-11-13 (Asia/Manila).

## Production status

The operator confirms that all five security migrations were manually applied in
production and passed their targeted database checks:

| Migration | Executed scope |
| --- | --- |
| 20261110005000_restrict_admin_rpc_execution.sql | Restrict the three reviewed privileged RPCs to authorized service callers |
| 20261110005500_restrict_verify_admin_login_rpc.sql | Restrict the reviewed login RPC |
| 20261110010000_harden_cms_browser_grants.sql | Restrict sensitive browser access and retain approved public navigation/Story reads |
| 20261110020000_scope_public_default_privileges.sql | Revised postgres-only public-schema defaults and postgres-only assertion |
| 20261110030000_harden_remaining_cms_mutations.sql | Remove remaining reviewed browser CMS mutations and preserve approved public reads |

The operator also reports successful Super Admin, non-Super Admin, CMS editing,
form submission and public website smoke tests. This is operator-provided
production evidence; repository checks do not independently reproduce it.
The earlier preparation-only and pending-execution decisions are superseded.
SQL header comments describing the original preparation state are historical;
this status record describes completion. Do not replay any of these migrations.

## Release synchronization

The public release includes the executed postgres-only 20000 scope and its updated
regression test, the intentional navbar login-disable and homepage news-image
placeholder fixes, and removal of obsolete credential text from README.md.
The obsolete credentials are reported as no longer relevant. Their removal does
not erase earlier Git history; no history rewrite is part of this release.

Retain the exact executed SQL, hashes, deployed application revision, operator
receipts and verification results in the private release record. The local 20000
revision matches the reported scope; byte-for-byte identity requires that private
execution evidence. No SQL execution or deployment is part of repository sync.

## Private recovery and operational records

Full preparation documents have been copied outside the public Git repository
before replacing them with these release summaries. Detailed 10000/30000 recovery
procedures, repair SQL, raw ACL/policy snapshots, their evidence-dependent tests,
backup material and operator records must remain private. Keep them together with
integrity hashes in access-controlled, backed-up storage. A local archive copy
alone does not establish off-device retention or a tested restore.

This public file contains no executable recovery or production collection
procedure. Recovery remains a separately reviewed operator action that preserves
RPC containment and private/browser denials. Do not restore broad browser grants.

## Remaining reconciliation and limits

The previously supplied migration-history export listed 20261104060532 and
20261104061451, neither matching local migration filenames. No fresh post-rollout
history export was inspected during this release preparation. Manual execution
does not prove tracking entries were created. Reconcile the private statements,
receipts and actual effects before any future migration-history adoption. Do not
replay baseline/seed files, invent tracking entries or run a blanket migration push.

Migration 20000 does not change supabase_admin defaults, global defaults or managed
schemas. That creator's default ACLs remain deferred work for an already-authorized
operator without new memberships/elevation. Schema-scoped revocations do not
cancel global grants or built-in PUBLIC EXECUTE on newly created functions.
Object creation still requires explicit safe ACLs, RLS and function revocations.

Completion of these five changes is not whole-system security certification.
Function bodies, Storage, exposed views, inherited access and backup/restore
assurance require their own retained evidence; this sync does not claim them
verified. No isolated build/preview was performed during this repository task.
