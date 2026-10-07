-- Migration: Add loan pre-application read tracking
-- Date: 2026-10-07
-- Description: Create admin_loan_preapp_reads table to persist per-admin read/unread state for loan applications

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
