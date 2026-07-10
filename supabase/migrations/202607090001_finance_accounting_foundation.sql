-- Finance / Accounts v2 foundation proposal
-- Safe posture for live app:
-- - Additive only: no drops, no renames, no deletes.
-- - Does not enable or change RLS policies.
-- - Does not modify existing finance/invoice/expense/inventory tables.
-- - Seed data uses ON CONFLICT DO NOTHING.

create extension if not exists pgcrypto;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  account_name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_account_id uuid references public.finance_accounts(id),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.finance_accounts(id),
  bank_name text not null,
  account_name text not null,
  account_number text,
  currency text not null default 'NGN',
  opening_balance numeric(18, 2) not null default 0,
  current_balance numeric(18, 2) not null default 0,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_journals (
  id uuid primary key default gen_random_uuid(),
  journal_no text not null unique,
  journal_date date not null default current_date,
  source_module text,
  source_table text,
  source_id text,
  status text not null default 'draft' check (
    status in ('draft', 'pending_review', 'approved', 'posted', 'rejected', 'reversed')
  ),
  narration text not null,
  rejection_reason text,
  reversal_of uuid references public.finance_journals(id),
  created_by uuid,
  created_by_name text,
  reviewed_by uuid,
  reviewed_by_name text,
  approved_by uuid,
  approved_by_name text,
  posted_by uuid,
  posted_by_name text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.finance_journals(id) on delete cascade,
  line_no integer not null default 1,
  account_id uuid not null references public.finance_accounts(id),
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  description text,
  department text,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now(),
  constraint finance_journal_lines_one_side_check check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  ),
  constraint finance_journal_lines_unique_line unique (journal_id, line_no)
);

create table if not exists public.finance_account_balances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.finance_accounts(id),
  period_start date not null,
  period_end date not null,
  opening_balance numeric(18, 2) not null default 0,
  debit_total numeric(18, 2) not null default 0,
  credit_total numeric(18, 2) not null default 0,
  closing_balance numeric(18, 2) not null default 0,
  calculated_at timestamptz not null default now(),
  unique (account_id, period_start, period_end)
);

create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  account_id uuid references public.finance_accounts(id),
  period_start date not null,
  period_end date not null,
  budget_amount numeric(18, 2) not null default 0,
  spent_amount numeric(18, 2) not null default 0,
  pending_amount numeric(18, 2) not null default 0,
  status text not null default 'draft' check (
    status in ('draft', 'pending_review', 'approved', 'closed', 'rejected')
  ),
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text not null unique,
  payment_type text not null check (
    payment_type in (
      'purchase_order',
      'vendor_invoice',
      'staff_reimbursement',
      'loan_disbursement',
      'loan_repayment',
      'salary',
      'expense',
      'income',
      'transfer',
      'other'
    )
  ),
  source_table text,
  source_id text,
  payee_name text,
  payer_name text,
  amount numeric(18, 2) not null check (amount >= 0),
  currency text not null default 'NGN',
  bank_account_id uuid references public.finance_bank_accounts(id),
  journal_id uuid references public.finance_journals(id),
  status text not null default 'draft' check (
    status in ('draft', 'pending_review', 'approved', 'paid', 'posted', 'rejected', 'cancelled')
  ),
  narration text,
  created_by uuid,
  approved_by uuid,
  paid_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.finance_bank_accounts(id),
  statement_start date not null,
  statement_end date not null,
  opening_balance numeric(18, 2) not null default 0,
  closing_balance numeric(18, 2) not null default 0,
  reconciled_balance numeric(18, 2) not null default 0,
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'reconciled', 'rejected')
  ),
  notes text,
  created_by uuid,
  reviewed_by uuid,
  reconciled_by uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reconciled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (bank_account_id, statement_start, statement_end)
);

create table if not exists public.finance_fixed_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  asset_name text not null,
  asset_type text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(18, 2) not null default 0,
  account_id uuid references public.finance_accounts(id),
  assigned_department text,
  assigned_employee_id text,
  assigned_employee_name text,
  current_location text,
  warranty_expiry date,
  depreciation_method text not null default 'straight_line',
  depreciation_rate numeric(7, 4) not null default 0,
  accumulated_depreciation numeric(18, 2) not null default 0,
  current_book_value numeric(18, 2) not null default 0,
  status text not null default 'active' check (
    status in ('active', 'assigned', 'under_repair', 'disposed', 'lost', 'retired')
  ),
  disposal_date date,
  disposal_value numeric(18, 2),
  disposal_notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_corrections (
  id uuid primary key default gen_random_uuid(),
  correction_no text not null unique,
  source_table text not null,
  source_id text not null,
  correction_type text not null check (
    correction_type in ('reversal', 'adjustment', 'metadata_correction')
  ),
  reason text not null,
  previous_value jsonb,
  requested_value jsonb,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'approved', 'rejected', 'posted')
  ),
  adjustment_journal_id uuid references public.finance_journals(id),
  requested_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  posted_by uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id text not null,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_by_name text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists finance_accounts_type_idx on public.finance_accounts(account_type);
