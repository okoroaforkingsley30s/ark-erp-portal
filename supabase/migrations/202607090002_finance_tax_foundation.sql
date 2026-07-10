-- Finance / Accounts v2 tax foundation
-- Safe posture for live app:
-- - Additive only: no drops, no renames, no deletes.
-- - Does not enable or change RLS policies.
-- - Does not modify existing invoice, expense, LPO, inventory, payroll, or fund request logic.
-- - Tax journals are created as draft only.
-- - Seed data uses ON CONFLICT DO NOTHING.

create extension if not exists pgcrypto;

insert into public.finance_accounts (account_code, account_name, account_type, normal_balance, description)
values
  ('2030', 'VAT Payable', 'liability', 'credit', 'Value Added Tax liability'),
  ('2040', 'Withholding Tax Payable', 'liability', 'credit', 'Withholding tax liability'),
  ('2050', 'PAYE Payable', 'liability', 'credit', 'PAYE tax liability'),
  ('2060', 'Company Income Tax Payable', 'liability', 'credit', 'Company income tax liability'),
  ('2070', 'Other Statutory Deductions Payable', 'liability', 'credit', 'Other statutory deduction liability'),
  ('5090', 'Tax Expense', 'expense', 'debit', 'Tax and statutory deduction expense')
on conflict (account_code) do nothing;

update public.finance_accounts child
set parent_account_id = parent.id
from public.finance_accounts parent
where child.parent_account_id is null
  and (
    (child.account_code in ('2030', '2040', '2050', '2060', '2070') and parent.account_code = '2000')
    or (child.account_code = '5090' and parent.account_code = '5000')
  );

create table if not exists public.finance_tax_codes (
  id uuid primary key default gen_random_uuid(),
  tax_code text not null unique,
  tax_name text not null,
  tax_type text not null check (
    tax_type in ('vat', 'withholding_tax', 'paye', 'company_income_tax', 'other_statutory_deduction')
  ),
  tax_authority text not null,
  applies_to text[] not null default array[]::text[],
  default_debit_account_id uuid references public.finance_accounts(id),
  default_credit_account_id uuid references public.finance_accounts(id),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_tax_rates (
  id uuid primary key default gen_random_uuid(),
  tax_code_id uuid not null references public.finance_tax_codes(id),
  rate_name text not null,
  rate_percent numeric(9, 4) not null default 0 check (rate_percent >= 0),
  effective_from date not null default current_date,
  effective_to date,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_tax_rates_effective_date_check check (
    effective_to is null or effective_to >= effective_from
  )
);

create table if not exists public.finance_tax_transactions (
  id uuid primary key default gen_random_uuid(),
  tax_transaction_no text not null unique,
  tax_code_id uuid not null references public.finance_tax_codes(id),
  tax_rate_id uuid references public.finance_tax_rates(id),
  source_module text not null default 'finance',
  source_table text not null check (
    source_table in ('invoices', 'expenses', 'payments', 'payroll', 'vendor_bills', 'purchases', 'lpos', 'other')
  ),
  source_id text not null,
  taxable_amount numeric(18, 2) not null default 0 check (taxable_amount >= 0),
  tax_rate numeric(9, 4) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(18, 2) not null default 0 check (tax_amount >= 0),
  currency text not null default 'NGN',
  tax_authority text not null,
  due_date date,
  status text not null default 'draft' check (
    status in ('draft', 'accrued', 'return_filed', 'paid', 'cancelled')
  ),
  journal_id uuid references public.finance_journals(id),
  payment_reference text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tax_code_id, source_table, source_id)
);

