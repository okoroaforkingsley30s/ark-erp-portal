-- Finance Batch 6: Accounts Receivable / Accounts Payable foundation proposal
-- Safe posture for live app:
-- - Additive only: no drops, no renames, no deletes.
-- - Does not modify old invoices, expenses, lpos, inventory, payroll, or tax data.
-- - Does not auto-post journals.

create extension if not exists pgcrypto;

create table if not exists public.finance_customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  phone text,
  billing_address text,
  credit_limit numeric(18, 2) not null default 0,
  payment_terms_days integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_email)
);

create table if not exists public.finance_suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  supplier_email text,
  phone text,
  billing_address text,
  payment_terms_days integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_email)
);

create table if not exists public.finance_receivable_allocations (
  id uuid primary key default gen_random_uuid(),
  invoice_id text not null,
  payment_source_table text,
  payment_source_id text,
  journal_id uuid references public.finance_journals(id),
  allocated_amount numeric(18, 2) not null check (allocated_amount > 0),
  allocated_at timestamptz not null default now(),
  allocated_by uuid,
  notes text,
  unique (invoice_id, payment_source_table, payment_source_id)
);

create table if not exists public.finance_payable_allocations (
  id uuid primary key default gen_random_uuid(),
  payable_source_table text not null,
  payable_source_id text not null,
  payment_source_table text,
  payment_source_id text,
  journal_id uuid references public.finance_journals(id),
  allocated_amount numeric(18, 2) not null check (allocated_amount > 0),
  allocated_at timestamptz not null default now(),
  allocated_by uuid,
  notes text,
  unique (payable_source_table, payable_source_id, payment_source_table, payment_source_id)
);

create index if not exists finance_customers_name_idx on public.finance_customers(customer_name);
create index if not exists finance_suppliers_name_idx on public.finance_suppliers(supplier_name);
create index if not exists finance_receivable_allocations_invoice_idx on public.finance_receivable_allocations(invoice_id);
create index if not exists finance_payable_allocations_source_idx on public.finance_payable_allocations(payable_source_table, payable_source_id);

create or replace view public.finance_ar_invoice_view as
select
  i.id::text as invoice_id,
  i.invoice_number,
  i.client_name as customer_name,
  i.client_email as customer_email,
  coalesce(i.amount, 0)::numeric(18, 2) as invoice_amount,
  coalesce(alloc.allocated_amount, 0)::numeric(18, 2) as allocated_amount,
  case
    when lower(coalesce(i.status, '')) in ('paid', 'cancelled') then 0
    else greatest(coalesce(i.amount, 0) - coalesce(alloc.allocated_amount, 0), 0)
  end::numeric(18, 2) as outstanding_amount,
  i.status,
  i.due_date,
  i.paid_date,
  i.created_at,
  case
    when lower(coalesce(i.status, '')) in ('paid', 'cancelled') then 0
    else greatest(current_date - coalesce(nullif(i.due_date::text, '')::date, i.created_at::date), 0)
  end as age_days
from public.invoices i
left join (
  select invoice_id, sum(allocated_amount) as allocated_amount
  from public.finance_receivable_allocations
  group by invoice_id
) alloc on alloc.invoice_id = i.id::text;

create or replace view public.finance_ar_ageing_view as
select
  customer_name,
  customer_email,
  sum(outstanding_amount) as balance,
  sum(case when age_days < 30 then outstanding_amount else 0 end) as current_amount,
  sum(case when age_days >= 30 and age_days < 60 then outstanding_amount else 0 end) as bucket_30,
  sum(case when age_days >= 60 and age_days < 90 then outstanding_amount else 0 end) as bucket_60,
  sum(case when age_days >= 90 and age_days < 120 then outstanding_amount else 0 end) as bucket_90,
  sum(case when age_days >= 120 then outstanding_amount else 0 end) as bucket_120_plus
from public.finance_ar_invoice_view
where outstanding_amount > 0
group by customer_name, customer_email;

create or replace view public.finance_ap_payable_view as
select
  'expenses'::text as source_table,
  e.id::text as source_id,
  e.expense_number as document_number,
  coalesce(e.staff_responsible, e.staff_email, 'Expense Payee') as supplier_name,
  e.staff_email as supplier_email,
  coalesce(e.amount, 0)::numeric(18, 2) as payable_amount,
  coalesce(alloc.allocated_amount, 0)::numeric(18, 2) as allocated_amount,
  greatest(coalesce(e.amount, 0) - coalesce(alloc.allocated_amount, 0), 0)::numeric(18, 2) as outstanding_amount,
  'provisional_unverified'::text as payment_verification_status,
  false as is_confirmed_outstanding,
  e.approval_status as status,
  nullif(e.expense_date::text, '')::date as document_date,
  coalesce(nullif(e.approved_date::text, '')::date, nullif(e.expense_date::text, '')::date, e.created_at::date) as due_date,
  greatest(current_date - coalesce(nullif(e.approved_date::text, '')::date, nullif(e.expense_date::text, '')::date, e.created_at::date), 0) as age_days
from public.expenses e
left join (
  select payable_source_table, payable_source_id, sum(allocated_amount) as allocated_amount
  from public.finance_payable_allocations
  group by payable_source_table, payable_source_id
) alloc on alloc.payable_source_table = 'expenses' and alloc.payable_source_id = e.id::text
where lower(coalesce(e.approval_status, '')) = 'approved'
  and coalesce(nullif(e.payment_method, ''), '') = ''

union all

select
  'lpos'::text as source_table,
  l.id::text as source_id,
  l.lpo_number as document_number,
  coalesce(l.supplier_name, 'Supplier') as supplier_name,
  null::text as supplier_email,
  coalesce(l.total_amount_ngn, 0)::numeric(18, 2) as payable_amount,
  coalesce(alloc.allocated_amount, 0)::numeric(18, 2) as allocated_amount,
  greatest(coalesce(l.total_amount_ngn, 0) - coalesce(alloc.allocated_amount, 0), 0)::numeric(18, 2) as outstanding_amount,
  'confirmed_outstanding'::text as payment_verification_status,
  true as is_confirmed_outstanding,
  l.status,
  l.created_at::date as document_date,
  l.updated_at::date as due_date,
  greatest(current_date - coalesce(l.updated_at::date, l.created_at::date), 0) as age_days
from public.lpos l
left join (
  select payable_source_table, payable_source_id, sum(allocated_amount) as allocated_amount
  from public.finance_payable_allocations
  group by payable_source_table, payable_source_id
) alloc on alloc.payable_source_table = 'lpos' and alloc.payable_source_id = l.id::text
where l.status = 'Pending Account Release';

create or replace view public.finance_ap_ageing_view as
select
  supplier_name,
  supplier_email,
  sum(outstanding_amount) as balance,
  sum(case when age_days < 30 then outstanding_amount else 0 end) as current_amount,
  sum(case when age_days >= 30 and age_days < 60 then outstanding_amount else 0 end) as bucket_30,
  sum(case when age_days >= 60 and age_days < 90 then outstanding_amount else 0 end) as bucket_60,
  sum(case when age_days >= 90 and age_days < 120 then outstanding_amount else 0 end) as bucket_90,
  sum(case when age_days >= 120 then outstanding_amount else 0 end) as bucket_120_plus
from public.finance_ap_payable_view
where outstanding_amount > 0
  and is_confirmed_outstanding = true
group by supplier_name, supplier_email;
