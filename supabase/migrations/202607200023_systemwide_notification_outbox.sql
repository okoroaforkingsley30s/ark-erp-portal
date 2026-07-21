-- System-wide workflow notifications and reliable major-event email outbox.

alter table public.notifications
  add column if not exists message text,
  add column if not exists event_key text,
  add column if not exists major_notification boolean not null default false,
  add column if not exists email_status text not null default 'not_required',
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_last_error text,
  add column if not exists email_sent_at timestamptz;

create unique index if not exists notifications_recipient_event_uidx
  on public.notifications (lower(user_email), event_key)
  where event_key is not null;

create index if not exists notifications_email_outbox_idx
  on public.notifications (email_status, created_at)
  where major_notification is true;

create or replace function public.ark_emit_workflow_notification(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_status text,
  p_title text,
  p_message text,
  p_link text,
  p_participant_emails text[] default '{}'::text[],
  p_recipient_roles text[] default '{}'::text[],
  p_major boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', p_metadata ->> 'actor_email', ''));
  recipient record;
  inserted_count integer := 0;
  clean_entity text := lower(trim(coalesce(p_entity_type, 'workflow')));
  clean_action text := lower(trim(coalesce(p_action, 'updated')));
  clean_status text := lower(trim(coalesce(p_status, 'updated')));
  dedupe_key text;
begin
  dedupe_key := concat_ws(
    ':', clean_entity, coalesce(p_entity_id, 'unknown'), clean_action, clean_status,
    coalesce(p_metadata ->> 'event_nonce', 'initial')
  );

  for recipient in
    with requested_emails as (
      select distinct lower(trim(email)) email
      from unnest(coalesce(p_participant_emails, '{}'::text[])) email
      where nullif(trim(email), '') is not null
    ), role_users as (
      select distinct lower(u.email) email
      from public.users u
      where lower(coalesce(u.role, '')) = any(coalesce(p_recipient_roles, '{}'::text[]))
        and coalesce(u.is_approved, false) is true
        and lower(coalesce(u.account_status, 'active')) = 'active'
    )
    select distinct candidate.email
    from (
      select email from requested_emails
      union
      select email from role_users
    ) candidate
    join public.users u on lower(u.email) = candidate.email
    where candidate.email <> actor_email
      and coalesce(u.is_approved, false) is true
      and lower(coalesce(u.account_status, 'active')) = 'active'
  loop
    insert into public.notifications(
      user_email, recipient_email, title, message, message_body, type,
      read, is_read, data, link, sound, event_key, major_notification,
      email_status, created_at
    ) values (
      recipient.email, recipient.email, left(p_title, 160), p_message, p_message,
      'workflow_' || clean_entity, false, false,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'entity_type', clean_entity,
        'entity_id', p_entity_id,
        'action', clean_action,
        'status', clean_status,
        'actor_email', actor_email,
        'major_notification', p_major
      ), p_link, 'bell', dedupe_key, p_major,
      case when p_major then 'queued' else 'not_required' end, now()
    )
    on conflict (lower(user_email), event_key) where event_key is not null
    do nothing;

    if found then inserted_count := inserted_count + 1; end if;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.ark_emit_workflow_notification(
  text, text, text, text, text, text, text, text[], text[], boolean, jsonb
) from public, anon, authenticated;

create or replace function public.ark_notify_workflow_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb := to_jsonb(new);
  old_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  entity_id text := coalesce(row_data ->> 'id', row_data ->> 'ticket_id', row_data ->> 'request_number', 'unknown');
  action_name text := case when tg_op = 'INSERT' then 'created' else 'status_changed' end;
  status_name text;
  title_value text;
  message_value text;
  participant_emails text[];
  recipient_roles text[] := '{}'::text[];
  major_event boolean;
  link_value text := '/notifications';
