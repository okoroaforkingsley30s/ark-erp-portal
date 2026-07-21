-- Highest-risk RLS baseline and reproducible database-security audit.

create or replace function public.ark_is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.users u
    where (u.id = auth.uid() or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      and lower(coalesce(u.role, '')) = 'system_admin'
      and u.is_approved is true
      and lower(coalesce(u.account_status, 'active')) = 'active'
  );
$$;

revoke all on function public.ark_is_system_admin() from public, anon;
grant execute on function public.ark_is_system_admin() to authenticated;

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users enable row level security;
    drop policy if exists ark_users_read_self_or_admin on public.users;
    create policy ark_users_read_self_or_admin on public.users for select to authenticated
      using (id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.ark_is_system_admin());
    drop policy if exists ark_users_register_pending_self on public.users;
    create policy ark_users_register_pending_self on public.users for insert to authenticated
      with check (
        (id = auth.uid() or public.ark_current_user_role() = 'hr')
        and role is null and is_approved is false
        and lower(coalesce(approval_status, status, 'pending')) = 'pending'
      );
  end if;

  if to_regclass('public.user_profiles') is not null then
    alter table public.user_profiles enable row level security;
    drop policy if exists ark_user_profiles_authenticated_read on public.user_profiles;
    create policy ark_user_profiles_authenticated_read on public.user_profiles for select to authenticated
      using (true);
    drop policy if exists ark_user_profiles_self_update on public.user_profiles;
    create policy ark_user_profiles_self_update on public.user_profiles for update to authenticated
      using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      with check (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
  end if;

  if to_regclass('public.gmail_connections') is not null then
    alter table public.gmail_connections enable row level security;
    drop policy if exists ark_gmail_connections_owner_all on public.gmail_connections;
    create policy ark_gmail_connections_owner_all on public.gmail_connections for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if to_regclass('public.email_messages') is not null then
    alter table public.email_messages enable row level security;
    drop policy if exists ark_email_messages_owner_all on public.email_messages;
    create policy ark_email_messages_owner_all on public.email_messages for all to authenticated
      using (created_by = auth.uid()) with check (created_by = auth.uid());
  end if;

  if to_regclass('public.notifications') is not null then
    alter table public.notifications enable row level security;
    drop policy if exists ark_notifications_recipient_read on public.notifications;
    create policy ark_notifications_recipient_read on public.notifications for select to authenticated
      using (
        lower(coalesce(recipient_email, user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or public.ark_is_system_admin()
      );
    drop policy if exists ark_notifications_recipient_update on public.notifications;
    create policy ark_notifications_recipient_update on public.notifications for update to authenticated
      using (lower(coalesce(recipient_email, user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
      with check (lower(coalesce(recipient_email, user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
    drop policy if exists ark_notifications_authorized_insert on public.notifications;
    create policy ark_notifications_authorized_insert on public.notifications for insert to authenticated
      with check (public.ark_current_user_role() in (
        'system_admin', 'ceo', 'agm', 'manager', 'hr', 'helpdesk', 'operations',
        'inventory', 'repair_head', 'finance', 'procurement', 'crm'
      ));
  end if;

  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs enable row level security;
    drop policy if exists ark_audit_logs_admin_read on public.audit_logs;
    create policy ark_audit_logs_admin_read on public.audit_logs for select to authenticated
      using (public.ark_is_system_admin());
  end if;
end
$$;

-- Views must evaluate their underlying tables as the caller, not the owner.
alter view if exists public.finance_general_ledger_view set (security_invoker = true);
alter view if exists public.finance_account_statement_view set (security_invoker = true);
alter view if exists public.finance_trial_balance_view set (security_invoker = true);
alter view if exists public.finance_ar_invoice_view set (security_invoker = true);
alter view if exists public.finance_ar_ageing_view set (security_invoker = true);
alter view if exists public.finance_ap_payable_view set (security_invoker = true);
alter view if exists public.finance_ap_ageing_view set (security_invoker = true);
alter view if exists public.finance_vat_report_view set (security_invoker = true);
alter view if exists public.finance_wht_report_view set (security_invoker = true);
alter view if exists public.finance_paye_report_view set (security_invoker = true);
alter view if exists public.finance_tax_liability_report_view set (security_invoker = true);

-- Remove PostgreSQL's default function execution grant. Explicit grants below
-- form the application RPC allowlist; service_role retains its bypass ability.
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public;

grant execute on function public.ark_is_system_admin() to authenticated;
grant execute on function public.ark_manage_user_approval(uuid, text, text, text, text) to authenticated;
grant execute on function public.ark_complete_password_setup(text, text, text) to authenticated;
grant execute on function public.ark_current_user_role() to authenticated;
grant execute on function public.finance_current_user_email() to authenticated;
grant execute on function public.finance_current_user_role() to authenticated;
grant execute on function public.finance_is_privileged_expense_role() to authenticated;
grant execute on function public.finance_is_expense_approver_role() to authenticated;
grant execute on function public.finance_create_journal_transaction(date, text, jsonb) to authenticated;
grant execute on function public.finance_transition_journal(uuid, text, text) to authenticated;
grant execute on function public.finance_create_reversal_transaction(uuid, text) to authenticated;
grant execute on function public.finance_create_source_journal_transaction(text, text, date, text, jsonb) to authenticated;
grant execute on function public.finance_record_general_request_payment_secure(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.finance_create_tax_draft_journal_secure(uuid) to authenticated;
grant execute on function public.finance_generate_journal_no(text, date) to authenticated;
grant execute on function public.finance_generate_expense_request_no(date) to authenticated;
grant execute on function public.finance_generate_expense_payment_no(date) to authenticated;
grant execute on function public.finance_validate_balanced_journal(uuid) to authenticated;
grant execute on function public.finance_calculate_account_statement(uuid, date, date) to authenticated;
grant execute on function public.finance_calculate_trial_balance(date, date) to authenticated;
grant execute on function public.inventory_send_part_to_rr(uuid) to authenticated;
grant execute on function public.inventory_request_dispatch_fund(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.inventory_dispatch_stock_request(uuid, uuid) to authenticated;
grant execute on function public.rr_transition_repair_job(uuid, text, text, uuid) to authenticated;

create or replace function public.ark_database_security_audit()
returns table(table_name text, rls_enabled boolean, rls_forced boolean, policy_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ark_assert_system_admin();
  return query
    select c.relname::text, c.relrowsecurity, c.relforcerowsecurity, count(p.policyname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
    where n.nspname = 'public' and c.relkind = 'r'
    group by c.relname, c.relrowsecurity, c.relforcerowsecurity
    order by c.relrowsecurity asc, c.relname;
end;
$$;

revoke all on function public.ark_database_security_audit() from public, anon;
grant execute on function public.ark_database_security_audit() to authenticated;

-- Remove legacy permissive notification policies that bypass recipient isolation.
drop policy if exists "Allow authenticated users to read notifications"
  on public.notifications;

drop policy if exists "manage notifications"
  on public.notifications;

drop policy if exists notifications_delete_own
  on public.notifications;

drop policy if exists notifications_insert_auth
  on public.notifications;

drop policy if exists notifications_select_own
  on public.notifications;

drop policy if exists notifications_update_own
  on public.notifications;

drop policy if exists "read notifications"
  on public.notifications;