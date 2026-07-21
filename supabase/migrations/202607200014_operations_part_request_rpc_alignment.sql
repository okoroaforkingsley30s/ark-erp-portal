-- Align the Operations Part Requests UI with transactional workflow RPCs.

create or replace function public.ark_operations_forward_part_request(
  p_part_request_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  request_row public.part_requests%rowtype;
  ticket_key text;
  event_note text := coalesce(nullif(left(trim(p_note), 2000), ''), 'Operations sent approved part request to Inventory');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if actor_role not in ('system_admin','ceo','agm','manager','operations','operational_manager') then
    raise exception 'Operations authorization is required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('part-request-transition:' || p_part_request_id::text, 0));
  select * into request_row from public.part_requests where id = p_part_request_id for update;
  if not found then raise exception 'Part request was not found'; end if;

  if lower(coalesce(request_row.operations_status, '')) = 'sent_to_inventory'
    and lower(coalesce(request_row.inventory_status, '')) in ('pending','pending_review') then
    return to_jsonb(request_row) || jsonb_build_object('changed', false, 'action', 'send_inventory');
  end if;

  if lower(coalesce(request_row.operations_status, '')) <> 'approved' then
    raise exception 'Operations must approve the part request before sending it to Inventory';
  end if;
  if lower(coalesce(request_row.inventory_status, '')) not in ('pending','pending_review','waiting_operations_approval') then
    raise exception 'Part request is not ready to be sent to Inventory';
  end if;

  update public.part_requests set
    operations_status = 'sent_to_inventory',
    inventory_status = 'pending',
    status = 'pending_inventory',
    current_department = 'inventory',
    lifecycle_status = 'sent_to_inventory',
    operations_note = event_note,
    updated_at = now()
  where id = p_part_request_id
  returning * into request_row;

  ticket_key := nullif(trim(request_row.ticket_id::text), '');
  if ticket_key is not null then
    update public.tickets set
      part_request_status = 'pending_inventory',
      updated_at = now()
    where id::text = ticket_key;
    if not found then raise exception 'Linked ticket was not found'; end if;
  end if;

  insert into public.part_lifecycle_logs(part_request_id, status, department, note)
  values(p_part_request_id, 'sent_to_inventory', 'Operations', event_note);

  insert into public.operations_events(
    event_type, title, description, source_module, entity_type, entity_id, severity
  ) values(
    'PART_REQUEST_WORKFLOW_TRANSITION', 'Part request sent to Inventory',
    event_note, 'Operations', 'part_request', p_part_request_id, 'info'
  );

  return to_jsonb(request_row) || jsonb_build_object('changed', true, 'action', 'send_inventory');
end;
$$;

revoke all on function public.ark_operations_forward_part_request(uuid,text) from public, anon;
grant execute on function public.ark_operations_forward_part_request(uuid,text) to authenticated;
