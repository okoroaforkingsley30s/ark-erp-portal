-- Enforce explicit RR HOD assignment before technician work or support requests.

create or replace function public.rr_assign_repair_job(
  p_repair_job_id uuid,
  p_technician_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_id uuid := auth.uid();
  job public.repair_jobs%rowtype;
  technician public.user_profiles%rowtype;
  job_status text;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if actor_role not in (
    'system_admin', 'ceo', 'agm', 'manager', 'repair_head',
    'rr_hod', 'repair_hod', 'head_of_rr'
  ) then
    raise exception 'RR HOD authorization required' using errcode = '42501';
  end if;

  select * into job
  from public.repair_jobs
  where id = p_repair_job_id or part_request_id = p_repair_job_id
  order by case when id = p_repair_job_id then 0 else 1 end, created_at asc
  limit 1
  for update;

  if not found then raise exception 'Repair job was not found'; end if;

  job_status := lower(trim(coalesce(job.status, '')));
  if job_status in (
    'testing', 'waiting_qa', 'ready_for_inventory', 'qa_passed',
    'sent_to_inventory', 'scrap', 'scrapped', 'closed', 'completed'
  ) then
    raise exception 'This repair job can no longer be assigned. Current status: %', job_status;
  end if;

  select * into technician
  from public.user_profiles up
  where up.id = p_technician_profile_id
    and lower(coalesce(up.role, '')) in (
      'repair_technician', 'rr_technician', 'rr_tech'
    )
  limit 1;

  if not found then raise exception 'A valid RR technician profile is required'; end if;

  perform set_config('ark.rr_workflow_rpc', 'on', true);
  update public.repair_jobs
  set assigned_rr_technician = technician.id,
      assigned_to = technician.id::text,
      assigned_by = actor_id,
      assigned_at = now(),
      status = case
        when job_status in ('pending_rr', 'received', 'assigned', '') then 'assigned'
        else status
      end,
      final_remark = 'RR HOD assigned technician: ' || coalesce(technician.user_email, technician.id::text),
      updated_at = now()
  where id = job.id;

  return jsonb_build_object(
    'repair_job_id', job.id,
    'status', case when job_status in ('pending_rr', 'received', 'assigned', '') then 'assigned' else job.status end,
    'technician_profile_id', technician.id,
    'technician_email', technician.user_email
  );
end;
$$;

create or replace function public.rr_create_consumable_request_v2(
  p_repair_job_id uuid, p_items jsonb, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.repair_jobs%rowtype;
  actor_profile uuid := public.ark_current_profile_id();
  actor_role text := public.ark_current_user_role();
begin
  select * into job from public.repair_jobs where id = p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  if lower(coalesce(job.status,'')) not in ('refurbishing','under_repair','qa_failed') then
    raise exception 'Consumables can be requested only for an active repair or rework job. Current status: %', job.status;
  end if;
  if actor_role not in ('system_admin','repair_head','rr_hod','repair_hod','head_of_rr') then
    if job.assigned_rr_technician is null and nullif(job.assigned_to, '') is null then
      raise exception 'RR HOD must assign this repair job before consumables can be requested' using errcode = '42501';
    end if;
    if actor_profile is null or actor_profile::text not in (
      coalesce(job.assigned_rr_technician::text, ''), coalesce(job.assigned_to, '')
    ) then
      raise exception 'This repair job is assigned to another technician' using errcode = '42501';
    end if;
  end if;
  perform set_config('ark.rr_workflow_rpc','on',true);
  return public.rr_create_consumable_request_v2_internal(p_repair_job_id,p_items,p_notes);
end;
$$;

create or replace function public.rr_create_fund_request_v2(
  p_repair_job_id uuid, p_amount numeric, p_purpose text, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.repair_jobs%rowtype;
  actor_profile uuid := public.ark_current_profile_id();
  actor_role text := public.ark_current_user_role();
begin
  select * into job from public.repair_jobs where id = p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  if lower(coalesce(job.status,'')) not in ('refurbishing','under_repair','qa_failed') then
    raise exception 'Funds can be requested only for an active repair or rework job. Current status: %', job.status;
  end if;
  if actor_role not in ('system_admin','repair_head','rr_hod','repair_hod','head_of_rr') then
    if job.assigned_rr_technician is null and nullif(job.assigned_to, '') is null then
      raise exception 'RR HOD must assign this repair job before funds can be requested' using errcode = '42501';
    end if;
    if actor_profile is null or actor_profile::text not in (
      coalesce(job.assigned_rr_technician::text, ''), coalesce(job.assigned_to, '')
    ) then
      raise exception 'This repair job is assigned to another technician' using errcode = '42501';
    end if;
  end if;
  perform set_config('ark.rr_workflow_rpc','on',true);
  return public.rr_create_fund_request_v2_internal(p_repair_job_id,p_amount,p_purpose,p_notes);
end;
$$;

revoke all on function public.rr_assign_repair_job(uuid,uuid) from public, anon;
revoke all on function public.rr_create_consumable_request_v2(uuid,jsonb,text) from public, anon;
revoke all on function public.rr_create_fund_request_v2(uuid,numeric,text,text) from public, anon;
grant execute on function public.rr_assign_repair_job(uuid,uuid) to authenticated;
grant execute on function public.rr_create_consumable_request_v2(uuid,jsonb,text) to authenticated;
grant execute on function public.rr_create_fund_request_v2(uuid,numeric,text,text) to authenticated;
