-- Make dashboard ticket totals mutually exclusive. A ticket is final when either
-- its workflow status or completion status is final; it must never remain in an
-- open queue after an approved completion.

create or replace function public.ark_department_dashboard_live_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb := coalesce(public.ark_department_dashboard_summary(), '{}'::jsonb);
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  cards jsonb := coalesce(result -> 'cards', '{}'::jsonb);
  open_count bigint := 0;
  review_count bigint := 0;
  closed_count bigint := 0;
  escalated_count bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if actor_role = 'engineer' then
    select
      count(*) filter (where
        lower(coalesce(t.status, '')) not in ('closed','completed','approved','resolved')
        and lower(coalesce(t.completion_status, '')) not in ('closed','completed','approved','resolved')
      ),
      count(*) filter (where
        lower(coalesce(t.status, '')) in ('pending_review','submitted')
        and lower(coalesce(t.completion_status, '')) not in ('closed','completed','approved','resolved')
      ),
      count(*) filter (where
        lower(coalesce(t.status, '')) in ('closed','completed','approved','resolved')
        or lower(coalesce(t.completion_status, '')) in ('closed','completed','approved','resolved')
      )
    into open_count, review_count, closed_count
    from public.tickets t
    where lower(coalesce(
      nullif(trim(to_jsonb(t) ->> 'assigned_to'), ''),
      nullif(trim(to_jsonb(t) ->> 'assigned_engineer_email'), ''),
      nullif(trim(to_jsonb(t) ->> 'engineer_email'), ''),
      ''
    )) = actor_email;

    cards := cards || jsonb_build_object(
      'assigned_jobs', coalesce(open_count, 0),
      'pending_review', coalesce(review_count, 0),
      'closed_jobs', coalesce(closed_count, 0)
    );
  elsif actor_role = 'helpdesk' then
    select
      count(*) filter (where
        lower(coalesce(status, '')) not in ('closed','completed','approved','resolved')
        and lower(coalesce(completion_status, '')) not in ('closed','completed','approved','resolved')
      ),
      count(*) filter (where
        lower(coalesce(status, '')) in ('pending_review','submitted')
        and lower(coalesce(completion_status, '')) not in ('closed','completed','approved','resolved')
      ),
      count(*) filter (where
        lower(coalesce(status, '')) in ('closed','completed','approved','resolved')
        or lower(coalesce(completion_status, '')) in ('closed','completed','approved','resolved')
      ),
      count(*) filter (where
        coalesce(escalated, false) = true
        and lower(coalesce(status, '')) not in ('closed','completed','approved','resolved')
        and lower(coalesce(completion_status, '')) not in ('closed','completed','approved','resolved')
      )
    into open_count, review_count, closed_count, escalated_count
    from public.tickets;

    cards := cards || jsonb_build_object(
      'open_tickets', coalesce(open_count, 0),
      'pending_review', coalesce(review_count, 0),
      'escalated', coalesce(escalated_count, 0),
      'closed_tickets', coalesce(closed_count, 0)
    );
  elsif actor_role in ('operations','operations_manager','operational_manager','ceo','agm','manager') then
    select count(*) into open_count
    from public.tickets
    where lower(coalesce(status, '')) not in ('closed','completed','approved','resolved')
      and lower(coalesce(completion_status, '')) not in ('closed','completed','approved','resolved');

    if actor_role in ('ceo','agm','manager') then
      cards := cards || jsonb_build_object('open_tickets', coalesce(open_count, 0));
    else
      cards := cards || jsonb_build_object('active_tickets', coalesce(open_count, 0));
    end if;
  end if;

  return result || jsonb_build_object(
    'cards', cards,
    'generated_at', clock_timestamp(),
    'source', 'live_database_v3'
  );
end;
$$;

revoke all on function public.ark_department_dashboard_live_summary() from public, anon;
grant execute on function public.ark_department_dashboard_live_summary() to authenticated;

comment on function public.ark_department_dashboard_live_summary() is
  'Role-scoped live dashboard with mutually exclusive open and final ticket classification.';
