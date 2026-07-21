-- Section 4: atomic, idempotent RR consumable and repair-fund requests.
-- Run after 202607180019_rr_status_standardization.sql.

alter table public.rr_consumable_requests
  add column if not exists request_key text;

alter table public.fund_requests
  add column if not exists repair_job_id uuid references public.repair_jobs(id),
  add column if not exists request_key text;

create unique index if not exists rr_consumable_requests_request_key_uidx
  on public.rr_consumable_requests(request_key)
  where request_key is not null and status not in ('rejected_by_hod','rejected_by_inventory','issued','cancelled');
create unique index if not exists fund_requests_request_key_uidx
  on public.fund_requests(request_key)
  where request_key is not null and status not in ('rejected','cancelled','completed','paid');

create or replace function public.rr_create_consumable_request_transaction(
  p_repair_job_id uuid,
  p_items jsonb,
  p_notes text default null
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
  request_row public.rr_consumable_requests%rowtype;
  request_key_value text := 'rr-consumable:' || p_repair_job_id::text;
  item jsonb;
  item_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode='42501'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Consumable items must be an array'; end if;
  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 50 then raise exception 'Provide between 1 and 50 consumable items'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if nullif(trim(item ->> 'spare_part_id'),'') is null or
       coalesce(nullif(trim(item ->> 'quantity'),'')::numeric,0) <= 0 then
      raise exception 'Every consumable item requires a stock item and positive quantity';
    end if;
    if not exists(select 1 from public.spare_parts where id=nullif(trim(item ->> 'spare_part_id'),'')::uuid) then
      raise exception 'A selected consumable stock item was not found';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(request_key_value,0));
  select * into job from public.repair_jobs where id=p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  if actor_role not in ('system_admin','repair_technician','rr_technician','rr_tech') then
    raise exception 'RR technician authorization is required' using errcode='42501';
  end if;
  if actor_role <> 'system_admin' and (actor_profile is null or actor_profile::text not in (
    coalesce(job.assigned_rr_technician::text,''),coalesce(job.assigned_to::text,''))) then
    raise exception 'This repair job is assigned to another technician' using errcode='42501';
  end if;

  select * into request_row from public.rr_consumable_requests
  where request_key=request_key_value and status not in ('rejected_by_hod','rejected_by_inventory','issued','cancelled')
  order by created_at desc limit 1 for update;
  if found then return to_jsonb(request_row)||jsonb_build_object('created',false); end if;

  insert into public.rr_consumable_requests(
    repair_job_id,job_number,failed_part,requested_by,technician_id,status,items,notes,
    request_key,created_at,updated_at
  ) values(
    job.id,job.job_number,coalesce(job.item_name,job.device_name,'R/R Item'),
    coalesce(actor_profile,job.assigned_rr_technician,
      case when job.assigned_to ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then job.assigned_to::uuid end),
    coalesce(actor_profile,job.assigned_rr_technician,
      case when job.assigned_to ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then job.assigned_to::uuid end),
    'pending_hod',p_items,nullif(left(trim(p_notes),2000),''),request_key_value,now(),now()
  ) returning * into request_row;

  perform public.rr_transition_repair_job(job.id,'repair_job','request_consumables',null);
  return to_jsonb(request_row)||jsonb_build_object('created',true);
end;
$$;

create or replace function public.rr_create_fund_request_transaction(
  p_repair_job_id uuid,
  p_amount numeric,
  p_purpose text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.repair_jobs%rowtype;
  actor jsonb := public.finance_actor_identity();
  actor_profile uuid := public.ark_current_profile_id();
  actor_role text := public.ark_current_user_role();
  request_row public.fund_requests%rowtype;
  request_key_value text := 'rr-fund:' || p_repair_job_id::text;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode='42501'; end if;
  if p_amount is null or round(p_amount,2) <= 0 or p_amount > 100000000 then raise exception 'Enter a valid repair-fund amount'; end if;
  if length(trim(coalesce(p_purpose,''))) < 3 then raise exception 'Repair-fund purpose is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key_value,0));
  select * into job from public.repair_jobs where id=p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  if actor_role not in ('system_admin','repair_technician','rr_technician','rr_tech') then
    raise exception 'RR technician authorization is required' using errcode='42501';
  end if;
  if actor_role <> 'system_admin' and (actor_profile is null or actor_profile::text not in (
    coalesce(job.assigned_rr_technician::text,''),coalesce(job.assigned_to::text,''))) then
    raise exception 'This repair job is assigned to another technician' using errcode='42501';
  end if;

  select * into request_row from public.fund_requests
  where request_key=request_key_value and lower(coalesce(status,'')) not in ('rejected','cancelled','completed','paid')
  order by created_at desc limit 1 for update;
  if found then return to_jsonb(request_row)||jsonb_build_object('created',false); end if;

  insert into public.fund_requests(
    request_category,request_type,request_subtype,amount,purpose,notes,
    requested_by,requested_by_email,requested_by_name,department,role,source_module,
    status,finance_status,hr_status,agm_status,operations_status,
    repair_job_id,request_key,created_at,updated_at
  ) values(
    'fund','Repair Fund','Repair Fund',round(p_amount,2),left(trim(p_purpose),1000),nullif(left(trim(p_notes),2000),''),
    auth.uid(),actor->>'email',actor->>'name',coalesce(actor->>'department','Repair & Refurbishment'),actor_role,
    'Repair & Refurbishment','pending','pending_approval','pending','pending','pending',
    job.id,request_key_value,now(),now()
  ) returning * into request_row;

  perform public.rr_transition_repair_job(job.id,'repair_job','request_fund',null);
  return to_jsonb(request_row)||jsonb_build_object('created',true);
end;
$$;

revoke all on function public.rr_create_consumable_request_transaction(uuid,jsonb,text) from public,anon;
revoke all on function public.rr_create_fund_request_transaction(uuid,numeric,text,text) from public,anon;
grant execute on function public.rr_create_consumable_request_transaction(uuid,jsonb,text) to authenticated;
grant execute on function public.rr_create_fund_request_transaction(uuid,numeric,text,text) to authenticated;
