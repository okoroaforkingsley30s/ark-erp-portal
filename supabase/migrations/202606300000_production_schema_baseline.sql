--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;
--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: approve_ark_user(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_ark_user(target_user_id uuid, new_role text, new_department text DEFAULT NULL::text, new_employee_id text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
begin
  if lower(auth.email()) <> 'iamkizmith@gmail.com' then
    raise exception 'Only main admin can approve users';
  end if;

  if new_role = 'admin' then
    raise exception 'Admin role is locked';
  end if;

  update public.users
  set
    role = new_role,
    department = new_department,
    employee_id = new_employee_id,
    status = 'approved',
    approval_status = 'approved',
    is_approved = true,
    account_status = 'active',
    updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'User not found or update failed';
  end if;
end;
$$;


--
-- Name: create_repair_job_from_part_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_repair_job_from_part_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
begin
  if
    new.rr_status = 'received'
    and new.status = 'rr_received'
    and (
      old.rr_status is distinct from new.rr_status
      or old.status is distinct from new.status
    )
  then
    insert into repair_jobs (
      job_number,
      ticket_id,
      device_name,
      fault_description,
      parts_used,
      status,
      priority,
      received_by,
      source_type,
      received_from,
      item_name,
      part_number,
      quantity_received,
      condition_on_arrival,
      action_required,
      inventory_transfer_status,
      created_at,
      updated_at
    )
    values (
      'RR-' || extract(epoch from now())::bigint,
      coalesce(new.ticket_id::text, new.ticket_number::text),
      coalesce(new.part_name, new.part_type, 'Part Repair'),
      coalesce(new.reason, new.reason_category, new.notes, 'Part received from Inventory for RR repair'),
      coalesce(new.part_name, new.part_type),
      'received',
      'normal',
      'RR',
      'part_request',
      'Inventory',
      coalesce(new.part_name, new.part_type, 'Part Request'),
      new.part_number,
      coalesce(new.quantity, 1),
      'pending_inspection',
      'repair_required',
      'received_by_rr',
      now(),
      now()
    );
  end if;

  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: finance_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_code text NOT NULL,
    account_name text NOT NULL,
    account_type text NOT NULL,
    parent_account_id uuid,
    normal_balance text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['asset'::text, 'liability'::text, 'equity'::text, 'income'::text, 'expense'::text]))),
    CONSTRAINT finance_accounts_normal_balance_check CHECK ((normal_balance = ANY (ARRAY['debit'::text, 'credit'::text])))
);


--
-- Name: finance_journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_journal_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_id uuid NOT NULL,
    line_no integer DEFAULT 1 NOT NULL,
    account_id uuid NOT NULL,
    debit numeric(18,2) DEFAULT 0 NOT NULL,
    credit numeric(18,2) DEFAULT 0 NOT NULL,
    description text,
    department text,
    entity_type text,
    entity_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_journal_lines_credit_check CHECK ((credit >= (0)::numeric)),
    CONSTRAINT finance_journal_lines_debit_check CHECK ((debit >= (0)::numeric)),
    CONSTRAINT finance_journal_lines_one_side_check CHECK ((((debit > (0)::numeric) AND (credit = (0)::numeric)) OR ((credit > (0)::numeric) AND (debit = (0)::numeric))))
);


--
-- Name: finance_journals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_journals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_no text NOT NULL,
    journal_date date DEFAULT CURRENT_DATE NOT NULL,
    source_module text,
    source_table text,
    source_id text,
    status text DEFAULT 'draft'::text NOT NULL,
    narration text NOT NULL,
    rejection_reason text,
    reversal_of uuid,
    created_by uuid,
    created_by_name text,
    reviewed_by uuid,
    reviewed_by_name text,
    approved_by uuid,
    approved_by_name text,
    posted_by uuid,
    posted_by_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    approved_at timestamp with time zone,
    posted_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_journals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'posted'::text, 'rejected'::text, 'reversed'::text])))
);


--
-- Name: finance_general_ledger_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_general_ledger_view AS
 SELECT j.id AS journal_id,
    j.journal_no,
    j.journal_date,
    j.status,
    j.source_module,
    j.source_table,
    j.source_id,
    j.narration,
    l.id AS line_id,
    l.line_no,
    a.id AS account_id,
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
   FROM ((public.finance_journals j
     JOIN public.finance_journal_lines l ON ((l.journal_id = j.id)))
     JOIN public.finance_accounts a ON ((a.id = l.account_id)));


