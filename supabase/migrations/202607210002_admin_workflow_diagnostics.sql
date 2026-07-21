-- Read-only, system-administrator workflow and asset diagnostics.

create or replace function public.ark_admin_diagnose(p_search text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  q text := trim(coalesce(p_search,''));
  pattern text;
  result jsonb;
begin
  if auth.uid() is null or public.ark_current_user_role() <> 'system_admin' then
    raise exception 'System Administrator authorization required' using errcode='42501';
  end if;
  if length(q) < 3 then raise exception 'Enter at least 3 characters'; end if;
  pattern := '%'||q||'%';

  with matched_tickets as (
    select t.* from public.tickets t
    where t.id::text ilike pattern or coalesce(t.ticket_number,'') ilike pattern
      or coalesce(t.title,'') ilike pattern or coalesce(t.terminal_id,'') ilike pattern
    order by t.updated_at desc nulls last limit 25
  ), matched_parts as (
    select pr.* from public.part_requests pr
    where pr.id::text ilike pattern or coalesce(pr.ticket_number,'') ilike pattern
      or coalesce(to_jsonb(pr)->>'part_number','') ilike pattern or coalesce(pr.part_name,'') ilike pattern
      or pr.ticket_id in (select id from matched_tickets)
    order by pr.updated_at desc nulls last limit 50
  ), matched_jobs as (
    select rj.* from public.repair_jobs rj
    where rj.id::text ilike pattern or coalesce(rj.job_number,'') ilike pattern
      or coalesce(rj.ticket_id,'') ilike pattern or coalesce(rj.part_number,'') ilike pattern
      or rj.part_request_id in (select id from matched_parts)
    order by rj.updated_at desc nulls last limit 50
  ), matched_consumables as (
    select rc.* from public.rr_consumable_requests rc
    where rc.id::text ilike pattern or coalesce(rc.job_number,'') ilike pattern
      or rc.repair_job_id in (select id from matched_jobs)
    order by rc.updated_at desc nulls last limit 50
  ), matched_funds as (
    select fr.* from public.fund_requests fr
    where fr.id::text ilike pattern or coalesce(fr.purpose,'') ilike pattern
      or coalesce(fr.notes,'') ilike pattern or coalesce(fr.requested_by_email,'') ilike pattern
      or coalesce(to_jsonb(fr)->>'repair_job_id','') in (select id::text from matched_jobs)
    order by fr.updated_at desc nulls last limit 50
  ), matched_movements as (
    select im.* from public.inventory_movements im
    where im.id::text ilike pattern or coalesce(im.part_number,'') ilike pattern
      or coalesce(im.reason,'') ilike pattern or coalesce(im.item_description,'') ilike pattern
      or im.item_id in (select inventory_stock_item_id from matched_jobs where inventory_stock_item_id is not null)
    order by im.created_at desc nulls last limit 100
  ), matched_assets as (
    select fa.* from public.finance_fixed_assets fa
    where fa.id::text ilike pattern or coalesce(fa.asset_code,'') ilike pattern
      or coalesce(fa.asset_name,'') ilike pattern or coalesce(fa.serial_number,'') ilike pattern
      or coalesce(fa.assigned_employee_name,'') ilike pattern
      or coalesce(fa.assigned_department,'') ilike pattern or coalesce(fa.current_location,'') ilike pattern
    order by fa.updated_at desc nulls last limit 50
  ), matched_machines as (
    select d.* from public.devices d
    where d.id::text ilike pattern or coalesce(d.terminal_id,d.atm_terminal_id,'') ilike pattern
      or coalesce(d.serial_number,'') ilike pattern or coalesce(d.device_name,d.machine_name,'') ilike pattern
      or coalesce(d.bank_name,'') ilike pattern or coalesce(d.branch_name,d.branch,'') ilike pattern
    order by d.updated_at desc nulls last limit 50
  ), matched_events as (
    select oe.* from public.operations_events oe
    where oe.entity_id ilike pattern or coalesce(oe.title,'') ilike pattern
      or coalesce(oe.description,'') ilike pattern
      or oe.entity_id in (select id::text from matched_tickets)
      or oe.entity_id in (select id::text from matched_parts)
      or oe.entity_id in (select id::text from matched_jobs)
    order by oe.created_at desc nulls last limit 100
  ), matched_asset_audit as (
    select fal.* from public.finance_audit_logs fal
    where (fal.entity_table='finance_fixed_assets' and fal.entity_id in (select id::text from matched_assets))
      or fal.entity_id ilike pattern or fal.previous_value::text ilike pattern or fal.new_value::text ilike pattern
    order by fal.created_at desc nulls last limit 100
  ), matched_lifecycle as (
    select pll.* from public.part_lifecycle_logs pll
    where pll.id::text ilike pattern or coalesce(pll.part_number,'') ilike pattern
      or pll.ticket_id in (select id from matched_tickets)
      or pll.part_request_id in (select id from matched_parts)
      or pll.repair_job_id in (select id from matched_jobs)
    order by pll.created_at desc nulls last limit 100
  ), matched_notifications as (
    select n.id,n.user_email,n.recipient_email,n.title,n.message,n.type,n.read,n.is_read,
      n.link,n.event_key,n.major_notification,n.email_status,n.created_at,n.data
    from public.notifications n
    where n.id::text ilike pattern or coalesce(n.title,'') ilike pattern
      or coalesce(n.message,'') ilike pattern or coalesce(n.event_key,'') ilike pattern
      or n.data::text ilike pattern
    order by n.created_at desc nulls last limit 100
  ), asset_findings as (
    select jsonb_build_object(
      'severity',case when lower(fa.status) in ('lost','disposed') then 'high' else 'warning' end,
      'entity_type','asset','entity_id',fa.id,'reference',fa.asset_code,
      'message',case
        when lower(fa.status)='assigned' and nullif(trim(coalesce(fa.assigned_employee_name,'')),'') is null
          then 'Asset is marked assigned but has no custodian.'
        when nullif(trim(coalesce(fa.current_location,'')),'') is null then 'Asset has no current location.'
        when fa.warranty_expiry is not null and fa.warranty_expiry < current_date then 'Asset warranty has expired.'
        when lower(fa.status) in ('lost','disposed') then 'Asset requires status/disposal review.'
      end
    ) finding
    from matched_assets fa
    where (lower(fa.status)='assigned' and nullif(trim(coalesce(fa.assigned_employee_name,'')),'') is null)
      or nullif(trim(coalesce(fa.current_location,'')),'') is null
      or (fa.warranty_expiry is not null and fa.warranty_expiry < current_date)
      or lower(fa.status) in ('lost','disposed')
  ), workflow_findings as (
    select jsonb_build_object('severity','high','entity_type','repair_job','entity_id',rj.id,
      'reference',rj.job_number,'message','Active RR job has no assigned technician.') finding
    from matched_jobs rj where lower(coalesce(rj.status,'')) in ('assigned','refurbishing','under_repair','qa_failed')
      and rj.assigned_rr_technician is null and nullif(rj.assigned_to,'') is null
    union all
    select jsonb_build_object('severity','warning','entity_type','repair_job','entity_id',rj.id,
      'reference',rj.job_number,'message','QA-passed RR return is waiting for Inventory stock intake.')
    from matched_jobs rj where lower(coalesce(rj.status,'')) in ('sent_to_inventory','returned_inventory')
      and lower(coalesce(rj.stock_intake_status,'not_received')) <> 'received'
    union all
    select jsonb_build_object('severity','high','entity_type','ticket','entity_id',t.id,
      'reference',t.ticket_number,'message','Ticket status is closed but completion approval is not final.')
    from matched_tickets t where lower(coalesce(t.status,''))='closed'
      and lower(coalesce(t.completion_status,'')) not in ('approved','closed','completed','resolved')
  ), all_findings as (
    select finding from workflow_findings union all select finding from asset_findings
  )
  select jsonb_build_object(
    'search',q,'generated_at',now(),'read_only',true,
    'summary',jsonb_build_object(
      'tickets',(select count(*) from matched_tickets),'part_requests',(select count(*) from matched_parts),
      'repair_jobs',(select count(*) from matched_jobs),'consumable_requests',(select count(*) from matched_consumables),
      'fund_requests',(select count(*) from matched_funds),'inventory_movements',(select count(*) from matched_movements),
      'assets',(select count(*) from matched_assets),'customer_machines',(select count(*) from matched_machines),
      'findings',(select count(*) from all_findings)
    ),
    'findings',coalesce((select jsonb_agg(finding) from all_findings),'[]'::jsonb),
    'tickets',coalesce((select jsonb_agg(to_jsonb(x)) from matched_tickets x),'[]'::jsonb),
    'part_requests',coalesce((select jsonb_agg(to_jsonb(x)) from matched_parts x),'[]'::jsonb),
    'repair_jobs',coalesce((select jsonb_agg(to_jsonb(x)) from matched_jobs x),'[]'::jsonb),
    'consumable_requests',coalesce((select jsonb_agg(to_jsonb(x)) from matched_consumables x),'[]'::jsonb),
    'fund_requests',coalesce((select jsonb_agg(to_jsonb(x)) from matched_funds x),'[]'::jsonb),
    'inventory_movements',coalesce((select jsonb_agg(to_jsonb(x)) from matched_movements x),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(to_jsonb(x)) from matched_assets x),'[]'::jsonb),
    'asset_audit',coalesce((select jsonb_agg(to_jsonb(x)) from matched_asset_audit x),'[]'::jsonb),
    'customer_machines',coalesce((select jsonb_agg(to_jsonb(x)) from matched_machines x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(x)) from matched_events x),'[]'::jsonb),
    'lifecycle',coalesce((select jsonb_agg(to_jsonb(x)) from matched_lifecycle x),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(to_jsonb(x)) from matched_notifications x),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ark_admin_diagnose(text) from public,anon,authenticated;
grant execute on function public.ark_admin_diagnose(text) to authenticated;
