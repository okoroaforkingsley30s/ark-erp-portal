-- Transactional, idempotent Field Engineer ticket workflow.

create or replace function public.ark_fe_transition_ticket(
  p_ticket_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ticket_row public.tickets%rowtype;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actor_name text;
  actor_role text := public.ark_current_user_role();
  action_name text := lower(trim(coalesce(p_action, '')));
  current_status text;
  next_status text;
  action_label text;
  event_time timestamptz := now();
  recipient record;
  notification_message text;
  completion_note_value text;
begin
  if auth.uid() is null or actor_role <> 'engineer' then
    raise exception 'Field Engineer authorization required' using errcode = '42501';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  if actor_email = '' or actor_email not in (
    lower(coalesce(ticket_row.assigned_to, '')),
    lower(coalesce(ticket_row.assigned_engineer_email, ''))
  ) then
    raise exception 'Only the assigned engineer may update this ticket' using errcode = '42501';
  end if;

  current_status := lower(trim(coalesce(ticket_row.status, 'assigned')));

  case action_name
    when 'accept' then
      if current_status not in ('new', 'open', 'assigned') then
        raise exception 'Ticket cannot be accepted from status %', current_status using errcode = '22023';
      end if;
      next_status := 'accepted';
      action_label := 'accepted';
    when 'start_trip' then
      if current_status <> 'accepted' then
        raise exception 'Trip can start only after acceptance' using errcode = '22023';
      end if;
      next_status := 'traveling';
      action_label := 'started the trip for';
    when 'arrive' then
      if current_status <> 'traveling' then
        raise exception 'Arrival can be recorded only after trip start' using errcode = '22023';
      end if;
      next_status := 'arrived_on_site';
      action_label := 'arrived on site for';
    when 'start_work' then
      if current_status not in ('arrived_on_site', 'rejected') then
        raise exception 'Work can start only after arrival or returned review' using errcode = '22023';
      end if;
      next_status := 'in_progress';
      action_label := 'started work on';
    when 'submit_report' then
      if current_status <> 'in_progress' then
        raise exception 'Completion can be submitted only while work is in progress' using errcode = '22023';
      end if;
      completion_note_value := trim(coalesce(p_payload ->> 'completion_note', ''));
      if length(completion_note_value) < 3 then
        raise exception 'Completion report is required' using errcode = '22023';
      end if;
      if jsonb_typeof(coalesce(p_payload -> 'before_photos', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(p_payload -> 'before_photos', '[]'::jsonb)) = 0
        or jsonb_typeof(coalesce(p_payload -> 'after_photos', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(p_payload -> 'after_photos', '[]'::jsonb)) = 0 then
        raise exception 'Before and after evidence are required' using errcode = '22023';
      end if;
      next_status := 'pending_review';
      action_label := 'submitted a completion report for';
    else
      raise exception 'Unsupported Field Engineer action' using errcode = '22023';
  end case;

  select coalesce(nullif(trim(full_name), ''), actor_email)
  into actor_name
  from public.users
  where id = auth.uid()
  limit 1;
  actor_name := coalesce(actor_name, actor_email);

  update public.tickets
  set
    status = next_status,
    accepted_at = case when action_name = 'accept' then event_time else accepted_at end,
    trip_started_at = case when action_name = 'start_trip' then event_time else trip_started_at end,
    arrived_at = case when action_name = 'arrive' then event_time else arrived_at end,
    started_at = case when action_name = 'start_work' then event_time else started_at end,
    work_started_at = case when action_name = 'start_work' then event_time else work_started_at end,
    completion_status = case when action_name = 'submit_report' then 'pending' else completion_status end,
    completion_note = case when action_name = 'submit_report' then completion_note_value else completion_note end,
    completed_by = case when action_name = 'submit_report' then actor_name else completed_by end,
    before_photos = case when action_name = 'submit_report' then p_payload -> 'before_photos' else before_photos end,
    after_photos = case when action_name = 'submit_report' then p_payload -> 'after_photos' else after_photos end,
    evidence_photos = case when action_name = 'submit_report'
      then coalesce(p_payload -> 'before_photos', '[]'::jsonb) || coalesce(p_payload -> 'after_photos', '[]'::jsonb)
      else evidence_photos end,
    evidence_videos = case when action_name = 'submit_report' then coalesce(p_payload -> 'evidence_videos', '[]'::jsonb) else evidence_videos end,
    submitted_review_at = case when action_name = 'submit_report' then event_time else submitted_review_at end,
    submitted_at = case when action_name = 'submit_report' then event_time else submitted_at end,
    resolved_date = case when action_name = 'submit_report' then event_time else resolved_date end,
    last_action_at = event_time,
    updated_at = event_time
  where id = p_ticket_id;

  notification_message := format(
    '%s %s %s.', actor_name, action_label,
    coalesce(ticket_row.ticket_number, ticket_row.ticket_id, ticket_row.id::text)
  );

  insert into public.operations_events(
    event_type, entity_type, entity_id, title, description,
    actor_name, actor_id, department, severity, metadata, created_at
  ) values (
    'ticket_' || action_name, 'ticket', p_ticket_id::text,
    'Ticket ' || replace(action_name, '_', ' '), notification_message,
    actor_name, auth.uid()::text, 'Field Engineering', 'info',
    jsonb_build_object(
      'ticket_number', coalesce(ticket_row.ticket_number, ticket_row.ticket_id),
      'previous_status', current_status,
      'status', next_status,
      'engineer_email', actor_email
    ), event_time
  );

  for recipient in
    select distinct lower(email) as email
    from (
      select u.email
      from public.users u
      where lower(coalesce(u.role, '')) in (
        'system_admin', 'helpdesk', 'operations', 'operations_manager'
      )
        and coalesce(u.is_approved, false) is true
        and lower(coalesce(u.account_status, 'active')) = 'active'
      union all
      select ticket_row.client_email
    ) connected
    where nullif(trim(coalesce(email, '')), '') is not null
      and lower(email) <> actor_email
  loop
    insert into public.notifications(
      user_email, recipient_email, title, message, message_body, type,
      read, is_read, data, link, sound, created_at
    ) values (
      recipient.email, recipient.email,
      case when action_name = 'submit_report' then 'Completion Report Submitted' else 'Field Job Update' end,
      notification_message, notification_message,
      case when action_name = 'submit_report' then 'ticket_completion_submitted' else 'ticket_status_changed' end,
      false, false,
      jsonb_build_object(
        'ticket_id', p_ticket_id,
        'ticket_number', coalesce(ticket_row.ticket_number, ticket_row.ticket_id),
        'action', action_name,
        'status', next_status,
        'engineer_email', actor_email
      ),
      '/tickets/' || p_ticket_id::text, 'bell', event_time
    );
  end loop;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'previous_status', current_status,
    'status', next_status,
    'action', action_name,
    'major_notification', action_name = 'submit_report'
  );
end;
$$;

revoke all on function public.ark_fe_transition_ticket(uuid, text, jsonb) from public, anon;
grant execute on function public.ark_fe_transition_ticket(uuid, text, jsonb) to authenticated;
