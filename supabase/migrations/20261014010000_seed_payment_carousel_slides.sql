-- Phase 3A: Seed Payment Carousel Content
-- Date: 2026-10-14
-- Environment: Development/Staging (bozkbnqydmpadcbbwpnb)
--
-- This migration populates payment_carousel_slides with the current static
-- Payment carousel configuration from app/payment/paymentclient.tsx.
--
-- IMPORTANT HERO RULE:
-- Project heroes are NOT seeded here. They remain sourced from project_table.image
-- and are managed through the Projects admin interface. The carousel displays:
--   project_table.image (hero) + payment_carousel_slides custom rows
--
-- This migration seeds ONLY the custom slide content.
--
-- Idempotency Strategy:
-- - Uses NOT EXISTS checks to prevent duplicate rows on re-application
-- - Matches on project_id + image_url combination for Default Showcase
-- - All rows inserted only if matching row does not already exist
-- - All rows are inserted with is_active=true and focal_x/y=50.0 (baseline)
--
-- Project Resolution:
-- - Resolves project IDs dynamically using slug, not hardcoded values
-- - Validates each expected project exists exactly once (is_active=true, deleted_at IS NULL)
-- - Fails migration if any required project is missing or duplicate
--
-- Counts:
-- - Default Showcase: 8 slides (project_id=NULL)
-- - City Clou custom: 9 slides (project_id resolved by slug '/cityclou')
-- - El Sol custom: 7 slides (project_id resolved by slug '/elsol')
-- - La Vida custom: 6 slides (project_id resolved by slug '/lavida')
-- - Park One custom: 3 slides (project_id resolved by slug '/parkone')
-- TOTAL: 33 slides

begin;

-- PRE-FLIGHT VALIDATION
-- Verify each required project exists exactly once with correct state
-- If any validation fails, the entire transaction rolls back

do $$
declare
  city_clou_id integer;
  el_sol_id integer;
  la_vida_id integer;
  park_one_id integer;
  city_clou_count integer;
  el_sol_count integer;
  la_vida_count integer;
  park_one_count integer;
begin
  -- Validate City Clou exists exactly once
  select count(*) into city_clou_count
  from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null;

  if city_clou_count = 0 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: City Clou project not found. Expected: slug=''/cityclou'', is_active=true, deleted_at=NULL';
  elsif city_clou_count > 1 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: City Clou project has duplicate entries. Found % rows with slug=''/cityclou'', is_active=true, deleted_at=NULL', city_clou_count;
  end if;

  -- Validate El Sol exists exactly once
  select count(*) into el_sol_count
  from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null;

  if el_sol_count = 0 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: El Sol project not found. Expected: slug=''/elsol'', is_active=true, deleted_at=NULL';
  elsif el_sol_count > 1 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: El Sol project has duplicate entries. Found % rows with slug=''/elsol'', is_active=true, deleted_at=NULL', el_sol_count;
  end if;

  -- Validate La Vida exists exactly once
  select count(*) into la_vida_count
  from public.project_table
  where slug = '/lavida'
    and is_active = true
    and deleted_at is null;

  if la_vida_count = 0 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: La Vida project not found. Expected: slug=''/lavida'', is_active=true, deleted_at=NULL';
  elsif la_vida_count > 1 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: La Vida project has duplicate entries. Found % rows with slug=''/lavida'', is_active=true, deleted_at=NULL', la_vida_count;
  end if;

  -- Validate Park One exists exactly once
  select count(*) into park_one_count
  from public.project_table
  where slug = '/parkone'
    and is_active = true
    and deleted_at is null;

  if park_one_count = 0 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: Park One project not found. Expected: slug=''/parkone'', is_active=true, deleted_at=NULL';
  elsif park_one_count > 1 then
    raise exception 'PRE-FLIGHT VALIDATION FAILED: Park One project has duplicate entries. Found % rows with slug=''/parkone'', is_active=true, deleted_at=NULL', park_one_count;
  end if;

  raise notice 'PRE-FLIGHT VALIDATION PASSED: All 4 required projects exist exactly once';
