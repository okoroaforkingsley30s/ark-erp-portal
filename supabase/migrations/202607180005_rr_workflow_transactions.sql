-- Server-controlled RR HOD and technician workflow transitions.

create or replace function public.ark_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select up.id from public.user_profiles up
  where lower(up.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function public.rr_transition_repair_job(
  p_record_id uuid,
  p_record_type text,
  p_action text,
  p_technician_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_profile_id uuid := public.ark_current_profile_id();
  actor_role text := public.ark_current_user_role();
  actor_name text := public.inventory_actor_name();
  action_name text := lower(trim(coalesce(p_action, '')));
  record_type text := lower(trim(coalesce(p_record_type, 'part_request')));
  job public.repair_jobs%rowtype;
  request_data jsonb;
  current_state text;
  next_job_status text;
  next_rr_status text;
  transition_lifecycle text;
  event_title text;
  now_value timestamptz := now();
  quantity_value numeric;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if action_name not in (
    'receive', 'assign', 'start_repair', 'request_consumables', 'request_fund',
    'submit_qa', 'qa_pass', 'qa_fail', 'return_inventory', 'scrap'
  ) then raise exception 'Unsupported RR action %', action_name; end if;
  perform pg_advisory_xact_lock(hashtextextended('rr-transition:' || record_type || ':' || p_record_id::text, 0));

  if record_type = 'repair_job' then
    select * into job from public.repair_jobs where id = p_record_id for update;
  elsif record_type = 'part_request' then
    select to_jsonb(pr) into request_data from public.part_requests pr
    where pr.id = p_record_id for update;
    if request_data is null then raise exception 'Part request was not found'; end if;
    select * into job from public.repair_jobs where part_request_id = p_record_id
    order by created_at asc limit 1 for update;
  else
    raise exception 'Unsupported RR record type %', record_type;
  end if;

  if job.id is null and record_type = 'part_request' then
    insert into public.repair_jobs (
      part_request_id, job_number, ticket_id, device_name, status, priority,
      created_at, updated_at, source_type, received_from, item_name, part_number,
      quantity_received, condition_on_arrival, action_required, test_result,
      good_quantity, bad_quantity, inventory_transfer_status, final_remark
    ) values (
      p_record_id,
      'RR-' || coalesce(nullif(request_data ->> 'ticket_number', ''), left(p_record_id::text, 8)) || '-' || left(p_record_id::text, 8),
      coalesce(nullif(request_data ->> 'ticket_number', ''), nullif(request_data ->> 'ticket_id', '')),
      coalesce(nullif(request_data ->> 'part_name', ''), nullif(request_data ->> 'item_name', ''), 'Inventory Part'),
      'pending_rr', coalesce(nullif(request_data ->> 'priority', ''), 'normal'),
      now_value, now_value, 'part_request', 'Inventory',
      coalesce(nullif(request_data ->> 'part_name', ''), nullif(request_data ->> 'item_name', ''), 'Inventory Part'),
      nullif(request_data ->> 'part_number', ''),
      coalesce(nullif(request_data ->> 'quantity', '')::numeric, 1),
      'received_from_inventory', 'repair_required', 'pending', 0,
      coalesce(nullif(request_data ->> 'quantity', '')::numeric, 1),
      'not_ready', 'Created during RR intake for a legacy part request'
    ) returning * into job;
  end if;
  if job.id is null then raise exception 'Linked repair job was not found'; end if;
  if request_data is null and job.part_request_id is not null then
    select to_jsonb(pr) into request_data from public.part_requests pr
    where pr.id = job.part_request_id for update;
  end if;

  current_state := case
    when lower(coalesce(job.status, '')) in ('pending_rr') then 'pending'
    when lower(coalesce(job.status, '')) in ('received') then 'received'
    when lower(coalesce(job.status, '')) in ('assigned') then 'assigned'
    when lower(coalesce(job.status, '')) in ('refurbishing', 'under_repair') then 'under_repair'
    when lower(coalesce(job.status, '')) = 'awaiting_parts' then 'awaiting_parts'
    when lower(coalesce(job.status, '')) = 'awaiting_fund' then 'awaiting_fund'
    when lower(coalesce(job.status, '')) in ('testing', 'waiting_qa') then 'waiting_qa'
    when lower(coalesce(job.status, '')) in ('ready_for_inventory', 'qa_passed') then 'qa_passed'
    when lower(coalesce(job.status, '')) = 'qa_failed' then 'qa_failed'
    when lower(coalesce(job.status, '')) in ('sent_to_inventory') then 'returned_inventory'
    when lower(coalesce(job.status, '')) in ('scrap', 'scrapped') then 'scrapped'
    else lower(coalesce(job.status, 'pending')) end;

  if (action_name = 'receive' and current_state = 'received')
    or (action_name = 'assign' and current_state = 'assigned'
      and p_technician_id::text in (coalesce(job.assigned_rr_technician::text, ''), coalesce(job.assigned_to::text, '')))
    or (action_name = 'start_repair' and current_state = 'under_repair')
    or (action_name = 'request_consumables' and current_state = 'awaiting_parts')
    or (action_name = 'request_fund' and current_state = 'awaiting_fund')
    or (action_name = 'submit_qa' and current_state = 'waiting_qa')
    or (action_name = 'qa_pass' and current_state = 'qa_passed')
    or (action_name = 'qa_fail' and current_state = 'qa_failed')
    or (action_name = 'return_inventory' and current_state = 'returned_inventory')
    or (action_name = 'scrap' and current_state = 'scrapped') then
    return jsonb_build_object('repair_job_id', job.id, 'part_request_id', job.part_request_id,
      'status', job.status, 'action', action_name, 'created', false);
  end if;

  if action_name in ('receive', 'assign', 'qa_pass', 'qa_fail', 'return_inventory', 'scrap') then
    if actor_role not in (
      'system_admin', 'ceo', 'agm', 'manager', 'repair_head', 'rr_hod', 'repair_hod', 'head_of_rr'
    ) then
      raise exception 'RR HOD authorization required' using errcode = '42501';
    end if;
  else
    if actor_role not in ('system_admin', 'repair_technician', 'rr_technician', 'rr_tech') then
      raise exception 'RR technician authorization required' using errcode = '42501';
    end if;
    if actor_role <> 'system_admin' and (
      actor_profile_id is null or actor_profile_id::text not in (
        coalesce(job.assigned_rr_technician::text, ''), coalesce(job.assigned_to::text, '')
      )
    ) then raise exception 'This repair job is assigned to another technician' using errcode = '42501'; end if;
  end if;

  if action_name = 'receive' then
    if current_state <> 'pending' then raise exception 'Only pending RR jobs can be received'; end if;
    next_job_status := 'received'; next_rr_status := 'received'; transition_lifecycle := 'received_by_rr';
    event_title := 'RR HOD received part';
    update public.repair_jobs set status = next_job_status, received_by = actor_name,
      condition_on_arrival = coalesce(condition_on_arrival, 'received_from_inventory'),
      action_required = coalesce(action_required, 'repair_required'), test_result = 'pending',
      inventory_transfer_status = 'not_ready', final_remark = event_title, updated_at = now_value
    where id = job.id;
  elsif action_name = 'assign' then
    if current_state <> 'received' then raise exception 'Only received jobs can be assigned'; end if;
    if p_technician_id is null or not exists (
      select 1 from public.user_profiles up where up.id = p_technician_id
        and lower(coalesce(up.role, '')) in ('repair_technician', 'rr_technician', 'rr_tech')
    ) then raise exception 'A valid RR technician is required'; end if;
    next_job_status := 'assigned'; next_rr_status := 'assigned'; transition_lifecycle := 'assigned_to_rr_technician';
    event_title := 'RR HOD assigned technician';
    update public.repair_jobs set status = next_job_status,
      assigned_rr_technician = p_technician_id, assigned_to = p_technician_id::text,
      assigned_by = actor_id, assigned_at = now_value, test_result = 'pending',
      inventory_transfer_status = 'not_ready', final_remark = event_title, updated_at = now_value
    where id = job.id;
  elsif action_name = 'start_repair' then
    if current_state not in ('assigned', 'qa_failed', 'awaiting_parts', 'awaiting_fund') then
      raise exception 'This job is not ready to start or resume repair'; end if;
    next_job_status := 'refurbishing'; next_rr_status := 'under_repair'; transition_lifecycle := 'under_repair';
    event_title := case when current_state = 'qa_failed' then 'RR technician started rework' else 'RR technician started repair' end;
    update public.repair_jobs set status = next_job_status, test_result = 'pending',
      inventory_transfer_status = 'not_ready', final_remark = event_title, updated_at = now_value
    where id = job.id;
  elsif action_name = 'request_consumables' then
    if current_state not in ('under_repair', 'qa_failed') then raise exception 'Job is not eligible for consumables'; end if;
    next_job_status := 'awaiting_parts'; next_rr_status := 'under_repair'; transition_lifecycle := 'awaiting_consumables';
    event_title := 'RR technician requested consumables';
    update public.repair_jobs set status = next_job_status, inventory_transfer_status = 'not_ready',
      final_remark = event_title, updated_at = now_value where id = job.id;
  elsif action_name = 'request_fund' then
    if current_state not in ('under_repair', 'qa_failed') then raise exception 'Job is not eligible for repair fund'; end if;
    next_job_status := 'awaiting_fund'; next_rr_status := 'under_repair'; transition_lifecycle := 'awaiting_rr_fund';
    event_title := 'RR technician requested repair fund';
    update public.repair_jobs set status = next_job_status, inventory_transfer_status = 'not_ready',
      final_remark = event_title, updated_at = now_value where id = job.id;
  elsif action_name = 'submit_qa' then
    if current_state not in ('under_repair', 'awaiting_parts', 'awaiting_fund') then
      raise exception 'This job is not ready for QA submission'; end if;
    next_job_status := 'testing'; next_rr_status := 'waiting_qa'; transition_lifecycle := 'waiting_qa';
    event_title := 'RR technician submitted job for HOD QA';
    update public.repair_jobs set status = next_job_status, test_result = 'pending',
      inventory_transfer_status = 'not_ready', final_remark = event_title, updated_at = now_value
    where id = job.id;
  elsif action_name in ('qa_pass', 'qa_fail') then
    if current_state <> 'waiting_qa' then raise exception 'Only jobs waiting for QA can be reviewed'; end if;
    if actor_profile_id is not null and actor_profile_id::text in (
      coalesce(job.assigned_rr_technician::text, ''), coalesce(job.assigned_to::text, '')
    ) then raise exception 'The assigned technician cannot approve their own QA' using errcode = '42501'; end if;
    quantity_value := coalesce(job.quantity_received, 1);
    if action_name = 'qa_pass' then
      next_job_status := 'ready_for_inventory'; next_rr_status := 'qa_passed'; transition_lifecycle := 'qa_passed';
      event_title := 'RR HOD passed QA';
      update public.repair_jobs set status = next_job_status, test_result = 'passed',
        inventory_transfer_status = 'ready_to_transfer', good_quantity = quantity_value,
        bad_quantity = 0, final_remark = event_title, updated_at = now_value where id = job.id;
    else
      next_job_status := 'qa_failed'; next_rr_status := 'qa_failed'; transition_lifecycle := 'qa_failed';
      event_title := 'RR HOD failed QA';
      update public.repair_jobs set status = next_job_status, test_result = 'failed',
        inventory_transfer_status = 'not_ready', good_quantity = 0,
        bad_quantity = quantity_value, final_remark = event_title, updated_at = now_value where id = job.id;
    end if;
  elsif action_name = 'return_inventory' then
    if current_state <> 'qa_passed' then raise exception 'Only QA-passed jobs can return to Inventory'; end if;
    next_job_status := 'sent_to_inventory'; next_rr_status := 'returned_inventory'; transition_lifecycle := 'ready_for_dispatch';
    event_title := 'RR HOD sent QA-passed part back to Inventory';
    update public.repair_jobs set status = next_job_status, test_result = 'passed',
      inventory_transfer_status = 'transferred', completed_at = now_value,
      final_remark = event_title, updated_at = now_value where id = job.id;
  elsif action_name = 'scrap' then
    if current_state not in ('waiting_qa', 'qa_failed') then raise exception 'Only failed/review-stage jobs can be scrapped'; end if;
    quantity_value := coalesce(job.quantity_received, 1);
    next_job_status := 'scrap'; next_rr_status := 'scrapped'; transition_lifecycle := 'scrapped';
    event_title := 'RR HOD scrapped irreparable part';
    update public.repair_jobs set status = next_job_status, test_result = 'failed',
      inventory_transfer_status = 'not_ready', completed_at = now_value,
      good_quantity = 0, bad_quantity = quantity_value, action_required = 'scrapped',
      final_remark = event_title, updated_at = now_value where id = job.id;
  end if;

  if job.part_request_id is not null then
    update public.part_requests set
      rr_status = next_rr_status,
      qa_status = case when action_name in ('qa_pass', 'return_inventory') then 'passed'
        when action_name in ('qa_fail', 'scrap') then 'failed'
        when action_name = 'submit_qa' then 'pending' else qa_status end,
      lifecycle_status = transition_lifecycle,
      inventory_status = case when action_name = 'return_inventory' then 'rr_verified'
        when action_name = 'scrap' then 'scrapped' else 'transferred_rr' end,
      dispatch_status = case when action_name = 'return_inventory' then 'ready_for_dispatch'
        when action_name = 'scrap' then 'not_dispatchable'
        when action_name = 'qa_fail' then 'waiting_rr_rework' else 'waiting_rr' end,
      finance_status = case when action_name = 'return_inventory' then 'pending' else finance_status end,
      assigned_rr_technician = case when action_name = 'assign' then p_technician_id else assigned_rr_technician end,
      assigned_to = case when action_name = 'assign' then p_technician_id else assigned_to end,
      assigned_by = case when action_name = 'assign' then actor_id else assigned_by end,
      assigned_at = case when action_name = 'assign' then now_value else assigned_at end,
      updated_at = now_value
    where id = job.part_request_id;

    insert into public.part_lifecycle_logs (part_request_id, status, department, note)
    values (job.part_request_id, transition_lifecycle, 'Repair & Refurbishment', event_title);
  end if;

  insert into public.operations_events (
    event_type, title, description, source_module, entity_type, entity_id, severity
  ) values (
    'RR_WORKFLOW_TRANSITION', event_title,
    event_title || ' for ' || coalesce(job.job_number, job.id::text),
    'Repair & Refurbishment', 'repair_job', job.id,
    case when action_name in ('qa_fail', 'scrap') then 'warning' else 'info' end
  );

  return jsonb_build_object('repair_job_id', job.id, 'part_request_id', job.part_request_id,
    'previous_state', current_state, 'status', next_job_status,
    'rr_status', next_rr_status, 'action', action_name);
end;
$$;

revoke all on function public.ark_current_profile_id() from public, anon;
revoke all on function public.rr_transition_repair_job(uuid, text, text, uuid) from public, anon;
grant execute on function public.rr_transition_repair_job(uuid, text, text, uuid) to authenticated;
