-- Correct RR support requests so they only attach to active repair work and
-- authorized support RPCs can change protected repair-job workflow fields.

alter function public.rr_create_consumable_request_v2(uuid,jsonb,text)
  rename to rr_create_consumable_request_v2_internal;

create or replace function public.rr_create_consumable_request_v2(
  p_repair_job_id uuid, p_items jsonb, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job_status text;
begin
  select lower(coalesce(status,'')) into job_status
  from public.repair_jobs where id=p_repair_job_id;
  if not found then raise exception 'Repair job was not found'; end if;
  if job_status not in ('refurbishing','under_repair','qa_failed') then
    raise exception 'Consumables can be requested only for an active repair or rework job. Current status: %', job_status;
  end if;
  perform set_config('ark.rr_workflow_rpc','on',true);
  return public.rr_create_consumable_request_v2_internal(p_repair_job_id,p_items,p_notes);
end;
$$;

alter function public.rr_create_fund_request_v2(uuid,numeric,text,text)
  rename to rr_create_fund_request_v2_internal;

create or replace function public.rr_create_fund_request_v2(
  p_repair_job_id uuid, p_amount numeric, p_purpose text, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job_status text;
begin
  select lower(coalesce(status,'')) into job_status
  from public.repair_jobs where id=p_repair_job_id;
  if not found then raise exception 'Repair job was not found'; end if;
  if job_status not in ('refurbishing','under_repair','qa_failed') then
    raise exception 'Funds can be requested only for an active repair or rework job. Current status: %', job_status;
  end if;
  perform set_config('ark.rr_workflow_rpc','on',true);
  return public.rr_create_fund_request_v2_internal(p_repair_job_id,p_amount,p_purpose,p_notes);
end;
$$;

alter function public.rr_transition_consumable_request(uuid,text,text)
  rename to rr_transition_consumable_request_internal;

create or replace function public.rr_transition_consumable_request(
  p_request_id uuid, p_action text, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('ark.rr_workflow_rpc','on',true);
  return public.rr_transition_consumable_request_internal(p_request_id,p_action,p_note);
end;
$$;

alter function public.rr_transition_fund_request(uuid,text,text)
  rename to rr_transition_fund_request_internal;

create or replace function public.rr_transition_fund_request(
  p_request_id uuid, p_action text, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('ark.rr_workflow_rpc','on',true);
  return public.rr_transition_fund_request_internal(p_request_id,p_action,p_note);
end;
$$;

create or replace function public.rr_sync_disbursed_fund_to_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.repair_job_id is not null
    and lower(coalesce(new.finance_status,'')) = 'disbursed'
    and lower(coalesce(old.finance_status,'')) <> 'disbursed' then
    perform set_config('ark.rr_workflow_rpc','on',true);
    update public.repair_jobs
    set status='refurbishing',updated_at=now()
    where id=new.repair_job_id
      and lower(coalesce(status,''))='awaiting_fund';
  end if;
  return new;
end;
$$;

revoke all on function public.rr_create_consumable_request_v2_internal(uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.rr_create_fund_request_v2_internal(uuid,numeric,text,text) from public,anon,authenticated;
revoke all on function public.rr_transition_consumable_request_internal(uuid,text,text) from public,anon,authenticated;
revoke all on function public.rr_transition_fund_request_internal(uuid,text,text) from public,anon,authenticated;
revoke all on function public.rr_create_consumable_request_v2(uuid,jsonb,text) from public,anon;
revoke all on function public.rr_create_fund_request_v2(uuid,numeric,text,text) from public,anon;
revoke all on function public.rr_transition_consumable_request(uuid,text,text) from public,anon;
revoke all on function public.rr_transition_fund_request(uuid,text,text) from public,anon;
grant execute on function public.rr_create_consumable_request_v2(uuid,jsonb,text) to authenticated;
grant execute on function public.rr_create_fund_request_v2(uuid,numeric,text,text) to authenticated;
grant execute on function public.rr_transition_consumable_request(uuid,text,text) to authenticated;
grant execute on function public.rr_transition_fund_request(uuid,text,text) to authenticated;
