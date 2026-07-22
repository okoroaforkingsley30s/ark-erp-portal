-- Repair Gmail synchronization idempotency and separate system administration
-- from confidential Finance & Accounts data.

do $$
begin
  if to_regclass('public.email_messages') is not null then
    -- Gmail message IDs are mailbox-scoped. The owner/message pair is the
    -- durable synchronization identity used by the Edge Function.
    delete from public.email_messages older
    using public.email_messages newer
    where older.created_by is not null
      and older.gmail_message_id is not null
      and older.created_by = newer.created_by
      and older.gmail_message_id = newer.gmail_message_id
      and older.id < newer.id;

    alter table public.email_messages
      drop constraint if exists email_messages_gmail_message_id_unique;
    drop index if exists public.email_messages_owner_gmail_message_uidx;
    create unique index if not exists email_messages_owner_gmail_message_uidx
      on public.email_messages(created_by, gmail_message_id);
  end if;
end
$$;

create or replace function public.finance_is_read_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.ark_current_user_role() in (
    'ceo', 'agm', 'manager', 'finance', 'finance_manager',
    'head_of_account', 'account', 'accounts', 'accountant'
  );
$$;

create or replace function public.finance_is_write_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.ark_current_user_role() in (
    'finance', 'finance_manager', 'head_of_account',
    'account', 'accounts', 'accountant'
  );
$$;

create or replace function public.finance_is_privileged_expense_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.finance_current_user_role() in (
    'ceo', 'agm', 'finance', 'finance_manager', 'head_of_account',
    'account', 'accounts', 'accountant'
  );
$$;

create or replace function public.finance_is_expense_approver_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.finance_current_user_role() in (
    'ceo', 'agm', 'manager', 'operations', 'operational_manager', 'hr',
    'finance', 'finance_manager', 'head_of_account'
  );
$$;

create or replace function public.finance_assert_journal_role(p_action text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.finance_current_user_role();
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if lower(coalesce(p_action, '')) in ('create', 'submit') then
    if actor_role not in (
      'ceo', 'agm', 'finance', 'finance_manager', 'head_of_account',
      'account', 'accounts', 'accountant'
    ) then
      raise exception 'Finance authorization required' using errcode = '42501';
    end if;
  elsif lower(coalesce(p_action, '')) in ('approve', 'reject', 'post', 'reverse') then
    if actor_role not in ('ceo', 'agm', 'finance_manager', 'head_of_account') then
      raise exception 'Finance approval authorization required' using errcode = '42501';
    end if;
  else
    raise exception 'Unsupported journal action %', p_action;
  end if;

  return actor_role;
end;
$$;

revoke all on function public.finance_is_read_role() from public, anon;
revoke all on function public.finance_is_write_role() from public, anon;
revoke all on function public.finance_is_privileged_expense_role() from public, anon;
revoke all on function public.finance_is_expense_approver_role() from public, anon;
revoke all on function public.finance_assert_journal_role(text) from public, anon;
grant execute on function public.finance_is_read_role() to authenticated;
grant execute on function public.finance_is_write_role() to authenticated;
grant execute on function public.finance_is_privileged_expense_role() to authenticated;
grant execute on function public.finance_is_expense_approver_role() to authenticated;
grant execute on function public.finance_assert_journal_role(text) to authenticated;

-- System administrators are never Finance record deleters. Finance tables keep
-- their existing read/write policies, which now use the restricted helpers.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'finance_accounts', 'finance_bank_accounts', 'finance_account_balances',
    'finance_budgets', 'finance_payments', 'finance_bank_reconciliations',
    'finance_fixed_assets', 'finance_corrections', 'finance_tax_codes',
    'finance_tax_rates', 'finance_tax_transactions', 'finance_tax_returns',
    'finance_tax_payments', 'finance_customers', 'finance_suppliers',
    'finance_receivable_allocations', 'finance_payable_allocations'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists finance_admin_delete on public.%I', table_name);
    end if;
  end loop;
end
$$;

-- Replace every permissive legacy policy on general fund requests. Requesters
-- retain their own rows; workflow departments see only the queue they operate.
do $$
declare existing_policy record;
begin
  if to_regclass('public.fund_requests') is null then return; end if;
  alter table public.fund_requests enable row level security;
  for existing_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'fund_requests'
  loop
    execute format('drop policy if exists %I on public.fund_requests', existing_policy.policyname);
  end loop;
end
$$;

create policy ark_fund_requests_select on public.fund_requests
for select to authenticated
using (
  public.ark_row_belongs_to_current_user(to_jsonb(fund_requests))
  or public.ark_current_user_role() in (
    'ceo','agm','manager','hr','operations','operational_manager',
    'finance','finance_manager','head_of_account','accountant'
  )
  or (
    repair_job_id is not null and public.ark_current_user_role() in (
      'repair_head','rr_hod','repair_hod','head_of_rr'
    )
  )
);

create policy ark_fund_requests_insert on public.fund_requests
for insert to authenticated
with check (public.ark_row_belongs_to_current_user(to_jsonb(fund_requests)));

create policy ark_fund_requests_update on public.fund_requests
for update to authenticated
using (public.ark_current_user_role() in (
  'ceo','agm','manager','hr','operations','operational_manager',
  'finance','finance_manager','head_of_account','accountant',
  'repair_head','rr_hod','repair_hod','head_of_rr'
))
with check (public.ark_current_user_role() in (
  'ceo','agm','manager','hr','operations','operational_manager',
  'finance','finance_manager','head_of_account','accountant',
  'repair_head','rr_hod','repair_hod','head_of_rr'
));

comment on function public.finance_is_read_role() is
  'Confidential Finance reader authorization; intentionally excludes system administration.';
