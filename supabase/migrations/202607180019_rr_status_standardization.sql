-- Section 4: canonical RR statuses and protected repair-job transitions.
-- Run after 202607180018_part_request_workflow_transactions.sql.

-- Normalize the known duplicate aliases already stored in workflow records.
update public.part_requests
set lifecycle_status = 'assigned_to_rr_technician', updated_at = now()
where lower(coalesce(lifecycle_status, '')) in ('assigned_to_rr_tech', 'assigned_to_rr_technician');

update public.repair_jobs
set status = case lower(coalesce(status, ''))
  when 'under_repair' then 'refurbishing'
  when 'waiting_qa' then 'testing'
  when 'qa_passed' then 'ready_for_inventory'
  when 'scrapped' then 'scrap'
  else lower(status)
end,
updated_at = now()
where lower(coalesce(status, '')) in ('under_repair','waiting_qa','qa_passed','scrapped');

-- Preserve the existing implementation as an internal function, then expose a
-- guarded wrapper. The transaction-local marker is visible only while the RPC
-- is performing its authorized updates.
alter function public.rr_transition_repair_job(uuid,text,text,uuid)
  rename to rr_transition_repair_job_internal;

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
begin
  perform set_config('ark.rr_workflow_rpc', 'on', true);
  return public.rr_transition_repair_job_internal(
    p_record_id, p_record_type, p_action, p_technician_id
  );
end;
$$;

create or replace function public.rr_guard_repair_job_workflow_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('ark.rr_workflow_rpc', true) = 'on' then return new; end if;

  if new.status is distinct from old.status
    or new.assigned_rr_technician is distinct from old.assigned_rr_technician
    or new.assigned_to is distinct from old.assigned_to
    or new.assigned_by is distinct from old.assigned_by
    or new.assigned_at is distinct from old.assigned_at
    or new.test_result is distinct from old.test_result
    or new.inventory_transfer_status is distinct from old.inventory_transfer_status
    or new.good_quantity is distinct from old.good_quantity
    or new.bad_quantity is distinct from old.bad_quantity
    or new.completed_at is distinct from old.completed_at
  then
    raise exception 'RR workflow fields must be changed through rr_transition_repair_job'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists rr_repair_job_workflow_guard on public.repair_jobs;
create trigger rr_repair_job_workflow_guard
before update on public.repair_jobs
for each row execute function public.rr_guard_repair_job_workflow_fields();

revoke all on function public.rr_transition_repair_job_internal(uuid,text,text,uuid)
  from public, anon, authenticated;
revoke all on function public.rr_transition_repair_job(uuid,text,text,uuid)
  from public, anon;
revoke all on function public.rr_guard_repair_job_workflow_fields()
  from public, anon, authenticated;
grant execute on function public.rr_transition_repair_job(uuid,text,text,uuid)
  to authenticated;
