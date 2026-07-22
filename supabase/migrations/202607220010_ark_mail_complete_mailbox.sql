-- Complete ARK Mail mailbox state, privacy and Helpdesk conversion contract.

alter table public.email_messages
  add column if not exists label_ids text[] not null default '{}'::text[],
  add column if not exists is_starred boolean not null default false,
  add column if not exists is_snoozed boolean not null default false,
  add column if not exists is_spam boolean not null default false,
  add column if not exists is_trash boolean not null default false,
  add column if not exists snoozed_until timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists last_provider_error text;

alter table public.email_messages
  add column if not exists gmail_draft_id text;

alter table public.gmail_connections
  add column if not exists gmail_history_id text,
  add column if not exists next_page_token text,
  add column if not exists initial_sync_complete boolean not null default false,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_error text;

create index if not exists email_messages_owner_folder_received_idx
  on public.email_messages(created_by, folder, received_at desc);
create index if not exists email_messages_owner_thread_received_idx
  on public.email_messages(created_by, gmail_thread_id, received_at);
create index if not exists email_messages_owner_labels_gin_idx
  on public.email_messages using gin(label_ids);

-- Remove every legacy permissive mail policy. Policies are OR-combined, so an
-- owner policy is ineffective while any USING (true) policy remains.
drop policy if exists "Allow authenticated users full email access" on public.email_messages;
drop policy if exists "Users can read own emails" on public.email_messages;
drop policy if exists email_messages_all on public.email_messages;
drop policy if exists ark_email_messages_owner_all on public.email_messages;

create policy ark_email_messages_owner_read
on public.email_messages for select to authenticated
using (created_by = auth.uid());

-- Mail mutations are performed by identity-bound Edge Functions or narrow
-- security-definer RPCs. Browser sessions receive read-only table access.
revoke insert, update, delete on table public.email_messages from authenticated;
grant select on table public.email_messages to authenticated;

drop policy if exists "Users can read own gmail connection" on public.gmail_connections;
drop policy if exists ark_gmail_connections_owner_all on public.gmail_connections;
revoke all on table public.gmail_connections from authenticated;

create or replace function public.ark_gmail_connection_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'connected', true,
      'email', c.email,
      'provider', c.provider,
      'is_active', c.is_active,
      'connected_at', c.connected_at,
      'expires_at', c.expires_at,
      'initial_sync_complete', c.initial_sync_complete,
      'last_synced_at', c.last_synced_at,
      'last_sync_error', c.last_sync_error
    )
    from public.gmail_connections c
    where c.user_id = auth.uid() and c.is_active is true
    order by c.connected_at desc
    limit 1
  ), jsonb_build_object('connected', false));
$$;

revoke all on function public.ark_gmail_connection_status() from public, anon;
grant execute on function public.ark_gmail_connection_status() to authenticated;

create or replace function public.ark_mailbox_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'inbox', count(*) filter (where 'INBOX' = any(label_ids) and not is_trash and not is_spam),
    'unread', count(*) filter (where not is_read and 'INBOX' = any(label_ids) and not is_trash and not is_spam),
    'starred', count(*) filter (where is_starred and not is_trash),
    'snoozed', count(*) filter (where is_snoozed and not is_trash),
    'sent', count(*) filter (where 'SENT' = any(label_ids)),
    'drafts', count(*) filter (where 'DRAFT' = any(label_ids)),
    'scheduled', count(*) filter (where folder = 'scheduled'),
    'spam', count(*) filter (where is_spam),
    'trash', count(*) filter (where is_trash),
    'all', count(*) filter (where not is_trash and not is_spam)
  )
  from public.email_messages
  where created_by = auth.uid();
$$;

revoke all on function public.ark_mailbox_summary() from public, anon;
grant execute on function public.ark_mailbox_summary() to authenticated;

create table if not exists public.ark_scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_email text not null,
  recipient_email text not null,
  cc text,
  bcc text,
  subject text not null,
  message_body text not null,
  attachments jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','processing','sent','cancelled','failed')),
  gmail_message_id text,
  gmail_thread_id text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.ark_scheduled_emails enable row level security;
drop policy if exists ark_scheduled_emails_owner_read on public.ark_scheduled_emails;
create policy ark_scheduled_emails_owner_read
on public.ark_scheduled_emails for select to authenticated
using (user_id = auth.uid());
revoke insert, update, delete on table public.ark_scheduled_emails from authenticated;
grant select on table public.ark_scheduled_emails to authenticated;
create index if not exists ark_scheduled_emails_due_idx
  on public.ark_scheduled_emails(status, scheduled_at)
  where status = 'scheduled';

