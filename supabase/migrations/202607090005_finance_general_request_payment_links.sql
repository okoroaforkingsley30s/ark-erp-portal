-- Finance v1.0 finalization: General Request payment linkage
-- Safe posture for live app:
-- - Additive only: no drops, no renames, no deletes.
-- - Does not rewrite historical expenses.
-- - Does not create a unique index on finance_payments(source_table, source_id)
--   because General Requests must support partial payments.
-- - Keeps duplicate protection at payment_no, generated expense source link,
--   per-payment journal linkage, and cumulative paid amount validation.

create extension if not exists pgcrypto;

create sequence if not exists public.finance_payment_no_seq start with 1 increment by 1;

create or replace function public.finance_generate_payment_no(
  p_prefix text default 'PAY',
  p_payment_date date default current_date
)
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.finance_payment_no_seq');
  return upper(coalesce(nullif(trim(p_prefix), ''), 'PAY'))
    || '-'
    || to_char(coalesce(p_payment_date, current_date), 'YYYYMMDD')
    || '-'
    || lpad(next_number::text, 5, '0');
end;
$$;

alter table public.expenses
  add column if not exists source_table text,
  add column if not exists source_id text,
  add column if not exists source_document_number text,
  add column if not exists finance_payment_id uuid references public.finance_payments(id);

create index if not exists expenses_source_link_idx
  on public.expenses(source_table, source_id);

create index if not exists expenses_finance_payment_idx
  on public.expenses(finance_payment_id);

create unique index if not exists expenses_generated_source_unique_idx
  on public.expenses(source_table, source_id)
  where source_table is not null
    and source_id is not null
    and expense_source_type = 'request_generated';

create unique index if not exists finance_journals_payment_source_unique_idx
  on public.finance_journals(source_table, source_id)
  where source_table = 'finance_payments'
    and source_id is not null;

create or replace function public.finance_get_account_id_by_codes(p_codes text[])
returns uuid
language plpgsql
stable
as $$
declare
  account_id uuid;
begin
  select fa.id
  into account_id
  from unnest(p_codes) with ordinality as wanted(account_code, sort_order)
  join public.finance_accounts fa
    on fa.account_code = wanted.account_code
   and fa.is_active = true
  order by wanted.sort_order
  limit 1;

  return account_id;
end;
$$;

create or replace function public.finance_general_request_expense_account_codes(
  p_request_type text,
  p_request_subtype text,
  p_purpose text
)
returns text[]
language plpgsql
immutable
as $$
declare
  search_text text;
begin
  search_text := lower(coalesce(p_request_type, '') || ' ' || coalesce(p_request_subtype, '') || ' ' || coalesce(p_purpose, ''));

  if search_text like '%salary%' or search_text like '%payroll%' then
    return array['5010', '5060'];
  elsif search_text like '%fuel%' then
    return array['5020', '5060'];
  elsif search_text like '%repair%' or search_text like '%maintenance%' then
    return array['5030', '5070', '5060'];
  elsif search_text like '%electric%' or search_text like '%utility%' then
    return array['5040', '5060'];
  elsif search_text like '%rent%' then
    return array['5050', '5060'];
  elsif search_text like '%part%' or search_text like '%procurement%' or search_text like '%inventory%' then
    return array['5080', '5060'];
  end if;

  return array['5060'];
end;
$$;

