-- Reports legacy schema gaps without pretending unknown production definitions
-- can be reconstructed from frontend queries alone.

create or replace function public.ark_schema_contract_audit()
returns table(object_name text, object_type text, issue text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare expected_table text;
begin
  perform public.ark_assert_system_admin();

  foreach expected_table in array array[
    'users','user_profiles','employees','engineers','notifications',
    'gmail_connections','email_messages','chat_messages','audit_logs',
    'banks','branches','departments','sites','machines','bank_devices','devices',
    'tickets','comments','site_visits','engineer_statuses','operations_events','operations_status',
    'part_requests','part_lifecycle_logs','inventory','inventory_items','inventory_movements',
    'inventory_usage_logs','inventory_dispatch_fund_requests','spare_parts','spare_part_requests',
    'spare_part_serials','repair_jobs','rr_consumable_requests','hr_attendance','hr_holidays',
    'hr_leave','leave_requests','hr_loans','hr_performance','hr_training','crm_clients',
    'crm_complaints','leads','lpos','purchase_requests','fund_requests','workflow_requests',
    'invoices','expenses','finance_accounts','finance_bank_accounts','finance_journals',
    'finance_journal_lines','finance_account_balances','finance_budgets','finance_payments',
    'finance_bank_reconciliations','finance_fixed_assets','finance_corrections','finance_audit_logs',
    'finance_tax_codes','finance_tax_rates','finance_tax_transactions','finance_tax_returns',
    'finance_tax_payments','finance_customers','finance_suppliers','finance_receivable_allocations',
    'finance_payable_allocations','finance_expense_requests','finance_expense_request_approvals',
    'finance_expense_request_attachments','finance_expense_payments','finance_expense_request_history'
  ]
  loop
    if to_regclass(format('public.%I', expected_table)) is null then
      object_name := expected_table; object_type := 'table'; issue := 'missing from database';
      return next;
    elsif not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = expected_table and c.relrowsecurity
    ) then
      object_name := expected_table; object_type := 'table'; issue := 'RLS is disabled';
      return next;
    elsif not exists (
      select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = expected_table
    ) then
      object_name := expected_table; object_type := 'table'; issue := 'RLS has no policies';
      return next;
    end if;
  end loop;

  return query
  select duplicate_check.object_name, 'identity'::text, duplicate_check.issue
  from (
    select 'users.email'::text object_name, 'case-insensitive duplicate values exist'::text issue
    where exists (select 1 from public.users group by lower(email) having count(*) > 1)
    union all
    select 'user_profiles.user_email', 'case-insensitive duplicate values exist'
    where exists (select 1 from public.user_profiles group by lower(user_email) having count(*) > 1)
  ) duplicate_check;
end;
$$;

revoke all on function public.ark_schema_contract_audit() from public, anon;
grant execute on function public.ark_schema_contract_audit() to authenticated;