end $$;

-- DEFAULT SHOWCASE (project_id = NULL)
-- Expanded from GENERAL_SHOWCASE_IMAGES array in paymentclient.tsx
-- Insert only if not already present (NOT EXISTS)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null as project_id,
  '/images/projects/City_Clou_image.png' as image_url,
  0 as sort_order,
  50.0 as focal_x,
  50.0 as focal_y,
  true as is_active,
  'City Clou - Golden ToPPer' as alt_text
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/City_Clou_image.png'
);

insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null,
  '/images/projects/park-one.webp',
  1,
  50.0, 50.0, true,
  'Park One - Golden ToPPer'
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/park-one.webp'
);

insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null,
  '/images/projects/lavida-dedicated.webp',
  2,
  50.0, 50.0, true,
  'La Vida - Golden ToPPer'
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/lavida-dedicated.webp'
);

insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null,
  '/images/projects/el_sol_projects.webp',
  3,
  50.0, 50.0, true,
  'El Sol - Golden ToPPer'
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/el_sol_projects.webp'
);

insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null,
  '/images/projects/city-clou-amenities/function_room_cityclou.webp',
  4,
  50.0, 50.0, true,
  'City Clou Function Room'
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/city-clou-amenities/function_room_cityclou.webp'
);

insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null,
  '/images/projects/park-one-amenities/gym_with_yoga_room_parkone.jpg',
  5,
  50.0, 50.0, true,
  'Park One Gym & Yoga'
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/park-one-amenities/gym_with_yoga_room_parkone.jpg'
);

insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null,
  '/images/projects/la-vida-amenities/lap_pool_lavida.webp',
  6,
  50.0, 50.0, true,
  'La Vida Lap Pool'
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/la-vida-amenities/lap_pool_lavida.webp'
);

insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  null,
  '/images/projects/el-sol-amenities/lounge_and_bar.webp',
  7,
  50.0, 50.0, true,
  'El Sol Lounge & Bar'
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id is null
    and pcs.image_url = '/images/projects/el-sol-amenities/lounge_and_bar.webp'
);

-- CITY CLOU CUSTOM SLIDES (project_id resolved by slug '/cityclou')
-- From PROJECT_AMENITIES[1] in paymentclient.tsx
-- Each insert uses a CTE to resolve project_id, ensuring it cannot be NULL
with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/dedicated_retail_area_city-clou.webp',
  0, 50.0, 50.0, true,
  'Dedicated Retail Area'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/dedicated_retail_area_city-clou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/lap_pool_city-clou.webp',
  1, 50.0, 50.0, true,
  'Lap Pool'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/lap_pool_city-clou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/gameroom_cityclou.webp',
  2, 50.0, 50.0, true,
  'Game Room'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/gameroom_cityclou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/playroom_cityclou.webp',
  3, 50.0, 50.0, true,
  'Playroom'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/playroom_cityclou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/lounge_cityclou.webp',
  4, 50.0, 50.0, true,
  'Lounge'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/lounge_cityclou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/library_cityclou.webp',
  5, 50.0, 50.0, true,
  'Library'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/library_cityclou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/function_room_cityclou.webp',
  6, 50.0, 50.0, true,
  'Function Room'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/function_room_cityclou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/gym_cityclou.webp',
  7, 50.0, 50.0, true,
  'Gym'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/gym_cityclou.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/cityclou'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/city-clou-amenities/yoga_cityclou.webp',
  8, 50.0, 50.0, true,
  'Yoga Room'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/city-clou-amenities/yoga_cityclou.webp'
);

