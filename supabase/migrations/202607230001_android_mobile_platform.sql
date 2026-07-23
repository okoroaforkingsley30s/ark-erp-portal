begin;

create table if not exists public.ark_mobile_devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  push_token text not null unique,
  platform text not null default 'android',
  device_label text,
  sound_key text not null default 'ark_default'
    check (sound_key in ('ark_default', 'ark_chime', 'ark_alert')),
  active boolean not null default true,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  location_recorded_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ark_mobile_devices_user_email_idx
  on public.ark_mobile_devices (lower(user_email), active);

alter table public.ark_mobile_devices enable row level security;
revoke all on public.ark_mobile_devices from anon;
grant select on public.ark_mobile_devices to authenticated;

drop policy if exists ark_mobile_devices_own_read on public.ark_mobile_devices;
create policy ark_mobile_devices_own_read
on public.ark_mobile_devices for select
to authenticated
using (auth_user_id = auth.uid());

create table if not exists public.ark_mobile_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id text not null,
  mobile_device_id uuid not null references public.ark_mobile_devices(id) on delete cascade,
  title text not null,
  message text not null,
  link text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'retry', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, mobile_device_id)
);

alter table public.ark_mobile_push_outbox enable row level security;
revoke all on public.ark_mobile_push_outbox from public, anon, authenticated;

create or replace function public.ark_register_mobile_device(
  p_push_token text,
  p_platform text default 'android',
  p_sound_key text default 'ark_default',
  p_device_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  result_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(trim(p_push_token), '') is null then
    raise exception 'Push token is required' using errcode = '22023';
  end if;
  if p_sound_key not in ('ark_default', 'ark_chime', 'ark_alert') then
    raise exception 'Unsupported notification sound' using errcode = '22023';
  end if;

  select lower(email) into actor_email from auth.users where id = actor_id;

  insert into public.ark_mobile_devices (
    auth_user_id, user_email, push_token, platform, sound_key,
    device_label, active, last_seen_at, updated_at
  )
  values (
    actor_id, actor_email, trim(p_push_token), coalesce(nullif(trim(p_platform), ''), 'android'),
    p_sound_key, nullif(trim(p_device_label), ''), true, now(), now()
  )
  on conflict (push_token) do update
  set auth_user_id = excluded.auth_user_id,
      user_email = excluded.user_email,
      platform = excluded.platform,
      sound_key = excluded.sound_key,
      device_label = excluded.device_label,
      active = true,
      last_seen_at = now(),
      updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.ark_set_mobile_notification_sound(p_sound_key text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_sound_key not in ('ark_default', 'ark_chime', 'ark_alert') then
    raise exception 'Unsupported notification sound' using errcode = '22023';
  end if;

  update public.ark_mobile_devices
  set sound_key = p_sound_key, updated_at = now(), last_seen_at = now()
  where auth_user_id = auth.uid() and active;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.ark_update_mobile_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_recorded_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid GPS coordinates' using errcode = '22023';
  end if;

  update public.ark_mobile_devices
  set latitude = p_latitude,
      longitude = p_longitude,
      accuracy_meters = p_accuracy_meters,
      location_recorded_at = coalesce(p_recorded_at, now()),
      last_seen_at = now(),
      updated_at = now()
  where auth_user_id = auth.uid() and active;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on function public.ark_register_mobile_device(text,text,text,text) to authenticated;
grant execute on function public.ark_set_mobile_notification_sound(text) to authenticated;
grant execute on function public.ark_update_mobile_location(double precision,double precision,double precision,timestamptz) to authenticated;

create or replace function public.ark_queue_mobile_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  notification jsonb := to_jsonb(new);
  recipient text;
  notification_payload jsonb;
begin
  recipient := lower(coalesce(
    nullif(notification ->> 'user_email', ''),
    nullif(notification ->> 'recipient_email', ''),
    nullif(notification ->> 'email', '')
  ));

  notification_payload := case
    when jsonb_typeof(notification -> 'data') = 'object' then notification -> 'data'
    when jsonb_typeof(notification -> 'metadata') = 'object' then notification -> 'metadata'
    else '{}'::jsonb
  end;

  if recipient is null then
    return new;
  end if;

  insert into public.ark_mobile_push_outbox (
    notification_id, mobile_device_id, title, message, link, payload
  )
  select
    notification ->> 'id',
    device.id,
    coalesce(nullif(notification ->> 'title', ''), 'ARK ONE'),
    coalesce(
      nullif(notification ->> 'message', ''),
      nullif(notification ->> 'message_body', ''),
      nullif(notification ->> 'body', ''),
      'You have a new ARK ONE notification'
    ),
    coalesce(
      nullif(notification ->> 'link', ''),
      nullif(notification ->> 'target_url', ''),
      '/notifications'
    ),
    notification_payload
  from public.ark_mobile_devices device
  where device.active
    and lower(device.user_email) = recipient;
  return new;
end;
$$;

drop trigger if exists ark_notifications_mobile_push_trigger on public.notifications;
create trigger ark_notifications_mobile_push_trigger
after insert on public.notifications
for each row execute function public.ark_queue_mobile_push();

commit;
