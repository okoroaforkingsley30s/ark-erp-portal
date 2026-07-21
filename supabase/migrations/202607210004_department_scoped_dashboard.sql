-- One authenticated, role-scoped source for the first dashboard. The browser
-- never downloads organization-wide operational tables and filters them later.

create or replace function public.ark_dashboard_safe_count(p_sql text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result bigint := 0;
begin
  execute p_sql into result;
  return coalesce(result, 0);
exception when undefined_table or undefined_column then
  return 0;
end;
$$;

create or replace function public.ark_department_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  cards jsonb := '{}'::jsonb;
  recent jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  case actor_role
    when 'system_admin' then cards := jsonb_build_object(
      'active_users', public.ark_dashboard_safe_count('select count(*) from public.users where lower(coalesce(status, ''active''))=''active'''),
      'pending_users', public.ark_dashboard_safe_count('select count(*) from public.users where lower(coalesce(status, '''')) in (''pending'',''pending_approval'')'),
      'system_alerts', public.ark_dashboard_safe_count('select count(*) from public.notifications where lower(coalesce(type, '''')) in (''system_alert'',''security'') and created_at>=now()-interval ''7 days'''),
      'recent_events', public.ark_dashboard_safe_count('select count(*) from public.operations_events where created_at>=now()-interval ''24 hours''')
    );
    when 'ceo', 'agm', 'manager' then cards := jsonb_build_object(
      'open_tickets', public.ark_dashboard_safe_count('select count(*) from public.tickets where lower(coalesce(status, '''')) not in (''closed'',''completed'',''approved'',''resolved'')'),
      'part_workflows', public.ark_dashboard_safe_count('select count(*) from public.part_requests where lower(coalesce(status, part_request_status, '''')) not in (''closed'',''completed'',''received'',''rejected'')'),
      'repair_jobs', public.ark_dashboard_safe_count('select count(*) from public.repair_jobs where lower(coalesce(status, '''')) not in (''closed'',''completed'',''returned_to_inventory'')'),
      'pending_funds', public.ark_dashboard_safe_count('select count(*) from public.fund_requests where lower(coalesce(status, '''')) in (''pending'',''pending_review'',''pending_finance_review'',''approved'')')
    );
    when 'engineer' then cards := jsonb_build_object(
      'assigned_jobs', public.ark_dashboard_safe_count(format(
        'select count(*) from public.tickets where lower(coalesce(assigned_to, assigned_engineer_email, ''''))=%L and lower(coalesce(status, '''')) not in (''closed'',''completed'',''approved'',''resolved'')', actor_email)),
      'pending_review', public.ark_dashboard_safe_count(format(
        'select count(*) from public.tickets where lower(coalesce(assigned_to, assigned_engineer_email, ''''))=%L and lower(coalesce(status, ''''))=''pending_review''', actor_email)),
      'part_requests', public.ark_dashboard_safe_count(format(
        'select count(*) from public.part_requests where lower(coalesce(engineer_email, requested_by_email, ''''))=%L and lower(coalesce(status, part_request_status, '''')) not in (''closed'',''completed'',''received'',''rejected'')', actor_email)),
      'closed_jobs', public.ark_dashboard_safe_count(format(
        'select count(*) from public.tickets where lower(coalesce(assigned_to, assigned_engineer_email, ''''))=%L and (lower(coalesce(status, '''')) in (''closed'',''completed'',''approved'',''resolved'') or lower(coalesce(completion_status, '''')) in (''closed'',''completed'',''approved'',''resolved''))', actor_email))
    );
    when 'helpdesk' then cards := jsonb_build_object(
      'open_tickets', public.ark_dashboard_safe_count('select count(*) from public.tickets where lower(coalesce(status, '''')) not in (''closed'',''completed'',''approved'',''resolved'')'),
      'pending_review', public.ark_dashboard_safe_count('select count(*) from public.tickets where lower(coalesce(status, ''''))=''pending_review'''),
      'escalated', public.ark_dashboard_safe_count('select count(*) from public.tickets where coalesce(escalated,false)=true and lower(coalesce(status, '''')) not in (''closed'',''completed'',''approved'',''resolved'')'),
      'closed_tickets', public.ark_dashboard_safe_count('select count(*) from public.tickets where lower(coalesce(status, '''')) in (''closed'',''completed'',''approved'',''resolved'')')
    );
    when 'operations' then cards := jsonb_build_object(
      'part_approvals', public.ark_dashboard_safe_count('select count(*) from public.part_requests where lower(coalesce(operations_status, '''')) in (''pending'',''pending_operations'',''waiting_operations_approval'')'),
      'escalations', public.ark_dashboard_safe_count('select count(*) from public.tickets where coalesce(escalated,false)=true and lower(coalesce(status, '''')) not in (''closed'',''completed'',''approved'',''resolved'')'),
      'sent_inventory', public.ark_dashboard_safe_count('select count(*) from public.part_requests where lower(coalesce(operations_status, ''''))=''sent_to_inventory'''),
      'active_tickets', public.ark_dashboard_safe_count('select count(*) from public.tickets where lower(coalesce(status, '''')) not in (''closed'',''completed'',''approved'',''resolved'')')
    );
    when 'inventory' then cards := jsonb_build_object(
      'part_requests', public.ark_dashboard_safe_count('select count(*) from public.part_requests where lower(coalesce(inventory_status, '''')) in (''pending'',''pending_inventory'',''pending_inventory_review'')'),
      'rr_consumables', public.ark_dashboard_safe_count('select count(*) from public.rr_consumable_requests where lower(coalesce(status, inventory_status, '''')) in (''approved_by_hod'',''pending_inventory'',''approved'')'),
      'low_stock', public.ark_dashboard_safe_count('select count(*) from public.spare_parts where coalesce(quantity_available,0)<=coalesce(minimum_stock_level,0)'),
      'repair_returns', public.ark_dashboard_safe_count('select count(*) from public.repair_jobs where lower(coalesce(status, '''')) in (''qa_passed'',''ready_for_inventory'',''returned_to_inventory'')')
    );
    when 'repair_head' then cards := jsonb_build_object(
      'repair_intake', public.ark_dashboard_safe_count('select count(*) from public.repair_jobs where lower(coalesce(status, '''')) in (''received'',''pending_assignment'',''pending'')'),
      'active_repairs', public.ark_dashboard_safe_count('select count(*) from public.repair_jobs where lower(coalesce(status, '''')) in (''assigned'',''diagnosing'',''repairing'',''refurbishing'')'),
      'support_approvals', public.ark_dashboard_safe_count('select count(*) from public.rr_consumable_requests where lower(coalesce(status, '''')) in (''pending_hod'',''pending_rr_hod'')'),
      'qa_queue', public.ark_dashboard_safe_count('select count(*) from public.repair_jobs where lower(coalesce(status, '''')) in (''pending_qa'',''submitted_qa'')')
    );
    when 'repair_technician' then cards := jsonb_build_object(
      'assigned_repairs', public.ark_dashboard_safe_count(format('select count(*) from public.repair_jobs where (assigned_to::text=%L or assigned_rr_technician::text=(select id::text from public.user_profiles where lower(email)=%L limit 1)) and lower(coalesce(status, '''')) not in (''completed'',''closed'',''returned_to_inventory'')', auth.uid()::text, actor_email)),
      'active_repairs', public.ark_dashboard_safe_count(format('select count(*) from public.repair_jobs where assigned_to::text=%L and lower(coalesce(status, '''')) in (''diagnosing'',''repairing'',''refurbishing'')', auth.uid()::text)),
      'consumables', public.ark_dashboard_safe_count(format('select count(*) from public.rr_consumable_requests where lower(coalesce(requested_by_email, ''''))=%L and lower(coalesce(status, '''')) not in (''used'',''closed'',''rejected'')', actor_email)),
      'qa_submitted', public.ark_dashboard_safe_count(format('select count(*) from public.repair_jobs where assigned_to::text=%L and lower(coalesce(status, '''')) in (''pending_qa'',''submitted_qa'')', auth.uid()::text))
    );
    when 'head_of_account', 'finance' then cards := jsonb_build_object(
      'fund_requests', public.ark_dashboard_safe_count('select count(*) from public.fund_requests where lower(coalesce(status, '''')) in (''pending'',''pending_finance_review'',''approved'')'),
      'payments', public.ark_dashboard_safe_count('select count(*) from public.finance_payments where lower(coalesce(status, '''')) in (''pending_review'',''approved'')'),
      'journals', public.ark_dashboard_safe_count('select count(*) from public.finance_journals where lower(coalesce(status, '''')) in (''draft'',''pending_review'',''approved'')'),
      'reconciliations', public.ark_dashboard_safe_count('select count(*) from public.finance_bank_reconciliations where lower(coalesce(status, '''')) in (''draft'',''in_review'')')
    );
    when 'hr' then cards := jsonb_build_object(
      'employees', public.ark_dashboard_safe_count('select count(*) from public.employees where lower(coalesce(status, ''active''))=''active'''),
      'leave_requests', public.ark_dashboard_safe_count('select count(*) from public.hr_leave where lower(coalesce(status, ''''))=''pending'''),
      'training', public.ark_dashboard_safe_count('select count(*) from public.hr_training where start_date>=current_date'),
      'attendance_today', public.ark_dashboard_safe_count('select count(*) from public.hr_attendance where attendance_date=current_date')
    );
    when 'head_of_business_development', 'business_developer' then cards := jsonb_build_object(
      'leads', public.ark_dashboard_safe_count('select count(*) from public.leads where lower(coalesce(status, '''')) not in (''won'',''lost'',''closed'')'),
      'clients', public.ark_dashboard_safe_count('select count(*) from public.crm_clients'),
      'complaints', public.ark_dashboard_safe_count('select count(*) from public.crm_complaints where lower(coalesce(status, '''')) not in (''resolved'',''closed'')'),
      'won_business', public.ark_dashboard_safe_count('select count(*) from public.leads where lower(coalesce(status, ''''))=''won''')
    );
    when 'head_of_it', 'it' then cards := jsonb_build_object(
      'active_users', public.ark_dashboard_safe_count('select count(*) from public.users where lower(coalesce(status, ''active''))=''active'''),
      'pending_users', public.ark_dashboard_safe_count('select count(*) from public.users where lower(coalesce(status, '''')) in (''pending'',''pending_approval'')'),
      'system_alerts', public.ark_dashboard_safe_count('select count(*) from public.notifications where lower(coalesce(type, '''')) in (''system_alert'',''security'') and created_at>=now()-interval ''7 days'''),
      'recent_events', public.ark_dashboard_safe_count('select count(*) from public.operations_events where created_at>=now()-interval ''24 hours''')
    );
    when 'admin_head', 'admin' then cards := jsonb_build_object(
      'staff', public.ark_dashboard_safe_count('select count(*) from public.users where lower(coalesce(status, ''active''))=''active'''),
      'pending_users', public.ark_dashboard_safe_count('select count(*) from public.users where lower(coalesce(status, '''')) in (''pending'',''pending_approval'')'),
      'departments', public.ark_dashboard_safe_count('select count(*) from public.departments'),
      'recent_activity', public.ark_dashboard_safe_count('select count(*) from public.operations_events where created_at>=now()-interval ''24 hours''')
    );
    when 'procurement' then cards := jsonb_build_object(
      'open_items', public.ark_dashboard_safe_count('select count(*) from public.lpos where lower(coalesce(status, '''')) in (''draft'',''pending'',''pending_approval'')'),
      'recent_activity', public.ark_dashboard_safe_count('select count(*) from public.lpos where created_at>=now()-interval ''30 days'''),
      'reports', public.ark_dashboard_safe_count('select count(*) from public.finance_suppliers where lower(coalesce(status, ''active''))=''active'''),
      'alerts', public.ark_dashboard_safe_count('select count(*) from public.notifications where lower(user_email)=lower(coalesce(auth.jwt()->>''email'','''')) and coalesce(read,false)=false')
    );
    when 'client' then cards := jsonb_build_object(
      'open_items', public.ark_dashboard_safe_count(format('select count(*) from public.tickets where lower(coalesce(client_email, ''''))=%L and lower(coalesce(status, '''')) not in (''closed'',''completed'',''approved'',''resolved'')', actor_email)),
      'recent_activity', public.ark_dashboard_safe_count(format('select count(*) from public.tickets where lower(coalesce(client_email, ''''))=%L and updated_at>=now()-interval ''30 days''', actor_email)),
      'reports', public.ark_dashboard_safe_count(format('select count(*) from public.tickets where lower(coalesce(client_email, ''''))=%L and lower(coalesce(status, '''')) in (''closed'',''completed'',''approved'',''resolved'')', actor_email)),
      'alerts', public.ark_dashboard_safe_count(format('select count(*) from public.notifications where lower(user_email)=%L and coalesce(read,false)=false', actor_email))
    );
    else cards := jsonb_build_object(
      'open_items', public.ark_dashboard_safe_count('select count(*) from public.notifications where lower(user_email)=lower(coalesce(auth.jwt()->>''email'','''')) and coalesce(read,false)=false'),
      'recent_activity', public.ark_dashboard_safe_count('select count(*) from public.operations_events where created_at>=now()-interval ''24 hours'''),
      'reports', 0,
      'alerts', 0
    );
  end case;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
  into recent
  from (
    select id, title, coalesce(message, message_body) as message, type, link, created_at
    from public.notifications
    where lower(user_email)=actor_email
    order by created_at desc limit 8
  ) n;

  return jsonb_build_object('role', actor_role, 'cards', cards, 'recent', recent);
end;
$$;

revoke all on function public.ark_dashboard_safe_count(text) from public, anon, authenticated;
revoke all on function public.ark_department_dashboard_summary() from public, anon;
grant execute on function public.ark_department_dashboard_summary() to authenticated;
