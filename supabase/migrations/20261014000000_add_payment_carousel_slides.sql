-- Migration: Add Payment Carousel Slides CMS
-- Date: 2026-10-14
-- Description: Create payment_carousel_slides table for admin-managed carousel configuration
--              Supports default showcase (project_id IS NULL) and project-specific slides

begin;

create table public.payment_carousel_slides (
  id bigserial primary key,

  project_id integer
    references public.project_table(id) on delete cascade,

  image_url text not null,

  sort_order integer not null default 0
    check (sort_order >= 0),

  focal_x numeric(4,1) not null default 50.0
    check (focal_x >= 0.0 and focal_x <= 100.0),

  focal_y numeric(4,1) not null default 50.0
    check (focal_y >= 0.0 and focal_y <= 100.0),

  alt_text text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for querying slides by project and sort order (common query pattern)
create index payment_carousel_slides_project_sort_idx
  on public.payment_carousel_slides (project_id, sort_order);

-- Index for querying active slides by project (filtering pattern)
create index payment_carousel_slides_active_project_idx
  on public.payment_carousel_slides (is_active, project_id);

-- Enable RLS: no public/authenticated access, only service_role
alter table public.payment_carousel_slides enable row level security;

revoke all on public.payment_carousel_slides from anon, authenticated;
grant select, insert, update, delete on public.payment_carousel_slides to service_role;

-- Grant sequence privileges for INSERT operations
grant usage, select on sequence public.payment_carousel_slides_id_seq to service_role;

-- Register payment_carousel module in RBAC (idempotent)
-- Note: No group permissions granted here; SUPER_ADMIN gets automatic access via existing bypass
-- Other groups must be explicitly granted via module_access table
insert into public.modules (module_code)
values ('payment_carousel')
on conflict do nothing;

commit;
