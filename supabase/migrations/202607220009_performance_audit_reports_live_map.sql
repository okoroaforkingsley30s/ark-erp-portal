-- Shared operational truth for RR analytics, HR performance, Administrator
-- audit/reporting and the Live Operations Map. Financial amounts, journals,
-- payroll and other confidential Finance details are deliberately excluded.

alter table public.audit_logs add column if not exists entity_id text;

create or replace function public.ark_capture_operational_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  record_id text := coalesce(row_data ->> 'id', row_data ->> 'ticket_number', row_data ->> 'job_number', 'unknown');
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', row_data ->> 'updated_by', row_data ->> 'created_by', 'system'));
  actor_name text;
  summary text;
begin
  select coalesce(nullif(trim(u.full_name), ''), actor_email)
    into actor_name
  from public.users u
  where lower(u.email) = actor_email
  limit 1;

  summary := jsonb_strip_nulls(jsonb_build_object(
    'operation', lower(tg_op),
    'reference', coalesce(row_data ->> 'ticket_number', row_data ->> 'job_number', row_data ->> 'batch_number'),
    'status', coalesce(row_data ->> 'status', row_data ->> 'completion_status', row_data ->> 'approval_status'),
    'previous_status', coalesce(old_data ->> 'status', old_data ->> 'completion_status', old_data ->> 'approval_status'),
    'department', row_data ->> 'department',
    'title', coalesce(row_data ->> 'title', row_data ->> 'item_name', row_data ->> 'company_name')
  ))::text;

  insert into public.audit_logs(action, entity_type, entity_id, user_email, user_name, details, created_at)
  values (lower(tg_op), tg_table_name, record_id, nullif(actor_email, ''), coalesce(actor_name, actor_email), summary, now());

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.ark_capture_operational_audit() from public, anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tickets', 'repair_jobs', 'part_requests', 'rr_consumable_requests',
    'fund_requests', 'users', 'leads', 'crm_clients',
    'ark_department_import_batches'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists ark_operational_audit_trigger on public.%I', table_name);
      execute format(
        'create trigger ark_operational_audit_trigger after insert or update or delete on public.%I for each row execute function public.ark_capture_operational_audit()',
        table_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.ark_write_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actor_name text;
  audit_id uuid;
begin
  if auth.uid() is null or actor_role not in (
    'system_admin','ceo','agm','manager','admin','admin_head','hr','helpdesk',
    'operations','engineer','inventory','repair_head','repair_technician','finance','procurement','crm','business_developer'
  ) then raise exception 'Audit authorization required' using errcode = '42501'; end if;

  select coalesce(nullif(trim(u.full_name), ''), actor_email) into actor_name
  from public.users u where lower(u.email) = actor_email limit 1;

  insert into public.audit_logs(action, entity_type, entity_id, user_email, user_name, details, created_at)
  values (trim(p_action), trim(p_entity_type), trim(p_entity_id), actor_email,
    coalesce(actor_name, actor_email), coalesce(p_details, '{}'::jsonb)::text, now())
  returning id into audit_id;
  return audit_id;
end;
$$;

revoke all on function public.ark_write_audit_event(text, text, text, jsonb) from public, anon;
grant execute on function public.ark_write_audit_event(text, text, text, jsonb) to authenticated;

create or replace function public.ark_admin_audit_feed(
  p_search text default null,
  p_entity_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.ark_is_system_admin() then
    raise exception 'System administrator authorization required' using errcode = '42501';
  end if;

  with historical as (
    select a.id, coalesce(a.action, 'activity') action,
      coalesce(a.entity_type, 'system') entity_type,
      coalesce(a.entity_id, a.id::text) entity_id,
      a.user_email, a.user_name, coalesce(a.details, 'No details') details,
      a.created_at
    from public.audit_logs a
    union all
    select t.id, 'created', 'tickets', t.id::text,
      t.created_by, coalesce(u.full_name, t.created_by),
      jsonb_strip_nulls(jsonb_build_object('reference', t.ticket_number, 'status', t.status, 'title', t.title))::text,
      t.created_at::timestamptz
    from public.tickets t
    left join public.users u on lower(u.email) = lower(coalesce(t.created_by, ''))
    where not exists (
      select 1 from public.audit_logs a
      where a.entity_type = 'tickets' and a.entity_id = t.id::text and lower(coalesce(a.action, '')) = 'insert'
    )
    union all
    select r.id, 'created', 'repair_jobs', r.id::text,
      coalesce(up.user_email, r.received_by), coalesce(u.full_name, up.user_email, r.received_by),
      jsonb_strip_nulls(jsonb_build_object('reference', r.job_number, 'status', r.status, 'title', coalesce(r.item_name, r.device_name)))::text,
      r.created_at
    from public.repair_jobs r
    left join public.user_profiles up on up.id = r.assigned_rr_technician
      or up.id::text = r.assigned_to
      or lower(up.user_email) = lower(coalesce(r.assigned_to, ''))
    left join public.users u on lower(u.email) = lower(coalesce(up.user_email, r.received_by, ''))
    where not exists (
      select 1 from public.audit_logs a
      where a.entity_type = 'repair_jobs' and a.entity_id = r.id::text and lower(coalesce(a.action, '')) = 'insert'
    )
  ), filtered as (
    select * from historical h
    where (p_from is null or h.created_at >= p_from)
      and (p_to is null or h.created_at < p_to + interval '1 day')
      and (nullif(trim(coalesce(p_entity_type, '')), '') is null or h.entity_type = p_entity_type)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or concat_ws(' ', h.action, h.entity_type, h.entity_id, h.user_email, h.user_name, h.details)
          ilike '%' || trim(p_search) || '%'
      )
    order by h.created_at desc
    limit greatest(1, least(coalesce(p_limit, 500), 1000))
  )
  select jsonb_build_object(
    'generated_at', now(),
    'rows', coalesce(jsonb_agg(to_jsonb(filtered) order by filtered.created_at desc), '[]'::jsonb),
    'count', count(*)
  ) into result
  from filtered;

  return result;
end;
$$;

revoke all on function public.ark_admin_audit_feed(text, text, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.ark_admin_audit_feed(text, text, timestamptz, timestamptz, integer) to authenticated;

create or replace function public.ark_rr_performance_snapshot(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  since_at timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 730)));
  result jsonb;