--
-- Name: finance_account_statement_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_account_statement_view AS
 SELECT journal_id,
    journal_no,
    journal_date,
    status,
    source_module,
    source_table,
    source_id,
    narration,
    line_id,
    line_no,
    account_id,
    account_code,
    account_name,
    account_type,
    normal_balance,
    debit,
    credit,
    department,
    entity_type,
    entity_id,
    created_by,
    created_by_name,
    approved_by,
    approved_by_name,
    posted_by,
    posted_by_name,
    created_at,
    approved_at,
    posted_at,
    sum(
        CASE
            WHEN (normal_balance = 'credit'::text) THEN (credit - debit)
            ELSE (debit - credit)
        END) OVER (PARTITION BY account_id ORDER BY journal_date, created_at, journal_no, line_no, line_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
   FROM public.finance_general_ledger_view gl
  WHERE (status = 'posted'::text);


--
-- Name: finance_calculate_account_statement(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_calculate_account_statement(p_account_id uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date) RETURNS SETOF public.finance_account_statement_view
    LANGUAGE sql STABLE
    AS $$
  select *
  from public.finance_account_statement_view
  where account_id = p_account_id
    and (p_from_date is null or journal_date >= p_from_date)
    and (p_to_date is null or journal_date <= p_to_date)
  order by journal_date, created_at, journal_no, line_no, line_id;
$$;


--
-- Name: finance_calculate_tax_amount(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_calculate_tax_amount(p_taxable_amount numeric, p_tax_rate numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select round((coalesce(p_taxable_amount, 0) * coalesce(p_tax_rate, 0) / 100)::numeric, 2);
$$;


--
-- Name: finance_calculate_trial_balance(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_calculate_trial_balance(p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date) RETURNS TABLE(account_id uuid, account_code text, account_name text, account_type text, normal_balance text, debit_total numeric, credit_total numeric, balance numeric)
    LANGUAGE sql STABLE
    AS $$
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


--
-- Name: finance_create_reversal_journal(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_create_reversal_journal(p_original_journal_id uuid, p_created_by uuid DEFAULT NULL::uuid, p_created_by_name text DEFAULT NULL::text, p_narration text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: finance_current_user_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_current_user_email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;


--
-- Name: finance_current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
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


--
-- Name: finance_expense_request_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_expense_request_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: finance_generate_expense_payment_no(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_generate_expense_payment_no(p_payment_date date DEFAULT CURRENT_DATE) RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  next_number bigint;
begin
  next_number := nextval('public.finance_expense_payment_no_seq');
  return 'EP-' || to_char(coalesce(p_payment_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 4, '0');
end;
$$;


--
-- Name: finance_generate_expense_request_no(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_generate_expense_request_no(p_request_date date DEFAULT CURRENT_DATE) RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  next_number bigint;
begin
  next_number := nextval('public.finance_expense_request_no_seq');
  return 'ER-' || to_char(coalesce(p_request_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 4, '0');
end;
$$;


--
-- Name: finance_generate_journal_no(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_generate_journal_no(p_prefix text DEFAULT 'JV'::text, p_journal_date date DEFAULT CURRENT_DATE) RETURNS text
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: finance_generate_tax_no(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_generate_tax_no(p_prefix text DEFAULT 'TAX'::text, p_tax_date date DEFAULT CURRENT_DATE) RETURNS text
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: finance_get_journal_totals(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_get_journal_totals(p_journal_id uuid) RETURNS TABLE(debit_total numeric, credit_total numeric, line_count bigint, is_balanced boolean)
    LANGUAGE sql STABLE
    AS $$
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


--
-- Name: finance_guard_journal_posting(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_guard_journal_posting() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: finance_guard_posted_journal_lines(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_guard_posted_journal_lines() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: finance_is_expense_approver_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_is_expense_approver_role() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
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


--
-- Name: finance_is_privileged_expense_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_is_privileged_expense_role() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
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


--
-- Name: finance_sync_expense_request_payment_totals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_sync_expense_request_payment_totals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

    if paid_total > 0
       and current_status not in (
         'approved_for_payment',
         'partially_paid',
         'paid'
       ) then
      raise exception
        'Expense request % is not approved for payment. Current status: %.',
        target_request_id,
        current_status;
    end if;

    if paid_total > 0 and approved_total <= 0 then
      raise exception
        'Expense request % has payments but no approved amount.',
        target_request_id;
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
      next_request_status := 'partially_paid';
      next_paid_at := null;

    else
      next_payment_status := 'paid';
      next_request_status := 'paid';
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


--
-- Name: finance_validate_balanced_journal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_validate_balanced_journal(p_journal_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
begin
  insert into public.users (
    id,
    email,
    full_name,
    role,
    status,
    approval_status,
    is_approved,
    created_at,
    updated_at
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    null,
    'pending',
    'pending',
    false,
    now(),
    now()
  )
  on conflict (email) do nothing;

  return new;
end;
$$;


--
-- Name: normalize_device_engineer_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_device_engineer_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  eng record;
begin
  select email, trim(full_name) as full_name
  into eng
  from public.users
  where role = 'engineer'
    and (
      lower(email) = lower(coalesce(new.assigned_engineer_email, new.assigned_engineer, ''))
      or lower(trim(full_name)) = lower(trim(coalesce(new.assigned_engineer_name, new.assigned_engineer, '')))
    )
  limit 1;

  if eng.email is not null then
    new.assigned_engineer_email := eng.email;
    new.assigned_engineer_name := eng.full_name;
    new.assigned_engineer := eng.email;
  end if;

  new.updated_at := now();

  return new;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog, pg_temp
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: sync_employee_role_from_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_employee_role_from_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.employees
  set
    access_role = new.role,
    department = coalesce(new.department, new.role, 'General'),
    job_title = coalesce(new.role, 'Staff'),
    updated_at = now()
  where
    email_address = new.email
    or user_account_email = new.email;

  return new;
end;
$$;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text,
    entity_type text,
    details text,
    user_name text,
    user_email text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bank_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    terminal_id text,
    branch_name text,
    bank_name text,
    device_type text,
    device_model text,
    assigned_engineer text,
    device_status text DEFAULT 'Active'::text,
    sla_status text DEFAULT 'Normal'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_name text NOT NULL,
    status text DEFAULT 'active'::text,
    contact_email text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    name text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_name text NOT NULL,
    branch_name text NOT NULL,
    location text,
    region text,
    assigned_engineer text,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    branch_key text,
    assigned_engineer_name text
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id text,
    sender_name text,
    sender_role text,
    recipient_id text,
    recipient_name text,
    channel_name text,
    message_type text,
    message_body text,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    author_email text,
    author_name text,
    content text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_name text NOT NULL,
    industry text,
    contact_name text,
    contact_email text,
    contact_phone text,
    relationship_manager text,
    relationship_manager_email text,
    source_lead_id uuid,
    contract_value numeric DEFAULT 0,
    contract_start date,
    contract_end date,
    sla_level text DEFAULT 'standard'::text,
    branch_count integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_complaints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_complaints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    complaint_number text,
    client_id uuid,
    client_name text NOT NULL,
    contact_name text,
    contact_email text,
    contact_phone text,
    issue_title text NOT NULL,
    issue_description text,
    priority text DEFAULT 'medium'::text,
    status text DEFAULT 'open'::text,
    ticket_id uuid,
    ticket_number text,
    followup_date date,
    satisfaction_rating integer,
    feedback text,
    created_by_email text,
    created_by_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    head_email text
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    terminal_id text,
    machine_name text,
    bank_name text,
    machine_type text,
    model text,
    branch text,
    location text,
    status text DEFAULT 'active'::text,
    assigned_engineer text,
    created_at timestamp without time zone DEFAULT now(),
    device_status text,
    sla_status text DEFAULT 'Normal'::text,
    notes text,
    atm_terminal_id text,
    device_name text,
    device_type text,
    device_model text,
    branch_name text,
    client_name text,
    client_email text,
    site_name text,
    branch_location text,
    assigned_engineer_email text,
    assigned_engineer_name text,
    health_score integer DEFAULT 100,
    firmware_version text,
    ip_address text,
    latitude numeric,
    longitude numeric,
    installation_date date,
    warranty_expiry date,
    last_maintenance_date date,
    next_maintenance_date date,
    name text,
    serial_number text,
    category text,
    updated_at timestamp with time zone DEFAULT now(),
    state text
);


--
-- Name: email_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject text,
    sender_name text,
    sender_email text,
    recipient_email text,
    message_body text,
    email_category text,
    email_status text DEFAULT 'New'::text,
    is_sent boolean DEFAULT false,
    is_draft boolean DEFAULT false,
    archived_status boolean DEFAULT false,
    assigned_to text,
    converted_to_ticket boolean DEFAULT false,
    received_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    assigned_department text,
    assigned_staff text,
    internal_notes text,
    priority text DEFAULT 'medium'::text,
    related_bank text,
    related_branch text,
    cc text,
    attachments jsonb DEFAULT '[]'::jsonb,
    direction text,
    replied_status boolean DEFAULT false,
    linked_ticket_id text,
    parent_email_id uuid,
    reply_to_email text,
    gmail_message_id text,
    gmail_thread_id text,
    snippet text,
    folder text,
    synced_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    is_read boolean DEFAULT false,
    bcc text,
    recipient_name text,
    gmail_history_id text,
    raw_headers jsonb DEFAULT '{}'::jsonb
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    department text,
    role text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    user_account_email text,
    access_role text,
    create_login boolean DEFAULT false,
    login_email text,
    login_role text,
    title text,
    phone_number text,
    marital_status text,
    gender text,
    date_of_birth date,
    home_address text,
    job_title text,
    current_level text,
    religion text,
    state_of_origin text,
    local_government_area text,
    nationality text,
    country text DEFAULT 'Nigeria'::text,
    email_address text,
    national_id_type text,
    national_id_number text,
    date_of_employment date,
    current_pay numeric DEFAULT 0,
    employment_status text DEFAULT 'Active'::text,
    next_of_kin_full_name text,
    next_of_kin_phone_number text,
    next_of_kin_address text,
    next_of_kin_occupation text,
    next_of_kin_email_address text,
    next_of_kin_relationship text,
    next_of_kin_id_type text,
    next_of_kin_id_number text,
    guarantor_1_full_name text,
    guarantor_1_id_type text,
    guarantor_1_id_number text,
    guarantor_1_phone_number text,
    guarantor_1_email_address text,
    guarantor_1_home_address text,
    guarantor_1_office_address text,
    guarantor_1_occupation text,
    guarantor_2_full_name text,
    guarantor_2_id_type text,
    guarantor_2_id_number text,
    guarantor_2_phone_number text,
    guarantor_2_email_address text,
    guarantor_2_home_address text,
    guarantor_2_office_address text,
    guarantor_2_occupation text,
    notes text,
    staff_id text,
    employee_status text DEFAULT 'active'::text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: engineer_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineer_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engineer_email text,
    engineer_name text,
    staff_id text,
    department text,
    phone text,
    skills text,
    regions text,
    status text DEFAULT 'offline'::text,
    current_latitude numeric,
    current_longitude numeric,
    tracking_enabled boolean DEFAULT false,
    location_label text,
    profile_photo text,
    last_active timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    current_ticket_id text,
    updated_date timestamp with time zone DEFAULT now(),
    current_site_name text
);


--
-- Name: engineers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engineer_name text NOT NULL,
    region text,
    assigned_location text,
    status text DEFAULT 'active'::text,
    phone_number text,
    email text,
    online_status text DEFAULT 'offline'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    phone text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_number text,
    category text,
    amount numeric DEFAULT 0,
    currency text DEFAULT 'NGN'::text,
    payment_method text,
    description text,
    staff_responsible text,
    staff_email text,
    approval_status text DEFAULT 'pending'::text,
    approved_by text,
    approved_date timestamp with time zone,
    expense_date date,
    document_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expense_request_id uuid,
    expense_source_type text DEFAULT 'legacy_manual'::text NOT NULL,
    controlled_exception_type text,
    controlled_exception_reason text
);


--
-- Name: finance_account_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_account_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    opening_balance numeric(18,2) DEFAULT 0 NOT NULL,
    debit_total numeric(18,2) DEFAULT 0 NOT NULL,
    credit_total numeric(18,2) DEFAULT 0 NOT NULL,
    closing_balance numeric(18,2) DEFAULT 0 NOT NULL,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_payable_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payable_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payable_source_table text NOT NULL,
    payable_source_id text NOT NULL,
    payment_source_table text,
    payment_source_id text,
    journal_id uuid,
    allocated_amount numeric(18,2) NOT NULL,
    allocated_at timestamp with time zone DEFAULT now() NOT NULL,
    allocated_by uuid,
    notes text,
    CONSTRAINT finance_payable_allocations_allocated_amount_check CHECK ((allocated_amount > (0)::numeric))
);


--
-- Name: lpos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lpos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lpo_number text,
    title text NOT NULL,
    supplier_name text,
    supplier_contact text,
    supplier_email text,
    supplier_address text,
    currency text DEFAULT 'NGN'::text,
    delivery_expected_date date,
    notes text,
    items jsonb DEFAULT '[]'::jsonb,
    total_amount_ngn numeric DEFAULT 0,
    status text DEFAULT 'Draft'::text,
    trigger_type text DEFAULT 'manual'::text,
    linked_inventory_items jsonb DEFAULT '[]'::jsonb,
    requested_by_email text,
    requested_by_name text,
    approved_by text,
    approval_date timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    vat_rate numeric DEFAULT 0,
    approval_stage text DEFAULT 'multi_approval'::text,
    hr_approved_by text,
    hr_approved_at timestamp with time zone,
    agm_approved_by text,
    agm_approved_at timestamp with time zone,
    operations_approved_by text,
    operations_approved_at timestamp with time zone
);


--
-- Name: finance_ap_payable_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_ap_payable_view AS
 SELECT 'expenses'::text AS source_table,
    (e.id)::text AS source_id,
    e.expense_number AS document_number,
    COALESCE(NULLIF(TRIM(BOTH FROM e.staff_responsible), ''::text), NULLIF(TRIM(BOTH FROM e.staff_email), ''::text), 'Expense Payee'::text) AS supplier_name,
    e.staff_email AS supplier_email,
    (COALESCE(e.amount, (0)::numeric))::numeric(18,2) AS payable_amount,
    (COALESCE(alloc.allocated_amount, (0)::numeric))::numeric(18,2) AS allocated_amount,
    (GREATEST((COALESCE(e.amount, (0)::numeric) - COALESCE(alloc.allocated_amount, (0)::numeric)), (0)::numeric))::numeric(18,2) AS outstanding_amount,
        CASE
            WHEN (NULLIF(TRIM(BOTH FROM COALESCE(e.payment_method, ''::text)), ''::text) IS NOT NULL) THEN 'payment_indicated'::text
            ELSE 'provisional_unverified'::text
        END AS payment_verification_status,
    false AS is_confirmed_outstanding,
    e.approval_status AS status,
    (NULLIF((e.expense_date)::text, ''::text))::date AS document_date,
    COALESCE((NULLIF((e.approved_date)::text, ''::text))::date, (NULLIF((e.expense_date)::text, ''::text))::date, (e.created_at)::date) AS due_date,
    GREATEST((CURRENT_DATE - COALESCE((NULLIF((e.approved_date)::text, ''::text))::date, (NULLIF((e.expense_date)::text, ''::text))::date, (e.created_at)::date)), 0) AS age_days
   FROM (public.expenses e
     LEFT JOIN ( SELECT finance_payable_allocations.payable_source_table,
            finance_payable_allocations.payable_source_id,
            sum(finance_payable_allocations.allocated_amount) AS allocated_amount
           FROM public.finance_payable_allocations
          GROUP BY finance_payable_allocations.payable_source_table, finance_payable_allocations.payable_source_id) alloc ON (((alloc.payable_source_table = 'expenses'::text) AND (alloc.payable_source_id = (e.id)::text))))
  WHERE (lower(TRIM(BOTH FROM COALESCE(e.approval_status, ''::text))) = 'approved'::text)
UNION ALL
 SELECT 'lpos'::text AS source_table,
    (l.id)::text AS source_id,
    l.lpo_number AS document_number,
    COALESCE(NULLIF(TRIM(BOTH FROM l.supplier_name), ''::text), 'Supplier'::text) AS supplier_name,
    NULL::text AS supplier_email,
    (COALESCE(l.total_amount_ngn, (0)::numeric))::numeric(18,2) AS payable_amount,
    (COALESCE(alloc.allocated_amount, (0)::numeric))::numeric(18,2) AS allocated_amount,
    (GREATEST((COALESCE(l.total_amount_ngn, (0)::numeric) - COALESCE(alloc.allocated_amount, (0)::numeric)), (0)::numeric))::numeric(18,2) AS outstanding_amount,
    'confirmed_outstanding'::text AS payment_verification_status,
    true AS is_confirmed_outstanding,
    l.status,
    (l.created_at)::date AS document_date,
    COALESCE((l.updated_at)::date, (l.created_at)::date) AS due_date,
    GREATEST((CURRENT_DATE - COALESCE((l.updated_at)::date, (l.created_at)::date)), 0) AS age_days
   FROM (public.lpos l
     LEFT JOIN ( SELECT finance_payable_allocations.payable_source_table,
            finance_payable_allocations.payable_source_id,
            sum(finance_payable_allocations.allocated_amount) AS allocated_amount
           FROM public.finance_payable_allocations
          GROUP BY finance_payable_allocations.payable_source_table, finance_payable_allocations.payable_source_id) alloc ON (((alloc.payable_source_table = 'lpos'::text) AND (alloc.payable_source_id = (l.id)::text))))
  WHERE (lower(TRIM(BOTH FROM COALESCE(l.status, ''::text))) = 'pending account release'::text);


--
-- Name: finance_ap_ageing_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_ap_ageing_view AS
 SELECT supplier_name,
    supplier_email,
    sum(outstanding_amount) AS balance,
    sum(
        CASE
            WHEN (age_days < 30) THEN outstanding_amount
            ELSE (0)::numeric
        END) AS current_amount,
    sum(
        CASE
            WHEN ((age_days >= 30) AND (age_days < 60)) THEN outstanding_amount
            ELSE (0)::numeric
        END) AS bucket_30,
    sum(
        CASE
            WHEN ((age_days >= 60) AND (age_days < 90)) THEN outstanding_amount
            ELSE (0)::numeric
        END) AS bucket_60,
    sum(
        CASE
            WHEN ((age_days >= 90) AND (age_days < 120)) THEN outstanding_amount
            ELSE (0)::numeric
        END) AS bucket_90,
    sum(
        CASE
            WHEN (age_days >= 120) THEN outstanding_amount
            ELSE (0)::numeric
        END) AS bucket_120_plus
   FROM public.finance_ap_payable_view
  WHERE ((outstanding_amount > (0)::numeric) AND (is_confirmed_outstanding = true))
  GROUP BY supplier_name, supplier_email;


--
-- Name: finance_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_table text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    previous_value jsonb,
    new_value jsonb,
    changed_by uuid,
    changed_by_name text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    bank_name text NOT NULL,
    account_name text NOT NULL,
    account_number text,
    currency text DEFAULT 'NGN'::text NOT NULL,
    opening_balance numeric(18,2) DEFAULT 0 NOT NULL,
    current_balance numeric(18,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_bank_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_bank_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_account_id uuid NOT NULL,
    statement_start date NOT NULL,
    statement_end date NOT NULL,
    opening_balance numeric(18,2) DEFAULT 0 NOT NULL,
    closing_balance numeric(18,2) DEFAULT 0 NOT NULL,
    reconciled_balance numeric(18,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_by uuid,
    reviewed_by uuid,
    reconciled_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reconciled_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_bank_reconciliations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'reconciled'::text, 'rejected'::text])))
);


--
-- Name: finance_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department text NOT NULL,
    account_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    budget_amount numeric(18,2) DEFAULT 0 NOT NULL,
    spent_amount numeric(18,2) DEFAULT 0 NOT NULL,
    pending_amount numeric(18,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_budgets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'closed'::text, 'rejected'::text])))
);


--
-- Name: finance_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    correction_no text NOT NULL,
    source_table text NOT NULL,
    source_id text NOT NULL,
    correction_type text NOT NULL,
    reason text NOT NULL,
    previous_value jsonb,
    requested_value jsonb,
    status text DEFAULT 'pending_review'::text NOT NULL,
    adjustment_journal_id uuid,
    requested_by uuid,
    reviewed_by uuid,
    approved_by uuid,
    posted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    approved_at timestamp with time zone,
    posted_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_corrections_correction_type_check CHECK ((correction_type = ANY (ARRAY['reversal'::text, 'adjustment'::text, 'metadata_correction'::text]))),
    CONSTRAINT finance_corrections_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'rejected'::text, 'posted'::text])))
);