create table if not exists public.finance_tax_returns (
  id uuid primary key default gen_random_uuid(),
  tax_return_no text not null unique,
  tax_code_id uuid not null references public.finance_tax_codes(id),
  tax_authority text not null,
  period_start date not null,
  period_end date not null,
  due_date date,
  taxable_amount numeric(18, 2) not null default 0,
  tax_amount numeric(18, 2) not null default 0,
  amount_paid numeric(18, 2) not null default 0,
  balance_due numeric(18, 2) not null default 0,
  status text not null default 'draft' check (
    status in ('draft', 'prepared', 'filed', 'paid', 'overdue', 'cancelled')
  ),
  filed_at timestamptz,
  filed_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_tax_returns_period_check check (period_end >= period_start),
  unique (tax_code_id, period_start, period_end)
);

create table if not exists public.finance_tax_payments (
  id uuid primary key default gen_random_uuid(),
  tax_payment_no text not null unique,
  tax_return_id uuid references public.finance_tax_returns(id),
  tax_transaction_id uuid references public.finance_tax_transactions(id),
  tax_code_id uuid not null references public.finance_tax_codes(id),
  bank_account_id uuid references public.finance_bank_accounts(id),
  journal_id uuid references public.finance_journals(id),
  payment_date date not null default current_date,
  amount numeric(18, 2) not null default 0 check (amount >= 0),
  currency text not null default 'NGN',
  tax_authority text not null,
  payment_reference text,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'paid', 'reconciled', 'cancelled')
  ),
  created_by uuid,
  approved_by uuid,
  paid_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists finance_tax_codes_type_idx on public.finance_tax_codes(tax_type);
create index if not exists finance_tax_rates_code_idx on public.finance_tax_rates(tax_code_id);
create index if not exists finance_tax_transactions_code_idx on public.finance_tax_transactions(tax_code_id);
create index if not exists finance_tax_transactions_source_idx on public.finance_tax_transactions(source_table, source_id);
create index if not exists finance_tax_transactions_status_idx on public.finance_tax_transactions(status);
create index if not exists finance_tax_transactions_due_date_idx on public.finance_tax_transactions(due_date);
create index if not exists finance_tax_returns_code_period_idx on public.finance_tax_returns(tax_code_id, period_start, period_end);
create index if not exists finance_tax_returns_status_idx on public.finance_tax_returns(status);
create index if not exists finance_tax_payments_code_idx on public.finance_tax_payments(tax_code_id);
create index if not exists finance_tax_payments_reference_idx on public.finance_tax_payments(payment_reference);

create sequence if not exists public.finance_tax_transaction_no_seq start with 1 increment by 1;
create sequence if not exists public.finance_tax_return_no_seq start with 1 increment by 1;
create sequence if not exists public.finance_tax_payment_no_seq start with 1 increment by 1;

insert into public.finance_tax_codes (
  tax_code,
  tax_name,
  tax_type,
  tax_authority,
  applies_to,
  default_debit_account_id,
  default_credit_account_id,
  description
)
select
  seed.tax_code,
  seed.tax_name,
  seed.tax_type,
  seed.tax_authority,
  seed.applies_to,
  debit_account.id,
  credit_account.id,
  seed.description
from (
  values
    ('VAT', 'Value Added Tax', 'vat', 'Federal Inland Revenue Service', array['invoices', 'expenses', 'vendor_bills', 'purchases', 'lpos'], '5090', '2030', 'VAT on taxable supplies and purchases'),
    ('WHT', 'Withholding Tax', 'withholding_tax', 'Federal Inland Revenue Service', array['payments', 'expenses', 'vendor_bills', 'purchases', 'lpos'], '5090', '2040', 'Withholding tax deducted at source'),
    ('PAYE', 'Pay As You Earn', 'paye', 'State Internal Revenue Service', array['payroll'], '5010', '2050', 'Employee PAYE deductions'),
    ('CIT', 'Company Income Tax', 'company_income_tax', 'Federal Inland Revenue Service', array['payments'], '5090', '2060', 'Company income tax liability'),
    ('OTHER_STAT', 'Other Statutory Deduction', 'other_statutory_deduction', 'Relevant Tax Authority', array['payments', 'payroll', 'expenses'], '5090', '2070', 'Other statutory deductions and levies')
) as seed(tax_code, tax_name, tax_type, tax_authority, applies_to, debit_code, credit_code, description)
left join public.finance_accounts debit_account on debit_account.account_code = seed.debit_code
left join public.finance_accounts credit_account on credit_account.account_code = seed.credit_code
on conflict (tax_code) do nothing;