begin
  if auth.uid() is null or actor_role not in (
    'system_admin','ceo','agm','hr','manager','repair_head','rr_hod','repair_hod','head_of_rr','repair_technician'
  ) then raise exception 'RR performance authorization required' using errcode = '42501'; end if;

  with scoped as (
    select r.*,
      coalesce(up.user_email, r.hod_owner_email, r.received_by, 'Unassigned') owner_email,
      coalesce(u.full_name, up.user_email, r.hod_owner_email, r.received_by, 'Unassigned') owner_name,
      lower(trim(coalesce(r.status, 'received'))) normalized_status
    from public.repair_jobs r
    left join public.user_profiles up on up.id = r.assigned_rr_technician
      or up.id::text = r.assigned_to
      or lower(up.user_email) = lower(coalesce(r.assigned_to, ''))
    left join public.users u on lower(u.email) = lower(coalesce(up.user_email, r.hod_owner_email, r.received_by, ''))
    where r.created_at >= since_at
  ), per_person as (
    select owner_email, owner_name,
      count(*) assigned,
      count(*) filter (where normalized_status in ('sent_to_inventory','scrap','scrapped') or completed_at is not null) completed,
      count(*) filter (where normalized_status not in ('sent_to_inventory','scrap','scrapped')) pending,
      count(*) filter (where normalized_status = 'qa_failed' or lower(coalesce(test_result, '')) = 'failed') rework,
      round(avg(extract(epoch from (coalesce(completed_at, now()) - created_at)) / 3600.0)
        filter (where completed_at is not null), 1) avg_turnaround_hours
    from scoped group by owner_email, owner_name
  ), monthly as (
    select to_char(date_trunc('month', created_at), 'Mon YYYY') period,
      date_trunc('month', created_at) period_date,
      count(*) received,
      count(*) filter (where normalized_status in ('sent_to_inventory','scrap','scrapped') or completed_at is not null) completed
    from scoped group by date_trunc('month', created_at)
  )
  select jsonb_build_object(
    'generated_at', now(), 'days', p_days,
    'summary', jsonb_build_object(
      'total', (select count(*) from scoped),
      'completed', (select count(*) from scoped where normalized_status in ('sent_to_inventory','scrap','scrapped') or completed_at is not null),
      'pending', (select count(*) from scoped where normalized_status not in ('sent_to_inventory','scrap','scrapped')),
      'qa_failed', (select count(*) from scoped where normalized_status = 'qa_failed' or lower(coalesce(test_result, '')) = 'failed'),
      'avg_turnaround_hours', coalesce((select round(avg(extract(epoch from (completed_at - created_at)) / 3600.0), 1) from scoped where completed_at is not null), 0)
    ),
    'people', coalesce((select jsonb_agg(to_jsonb(per_person) order by completed desc, assigned desc) from per_person), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('period', period, 'received', received, 'completed', completed) order by period_date) from monthly), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ark_rr_performance_snapshot(integer) from public, anon;