--
-- Name: finance_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    phone text,
    billing_address text,
    credit_limit numeric(18,2) DEFAULT 0 NOT NULL,
    payment_terms_days integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_expense_payment_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_expense_payment_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_expense_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_expense_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_request_id uuid NOT NULL,
    payment_number text NOT NULL,
    amount_paid numeric(18,2) NOT NULL,
    payment_method text NOT NULL,
    payment_reference text,
    bank_account_id uuid,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_status text DEFAULT 'paid'::text NOT NULL,
    paid_by uuid,
    paid_by_email text,
    paid_by_name text,
    notes text,
    journal_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_expense_payments_amount_paid_check CHECK ((amount_paid > (0)::numeric)),
    CONSTRAINT finance_expense_payments_payment_status_check CHECK ((payment_status = ANY (ARRAY['draft'::text, 'paid'::text, 'voided'::text])))
);


--
-- Name: finance_expense_request_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_expense_request_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_request_id uuid NOT NULL,
    approval_stage text NOT NULL,
    approver_role text,
    approver_user_id uuid,
    approver_email text,
    approver_name text,
    decision text NOT NULL,
    comments text,
    previous_status text,
    new_status text,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_expense_request_approvals_decision_check CHECK ((decision = ANY (ARRAY['submitted'::text, 'approved'::text, 'rejected'::text, 'returned_for_correction'::text, 'cancelled'::text, 'finance_reviewed'::text, 'approved_for_payment'::text])))
);


--
-- Name: finance_expense_request_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_expense_request_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_request_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type text,
    file_size bigint,
    uploaded_by uuid,
    uploaded_by_email text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_expense_request_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_expense_request_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_request_id uuid NOT NULL,
    actor_user_id uuid,
    actor_email text,
    actor_name text,
    action text NOT NULL,
    previous_status text,
    new_status text,
    comments text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_expense_request_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_expense_request_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_expense_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_expense_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_number text NOT NULL,
    requester_user_id uuid,
    requester_email text,
    requester_name text,
    department text,
    expense_category text,
    purpose text NOT NULL,
    description text,
    supplier_name text,
    supplier_email text,
    beneficiary_name text,
    amount_requested numeric(18,2) DEFAULT 0 NOT NULL,
    amount_approved numeric(18,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(18,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    required_date date,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    current_approval_stage text DEFAULT 'requester'::text NOT NULL,
    next_approver_role text,
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    returned_at timestamp with time zone,
    finance_reviewed_at timestamp with time zone,
    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    legacy_exception boolean DEFAULT false NOT NULL,
    legacy_exception_reason text,
    exception_type text,
    resulting_expense_id text,
    resulting_journal_id uuid,
    CONSTRAINT finance_expense_requests_amount_approved_check CHECK ((amount_approved >= (0)::numeric)),
    CONSTRAINT finance_expense_requests_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT finance_expense_requests_amount_requested_check CHECK ((amount_requested >= (0)::numeric)),
    CONSTRAINT finance_expense_requests_paid_check CHECK ((amount_paid <= GREATEST(amount_approved, amount_requested))),
    CONSTRAINT finance_expense_requests_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'partially_paid'::text, 'paid'::text, 'cancelled'::text]))),
    CONSTRAINT finance_expense_requests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text, 'returned_for_correction'::text, 'pending_finance_review'::text, 'approved_for_payment'::text, 'partially_paid'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: finance_fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_fixed_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_code text NOT NULL,
    asset_name text NOT NULL,
    asset_type text,
    serial_number text,
    purchase_date date,
    purchase_cost numeric(18,2) DEFAULT 0 NOT NULL,
    account_id uuid,
    assigned_department text,
    assigned_employee_id text,
    assigned_employee_name text,
    current_location text,
    warranty_expiry date,
    depreciation_method text DEFAULT 'straight_line'::text NOT NULL,
    depreciation_rate numeric(7,4) DEFAULT 0 NOT NULL,
    accumulated_depreciation numeric(18,2) DEFAULT 0 NOT NULL,
    current_book_value numeric(18,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    disposal_date date,
    disposal_value numeric(18,2),
    disposal_notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_fixed_assets_status_check CHECK ((status = ANY (ARRAY['active'::text, 'assigned'::text, 'under_repair'::text, 'disposed'::text, 'lost'::text, 'retired'::text])))
);


--
-- Name: finance_journal_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_journal_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_tax_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_tax_codes (
    tax_code text,
    tax_name text,
    tax_type text,
    tax_authority text,
    applies_to text[] DEFAULT ARRAY[]::text[],
    default_debit_account_id uuid,
    default_credit_account_id uuid,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid()
);


--
-- Name: finance_tax_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_tax_transactions (
    id uuid DEFAULT gen_random_uuid(),
    tax_transaction_no text,
    tax_code_id uuid,
    tax_rate_id uuid,
    source_module text DEFAULT 'finance'::text,
    source_table text,
    source_id text,
    taxable_amount numeric(18,2) DEFAULT 0,
    tax_rate numeric(9,4) DEFAULT 0,
    tax_amount numeric(18,2) DEFAULT 0,
    currency text DEFAULT 'NGN'::text,
    tax_authority text,
    due_date date,
    status text DEFAULT 'draft'::text,
    journal_id uuid,
    payment_reference text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_by_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: finance_paye_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_paye_report_view AS
 SELECT tx.id,
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
   FROM (public.finance_tax_transactions tx
     JOIN public.finance_tax_codes code ON ((code.id = tx.tax_code_id)))
  WHERE (code.tax_type = 'paye'::text);


--
-- Name: finance_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_no text NOT NULL,
    payment_type text NOT NULL,
    source_table text,
    source_id text,
    payee_name text,
    payer_name text,
    amount numeric(18,2) NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    bank_account_id uuid,
    journal_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    narration text,
    created_by uuid,
    approved_by uuid,
    paid_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    paid_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_payments_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT finance_payments_payment_type_check CHECK ((payment_type = ANY (ARRAY['purchase_order'::text, 'vendor_invoice'::text, 'staff_reimbursement'::text, 'loan_disbursement'::text, 'loan_repayment'::text, 'salary'::text, 'expense'::text, 'income'::text, 'transfer'::text, 'other'::text]))),
    CONSTRAINT finance_payments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'paid'::text, 'posted'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: finance_receivable_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_receivable_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id text NOT NULL,
    payment_source_table text,
    payment_source_id text,
    journal_id uuid,
    allocated_amount numeric(18,2) NOT NULL,
    allocated_at timestamp with time zone DEFAULT now() NOT NULL,
    allocated_by uuid,
    notes text,
    CONSTRAINT finance_receivable_allocations_allocated_amount_check CHECK ((allocated_amount > (0)::numeric))
);


--
-- Name: finance_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_name text NOT NULL,
    supplier_email text,
    phone text,
    billing_address text,
    payment_terms_days integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_tax_liability_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_tax_liability_report_view AS
 SELECT code.tax_type,
    code.tax_code,
    code.tax_name,
    COALESCE(tx.tax_authority, code.tax_authority) AS tax_authority,
    COALESCE(sum(tx.taxable_amount), (0)::numeric) AS taxable_amount,
    COALESCE(sum(tx.tax_amount), (0)::numeric) AS tax_amount,
    COALESCE(sum(
        CASE
            WHEN (tx.status = 'paid'::text) THEN tx.tax_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS paid_amount,
    COALESCE(sum(
        CASE
            WHEN (tx.status <> 'paid'::text) THEN tx.tax_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS outstanding_amount,
    min(tx.due_date) FILTER (WHERE (tx.status <> 'paid'::text)) AS next_due_date
   FROM (public.finance_tax_codes code
     LEFT JOIN public.finance_tax_transactions tx ON ((tx.tax_code_id = code.id)))
  GROUP BY code.tax_type, code.tax_code, code.tax_name, COALESCE(tx.tax_authority, code.tax_authority);


--
-- Name: finance_tax_payment_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_tax_payment_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_tax_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_tax_payments (
);


--
-- Name: finance_tax_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_tax_rates (
    tax_code_id uuid,
    rate_name text,
    rate_percent numeric(9,4) DEFAULT 0,
    effective_from date DEFAULT CURRENT_DATE,
    effective_to date,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: finance_tax_return_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_tax_return_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_tax_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_tax_returns (
);


--
-- Name: finance_tax_transaction_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_tax_transaction_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_trial_balance_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_trial_balance_view AS
 SELECT a.id AS account_id,
    a.account_code,
    a.account_name,
    a.account_type,
    a.normal_balance,
    COALESCE(sum(
        CASE
            WHEN (j.status = 'posted'::text) THEN l.debit
            ELSE (0)::numeric
        END), (0)::numeric) AS debit_total,
    COALESCE(sum(
        CASE
            WHEN (j.status = 'posted'::text) THEN l.credit
            ELSE (0)::numeric
        END), (0)::numeric) AS credit_total,
        CASE
            WHEN (a.normal_balance = 'debit'::text) THEN COALESCE(sum(
            CASE
                WHEN (j.status = 'posted'::text) THEN (l.debit - l.credit)
                ELSE (0)::numeric
            END), (0)::numeric)
            ELSE COALESCE(sum(
            CASE
                WHEN (j.status = 'posted'::text) THEN (l.credit - l.debit)
                ELSE (0)::numeric
            END), (0)::numeric)
        END AS balance
   FROM ((public.finance_accounts a
     LEFT JOIN public.finance_journal_lines l ON ((l.account_id = a.id)))
     LEFT JOIN public.finance_journals j ON ((j.id = l.journal_id)))
  GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance;


--
-- Name: finance_vat_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_vat_report_view AS
 SELECT tx.id,
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
   FROM (public.finance_tax_transactions tx
     JOIN public.finance_tax_codes code ON ((code.id = tx.tax_code_id)))
  WHERE (code.tax_type = 'vat'::text);


--
-- Name: finance_wht_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_wht_report_view AS
 SELECT tx.id,
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
   FROM (public.finance_tax_transactions tx
     JOIN public.finance_tax_codes code ON ((code.id = tx.tax_code_id)))
  WHERE (code.tax_type = 'withholding_tax'::text);


--
-- Name: fund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type text NOT NULL,
    source_module text DEFAULT 'ARK ONE'::text,
    amount numeric DEFAULT 0 NOT NULL,
    purpose text NOT NULL,
    requested_by uuid,
    requested_by_email text,
    requested_by_name text,
    department text,
    role text,
    hr_status text DEFAULT 'pending'::text,
    hr_approved_by text,
    hr_approved_at timestamp with time zone,
    agm_status text DEFAULT 'pending'::text,
    agm_approved_by text,
    agm_approved_at timestamp with time zone,
    operations_status text DEFAULT 'pending'::text,
    operations_approved_by text,
    operations_approved_at timestamp with time zone,
    ceo_override boolean DEFAULT false,
    ceo_approved_by text,
    ceo_approved_at timestamp with time zone,
    finance_status text DEFAULT 'pending_approval'::text,
    disbursed_by text,
    disbursed_at timestamp with time zone,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    staff_id text,
    repayment_amount numeric,
    repayment_frequency text,
    request_category text DEFAULT 'fund'::text,
    request_subtype text,
    start_date date,
    end_date date,
    return_date date,
    days_count integer,
    attachment_url text
);


--
-- Name: gmail_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    provider text DEFAULT 'google'::text,
    connected_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: hr_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_name text,
    attendance_date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'present'::text,
    check_in time without time zone,
    check_out time without time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    country text DEFAULT 'Nigeria'::text,
    staff_id text,
    department text,
    punctuality_status text DEFAULT 'On Time'::text
);


--
-- Name: hr_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    holiday_date date,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    holiday_name text,
    country text DEFAULT 'Nigeria'::text,
    holiday_type text DEFAULT 'Public Holiday'::text
);


--
-- Name: hr_leave; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_name text,
    leave_type text,
    start_date date,
    end_date date,
    status text DEFAULT 'pending'::text,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    staff_id text,
    approval_status text DEFAULT 'Pending'::text,
    department text,
    employee_id text,
    number_of_days integer DEFAULT 0,
    supporting_document text,
    approved_by text,
    approval_date timestamp with time zone
);


--
-- Name: hr_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_name text,
    amount numeric,
    status text DEFAULT 'pending'::text,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    staff_id text,
    purpose text,
    repayment_period text,
    approval_status text DEFAULT 'Pending'::text,
    employee_id text,
    department text,
    loan_amount numeric DEFAULT 0,
    loan_purpose text,
    repayment_amount numeric DEFAULT 0,
    repayment_frequency text,
    outstanding_balance numeric DEFAULT 0,
    total_amount_collected numeric DEFAULT 0,
    clearance_status text DEFAULT 'Active'::text,
    approved_by text,
    approval_date timestamp with time zone,
    repayment_history jsonb DEFAULT '[]'::jsonb,
    notes text
);


