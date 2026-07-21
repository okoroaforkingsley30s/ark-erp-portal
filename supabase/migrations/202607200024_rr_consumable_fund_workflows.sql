-- Dedicated RR consumables and repair-fund approval/release workflows.

alter table public.rr_consumable_requests
  add column if not exists hod_approved_by text,
  add column if not exists hod_approved_at timestamptz,
  add column if not exists inventory_released_by text,
  add column if not exists inventory_released_at timestamptz,
  add column if not exists used_by text,
  add column if not exists used_at timestamptz,
  add column if not exists rejection_reason text;

drop index if exists public.rr_consumable_requests_request_key_uidx;
create unique index rr_consumable_requests_request_key_uidx
  on public.rr_consumable_requests(request_key)
  where request_key is not null
    and status not in ('rejected_by_hod','rejected_by_inventory','used','cancelled');

alter table public.fund_requests
  add column if not exists rr_hod_status text,
  add column if not exists rr_hod_approved_by text,
  add column if not exists rr_hod_approved_at timestamptz,
  add column if not exists rr_hod_note text;

drop index if exists public.fund_requests_request_key_uidx;
create unique index fund_requests_request_key_uidx
  on public.fund_requests(request_key)
  where request_key is not null
    and status not in ('rejected','cancelled','completed','paid','disbursed');

drop policy if exists ark_rr_fund_hod_select on public.fund_requests;
create policy ark_rr_fund_hod_select on public.fund_requests
for select to authenticated
using (
  repair_job_id is not null
  and public.ark_current_user_role() in (
    'system_admin','repair_head','rr_hod','repair_hod','head_of_rr'
  )
);

alter table public.rr_consumable_requests
  drop constraint if exists rr_consumable_requests_status_guard;
alter table public.rr_consumable_requests
  add constraint rr_consumable_requests_status_guard check (status in (
    'pending_hod','pending_inventory','released','used','out_of_stock',
    'rejected','rejected_by_hod','rejected_by_inventory','cancelled'
  )) not valid;

