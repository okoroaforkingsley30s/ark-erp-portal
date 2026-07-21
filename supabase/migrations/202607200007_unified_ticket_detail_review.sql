-- Unify main Tickets and Ticket Detail completion review paths.
-- Also permits an authorized reviewer to finalize legacy rows that were closed
-- by the old direct-status control while completion_status remained pending.

create or replace function public.ark_review_ticket_completion_v2(
  p_ticket_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ticket_row public.tickets%rowtype;
  actor_role text := public.ark_current_user_role();
  decision_name text := lower(trim(coalesce(p_decision, '')));
  result jsonb;
  legacy_inconsistent boolean := false;
begin
  if auth.uid() is null or actor_role not in (
    'system_admin', 'admin', 'admin_head', 'manager', 'helpdesk',
    'operations', 'operations_manager'
  ) then
    raise exception 'Ticket review authorization required' using errcode = '42501';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  legacy_inconsistent :=
    lower(coalesce(ticket_row.status, '')) in ('closed', 'approved')
    and lower(coalesce(ticket_row.completion_status, '')) = 'pending';

  if legacy_inconsistent then
    if decision_name <> 'approve' then
      raise exception 'A legacy closed ticket can only be finalized as approved' using errcode = '22023';
    end if;

    update public.tickets
    set status = 'pending_review', updated_at = now()
    where id = p_ticket_id;
  end if;

  result := public.ark_review_ticket_completion(
    p_ticket_id,
    decision_name,
    p_reason
  );

  if decision_name = 'approve' then
    update public.tickets
    set
      escalated = false,
      last_action_at = now(),
      updated_at = now()
    where id = p_ticket_id;
  end if;

  return result || jsonb_build_object(
    'legacy_inconsistent_repaired', legacy_inconsistent,
    'escalation_cleared', decision_name = 'approve'
  );
end;
$$;

revoke all on function public.ark_review_ticket_completion_v2(uuid, text, text) from public, anon;
grant execute on function public.ark_review_ticket_completion_v2(uuid, text, text) to authenticated;