create index if not exists finance_accounts_parent_idx on public.finance_accounts(parent_account_id);
create index if not exists finance_bank_accounts_account_idx on public.finance_bank_accounts(account_id);
create index if not exists finance_journals_status_idx on public.finance_journals(status);
create index if not exists finance_journals_date_idx on public.finance_journals(journal_date);
create index if not exists finance_journals_source_idx on public.finance_journals(source_module, source_table, source_id);
create index if not exists finance_journal_lines_journal_idx on public.finance_journal_lines(journal_id);
create index if not exists finance_journal_lines_account_idx on public.finance_journal_lines(account_id);
create index if not exists finance_budgets_department_idx on public.finance_budgets(department);
create index if not exists finance_payments_status_idx on public.finance_payments(status);
create index if not exists finance_payments_source_idx on public.finance_payments(source_table, source_id);
create index if not exists finance_fixed_assets_status_idx on public.finance_fixed_assets(status);
create index if not exists finance_fixed_assets_department_idx on public.finance_fixed_assets(assigned_department);
create index if not exists finance_corrections_source_idx on public.finance_corrections(source_table, source_id);
create index if not exists finance_audit_logs_entity_idx on public.finance_audit_logs(entity_table, entity_id);
create index if not exists finance_audit_logs_created_at_idx on public.finance_audit_logs(created_at);

create sequence if not exists public.finance_journal_no_seq start with 1 increment by 1;

create or replace function public.finance_generate_journal_no(
  p_prefix text default 'JV',
  p_journal_date date default current_date
)
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.finance_journal_no_seq');
  return upper(coalesce(nullif(trim(p_prefix), ''), 'JV'))
    || '-'
    || to_char(coalesce(p_journal_date, current_date), 'YYYYMMDD')
    || '-'
    || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.finance_get_journal_totals(p_journal_id uuid)
returns table (
  debit_total numeric,
  credit_total numeric,
  line_count bigint,
  is_balanced boolean
)
language sql
stable
as $$
  select
    coalesce(sum(debit), 0)::numeric as debit_total,
    coalesce(sum(credit), 0)::numeric as credit_total,
    count(*)::bigint as line_count,
    (
      count(*) >= 2
      and round(coalesce(sum(debit), 0)::numeric, 2) = round(coalesce(sum(credit), 0)::numeric, 2)
      and round(coalesce(sum(debit), 0)::numeric, 2) > 0
    ) as is_balanced
  from public.finance_journal_lines
  where journal_id = p_journal_id;
$$;

