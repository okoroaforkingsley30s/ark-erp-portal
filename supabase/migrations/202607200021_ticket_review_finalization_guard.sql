-- Permit the transactional completion-review RPC to perform its deliberate
-- approved -> closed finalization without weakening the global closed-ticket
-- workflow lock. Repeated approval calls are idempotent.

create or replace function public.ark_lock_final_ticket_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  authorized_reviewer boolean := actor_role in (
    'system_admin', 'admin', 'admin_head', 'manager', 'helpdesk',
    'operations', 'operations_manager'
  );
  legacy_reopen boolean;
  review_finalization boolean;
begin
  legacy_reopen :=
    lower(trim(coalesce(old.status, ''))) in ('approved', 'closed', 'completed')
    and lower(trim(coalesce(old.completion_status, ''))) = 'pending'
    and lower(trim(coalesce(new.status, ''))) = 'pending_review'
    and new.completion_status is not distinct from old.completion_status
    and authorized_reviewer;

  review_finalization :=
    coalesce(current_setting('ark.ticket_review_finalize', true), '') = 'on'
    and lower(trim(coalesce(old.status, ''))) = 'approved'
    and lower(trim(coalesce(old.completion_status, ''))) = 'approved'
    and lower(trim(coalesce(new.status, ''))) = 'closed'
    and lower(trim(coalesce(new.completion_status, ''))) = 'approved'
    and new.linked_part_request_id is not distinct from old.linked_part_request_id
    and new.part_request_type is not distinct from old.part_request_type
    and new.part_request_reason is not distinct from old.part_request_reason
    and new.part_request_note is not distinct from old.part_request_note
    and new.part_request_status is not distinct from old.part_request_status
    and authorized_reviewer;

  if public.ark_ticket_status_is_final(old.status, old.completion_status)
    and not legacy_reopen
    and not review_finalization
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
  current_status text;
  current_completion text;
begin
  if auth.uid() is null or actor_role not in (
    'system_admin', 'admin', 'admin_head', 'manager', 'helpdesk',
    'operations', 'operations_manager'
  ) then
    raise exception 'Ticket review authorization required' using errcode = '42501';
  end if;

  if decision_name not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  current_status := lower(trim(coalesce(ticket_row.status, '')));
  current_completion := lower(trim(coalesce(ticket_row.completion_status, '')));

  -- A repeated approval must not create another event or notification.
  if current_status in ('approved', 'closed', 'completed', 'resolved')
    and current_completion in ('approved', 'closed', 'completed', 'resolved') then
    if decision_name <> 'approve' then
      raise exception 'An approved or closed ticket cannot be rejected' using errcode = '22023';
    end if;

    if current_status = 'approved' then
      perform set_config('ark.ticket_review_finalize', 'on', true);
      update public.tickets
      set status = 'closed',
          escalated = false,
          closed_date = coalesce(closed_date, now()),
          last_action_at = now(),
          updated_at = now()
      where id = p_ticket_id;
    end if;

    return jsonb_build_object(
      'ticket_id', p_ticket_id,
      'status', case when current_status = 'approved' then 'closed' else current_status end,
      'completion_status', current_completion,
      'decision', 'approve',
      'changed', current_status = 'approved',
      'already_final', true,
      'notification_ids', '[]'::jsonb
    );
  end if;

  legacy_inconsistent :=
    current_status in ('closed', 'approved', 'completed')
    and current_completion = 'pending';

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
    perform set_config('ark.ticket_review_finalize', 'on', true);

    update public.tickets
    set status = 'closed',
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
    'changed', true,
    'already_final', false,
    'legacy_inconsistent_repaired', legacy_inconsistent,
    'escalation_cleared', decision_name = 'approve'
  );
end;
$$;

revoke all on function public.ark_review_ticket_completion_v2(uuid,text,text)
  from public, anon;
grant execute on function public.ark_review_ticket_completion_v2(uuid,text,text)
  to authenticated;
