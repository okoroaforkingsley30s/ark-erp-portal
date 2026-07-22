-- Reliable ticket notifications and a live timestamp for department dashboards.
-- Major events queue email delivery; routine field movements remain in-app only.

create or replace function public.ark_notify_ticket_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_data jsonb := to_jsonb(new);
  old_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  ticket_id text := new.id::text;
  ticket_number text := coalesce(new_data ->> 'ticket_number', new_data ->> 'ticket_id', ticket_id);
  new_status text := lower(trim(coalesce(new_data ->> 'status', 'new')));
  old_status text := lower(trim(coalesce(old_data ->> 'status', '')));
  new_completion text := lower(trim(coalesce(new_data ->> 'completion_status', '')));
  old_completion text := lower(trim(coalesce(old_data ->> 'completion_status', '')));
  action_name text;
  event_status text;
  title_value text;
  message_value text;
  is_major boolean := false;
  recipient_roles text[] := '{}'::text[];
  participants text[];
begin
  participants := array[
    new_data ->> 'assigned_to',
    new_data ->> 'assigned_engineer_email',
    new_data ->> 'engineer_email',
    new_data ->> 'client_email',
    new_data ->> 'created_by_email',
    new_data ->> 'requester_email',
    new_data ->> 'user_email'
  ];

  if tg_op = 'INSERT' then
    if new_status = 'assigned' or nullif(coalesce(new_data ->> 'assigned_to', new_data ->> 'assigned_engineer_email'), '') is not null then
      action_name := 'assigned';
      event_status := 'assigned';
      is_major := true;
      title_value := 'New Ticket Assigned';
      message_value := 'Ticket ' || ticket_number || ' has been assigned for field action.';
    else
      action_name := 'created';
      event_status := new_status;
      title_value := 'Ticket Created';
      message_value := 'Ticket ' || ticket_number || ' was created.';
    end if;
  elsif coalesce((new_data ->> 'escalated')::boolean, false)
        and not coalesce((old_data ->> 'escalated')::boolean, false) then
    action_name := 'escalated'; event_status := 'escalated'; is_major := true;
    recipient_roles := array['helpdesk','operations','operations_manager','manager'];
    title_value := 'Ticket Escalated';
    message_value := 'Ticket ' || ticket_number || ' requires urgent intervention.';
  elsif coalesce(new_data ->> 'assigned_to', new_data ->> 'assigned_engineer_email', '')
        is distinct from coalesce(old_data ->> 'assigned_to', old_data ->> 'assigned_engineer_email', '') then
    action_name := 'assigned'; event_status := 'assigned'; is_major := true;
    title_value := 'Ticket Assignment Updated';
    message_value := 'Ticket ' || ticket_number || ' has been assigned for field action.';
  elsif new_completion is distinct from old_completion and new_completion <> '' then
    action_name := 'completion_' || new_completion;
    event_status := new_completion;
    is_major := new_completion ~ '(submitted|pending_review|approved|rejected|closed|completed|resolved)';
    recipient_roles := array['helpdesk'];
    title_value := 'Ticket Completion ' || initcap(replace(new_completion, '_', ' '));
    message_value := 'Completion for ticket ' || ticket_number || ' is now ' || replace(new_completion, '_', ' ') || '.';
  elsif new_status is distinct from old_status then
    action_name := 'status_changed';
    event_status := new_status;
    is_major := new_status ~ '(assigned|pending_review|submitted|approved|rejected|closed|completed|resolved|escalated)';
    if new_status ~ '(pending_review|submitted|rejected|closed|completed|resolved)' then
      recipient_roles := array['helpdesk'];
    end if;
    title_value := 'Ticket ' || initcap(replace(new_status, '_', ' '));
    message_value := 'Ticket ' || ticket_number || ' is now ' || replace(new_status, '_', ' ') || '.';
  else
    return new;
  end if;

  perform public.ark_emit_workflow_notification(
    'ticket', ticket_id, action_name, event_status, title_value, message_value,
    '/tickets/' || ticket_id, participants, recipient_roles, is_major,
    jsonb_build_object(
      'ticket_id', ticket_id,
      'ticket_number', ticket_number,
      'actor_email', lower(coalesce(auth.jwt() ->> 'email', '')),
      'event_nonce', coalesce(new_data ->> 'updated_at', new_data ->> 'created_at', clock_timestamp()::text)
    )
  );

  return new;
end;
$$;

revoke all on function public.ark_notify_ticket_workflow() from public, anon, authenticated;

drop trigger if exists ark_ticket_notification_trigger on public.tickets;
create trigger ark_ticket_notification_trigger
after insert or update on public.tickets
for each row execute function public.ark_notify_ticket_workflow();

-- Add synchronization metadata without changing any department's protected counts.
create or replace function public.ark_department_dashboard_live_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  result := public.ark_department_dashboard_summary();
  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'generated_at', clock_timestamp(),
    'source', 'live_database'
  );
end;
$$;

revoke all on function public.ark_department_dashboard_live_summary() from public, anon;
grant execute on function public.ark_department_dashboard_live_summary() to authenticated;
