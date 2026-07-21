-- Repair RR physical-unit seeding during a repair_jobs INSERT/UPDATE trigger.
-- The trigger already runs inside the creating transaction; locking the same
-- freshly modified tuple again can fail and roll back Inventory -> RR handoff.

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
  perform pg_advisory_xact_lock(hashtextextended('rr-unit-seed:' || p_repair_job_id::text, 0));
  select * into job from public.repair_jobs where id = p_repair_job_id;
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

revoke all on function public.ark_rr_create_units(uuid) from public, anon, authenticated;
