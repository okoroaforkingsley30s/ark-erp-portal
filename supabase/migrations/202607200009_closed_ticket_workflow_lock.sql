-- A final ticket closure locks every FE and linked part workflow mutation.

create or replace function public.ark_ticket_status_is_final(
  p_status text,
  p_completion_status text
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(trim(coalesce(p_status, ''))) in (
    'approved', 'closed', 'completed', 'resolved'
  ) or lower(trim(coalesce(p_completion_status, ''))) in (
    'approved', 'closed', 'completed', 'resolved'
  );
$$;

create or replace function public.ark_lock_final_ticket_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.ark_ticket_status_is_final(old.status, old.completion_status)
    and not (
      lower(trim(coalesce(old.status, ''))) in ('approved', 'closed', 'completed')
      and lower(trim(coalesce(old.completion_status, ''))) = 'pending'
      and lower(trim(coalesce(new.status, ''))) = 'pending_review'
      and new.completion_status is not distinct from old.completion_status
      and public.ark_current_user_role() in (
        'system_admin', 'admin', 'admin_head', 'manager', 'helpdesk',
        'operations', 'operations_manager'
      )
    )
    and (
      new.status is distinct from old.status
      or new.completion_status is distinct from old.completion_status
      or new.linked_part_request_id is distinct from old.linked_part_request_id
      or new.part_request_type is distinct from old.part_request_type
      or new.part_request_reason is distinct from old.part_request_reason
      or new.part_request_note is distinct from old.part_request_note
      or new.part_request_status is distinct from old.part_request_status
    ) then
    raise exception 'Ticket is closed and its workflow cannot be changed'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists ark_lock_final_ticket_workflow_trigger
  on public.tickets;
create trigger ark_lock_final_ticket_workflow_trigger
before update on public.tickets
for each row execute function public.ark_lock_final_ticket_workflow();

create or replace function public.ark_lock_closed_ticket_part_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_ticket public.tickets%rowtype;
begin
  if new.ticket_id is null then
    return new;
  end if;

  select * into linked_ticket
  from public.tickets
  where id = new.ticket_id
  for key share;

  if found and public.ark_ticket_status_is_final(
    linked_ticket.status,
    linked_ticket.completion_status
  ) then
    raise exception 'Ticket is closed and cannot accept part workflow changes'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists ark_lock_closed_ticket_part_request_trigger
  on public.part_requests;
create trigger ark_lock_closed_ticket_part_request_trigger
before insert or update on public.part_requests
for each row execute function public.ark_lock_closed_ticket_part_request();

revoke all on function public.ark_ticket_status_is_final(text, text)
  from public, anon;
revoke all on function public.ark_lock_final_ticket_workflow()
  from public, anon;
revoke all on function public.ark_lock_closed_ticket_part_request()
  from public, anon;
