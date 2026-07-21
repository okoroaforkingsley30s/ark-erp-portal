-- Finance role policies and server-enforced state transitions.

create or replace function public.finance_is_read_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.ark_current_user_role() in (
    'system_admin', 'admin', 'ceo', 'agm', 'manager', 'finance',
    'finance_manager', 'head_of_account', 'account', 'accounts', 'accountant'
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
    'system_admin', 'finance', 'finance_manager', 'head_of_account',
    'account', 'accounts', 'accountant'
  );
$$;

revoke all on function public.finance_is_read_role() from public, anon;
revoke all on function public.finance_is_write_role() from public, anon;
grant execute on function public.finance_is_read_role() to authenticated;
grant execute on function public.finance_is_write_role() to authenticated;

do $$
declare
  table_name text;
  existing_policy record;
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
    if to_regclass(format('public.%I', table_name)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', table_name);
    for existing_policy in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', existing_policy.policyname, table_name);
    end loop;
    execute format(
      'create policy finance_role_select on public.%I for select to authenticated using (public.finance_is_read_role())',
      table_name
    );
    execute format(
      'create policy finance_role_insert on public.%I for insert to authenticated with check (public.finance_is_write_role())',
      table_name
    );
    execute format(
      'create policy finance_role_update on public.%I for update to authenticated using (public.finance_is_write_role()) with check (public.finance_is_write_role())',
      table_name
    );
    execute format(
      'create policy finance_admin_delete on public.%I for delete to authenticated using (public.ark_is_system_admin())',
      table_name
    );
  end loop;
end
$$;

-- Existing installations may pre-date the inline CREATE TABLE checks. NOT VALID
-- protects all new writes immediately without making deployment fail on legacy
-- rows; production data can be cleaned and each constraint validated afterward.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'finance_budgets_status_guard') then
    alter table public.finance_budgets add constraint finance_budgets_status_guard
      check (status in ('draft','pending_review','approved','closed','rejected')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_payments_status_guard') then
    alter table public.finance_payments add constraint finance_payments_status_guard
      check (status in ('draft','pending_review','approved','paid','posted','rejected','cancelled')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_bank_reconciliations_status_guard') then
    alter table public.finance_bank_reconciliations add constraint finance_bank_reconciliations_status_guard
      check (status in ('draft','in_review','reconciled','rejected')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_corrections_status_guard') then
    alter table public.finance_corrections add constraint finance_corrections_status_guard
      check (status in ('pending_review','approved','rejected','posted')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_tax_transactions_status_guard') then
    alter table public.finance_tax_transactions add constraint finance_tax_transactions_status_guard
      check (status in ('draft','accrued','return_filed','paid','cancelled')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_tax_returns_status_guard') then
    alter table public.finance_tax_returns add constraint finance_tax_returns_status_guard
      check (status in ('draft','prepared','filed','paid','overdue','cancelled')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_tax_payments_status_guard') then
    alter table public.finance_tax_payments add constraint finance_tax_payments_status_guard
      check (status in ('draft','approved','paid','reconciled','cancelled')) not valid;
  end if;
end
$$;

create or replace function public.finance_guard_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare allowed boolean := false;
begin
  if new.status is not distinct from old.status then return new; end if;
  if not public.finance_is_write_role() then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;

  allowed := case tg_table_name
    when 'finance_budgets' then
      (old.status = 'draft' and new.status in ('pending_review','rejected')) or
      (old.status = 'pending_review' and new.status in ('draft','approved','rejected')) or
      (old.status = 'approved' and new.status = 'closed')
    when 'finance_payments' then
      (old.status = 'draft' and new.status in ('pending_review','cancelled')) or
      (old.status = 'pending_review' and new.status in ('approved','rejected','draft')) or
      (old.status = 'approved' and new.status in ('paid','cancelled')) or
      (old.status = 'paid' and new.status = 'posted')
    when 'finance_bank_reconciliations' then
      (old.status = 'draft' and new.status in ('in_review','rejected')) or
      (old.status = 'in_review' and new.status in ('draft','reconciled','rejected'))
    when 'finance_corrections' then
      (old.status = 'pending_review' and new.status in ('approved','rejected')) or
      (old.status = 'approved' and new.status = 'posted')
    when 'finance_tax_transactions' then
      (old.status = 'draft' and new.status in ('accrued','cancelled')) or
      (old.status = 'accrued' and new.status in ('return_filed','paid','cancelled')) or
      (old.status = 'return_filed' and new.status = 'paid')
    when 'finance_tax_returns' then
      (old.status = 'draft' and new.status in ('prepared','cancelled')) or
      (old.status = 'prepared' and new.status in ('draft','filed','cancelled')) or
      (old.status = 'filed' and new.status in ('paid','overdue')) or
      (old.status = 'overdue' and new.status = 'paid')
    when 'finance_tax_payments' then
      (old.status = 'draft' and new.status in ('approved','cancelled')) or
      (old.status = 'approved' and new.status in ('paid','cancelled')) or
      (old.status = 'paid' and new.status = 'reconciled')
    else false
  end;

  if not allowed then
    raise exception 'Invalid % status transition: % -> %', tg_table_name, old.status, new.status;
  end if;
  return new;
end;
$$;

revoke all on function public.finance_guard_status_transition() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'finance_budgets', 'finance_payments', 'finance_bank_reconciliations',
    'finance_corrections', 'finance_tax_transactions', 'finance_tax_returns',
    'finance_tax_payments'
  ]
  loop
    execute format('drop trigger if exists finance_status_transition_guard on public.%I', table_name);
    execute format(
      'create trigger finance_status_transition_guard before update of status on public.%I for each row execute function public.finance_guard_status_transition()',
      table_name
    );
  end loop;
end
$$;

-- Prevent duplicate active tax-rate defaults for the same tax code.
with ranked_defaults as (
  select id, row_number() over (
    partition by tax_code_id order by effective_from desc, created_at desc, id desc
  ) as position
  from public.finance_tax_rates
  where is_default is true and is_active is true
)
update public.finance_tax_rates rate
set is_default = false, updated_at = now()
from ranked_defaults ranked
where rate.id = ranked.id and ranked.position > 1;

create unique index if not exists finance_tax_rates_one_active_default_uidx
  on public.finance_tax_rates (tax_code_id)
  where is_default is true and is_active is true;
