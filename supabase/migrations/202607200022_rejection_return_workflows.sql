-- Rejections return work to the immediately preceding responsible stage.
-- Rejected attempts remain linked and logged for audit purposes.

alter function public.inventory_transition_part_request(uuid, text, text)
  rename to inventory_transition_part_request_before_rejection_returns;

revoke all on function public.inventory_transition_part_request_before_rejection_returns(uuid, text, text)
  from public, anon, authenticated;

create or replace function public.inventory_transition_part_request(
  p_part_request_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.part_requests%rowtype;
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  action_name text := lower(trim(coalesce(p_action, '')));
  event_title text;
  next_lifecycle text;
  next_department text;
  result_row jsonb;
begin
  if action_name not in ('operations_reject', 'inventory_reject') then
    return public.inventory_transition_part_request_before_rejection_returns(
      p_part_request_id, p_action, p_note
    );
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('part-request-transition:' || p_part_request_id::text, 0)
  );

  select * into request_row
  from public.part_requests
  where id = p_part_request_id
  for update;

  if not found then
    raise exception 'Part request was not found' using errcode = 'P0002';
  end if;

  if action_name = 'operations_reject' then
    if actor_role not in (
      'system_admin', 'ceo', 'agm', 'manager', 'operations', 'operational_manager'
    ) then
      raise exception 'Operations authorization is required' using errcode = '42501';
    end if;

    if lower(coalesce(request_row.operations_status, '')) not in ('pending', 'pending_review') then
      raise exception 'Part request is not awaiting Operations review';
    end if;

    event_title := 'Operations rejected and returned part request to engineer';
    next_lifecycle := 'operations_rejected';
    next_department := 'engineer';

    update public.part_requests
    set approval_status = 'rejected',
        operations_status = 'rejected',
        part_request_status = next_lifecycle,
        lifecycle_status = next_lifecycle,
        current_department = next_department,
        operations_note = coalesce(nullif(left(trim(p_note), 2000), ''), event_title),
        updated_at = now()
    where id = p_part_request_id
    returning to_jsonb(part_requests) into result_row;

    update public.tickets
    set status = 'in_progress',
        completion_status = 'pending',
        part_request_status = next_lifecycle,
        updated_at = now()
    where id = request_row.ticket_id
      and not public.ark_ticket_status_is_final(status, completion_status);
  else
    perform public.inventory_assert_actor();

    if lower(coalesce(request_row.inventory_status, '')) not in (
      'pending', 'pending_review', 'waiting_operations_approval', 'approved_for_dispatch'
    ) then
      raise exception 'Part request cannot be returned from its current Inventory state';
    end if;

    event_title := 'Inventory rejected and returned part request to Operations';
    next_lifecycle := 'inventory_returned_to_operations';
    next_department := 'operations';

    update public.part_requests
    set approval_status = 'pending_operations',
        operations_status = 'pending_review',
        inventory_status = 'returned_to_operations',
        part_request_status = next_lifecycle,
        lifecycle_status = next_lifecycle,
        current_department = next_department,
        inventory_note = coalesce(nullif(left(trim(p_note), 2000), ''), event_title),
        updated_at = now()
    where id = p_part_request_id
    returning to_jsonb(part_requests) into result_row;

    update public.tickets
    set status = 'pending_parts',
        completion_status = 'pending_parts',
        part_request_status = next_lifecycle,
        updated_at = now()
    where id = request_row.ticket_id
      and not public.ark_ticket_status_is_final(status, completion_status);
  end if;

  insert into public.part_lifecycle_logs(part_request_id, status, department, note)
  values (
    p_part_request_id,
    next_lifecycle,
    case when action_name = 'operations_reject' then 'Operations' else 'Inventory' end,
    coalesce(nullif(left(trim(p_note), 2000), ''), event_title)
  );

  insert into public.operations_events(
    event_type, title, description, source_module, entity_type, entity_id, severity
  ) values (
    'PART_REQUEST_WORKFLOW_RETURN', event_title,
    event_title || ' for ' || coalesce(request_row.request_number, p_part_request_id::text),
    case when action_name = 'operations_reject' then 'Operations' else 'Inventory' end,
    'part_request', p_part_request_id, 'warning'
  );

  return result_row || jsonb_build_object(
    'changed', true,
    'action', action_name,
    'returned_to', next_department,
    'actor_email', actor_email
  );
end;
$$;

revoke all on function public.inventory_transition_part_request(uuid, text, text)
  from public, anon;
grant execute on function public.inventory_transition_part_request(uuid, text, text)
  to authenticated;

-- Align open legacy rejections with the new return semantics.
update public.tickets t
set status = 'in_progress',
    completion_status = 'pending',
    part_request_status = 'operations_rejected',
    updated_at = now()
from public.part_requests pr
where pr.ticket_id = t.id
  and lower(coalesce(pr.operations_status, '')) = 'rejected'
  and lower(coalesce(pr.lifecycle_status, '')) = 'operations_rejected'
  and not public.ark_ticket_status_is_final(t.status, t.completion_status);

update public.part_requests pr
set approval_status = 'pending_operations',
    operations_status = 'pending_review',
    inventory_status = 'returned_to_operations',
    part_request_status = 'inventory_returned_to_operations',
    lifecycle_status = 'inventory_returned_to_operations',
    current_department = 'operations',
    updated_at = now()
where lower(coalesce(pr.inventory_status, '')) = 'rejected'
  and lower(coalesce(pr.lifecycle_status, '')) = 'inventory_rejected';

update public.tickets t
set status = 'pending_parts',
    completion_status = 'pending_parts',
    part_request_status = 'inventory_returned_to_operations',
    updated_at = now()
from public.part_requests pr
where pr.ticket_id = t.id
  and lower(coalesce(pr.lifecycle_status, '')) = 'inventory_returned_to_operations'
  and not public.ark_ticket_status_is_final(t.status, t.completion_status);