--
-- Name: hr_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_name text,
    employee_email text,
    rating text,
    review_notes text,
    review_date date,
    created_at timestamp with time zone DEFAULT now(),
    staff_id text,
    review_period text,
    score numeric,
    comments text,
    department text,
    country text DEFAULT 'Nigeria'::text,
    reviewer_name text,
    review_score numeric DEFAULT 0,
    performance_notes text,
    next_review_date date
);


--
-- Name: hr_training; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_training (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    employee_name text,
    status text DEFAULT 'planned'::text,
    training_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    training_title text,
    department text,
    training_topic text,
    trainer_name text,
    training_location text,
    participants jsonb DEFAULT '[]'::jsonb,
    country text DEFAULT 'Nigeria'::text,
    training_status text DEFAULT 'Scheduled'::text,
    follow_up_notes text
);


--
-- Name: inventory_dispatch_fund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_dispatch_fund_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_request_id uuid,
    rr_consumable_request_id uuid,
    repair_job_id uuid,
    request_type text DEFAULT 'dispatch_fund'::text,
    part_number text,
    part_name text,
    serial_number text,
    warehouse text DEFAULT 'Oshodi'::text,
    destination text,
    engineer_name text,
    engineer_email text,
    logistics_type text DEFAULT 'waybill'::text,
    requested_amount numeric DEFAULT 0,
    approved_amount numeric DEFAULT 0,
    reason text,
    inventory_note text,
    finance_note text,
    status text DEFAULT 'pending_finance'::text,
    finance_status text DEFAULT 'pending_review'::text,
    requested_by text,
    requested_by_email text,
    approved_by text,
    approved_by_email text,
    approved_at timestamp with time zone,
    disbursed_by text,
    disbursed_by_email text,
    disbursed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid,
    part_number text,
    item_description text,
    movement_type text,
    quantity_changed integer DEFAULT 0,
    previous_quantity integer DEFAULT 0,
    new_quantity integer DEFAULT 0,
    reason text,
    performed_by_email text,
    performed_by_name text,
    created_at timestamp with time zone DEFAULT now(),
    warehouse text
);


--
-- Name: inventory_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid,
    ticket_number text,
    terminal_id text,
    bank_name text,
    branch_name text,
    engineer_id uuid,
    engineer_name text,
    engineer_email text,
    part_id uuid,
    part_number text,
    part_name text,
    serial_number text,
    warehouse text DEFAULT 'Oshodi'::text,
    quantity_used numeric DEFAULT 0,
    unit_cost_ngn numeric DEFAULT 0,
    total_cost_ngn numeric DEFAULT 0,
    usage_type text DEFAULT 'repair'::text,
    source_module text DEFAULT 'Inventory'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text,
    client_name text,
    client_email text,
    description text,
    amount numeric DEFAULT 0,
    currency text DEFAULT 'NGN'::text,
    status text DEFAULT 'draft'::text,
    payment_source text,
    payment_mode text,
    due_date date,
    paid_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text,
    contact_name text,
    contact_email text,
    contact_phone text,
    industry text,
    source text DEFAULT 'other'::text,
    status text DEFAULT 'new'::text,
    estimated_value numeric,
    devices_interested text,
    notes text,
    next_followup date,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_name text,
    leave_type text,
    start_date date,
    end_date date,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text,
    title text,
    message text,
    type text,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    data jsonb DEFAULT '{}'::jsonb,
    link text,
    sound text DEFAULT 'bell'::text
);


--
-- Name: operations_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operations_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text,
    entity_type text,
    entity_id text,
    title text,
    description text,
    actor_name text,
    actor_id text,
    department text,
    severity text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: operations_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operations_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text,
    entity_id text,
    entity_name text,
    status text,
    latitude numeric,
    longitude numeric,
    last_seen timestamp with time zone,
    source_module text,
    metadata jsonb,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: part_lifecycle_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_lifecycle_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_id uuid,
    part_request_id uuid,
    repair_job_id uuid,
    ticket_id uuid,
    part_name text,
    part_number text,
    serial_number text,
    movement_type text NOT NULL,
    from_location text,
    to_location text,
    from_department text,
    to_department text,
    issued_to_name text,
    issued_to_email text,
    quantity numeric DEFAULT 1,
    status_before text,
    status_after text,
    notes text,
    evidence jsonb DEFAULT '[]'::jsonb,
    actor_name text,
    actor_email text,
    actor_department text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: part_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid,
    ticket_number text,
    engineer_email text,
    engineer_name text,
    part_name text NOT NULL,
    quantity integer DEFAULT 1,
    request_type text,
    reason_category text,
    reason_note text,
    evidence_photos jsonb DEFAULT '[]'::jsonb,
    approval_status text DEFAULT 'pending_operations'::text,
    approved_by text,
    approved_at timestamp with time zone,
    inventory_status text DEFAULT 'waiting_operations_approval'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    operations_status text DEFAULT 'pending_review'::text,
    finance_status text DEFAULT 'not_required'::text,
    dispatch_status text DEFAULT 'pending'::text,
    current_department text DEFAULT 'operations'::text,
    operations_note text,
    inventory_note text,
    finance_note text,
    dispatch_note text,
    status text DEFAULT 'pending_operations'::text,
    lifecycle_status text DEFAULT 'requested'::text,
    rr_status text DEFAULT 'waiting'::text,
    assigned_rr_technician uuid,
    assigned_by uuid,
    assigned_at timestamp with time zone,
    qa_status text DEFAULT 'pending'::text,
    qa_tested_by uuid,
    qa_tested_at timestamp with time zone,
    qa_notes text,
    dispatched_at timestamp with time zone,
    dispatched_by text,
    dispatched_by_email text
);


--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_number text,
    item_name text,
    quantity integer,
    amount numeric,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: repair_consumable_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_consumable_request_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    spare_part_id uuid,
    item_name text NOT NULL,
    quantity numeric DEFAULT 1,
    reason text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: repair_consumable_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_consumable_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_job_id uuid,
    requested_by text,
    approved_by text,
    released_by text,
    item_name text NOT NULL,
    quantity integer DEFAULT 1,
    reason text,
    status text DEFAULT 'pending_hod'::text,
    hod_status text DEFAULT 'pending'::text,
    inventory_status text DEFAULT 'waiting_hod'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    requested_by_name text,
    request_type text DEFAULT 'rr_repair_consumable'::text
);


--
-- Name: repair_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_number text,
    ticket_id text,
    device_name text,
    terminal_id text,
    bank_name text,
    branch_name text,
    fault_description text,
    diagnosis text,
    parts_used text,
    assigned_to text,
    status text DEFAULT 'received'::text,
    priority text DEFAULT 'medium'::text,
    received_by text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_type text,
    received_from text,
    item_name text,
    part_number text,
    machine_brand text,
    machine_model text,
    quantity_received integer DEFAULT 1,
    condition_on_arrival text,
    action_required text,
    test_result text DEFAULT 'pending'::text,
    good_quantity integer DEFAULT 0,
    bad_quantity integer DEFAULT 0,
    inventory_transfer_status text DEFAULT 'not_ready'::text,
    final_remark text,
    part_request_id uuid,
    assigned_rr_technician uuid,
    assigned_by uuid,
    assigned_at timestamp with time zone
);


--
-- Name: rr_consumable_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rr_consumable_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_job_id uuid,
    job_number text,
    failed_part text,
    requested_by uuid,
    technician_id uuid,
    status text DEFAULT 'pending_inventory'::text,
    items jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    warehouse text DEFAULT 'Oshodi'::text
);


--
-- Name: site_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engineer_email text,
    engineer_name text,
    site_name text,
    checkin_time timestamp with time zone,
    checkout_time timestamp with time zone,
    duration_minutes integer,
    checkin_lat numeric,
    checkin_lng numeric,
    work_done text,
    parts_used text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_name text,
    branch_name text,
    status text DEFAULT 'active'::text,
    latitude double precision,
    longitude double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: spare_part_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_part_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engineer_email text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    engineer_name text,
    engineer_id text,
    item_id uuid,
    item_description text,
    part_number text,
    quantity_requested integer DEFAULT 1,
    reason text,
    request_status text DEFAULT 'Pending'::text,
    approved_by text,
    approved_at timestamp with time zone,
    faulty_part_photo text,
    site_name text,
    terminal_id text,
    bank_name text,
    urgency text DEFAULT 'Normal'::text,
    notes text,
    part_id uuid,
    spare_part_id uuid,
    part_name text,
    request_number text,
    dispatched_by text,
    dispatched_at timestamp with time zone,
    received_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    ticket_id text,
    ticket_title text,
    branch_name text,
    approved_date timestamp with time zone,
    rejected_date timestamp with time zone,
    dispatched_date timestamp with time zone,
    received_date timestamp with time zone,
    approver_email text,
    dispatcher_email text,
    receiver_email text,
    rejected_by text,
    rejection_reason text
);


--
-- Name: spare_part_serials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_part_serials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    spare_part_id uuid,
    part_number text,
    serial_number text NOT NULL,
    manufacturer_serial text,
    warehouse text DEFAULT 'Oshodi'::text,
    condition text DEFAULT 'good'::text,
    status text DEFAULT 'in_stock'::text,
    assigned_to text,
    assigned_to_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    supplier text,
    purchase_date date,
    sold_to text,
    sold_at timestamp with time zone,
    scrapped_reason text,
    scrapped_at timestamp with time zone,
    current_engineer text,
    current_engineer_email text
);


