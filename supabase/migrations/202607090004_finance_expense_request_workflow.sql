-- Finance Batch 6.2: Expense request and controlled expense recognition
-- Safe posture for live app:
-- - Additive only: no drops, no renames, no deletes, no data rewrites.
-- - Historical public.expenses records remain valid and unmodified.
-- - Journals created from this workflow remain draft and use existing posting workflow.

create extension if not exists pgcrypto;

create sequence if not exists public.finance_expense_request_no_seq start with 1 increment by 1;
create sequence if not exists public.finance_expense_payment_no_seq start with 1 increment by 1;

create or replace function public.finance_generate_expense_request_no(
  p_request_date date default current_date
)
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.finance_expense_request_no_seq');
  return 'ER-' || to_char(coalesce(p_request_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.finance_generate_expense_payment_no(
  p_payment_date date default current_date
)
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.finance_expense_payment_no_seq');
  return 'EP-' || to_char(coalesce(p_payment_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 4, '0');
end;
$$;

create table if not exists public.finance_expense_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  requester_user_id uuid,
  requester_email text,
  requester_name text,
  department text,
  expense_category text,
  purpose text not null,
  description text,
  supplier_name text,
  supplier_email text,
  beneficiary_name text,
  amount_requested numeric(18, 2) not null default 0 check (amount_requested >= 0),
  amount_approved numeric(18, 2) not null default 0 check (amount_approved >= 0),
  amount_paid numeric(18, 2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'NGN',
  required_date date,
  status text not null default 'draft' check (
    status in (
      'draft',
      'submitted',
      'pending_approval',
      'approved',
      'rejected',
      'returned_for_correction',
      'pending_finance_review',
      'approved_for_payment',
      'partially_paid',
      'paid',
      'cancelled'
    )
  ),
  payment_status text not null default 'unpaid' check (
    payment_status in ('unpaid', 'partially_paid', 'paid', 'cancelled')
  ),
  current_approval_stage text not null default 'requester',
  next_approver_role text,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  returned_at timestamptz,
  finance_reviewed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  legacy_exception boolean not null default false,
  legacy_exception_reason text,
  exception_type text,
  resulting_expense_id text,
  resulting_journal_id uuid references public.finance_journals(id),
  constraint finance_expense_requests_paid_check check (amount_paid <= greatest(amount_approved, amount_requested))
);

create table if not exists public.finance_expense_request_approvals (
  id uuid primary key default gen_random_uuid(),
  expense_request_id uuid not null references public.finance_expense_requests(id) on delete cascade,
  approval_stage text not null,
  approver_role text,
  approver_user_id uuid,
  approver_email text,
  approver_name text,
  decision text not null check (decision in ('submitted', 'approved', 'rejected', 'returned_for_correction', 'cancelled', 'finance_reviewed', 'approved_for_payment')),
  comments text,
  previous_status text,
  new_status text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_expense_request_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_request_id uuid not null references public.finance_expense_requests(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid,
  uploaded_by_email text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.finance_expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_request_id uuid not null references public.finance_expense_requests(id) on delete cascade,
  payment_number text not null unique,
  amount_paid numeric(18, 2) not null check (amount_paid > 0),
  payment_method text not null,
  payment_reference text,
  bank_account_id uuid references public.finance_bank_accounts(id),
  payment_date date not null default current_date,
  payment_status text not null default 'paid' check (payment_status in ('draft', 'paid', 'voided')),
  paid_by uuid,
  paid_by_email text,
  paid_by_name text,
  notes text,
  journal_id uuid references public.finance_journals(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_expense_request_history (
  id uuid primary key default gen_random_uuid(),
  expense_request_id uuid not null references public.finance_expense_requests(id) on delete cascade,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  action text not null,
  previous_status text,
  new_status text,
  comments text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.expenses
  add column if not exists expense_request_id uuid references public.finance_expense_requests(id),
  add column if not exists expense_source_type text not null default 'legacy_manual',
  add column if not exists controlled_exception_type text,
  add column if not exists controlled_exception_reason text;

create index if not exists finance_expense_requests_requester_idx on public.finance_expense_requests(requester_email);
create index if not exists finance_expense_requests_status_idx on public.finance_expense_requests(status, payment_status);
create index if not exists finance_expense_requests_department_idx on public.finance_expense_requests(department);
create index if not exists finance_expense_request_approvals_request_idx on public.finance_expense_request_approvals(expense_request_id);
create index if not exists finance_expense_request_attachments_request_idx on public.finance_expense_request_attachments(expense_request_id);
create index if not exists finance_expense_payments_request_idx on public.finance_expense_payments(expense_request_id);
create index if not exists finance_expense_payments_journal_idx on public.finance_expense_payments(journal_id);
create index if not exists finance_expense_request_history_request_idx on public.finance_expense_request_history(expense_request_id);
create index if not exists expenses_expense_request_idx on public.expenses(expense_request_id);

create or replace function public.finance_expense_request_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists finance_expense_requests_touch_updated_at on public.finance_expense_requests;
create trigger finance_expense_requests_touch_updated_at
before update on public.finance_expense_requests
for each row execute function public.finance_expense_request_touch_updated_at();

create or replace function public.finance_current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.finance_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((
    select up.role
    from public.user_profiles up
    where lower(up.user_email) = lower(coalesce((
      select u.email
      from public.users u
      where u.id = auth.uid()
      limit 1
    ), auth.jwt() ->> 'email', ''))
    limit 1
  ), ''));
$$;

create or replace function public.finance_is_privileged_expense_role()
returns boolean
language sql
stable
as $$
  select public.finance_current_user_role() in (
    'system_admin',
    'admin',
    'ceo',
    'agm',
    'finance',
    'finance_manager',
    'head_of_account',
    'account',
    'accounts',
    'accountant'
  );
$$;

create or replace function public.finance_is_expense_approver_role()
returns boolean
language sql
stable
as $$
  select public.finance_current_user_role() in (
    'system_admin',
    'admin',
    'ceo',
    'agm',
    'manager',
    'operations',
    'operational_manager',
    'hr',
    'finance',
    'finance_manager',
    'head_of_account'
  );
$$;

create or replace function public.finance_sync_expense_request_payment_totals()
returns trigger
language plpgsql
as $$
declare
  target_request_id uuid;
  target_request_ids uuid[];
  paid_total numeric(18, 2);
  approved_total numeric(18, 2);
  current_status text;
  next_payment_status text;
  next_request_status text;
  next_paid_at timestamptz;
begin
  if tg_op = 'INSERT' then
    target_request_ids := array[new.expense_request_id];
  elsif tg_op = 'UPDATE' then
    target_request_ids := array[old.expense_request_id, new.expense_request_id];
  else
    target_request_ids := array[old.expense_request_id];
  end if;

  for target_request_id in
    select distinct request_id
    from unnest(target_request_ids) as t(request_id)
    where request_id is not null
  loop
    select
      coalesce(sum(p.amount_paid), 0)::numeric(18, 2)
    into paid_total
    from public.finance_expense_payments p
    where p.expense_request_id = target_request_id
      and p.payment_status = 'paid';

    select
      coalesce(r.amount_approved, 0)::numeric(18, 2),
      r.status,
      r.paid_at
    into approved_total, current_status, next_paid_at
    from public.finance_expense_requests r
    where r.id = target_request_id
    for update;

    if not found then
      continue;
    end if;

    if paid_total > 0 and approved_total <= 0 then
      raise exception 'Expense request % has payments but no approved amount.', target_request_id;
    end if;

    if round(paid_total, 2) > round(approved_total, 2) then
      raise exception
        'Expense request % payments exceed approved amount. Paid %, Approved %.',
        target_request_id,
        paid_total,
        approved_total;
    end if;

    if paid_total = 0 then
      next_payment_status := 'unpaid';
      if current_status in ('partially_paid', 'paid') then
        next_request_status := 'approved_for_payment';
      else
        next_request_status := current_status;
      end if;
      next_paid_at := null;
    elsif round(paid_total, 2) < round(approved_total, 2) then
      next_payment_status := 'partially_paid';
      if current_status in ('approved_for_payment', 'partially_paid', 'paid') then
        next_request_status := 'partially_paid';
      else
        next_request_status := current_status;
      end if;
      next_paid_at := null;
    else
      next_payment_status := 'paid';
      if current_status in ('approved_for_payment', 'partially_paid', 'paid') then
        next_request_status := 'paid';
      else
        next_request_status := current_status;
      end if;
      next_paid_at := coalesce(next_paid_at, now());
    end if;

    update public.finance_expense_requests
    set
      amount_paid = paid_total,
      payment_status = next_payment_status,
      status = next_request_status,
      paid_at = next_paid_at,
      updated_at = now()
    where id = target_request_id;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists finance_expense_payments_sync_request_totals on public.finance_expense_payments;
create trigger finance_expense_payments_sync_request_totals
after insert or update or delete on public.finance_expense_payments
for each row execute function public.finance_sync_expense_request_payment_totals();

alter table public.finance_expense_requests enable row level security;
alter table public.finance_expense_request_approvals enable row level security;
alter table public.finance_expense_request_attachments enable row level security;
alter table public.finance_expense_payments enable row level security;
alter table public.finance_expense_request_history enable row level security;

drop policy if exists finance_expense_requests_select on public.finance_expense_requests;
create policy finance_expense_requests_select on public.finance_expense_requests
for select to authenticated
using (
  lower(coalesce(requester_email, '')) = public.finance_current_user_email()
  or public.finance_is_expense_approver_role()
  or public.finance_is_privileged_expense_role()
);

drop policy if exists finance_expense_requests_insert on public.finance_expense_requests;
create policy finance_expense_requests_insert on public.finance_expense_requests
for insert to authenticated
with check (
  lower(coalesce(requester_email, '')) = public.finance_current_user_email()
  or public.finance_is_privileged_expense_role()
);

drop policy if exists finance_expense_requests_update on public.finance_expense_requests;
create policy finance_expense_requests_update on public.finance_expense_requests
for update to authenticated
using (
  public.finance_is_privileged_expense_role()
  or public.finance_is_expense_approver_role()
  or (
    lower(coalesce(requester_email, '')) = public.finance_current_user_email()
    and status in ('draft', 'returned_for_correction')
  )
)
with check (
  public.finance_is_privileged_expense_role()
  or public.finance_is_expense_approver_role()
  or (
    lower(coalesce(requester_email, '')) = public.finance_current_user_email()
    and status in ('draft', 'submitted', 'pending_approval')
  )
);

drop policy if exists finance_expense_approvals_select on public.finance_expense_request_approvals;
create policy finance_expense_approvals_select on public.finance_expense_request_approvals
for select to authenticated
using (
  exists (
    select 1 from public.finance_expense_requests r
    where r.id = expense_request_id
      and (
        lower(coalesce(r.requester_email, '')) = public.finance_current_user_email()
        or public.finance_is_expense_approver_role()
        or public.finance_is_privileged_expense_role()
      )
  )
);

drop policy if exists finance_expense_approvals_insert on public.finance_expense_request_approvals;
create policy finance_expense_approvals_insert on public.finance_expense_request_approvals
for insert to authenticated
with check (public.finance_is_expense_approver_role() or public.finance_is_privileged_expense_role());

drop policy if exists finance_expense_attachments_select on public.finance_expense_request_attachments;
create policy finance_expense_attachments_select on public.finance_expense_request_attachments
for select to authenticated
using (
  exists (
    select 1 from public.finance_expense_requests r
    where r.id = expense_request_id
      and (
        lower(coalesce(r.requester_email, '')) = public.finance_current_user_email()
        or public.finance_is_expense_approver_role()
        or public.finance_is_privileged_expense_role()
      )
  )
);

drop policy if exists finance_expense_attachments_insert on public.finance_expense_request_attachments;
create policy finance_expense_attachments_insert on public.finance_expense_request_attachments
for insert to authenticated
with check (
  exists (
    select 1 from public.finance_expense_requests r
    where r.id = expense_request_id
      and (
        lower(coalesce(r.requester_email, '')) = public.finance_current_user_email()
        or public.finance_is_privileged_expense_role()
      )
  )
);

drop policy if exists finance_expense_payments_select on public.finance_expense_payments;
create policy finance_expense_payments_select on public.finance_expense_payments
for select to authenticated
using (
  exists (
    select 1 from public.finance_expense_requests r
    where r.id = expense_request_id
      and (
        lower(coalesce(r.requester_email, '')) = public.finance_current_user_email()
        or public.finance_is_expense_approver_role()
        or public.finance_is_privileged_expense_role()
      )
  )
);

drop policy if exists finance_expense_payments_insert on public.finance_expense_payments;
create policy finance_expense_payments_insert on public.finance_expense_payments
for insert to authenticated
with check (public.finance_is_privileged_expense_role());

drop policy if exists finance_expense_history_select on public.finance_expense_request_history;
create policy finance_expense_history_select on public.finance_expense_request_history
for select to authenticated
using (
  exists (
    select 1 from public.finance_expense_requests r
    where r.id = expense_request_id
      and (
        lower(coalesce(r.requester_email, '')) = public.finance_current_user_email()
        or public.finance_is_expense_approver_role()
        or public.finance_is_privileged_expense_role()
      )
  )
);

drop policy if exists finance_expense_history_insert on public.finance_expense_request_history;
create policy finance_expense_history_insert on public.finance_expense_request_history
for insert to authenticated
with check (
  public.finance_is_expense_approver_role()
  or public.finance_is_privileged_expense_role()
  or exists (
    select 1 from public.finance_expense_requests r
    where r.id = expense_request_id
      and lower(coalesce(r.requester_email, '')) = public.finance_current_user_email()
  )
);
