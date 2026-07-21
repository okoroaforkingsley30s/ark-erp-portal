-- RR quantity-level physical-unit processing.

create table if not exists public.rr_repair_units (
  id uuid primary key default gen_random_uuid(),
  repair_job_id uuid not null references public.repair_jobs(id) on delete cascade,
  part_request_id uuid references public.part_requests(id) on delete set null,
  ticket_id text,
  unit_number integer not null check (unit_number > 0),
  tracking_number text not null,
  serial_number text,
  item_name text not null,
  part_number text,
  condition_on_arrival text,
  status text not null default 'received' check (status in (
    'received','assigned','under_repair','waiting_qa','qa_passed','qa_failed',
    'returned_inventory','scrapped'
  )),
  assigned_technician_id uuid references public.user_profiles(id) on delete restrict,
  assigned_by uuid,
  assigned_at timestamptz,
  diagnosis text,
  repair_action text,
  parts_used text,
  qa_notes text,
  qa_reviewed_by uuid,
  qa_reviewed_at timestamptz,
  inventory_received_by uuid,
  inventory_received_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repair_job_id, unit_number),
  unique (tracking_number)
);

create unique index if not exists rr_repair_units_serial_uidx
  on public.rr_repair_units (lower(trim(serial_number)))
  where serial_number is not null and trim(serial_number) <> '';
create index if not exists rr_repair_units_job_idx on public.rr_repair_units(repair_job_id);
create index if not exists rr_repair_units_technician_idx on public.rr_repair_units(assigned_technician_id, status);
create index if not exists rr_repair_units_ticket_idx on public.rr_repair_units(ticket_id);

alter table public.rr_repair_units enable row level security;

drop policy if exists ark_rr_units_read on public.rr_repair_units;
create policy ark_rr_units_read on public.rr_repair_units for select to authenticated
using (
  public.ark_has_any_role(array[
    'system_admin','ceo','agm','manager','operations','inventory','repair_head',
    'rr_hod','repair_hod','head_of_rr'
  ]::text[])
  or assigned_technician_id = public.ark_current_profile_id()
);

grant select on public.rr_repair_units to authenticated;