create or replace function public.ark_guard_operational_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor_role text := public.ark_current_user_role(); allowed boolean := false;
begin
  if new.status is not distinct from old.status then return new; end if;
  if tg_table_name = 'inventory_dispatch_fund_requests' then
    if actor_role not in ('system_admin','finance','head_of_account','finance_manager','accountant') then
      raise exception 'Finance authorization required' using errcode = '42501';
    end if;
    allowed :=
      (old.status = 'pending_finance' and new.status in ('approved','rejected')) or
      (old.status = 'approved' and new.status in ('disbursed','rejected'));
  elsif tg_table_name = 'rr_consumable_requests' then
    if old.status = 'pending_hod' then
      if actor_role not in ('system_admin','repair_head','rr_hod','repair_hod','head_of_rr') then
        raise exception 'RR HOD authorization required' using errcode = '42501';
      end if;
      allowed := new.status in ('pending_inventory','rejected_by_hod');
    elsif old.status = 'pending_inventory' then
      if actor_role not in ('system_admin','inventory','inventory_head','inventory_manager') then
        raise exception 'Inventory authorization required' using errcode = '42501';
      end if;
      allowed := new.status in ('released','out_of_stock','rejected_by_inventory');
    elsif old.status = 'released' then
      if actor_role not in (
        'system_admin','repair_head','rr_hod','repair_hod','head_of_rr',
        'repair_technician','rr_technician','rr_tech'
      ) then raise exception 'RR authorization required' using errcode = '42501'; end if;
      allowed := new.status = 'used';
    end if;
  end if;
  if not allowed then raise exception 'Invalid % status transition: % -> %', tg_table_name, old.status, new.status; end if;
  return new;
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
  request_row public.rr_consumable_requests%rowtype;
  request_key_value text := 'rr-consumable:' || p_repair_job_id::text;
  item jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode='42501'; end if;
  if actor_role not in (
    'system_admin','repair_head','rr_hod','repair_hod','head_of_rr',
    'repair_technician','rr_technician','rr_tech'
  ) then raise exception 'RR authorization is required' using errcode='42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Provide between 1 and 50 consumable items';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if nullif(trim(item ->> 'spare_part_id'),'') is null
      or coalesce(nullif(trim(item ->> 'quantity'),'')::numeric,0) <= 0 then
      raise exception 'Every consumable item requires a stock item and positive quantity';
    end if;
    if not exists(select 1 from public.spare_parts where id=(item ->> 'spare_part_id')::uuid) then
      raise exception 'A selected consumable stock item was not found';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(request_key_value,0));
  select * into job from public.repair_jobs where id=p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  if actor_role in ('repair_technician','rr_technician','rr_tech')
    and (actor_profile is null or actor_profile::text not in (
      coalesce(job.assigned_rr_technician::text,''),coalesce(job.assigned_to::text,''))) then
    raise exception 'This repair job is assigned to another technician' using errcode='42501';
  end if;

  select * into request_row from public.rr_consumable_requests
  where request_key=request_key_value
    and status not in ('rejected_by_hod','rejected_by_inventory','used','cancelled')
  order by created_at desc limit 1 for update;
  if found then return to_jsonb(request_row)||jsonb_build_object('created',false); end if;

  insert into public.rr_consumable_requests(
    repair_job_id,job_number,failed_part,requested_by,technician_id,status,items,notes,
    request_key,created_at,updated_at
  ) values(
    job.id,job.job_number,coalesce(job.item_name,job.device_name,'R/R Item'),
    coalesce(actor_profile,job.assigned_rr_technician),
    coalesce(actor_profile,job.assigned_rr_technician),
    'pending_hod',p_items,nullif(left(trim(p_notes),2000),''),request_key_value,now(),now()
  ) returning * into request_row;

  update public.repair_jobs set status='awaiting_parts',updated_at=now() where id=job.id;
  return to_jsonb(request_row)||jsonb_build_object('created',true);
end;
$$;

