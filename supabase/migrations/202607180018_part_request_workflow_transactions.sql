-- Section 4: atomic part-request approvals, rejection, receipt, and audit trail.
-- Run after 202607180017_dispatch_fund_transactions.sql.

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
  request_data jsonb;
  actor_role text := public.ark_current_user_role();
  actor_name text := public.inventory_actor_name();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  action_name text := lower(trim(coalesce(p_action, '')));
  current_operations text;
  current_inventory text;
  current_finance text;
  current_dispatch text;
  next_approval text;
  next_operations text;
  next_inventory text;
  next_finance text;
  next_dispatch text;
  next_department text;
  next_lifecycle text;
  ticket_state text;
  event_title text;
  severity_name text := 'info';
  ticket_key text;
  item_key uuid;
  is_noop boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if action_name not in (
    'operations_approve', 'operations_reject',
    'inventory_approve', 'inventory_reject',
    'finance_approve', 'engineer_receive'
  ) then raise exception 'Unsupported part-request action'; end if;

  perform pg_advisory_xact_lock(hashtextextended('part-request-transition:' || p_part_request_id::text, 0));
  select to_jsonb(pr) into request_data from public.part_requests pr
  where pr.id = p_part_request_id for update;
  if request_data is null then raise exception 'Part request was not found'; end if;

  current_operations := lower(coalesce(request_data ->> 'operations_status', ''));
  current_inventory := lower(coalesce(request_data ->> 'inventory_status', ''));
  current_finance := lower(coalesce(request_data ->> 'finance_status', 'not_required'));
  current_dispatch := lower(coalesce(request_data ->> 'dispatch_status', 'pending'));
  ticket_key := nullif(trim(request_data ->> 'ticket_id'), '');
  item_key := nullif(trim(request_data ->> 'part_id'), '')::uuid;

  if action_name like 'operations_%' then
    if actor_role not in ('system_admin','ceo','agm','manager','operations','operational_manager') then
      raise exception 'Operations authorization is required' using errcode = '42501';
    end if;
  elsif action_name like 'inventory_%' then
    perform public.inventory_assert_actor();
  elsif action_name = 'finance_approve' then
    if not public.finance_is_write_role() then raise exception 'Finance authorization is required' using errcode = '42501'; end if;
  else
    if actor_role not in ('system_admin','engineer','field_engineer','field_service_engineer')
      and actor_email <> lower(coalesce(request_data ->> 'engineer_email', '')) then
      raise exception 'Only the assigned engineer may confirm receipt' using errcode = '42501';
    end if;
    if actor_role <> 'system_admin' and actor_email <> lower(coalesce(request_data ->> 'engineer_email', '')) then
      raise exception 'This part request belongs to another engineer' using errcode = '42501';
    end if;
  end if;

  if action_name = 'operations_approve' then
    is_noop := current_operations = 'approved';
    if not is_noop and current_operations not in ('pending','pending_review') then
      raise exception 'Part request is not awaiting Operations approval';
    end if;
    next_approval := 'operations_approved'; next_operations := 'approved'; next_inventory := 'pending_review';
    next_finance := case when lower(coalesce(request_data ->> 'request_type',''))='bank' then 'pending_payment_review' else 'pending_dispatch_cost_review' end;
    next_department := 'inventory_accounts'; next_lifecycle := 'operations_approved'; ticket_state := 'inventory_accounts';
    event_title := 'Operations approved part request';
  elsif action_name = 'operations_reject' then
    is_noop := current_operations = 'rejected';
    if not is_noop and current_operations not in ('pending','pending_review') then raise exception 'Part request is not awaiting Operations review'; end if;
    next_approval := 'rejected'; next_operations := 'rejected'; next_department := 'operations';
    next_lifecycle := 'operations_rejected'; ticket_state := 'rejected_parts'; event_title := 'Operations rejected part request'; severity_name := 'warning';
  elsif action_name = 'inventory_approve' then
    is_noop := current_inventory = 'approved_for_dispatch';
    if not is_noop and current_operations <> 'approved' then raise exception 'Operations must approve this request first'; end if;
    if not is_noop and current_inventory not in ('pending','pending_review','waiting_operations_approval') then raise exception 'Part request is not awaiting Inventory review'; end if;
    next_inventory := 'approved_for_dispatch';
    next_department := case when current_finance in ('approved','not_required','disbursed') then 'inventory' else 'accounts' end;
    next_lifecycle := 'inventory_approved'; ticket_state := next_department; event_title := 'Inventory approved part request';
  elsif action_name = 'inventory_reject' then
    is_noop := current_inventory = 'rejected';
    if not is_noop and current_inventory not in ('pending','pending_review','waiting_operations_approval','approved_for_dispatch') then raise exception 'Part request cannot be rejected from its current Inventory state'; end if;
    next_approval := 'rejected'; next_inventory := 'rejected'; next_department := 'inventory';
    next_lifecycle := 'inventory_rejected'; ticket_state := 'rejected_parts'; event_title := 'Inventory rejected part request'; severity_name := 'warning';
  elsif action_name = 'finance_approve' then
    is_noop := current_finance = 'approved';
    if not is_noop and current_finance not in ('pending','pending_review','pending_payment_review','pending_dispatch_cost_review') then raise exception 'Part request is not awaiting Finance review'; end if;
    next_finance := 'approved'; next_department := case when current_inventory='approved_for_dispatch' then 'inventory' else 'inventory_accounts' end;
    next_lifecycle := 'finance_approved'; ticket_state := next_department; event_title := 'Finance approved part request';
  else
    is_noop := current_dispatch in ('received','received_by_engineer');
    if not is_noop and current_dispatch <> 'dispatched' then raise exception 'Only dispatched parts can be confirmed as received'; end if;
    next_dispatch := 'received_by_engineer'; next_department := 'engineer';
    next_lifecycle := 'received_by_engineer'; ticket_state := 'received_by_engineer'; event_title := 'Engineer received dispatched part';
  end if;

  if is_noop then
    return request_data || jsonb_build_object('changed', false, 'action', action_name);
  end if;

  update public.part_requests set
    approval_status = coalesce(next_approval, approval_status),
    operations_status = coalesce(next_operations, operations_status),
    inventory_status = coalesce(next_inventory, inventory_status),
    finance_status = coalesce(next_finance, finance_status),
    dispatch_status = coalesce(next_dispatch, dispatch_status),
    part_request_status = case when action_name='engineer_receive' then 'received_by_engineer' else part_request_status end,
    current_department = coalesce(next_department, current_department),
    lifecycle_status = coalesce(next_lifecycle, lifecycle_status),
    operations_note = case when action_name like 'operations_%' then coalesce(nullif(left(trim(p_note),2000),''), event_title) else operations_note end,
    inventory_note = case when action_name like 'inventory_%' then coalesce(nullif(left(trim(p_note),2000),''), event_title) else inventory_note end,
    finance_note = case when action_name='finance_approve' then coalesce(nullif(left(trim(p_note),2000),''), event_title) else finance_note end,
    received_by_engineer_at = case when action_name='engineer_receive' then now() else received_by_engineer_at end,
    updated_at = now()
  where id = p_part_request_id
  returning to_jsonb(part_requests) into request_data;

  if ticket_key is not null then
    update public.tickets set
      part_request_status = ticket_state,
      status = case
        when action_name in ('operations_reject','inventory_reject') then 'rejected_parts'
        when action_name='engineer_receive' then 'in_progress'
        else status end,
      completion_status = case when action_name='engineer_receive' then 'part_received' else completion_status end,
      received_part_at = case when action_name='engineer_receive' then now() else received_part_at end,
      updated_at = now()
    where id::text = ticket_key;
    if not found then raise exception 'Linked ticket was not found'; end if;
  end if;

  if action_name = 'engineer_receive' then
    insert into public.inventory_movements(
      item_id, part_number, item_description, warehouse, movement_type,
      quantity_changed, previous_quantity, new_quantity, reason,
      performed_by_email, performed_by_name, created_at
    ) values(
      item_key, coalesce(request_data ->> 'part_number',''), coalesce(request_data ->> 'part_name','Inventory part'),
      coalesce(nullif(request_data ->> 'warehouse',''),'Oshodi'), 'request_received', 0, 0, 0,
      'Engineer confirmed receipt for request ' || coalesce(request_data ->> 'request_number',p_part_request_id::text),
      actor_email, actor_name, now()
    );
  end if;

  insert into public.part_lifecycle_logs(part_request_id,status,department,note)
  values(p_part_request_id,next_lifecycle,
    case when action_name like 'operations_%' then 'Operations' when action_name like 'inventory_%' then 'Inventory'
      when action_name='finance_approve' then 'Finance' else 'Field Engineering' end,
    coalesce(nullif(left(trim(p_note),2000),''),event_title));

  insert into public.operations_events(event_type,title,description,source_module,entity_type,entity_id,severity)
  values('PART_REQUEST_WORKFLOW_TRANSITION',event_title,
    event_title || ' for ' || coalesce(request_data ->> 'request_number',p_part_request_id::text),
    case when action_name like 'operations_%' then 'Operations' when action_name like 'inventory_%' then 'Inventory'
      when action_name='finance_approve' then 'Finance' else 'Field Engineering' end,
    'part_request',p_part_request_id,severity_name);

  return request_data || jsonb_build_object('changed', true, 'action', action_name);
end;
$$;

revoke all on function public.inventory_transition_part_request(uuid,text,text) from public, anon;
grant execute on function public.inventory_transition_part_request(uuid,text,text) to authenticated;
