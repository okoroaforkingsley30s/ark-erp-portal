-- Keep RR HOD parent assignment aligned with physical-unit assignment.

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
  transition_result jsonb;
  target_job_id uuid;
  action_name text := lower(trim(coalesce(p_action, '')));
begin
  perform set_config('ark.rr_workflow_rpc', 'on', true);
  transition_result := public.rr_transition_repair_job_internal(
    p_record_id, p_record_type, p_action, p_technician_id
  );

  target_job_id := nullif(transition_result ->> 'repair_job_id', '')::uuid;

  if action_name = 'assign' and target_job_id is not null then
    perform public.ark_rr_create_units(target_job_id);

    update public.rr_repair_units set
      status = case when status = 'received' then 'assigned' else status end,
      assigned_technician_id = p_technician_id,
      assigned_by = auth.uid(),
      assigned_at = coalesce(assigned_at, now()),
      updated_at = now()
    where repair_job_id = target_job_id
      and status in ('received', 'assigned');

    perform public.ark_rr_sync_parent(target_job_id);
  end if;

  return transition_result;
end;
$$;

-- Repair assignments completed before this alignment migration.
update public.rr_repair_units unit_record set
  status = case when unit_record.status = 'received' then 'assigned' else unit_record.status end,
  assigned_technician_id = job.assigned_rr_technician,
  assigned_by = coalesce(unit_record.assigned_by, job.assigned_by),
  assigned_at = coalesce(unit_record.assigned_at, job.assigned_at, now()),
  updated_at = now()
from public.repair_jobs job
where unit_record.repair_job_id = job.id
  and job.assigned_rr_technician is not null
  and unit_record.status in ('received', 'assigned')
  and unit_record.assigned_technician_id is distinct from job.assigned_rr_technician;

revoke all on function public.rr_transition_repair_job(uuid,text,text,uuid)
  from public, anon;
grant execute on function public.rr_transition_repair_job(uuid,text,text,uuid)
  to authenticated;