--
-- Name: spare_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_name text,
    part_number text,
    category text,
    quantity integer DEFAULT 0,
    location text,
    status text DEFAULT 'available'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    description text,
    category_group text,
    device_brand text,
    device_model text,
    quantity_available integer DEFAULT 0,
    minimum_stock_level integer DEFAULT 2,
    supplier_price_usd numeric,
    unit_price_ngn numeric,
    stock_status text DEFAULT 'OUT OF STOCK'::text,
    vendor text DEFAULT 'Not specified'::text,
    storage_location text,
    total_stock_value numeric DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    warehouse text DEFAULT 'Oshodi'::text,
    serial_number text,
    manufacturer_serial text,
    serial_tracking boolean DEFAULT true,
    tracking_type text DEFAULT 'quantity'::text
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    job_title text,
    department text NOT NULL,
    location text,
    employee_id text,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number text,
    title text NOT NULL,
    description text,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'medium'::text,
    assigned_to text,
    created_by text,
    department text,
    branch text,
    created_at timestamp without time zone DEFAULT now(),
    ticket_id text,
    category text,
    client_email text,
    client_name text,
    bank_name text,
    branch_name text,
    terminal_id text,
    device_name text,
    assigned_to_name text,
    sla_level text,
    attachments jsonb DEFAULT '[]'::jsonb,
    rating integer,
    resolved_date timestamp with time zone,
    sla_deadline timestamp with time zone,
    closed_date timestamp with time zone,
    rating_comment text,
    escalated boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    assigned_engineer_email text,
    sla_status text,
    site_name text,
    completion_note text,
    completed_by text,
    evidence_photos jsonb,
    evidence_videos jsonb,
    before_photos jsonb,
    after_photos jsonb,
    completion_status text DEFAULT 'pending'::text,
    approved_by text,
    approved_at timestamp with time zone,
    accepted_at timestamp with time zone,
    started_at timestamp with time zone,
    arrived_at timestamp with time zone,
    submitted_review_at timestamp with time zone,
    client_remark text,
    client_rating integer,
    client_reviewed_by text,
    client_reviewed_at timestamp with time zone,
    closure_photo_url text,
    closure_photos jsonb DEFAULT '[]'::jsonb,
    part_request_type text,
    part_request_reason text,
    part_request_note text,
    part_request_status text DEFAULT 'none'::text,
    linked_part_request_id uuid,
    assigned_at timestamp with time zone,
    trip_started_at timestamp with time zone,
    work_started_at timestamp with time zone,
    submitted_at timestamp with time zone,
    escalated_at timestamp with time zone,
    escalation_reason text,
    escalation_level text,
    last_action_at timestamp with time zone
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text,
    department text,
    employee_id text,
    account_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_approved boolean DEFAULT false,
    role text,
    last_login timestamp with time zone,
    last_seen timestamp with time zone,
    online_status boolean DEFAULT false
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text,
    email text NOT NULL,
    role text,
    department text,
    account_status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    employee_id text,
    phone text,
    branch text,
    region text,
    is_approved boolean DEFAULT true,
    must_change_password boolean DEFAULT false,
    specialization text,
    updated_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text,
    approval_status text DEFAULT 'pending'::text,
    availability_status text DEFAULT 'offline'::text,
    latitude double precision,
    longitude double precision,
    last_location_update timestamp with time zone,
    profile_photo text,
    field_status text DEFAULT 'available'::text
);


--
-- Name: workflow_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type text,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text,
    status text DEFAULT 'pending'::text,
    requester_email text,
    requester_name text,
    approver_email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text,
    assigned_department text,
    created_by text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_devices bank_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_devices
    ADD CONSTRAINT bank_devices_pkey PRIMARY KEY (id);


--
-- Name: banks banks_bank_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_bank_name_key UNIQUE (bank_name);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: crm_clients crm_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_clients
    ADD CONSTRAINT crm_clients_pkey PRIMARY KEY (id);


--
-- Name: crm_complaints crm_complaints_complaint_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_complaints
    ADD CONSTRAINT crm_complaints_complaint_number_key UNIQUE (complaint_number);


--
-- Name: crm_complaints crm_complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_complaints
    ADD CONSTRAINT crm_complaints_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: devices devices_terminal_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_terminal_id_key UNIQUE (terminal_id);


--
-- Name: email_messages email_messages_gmail_message_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_gmail_message_id_unique UNIQUE (gmail_message_id);


--
-- Name: email_messages email_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_address_key UNIQUE (email_address);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: engineer_statuses engineer_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_statuses
    ADD CONSTRAINT engineer_statuses_pkey PRIMARY KEY (id);


--
-- Name: engineers engineers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineers
    ADD CONSTRAINT engineers_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: finance_account_balances finance_account_balances_account_id_period_start_period_end_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_account_balances
    ADD CONSTRAINT finance_account_balances_account_id_period_start_period_end_key UNIQUE (account_id, period_start, period_end);


--
-- Name: finance_account_balances finance_account_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_account_balances
    ADD CONSTRAINT finance_account_balances_pkey PRIMARY KEY (id);


--
-- Name: finance_accounts finance_accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts
    ADD CONSTRAINT finance_accounts_account_code_key UNIQUE (account_code);


--
-- Name: finance_accounts finance_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts
    ADD CONSTRAINT finance_accounts_pkey PRIMARY KEY (id);


--
-- Name: finance_audit_logs finance_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_audit_logs
    ADD CONSTRAINT finance_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: finance_bank_accounts finance_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_bank_accounts
    ADD CONSTRAINT finance_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: finance_bank_reconciliations finance_bank_reconciliations_bank_account_id_statement_star_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_bank_reconciliations
    ADD CONSTRAINT finance_bank_reconciliations_bank_account_id_statement_star_key UNIQUE (bank_account_id, statement_start, statement_end);


--
-- Name: finance_bank_reconciliations finance_bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_bank_reconciliations
    ADD CONSTRAINT finance_bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: finance_budgets finance_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budgets
    ADD CONSTRAINT finance_budgets_pkey PRIMARY KEY (id);


--
-- Name: finance_corrections finance_corrections_correction_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_corrections
    ADD CONSTRAINT finance_corrections_correction_no_key UNIQUE (correction_no);


--
-- Name: finance_corrections finance_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_corrections
    ADD CONSTRAINT finance_corrections_pkey PRIMARY KEY (id);


--
-- Name: finance_customers finance_customers_customer_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers
    ADD CONSTRAINT finance_customers_customer_email_key UNIQUE (customer_email);


--
-- Name: finance_customers finance_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers
    ADD CONSTRAINT finance_customers_pkey PRIMARY KEY (id);


--
-- Name: finance_expense_payments finance_expense_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_payments
    ADD CONSTRAINT finance_expense_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: finance_expense_payments finance_expense_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_payments
    ADD CONSTRAINT finance_expense_payments_pkey PRIMARY KEY (id);


--
-- Name: finance_expense_request_approvals finance_expense_request_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_request_approvals
    ADD CONSTRAINT finance_expense_request_approvals_pkey PRIMARY KEY (id);


--
-- Name: finance_expense_request_attachments finance_expense_request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_request_attachments
    ADD CONSTRAINT finance_expense_request_attachments_pkey PRIMARY KEY (id);


--
-- Name: finance_expense_request_history finance_expense_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_request_history
    ADD CONSTRAINT finance_expense_request_history_pkey PRIMARY KEY (id);


--
-- Name: finance_expense_requests finance_expense_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_requests
    ADD CONSTRAINT finance_expense_requests_pkey PRIMARY KEY (id);


--
-- Name: finance_expense_requests finance_expense_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_requests
    ADD CONSTRAINT finance_expense_requests_request_number_key UNIQUE (request_number);


--
-- Name: finance_fixed_assets finance_fixed_assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_asset_code_key UNIQUE (asset_code);


--
-- Name: finance_fixed_assets finance_fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_pkey PRIMARY KEY (id);


--
-- Name: finance_journal_lines finance_journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines
    ADD CONSTRAINT finance_journal_lines_pkey PRIMARY KEY (id);


--
-- Name: finance_journal_lines finance_journal_lines_unique_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines
    ADD CONSTRAINT finance_journal_lines_unique_line UNIQUE (journal_id, line_no);


--
-- Name: finance_journals finance_journals_journal_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journals
    ADD CONSTRAINT finance_journals_journal_no_key UNIQUE (journal_no);


--
-- Name: finance_journals finance_journals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journals
    ADD CONSTRAINT finance_journals_pkey PRIMARY KEY (id);


--
-- Name: finance_payable_allocations finance_payable_allocations_payable_source_table_payable_so_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payable_allocations
    ADD CONSTRAINT finance_payable_allocations_payable_source_table_payable_so_key UNIQUE (payable_source_table, payable_source_id, payment_source_table, payment_source_id);


--
-- Name: finance_payable_allocations finance_payable_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payable_allocations
    ADD CONSTRAINT finance_payable_allocations_pkey PRIMARY KEY (id);


--
-- Name: finance_payments finance_payments_payment_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_payment_no_key UNIQUE (payment_no);


--
-- Name: finance_payments finance_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_pkey PRIMARY KEY (id);


--
-- Name: finance_receivable_allocations finance_receivable_allocation_invoice_id_payment_source_tab_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_receivable_allocations
    ADD CONSTRAINT finance_receivable_allocation_invoice_id_payment_source_tab_key UNIQUE (invoice_id, payment_source_table, payment_source_id);


--
-- Name: finance_receivable_allocations finance_receivable_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_receivable_allocations
    ADD CONSTRAINT finance_receivable_allocations_pkey PRIMARY KEY (id);


--
-- Name: finance_suppliers finance_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_suppliers
    ADD CONSTRAINT finance_suppliers_pkey PRIMARY KEY (id);


--
-- Name: finance_suppliers finance_suppliers_supplier_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_suppliers
    ADD CONSTRAINT finance_suppliers_supplier_email_key UNIQUE (supplier_email);


--
-- Name: fund_requests fund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_requests
    ADD CONSTRAINT fund_requests_pkey PRIMARY KEY (id);


--
-- Name: gmail_connections gmail_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_connections
    ADD CONSTRAINT gmail_connections_pkey PRIMARY KEY (id);


--
-- Name: hr_attendance hr_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance
    ADD CONSTRAINT hr_attendance_pkey PRIMARY KEY (id);


--
-- Name: hr_holidays hr_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_holidays
    ADD CONSTRAINT hr_holidays_pkey PRIMARY KEY (id);


--
-- Name: hr_leave hr_leave_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave
    ADD CONSTRAINT hr_leave_pkey PRIMARY KEY (id);


--
-- Name: hr_loans hr_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_loans
    ADD CONSTRAINT hr_loans_pkey PRIMARY KEY (id);


--
-- Name: hr_performance hr_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_performance
    ADD CONSTRAINT hr_performance_pkey PRIMARY KEY (id);


--
-- Name: hr_training hr_training_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_training
    ADD CONSTRAINT hr_training_pkey PRIMARY KEY (id);


--
-- Name: inventory_dispatch_fund_requests inventory_dispatch_fund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_dispatch_fund_requests
    ADD CONSTRAINT inventory_dispatch_fund_requests_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_usage_logs inventory_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_usage_logs
    ADD CONSTRAINT inventory_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: lpos lpos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lpos
    ADD CONSTRAINT lpos_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: operations_events operations_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations_events
    ADD CONSTRAINT operations_events_pkey PRIMARY KEY (id);


--
-- Name: operations_status operations_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations_status
    ADD CONSTRAINT operations_status_pkey PRIMARY KEY (id);


--
-- Name: part_lifecycle_logs part_lifecycle_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_lifecycle_logs
    ADD CONSTRAINT part_lifecycle_logs_pkey PRIMARY KEY (id);


--
-- Name: part_requests part_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: repair_consumable_request_items repair_consumable_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_consumable_request_items
    ADD CONSTRAINT repair_consumable_request_items_pkey PRIMARY KEY (id);


--
-- Name: repair_consumable_requests repair_consumable_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_consumable_requests
    ADD CONSTRAINT repair_consumable_requests_pkey PRIMARY KEY (id);


--
-- Name: repair_jobs repair_jobs_job_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_jobs
    ADD CONSTRAINT repair_jobs_job_number_key UNIQUE (job_number);


--
-- Name: repair_jobs repair_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_jobs
    ADD CONSTRAINT repair_jobs_pkey PRIMARY KEY (id);


--
-- Name: rr_consumable_requests rr_consumable_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rr_consumable_requests
    ADD CONSTRAINT rr_consumable_requests_pkey PRIMARY KEY (id);


--
-- Name: site_visits site_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_visits
    ADD CONSTRAINT site_visits_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: spare_part_requests spare_part_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_requests
    ADD CONSTRAINT spare_part_requests_pkey PRIMARY KEY (id);


--
-- Name: spare_part_serials spare_part_serials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_serials
    ADD CONSTRAINT spare_part_serials_pkey PRIMARY KEY (id);