-- Helpdesk alone converts customer mail into a ticket. The selected message and
-- all messages in its Gmail thread are linked in the same database transaction.
create or replace function public.ark_helpdesk_convert_email_to_ticket(
  p_email_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mail_row public.email_messages%rowtype;
  new_ticket_id uuid;
  new_ticket_number text;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actual_client_email text;
begin
  if auth.uid() is null or public.ark_current_user_role() <> 'helpdesk' then
    raise exception 'Only Helpdesk may convert client mail to a ticket'
      using errcode = '42501';
  end if;

  select * into mail_row
  from public.email_messages
  where id = p_email_id and created_by = auth.uid()
  for update;

  if not found then
    raise exception 'Email not found' using errcode = 'P0002';
  end if;

  if mail_row.converted_to_ticket then
    raise exception 'This email conversation is already linked to a ticket'
      using errcode = '23505';
  end if;

  if mail_row.gmail_thread_id is not null and exists (
    select 1 from public.email_messages m
    where m.created_by = auth.uid()
      and m.gmail_thread_id = mail_row.gmail_thread_id
      and m.converted_to_ticket is true
  ) then
    raise exception 'This email conversation is already linked to a ticket'
      using errcode = '23505';
  end if;

  actual_client_email := lower(trim(coalesce(
    nullif(p_payload ->> 'client_email', ''),
    substring(mail_row.sender_email from '<([^>]+)>'),
    mail_row.sender_email
  )));

  new_ticket_id := gen_random_uuid();
  new_ticket_number := 'TCK-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.tickets(
    id, ticket_id, ticket_number, title, description, category, priority,
    client_email, client_name, bank_name, branch_name, terminal_id, device_name,
    assigned_to_name, assigned_to, assigned_engineer_email, sla_level,
    status, attachments, department, created_at, updated_at, last_action_at,
    assigned_at
  ) values (
    new_ticket_id, new_ticket_number, new_ticket_number,
    nullif(trim(p_payload ->> 'title'), ''),
    nullif(trim(p_payload ->> 'description'), ''),
    coalesce(nullif(trim(p_payload ->> 'category'), ''), 'general'),
    coalesce(nullif(trim(p_payload ->> 'priority'), ''), 'medium'),
    actual_client_email,
    coalesce(nullif(trim(p_payload ->> 'client_name'), ''), actual_client_email),
    nullif(trim(p_payload ->> 'bank_name'), ''),
    nullif(trim(p_payload ->> 'branch_name'), ''),
    nullif(trim(p_payload ->> 'terminal_id'), ''),
    nullif(trim(p_payload ->> 'device_name'), ''),
    nullif(trim(p_payload ->> 'assigned_to_name'), ''),
    nullif(trim(p_payload ->> 'assigned_to'), ''),
    nullif(trim(p_payload ->> 'assigned_to'), ''),
    coalesce(nullif(trim(p_payload ->> 'sla_level'), ''), 'standard'),
    case when nullif(trim(p_payload ->> 'assigned_to'), '') is null then 'new' else 'assigned' end,
    coalesce(p_payload -> 'attachments', '[]'::jsonb),
    'Helpdesk', now(), now(), now(),
    case when nullif(trim(p_payload ->> 'assigned_to'), '') is null then null else now() end
  );

  update public.email_messages
  set converted_to_ticket = true,
      linked_ticket_id = new_ticket_id::text,
      updated_at = now()
  where created_by = auth.uid()
    and (
      id = mail_row.id
      or (mail_row.gmail_thread_id is not null and gmail_thread_id = mail_row.gmail_thread_id)
    );

  return jsonb_build_object(
    'ticket_id', new_ticket_id,
    'ticket_number', new_ticket_number,
    'client_email', actual_client_email,
    'created_by', actor_email
  );
end;
$$;

revoke all on function public.ark_helpdesk_convert_email_to_ticket(uuid, jsonb)
  from public, anon;
grant execute on function public.ark_helpdesk_convert_email_to_ticket(uuid, jsonb)
  to authenticated;

comment on function public.ark_helpdesk_convert_email_to_ticket(uuid, jsonb) is
  'Atomically creates a Helpdesk ticket from owned Official Mail and locks the whole Gmail thread against duplicate conversion.';