create or replace function public.rr_transition_consumable_request(
  p_request_id uuid, p_action text, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req public.rr_consumable_requests%rowtype;
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  action_name text := lower(trim(p_action));
  item jsonb;
  stock public.spare_parts%rowtype;
  qty numeric;
  old_qty numeric;
  new_qty numeric;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rr-consumable:'||p_request_id::text,0));
  select * into req from public.rr_consumable_requests where id=p_request_id for update;
  if not found then raise exception 'Consumable request was not found'; end if;

  if action_name in ('hod_approve','hod_reject') then
    if actor_role not in ('system_admin','repair_head','rr_hod','repair_hod','head_of_rr') then
      raise exception 'RR HOD authorization required' using errcode='42501';
    end if;
    if req.status <> 'pending_hod' then raise exception 'Request is not awaiting RR HOD review'; end if;
    update public.rr_consumable_requests set
      status=case when action_name='hod_approve' then 'pending_inventory' else 'rejected_by_hod' end,
      hod_approved_by=case when action_name='hod_approve' then actor_email else hod_approved_by end,
      hod_approved_at=case when action_name='hod_approve' then now() else hod_approved_at end,
      rejection_reason=case when action_name='hod_reject' then coalesce(nullif(trim(p_note),''),'Rejected by RR HOD') else rejection_reason end,
      updated_at=now() where id=p_request_id;
    if action_name='hod_reject' then
      update public.repair_jobs set status='refurbishing',updated_at=now() where id=req.repair_job_id;
    end if;
  elsif action_name in ('inventory_release','inventory_reject') then
    if actor_role not in ('system_admin','inventory','inventory_head','inventory_manager') then
      raise exception 'Inventory authorization required' using errcode='42501';
    end if;
    if req.status <> 'pending_inventory' then raise exception 'Request is not awaiting Inventory'; end if;
    if action_name='inventory_reject' then
      update public.rr_consumable_requests set status='rejected_by_inventory',
        rejection_reason=coalesce(nullif(trim(p_note),''),'Rejected by Inventory'),updated_at=now()
      where id=p_request_id;
      update public.repair_jobs set status='refurbishing',updated_at=now() where id=req.repair_job_id;
    else
      for item in select value from jsonb_array_elements(req.items) loop
        qty := coalesce(nullif(item ->> 'quantity','')::numeric,0);
        select * into stock from public.spare_parts where id=(item ->> 'spare_part_id')::uuid for update;
        if not found then raise exception 'Consumable stock item was not found'; end if;
        old_qty := coalesce(stock.quantity_available,0);
        if qty <= 0 or old_qty < qty then
          raise exception 'Insufficient stock for %. Available %, requested %',
            coalesce(stock.part_name,stock.part_number,'consumable'),old_qty,qty;
        end if;
        new_qty := old_qty-qty;
        update public.spare_parts set quantity_available=new_qty,updated_at=now() where id=stock.id;
        insert into public.inventory_movements(
          item_id,part_number,item_description,warehouse,movement_type,
          quantity_changed,previous_quantity,new_quantity,reason,
          performed_by_email,performed_by_name,created_at
        ) values(
          stock.id,stock.part_number,coalesce(stock.description,stock.part_name,'RR consumable'),
          coalesce(stock.warehouse,'Oshodi'),'rr_consumable_release',-qty,old_qty,new_qty,
          'Released to RR for job '||coalesce(req.job_number,req.repair_job_id::text),
          actor_email,public.inventory_actor_name(),now()
        );
      end loop;
      update public.rr_consumable_requests set status='released',inventory_released_by=actor_email,
        inventory_released_at=now(),updated_at=now() where id=p_request_id;
    end if;
  elsif action_name='confirm_used' then
    if actor_role not in (
      'system_admin','repair_head','rr_hod','repair_hod','head_of_rr',
      'repair_technician','rr_technician','rr_tech'
    ) then raise exception 'RR authorization required' using errcode='42501'; end if;
    if req.status <> 'released' then raise exception 'Inventory has not released this request'; end if;
    update public.rr_consumable_requests set status='used',used_by=actor_email,used_at=now(),updated_at=now()
    where id=p_request_id;
    update public.repair_jobs set status='refurbishing',updated_at=now() where id=req.repair_job_id;
  else raise exception 'Unsupported consumable action';
  end if;

  select * into req from public.rr_consumable_requests where id=p_request_id;
  return to_jsonb(req)||jsonb_build_object('action',action_name,'changed',true);
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
  actor jsonb := public.finance_actor_identity();
  actor_profile uuid := public.ark_current_profile_id();
  actor_role text := public.ark_current_user_role();
  req public.fund_requests%rowtype;
  key_value text := 'rr-fund:'||p_repair_job_id::text;
begin
  if actor_role not in (
    'system_admin','repair_head','rr_hod','repair_hod','head_of_rr',
    'repair_technician','rr_technician','rr_tech'
  ) then raise exception 'RR authorization required' using errcode='42501'; end if;
  if p_amount is null or round(p_amount,2)<=0 or p_amount>100000000 then raise exception 'Enter a valid repair-fund amount'; end if;
  if length(trim(coalesce(p_purpose,'')))<3 then raise exception 'Repair-fund purpose is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(key_value,0));
  select * into job from public.repair_jobs where id=p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  if actor_role in ('repair_technician','rr_technician','rr_tech')
    and (actor_profile is null or actor_profile::text not in (
      coalesce(job.assigned_rr_technician::text,''),coalesce(job.assigned_to::text,''))) then
    raise exception 'This repair job is assigned to another technician' using errcode='42501';
  end if;
  select * into req from public.fund_requests where request_key=key_value
    and lower(coalesce(status,'')) not in ('rejected','cancelled','completed','paid','disbursed')
    order by created_at desc limit 1 for update;
  if found then return to_jsonb(req)||jsonb_build_object('created',false); end if;
  insert into public.fund_requests(
    request_category,request_type,request_subtype,amount,purpose,notes,
    requested_by,requested_by_email,requested_by_name,department,role,source_module,
    status,finance_status,hr_status,agm_status,operations_status,rr_hod_status,
    repair_job_id,request_key,created_at,updated_at
  ) values(
    'fund','Repair Fund','Repair Fund',round(p_amount,2),left(trim(p_purpose),1000),nullif(left(trim(p_notes),2000),''),
    auth.uid(),actor->>'email',actor->>'name','Repair & Refurbishment',actor_role,'Repair & Refurbishment',
    'pending_rr_hod','not_ready','not_required','not_required','not_required','pending',
    job.id,key_value,now(),now()
  ) returning * into req;
  update public.repair_jobs set status='awaiting_fund',updated_at=now() where id=job.id;
  return to_jsonb(req)||jsonb_build_object('created',true);
end;
$$;

create or replace function public.rr_transition_fund_request(
  p_request_id uuid, p_action text, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req public.fund_requests%rowtype;
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  action_name text := lower(trim(p_action));
begin
  if actor_role not in ('system_admin','repair_head','rr_hod','repair_hod','head_of_rr') then
    raise exception 'RR HOD authorization required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rr-fund:'||p_request_id::text,0));
  select * into req from public.fund_requests where id=p_request_id for update;
  if not found or req.repair_job_id is null then raise exception 'RR fund request was not found'; end if;
  if lower(coalesce(req.rr_hod_status,'')) <> 'pending' then raise exception 'Request is not awaiting RR HOD'; end if;
  if action_name='hod_approve' then
    update public.fund_requests set rr_hod_status='approved',rr_hod_approved_by=actor_email,
      rr_hod_approved_at=now(),rr_hod_note=nullif(left(trim(p_note),2000),''),
      status='pending_hr_approval',finance_status='pending_approval',
      hr_status='pending',agm_status='pending',operations_status='pending',updated_at=now()
    where id=p_request_id;
  elsif action_name='hod_reject' then
    update public.fund_requests set rr_hod_status='rejected',rr_hod_note=coalesce(nullif(left(trim(p_note),2000),''),'Rejected by RR HOD'),
      status='rejected',finance_status='rejected',updated_at=now() where id=p_request_id;
    update public.repair_jobs set status='refurbishing',updated_at=now() where id=req.repair_job_id;
  else raise exception 'Unsupported RR fund action'; end if;
  select * into req from public.fund_requests where id=p_request_id;
  return to_jsonb(req)||jsonb_build_object('action',action_name,'changed',true);
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
    update public.repair_jobs
    set status='refurbishing',updated_at=now()
    where id=new.repair_job_id
      and lower(coalesce(status,''))='awaiting_fund';
  end if;
  return new;
end;
$$;

revoke all on function public.rr_sync_disbursed_fund_to_job() from public,anon,authenticated;
drop trigger if exists rr_fund_disbursement_job_trigger on public.fund_requests;
create trigger rr_fund_disbursement_job_trigger
after update of finance_status on public.fund_requests
for each row execute function public.rr_sync_disbursed_fund_to_job();

revoke all on function public.rr_create_consumable_request_v2(uuid,jsonb,text) from public,anon;
revoke all on function public.rr_transition_consumable_request(uuid,text,text) from public,anon;
revoke all on function public.rr_create_fund_request_v2(uuid,numeric,text,text) from public,anon;
revoke all on function public.rr_transition_fund_request(uuid,text,text) from public,anon;
grant execute on function public.rr_create_consumable_request_v2(uuid,jsonb,text) to authenticated;
grant execute on function public.rr_transition_consumable_request(uuid,text,text) to authenticated;
grant execute on function public.rr_create_fund_request_v2(uuid,numeric,text,text) to authenticated;
grant execute on function public.rr_transition_fund_request(uuid,text,text) to authenticated;