begin
  if tg_op = 'UPDATE' then
    status_name := case
      when row_data ->> 'lifecycle_status' is distinct from old_data ->> 'lifecycle_status' then row_data ->> 'lifecycle_status'
      when row_data ->> 'status' is distinct from old_data ->> 'status' then row_data ->> 'status'
      when row_data ->> 'approval_status' is distinct from old_data ->> 'approval_status' then row_data ->> 'approval_status'
      when row_data ->> 'operations_status' is distinct from old_data ->> 'operations_status' then row_data ->> 'operations_status'
      when row_data ->> 'inventory_status' is distinct from old_data ->> 'inventory_status' then row_data ->> 'inventory_status'
      when row_data ->> 'finance_status' is distinct from old_data ->> 'finance_status' then row_data ->> 'finance_status'
      when row_data ->> 'dispatch_status' is distinct from old_data ->> 'dispatch_status' then row_data ->> 'dispatch_status'
      else null
    end;
    if status_name is null then return new; end if;
  else
    status_name := coalesce(
      row_data ->> 'lifecycle_status', row_data ->> 'status',
      row_data ->> 'approval_status', row_data ->> 'operations_status', 'created'
    );
  end if;
  status_name := lower(status_name);

  participant_emails := array[
    row_data ->> 'user_email', row_data ->> 'recipient_email',
    row_data ->> 'requester_email', row_data ->> 'requested_by_email',
    row_data ->> 'engineer_email', row_data ->> 'assigned_engineer_email',
    row_data ->> 'assigned_to_email', row_data ->> 'staff_email',
    row_data ->> 'employee_email', row_data ->> 'client_email',
    row_data ->> 'supplier_email', row_data ->> 'created_by_email'
  ];

  case tg_table_name
    when 'part_requests' then
      link_value := '/part-requests';
      if status_name like '%operations%' then recipient_roles := array['operations','operational_manager','operations_manager'];
      elsif status_name like '%inventory%' then recipient_roles := array['inventory','inventory_head','inventory_manager'];
      elsif status_name like '%finance%' or status_name like '%fund%' then recipient_roles := array['finance','finance_head','finance_manager'];
      elsif status_name like '%rr%' or status_name like '%repair%' then recipient_roles := array['repair_head','rr_hod','repair_technician','rr_technician'];
      elsif status_name like '%dispatch%' then recipient_roles := array['inventory','operations'];
      else recipient_roles := array['operations','inventory']; end if;
    when 'repair_jobs' then
      link_value := '/rr-part-requests';
      recipient_roles := array['repair_head','rr_hod','repair_technician','rr_technician','inventory','inventory_head'];
    when 'inventory_dispatch_fund_requests' then
      link_value := '/fund-requests';
      recipient_roles := array['inventory','inventory_head','finance','finance_head','operations','operations_manager'];
    when 'finance_expense_requests', 'finance_payments', 'fund_requests' then
      link_value := '/finance';
      recipient_roles := array['finance','finance_head','finance_manager','manager','agm','ceo'];
    when 'workflow_requests', 'purchase_requests', 'lpos' then
      link_value := '/workflows';
      recipient_roles := array['procurement','finance','manager','agm','ceo'];
    when 'hr_leave', 'leave_requests', 'hr_loans', 'hr_training', 'hr_performance' then
      link_value := '/hr';
      recipient_roles := array['hr','head_of_hr','manager'];
    when 'crm_complaints', 'leads', 'crm_clients' then
      link_value := '/crm';
      recipient_roles := array['crm','business_developer','head_of_business_development','manager'];
    when 'devices', 'machines', 'assets' then
      link_value := '/machines';
      recipient_roles := array['system_admin','admin','it','it_admin','operations'];
    else
      recipient_roles := array['system_admin'];
  end case;

  major_event := status_name ~ '(approved|rejected|closed|completed|resolved|assigned|escalated|paid|disbursed|submitted|dispatched|received)';
  title_value := initcap(replace(tg_table_name, '_', ' ')) || ' ' || initcap(replace(status_name, '_', ' '));
  message_value := initcap(replace(tg_table_name, '_', ' ')) || ' ' || entity_id ||
    ' is now ' || replace(status_name, '_', ' ') || '.';

  perform public.ark_emit_workflow_notification(
    tg_table_name, entity_id, action_name, status_name, title_value,
    message_value, link_value, participant_emails, recipient_roles,
    major_event,
    jsonb_build_object(
      'actor_email', lower(coalesce(auth.jwt() ->> 'email', '')),
      'entity_type', tg_table_name,
      'entity_id', entity_id,
      'request_number', row_data ->> 'request_number',
      'ticket_number', row_data ->> 'ticket_number',
      'event_nonce', coalesce(row_data ->> 'updated_at', row_data ->> 'created_at', clock_timestamp()::text)
    )
  );

  return new;
end;
$$;

revoke all on function public.ark_notify_workflow_row() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'part_requests','repair_jobs','inventory_dispatch_fund_requests',
    'finance_expense_requests','finance_payments','fund_requests',
    'workflow_requests','purchase_requests','lpos',
    'hr_leave','leave_requests','hr_loans','hr_training','hr_performance',
    'crm_complaints','leads','crm_clients','devices','machines','assets'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists ark_system_notification_trigger on public.%I', table_name);
      execute format(
        'create trigger ark_system_notification_trigger after insert or update on public.%I for each row execute function public.ark_notify_workflow_row()',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Only the service role email worker may inspect or change delivery state.
revoke all on function public.ark_notify_workflow_row() from public, anon, authenticated;
