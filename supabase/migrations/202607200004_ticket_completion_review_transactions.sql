-- Transactional Helpdesk/Operations completion review with connected-party notifications.

create or replace function public.ark_review_ticket_completion(
  p_ticket_id uuid,
  p_decision text,
  p_reason text default null
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
  decision_name text := lower(trim(coalesce(p_decision, '')));
  reason_value text := trim(coalesce(p_reason, ''));
  event_time timestamptz := now();
  next_status text;
  next_completion_status text;
  notification_title text;
  notification_message text;
  updated_attachments jsonb;
  recipient record;
  inserted_notification_id uuid;
  notification_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null or actor_role not in (
    'system_admin', 'admin', 'admin_head', 'manager', 'helpdesk',
    'operations', 'operations_manager'
  ) then
    raise exception 'Ticket review authorization required' using errcode = '42501';
  end if;

  if decision_name not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;

  if decision_name = 'reject' and length(reason_value) < 3 then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  if lower(coalesce(ticket_row.status, '')) <> 'pending_review'
    or lower(coalesce(ticket_row.completion_status, '')) <> 'pending' then
    raise exception 'Ticket is not awaiting completion review' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(full_name), ''), actor_email)
  into actor_name
  from public.users
  where id = auth.uid()
  limit 1;
  actor_name := coalesce(actor_name, actor_email);

  if decision_name = 'approve' then
    next_status := 'approved';
    next_completion_status := 'approved';
    notification_title := 'Completion Report Approved';
    notification_message := format(
      '%s approved completion of %s.', actor_name,
      coalesce(ticket_row.ticket_number, ticket_row.ticket_id, ticket_row.id::text)
    );
    updated_attachments := ticket_row.attachments;
  else
    next_status := 'rejected';
    next_completion_status := 'rejected';
    notification_title := 'Completion Report Rejected';
    notification_message := format(
      '%s rejected completion of %s: %s', actor_name,
      coalesce(ticket_row.ticket_number, ticket_row.ticket_id, ticket_row.id::text),
      reason_value
    );
    updated_attachments :=
      case when jsonb_typeof(ticket_row.attachments) = 'object'
        then ticket_row.attachments else '{}'::jsonb end;
    updated_attachments := jsonb_set(
      updated_attachments,
      '{rejection_log}',
      coalesce(updated_attachments -> 'rejection_log', '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object(
          'rejected_by', actor_name,
          'rejected_at', event_time,
          'reason', reason_value
        )),
      true
    );
  end if;

  update public.tickets
  set
    status = next_status,
    completion_status = next_completion_status,
    approved_by = case when decision_name = 'approve' then actor_name else approved_by end,
    approved_at = case when decision_name = 'approve' then event_time else approved_at end,
    closed_date = case when decision_name = 'approve' then event_time else closed_date end,
    attachments = updated_attachments,
    last_action_at = event_time,
    updated_at = event_time
  where id = p_ticket_id;

  insert into public.operations_events(
    event_type, entity_type, entity_id, title, description,
    actor_name, actor_id, department, severity, metadata, created_at
  ) values (
    'ticket_completion_' || decision_name, 'ticket', p_ticket_id::text,
    notification_title, notification_message, actor_name, auth.uid()::text,
    coalesce(nullif(trim(actor_role), ''), 'Helpdesk'),
    case when decision_name = 'reject' then 'warning' else 'info' end,
    jsonb_build_object(
      'ticket_number', coalesce(ticket_row.ticket_number, ticket_row.ticket_id),
      'decision', decision_name,
      'reason', nullif(reason_value, ''),
      'engineer_email', coalesce(ticket_row.assigned_engineer_email, ticket_row.assigned_to)
    ), event_time
  );

  for recipient in
    select distinct lower(email) as email
    from (
      select ticket_row.assigned_engineer_email as email
      union all select ticket_row.assigned_to
      union all select ticket_row.client_email
      union all
      select u.email from public.users u
      where lower(coalesce(u.role, '')) in ('system_admin', 'helpdesk', 'operations', 'operations_manager')
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
      recipient.email, recipient.email, notification_title,
      notification_message, notification_message,
      'ticket_completion_' || case when decision_name = 'approve' then 'approved' else 'rejected' end,
      false, false,
      jsonb_build_object(
        'ticket_id', p_ticket_id,
        'ticket_number', coalesce(ticket_row.ticket_number, ticket_row.ticket_id),
        'decision', decision_name,
        'reason', nullif(reason_value, ''),
        'reviewer_email', actor_email
      ),
      '/tickets/' || p_ticket_id::text, 'bell', event_time
    ) returning id into inserted_notification_id;
    notification_ids := array_append(notification_ids, inserted_notification_id);
  end loop;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'status', next_status,
    'completion_status', next_completion_status,
    'decision', decision_name,
    'major_notification', true,
    'notification_ids', to_jsonb(notification_ids)
  );
end;
$$;

revoke all on function public.ark_review_ticket_completion(uuid, text, text) from public, anon;
grant execute on function public.ark_review_ticket_completion(uuid, text, text) to authenticated;