create or replace function public.finance_record_general_request_payment(
  p_fund_request_id uuid,
  p_amount numeric default null,
  p_payment_date date default current_date,
  p_payment_method text default 'Account Release',
  p_payment_reference text default null,
  p_actor_id uuid default auth.uid(),
  p_actor_name text default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
as $$
declare
  request_row public.fund_requests%rowtype;
  request_category text;
  approved_amount numeric(18, 2);
  payment_amount numeric(18, 2);
  paid_total numeric(18, 2);
  next_paid_total numeric(18, 2);
  next_finance_status text;
  next_status text;
  payment_no_value text;
  payment_id uuid;
  expense_id uuid;
  new_journal_id uuid;
  journal_no_value text;
  debit_account_id uuid;
  credit_account_id uuid;
  existing_expense_id uuid;
  actor_email text;
begin
  if p_fund_request_id is null then
    raise exception 'Fund request id is required.';
  end if;

  select *
  into request_row
  from public.fund_requests
  where id = p_fund_request_id
  for update;

  if not found then
    raise exception 'Fund request % was not found.', p_fund_request_id;
  end if;

  request_category := lower(trim(coalesce(request_row.request_category, 'fund')));
  actor_email := coalesce(nullif(trim(p_actor_email), ''), nullif(trim(p_actor_name), ''), auth.jwt() ->> 'email');

  if request_category not in ('fund', 'loan', 'float') then
    raise exception 'Fund request % does not require Finance disbursement.', p_fund_request_id;
  end if;

  if lower(trim(coalesce(request_row.hr_status, ''))) <> 'approved'
    or lower(trim(coalesce(request_row.agm_status, ''))) <> 'approved'
    or lower(trim(coalesce(request_row.operations_status, ''))) <> 'approved' then
    raise exception 'Fund request % must be approved by HR, AGM and Operations before Finance disbursement.',
      p_fund_request_id;
  end if;

  if lower(trim(coalesce(request_row.finance_status, ''))) not in ('ready_for_disbursement', 'partially_paid') then
    raise exception 'Fund request % is not ready for Finance disbursement.', p_fund_request_id;
  end if;

  if lower(trim(coalesce(request_row.status, ''))) not in ('approved', 'partially_paid') then
    raise exception 'Fund request % must have status approved or partially_paid before Finance disbursement.',
      p_fund_request_id;
  end if;

  approved_amount := coalesce(request_row.amount, 0);
  payment_amount := coalesce(p_amount, approved_amount);

  if approved_amount <= 0 then
    raise exception 'Fund request % has no approved amount to disburse.', p_fund_request_id;
  end if;

  if payment_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  select coalesce(sum(fp.amount), 0)
  into paid_total
  from public.finance_payments fp
  where fp.source_table = 'fund_requests'
    and fp.source_id = p_fund_request_id::text
    and fp.status in ('paid', 'posted');

  next_paid_total := paid_total + payment_amount;

  if next_paid_total > approved_amount then
    raise exception 'Payment total % exceeds approved amount % for fund request %.',
      next_paid_total, approved_amount, p_fund_request_id;
  end if;

  payment_no_value := public.finance_generate_payment_no(
    case when request_category = 'loan' then 'LOAN' else 'GEN' end,
    coalesce(p_payment_date, current_date)
  );

  insert into public.finance_payments (
    payment_no,
    payment_type,
    source_table,
    source_id,
    payee_name,
    amount,
    currency,
    status,
    narration,
    created_by,
    paid_by,
    paid_at
  )
  values (
    payment_no_value,
    case when request_category = 'loan' then 'loan_disbursement' else 'staff_reimbursement' end,
    'fund_requests',
    p_fund_request_id::text,
    coalesce(request_row.requested_by_name, request_row.requested_by_email, 'Staff'),
    payment_amount,
    'NGN',
    'paid',
    coalesce(p_payment_reference, request_row.purpose, request_row.request_type, 'General Request disbursement'),
    p_actor_id,
    p_actor_id,
    now()
  )
  returning id into payment_id;

  if request_category <> 'loan' then
    select e.id
    into existing_expense_id
    from public.expenses e
    where e.source_table = 'fund_requests'
      and e.source_id = p_fund_request_id::text
      and e.expense_source_type = 'request_generated'
    limit 1;

    if existing_expense_id is null then
      insert into public.expenses (
        category,
        amount,
        currency,
        payment_method,
        description,
        staff_responsible,
        staff_email,
        approval_status,
        approved_by,
        approved_date,
        expense_date,
        notes,
        expense_number,
        expense_source_type,
        source_table,
        source_id,
        source_document_number,
        finance_payment_id,
        updated_at,
        created_at
      )
      values (
        coalesce(request_row.request_type, 'General Request'),
        approved_amount,
        'NGN',
        coalesce(nullif(p_payment_method, ''), 'Account Release'),
        coalesce(request_row.purpose, request_row.notes, 'General Request disbursement'),
        request_row.requested_by_name,
        request_row.requested_by_email,
        'approved',
        p_actor_name,
        now(),
        coalesce(p_payment_date, current_date),
        request_row.notes,
        'EXP-GR-' || to_char(now(), 'YYYYMMDDHH24MISSMS'),
        'request_generated',
        'fund_requests',
        p_fund_request_id::text,
        coalesce(request_row.request_type, p_fund_request_id::text),
        payment_id,
        now(),
        now()
      )
      returning id into expense_id;
    else
      expense_id := existing_expense_id;

      update public.expenses
      set amount = greatest(coalesce(amount, 0), approved_amount),
          finance_payment_id = coalesce(finance_payment_id, payment_id),
          updated_at = now()
      where id = expense_id;
    end if;
  end if;

  debit_account_id := case
    when request_category = 'loan' then public.finance_get_account_id_by_codes(array['1040'])
    else public.finance_get_account_id_by_codes(
      public.finance_general_request_expense_account_codes(
        request_row.request_type,
        request_row.request_subtype,
        request_row.purpose
      )
    )
  end;

  credit_account_id := public.finance_get_account_id_by_codes(array['1020', '1010']);

  if debit_account_id is null or credit_account_id is null then
    raise exception 'Required finance accounts were not found for fund request %. Debit %, credit %.',
      p_fund_request_id, debit_account_id, credit_account_id;
  end if;

  journal_no_value := public.finance_generate_journal_no(
    case when request_category = 'loan' then 'LOAN' else 'GEN' end,
    coalesce(p_payment_date, current_date)
  );

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
    journal_no_value,
    coalesce(p_payment_date, current_date),
    'general_requests',
    'finance_payments',
    payment_id::text,
    'draft',
    (case when request_category = 'loan' then 'Loan' else 'General Request' end)
      || ' payment '
      || payment_no_value
      || ' - '
      || coalesce(request_row.requested_by_name, request_row.requested_by_email, p_fund_request_id::text),
    p_actor_id,
    p_actor_name
  )
  returning id into new_journal_id;

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
      debit_account_id,
      payment_amount,
      0,
      case
        when request_category = 'loan' then 'Staff loan disbursement'
        else coalesce(request_row.purpose, 'General Request expense')
      end,
      case when request_category = 'loan' then 'loan' else 'expense' end,
      coalesce(expense_id::text, p_fund_request_id::text)
    ),
    (
      new_journal_id,
      2,
      credit_account_id,
      0,
      payment_amount,
      'Payment recorded as ' || payment_no_value,
      'payment',
      payment_id::text
    );

  update public.finance_payments
  set journal_id = new_journal_id,
      updated_at = now()
  where id = payment_id;

  next_finance_status := case
    when next_paid_total >= approved_amount then 'disbursed'
    else 'partially_paid'
  end;

  next_status := case
    when next_finance_status = 'disbursed' then 'disbursed'
    else 'partially_paid'
  end;

  update public.fund_requests
  set finance_status = next_finance_status,
      status = next_status,
      disbursed_by = case when next_finance_status = 'disbursed' then actor_email else disbursed_by end,
      disbursed_at = case when next_finance_status = 'disbursed' then now() else disbursed_at end,
      updated_at = now()
  where id = p_fund_request_id;

  return jsonb_build_object(
    'fund_request_id', p_fund_request_id,
    'payment_id', payment_id,
    'payment_no', payment_no_value,
    'expense_id', expense_id,
    'journal_id', new_journal_id,
    'journal_no', journal_no_value,
    'amount_paid', payment_amount,
    'paid_total', next_paid_total,
    'approved_amount', approved_amount,
    'finance_status', next_finance_status
  );
end;
$$;
