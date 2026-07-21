-- Inventory acceptance of QA-passed RR returns, including direct/offline arrivals.

alter table public.repair_jobs
  add column if not exists inventory_stock_item_id uuid references public.spare_parts(id),
  add column if not exists inventory_received_at timestamptz,
  add column if not exists inventory_received_by text,
  add column if not exists stock_intake_status text not null default 'not_received';

create table if not exists public.rr_stock_intake_receipts (
  id uuid primary key default gen_random_uuid(),
  repair_job_id uuid not null references public.repair_jobs(id),
  stock_item_id uuid not null references public.spare_parts(id),
  quantity_received integer not null check (quantity_received > 0),
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity integer not null check (new_quantity >= quantity_received),
  warehouse text not null,
  storage_location text,
  stock_condition text not null default 'refurbished'
    check (stock_condition in ('new','repaired','refurbished','recovered')),
  unit_cost_ngn numeric not null default 0 check (unit_cost_ngn >= 0),
  serial_numbers jsonb not null default '[]'::jsonb,
  source_type text,
  source_reference text,
  notes text,
  received_by text not null,
  received_at timestamptz not null default now(),
  unique (repair_job_id)
);

create index if not exists rr_stock_intake_stock_item_idx
  on public.rr_stock_intake_receipts(stock_item_id, received_at desc);

alter table public.rr_stock_intake_receipts enable row level security;
drop policy if exists ark_rr_stock_intake_select on public.rr_stock_intake_receipts;
create policy ark_rr_stock_intake_select on public.rr_stock_intake_receipts
for select to authenticated using (
  public.ark_has_any_role(array[
    'system_admin','ceo','agm','manager','operations','inventory',
    'inventory_head','inventory_manager','repair_head','rr_hod','repair_hod','head_of_rr','finance'
  ]::text[])
);