insert into public.finance_tax_rates (tax_code_id, rate_name, rate_percent, effective_from, is_default)
select code.id, seed.rate_name, seed.rate_percent, current_date, true
from (
  values
    ('VAT', 'Standard VAT', 7.5),
    ('WHT', 'Standard WHT', 5.0),
    ('PAYE', 'PAYE Variable', 0.0),
    ('CIT', 'Company Income Tax', 30.0),
    ('OTHER_STAT', 'Other Statutory Variable', 0.0)
) as seed(tax_code, rate_name, rate_percent)
join public.finance_tax_codes code on code.tax_code = seed.tax_code
where not exists (
  select 1
  from public.finance_tax_rates rate
  where rate.tax_code_id = code.id
    and rate.rate_name = seed.rate_name
    and rate.effective_from = current_date
);

create or replace function public.finance_calculate_tax_amount(
  p_taxable_amount numeric,
  p_tax_rate numeric
)
returns numeric
language sql
immutable
as $$
  select round((coalesce(p_taxable_amount, 0) * coalesce(p_tax_rate, 0) / 100)::numeric, 2);
$$;

create or replace function public.finance_generate_tax_no(
  p_prefix text default 'TAX',
  p_tax_date date default current_date
)
returns text
language plpgsql
as $$
declare
  next_number bigint;
  sequence_name text;
begin
  sequence_name := case upper(coalesce(nullif(trim(p_prefix), ''), 'TAX'))
    when 'TRN' then 'public.finance_tax_return_no_seq'
    when 'TPY' then 'public.finance_tax_payment_no_seq'
    else 'public.finance_tax_transaction_no_seq'
  end;

  execute format('select nextval(%L::regclass)', sequence_name) into next_number;

  return upper(coalesce(nullif(trim(p_prefix), ''), 'TAX'))
    || '-'
    || to_char(coalesce(p_tax_date, current_date), 'YYYYMMDD')
    || '-'
    || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.finance_create_tax_draft_journal(
  p_tax_transaction_id uuid,
  p_created_by uuid default null,
  p_created_by_name text default null
)
returns uuid
language plpgsql
as $$
declare
  tax_tx public.finance_tax_transactions%rowtype;
  tax_code public.finance_tax_codes%rowtype;
  existing_journal_id uuid;
  new_journal_id uuid;
  journal_no text;
