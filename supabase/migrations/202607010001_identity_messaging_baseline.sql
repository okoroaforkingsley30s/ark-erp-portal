-- Reproducible foundation for authentication profiles, notifications and Gmail.
-- This migration intentionally precedes all July 9/18 hardening migrations.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  phone text,
  employee_id text,
  department text,
  branch text,
  region text,
  role text,
  status text not null default 'pending',
  approval_status text not null default 'pending',
  account_status text not null default 'active',
  is_approved boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  employee_id text,
  department text,
  role text,
  account_status text not null default 'active',
  is_approved boolean not null default false,
  must_change_password boolean not null default false,
  last_login timestamptz,
  last_seen timestamptz,
  online_status text not null default 'offline',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  recipient_email text,
  title text not null,
  message_body text not null,
  type text not null default 'system',
  read boolean not null default false,
  is_read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  link text,
  sound text,
  related_user_id uuid,
  related_user_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  provider text not null default 'gmail',
  access_token text not null,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  is_active boolean not null default true,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text,
  gmail_thread_id text,
  sender_email text,
  recipient_email text,
  cc text,
  bcc text,
  subject text,
  message_body text,
  snippet text,
  direction text not null default 'received',
  email_status text,
  folder text,
  is_sent boolean not null default false,
  is_read boolean not null default false,
  is_draft boolean not null default false,
  archived_status boolean not null default false,
  replied_status boolean not null default false,
  raw_headers jsonb not null default '[]'::jsonb,
  received_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  message_type text not null default 'channel',
  channel_name text,
  sender_id text not null,
  sender_name text,
  sender_role text,
  recipient_id text,
  recipient_name text,
  message text not null,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive duplicate guards are installed only when the existing data
-- is already clean. The security audit reports any legacy duplicates otherwise.
do $$
begin
  if not exists (
    select 1 from public.users group by lower(email) having count(*) > 1
  ) then
    create unique index if not exists users_email_lower_uidx on public.users (lower(email));
  end if;
  if not exists (
    select 1 from public.user_profiles group by lower(user_email) having count(*) > 1
  ) then
    create unique index if not exists user_profiles_email_lower_uidx on public.user_profiles (lower(user_email));
  end if;
end
$$;

with ranked_connections as (
  select id, row_number() over (
    partition by user_id order by connected_at desc, id desc
  ) as position
  from public.gmail_connections where is_active is true
)
update public.gmail_connections connection
set is_active = false, updated_at = now()
from ranked_connections ranked
where connection.id = ranked.id and ranked.position > 1;

create unique index if not exists gmail_connections_one_active_per_user_uidx
  on public.gmail_connections (user_id) where is_active is true;
create index if not exists notifications_recipient_created_idx
  on public.notifications (lower(coalesce(recipient_email, user_email)), created_at desc);
create index if not exists email_messages_owner_created_idx
  on public.email_messages (created_by, created_at desc);
create index if not exists chat_messages_channel_created_idx
  on public.chat_messages (channel_name, created_at);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_approval_status_guard') then
    alter table public.users add constraint users_approval_status_guard
      check (approval_status in ('pending','approved','rejected')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_account_status_guard') then
    alter table public.users add constraint users_account_status_guard
      check (account_status in ('active','inactive','suspended','deleted')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_type_guard') then
    alter table public.chat_messages add constraint chat_messages_type_guard
      check (message_type in ('channel','dm')) not valid;
  end if;
end
$$;