create or replace function public.inventory_receive_rr_return(
  p_repair_job_id uuid,
  p_stock_item_id uuid default null,
  p_part_name text default null,
  p_part_number text default null,
  p_category text default null,
  p_warehouse text default 'Oshodi',
  p_storage_location text default null,
  p_unit_cost_ngn numeric default 0,
  p_stock_condition text default 'refurbished',
  p_tracking_type text default 'quantity',
  p_serial_numbers jsonb default '[]'::jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  job public.repair_jobs%rowtype;
  stock public.spare_parts%rowtype;
  receipt public.rr_stock_intake_receipts%rowtype;
  receive_qty integer;
  old_qty integer;
  new_qty integer;
  serial_value text;
  serial_count integer;
  clean_tracking text := lower(trim(coalesce(p_tracking_type, 'quantity')));
  clean_condition text := lower(trim(coalesce(p_stock_condition, 'refurbished')));
  clean_warehouse text := coalesce(nullif(trim(p_warehouse), ''), 'Oshodi');
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if actor_role not in ('system_admin','inventory','inventory_head','inventory_manager') then
    raise exception 'Inventory authorization required' using errcode='42501';
  end if;
  if clean_tracking not in ('quantity','serial') then raise exception 'Tracking type must be quantity or serial'; end if;
  if clean_condition not in ('new','repaired','refurbished','recovered') then raise exception 'Invalid stock condition'; end if;
  if coalesce(p_unit_cost_ngn,0) < 0 then raise exception 'Unit cost cannot be negative'; end if;

  perform pg_advisory_xact_lock(hashtextextended('rr-stock-intake:'||p_repair_job_id::text,0));
  select * into job from public.repair_jobs where id=p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;

  if lower(coalesce(job.status,'')) not in ('sent_to_inventory','returned_inventory')
    or lower(coalesce(job.test_result,'')) <> 'passed'
    or lower(coalesce(job.inventory_transfer_status,'')) <> 'transferred' then
    raise exception 'Only a QA-passed RR return can be received into stock';
  end if;
  if lower(coalesce(job.stock_intake_status,'not_received')) = 'received'
    or exists(select 1 from public.rr_stock_intake_receipts r where r.repair_job_id=job.id) then
    raise exception 'This RR return has already been received into stock' using errcode='23505';
  end if;

  receive_qty := coalesce(job.good_quantity,0);
  if receive_qty <= 0 then raise exception 'RR did not record any passed quantity for stock intake'; end if;

  if p_stock_item_id is not null then
    select * into stock from public.spare_parts where id=p_stock_item_id for update;
    if not found then raise exception 'Selected stock master was not found'; end if;
  elsif nullif(trim(coalesce(p_part_number,job.part_number,'')),'') is not null then
    select * into stock from public.spare_parts
    where lower(part_number)=lower(trim(coalesce(nullif(p_part_number,''),job.part_number)))
    order by created_at asc limit 1 for update;
  end if;

  if stock.id is null then
    if nullif(trim(coalesce(p_part_name,job.item_name,job.device_name,'')),'') is null then
      raise exception 'Part name is required to create the stock master';
    end if;
    insert into public.spare_parts(
      part_name,part_number,category,quantity,quantity_available,location,
      storage_location,warehouse,status,stock_status,unit_price_ngn,
      total_stock_value,tracking_type,serial_tracking,description,notes,created_at,updated_at
    ) values(
      trim(coalesce(nullif(p_part_name,''),job.item_name,job.device_name)),
      nullif(trim(coalesce(nullif(p_part_number,''),job.part_number)),''),
      nullif(trim(p_category),''),0,0,nullif(trim(p_storage_location),''),
      nullif(trim(p_storage_location),''),clean_warehouse,'available','OUT OF STOCK',
      coalesce(p_unit_cost_ngn,0),0,clean_tracking,(clean_tracking='serial'),
      'Created from QA-passed RR return '||coalesce(job.job_number,job.id::text),p_notes,now(),now()
    ) returning * into stock;
  end if;

  serial_count := case when jsonb_typeof(coalesce(p_serial_numbers,'[]'::jsonb))='array'
    then jsonb_array_length(coalesce(p_serial_numbers,'[]'::jsonb)) else 0 end;
  if lower(coalesce(stock.tracking_type,clean_tracking))='serial' and serial_count <> receive_qty then
    raise exception 'Exactly % unique serial number(s) are required for this stock item',receive_qty;
  end if;

  old_qty := coalesce(stock.quantity_available,stock.quantity,0);
  new_qty := old_qty+receive_qty;
  update public.spare_parts set
    quantity=new_qty,quantity_available=new_qty,status='available',
    stock_status=case when new_qty <= coalesce(minimum_stock_level,0) then 'LOW STOCK' else 'IN STOCK' end,
    warehouse=clean_warehouse,
    storage_location=coalesce(nullif(trim(p_storage_location),''),storage_location),
    location=coalesce(nullif(trim(p_storage_location),''),location),
    unit_price_ngn=case when coalesce(p_unit_cost_ngn,0)>0 then p_unit_cost_ngn else unit_price_ngn end,
    total_stock_value=new_qty*case when coalesce(p_unit_cost_ngn,0)>0 then p_unit_cost_ngn else coalesce(unit_price_ngn,0) end,
    updated_at=now()
  where id=stock.id;

  if serial_count > 0 then
    for serial_value in select trim(value #>> '{}') from jsonb_array_elements(coalesce(p_serial_numbers,'[]'::jsonb)) loop
      if nullif(serial_value,'') is null then raise exception 'Serial numbers cannot be blank'; end if;
      insert into public.spare_part_serials(
        spare_part_id,part_number,serial_number,warehouse,condition,status,notes,created_at,updated_at
      ) values(
        stock.id,coalesce(stock.part_number,job.part_number),serial_value,clean_warehouse,
        clean_condition,'in_stock','Received from RR job '||coalesce(job.job_number,job.id::text),now(),now()
      );
    end loop;
  end if;

  insert into public.inventory_movements(
    item_id,part_number,item_description,warehouse,movement_type,
    quantity_changed,previous_quantity,new_quantity,reason,
    performed_by_email,performed_by_name,created_at
  ) values(
    stock.id,coalesce(stock.part_number,job.part_number),coalesce(stock.description,stock.part_name,job.item_name),
    clean_warehouse,'rr_return_stock_in',receive_qty,old_qty,new_qty,
    'QA-passed RR return '||coalesce(job.job_number,job.id::text),
    actor_email,public.inventory_actor_name(),now()
  );

  insert into public.rr_stock_intake_receipts(
    repair_job_id,stock_item_id,quantity_received,previous_quantity,new_quantity,
    warehouse,storage_location,stock_condition,unit_cost_ngn,serial_numbers,
    source_type,source_reference,notes,received_by,received_at
  ) values(
    job.id,stock.id,receive_qty,old_qty,new_qty,clean_warehouse,nullif(trim(p_storage_location),''),
    clean_condition,coalesce(p_unit_cost_ngn,0),coalesce(p_serial_numbers,'[]'::jsonb),
    job.source_type,coalesce(job.part_request_id::text,job.ticket_id,job.job_number),p_notes,actor_email,now()
  ) returning * into receipt;

  perform set_config('ark.rr_workflow_rpc','on',true);
  update public.repair_jobs set
    inventory_stock_item_id=stock.id,inventory_received_at=now(),inventory_received_by=actor_email,
    stock_intake_status='received',status='inventory_received',completed_at=coalesce(completed_at,now()),
    final_remark='Inventory received '||receive_qty||' QA-passed unit(s) into stock',updated_at=now()
  where id=job.id;

  insert into public.operations_events(event_type,title,description,source_module,entity_type,entity_id,severity)
  values('RR_RETURN_STOCK_IN','RR return received into stock',
    coalesce(job.job_number,job.id::text)||': '||receive_qty||' unit(s) received into Inventory',
    'Inventory','repair_job',job.id,'info');

  perform public.ark_emit_workflow_notification(
    'repair_job',job.id::text,'stock_received','inventory_received','RR return received into stock',
    coalesce(job.job_number,job.id::text)||' was received into Inventory stock.',
    '/inventory-requests',array[]::text[],
    array['repair_head','rr_hod','repair_hod','head_of_rr']::text[],false,
    jsonb_build_object('repair_job_id',job.id,'stock_item_id',stock.id,'quantity',receive_qty)
  );

  return jsonb_build_object('receipt_id',receipt.id,'repair_job_id',job.id,'stock_item_id',stock.id,
    'quantity_received',receive_qty,'previous_quantity',old_qty,'new_quantity',new_qty,'created',true);
end;
$$;

revoke all on function public.inventory_receive_rr_return(
  uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,text
) from public,anon;
grant execute on function public.inventory_receive_rr_return(
  uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,text
) to authenticated;

revoke insert,update,delete on public.rr_stock_intake_receipts from authenticated;
grant select on public.rr_stock_intake_receipts to authenticated;
