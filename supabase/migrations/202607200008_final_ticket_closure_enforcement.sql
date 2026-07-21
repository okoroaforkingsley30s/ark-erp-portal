-- Canonical final closure across Helpdesk review, Ticket Details and FEMobi.

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
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_status text;
  current_completion_status text;
begin
  if auth.uid() is null or actor_role <> 'engineer' then
    raise exception 'Field Engineer authorization required' using errcode = '42501';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  if actor_email = '' or actor_email not in (
    lower(coalesce(ticket_row.assigned_to, '')),
    lower(coalesce(ticket_row.assigned_engineer_email, ''))
  ) then
    raise exception 'Only the assigned engineer may update this ticket'
      using errcode = '42501';
  end if;

  current_status := lower(trim(coalesce(ticket_row.status, '')));
  current_completion_status := lower(trim(coalesce(ticket_row.completion_status, '')));

  if current_status in ('approved', 'closed', 'completed', 'resolved')
    or current_completion_status in ('approved', 'closed', 'completed', 'resolved') then
    raise exception 'Ticket is closed and cannot accept further Field Engineer actions'
      using errcode = '22023';
  end if;

  return public.ark_fe_transition_ticket(p_ticket_id, p_action, p_payload);
end;
$$;

revoke all on function public.ark_fe_transition_ticket_v2(uuid, text, jsonb)
  from public, anon;
grant execute on function public.ark_fe_transition_ticket_v2(uuid, text, jsonb)
  to authenticated;

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
    lower(coalesce(ticket_row.status, '')) in ('closed', 'approved', 'completed')
    and lower(coalesce(ticket_row.completion_status, '')) = 'pending';

  if legacy_inconsistent then
    if decision_name <> 'approve' then
      raise exception 'A legacy closed ticket can only be finalized as approved'
        using errcode = '22023';
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
      status = 'closed',
      completion_status = 'approved',
      escalated = false,
      closed_date = coalesce(closed_date, now()),
      last_action_at = now(),
      updated_at = now()
    where id = p_ticket_id;

    result := result || jsonb_build_object(
      'status', 'closed',
      'completion_status', 'approved'
    );
  end if;

  return result || jsonb_build_object(
    'legacy_inconsistent_repaired', legacy_inconsistent,
    'escalation_cleared', decision_name = 'approve'
  );
end;
$$;

revoke all on function public.ark_review_ticket_completion_v2(uuid, text, text)
  from public, anon;
grant execute on function public.ark_review_ticket_completion_v2(uuid, text, text)
  to authenticated;

-- Reconcile records already approved by the earlier review implementation.
update public.tickets
set
  status = 'closed',
  closed_date = coalesce(closed_date, approved_at, updated_at, now()),
  escalated = false,
  updated_at = now()
where lower(coalesce(completion_status, '')) = 'approved'
  and lower(coalesce(status, '')) in ('approved', 'completed');
