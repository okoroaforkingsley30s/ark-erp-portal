-- Prevent duplicate active FE part requests and keep dispatched requests in
-- sync with the ticket so the assigned engineer can acknowledge receipt.

create or replace function public.ark_prevent_duplicate_active_part_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(new.ticket_id::text), '') is null then
    return new;
  end if;

  if exists (
    select 1
    from public.part_requests existing
    where existing.ticket_id::text = new.ticket_id::text
      and existing.id is distinct from new.id
      and lower(coalesce(existing.operations_status, '')) not in ('rejected', 'cancelled')
      and lower(coalesce(existing.inventory_status, '')) not in ('rejected', 'cancelled')
      and lower(coalesce(existing.dispatch_status, 'pending')) not in (
        'received', 'received_by_engineer', 'rejected', 'cancelled', 'closed', 'completed'
      )
  ) then
    raise exception 'This ticket already has an active part request. Track the existing request instead.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists ark_prevent_duplicate_active_part_request on public.part_requests;
create trigger ark_prevent_duplicate_active_part_request
before insert on public.part_requests
for each row execute function public.ark_prevent_duplicate_active_part_request();

create or replace function public.ark_sync_part_dispatch_to_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.dispatch_status, '')) = 'dispatched'
    and nullif(trim(new.ticket_id::text), '') is not null then
    update public.tickets
    set linked_part_request_id = new.id,
        part_request_status = 'dispatched',
        updated_at = now()
    where id::text = new.ticket_id::text
      and lower(coalesce(status, '')) not in ('closed', 'completed');
  end if;
  return new;
end;
$$;

drop trigger if exists ark_sync_part_dispatch_to_ticket on public.part_requests;
create trigger ark_sync_part_dispatch_to_ticket
after insert or update of dispatch_status on public.part_requests
for each row execute function public.ark_sync_part_dispatch_to_ticket();

-- Align open tickets whose request was dispatched before this repair.
update public.tickets ticket
set linked_part_request_id = request.id,
    part_request_status = 'dispatched',
    updated_at = now()
from public.part_requests request
where request.ticket_id::text = ticket.id::text
  and lower(coalesce(request.dispatch_status, '')) = 'dispatched'
  and lower(coalesce(ticket.status, '')) not in ('closed', 'completed');

revoke all on function public.ark_prevent_duplicate_active_part_request() from public, anon;
revoke all on function public.ark_sync_part_dispatch_to_ticket() from public, anon;
