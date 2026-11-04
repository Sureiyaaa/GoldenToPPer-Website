-- Deploy before the application change: login fails closed without this RPC.
begin;

create table public.admin_login_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^(ip|username):[0-9a-f]{64}$'),
  attempts integer not null check (attempts between 1 and 31),
  expires_at timestamptz not null
);
create index admin_login_rate_limits_expires_at_idx
  on public.admin_login_rate_limits (expires_at);

alter table public.admin_login_rate_limits enable row level security;
revoke all on table public.admin_login_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_login_rate_limits to service_role;

create function public.consume_admin_login_rate_limit(p_bucket_key text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit integer;
  v_attempts integer;
  v_expires_at timestamptz;
begin
  if p_bucket_key is null or p_bucket_key !~ '^(ip|username):[0-9a-f]{64}$' then
    raise exception 'Invalid login rate-limit bucket';
  end if;
  v_limit := case when p_bucket_key like 'ip:%' then 30 else 5 end;

  -- ON CONFLICT locks the shared row and increments atomically. A separate
  -- read followed by a write would allow parallel requests past the limit.
  insert into public.admin_login_rate_limits as buckets (bucket_key, attempts, expires_at)
  values (p_bucket_key, 1, v_now + interval '15 minutes')
  on conflict (bucket_key) do update set
    attempts = case when buckets.expires_at <= v_now then 1
      else least(buckets.attempts + 1, v_limit + 1) end,
    expires_at = case when buckets.expires_at <= v_now then excluded.expires_at
      else buckets.expires_at end
  returning attempts, expires_at into v_attempts, v_expires_at;

  -- Bound cleanup work and skip rows being used by another request. Remove
  -- buckets that expired over a day ago as login traffic arrives; no cron needed.
  delete from public.admin_login_rate_limits
  where bucket_key in (
    select bucket_key from public.admin_login_rate_limits
    where expires_at < v_now - interval '1 day'
    order by expires_at
    limit 100
    for update skip locked
  );

  return query select v_attempts <= v_limit,
    case when v_attempts <= v_limit then 0
      else greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer) end;
end;
$$;

revoke all on function public.consume_admin_login_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_admin_login_rate_limit(text) to service_role;

commit;