grant execute on function public.ark_rr_performance_snapshot(integer) to authenticated;

create or replace function public.ark_hr_workflow_performance_snapshot(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  since_at timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 730)));
  result jsonb;
begin
  if auth.uid() is null or actor_role not in ('system_admin','ceo','agm','hr','manager') then
    raise exception 'HR performance authorization required' using errcode = '42501';
  end if;

  with identities as (
    select distinct on (lower(u.email)) lower(u.email) email,
      coalesce(nullif(trim(u.full_name), ''), u.email) full_name,
      coalesce(nullif(trim(u.department), ''), 'Unassigned') department,
      coalesce(u.role, 'staff') role
    from public.users u
    where nullif(trim(u.email), '') is not null and coalesce(u.account_status, 'active') <> 'deleted'
    order by lower(u.email), u.updated_at desc nulls last
  ), work_events as (
    select t.id::text event_id, 'ticket' module,
      lower(coalesce(nullif(t.assigned_engineer_email, ''), nullif(t.assigned_to, ''), t.created_by, '')) email,
      t.created_at::timestamptz created_at,
      coalesce(t.closed_date, t.resolved_date, t.approved_at, t.updated_at) finished_at,
      public.ark_ticket_status_is_final(t.status, t.completion_status) completed,
      lower(coalesce(t.status, '')) like 'rejected%' rework,
      t.sla_deadline < now() and not public.ark_ticket_status_is_final(t.status, t.completion_status) overdue
    from public.tickets t where t.created_at::timestamptz >= since_at
    union all
    select r.id::text, 'repair_job', lower(coalesce(up.user_email, r.hod_owner_email, r.received_by, '')),
      r.created_at, coalesce(r.completed_at, r.updated_at),
      lower(coalesce(r.status, '')) in ('sent_to_inventory','scrap','scrapped') or r.completed_at is not null,
      lower(coalesce(r.status, '')) = 'qa_failed' or lower(coalesce(r.test_result, '')) = 'failed', false
    from public.repair_jobs r
    left join public.user_profiles up on up.id = r.assigned_rr_technician or up.id::text = r.assigned_to or lower(up.user_email) = lower(coalesce(r.assigned_to, ''))
    where r.created_at >= since_at
    union all
    select p.id::text, 'part_request', lower(coalesce(p.engineer_email, '')), p.created_at, p.updated_at,
      lower(coalesce(p.status, p.lifecycle_status, '')) in ('received_by_engineer','completed','closed','dispatched'),
      lower(concat_ws(' ', p.status, p.operations_status, p.inventory_status)) like '%reject%', false
    from public.part_requests p where p.created_at >= since_at
    union all
    select f.id::text, 'staff_request', lower(coalesce(f.requested_by_email, '')), f.created_at, coalesce(f.disbursed_at, f.updated_at),
      lower(coalesce(f.status, '')) in ('completed','approved','disbursed','closed'),
      lower(concat_ws(' ', f.status, f.hr_status, f.agm_status, f.operations_status, f.finance_status)) like '%reject%', false
    from public.fund_requests f where f.created_at >= since_at
    union all
    select l.id::text, 'business_development', lower(coalesce(l.owner_email, '')), l.created_at::timestamptz, l.updated_at,
      lower(coalesce(l.status, '')) in ('won','lost','closed'),
      lower(coalesce(l.won_approval_status, '')) = 'rejected', false
    from public.leads l where l.created_at::timestamptz >= since_at
  ), workflow_metrics as (
    select i.email,
      count(e.event_id) assigned,
      count(e.event_id) filter (where e.completed) completed,
      count(e.event_id) filter (where not e.completed) pending,
      count(e.event_id) filter (where e.rework) rework,
      count(e.event_id) filter (where e.overdue) overdue,
      round(avg(extract(epoch from (e.finished_at - e.created_at)) / 3600.0) filter (where e.completed and e.finished_at is not null), 1) avg_hours
    from identities i left join work_events e on e.email = i.email
    group by i.email
  ), activity as (
    select lower(coalesce(a.user_email, '')) email, count(*) activity_count
    from public.audit_logs a where a.created_at >= since_at group by lower(coalesce(a.user_email, ''))
  ), people as (
    select i.full_name, i.email, i.department, i.role,
      coalesce(wm.assigned, 0) assigned,
      coalesce(wm.completed, 0) completed,
      coalesce(wm.pending, 0) pending,
      coalesce(wm.rework, 0) rework,
      coalesce(wm.overdue, 0) overdue,
      coalesce(wm.avg_hours, 0) avg_turnaround_hours,
      coalesce(a.activity_count, 0) activity_count,
      case when coalesce(wm.assigned, 0) = 0 then 0
        else round((coalesce(wm.completed, 0)::numeric / wm.assigned::numeric) * 100, 1) end completion_rate
    from identities i
    left join workflow_metrics wm on wm.email = i.email
    left join activity a on a.email = i.email
  ), departments as (
    select department, count(*) staff_count, sum(assigned) assigned, sum(completed) completed,
      sum(pending) pending, sum(rework) rework, sum(overdue) overdue, sum(activity_count) activity_count,
      case when sum(assigned) = 0 then 0 else round((sum(completed)::numeric / sum(assigned)::numeric) * 100, 1) end completion_rate
    from people group by department
  )
  select jsonb_build_object(
    'generated_at', now(), 'days', p_days,
    'people', coalesce((select jsonb_agg(to_jsonb(people) order by department, full_name) from people), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(to_jsonb(departments) order by department) from departments), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ark_hr_workflow_performance_snapshot(integer) from public, anon;
grant execute on function public.ark_hr_workflow_performance_snapshot(integer) to authenticated;

create or replace function public.ark_system_operational_report(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  since_at timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 730)));
  result jsonb;
