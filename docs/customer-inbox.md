# Customer Inbox implementation

Customer Inbox is available at `/admin/dashboard?section=Customer%20Inbox` and near the end of the existing primary sidebar destinations. The existing notification bell remains in the header and links to the full inbox.

## Repository and schema inspection

Reviewed `app/admin/dashboard/page.tsx` (NotificationCenter, manager sections, sidebar routing, permission filtering and HomeDashboard), `app/actions/admin_fetchers.ts`, `app/actions/auth.ts`, `app/actions/permissions.ts`, `app/admin/hooks/useRBAC.ts`, `app/admin/layout.tsx`, `app/layout.tsx`, `utils/supabase.ts`, `utils/supabase/client.ts`, `lib/supabase/client.ts`, public inquiry/contact submission references, `app/partnerbanks/page.tsx` and `app/partnerbanks/partnerbanksclient.tsx`, `app/globals.css`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts` and tracked file listings.

The repository contains no database types, schema definitions, SQL migrations or AGENTS.md files. Read-only Supabase OpenAPI inspection on October 5, 2026 confirmed:

- `loan_preapp.client_id` references `client.id`.
- `loan_preapp.project_id` references `project_table.id`.
- `loan_preapp.banks_id` references `banks.id`.
- Loan fields are `id`, `client_id`, `project_id`, `banks_id`, `tower`, `unit_no`, `floor_no`, `co_buyer_name`, `is_agreed`, and `created_at`.
- Existing read junctions use UUID admin IDs, integer source IDs, composite primary keys and `read_at` timestamps.
- The exposed schema includes `admin_inquire_reads` and `admin_contact_reads`, but no loan read junction or loan read RPC. No equivalent mechanism was found in the repository.

All three exact joined select queries were checked against Supabase with `limit=0`, returning HTTP 200 without retrieving customer records.

## Changed files and behavior

| File | Purpose |
| --- | --- |
| `lib/customer-inbox.ts` | Discriminated model, normalization, source row types, stable source-and-ID keys, labels, search/read/type filters, Manila dates, safe mailto generation. |
| `app/actions/admin_fetchers.ts` | Extend existing notification action with three paged joined sources, server RBAC, authenticated per-admin read state, explicit supported mutation types and error handling. |
| `app/admin/components/customer-inbox.tsx` | Shared data/realtime provider, retained bell, responsive inbox workspace and common accessible detail dialog. |
| `app/admin/dashboard/page.tsx` | Add menu permission mapping, shared provider, inbox rendering guard and responsive inbox padding; use the shared bell component. |
| `tests/customer-inbox.test.cjs` | Fixture-based regression tests with mocked Supabase/auth boundaries. |
| `docs/customer-inbox.md` | Implementation report and unexecuted database proposal. |

`inquire` becomes `inquiry`, `contact` becomes `customer_support`, and `loan_preapp` becomes `loan_application`. All sources provide sender contact details, title, date, read state and whether marking read is supported. Inquiry items carry the project; support items carry the actual message; loan items carry project, bank, tower, unit, floor, co-buyer and terms agreement. Nullable joins have explicit fallbacks and zero-valued unit/floor values are preserved. All sources sort together by newest date, with stable keys preventing ID collisions across sources.

The shared server action fetches joined records in pages of 500, honors the returned total if the server imposes a smaller response cap, and deduplicates each source. It makes no per-record queries. The full inbox is not truncated to the old 50-row source limit. The compact bell renders the most recent 20 records and counts unread items across the shared dataset.

Search covers sender, email, phone, title, project, bank and support message. Type and read filters share the same model. Loading, empty, no-match, fetch-error/retry and read-save-error states are visible. Desktop uses a semantic table; smaller widths use stacked rows. Common details and safe email replies use one dialog with native modality, explicit keyboard focus cycling and focus restoration.

## Permissions and state consistency

The sidebar, bell and inbox rendering use existing `notifications_code.can_view`. Unauthorized URL section selection cannot render the inbox. Super Admin retains access. Server fetch and read mutations independently enforce the same permission through the existing active-user/group RBAC profile. Read mutations derive the admin ID from the signed session rather than browser input.

Inquiry/support read status persists in the existing per-admin junctions. Mark-read is idempotent, mark-unread removes only the current admin's junction, unsupported types are rejected, and database errors propagate. Bell, list and dialog share one state store. The interface updates read status only after a successful server response. Fetches started before a successful mutation are discarded and refreshed to avoid stale read-state overwrites.

**Loan applications currently have no persisted per-admin read/unread mechanism.** They remain unread, are included in unread counts/filters, display `Unread · untracked`, and expose no read toggle. Opening a loan never submits a read mutation or pretends to persist state.

## Realtime and ordinary refresh

One stable browser client and one `customer-inbox` channel subscribe to INSERT on `inquire`, `contact` and `loan_preapp`. Cleanup removes the channel and window focus listener. Events refresh both views through the shared server action; repeated events coalesce into the same fetch stream. Opening the bell, the inbox Refresh button and returning focus to the window also fetch normally. Realtime errors show a restrained availability note without preventing normal fetches.

Live delivery depends on the existing Supabase publication and browser permissions. No publication, RLS policy or authentication changes were made. Tests simulate events; no live public submissions were created for validation.

## Proposed loan read tracking SQL — review only

Do not run this automatically. This proposal creates only the new loan read junction after explicit approval; it does not alter existing tables or policies. Column types match the inspected database. No migration file has been created and no SQL below has been executed.

```sql
begin;

create table public.admin_loan_preapp_reads (
  admin_id uuid not null
    references public.admin_users(id) on delete cascade,
  loan_preapp_id integer not null
    references public.loan_preapp(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (admin_id, loan_preapp_id)
);

create index admin_loan_preapp_reads_loan_preapp_id_idx
  on public.admin_loan_preapp_reads (loan_preapp_id);

alter table public.admin_loan_preapp_reads enable row level security;
revoke all on public.admin_loan_preapp_reads from anon, authenticated;
grant select, insert, delete on public.admin_loan_preapp_reads to service_role;

commit;
```

No browser policies are proposed because this dashboard uses a custom signed session and server-side service-role actions. After schema approval and creation, extend the loan select with `admin_loan_preapp_reads(admin_id)`, filter the embedded relation to the current admin, normalize that state, set `can_mark_read: true`, and handle the loan case explicitly in `toggleNotificationReadAction`. Applying SQL alone will not enable read controls in this implementation.

## Preserved scope and follow-up

Existing Supabase tables, RLS, functions, permissions, production customer records, public forms and the Partner Banks submission architecture are unchanged. No destructive inbox actions were added. HomeDashboard cards control public website sections and visibility, so Customer Inbox was intentionally excluded from that collection. Existing Projects, Promotions, Partner Banks, News and Home rendering paths remain in place.

The full dataset is loaded for local search/filtering and accurate counts. If inbox volume grows substantially, server-side pagination/search is a future improvement. Live realtime and real-account integration remain deployment checks. The checkout's existing lint configuration and implicit type-package issues need separate dependency maintenance; they were not changed for this feature.

Run repeatable regression tests with `node --test tests/customer-inbox.test.cjs`.