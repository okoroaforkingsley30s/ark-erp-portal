-- Transactional remote resolution: completion report required, photos optional.

alter table public.tickets
  add column if not exists resolution_mode text not null default 'onsite',
  add column if not exists remote_resolved_by text,
  add column if not exists remote_resolved_by_email text,
  add column if not exists remote_resolved_at timestamptz;

alter table public.tickets
  drop constraint if exists tickets_resolution_mode_check;
alter table public.tickets
  add constraint tickets_resolution_mode_check
  check (resolution_mode in ('onsite', 'remote'));

create or replace function public.ark_resolve_ticket_remotely(
  p_ticket_id uuid,
  p_completion_report text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ticket_row public.tickets%rowtype;
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actor_name text;
  report_value text := trim(coalesce(p_completion_report, ''));
  event_time timestamptz := now();
  recipient record;
  notification_message text;
  inserted_notification_id uuid;
  notification_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null or actor_role not in (
    'system_admin', 'admin', 'admin_head', 'manager', 'helpdesk',
    'operations', 'operations_manager'
  ) then
    raise exception 'Remote ticket resolution authorization required'
      using errcode = '42501';
  end if;

  if length(report_value) < 10 then
    raise exception 'A remote-resolution completion report is required'
      using errcode = '22023';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  if public.ark_ticket_status_is_final(
    ticket_row.status,
    ticket_row.completion_status
  ) then
    raise exception 'Ticket is already closed' using errcode = '22023';
  end if;

  if lower(trim(coalesce(ticket_row.status, 'open'))) not in (
    'new', 'open', 'assigned'
  ) then
    raise exception 'Remote resolution is allowed only before field work starts'
      using errcode = '22023';
  end if;

  if ticket_row.linked_part_request_id is not null
    or lower(trim(coalesce(ticket_row.part_request_status, 'none'))) not in (
      '', 'none', 'cancelled', 'rejected'
    ) then
    raise exception 'Complete or cancel the active part workflow before closing remotely'
      using errcode = '22023';
  end if;

  select coalesce(nullif(trim(full_name), ''), actor_email)
  into actor_name
  from public.users
  where id = auth.uid()
  limit 1;
  actor_name := coalesce(actor_name, actor_email);

  update public.tickets
  set
    status = 'closed',
    completion_status = 'approved',
    resolution_mode = 'remote',
    completion_note = report_value,
    completed_by = actor_name,
    approved_by = actor_name,
    approved_at = event_time,
    remote_resolved_by = actor_name,
    remote_resolved_by_email = actor_email,
    remote_resolved_at = event_time,
    resolved_date = event_time,
    closed_date = event_time,
    escalated = false,
    last_action_at = event_time,
    updated_at = event_time
  where id = p_ticket_id;

  notification_message := format(
    '%s resolved %s remotely and closed the ticket.',
    actor_name,
    coalesce(ticket_row.ticket_number, ticket_row.ticket_id, ticket_row.id::text)
  );

  insert into public.operations_events(
    event_type, entity_type, entity_id, title, description,
    actor_name, actor_id, department, severity, metadata, created_at
  ) values (
    'ticket_remote_resolution', 'ticket', p_ticket_id::text,
    'Ticket Resolved Remotely', notification_message,
    actor_name, auth.uid()::text,
    coalesce(nullif(trim(actor_role), ''), 'Helpdesk'), 'info',
    jsonb_build_object(
      'ticket_number', coalesce(ticket_row.ticket_number, ticket_row.ticket_id),
      'resolution_mode', 'remote',
      'completion_report', report_value,
      'resolver_email', actor_email
    ), event_time
  );

  for recipient in
    select distinct lower(email) as email
    from (
      select ticket_row.assigned_engineer_email as email
      union all select ticket_row.assigned_to
      union all select ticket_row.client_email
      union all
      select u.email
      from public.users u
      where lower(coalesce(u.role, '')) in (
        'system_admin', 'helpdesk', 'operations', 'operations_manager'
      )
        and coalesce(u.is_approved, false) is true
        and lower(coalesce(u.account_status, 'active')) = 'active'
    ) connected
    where nullif(trim(coalesce(email, '')), '') is not null
      and lower(email) <> actor_email
  loop
    insert into public.notifications(
      user_email, recipient_email, title, message, message_body, type,
      read, is_read, data, link, sound, created_at
    ) values (
      recipient.email, recipient.email, 'Ticket Resolved Remotely',
      notification_message, notification_message, 'ticket_remote_resolution',
      false, false,
      jsonb_build_object(
        'ticket_id', p_ticket_id,
        'ticket_number', coalesce(ticket_row.ticket_number, ticket_row.ticket_id),
        'resolution_mode', 'remote',
        'resolver_email', actor_email
      ),
      '/tickets/' || p_ticket_id::text, 'bell', event_time
    ) returning id into inserted_notification_id;

    notification_ids := array_append(notification_ids, inserted_notification_id);
  end loop;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'status', 'closed',
    'completion_status', 'approved',
    'resolution_mode', 'remote',
    'notification_ids', to_jsonb(notification_ids)
  );
end;
$$;

revoke all on function public.ark_resolve_ticket_remotely(uuid, text)
  from public, anon;
grant execute on function public.ark_resolve_ticket_remotely(uuid, text)
  to authenticated;