begin
  if auth.uid() is null or not public.ark_is_system_admin() then
    raise exception 'System administrator authorization required' using errcode = '42501';
  end if;

  with ticket_rows as (
    select * from public.tickets where created_at::timestamptz >= since_at
  ), trend as (
    select date_trunc('day', created_at::timestamptz)::date day,
      count(*) created,
      count(*) filter (where public.ark_ticket_status_is_final(status, completion_status)) closed
    from ticket_rows group by date_trunc('day', created_at::timestamptz)::date
  ), departments as (
    select coalesce(nullif(trim(department), ''), 'Unassigned') department, count(*) users
    from public.users where coalesce(account_status, 'active') <> 'deleted' group by coalesce(nullif(trim(department), ''), 'Unassigned')
  )
  select jsonb_build_object(
    'generated_at', now(), 'days', p_days,
    'summary', jsonb_build_object(
      'tickets', (select count(*) from ticket_rows),
      'open_tickets', (select count(*) from ticket_rows where not public.ark_ticket_status_is_final(status, completion_status)),
      'closed_tickets', (select count(*) from ticket_rows where public.ark_ticket_status_is_final(status, completion_status)),
      'escalations', (select count(*) from ticket_rows where coalesce(escalated, false)),
      'repair_jobs', (select count(*) from public.repair_jobs where created_at >= since_at),
      'active_users', (select count(*) from public.users where coalesce(account_status, 'active') = 'active'),
      'devices', (select count(*) from public.devices),
      'branches', (select count(*) from public.branches),
      'audit_events', (select count(*) from public.audit_logs where created_at >= since_at)
    ),
    'ticket_trend', coalesce((select jsonb_agg(to_jsonb(trend) order by day) from trend), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(to_jsonb(departments) order by department) from departments), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ark_system_operational_report(integer) from public, anon;
grant execute on function public.ark_system_operational_report(integer) to authenticated;

create or replace function public.ark_live_operations_map_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  result jsonb;
begin
  if auth.uid() is null or actor_role not in (
    'system_admin','ceo','agm','admin','head_of_it','it','manager','operations','helpdesk','inventory','repair_head','engineer'
  ) then raise exception 'Live Operations Map authorization required' using errcode = '42501'; end if;

  select jsonb_build_object(
    'generated_at', now(),
    'engineers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'engineer_email', e.engineer_email, 'engineer_name', e.engineer_name,
      'staff_id', e.staff_id, 'department', e.department, 'phone', e.phone,
      'status', e.status, 'current_latitude', e.current_latitude,
      'current_longitude', e.current_longitude, 'current_site_name', e.current_site_name,
      'current_ticket_id', e.current_ticket_id, 'last_active', e.last_active
    ) order by e.last_active desc nulls last) from public.engineer_statuses e), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email, 'full_name', u.full_name, 'role', u.role,
      'department', u.department, 'phone', u.phone, 'status', coalesce(u.field_status, u.availability_status),
      'latitude', u.latitude, 'longitude', u.longitude, 'last_active', u.last_location_update
    )) from public.users u where lower(coalesce(u.role, '')) like '%engineer%' or lower(coalesce(u.department, '')) like '%field%'), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.devices d), '[]'::jsonb),
    'bank_devices', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.bank_devices d), '[]'::jsonb),
    'branches', coalesce((select jsonb_agg(to_jsonb(b) order by b.bank_name, b.branch_name) from public.branches b), '[]'::jsonb),
    'sites', coalesce((select jsonb_agg(to_jsonb(s) order by s.site_name) from public.sites s), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'ticket_number', t.ticket_number, 'status', t.status,
      'completion_status', t.completion_status, 'priority', t.priority,
      'assigned_to', t.assigned_to, 'assigned_to_name', t.assigned_to_name,
      'assigned_engineer_email', t.assigned_engineer_email, 'bank_name', t.bank_name,
      'branch_name', coalesce(t.branch_name, t.branch, t.site_name), 'terminal_id', t.terminal_id,
      'created_at', t.created_at, 'updated_at', t.updated_at
    ) order by t.updated_at desc) from public.tickets t
      where not public.ark_ticket_status_is_final(t.status, t.completion_status)), '[]'::jsonb),
    'site_visits', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.site_visits v where v.created_at >= now() - interval '7 days'), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ark_live_operations_map_snapshot() from public, anon;
grant execute on function public.ark_live_operations_map_snapshot() to authenticated;

comment on function public.ark_hr_workflow_performance_snapshot(integer) is
  'Evidence-based non-financial employee and department workflow metrics for HR.';
comment on function public.ark_system_operational_report(integer) is
  'System Administrator operational report excluding confidential Finance details.';
comment on function public.ark_live_operations_map_snapshot() is
  'Synchronized map snapshot from engineers, devices, branches, sites, open tickets and recent field visits.';
