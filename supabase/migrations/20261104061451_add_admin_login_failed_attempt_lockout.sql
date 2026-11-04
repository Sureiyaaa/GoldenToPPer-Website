-- Adds failure-only account lockouts without changing the existing IP limiter.
begin;

create table public.admin_login_account_limits (
  bucket_key text primary key check (bucket_key ~ '^username:[0-9a-f]{64}$'),
  failures integer not null default 0 check (failures between 0 and 5),
  window_expires_at timestamptz not null,
  locked_until timestamptz,
  attempt_token uuid,
  attempt_expires_at timestamptz,
  check ((attempt_token is null) = (attempt_expires_at is null))
);
create index admin_login_account_limits_expiry_idx
  on public.admin_login_account_limits (window_expires_at);
alter table public.admin_login_account_limits enable row level security;
revoke all on table public.admin_login_account_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_login_account_limits to service_role;

create function public.begin_admin_login_attempt(p_bucket_key text)
returns table (status text, retry_after_seconds integer, attempt_token uuid)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_account public.admin_login_account_limits%rowtype;
  v_token uuid;
begin
  if p_bucket_key is null or p_bucket_key !~ '^username:[0-9a-f]{64}$' then
    raise exception 'Invalid login account bucket';
  end if;

  insert into public.admin_login_account_limits (bucket_key, window_expires_at)
  values (p_bucket_key, v_now + interval '15 minutes')
  on conflict (bucket_key) do nothing;
  select * into strict v_account from public.admin_login_account_limits
    where bucket_key = p_bucket_key for update;
  v_now := clock_timestamp();

  -- An active lock takes precedence over the older failure-counting window.
  if v_account.locked_until > v_now then
    return query select 'locked'::text,
      greatest(1, ceil(extract(epoch from (v_account.locked_until - v_now)))::integer), null::uuid;
    return;
  end if;

  -- Admit one password check per account at a time. A short server-only lease
  -- closes the parallel-request race without counting successful logins as failures.
  if v_account.attempt_expires_at > v_now then
    return query select 'busy'::text,
      greatest(1, ceil(extract(epoch from (v_account.attempt_expires_at - v_now)))::integer), null::uuid;
    return;
  end if;

  if v_account.locked_until is not null or v_account.window_expires_at <= v_now then
    update public.admin_login_account_limits set failures = 0, locked_until = null,
      window_expires_at = v_now + interval '15 minutes'
      where bucket_key = p_bucket_key;
  end if;

  v_token := gen_random_uuid();
  update public.admin_login_account_limits set attempt_token = v_token,
    attempt_expires_at = v_now + interval '30 seconds' where bucket_key = p_bucket_key;

  delete from public.admin_login_account_limits where bucket_key in (
    select bucket_key from public.admin_login_account_limits
    where window_expires_at < v_now - interval '1 day'
      and (locked_until is null or locked_until < v_now)
      and (attempt_expires_at is null or attempt_expires_at < v_now)
    order by window_expires_at limit 100 for update skip locked
  );
  return query select 'allowed'::text, 0, v_token;
end;
$$;

create function public.complete_admin_login_attempt(
  p_bucket_key text, p_attempt_token uuid, p_succeeded boolean
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_now timestamptz;
  v_account public.admin_login_account_limits%rowtype;
  v_failures integer;
begin
  select * into v_account from public.admin_login_account_limits
    where bucket_key = p_bucket_key for update;
  v_now := clock_timestamp();
  if not found or p_attempt_token is null or p_succeeded is null
      or v_account.attempt_token is distinct from p_attempt_token
      or v_account.attempt_expires_at <= v_now then
    raise exception 'Login attempt expired or was already completed';
  end if;

  if p_succeeded then
    update public.admin_login_account_limits set failures = 0, locked_until = null,
      attempt_token = null, attempt_expires_at = null,
      window_expires_at = v_now + interval '15 minutes' where bucket_key = p_bucket_key;
    return query select true, 0;
    return;
  end if;

  v_failures := case when v_account.window_expires_at <= v_now then 1
    else v_account.failures + 1 end;
  update public.admin_login_account_limits set failures = v_failures,
    locked_until = case when v_failures >= 5 then v_now + interval '5 minutes' else null end,
    window_expires_at = case when v_account.window_expires_at <= v_now
      then v_now + interval '15 minutes' else window_expires_at end,
    attempt_token = null, attempt_expires_at = null where bucket_key = p_bucket_key;

  -- Return the lock immediately on failure #5, so its response starts the UI timer.
  return query select v_failures < 5, case when v_failures >= 5 then 300 else 0 end;
end;
$$;

revoke all on function public.begin_admin_login_attempt(text) from public, anon, authenticated;
revoke all on function public.complete_admin_login_attempt(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.begin_admin_login_attempt(text) to service_role;
grant execute on function public.complete_admin_login_attempt(text, uuid, boolean) to service_role;

commit;
