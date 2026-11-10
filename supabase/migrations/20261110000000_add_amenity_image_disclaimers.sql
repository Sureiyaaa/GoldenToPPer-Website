alter table public.amenities
  add column if not exists disclaimer_enabled boolean not null default false,
  add column if not exists disclaimer_text text not null default 'Architect''s vision only.';