begin
  select *
  into tax_tx
  from public.finance_tax_transactions
  where id = p_tax_transaction_id;

  if tax_tx.id is null then
    raise exception 'Tax transaction % was not found.', p_tax_transaction_id;
  end if;

  if tax_tx.journal_id is not null then
    return tax_tx.journal_id;
  end if;

  select id
  into existing_journal_id
  from public.finance_journals
  where source_module = 'finance_tax'
    and source_table = 'finance_tax_transactions'
    and source_id = tax_tx.id::text
  limit 1;

  if existing_journal_id is not null then
    update public.finance_tax_transactions
    set journal_id = existing_journal_id,
        updated_at = now()
    where id = tax_tx.id;

    return existing_journal_id;
  end if;

  if tax_tx.tax_amount <= 0 then
    raise exception 'Tax transaction % has no tax amount.', tax_tx.tax_transaction_no;
  end if;

  select *
  into tax_code
  from public.finance_tax_codes
  where id = tax_tx.tax_code_id;

  if tax_code.default_debit_account_id is null or tax_code.default_credit_account_id is null then
    raise exception 'Tax code % does not have default debit and credit accounts.', tax_code.tax_code;
  end if;

  journal_no := public.finance_generate_journal_no('TAX', current_date);

  insert into public.finance_journals (
    journal_no,
    journal_date,
    source_module,
    source_table,
    source_id,
    status,
    narration,
    created_by,
    created_by_name
  )
  values (
    journal_no,
    current_date,
    'finance_tax',
    'finance_tax_transactions',
    tax_tx.id::text,
    'draft',
    'Draft tax journal for ' || tax_tx.tax_transaction_no || ' - ' || tax_code.tax_name,
    p_created_by,
    p_created_by_name
  )
  returning id into new_journal_id;

  begin
    insert into public.finance_journal_lines (
      journal_id,
      line_no,
      account_id,
      debit,
      credit,
      description,
      entity_type,
      entity_id
    )
    values
      (
        new_journal_id,
        1,
        tax_code.default_debit_account_id,
        tax_tx.tax_amount,
        0,
        'Tax expense/accrual for ' || tax_tx.tax_transaction_no,
        'finance_tax_transaction',
        tax_tx.id::text
      ),
      (
        new_journal_id,
        2,
        tax_code.default_credit_account_id,
        0,
        tax_tx.tax_amount,
        'Tax liability for ' || tax_tx.tax_transaction_no,
        'finance_tax_transaction',
        tax_tx.id::text
      );

    perform public.finance_validate_balanced_journal(new_journal_id);
  exception
    when others then
      delete from public.finance_journals
      where id = new_journal_id
        and status = 'draft';

      raise;
  end;

  update public.finance_tax_transactions
  set journal_id = new_journal_id,
      updated_at = now()
  where id = tax_tx.id;

  return new_journal_id;
end;
$$;

create or replace view public.finance_vat_report_view as
select
  tx.id,
  tx.tax_transaction_no,
  tx.source_table,
  tx.source_id,
  tx.taxable_amount,
  tx.tax_rate,
  tx.tax_amount,
  tx.tax_authority,
  tx.due_date,
  tx.status,
  tx.payment_reference,
  tx.journal_id,
  tx.created_at
from public.finance_tax_transactions tx
join public.finance_tax_codes code on code.id = tx.tax_code_id
where code.tax_type = 'vat';

create or replace view public.finance_wht_report_view as
select
  tx.id,
  tx.tax_transaction_no,
  tx.source_table,
  tx.source_id,
  tx.taxable_amount,
  tx.tax_rate,
  tx.tax_amount,
  tx.tax_authority,
  tx.due_date,
  tx.status,
  tx.payment_reference,
  tx.journal_id,
  tx.created_at
from public.finance_tax_transactions tx
join public.finance_tax_codes code on code.id = tx.tax_code_id
where code.tax_type = 'withholding_tax';

create or replace view public.finance_paye_report_view as
select
  tx.id,
  tx.tax_transaction_no,
  tx.source_table,
  tx.source_id,
  tx.taxable_amount,
  tx.tax_rate,
  tx.tax_amount,
  tx.tax_authority,
  tx.due_date,
  tx.status,
  tx.payment_reference,
  tx.journal_id,
  tx.created_at
from public.finance_tax_transactions tx
join public.finance_tax_codes code on code.id = tx.tax_code_id
where code.tax_type = 'paye';

create or replace view public.finance_tax_liability_report_view as
select
  code.tax_type,
  code.tax_code,
  code.tax_name,
  tx.tax_authority,
  coalesce(sum(tx.taxable_amount), 0) as taxable_amount,
  coalesce(sum(tx.tax_amount), 0) as tax_amount,
  coalesce(sum(case when tx.status = 'paid' then tx.tax_amount else 0 end), 0) as paid_amount,
  coalesce(sum(case when tx.status <> 'paid' then tx.tax_amount else 0 end), 0) as outstanding_amount,
  min(tx.due_date) filter (where tx.status <> 'paid') as next_due_date
from public.finance_tax_codes code
left join public.finance_tax_transactions tx on tx.tax_code_id = code.id
group by code.tax_type, code.tax_code, code.tax_name, tx.tax_authority;
