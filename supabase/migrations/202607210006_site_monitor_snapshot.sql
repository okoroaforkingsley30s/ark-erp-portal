-- Provide the Site Monitor with one synchronized, least-privilege snapshot.
-- This aligns frontend route access with database visibility without exposing
-- complete ticket, device, customer or user records.

create or replace function public.ark_site_monitor_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  allowed_roles constant text[] := array[
    'system_admin', 'ceo', 'agm', 'admin', 'head_of_it', 'it', 'manager',
    'operations', 'helpdesk', 'inventory', 'repair_head',
    'head_of_account', 'finance'
  ]::text[];
  result jsonb;
begin
  if auth.uid() is null or not (actor_role = any(allowed_roles)) then
    raise exception 'Site Monitor authorization required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'banks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bank.id,
        'bank_name', coalesce(bank.bank_name, bank.name),
        'status', bank.status
      ) order by coalesce(bank.bank_name, bank.name))
      from public.banks bank
    ), '[]'::jsonb),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', branch.id,
        'bank_name', branch.bank_name,
        'branch_name', branch.branch_name,
        'location', branch.location,
        'region', branch.region,
        'assigned_engineer', coalesce(branch.assigned_engineer_name, branch.assigned_engineer),
        'status', branch.status,
        'created_at', branch.created_at,
        'updated_at', branch.updated_at
      ) order by branch.bank_name, branch.branch_name)
      from public.branches branch
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', device.id,
        'terminal_id', coalesce(device.terminal_id, device.atm_terminal_id),
        'bank_name', coalesce(device.bank_name, device.client_name),
        'branch_name', coalesce(device.branch_name, device.branch, device.site_name),
        'location', coalesce(device.location, device.branch_location),
        'device_name', coalesce(device.device_name, device.machine_name),
        'device_type', coalesce(device.device_type, device.machine_type),
        'device_model', coalesce(device.device_model, device.model),
        'assigned_engineer', coalesce(device.assigned_engineer_name, device.assigned_engineer_email, device.assigned_engineer),
        'device_status', coalesce(device.device_status, device.status),
        'sla_status', device.sla_status,
        'latitude', device.latitude,
        'longitude', device.longitude,
        'created_at', device.created_at
      ) order by device.created_at desc)
      from public.devices device
    ), '[]'::jsonb),
    'bank_devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', device.id,
        'terminal_id', device.terminal_id,
        'bank_name', device.bank_name,
        'branch_name', device.branch_name,
        'device_type', device.device_type,
        'device_model', device.device_model,
        'assigned_engineer', device.assigned_engineer,
        'device_status', device.device_status,
        'sla_status', device.sla_status,
        'created_at', device.created_at
      ) order by device.created_at desc)
      from public.bank_devices device
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ticket.id,
        'ticket_number', ticket.ticket_number,
        'bank_name', coalesce(ticket.bank_name, ticket.client_name),
        'branch_name', coalesce(ticket.branch_name, ticket.branch, ticket.site_name),
        'status', ticket.status,
        'completion_status', ticket.completion_status,
        'priority', ticket.priority,
        'sla_level', ticket.sla_level,
        'sla_status', ticket.sla_status,
        'created_at', ticket.created_at,
        'updated_at', ticket.updated_at
      ) order by ticket.created_at desc)
      from public.tickets ticket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.ark_site_monitor_snapshot() from public, anon;
grant execute on function public.ark_site_monitor_snapshot() to authenticated;

comment on function public.ark_site_monitor_snapshot() is
  'Least-privilege synchronized bank, branch, device and incident snapshot for Site Monitor.';
