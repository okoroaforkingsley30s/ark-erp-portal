-- Final ticket closure is immutable for Field Engineers on every write path.
-- The UI also hides actions, but this trigger is the authoritative protection
-- against stale tabs, old application builds, retries and direct REST writes.

create or replace function public.ark_block_fe_final_ticket_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.ark_current_user_role() = 'engineer'
    and public.ark_ticket_status_is_final(old.status, old.completion_status) then
    raise exception 'This ticket is completely closed and cannot accept further Field Engineer actions'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists ark_block_fe_final_ticket_mutation_trigger
  on public.tickets;

create trigger ark_block_fe_final_ticket_mutation_trigger
before update on public.tickets
for each row execute function public.ark_block_fe_final_ticket_mutation();

create or replace function public.ark_fe_transition_ticket_v2(
  p_ticket_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ticket_row public.tickets%rowtype;
begin
  if auth.uid() is null or public.ark_current_user_role() <> 'engineer' then
    raise exception 'Field Engineer authorization required' using errcode = '42501';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  if public.ark_ticket_status_is_final(ticket_row.status, ticket_row.completion_status) then
    raise exception 'This ticket is completely closed and cannot accept further Field Engineer actions'
      using errcode = '22023';
  end if;

  return public.ark_fe_transition_ticket(p_ticket_id, p_action, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public.ark_fe_transition_ticket(uuid,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.ark_block_fe_final_ticket_mutation()
  from public, anon, authenticated;

grant execute on function public.ark_fe_transition_ticket_v2(uuid,text,jsonb)
  to authenticated;

-- The ARK asset register is distinct from customer Machines/Devices. Preserve
-- finance write controls while allowing roles that have the Assets module to
-- read this one register through RLS.
create or replace function public.ark_asset_registry_can_read()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.ark_current_user_role() in (
    'system_admin', 'ceo', 'agm', 'head_of_it', 'it', 'manager',
    'helpdesk', 'engineer', 'inventory', 'finance', 'finance_manager',
    'head_of_account', 'account', 'accounts', 'accountant'
  );
$$;

drop policy if exists finance_role_select on public.finance_fixed_assets;
drop policy if exists ark_asset_registry_select on public.finance_fixed_assets;
create policy ark_asset_registry_select
on public.finance_fixed_assets
for select to authenticated
using (public.ark_asset_registry_can_read());

revoke all on function public.ark_asset_registry_can_read()
  from public, anon;
grant execute on function public.ark_asset_registry_can_read()
  to authenticated;