--
-- Name: spare_part_serials spare_part_serials_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_serials
    ADD CONSTRAINT spare_part_serials_serial_number_key UNIQUE (serial_number);


--
-- Name: spare_parts spare_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_parts
    ADD CONSTRAINT spare_parts_pkey PRIMARY KEY (id);


--
-- Name: staff staff_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_email_key UNIQUE (user_email);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workflow_requests workflow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_requests
    ADD CONSTRAINT workflow_requests_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: banks_bank_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX banks_bank_name_unique ON public.banks USING btree (bank_name);


--
-- Name: branches_branch_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX branches_branch_key_unique ON public.branches USING btree (branch_key);


--
-- Name: devices_terminal_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX devices_terminal_id_unique ON public.devices USING btree (terminal_id);


--
-- Name: expenses_expense_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_expense_request_idx ON public.expenses USING btree (expense_request_id);


--
-- Name: finance_accounts_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_accounts_parent_idx ON public.finance_accounts USING btree (parent_account_id);


--
-- Name: finance_accounts_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_accounts_type_idx ON public.finance_accounts USING btree (account_type);


--
-- Name: finance_audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_audit_logs_created_at_idx ON public.finance_audit_logs USING btree (created_at);


--
-- Name: finance_audit_logs_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_audit_logs_entity_idx ON public.finance_audit_logs USING btree (entity_table, entity_id);


--
-- Name: finance_bank_accounts_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_bank_accounts_account_idx ON public.finance_bank_accounts USING btree (account_id);


--
-- Name: finance_budgets_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_budgets_department_idx ON public.finance_budgets USING btree (department);


--
-- Name: finance_corrections_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_corrections_source_idx ON public.finance_corrections USING btree (source_table, source_id);


--
-- Name: finance_expense_payments_journal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_payments_journal_idx ON public.finance_expense_payments USING btree (journal_id);


--
-- Name: finance_expense_payments_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_payments_request_idx ON public.finance_expense_payments USING btree (expense_request_id);


--
-- Name: finance_expense_request_approvals_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_request_approvals_request_idx ON public.finance_expense_request_approvals USING btree (expense_request_id);


--
-- Name: finance_expense_request_attachments_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_request_attachments_request_idx ON public.finance_expense_request_attachments USING btree (expense_request_id);


--
-- Name: finance_expense_request_history_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_request_history_request_idx ON public.finance_expense_request_history USING btree (expense_request_id);


--
-- Name: finance_expense_requests_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_requests_department_idx ON public.finance_expense_requests USING btree (department);


--
-- Name: finance_expense_requests_requester_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_requests_requester_idx ON public.finance_expense_requests USING btree (requester_email);


--
-- Name: finance_expense_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_requests_status_idx ON public.finance_expense_requests USING btree (status, payment_status);


--
-- Name: finance_fixed_assets_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_fixed_assets_department_idx ON public.finance_fixed_assets USING btree (assigned_department);


--
-- Name: finance_fixed_assets_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_fixed_assets_status_idx ON public.finance_fixed_assets USING btree (status);


--
-- Name: finance_journal_lines_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_journal_lines_account_idx ON public.finance_journal_lines USING btree (account_id);


--
-- Name: finance_journal_lines_journal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_journal_lines_journal_idx ON public.finance_journal_lines USING btree (journal_id);


--
-- Name: finance_journals_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_journals_date_idx ON public.finance_journals USING btree (journal_date);


--
-- Name: finance_journals_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_journals_source_idx ON public.finance_journals USING btree (source_module, source_table, source_id);


--
-- Name: finance_journals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_journals_status_idx ON public.finance_journals USING btree (status);


--
-- Name: finance_payments_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_payments_source_idx ON public.finance_payments USING btree (source_table, source_id);


--
-- Name: finance_payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_payments_status_idx ON public.finance_payments USING btree (status);


--
-- Name: finance_tax_codes_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX finance_tax_codes_id_uidx ON public.finance_tax_codes USING btree (id);


--
-- Name: gmail_connections_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gmail_connections_email_key ON public.gmail_connections USING btree (email);


--
-- Name: gmail_connections_user_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gmail_connections_user_active_unique ON public.gmail_connections USING btree (user_id) WHERE (is_active = true);


--
-- Name: idx_dispatch_fund_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_fund_created ON public.inventory_dispatch_fund_requests USING btree (created_at);


--
-- Name: idx_dispatch_fund_engineer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_fund_engineer ON public.inventory_dispatch_fund_requests USING btree (engineer_email);


--
-- Name: idx_dispatch_fund_finance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_fund_finance_status ON public.inventory_dispatch_fund_requests USING btree (finance_status);


--
-- Name: idx_dispatch_fund_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_fund_status ON public.inventory_dispatch_fund_requests USING btree (status);


--
-- Name: idx_inventory_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_warehouse ON public.inventory_movements USING btree (warehouse);


--
-- Name: idx_rr_consumable_requests_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_consumable_requests_warehouse ON public.rr_consumable_requests USING btree (warehouse);


--
-- Name: idx_spare_part_serials_serial_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_serials_serial_number ON public.spare_part_serials USING btree (serial_number);


--
-- Name: idx_spare_part_serials_spare_part_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_serials_spare_part_id ON public.spare_part_serials USING btree (spare_part_id);


--
-- Name: idx_spare_part_serials_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_serials_status ON public.spare_part_serials USING btree (status);


--
-- Name: idx_spare_part_serials_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_serials_warehouse ON public.spare_part_serials USING btree (warehouse);


--
-- Name: idx_spare_parts_manufacturer_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_parts_manufacturer_serial ON public.spare_parts USING btree (manufacturer_serial);


--
-- Name: idx_spare_parts_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_parts_serial ON public.spare_parts USING btree (serial_number);


--
-- Name: idx_spare_parts_serial_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_parts_serial_number ON public.spare_parts USING btree (serial_number);


--
-- Name: idx_spare_parts_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_parts_warehouse ON public.spare_parts USING btree (warehouse);


--
-- Name: idx_user_profiles_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_last_seen ON public.user_profiles USING btree (last_seen);


--
-- Name: operations_status_entity_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX operations_status_entity_unique ON public.operations_status USING btree (entity_type, entity_id);


--
-- Name: users_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);


--
-- Name: finance_expense_payments finance_expense_payments_sync_request_totals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER finance_expense_payments_sync_request_totals AFTER INSERT OR DELETE OR UPDATE ON public.finance_expense_payments FOR EACH ROW EXECUTE FUNCTION public.finance_sync_expense_request_payment_totals();


--
-- Name: finance_expense_requests finance_expense_requests_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER finance_expense_requests_touch_updated_at BEFORE UPDATE ON public.finance_expense_requests FOR EACH ROW EXECUTE FUNCTION public.finance_expense_request_touch_updated_at();


--
-- Name: finance_journal_lines finance_journal_lines_guard_posted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER finance_journal_lines_guard_posted BEFORE INSERT OR DELETE OR UPDATE ON public.finance_journal_lines FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posted_journal_lines();


--
-- Name: finance_journals finance_journals_guard_posting; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER finance_journals_guard_posting BEFORE INSERT OR DELETE OR UPDATE ON public.finance_journals FOR EACH ROW EXECUTE FUNCTION public.finance_guard_journal_posting();


--
-- Name: part_requests trg_create_repair_job_from_part_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_create_repair_job_from_part_request AFTER UPDATE ON public.part_requests FOR EACH ROW EXECUTE FUNCTION public.create_repair_job_from_part_request();


--
-- Name: devices trg_normalize_device_engineer_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_device_engineer_assignment BEFORE INSERT OR UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.normalize_device_engineer_assignment();


--
-- Name: users trg_sync_employee_role_from_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_employee_role_from_user AFTER INSERT OR UPDATE OF role, department, email ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_employee_role_from_user();


--
-- Name: crm_complaints crm_complaints_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_complaints
    ADD CONSTRAINT crm_complaints_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.crm_clients(id) ON DELETE SET NULL;


--
-- Name: email_messages email_messages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: expenses expenses_expense_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_expense_request_id_fkey FOREIGN KEY (expense_request_id) REFERENCES public.finance_expense_requests(id);


--
-- Name: finance_account_balances finance_account_balances_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_account_balances
    ADD CONSTRAINT finance_account_balances_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(id);


--
-- Name: finance_accounts finance_accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts
    ADD CONSTRAINT finance_accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.finance_accounts(id);


--
-- Name: finance_bank_accounts finance_bank_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_bank_accounts
    ADD CONSTRAINT finance_bank_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(id);


--
-- Name: finance_bank_reconciliations finance_bank_reconciliations_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_bank_reconciliations
    ADD CONSTRAINT finance_bank_reconciliations_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.finance_bank_accounts(id);


--
-- Name: finance_budgets finance_budgets_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_budgets
    ADD CONSTRAINT finance_budgets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(id);


--
-- Name: finance_corrections finance_corrections_adjustment_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_corrections
    ADD CONSTRAINT finance_corrections_adjustment_journal_id_fkey FOREIGN KEY (adjustment_journal_id) REFERENCES public.finance_journals(id);


--
-- Name: finance_expense_payments finance_expense_payments_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_payments
    ADD CONSTRAINT finance_expense_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.finance_bank_accounts(id);


--
-- Name: finance_expense_payments finance_expense_payments_expense_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_payments
    ADD CONSTRAINT finance_expense_payments_expense_request_id_fkey FOREIGN KEY (expense_request_id) REFERENCES public.finance_expense_requests(id) ON DELETE CASCADE;


--
-- Name: finance_expense_payments finance_expense_payments_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_payments
    ADD CONSTRAINT finance_expense_payments_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.finance_journals(id);


--
-- Name: finance_expense_request_approvals finance_expense_request_approvals_expense_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_request_approvals
    ADD CONSTRAINT finance_expense_request_approvals_expense_request_id_fkey FOREIGN KEY (expense_request_id) REFERENCES public.finance_expense_requests(id) ON DELETE CASCADE;


--
-- Name: finance_expense_request_attachments finance_expense_request_attachments_expense_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_request_attachments
    ADD CONSTRAINT finance_expense_request_attachments_expense_request_id_fkey FOREIGN KEY (expense_request_id) REFERENCES public.finance_expense_requests(id) ON DELETE CASCADE;


--
-- Name: finance_expense_request_history finance_expense_request_history_expense_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_request_history
    ADD CONSTRAINT finance_expense_request_history_expense_request_id_fkey FOREIGN KEY (expense_request_id) REFERENCES public.finance_expense_requests(id) ON DELETE CASCADE;


--
-- Name: finance_expense_requests finance_expense_requests_resulting_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_requests
    ADD CONSTRAINT finance_expense_requests_resulting_journal_id_fkey FOREIGN KEY (resulting_journal_id) REFERENCES public.finance_journals(id);


--
-- Name: finance_fixed_assets finance_fixed_assets_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_fixed_assets
    ADD CONSTRAINT finance_fixed_assets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(id);


--
-- Name: finance_journal_lines finance_journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines
    ADD CONSTRAINT finance_journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(id);


--
-- Name: finance_journal_lines finance_journal_lines_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journal_lines
    ADD CONSTRAINT finance_journal_lines_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.finance_journals(id) ON DELETE CASCADE;


--
-- Name: finance_journals finance_journals_reversal_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_journals
    ADD CONSTRAINT finance_journals_reversal_of_fkey FOREIGN KEY (reversal_of) REFERENCES public.finance_journals(id);


--
-- Name: finance_payable_allocations finance_payable_allocations_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payable_allocations
    ADD CONSTRAINT finance_payable_allocations_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.finance_journals(id);


--
-- Name: finance_payments finance_payments_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.finance_bank_accounts(id);


--
-- Name: finance_payments finance_payments_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.finance_journals(id);


--
-- Name: finance_receivable_allocations finance_receivable_allocations_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_receivable_allocations
    ADD CONSTRAINT finance_receivable_allocations_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.finance_journals(id);


--
-- Name: finance_tax_codes finance_tax_codes_default_credit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_tax_codes
    ADD CONSTRAINT finance_tax_codes_default_credit_account_id_fkey FOREIGN KEY (default_credit_account_id) REFERENCES public.finance_accounts(id);


