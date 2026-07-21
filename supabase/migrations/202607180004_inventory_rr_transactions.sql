-- Atomic Inventory -> RR and dispatch-fund workflows.

create or replace function public.ark_current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(coalesce(
    (select u.role from public.users u where u.id = auth.uid() limit 1),
    (select up.role from public.user_profiles up
      where lower(up.user_email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1),
    ''
  ));
$$;

create or replace function public.inventory_assert_actor()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare actor_role text := public.ark_current_user_role();
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if actor_role not in ('system_admin', 'ceo', 'agm', 'manager', 'inventory') then
    raise exception 'Inventory authorization required' using errcode = '42501';
  end if;
  return actor_role;
end;
$$;

create or replace function public.inventory_actor_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(nullif(trim(u.full_name), ''), nullif(trim(u.email), ''),
    nullif(auth.jwt() ->> 'email', ''), auth.uid()::text)
  from (select 1) seed left join public.users u on u.id = auth.uid() limit 1;
$$;

create or replace function public.inventory_send_part_to_rr(p_part_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_data jsonb;
  stock_data jsonb;
  stock_id uuid;
  repair_job_id uuid;
  requested_qty numeric;
  current_qty numeric;
  new_qty numeric;
  qty_column text;
  part_number text;
  part_name text;
  actor_name text;
  now_value timestamptz := now();
begin
  perform public.inventory_assert_actor();
  actor_name := public.inventory_actor_name();
  perform pg_advisory_xact_lock(hashtextextended('inventory-rr:' || p_part_request_id::text, 0));

  select to_jsonb(pr) into request_data
  from public.part_requests pr where pr.id = p_part_request_id for update;
  if request_data is null then raise exception 'Part request was not found'; end if;

  select rj.id into repair_job_id from public.repair_jobs rj
  where rj.part_request_id = p_part_request_id order by rj.created_at asc limit 1 for update;
  if repair_job_id is not null then
    update public.part_requests set inventory_status = 'transferred_rr', rr_status = 'pending_rr',
      status = 'pending_rr', lifecycle_status = 'issued_to_rr', dispatch_status = 'waiting_rr',
      updated_at = now_value where id = p_part_request_id;
    return jsonb_build_object('part_request_id', p_part_request_id,
      'repair_job_id', repair_job_id, 'created', false);
  end if;

  requested_qty := coalesce(
    nullif(request_data ->> 'quantity', '')::numeric,
    nullif(request_data ->> 'quantity_requested', '')::numeric,
    1
  );
  if requested_qty <= 0 then raise exception 'Requested quantity must be greater than zero'; end if;
  part_number := coalesce(nullif(trim(request_data ->> 'part_number'), ''),
    nullif(trim(request_data ->> 'requested_part_number'), ''),
    nullif(trim(request_data ->> 'spare_part_number'), ''));
  part_name := coalesce(nullif(trim(request_data ->> 'part_name'), ''),
    nullif(trim(request_data ->> 'requested_part_name'), ''),
    nullif(trim(request_data ->> 'item_name'), ''), 'Inventory Part');

  select s.id, to_jsonb(s) into stock_id, stock_data
  from public.spare_parts s
  where (part_number is not null and lower(coalesce(to_jsonb(s) ->> 'part_number', '')) = lower(part_number))
     or (part_number is null and lower(coalesce(to_jsonb(s) ->> 'part_name', to_jsonb(s) ->> 'description', ''))
       like '%' || lower(part_name) || '%')
  order by case when part_number is not null and
    lower(coalesce(to_jsonb(s) ->> 'part_number', '')) = lower(part_number) then 0 else 1 end
  limit 1 for update;
  if stock_id is null then raise exception 'Matching inventory stock item was not found'; end if;

  qty_column := case
    when stock_data ? 'quantity_available' then 'quantity_available'
    when stock_data ? 'available_quantity' then 'available_quantity'
    when stock_data ? 'quantity' then 'quantity'
    else null end;
  if qty_column is null then raise exception 'Stock quantity column is not supported'; end if;
  current_qty := coalesce(nullif(stock_data ->> qty_column, '')::numeric, 0);
  if current_qty < requested_qty then
    raise exception 'Insufficient stock. Available %, requested %', current_qty, requested_qty;
  end if;
  new_qty := current_qty - requested_qty;

  execute format('update public.spare_parts set %I = $1, updated_at = $2 where id = $3', qty_column)
    using new_qty, now_value, stock_id;

  insert into public.repair_jobs (
    part_request_id, job_number, ticket_id, device_name, status, priority,
    created_at, updated_at, source_type, received_from, item_name, part_number,
    quantity_received, condition_on_arrival, action_required, test_result,
    good_quantity, bad_quantity, inventory_transfer_status, final_remark
  ) values (
    p_part_request_id,
    'RR-' || coalesce(nullif(request_data ->> 'ticket_number', ''), left(p_part_request_id::text, 8)) || '-' || left(p_part_request_id::text, 8),
    coalesce(nullif(request_data ->> 'ticket_number', ''), nullif(request_data ->> 'ticket_id', '')),
    part_name, 'pending_rr', coalesce(nullif(request_data ->> 'priority', ''), 'normal'),
    now_value, now_value, 'part_request', 'Inventory', part_name, part_number,
    requested_qty, 'sent_from_inventory', 'qa_repair_refurbish', 'pending',
    0, requested_qty, 'not_ready',
    'Created from Inventory. Stock deducted: ' || requested_qty || '. Remaining: ' || new_qty || '.'
  ) returning id into repair_job_id;

  update public.part_requests set inventory_status = 'transferred_rr', rr_status = 'pending_rr',
    status = 'pending_rr', lifecycle_status = 'issued_to_rr', dispatch_status = 'waiting_rr',
    updated_at = now_value where id = p_part_request_id;

  insert into public.inventory_movements (
    item_id, part_number, item_description, warehouse, movement_type,
    quantity_changed, previous_quantity, new_quantity, reason,
    performed_by_email, performed_by_name, created_at
  ) values (
    stock_id, coalesce(stock_data ->> 'part_number', part_number),
    coalesce(stock_data ->> 'description', stock_data ->> 'part_name', part_name),
    coalesce(stock_data ->> 'warehouse', 'Oshodi'), 'issued_to_rr',
    -requested_qty, current_qty, new_qty, 'Issued to RR for request ' || p_part_request_id,
    auth.jwt() ->> 'email', actor_name, now_value
  );

  insert into public.part_lifecycle_logs (part_request_id, status, department, note)
  values (p_part_request_id, 'issued_to_rr', 'Inventory', 'Inventory sent part to RR for mandatory verification');
  insert into public.operations_events (
    event_type, title, description, source_module, entity_type, entity_id, severity
  ) values (
    'PART_REQUEST_INVENTORY_UPDATE', 'Inventory sent part to RR',
    'Inventory sent part to RR for mandatory verification', 'Inventory',
    'part_request', p_part_request_id, 'info'
  );

  return jsonb_build_object('part_request_id', p_part_request_id,
    'repair_job_id', repair_job_id, 'stock_item_id', stock_id,
    'previous_quantity', current_qty, 'new_quantity', new_qty, 'created', true);
end;
$$;

create or replace function public.inventory_request_dispatch_fund(
  p_part_request_id uuid,
  p_requested_amount numeric,
  p_destination text default null,
  p_logistics_type text default 'waybill',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_data jsonb;
  fund_id uuid;
  actor_name text;
  actor_email text := auth.jwt() ->> 'email';
  part_name text;
  now_value timestamptz := now();
begin
  perform public.inventory_assert_actor();
  actor_name := public.inventory_actor_name();
  if coalesce(p_requested_amount, 0) <= 0 then raise exception 'Requested amount must be greater than zero'; end if;
  if p_requested_amount > 100000000 then raise exception 'Requested amount exceeds the permitted limit'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dispatch-fund:' || p_part_request_id::text, 0));

  select to_jsonb(pr) into request_data from public.part_requests pr
  where pr.id = p_part_request_id for update;
  if request_data is null then raise exception 'Part request was not found'; end if;
  if not (
    lower(coalesce(request_data ->> 'qa_status', '')) = 'passed'
    or lower(coalesce(request_data ->> 'rr_status', '')) = 'returned_inventory'
    or lower(coalesce(request_data ->> 'inventory_status', '')) = 'rr_verified'
  ) then raise exception 'RR QA must pass and the part must return to Inventory first'; end if;

  select f.id into fund_id from public.inventory_dispatch_fund_requests f
  where f.part_request_id = p_part_request_id
    and lower(coalesce(f.finance_status, '')) <> 'rejected'
  order by f.created_at desc limit 1 for update;
  if fund_id is not null then
    update public.part_requests set finance_status = 'pending_review',
      dispatch_status = 'pending_finance', status = 'ready_for_dispatch',
      lifecycle_status = 'awaiting_dispatch_fund', updated_at = now_value
    where id = p_part_request_id;
    return jsonb_build_object('part_request_id', p_part_request_id,
      'fund_request_id', fund_id, 'status', 'pending_review', 'created', false);
  end if;

  part_name := coalesce(nullif(request_data ->> 'part_name', ''),
    nullif(request_data ->> 'requested_part_name', ''), 'Requested Part');
  insert into public.inventory_dispatch_fund_requests (
    part_request_id, request_type, part_number, part_name, serial_number,
    warehouse, destination, engineer_name, engineer_email, logistics_type,
    requested_amount, approved_amount, reason, inventory_note, status,
    finance_status, requested_by, requested_by_email, created_at, updated_at
  ) values (
    p_part_request_id, 'dispatch_fund',
    coalesce(request_data ->> 'part_number', request_data ->> 'requested_part_number', ''),
    part_name, nullif(request_data ->> 'serial_number', ''),
    coalesce(nullif(request_data ->> 'warehouse', ''), 'Oshodi'),
    coalesce(nullif(trim(p_destination), ''), nullif(request_data ->> 'destination', ''), 'Not specified'),
    coalesce(nullif(request_data ->> 'engineer_name', ''), nullif(request_data ->> 'requested_by_name', ''), 'Engineer'),
    coalesce(nullif(request_data ->> 'engineer_email', ''), nullif(request_data ->> 'requested_by_email', '')),
    coalesce(nullif(trim(p_logistics_type), ''), 'waybill'), p_requested_amount, 0,
    coalesce(nullif(trim(p_reason), ''), 'Dispatch fund requested by Inventory'),
    coalesce(nullif(trim(p_reason), ''), 'Dispatch fund requested by Inventory'),
    'pending_finance', 'pending_review', actor_name, actor_email, now_value, now_value
  ) returning id into fund_id;

  update public.part_requests set finance_status = 'pending_review',
    dispatch_status = 'pending_finance', status = 'ready_for_dispatch',
    lifecycle_status = 'awaiting_dispatch_fund', updated_at = now_value
  where id = p_part_request_id;
  insert into public.part_lifecycle_logs (part_request_id, status, department, note)
  values (p_part_request_id, 'awaiting_dispatch_fund', 'Inventory',
    'Inventory requested dispatch fund from Finance');
  insert into public.operations_events (
    event_type, title, description, source_module, entity_type, entity_id, severity
  ) values (
    'PART_REQUEST_INVENTORY_UPDATE', 'Inventory requested dispatch fund',
    'Inventory requested dispatch fund from Finance', 'Inventory',
    'part_request', p_part_request_id, 'info'
  );

  return jsonb_build_object('part_request_id', p_part_request_id,
    'fund_request_id', fund_id, 'status', 'pending_review', 'created', true);
end;
$$;

revoke all on function public.ark_current_user_role() from public, anon;
revoke all on function public.inventory_assert_actor() from public, anon;
revoke all on function public.inventory_actor_name() from public, anon;
revoke all on function public.inventory_send_part_to_rr(uuid) from public, anon;
revoke all on function public.inventory_request_dispatch_fund(uuid, numeric, text, text, text)
  from public, anon;
grant execute on function public.inventory_send_part_to_rr(uuid) to authenticated;
grant execute on function public.inventory_request_dispatch_fund(uuid, numeric, text, text, text)
  to authenticated;

create or replace function public.inventory_dispatch_stock_request(
  p_part_request_id uuid,
  p_stock_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_data jsonb;
  stock_data jsonb;
  requested_qty numeric;
  current_qty numeric;
  new_qty numeric;
  minimum_qty numeric;
  unit_price numeric;
  next_stock_status text;
  actor_name text;
  now_value timestamptz := now();
begin
  perform public.inventory_assert_actor();
  actor_name := public.inventory_actor_name();
  perform pg_advisory_xact_lock(hashtextextended('inventory-dispatch:' || p_part_request_id::text, 0));

  select to_jsonb(pr) into request_data from public.part_requests pr
  where pr.id = p_part_request_id for update;
  if request_data is null then raise exception 'Part request was not found'; end if;
  if lower(coalesce(request_data ->> 'dispatch_status', '')) in ('dispatched', 'received') then
    return jsonb_build_object('part_request_id', p_part_request_id, 'created', false,
      'status', request_data ->> 'dispatch_status');
  end if;
  if lower(coalesce(request_data ->> 'finance_status', 'not_required')) not in ('approved', 'not_required', 'disbursed') then
    raise exception 'Finance approval or disbursement is required before dispatch';
  end if;
  if lower(coalesce(request_data ->> 'inventory_status', '')) not in (
    'approved_for_dispatch', 'rr_verified', 'ready_for_dispatch'
  ) then raise exception 'Inventory has not approved this request for dispatch'; end if;

  select to_jsonb(s) into stock_data from public.spare_parts s
  where s.id = p_stock_item_id for update;
  if stock_data is null then raise exception 'Inventory stock item was not found'; end if;
  requested_qty := coalesce(nullif(request_data ->> 'quantity', '')::numeric,
    nullif(request_data ->> 'quantity_requested', '')::numeric, 1);
  current_qty := coalesce(nullif(stock_data ->> 'quantity_available', '')::numeric, 0);
  if requested_qty <= 0 then raise exception 'Requested quantity must be greater than zero'; end if;
  if current_qty < requested_qty then
    raise exception 'Insufficient stock. Available %, requested %', current_qty, requested_qty;
  end if;

  new_qty := current_qty - requested_qty;
  minimum_qty := coalesce(nullif(stock_data ->> 'minimum_stock_level', '')::numeric, 2);
  unit_price := coalesce(nullif(stock_data ->> 'unit_price_ngn', '')::numeric, 0);
  next_stock_status := case when new_qty = 0 then 'OUT OF STOCK'
    when new_qty <= minimum_qty then 'LOW STOCK' else 'AVAILABLE' end;

  update public.spare_parts set quantity_available = new_qty,
    stock_status = next_stock_status, total_stock_value = unit_price * new_qty,
    updated_at = now_value where id = p_stock_item_id;
  update public.part_requests set dispatch_status = 'dispatched',
    current_department = 'engineer', dispatch_note = 'Part dispatched to engineer/site',
    updated_at = now_value where id = p_part_request_id;

  if nullif(request_data ->> 'ticket_id', '') is not null then
    update public.tickets set part_request_status = 'engineer', updated_at = now_value
    where id::text = request_data ->> 'ticket_id';
  end if;
  insert into public.inventory_movements (
    item_id, part_number, item_description, warehouse, movement_type,
    quantity_changed, previous_quantity, new_quantity, reason,
    performed_by_email, performed_by_name, created_at
  ) values (
    p_stock_item_id, stock_data ->> 'part_number',
    coalesce(stock_data ->> 'description', stock_data ->> 'part_name', 'Inventory part'),
    coalesce(stock_data ->> 'warehouse', 'Oshodi'), 'request_dispatch',
    -requested_qty, current_qty, new_qty,
    'Dispatched for request ' || coalesce(request_data ->> 'request_number', p_part_request_id::text),
    auth.jwt() ->> 'email', actor_name, now_value
  );
  return jsonb_build_object('part_request_id', p_part_request_id,
    'stock_item_id', p_stock_item_id, 'previous_quantity', current_qty,
    'new_quantity', new_qty, 'status', 'dispatched', 'created', true);
end;
$$;

revoke all on function public.inventory_dispatch_stock_request(uuid, uuid) from public, anon;
grant execute on function public.inventory_dispatch_stock_request(uuid, uuid) to authenticated;