create or replace function public.ark_rr_create_units(p_repair_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.repair_jobs%rowtype;
  target_quantity integer;
  created_count integer := 0;
begin
  select * into job from public.repair_jobs where id = p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  target_quantity := greatest(coalesce(job.quantity_received, 1), 1);

  insert into public.rr_repair_units (
    repair_job_id, part_request_id, ticket_id, unit_number, tracking_number,
    item_name, part_number, condition_on_arrival, status
  )
  select job.id, job.part_request_id, job.ticket_id, unit_no,
    coalesce(job.job_number, 'RR-' || left(job.id::text, 8)) || '-U' || lpad(unit_no::text, 3, '0'),
    coalesce(nullif(job.item_name, ''), nullif(job.device_name, ''), 'RR Unit'),
    job.part_number, job.condition_on_arrival,
    case lower(coalesce(job.status, 'received'))
      when 'assigned' then 'assigned'
      when 'refurbishing' then 'under_repair'
      when 'under_repair' then 'under_repair'
      when 'testing' then 'waiting_qa'
      when 'waiting_qa' then 'waiting_qa'
      when 'ready_for_inventory' then 'qa_passed'
      when 'qa_passed' then 'qa_passed'
      when 'qa_failed' then 'qa_failed'
      when 'sent_to_inventory' then 'returned_inventory'
      when 'scrap' then 'scrapped'
      when 'scrapped' then 'scrapped'
      else 'received'
    end
  from generate_series(1, target_quantity) unit_no
  on conflict (repair_job_id, unit_number) do nothing;
  get diagnostics created_count = row_count;

  update public.rr_repair_units set
    assigned_technician_id = coalesce(assigned_technician_id, job.assigned_rr_technician),
    assigned_by = coalesce(assigned_by, job.assigned_by),
    assigned_at = coalesce(assigned_at, job.assigned_at),
    updated_at = now()
  where repair_job_id = job.id;
  return created_count;
end;
$$;

create or replace function public.ark_rr_seed_units_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.ark_rr_create_units(new.id);
  return new;
end;
$$;

drop trigger if exists ark_rr_seed_units on public.repair_jobs;
create trigger ark_rr_seed_units
after insert or update of quantity_received on public.repair_jobs
for each row execute function public.ark_rr_seed_units_trigger();

do $$ declare job_id uuid; begin
  for job_id in select id from public.repair_jobs loop
    perform public.ark_rr_create_units(job_id);
  end loop;
end $$;

create or replace function public.ark_rr_sync_parent(p_repair_job_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  total_count integer; received_count integer; assigned_count integer;
  repair_count integer; qa_count integer; pass_count integer; fail_count integer;
  returned_count integer; scrap_count integer; parent_status text;
  linked_request uuid;
begin
  select count(*), count(*) filter(where status='received'), count(*) filter(where status='assigned'),
    count(*) filter(where status='under_repair'), count(*) filter(where status='waiting_qa'),
    count(*) filter(where status='qa_passed'), count(*) filter(where status='qa_failed'),
    count(*) filter(where status='returned_inventory'), count(*) filter(where status='scrapped')
  into total_count, received_count, assigned_count, repair_count, qa_count, pass_count,
    fail_count, returned_count, scrap_count
  from public.rr_repair_units where repair_job_id=p_repair_job_id;

  parent_status := case
    when total_count > 0 and returned_count + scrap_count = total_count then 'sent_to_inventory'
    when qa_count > 0 then 'testing'
    when repair_count > 0 then 'refurbishing'
    when fail_count > 0 then 'qa_failed'
    when pass_count > 0 then 'ready_for_inventory'
    when assigned_count > 0 then 'assigned'
    else 'received'
  end;

  perform set_config('ark.rr_workflow_rpc', 'on', true);
  update public.repair_jobs set status=parent_status,
    good_quantity=pass_count+returned_count,
    bad_quantity=fail_count+scrap_count,
    test_result=case when total_count > 0 and pass_count+returned_count=total_count then 'passed'
      when fail_count+scrap_count > 0 then 'failed' else 'pending' end,
    inventory_transfer_status=case when returned_count+scrap_count=total_count then 'transferred'
      when pass_count>0 then 'ready_to_transfer' else 'not_ready' end,
    completed_at=case when returned_count+scrap_count=total_count then coalesce(completed_at,now()) else null end,
    updated_at=now()
  where id=p_repair_job_id returning part_request_id into linked_request;

  if linked_request is not null then
    update public.part_requests set
      rr_status=case when returned_count+scrap_count=total_count then 'returned_inventory'
        when qa_count>0 then 'waiting_qa' when repair_count>0 then 'under_repair'
        when fail_count>0 then 'qa_failed' when pass_count>0 then 'qa_passed'
        when assigned_count>0 then 'assigned' else 'received' end,
      qa_status=case when total_count>0 and pass_count+returned_count=total_count then 'passed'
        when fail_count+scrap_count>0 then 'failed' else 'pending' end,
      lifecycle_status=case when returned_count+scrap_count=total_count then 'returned_to_inventory'
        when qa_count>0 then 'waiting_qa' when repair_count>0 then 'under_repair'
        when pass_count>0 then 'qa_passed' when fail_count>0 then 'qa_failed'
        when assigned_count>0 then 'assigned_to_rr_technician' else 'received_by_rr' end,
      inventory_status=case when returned_count+scrap_count=total_count then 'rr_verified' else 'transferred_rr' end,
      updated_at=now()
    where id=linked_request;
  end if;
end;
$$;

create or replace function public.ark_rr_transition_unit(
  p_unit_id uuid, p_action text, p_technician_id uuid default null,
  p_serial_number text default null, p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  unit_record public.rr_repair_units%rowtype;
  actor_id uuid := auth.uid();
  actor_profile uuid := public.ark_current_profile_id();
  actor_role text := public.ark_current_user_role();
  action_name text := lower(trim(coalesce(p_action,'')));
  hod boolean;
  technician boolean;
  next_status text;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rr-unit:'||p_unit_id::text,0));
  select * into unit_record from public.rr_repair_units where id=p_unit_id for update;
  if not found then raise exception 'RR physical unit was not found'; end if;

  hod := actor_role in ('system_admin','ceo','agm','manager','repair_head','rr_hod','repair_hod','head_of_rr');
  technician := actor_role in ('system_admin','repair_technician','rr_technician','rr_tech');

  if action_name='assign' then
    if not hod or unit_record.status<>'received' then raise exception 'Only RR HOD can assign a received unit' using errcode='42501'; end if;
    if p_technician_id is null or not exists(select 1 from public.user_profiles where id=p_technician_id and lower(coalesce(role,'')) in ('repair_technician','rr_technician','rr_tech')) then raise exception 'A valid RR technician is required'; end if;
    next_status := 'assigned';
    update public.rr_repair_units set status=next_status, assigned_technician_id=p_technician_id,
      assigned_by=actor_id, assigned_at=now(), serial_number=coalesce(nullif(trim(p_serial_number),''),serial_number), updated_at=now() where id=p_unit_id;
  elsif action_name in ('start_repair','submit_qa') then
    if not technician or (actor_role<>'system_admin' and actor_profile is distinct from unit_record.assigned_technician_id) then raise exception 'This unit is assigned to another technician' using errcode='42501'; end if;
    if action_name='start_repair' and unit_record.status not in ('assigned','qa_failed') then raise exception 'Unit is not ready for repair'; end if;
    if action_name='submit_qa' and unit_record.status<>'under_repair' then raise exception 'Unit is not ready for QA submission'; end if;
    next_status := case action_name when 'start_repair' then 'under_repair' else 'waiting_qa' end;
    update public.rr_repair_units set status=next_status,
      serial_number=coalesce(nullif(trim(p_serial_number),''),serial_number),
      diagnosis=case when action_name='submit_qa' then coalesce(nullif(trim(p_notes),''),diagnosis) else diagnosis end,
      repair_action=case when action_name='submit_qa' then coalesce(nullif(trim(p_notes),''),repair_action) else repair_action end,
      updated_at=now() where id=p_unit_id;
  elsif action_name in ('qa_pass','qa_fail','return_inventory','scrap') then
    if not hod then raise exception 'RR HOD authorization required' using errcode='42501'; end if;
    if action_name in ('qa_pass','qa_fail') and unit_record.status<>'waiting_qa' then raise exception 'Only units waiting for QA can be reviewed'; end if;
    if action_name='return_inventory' and unit_record.status<>'qa_passed' then raise exception 'Only a QA-passed unit can return to Inventory'; end if;
    if action_name='scrap' and unit_record.status not in ('qa_failed','waiting_qa') then raise exception 'Only a failed/review unit can be scrapped'; end if;
    next_status := case action_name when 'qa_pass' then 'qa_passed' when 'qa_fail' then 'qa_failed' when 'return_inventory' then 'returned_inventory' else 'scrapped' end;
    update public.rr_repair_units set status=next_status, qa_notes=coalesce(nullif(trim(p_notes),''),qa_notes),
      qa_reviewed_by=case when action_name in ('qa_pass','qa_fail') then actor_id else qa_reviewed_by end,
      qa_reviewed_at=case when action_name in ('qa_pass','qa_fail') then now() else qa_reviewed_at end,
      completed_at=case when action_name in ('return_inventory','scrap') then now() else completed_at end,
      updated_at=now() where id=p_unit_id;
  else raise exception 'Unsupported RR unit action %', action_name;
  end if;

  perform public.ark_rr_sync_parent(unit_record.repair_job_id);
  return jsonb_build_object('unit_id',p_unit_id,'repair_job_id',unit_record.repair_job_id,'status',next_status);
end;
$$;

create or replace view public.rr_repair_unit_summary with (security_invoker=true) as
select repair_job_id, count(*)::integer total_units,
  count(*) filter(where status='received')::integer received,
  count(*) filter(where status='assigned')::integer assigned,
  count(*) filter(where status='under_repair')::integer under_repair,
  count(*) filter(where status='waiting_qa')::integer waiting_qa,
  count(*) filter(where status='qa_passed')::integer passed,
  count(*) filter(where status='qa_failed')::integer failed,
  count(*) filter(where status='returned_inventory')::integer returned_inventory,
  count(*) filter(where status='scrapped')::integer scrapped
from public.rr_repair_units group by repair_job_id;

grant select on public.rr_repair_unit_summary to authenticated;
revoke all on function public.ark_rr_create_units(uuid) from public,anon,authenticated;
revoke all on function public.ark_rr_sync_parent(uuid) from public,anon,authenticated;
revoke all on function public.ark_rr_transition_unit(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.ark_rr_transition_unit(uuid,text,uuid,text,text) to authenticated;