--
-- Name: finance_tax_codes finance_tax_codes_default_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_tax_codes
    ADD CONSTRAINT finance_tax_codes_default_debit_account_id_fkey FOREIGN KEY (default_debit_account_id) REFERENCES public.finance_accounts(id);


--
-- Name: gmail_connections gmail_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_connections
    ADD CONSTRAINT gmail_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: part_requests part_requests_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: repair_consumable_request_items repair_consumable_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_consumable_request_items
    ADD CONSTRAINT repair_consumable_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.repair_consumable_requests(id) ON DELETE CASCADE;


--
-- Name: spare_part_serials spare_part_serials_spare_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_serials
    ADD CONSTRAINT spare_part_serials_spare_part_id_fkey FOREIGN KEY (spare_part_id) REFERENCES public.spare_parts(id) ON DELETE CASCADE;


--
-- Name: rr_consumable_requests Allow all rr consumable requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all rr consumable requests" ON public.rr_consumable_requests USING (true) WITH CHECK (true);


--
-- Name: engineer_statuses Allow authenticated engineer statuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated engineer statuses" ON public.engineer_statuses TO authenticated USING (true) WITH CHECK (true);


--
-- Name: expenses Allow authenticated expenses access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated expenses access" ON public.expenses TO authenticated USING (true) WITH CHECK (true);


--
-- Name: invoices Allow authenticated invoices access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated invoices access" ON public.invoices TO authenticated USING (true) WITH CHECK (true);


--
-- Name: email_messages Allow authenticated users full email access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full email access" ON public.email_messages TO authenticated USING (true) WITH CHECK (true);


--
-- Name: tickets Allow authenticated users full tickets access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full tickets access" ON public.tickets TO authenticated USING (true) WITH CHECK (true);


--
-- Name: user_profiles Allow authenticated users full user_profiles access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full user_profiles access" ON public.user_profiles TO authenticated USING (true) WITH CHECK (true);


--
-- Name: spare_part_requests Allow authenticated users to create spare part requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to create spare part requests" ON public.spare_part_requests FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: bank_devices Allow authenticated users to read bank devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read bank devices" ON public.bank_devices FOR SELECT TO authenticated USING (true);


--
-- Name: banks Allow authenticated users to read banks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read banks" ON public.banks FOR SELECT TO authenticated USING (true);


--
-- Name: branches Allow authenticated users to read branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read branches" ON public.branches FOR SELECT TO authenticated USING (true);


--
-- Name: devices Allow authenticated users to read devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read devices" ON public.devices FOR SELECT TO authenticated USING (true);


--
-- Name: engineers Allow authenticated users to read engineers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read engineers" ON public.engineers FOR SELECT TO authenticated USING (true);


--
-- Name: notifications Allow authenticated users to read notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);


--
-- Name: sites Allow authenticated users to read sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read sites" ON public.sites FOR SELECT TO authenticated USING (true);


--
-- Name: spare_part_requests Allow authenticated users to read spare part requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read spare part requests" ON public.spare_part_requests FOR SELECT TO authenticated USING (true);


--
-- Name: spare_parts Allow authenticated users to read spare parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read spare parts" ON public.spare_parts FOR SELECT TO authenticated USING (true);


--
-- Name: spare_part_requests Allow authenticated users to update spare part requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update spare part requests" ON public.spare_part_requests FOR UPDATE TO authenticated USING (true);


--
-- Name: users Allow pending registration insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow pending registration insert" ON public.users FOR INSERT TO authenticated, anon WITH CHECK (((email IS NOT NULL) AND (role IS NULL) AND (status = 'pending'::text) AND (approval_status = 'pending'::text) AND (is_approved = false)));


--
-- Name: users Allow pending registration upsert update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow pending registration upsert update" ON public.users FOR UPDATE TO authenticated, anon USING (((role IS NULL) AND (status = 'pending'::text) AND (approval_status = 'pending'::text) AND (is_approved = false))) WITH CHECK (((role IS NULL) AND (status = 'pending'::text) AND (approval_status = 'pending'::text) AND (is_approved = false)));


--
-- Name: users Allow users read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users read own profile" ON public.users FOR SELECT TO authenticated USING (((id = auth.uid()) OR (email = auth.email())));


--
-- Name: part_requests Authenticated users can create part requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create part requests" ON public.part_requests FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: part_requests Authenticated users can update part requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update part requests" ON public.part_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: part_requests Authenticated users can view part requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view part requests" ON public.part_requests FOR SELECT TO authenticated USING (true);


--
-- Name: finance_accounts Finance accounts readable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance accounts readable by authenticated users" ON public.finance_accounts FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_dispatch_fund_requests Finance can update dispatch fund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance can update dispatch fund requests" ON public.inventory_dispatch_fund_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles up
  WHERE ((lower(up.user_email) = lower((auth.jwt() ->> 'email'::text))) AND (lower(up.role) = ANY (ARRAY['finance'::text, 'account'::text, 'accounts'::text, 'accountant'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles up
  WHERE ((lower(up.user_email) = lower((auth.jwt() ->> 'email'::text))) AND (lower(up.role) = ANY (ARRAY['finance'::text, 'account'::text, 'accounts'::text, 'accountant'::text, 'admin'::text]))))));


--
-- Name: inventory_dispatch_fund_requests Finance can view dispatch fund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance can view dispatch fund requests" ON public.inventory_dispatch_fund_requests FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_dispatch_fund_requests Inventory can create dispatch fund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inventory can create dispatch fund requests" ON public.inventory_dispatch_fund_requests FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles up
  WHERE ((lower(up.user_email) = lower((auth.jwt() ->> 'email'::text))) AND ((lower(COALESCE(up.role, ''::text)) = ANY (ARRAY['inventory'::text, 'inventory_manager'::text, 'admin'::text])) OR (lower(COALESCE(up.department, ''::text)) ~~ '%inventory%'::text))))));


--
-- Name: inventory_dispatch_fund_requests Inventory can view own dispatch fund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inventory can view own dispatch fund requests" ON public.inventory_dispatch_fund_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles up
  WHERE ((lower(up.user_email) = lower((auth.jwt() ->> 'email'::text))) AND ((lower(COALESCE(up.role, ''::text)) = ANY (ARRAY['inventory'::text, 'inventory_manager'::text, 'admin'::text])) OR (lower(COALESCE(up.department, ''::text)) ~~ '%inventory%'::text))))));


--
-- Name: inventory_dispatch_fund_requests Management can view dispatch fund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Management can view dispatch fund requests" ON public.inventory_dispatch_fund_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles up
  WHERE ((lower(up.user_email) = lower((auth.jwt() ->> 'email'::text))) AND (lower(up.role) = ANY (ARRAY['ceo'::text, 'agm'::text, 'operations'::text, 'admin'::text]))))));


--
-- Name: repair_jobs RR leaders can view all repair jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RR leaders can view all repair jobs" ON public.repair_jobs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles up
  WHERE ((lower(up.user_email) = lower((auth.jwt() ->> 'email'::text))) AND (lower(up.role) = ANY (ARRAY['admin'::text, 'rr_hod'::text, 'ceo'::text, 'agm'::text]))))));


--
-- Name: repair_jobs RR tech can view assigned repair jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RR tech can view assigned repair jobs" ON public.repair_jobs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles up
  WHERE ((up.id = repair_jobs.assigned_rr_technician) AND (lower(up.user_email) = lower((auth.jwt() ->> 'email'::text)))))));


--
-- Name: email_messages Users can read own emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own emails" ON public.email_messages FOR SELECT TO authenticated USING ((auth.uid() = created_by));


--
-- Name: gmail_connections Users can read own gmail connection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own gmail connection" ON public.gmail_connections FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_profiles admin can manage user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can manage user_profiles" ON public.user_profiles TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((lower(u.email) = lower(auth.email())) AND (u.email = 'iamkizmith@gmail.com'::text) AND (u.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((lower(u.email) = lower(auth.email())) AND (u.email = 'iamkizmith@gmail.com'::text) AND (u.role = 'admin'::text)))));


--
-- Name: users allow admins to insert users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow admins to insert users" ON public.users FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((lower(u.email) = lower((auth.jwt() ->> 'email'::text))) AND (u.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: users allow admins to update users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow admins to update users" ON public.users FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((lower(u.email) = lower((auth.jwt() ->> 'email'::text))) AND (u.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((lower(u.email) = lower((auth.jwt() ->> 'email'::text))) AND (u.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: tickets allow authenticated users to create tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow authenticated users to create tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tickets allow authenticated users to read tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow authenticated users to read tickets" ON public.tickets FOR SELECT TO authenticated USING (true);


--
-- Name: users allow authenticated users to read users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow authenticated users to read users" ON public.users FOR SELECT TO authenticated USING (true);


--
-- Name: users allow authenticated users to update own user row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow authenticated users to update own user row" ON public.users FOR UPDATE TO authenticated USING ((email = (auth.jwt() ->> 'email'::text))) WITH CHECK ((email = (auth.jwt() ->> 'email'::text)));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_all ON public.audit_logs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: user_profiles authenticated can read user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read user_profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: bank_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_devices bank_devices_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bank_devices_all ON public.bank_devices TO authenticated USING (true) WITH CHECK (true);


--
-- Name: banks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

--
-- Name: banks banks_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY banks_all ON public.banks TO authenticated USING (true) WITH CHECK (true);


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: branches branches_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branches_all ON public.branches TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_all ON public.comments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: crm_clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_complaints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_complaints ENABLE ROW LEVEL SECURITY;

--
-- Name: spare_parts delete spare parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete spare parts" ON public.spare_parts FOR DELETE TO authenticated USING (true);


--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

--
-- Name: email_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: email_messages email_messages_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_all ON public.email_messages TO authenticated USING (true) WITH CHECK (true);


--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: employees employees_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_all ON public.employees TO authenticated USING (true) WITH CHECK (true);


--
-- Name: engineer_statuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engineer_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: engineer_statuses engineer_statuses_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY engineer_statuses_all ON public.engineer_statuses TO authenticated USING (true) WITH CHECK (true);


--
-- Name: engineer_statuses engineer_statuses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY engineer_statuses_insert ON public.engineer_statuses FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: engineer_statuses engineer_statuses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY engineer_statuses_select ON public.engineer_statuses FOR SELECT TO authenticated USING (true);


--
-- Name: engineer_statuses engineer_statuses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY engineer_statuses_update ON public.engineer_statuses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: engineers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

--
-- Name: engineers engineers_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY engineers_all ON public.engineers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_account_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_account_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_bank_reconciliations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_bank_reconciliations ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_corrections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_expense_request_approvals finance_expense_approvals_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_approvals_insert ON public.finance_expense_request_approvals FOR INSERT TO authenticated WITH CHECK ((public.finance_is_expense_approver_role() OR public.finance_is_privileged_expense_role()));


--
-- Name: finance_expense_request_approvals finance_expense_approvals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_approvals_select ON public.finance_expense_request_approvals FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.finance_expense_requests r
  WHERE ((r.id = finance_expense_request_approvals.expense_request_id) AND ((lower(COALESCE(r.requester_email, ''::text)) = public.finance_current_user_email()) OR public.finance_is_expense_approver_role() OR public.finance_is_privileged_expense_role())))));


--
-- Name: finance_expense_request_attachments finance_expense_attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_attachments_insert ON public.finance_expense_request_attachments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.finance_expense_requests r
  WHERE ((r.id = finance_expense_request_attachments.expense_request_id) AND ((lower(COALESCE(r.requester_email, ''::text)) = public.finance_current_user_email()) OR public.finance_is_privileged_expense_role())))));


--
-- Name: finance_expense_request_attachments finance_expense_attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_attachments_select ON public.finance_expense_request_attachments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.finance_expense_requests r
  WHERE ((r.id = finance_expense_request_attachments.expense_request_id) AND ((lower(COALESCE(r.requester_email, ''::text)) = public.finance_current_user_email()) OR public.finance_is_expense_approver_role() OR public.finance_is_privileged_expense_role())))));