create or replace function public.finance_validate_balanced_journal(p_journal_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  totals record;
begin
  select * into totals
  from public.finance_get_journal_totals(p_journal_id);

  if coalesce(totals.is_balanced, false) is not true then
    raise exception
      'Journal % is not balanced. Debit %, Credit %, Lines %',
      p_journal_id,
      coalesce(totals.debit_total, 0),
      coalesce(totals.credit_total, 0),
      coalesce(totals.line_count, 0);
  end if;

  return true;
end;
$$;

create or replace function public.finance_guard_journal_posting()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'posted' then
    raise exception 'Posted journal % cannot be edited directly. Use a reversal or adjustment journal.', old.journal_no;
  end if;

  if tg_op = 'DELETE' and old.status = 'posted' then
    raise exception 'Posted journal % cannot be deleted. Use a reversal or adjustment journal.', old.journal_no;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.status = 'posted' then
    perform public.finance_validate_balanced_journal(new.id);
    new.posted_at := coalesce(new.posted_at, now());
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.finance_guard_posted_journal_lines()
returns trigger
language plpgsql
as $$
declare
  journal_status text;
  journal_no text;
  target_journal_id uuid;
begin
  target_journal_id := case when tg_op = 'DELETE' then old.journal_id else new.journal_id end;

  select status, journal_no
  into journal_status, journal_no
  from public.finance_journals
  where id = target_journal_id;

  if journal_status = 'posted' then
    raise exception 'Posted journal % lines cannot be edited directly. Use a reversal or adjustment journal.', journal_no;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.finance_create_reversal_journal(
  p_original_journal_id uuid,
  p_created_by uuid default null,
  p_created_by_name text default null,
  p_narration text default null
)
returns uuid
language plpgsql
as $$
declare
  original_journal public.finance_journals%rowtype;
  reversal_id uuid;
begin
  select *
  into original_journal
  from public.finance_journals
  where id = p_original_journal_id;

  if original_journal.id is null then
    raise exception 'Original journal % was not found.', p_original_journal_id;
  end if;

  if original_journal.status <> 'posted' then
    raise exception 'Only posted journals can be reversed. Journal % status is %.', original_journal.journal_no, original_journal.status;
  end if;

  insert into public.finance_journals (
    journal_no,
    journal_date,
    source_module,
    source_table,
    source_id,
    status,
    narration,
    reversal_of,
    created_by,
    created_by_name
  )
  values (
    public.finance_generate_journal_no('REV', current_date),
    current_date,
    original_journal.source_module,
    original_journal.source_table,
    original_journal.source_id,
    'draft',
    coalesce(p_narration, 'Reversal for journal ' || original_journal.journal_no),
    original_journal.id,
    p_created_by,
    p_created_by_name
  )
  returning id into reversal_id;

  insert into public.finance_journal_lines (
    journal_id,
    line_no,
    account_id,
    debit,
    credit,
    description,
    department,
    entity_type,
    entity_id
  )
  select
    reversal_id,
    line_no,
    account_id,
    credit,
    debit,
    coalesce(description, 'Reversal') || ' (reversal)',
    department,
    entity_type,
    entity_id
  from public.finance_journal_lines
  where journal_id = original_journal.id
  order by line_no;

  perform public.finance_validate_balanced_journal(reversal_id);

  return reversal_id;
end;
$$;

drop trigger if exists finance_journals_guard_posting on public.finance_journals;

create trigger finance_journals_guard_posting
before insert or update or delete on public.finance_journals
for each row execute function public.finance_guard_journal_posting();

drop trigger if exists finance_journal_lines_guard_posted on public.finance_journal_lines;

create trigger finance_journal_lines_guard_posted
before insert or update or delete on public.finance_journal_lines
for each row execute function public.finance_guard_posted_journal_lines();

insert into public.finance_accounts (account_code, account_name, account_type, normal_balance, description)
values
  ('1000', 'Assets', 'asset', 'debit', 'Root asset account'),
  ('1010', 'Cash', 'asset', 'debit', 'Cash on hand'),
  ('1020', 'Bank', 'asset', 'debit', 'Bank balances'),
  ('1030', 'Inventory', 'asset', 'debit', 'Inventory asset'),
  ('1040', 'Accounts Receivable', 'asset', 'debit', 'Customer receivables'),
  ('1050', 'Fixed Assets', 'asset', 'debit', 'Equipment and other fixed assets'),
  ('2000', 'Liabilities', 'liability', 'credit', 'Root liability account'),
  ('2010', 'Accounts Payable', 'liability', 'credit', 'Vendor payables'),
  ('2020', 'Loans Payable', 'liability', 'credit', 'Outstanding loans'),
  ('3000', 'Equity', 'equity', 'credit', 'Root equity account'),
  ('3010', 'Capital', 'equity', 'credit', 'Owner or shareholder capital'),
  ('3020', 'Retained Earnings', 'equity', 'credit', 'Retained earnings'),
  ('4000', 'Income', 'income', 'credit', 'Root income account'),
  ('4010', 'Service Revenue', 'income', 'credit', 'Service income'),
  ('4020', 'Product Sales', 'income', 'credit', 'Product sales income'),
  ('5000', 'Expenses', 'expense', 'debit', 'Root expense account'),
  ('5010', 'Salary Expense', 'expense', 'debit', 'Salary payments'),
  ('5020', 'Fuel Expense', 'expense', 'debit', 'Fuel costs'),
  ('5030', 'Repairs Expense', 'expense', 'debit', 'Repair costs'),
  ('5040', 'Electricity Expense', 'expense', 'debit', 'Electricity costs'),
  ('5050', 'Rent Expense', 'expense', 'debit', 'Rent costs'),
  ('5060', 'Office Expenses', 'expense', 'debit', 'Office running costs'),
  ('5070', 'Cost of Repair', 'expense', 'debit', 'Repair fulfillment cost'),
  ('5080', 'Cost of Goods Sold', 'expense', 'debit', 'Product cost of sales')
on conflict (account_code) do nothing;

update public.finance_accounts child
set parent_account_id = parent.id
from public.finance_accounts parent
where child.parent_account_id is null
  and (
    (child.account_code in ('1010', '1020', '1030', '1040', '1050') and parent.account_code = '1000')
    or (child.account_code in ('2010', '2020') and parent.account_code = '2000')
    or (child.account_code in ('3010', '3020') and parent.account_code = '3000')
    or (child.account_code in ('4010', '4020') and parent.account_code = '4000')
    or (child.account_code in ('5010', '5020', '5030', '5040', '5050', '5060', '5070', '5080') and parent.account_code = '5000')
  );

create or replace view public.finance_general_ledger_view as
select
  j.id as journal_id,
  j.journal_no,
  j.journal_date,
  j.status,
  j.source_module,
  j.source_table,
  j.source_id,
  j.narration,
  l.id as line_id,
  l.line_no,
  a.id as account_id,
  a.account_code,
  a.account_name,
  a.account_type,
  a.normal_balance,
  l.debit,
  l.credit,
  l.department,
  l.entity_type,
  l.entity_id,
  j.created_by,
  j.created_by_name,
  j.approved_by,
  j.approved_by_name,
  j.posted_by,
  j.posted_by_name,
  j.created_at,
  j.approved_at,
  j.posted_at
from public.finance_journals j
join public.finance_journal_lines l on l.journal_id = j.id
join public.finance_accounts a on a.id = l.account_id;

create or replace view public.finance_account_statement_view as
select
  gl.*,
  sum(
    case
      when gl.normal_balance = 'credit' then gl.credit - gl.debit
      else gl.debit - gl.credit
    end
  ) over (
    partition by gl.account_id
    order by gl.journal_date, gl.created_at, gl.journal_no, gl.line_no, gl.line_id
    rows between unbounded preceding and current row
  ) as running_balance
from public.finance_general_ledger_view gl
where gl.status = 'posted';

create or replace view public.finance_trial_balance_view as
select
  a.id as account_id,
  a.account_code,
  a.account_name,
  a.account_type,
  a.normal_balance,
  coalesce(sum(case when j.status = 'posted' then l.debit else 0 end), 0) as debit_total,
  coalesce(sum(case when j.status = 'posted' then l.credit else 0 end), 0) as credit_total,
  case
    when a.normal_balance = 'debit' then coalesce(sum(case when j.status = 'posted' then l.debit - l.credit else 0 end), 0)
    else coalesce(sum(case when j.status = 'posted' then l.credit - l.debit else 0 end), 0)
  end as balance
from public.finance_accounts a
left join public.finance_journal_lines l on l.account_id = a.id
left join public.finance_journals j on j.id = l.journal_id
group by a.id, a.account_code, a.account_name, a.account_type, a.normal_balance;

create or replace function public.finance_calculate_account_statement(
  p_account_id uuid,
  p_from_date date default null,
  p_to_date date default null
)
returns setof public.finance_account_statement_view
language sql
stable
as $$
  select *
  from public.finance_account_statement_view
  where account_id = p_account_id
    and (p_from_date is null or journal_date >= p_from_date)
    and (p_to_date is null or journal_date <= p_to_date)
  order by journal_date, created_at, journal_no, line_no, line_id;
$$;

create or replace function public.finance_calculate_trial_balance(
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  normal_balance text,
  debit_total numeric,
  credit_total numeric,
  balance numeric
)
language sql
stable
as $$
  select
    a.id as account_id,
    a.account_code,
    a.account_name,
    a.account_type,
    a.normal_balance,
    coalesce(sum(case when j.status = 'posted' then l.debit else 0 end), 0) as debit_total,
    coalesce(sum(case when j.status = 'posted' then l.credit else 0 end), 0) as credit_total,
    case
      when a.normal_balance = 'debit' then coalesce(sum(case when j.status = 'posted' then l.debit - l.credit else 0 end), 0)
      else coalesce(sum(case when j.status = 'posted' then l.credit - l.debit else 0 end), 0)
    end as balance
  from public.finance_accounts a
  left join public.finance_journal_lines l on l.account_id = a.id
  left join public.finance_journals j on j.id = l.journal_id
    and (p_from_date is null or j.journal_date >= p_from_date)
    and (p_to_date is null or j.journal_date <= p_to_date)
  group by a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
  order by a.account_code;
$$;