-- EL SOL CUSTOM SLIDES (project_id resolved by slug '/elsol')
-- From PROJECT_AMENITIES[2] in paymentclient.tsx
with target_project as (
  select id from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/el-sol-amenities/lounge_and_bar.webp',
  0, 50.0, 50.0, true,
  'Lounge & Bar'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/el-sol-amenities/lounge_and_bar.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/el-sol-amenities/swimming_pool_with_kiddie_pool.webp',
  1, 50.0, 50.0, true,
  'Swimming Pool & Kiddie Pool'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/el-sol-amenities/swimming_pool_with_kiddie_pool.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/el-sol-amenities/function_rooms_el_sol.webp',
  2, 50.0, 50.0, true,
  'Function Rooms'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/el-sol-amenities/function_rooms_el_sol.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/el-sol-amenities/outdoor_bar_and_lounge.webp',
  3, 50.0, 50.0, true,
  'Outdoor Bar & Lounge'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/el-sol-amenities/outdoor_bar_and_lounge.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/el-sol-amenities/gym_with_yoga_room.webp',
  4, 50.0, 50.0, true,
  'Gym with Yoga Room'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/el-sol-amenities/gym_with_yoga_room.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/el-sol-amenities/recreational_court.webp',
  5, 50.0, 50.0, true,
  'Recreational Court'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/el-sol-amenities/recreational_court.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/elsol'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/el-sol-amenities/childrens_playroom.webp',
  6, 50.0, 50.0, true,
  'Children''s Playroom'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/el-sol-amenities/childrens_playroom.webp'
);

-- LA VIDA CUSTOM SLIDES (project_id resolved by slug '/lavida')
-- From PROJECT_AMENITIES[3] in paymentclient.tsx
with target_project as (
  select id from public.project_table
  where slug = '/lavida'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/la-vida-amenities/dedicated_retail_area_lavida.webp',
  0, 50.0, 50.0, true,
  'Dedicated Retail Area'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/la-vida-amenities/dedicated_retail_area_lavida.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/lavida'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/la-vida-amenities/kids_playroom_lavida.webp',
  1, 50.0, 50.0, true,
  'Kids Playroom'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/la-vida-amenities/kids_playroom_lavida.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/lavida'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/la-vida-amenities/lap_pool_lavida.webp',
  2, 50.0, 50.0, true,
  'Lap Pool'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/la-vida-amenities/lap_pool_lavida.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/lavida'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/la-vida-amenities/function_rooms_lavida.webp',
  3, 50.0, 50.0, true,
  'Function Rooms'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/la-vida-amenities/function_rooms_lavida.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/lavida'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/la-vida-amenities/kiddie_pool_lavida.webp',
  4, 50.0, 50.0, true,
  'Kiddie Pool'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/la-vida-amenities/kiddie_pool_lavida.webp'
);

with target_project as (
  select id from public.project_table
  where slug = '/lavida'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/la-vida-amenities/jogging_trail_lavida.webp',
  5, 50.0, 50.0, true,
  'Jogging Trail'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/la-vida-amenities/jogging_trail_lavida.webp'
);

-- PARK ONE CUSTOM SLIDES (project_id resolved by slug '/parkone')
-- From PROJECT_AMENITIES[4] in paymentclient.tsx
with target_project as (
  select id from public.project_table
  where slug = '/parkone'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/park-one-amenities/lap-pool-parkone.jpg',
  0, 50.0, 50.0, true,
  'Lap Pool'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/park-one-amenities/lap-pool-parkone.jpg'
);

with target_project as (
  select id from public.project_table
  where slug = '/parkone'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/park-one-amenities/gym_with_yoga_room_parkone.jpg',
  1, 50.0, 50.0, true,
  'Gym with Yoga Room'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/park-one-amenities/gym_with_yoga_room_parkone.jpg'
);

with target_project as (
  select id from public.project_table
  where slug = '/parkone'
    and is_active = true
    and deleted_at is null
)
insert into public.payment_carousel_slides
  (project_id, image_url, sort_order, focal_x, focal_y, is_active, alt_text)
select
  tp.id,
  '/images/projects/park-one-amenities/function_rooms_parkone.jpg',
  2, 50.0, 50.0, true,
  'Function Rooms'
from target_project tp
where not exists (
  select 1 from public.payment_carousel_slides pcs
  where pcs.project_id = tp.id
    and pcs.image_url = '/images/projects/park-one-amenities/function_rooms_parkone.jpg'
);

commit;