--
-- Name: finance_expense_request_history finance_expense_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_history_insert ON public.finance_expense_request_history FOR INSERT TO authenticated WITH CHECK ((public.finance_is_expense_approver_role() OR public.finance_is_privileged_expense_role() OR (EXISTS ( SELECT 1
   FROM public.finance_expense_requests r
  WHERE ((r.id = finance_expense_request_history.expense_request_id) AND (lower(COALESCE(r.requester_email, ''::text)) = public.finance_current_user_email()))))));


--
-- Name: finance_expense_request_history finance_expense_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_history_select ON public.finance_expense_request_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.finance_expense_requests r
  WHERE ((r.id = finance_expense_request_history.expense_request_id) AND ((lower(COALESCE(r.requester_email, ''::text)) = public.finance_current_user_email()) OR public.finance_is_expense_approver_role() OR public.finance_is_privileged_expense_role())))));


--
-- Name: finance_expense_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_expense_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_expense_payments finance_expense_payments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_payments_insert ON public.finance_expense_payments FOR INSERT TO authenticated WITH CHECK (public.finance_is_privileged_expense_role());


--
-- Name: finance_expense_payments finance_expense_payments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_payments_select ON public.finance_expense_payments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.finance_expense_requests r
  WHERE ((r.id = finance_expense_payments.expense_request_id) AND ((lower(COALESCE(r.requester_email, ''::text)) = public.finance_current_user_email()) OR public.finance_is_expense_approver_role() OR public.finance_is_privileged_expense_role())))));


--
-- Name: finance_expense_request_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_expense_request_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_expense_request_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_expense_request_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_expense_request_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_expense_request_history ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_expense_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_expense_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_expense_requests finance_expense_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_requests_insert ON public.finance_expense_requests FOR INSERT TO authenticated WITH CHECK (((lower(COALESCE(requester_email, ''::text)) = public.finance_current_user_email()) OR public.finance_is_privileged_expense_role()));


--
-- Name: finance_expense_requests finance_expense_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_requests_select ON public.finance_expense_requests FOR SELECT TO authenticated USING (((lower(COALESCE(requester_email, ''::text)) = public.finance_current_user_email()) OR public.finance_is_expense_approver_role() OR public.finance_is_privileged_expense_role()));


--
-- Name: finance_expense_requests finance_expense_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_expense_requests_update ON public.finance_expense_requests FOR UPDATE TO authenticated USING ((public.finance_is_privileged_expense_role() OR public.finance_is_expense_approver_role() OR ((lower(COALESCE(requester_email, ''::text)) = public.finance_current_user_email()) AND (status = ANY (ARRAY['draft'::text, 'returned_for_correction'::text]))))) WITH CHECK ((public.finance_is_privileged_expense_role() OR public.finance_is_expense_approver_role() OR ((lower(COALESCE(requester_email, ''::text)) = public.finance_current_user_email()) AND (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'pending_approval'::text])))));


--
-- Name: finance_fixed_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_fixed_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_journal_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_journal_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_journals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_journals ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_payable_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_payable_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_receivable_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_receivable_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_tax_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_tax_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_tax_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_tax_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_tax_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_tax_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_tax_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_tax_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_tax_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_tax_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_requests fund_requests_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fund_requests_insert_own ON public.fund_requests FOR INSERT TO authenticated WITH CHECK ((requested_by_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: fund_requests fund_requests_select_secure; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fund_requests_select_secure ON public.fund_requests FOR SELECT TO authenticated USING (((lower(COALESCE(requested_by_email, ''::text)) = public.finance_current_user_email()) OR (public.finance_current_user_role() = ANY (ARRAY['system_admin'::text, 'admin'::text, 'ceo'::text, 'agm'::text, 'hr'::text, 'operations'::text, 'operation'::text, 'ops'::text, 'manager'::text, 'operational_manager'::text, 'finance_manager'::text, 'head_of_account'::text, 'finance'::text, 'account'::text, 'accounts'::text, 'accountant'::text]))));


--
-- Name: fund_requests fund_requests_update_approvers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fund_requests_update_approvers ON public.fund_requests FOR UPDATE TO authenticated USING ((public.finance_current_user_role() = ANY (ARRAY['system_admin'::text, 'admin'::text, 'ceo'::text, 'agm'::text, 'hr'::text, 'operations'::text, 'operation'::text, 'ops'::text, 'manager'::text, 'operational_manager'::text, 'finance_manager'::text, 'head_of_account'::text, 'finance'::text, 'account'::text, 'accounts'::text, 'accountant'::text]))) WITH CHECK ((public.finance_current_user_role() = ANY (ARRAY['system_admin'::text, 'admin'::text, 'ceo'::text, 'agm'::text, 'hr'::text, 'operations'::text, 'operation'::text, 'ops'::text, 'manager'::text, 'operational_manager'::text, 'finance_manager'::text, 'head_of_account'::text, 'finance'::text, 'account'::text, 'accounts'::text, 'accountant'::text])));


--
-- Name: gmail_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_holidays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_leave; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_leave ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_loans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_loans ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_training; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_training ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages insert chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert chat" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: spare_parts insert spare parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert spare parts" ON public.spare_parts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: inventory_dispatch_fund_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_dispatch_fund_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_movements inventory_movements_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_movements_all ON public.inventory_movements TO authenticated USING (true) WITH CHECK (true);


--
-- Name: inventory_usage_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests leave_requests_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leave_requests_all ON public.leave_requests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lpos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lpos ENABLE ROW LEVEL SECURITY;

--
-- Name: lpos lpos_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lpos_all ON public.lpos TO authenticated USING (true) WITH CHECK (true);


--
-- Name: banks manage banks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage banks" ON public.banks TO authenticated USING (true) WITH CHECK (true);


--
-- Name: branches manage branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage branches" ON public.branches TO authenticated USING (true) WITH CHECK (true);


--
-- Name: devices manage devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage devices" ON public.devices TO authenticated USING (true) WITH CHECK (true);


--
-- Name: employees manage employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage employees" ON public.employees TO authenticated USING (true) WITH CHECK (true);


--
-- Name: engineer_statuses manage engineer statuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage engineer statuses" ON public.engineer_statuses TO authenticated USING (true) WITH CHECK (true);


--
-- Name: engineers manage engineers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage engineers" ON public.engineers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: hr_attendance manage hr_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage hr_attendance" ON public.hr_attendance TO authenticated USING (true) WITH CHECK (true);


--
-- Name: hr_holidays manage hr_holidays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage hr_holidays" ON public.hr_holidays TO authenticated USING (true) WITH CHECK (true);


--
-- Name: hr_leave manage hr_leave; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage hr_leave" ON public.hr_leave TO authenticated USING (true) WITH CHECK (true);


--
-- Name: hr_loans manage hr_loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage hr_loans" ON public.hr_loans TO authenticated USING (true) WITH CHECK (true);


--
-- Name: hr_performance manage hr_performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage hr_performance" ON public.hr_performance TO authenticated USING (true) WITH CHECK (true);


--
-- Name: hr_training manage hr_training; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage hr_training" ON public.hr_training TO authenticated USING (true) WITH CHECK (true);


--
-- Name: leads manage leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage leads" ON public.leads TO authenticated USING (true) WITH CHECK (true);


--
-- Name: notifications manage notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage notifications" ON public.notifications TO authenticated USING (true) WITH CHECK (true);


--
-- Name: site_visits manage site visits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage site visits" ON public.site_visits TO authenticated USING (true) WITH CHECK (true);


--
-- Name: spare_part_requests manage spare requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manage spare requests" ON public.spare_part_requests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE TO authenticated USING ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: notifications notifications_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert_auth ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING ((user_email = (auth.jwt() ->> 'email'::text))) WITH CHECK ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: operations_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operations_events ENABLE ROW LEVEL SECURITY;

--
-- Name: operations_events operations_events_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operations_events_insert_all ON public.operations_events FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: operations_events operations_events_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operations_events_select_all ON public.operations_events FOR SELECT TO authenticated, anon USING (true);


--
-- Name: operations_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operations_status ENABLE ROW LEVEL SECURITY;

--
-- Name: operations_status operations_status_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operations_status_insert_all ON public.operations_status FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: operations_status operations_status_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operations_status_select_all ON public.operations_status FOR SELECT TO authenticated, anon USING (true);


--
-- Name: operations_status operations_status_update_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operations_status_update_all ON public.operations_status FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: part_lifecycle_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.part_lifecycle_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: part_lifecycle_logs part_lifecycle_logs_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY part_lifecycle_logs_all ON public.part_lifecycle_logs TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: part_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_requests purchase_requests_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_requests_all ON public.purchase_requests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: audit_logs read audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);


--
-- Name: banks read banks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read banks" ON public.banks FOR SELECT TO authenticated USING (true);


--
-- Name: branches read branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read branches" ON public.branches FOR SELECT TO authenticated USING (true);


--
-- Name: chat_messages read chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read chat" ON public.chat_messages FOR SELECT TO authenticated USING (true);


--
-- Name: devices read devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read devices" ON public.devices FOR SELECT TO authenticated USING (true);


--
-- Name: employees read employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read employees" ON public.employees FOR SELECT TO authenticated USING (true);


--
-- Name: engineer_statuses read engineer statuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read engineer statuses" ON public.engineer_statuses FOR SELECT TO authenticated USING (true);


--
-- Name: engineers read engineers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read engineers" ON public.engineers FOR SELECT TO authenticated USING (true);


--
-- Name: leads read leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read leads" ON public.leads FOR SELECT TO authenticated USING (true);


--
-- Name: notifications read notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);


--
-- Name: site_visits read site visits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read site visits" ON public.site_visits FOR SELECT TO authenticated USING (true);


--
-- Name: spare_parts read spare parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read spare parts" ON public.spare_parts FOR SELECT TO authenticated USING (true);


--
-- Name: spare_part_requests read spare requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read spare requests" ON public.spare_part_requests FOR SELECT TO authenticated USING (true);


--
-- Name: repair_consumable_request_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repair_consumable_request_items ENABLE ROW LEVEL SECURITY;

--
-- Name: repair_consumable_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repair_consumable_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: repair_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: repair_jobs repair_jobs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_delete ON public.repair_jobs FOR DELETE USING (true);


--
-- Name: repair_jobs repair_jobs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_insert ON public.repair_jobs FOR INSERT WITH CHECK (true);


--
-- Name: repair_jobs repair_jobs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_select ON public.repair_jobs FOR SELECT USING (true);


--
-- Name: repair_jobs repair_jobs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_update ON public.repair_jobs FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: rr_consumable_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rr_consumable_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: site_visits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

--
-- Name: site_visits site_visits_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_visits_all ON public.site_visits TO authenticated USING (true) WITH CHECK (true);


--
-- Name: site_visits site_visits_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_visits_insert ON public.site_visits FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: site_visits site_visits_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_visits_select ON public.site_visits FOR SELECT TO authenticated USING (true);


--
-- Name: site_visits site_visits_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_visits_update ON public.site_visits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

--
-- Name: sites sites_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sites_all ON public.sites TO authenticated USING (true) WITH CHECK (true);


--
-- Name: spare_part_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spare_part_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: spare_part_serials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spare_part_serials ENABLE ROW LEVEL SECURITY;

--
-- Name: spare_parts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: spare_part_requests spare_parts_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spare_parts_all ON public.spare_part_requests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: spare_parts spare_parts_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spare_parts_all ON public.spare_parts TO authenticated USING (true) WITH CHECK (true);


--
-- Name: spare_part_requests spare_requests_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spare_requests_all ON public.spare_part_requests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets tickets_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tickets_all ON public.tickets TO authenticated USING (true) WITH CHECK (true);


--
-- Name: spare_parts update spare parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update spare parts" ON public.spare_parts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_all ON public.users TO authenticated USING (true) WITH CHECK (true);


--
-- Name: users users_update_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_own_profile ON public.users FOR UPDATE TO authenticated USING ((email = (auth.jwt() ->> 'email'::text))) WITH CHECK ((email = (auth.jwt() ->> 'email'::text)));


--
-- Name: workflow_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_requests workflow_requests_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_requests_all ON public.workflow_requests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
