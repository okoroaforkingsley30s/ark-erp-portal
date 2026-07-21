-- Transactional and server-authorized journal workflows.
-- This migration intentionally precedes broad journal RLS: legacy finance flows
-- still write journals directly and must be migrated before direct writes close.

create or replace function public.finance_journal_actor_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(trim(u.full_name), ''),
    nullif(trim(u.email), ''),
    nullif(auth.jwt() ->> 'email', ''),
    auth.uid()::text
  )
  from (select 1) seed
  left join public.users u on u.id = auth.uid()
  limit 1;
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
      'system_admin', 'admin', 'ceo', 'agm', 'finance', 'finance_manager',
      'head_of_account', 'account', 'accounts', 'accountant'
    ) then
      raise exception 'You are not authorized to create or submit journals' using errcode = '42501';
    end if;
  elsif lower(coalesce(p_action, '')) in ('approve', 'reject', 'post', 'reverse') then
    if actor_role not in (
      'system_admin', 'admin', 'ceo', 'agm', 'finance_manager', 'head_of_account'
    ) then
      raise exception 'You are not authorized to approve, post, or reverse journals' using errcode = '42501';
    end if;
  else
    raise exception 'Unsupported journal action %', p_action;
  end if;

  return actor_role;
end;
$$;

create or replace function public.finance_create_journal_transaction(
  p_journal_date date,
  p_narration text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  new_journal_id uuid;
  new_journal_no text;
  item jsonb;
  item_index integer := 0;
  account_uuid uuid;
  debit_amount numeric(18, 2);
  credit_amount numeric(18, 2);
  debit_total numeric(18, 2) := 0;
  credit_total numeric(18, 2) := 0;
begin
  perform public.finance_assert_journal_role('create');
  actor_name := public.finance_journal_actor_name();

  if p_journal_date is null then raise exception 'Journal date is required'; end if;
  if p_journal_date > current_date + 1 then raise exception 'Journal date cannot be in the future'; end if;
  if length(trim(coalesce(p_narration, ''))) < 3 then raise exception 'Journal narration is required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal requires at least two lines';
  end if;
  if jsonb_array_length(p_lines) > 200 then raise exception 'A journal cannot exceed 200 lines'; end if;

  new_journal_no := public.finance_generate_journal_no('JV', p_journal_date);
  insert into public.finance_journals (
    journal_no, journal_date, status, narration, created_by, created_by_name
  ) values (
    new_journal_no, p_journal_date, 'draft', trim(p_narration), actor_id, actor_name
  ) returning id into new_journal_id;

  for item in select value from jsonb_array_elements(p_lines)
  loop
    item_index := item_index + 1;
    account_uuid := nullif(trim(item ->> 'account_id'), '')::uuid;
    debit_amount := round(coalesce(nullif(trim(item ->> 'debit'), '')::numeric, 0), 2);
    credit_amount := round(coalesce(nullif(trim(item ->> 'credit'), '')::numeric, 0), 2);

    if account_uuid is null or not exists (
      select 1 from public.finance_accounts a where a.id = account_uuid and a.is_active = true
    ) then
      raise exception 'Journal line % has an invalid or inactive account', item_index;
    end if;
    if debit_amount < 0 or credit_amount < 0 or
       not ((debit_amount > 0 and credit_amount = 0) or
            (credit_amount > 0 and debit_amount = 0)) then
      raise exception 'Journal line % must contain either a debit or a credit', item_index;
    end if;

    insert into public.finance_journal_lines (
      journal_id, line_no, account_id, debit, credit, description, department
    ) values (
      new_journal_id,
      item_index,
      account_uuid,
      debit_amount,
      credit_amount,
      nullif(left(trim(item ->> 'description'), 500), ''),
      nullif(left(trim(item ->> 'department'), 120), '')
    );
    debit_total := debit_total + debit_amount;
    credit_total := credit_total + credit_amount;
  end loop;

  if debit_total <= 0 or round(debit_total, 2) <> round(credit_total, 2) then
    raise exception 'Journal is not balanced. Debit %, credit %', debit_total, credit_total;
  end if;

  insert into public.finance_audit_logs (
    entity_table, entity_id, action, new_value, changed_by, changed_by_name
  ) values (
    'finance_journals', new_journal_id::text, 'journal_created',
    jsonb_build_object('journal_no', new_journal_no, 'status', 'draft',
      'debit_total', debit_total, 'credit_total', credit_total),
    actor_id, actor_name
  );

  return jsonb_build_object('id', new_journal_id, 'journal_no', new_journal_no);
end;
$$;

create or replace function public.finance_transition_journal(
  p_journal_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  journal_row public.finance_journals%rowtype;
  actor_id uuid := auth.uid();
  actor_name text;
  action_name text := lower(trim(coalesce(p_action, '')));
  next_status text;
  audit_action text;
begin
  perform public.finance_assert_journal_role(action_name);
  actor_name := public.finance_journal_actor_name();

  select * into journal_row
  from public.finance_journals
  where id = p_journal_id
  for update;
  if not found then raise exception 'Journal was not found'; end if;

  case action_name
    when 'submit' then
      if journal_row.status not in ('draft', 'rejected') then
        raise exception 'Only draft or rejected journals can be submitted';
      end if;
      perform public.finance_validate_balanced_journal(journal_row.id);
      next_status := 'pending_review';
      audit_action := 'journal_submitted_for_review';
      update public.finance_journals set status = next_status, rejection_reason = null,
        updated_at = now() where id = journal_row.id;
    when 'approve' then
      if journal_row.status <> 'pending_review' then
        raise exception 'Only pending review journals can be approved';
      end if;
      if journal_row.created_by = actor_id then
        raise exception 'The journal creator cannot approve the same journal' using errcode = '42501';
      end if;
      next_status := 'approved';
      audit_action := 'journal_approved';
      update public.finance_journals set status = next_status,
        reviewed_by = actor_id, reviewed_by_name = actor_name, reviewed_at = now(),
        approved_by = actor_id, approved_by_name = actor_name, approved_at = now(),
        updated_at = now() where id = journal_row.id;
    when 'reject' then
      if journal_row.status not in ('pending_review', 'approved') then
        raise exception 'Only pending or approved journals can be rejected';
      end if;
      if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'A rejection reason is required'; end if;
      next_status := 'rejected';
      audit_action := 'journal_rejected';
      update public.finance_journals set status = next_status,
        rejection_reason = left(trim(p_reason), 1000), updated_at = now()
      where id = journal_row.id;
    when 'post' then
      if journal_row.status <> 'approved' then raise exception 'Only approved journals can be posted'; end if;
      if journal_row.created_by = actor_id then
        raise exception 'The journal creator cannot post the same journal' using errcode = '42501';
      end if;
      perform public.finance_validate_balanced_journal(journal_row.id);
      next_status := 'posted';
      audit_action := 'journal_posted';
      update public.finance_journals set status = next_status,
        posted_by = actor_id, posted_by_name = actor_name, posted_at = now(), updated_at = now()
      where id = journal_row.id;
    else
      raise exception 'Unsupported journal action %', action_name;
  end case;

  insert into public.finance_audit_logs (
    entity_table, entity_id, action, previous_value, new_value, changed_by, changed_by_name
  ) values (
    'finance_journals', journal_row.id::text, audit_action,
    jsonb_build_object('journal_no', journal_row.journal_no, 'status', journal_row.status),
    jsonb_build_object('journal_no', journal_row.journal_no, 'status', next_status,
      'reason', nullif(trim(coalesce(p_reason, '')), '')), actor_id, actor_name
  );

  return jsonb_build_object('id', journal_row.id, 'previous_status', journal_row.status,
    'status', next_status);
end;
$$;

create or replace function public.finance_create_reversal_transaction(
  p_original_journal_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  original public.finance_journals%rowtype;
  reversal_id uuid;
  reversal_no text;
  actor_id uuid := auth.uid();
  actor_name text;
begin
  perform public.finance_assert_journal_role('reverse');
  actor_name := public.finance_journal_actor_name();
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'A reversal reason is required'; end if;

  select * into original from public.finance_journals
  where id = p_original_journal_id for update;
  if not found then raise exception 'Original journal was not found'; end if;
  if original.status <> 'posted' then raise exception 'Only posted journals can be reversed'; end if;
  if original.created_by = actor_id then
    raise exception 'The journal creator cannot reverse the same journal' using errcode = '42501';
  end if;
  if exists (select 1 from public.finance_journals where reversal_of = original.id) then
    raise exception 'This journal already has a reversal';
  end if;

  reversal_no := public.finance_generate_journal_no('REV', current_date);
  insert into public.finance_journals (
    journal_no, journal_date, source_module, source_table, source_id, status,
    narration, reversal_of, created_by, created_by_name
  ) values (
    reversal_no, current_date, original.source_module, original.source_table,
    original.source_id, 'draft', 'Reversal for ' || original.journal_no || ': ' || left(trim(p_reason), 1000),
    original.id, actor_id, actor_name
  ) returning id into reversal_id;

  insert into public.finance_journal_lines (
    journal_id, line_no, account_id, debit, credit, description, department, entity_type, entity_id
  ) select reversal_id, line_no, account_id, credit, debit,
    coalesce(description, 'Reversal') || ' (reversal)', department, entity_type, entity_id
  from public.finance_journal_lines where journal_id = original.id order by line_no;
  perform public.finance_validate_balanced_journal(reversal_id);

  insert into public.finance_audit_logs (
    entity_table, entity_id, action, previous_value, new_value, changed_by, changed_by_name
  ) values (
    'finance_journals', original.id::text, 'journal_reversal_created',
    jsonb_build_object('journal_no', original.journal_no, 'status', original.status),
    jsonb_build_object('reversal_journal_id', reversal_id, 'reversal_journal_no', reversal_no,
      'reason', trim(p_reason)), actor_id, actor_name
  );
  return reversal_id;
end;
$$;

revoke all on function public.finance_generate_journal_no(text, date) from public, anon, authenticated;
revoke all on function public.finance_validate_balanced_journal(uuid) from public, anon, authenticated;
revoke all on function public.finance_create_reversal_journal(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.finance_journal_actor_name() from public, anon;
revoke all on function public.finance_assert_journal_role(text) from public, anon;
revoke all on function public.finance_create_journal_transaction(date, text, jsonb) from public, anon;
revoke all on function public.finance_transition_journal(uuid, text, text) from public, anon;
revoke all on function public.finance_create_reversal_transaction(uuid, text) from public, anon;

grant execute on function public.finance_create_journal_transaction(date, text, jsonb) to authenticated;
grant execute on function public.finance_transition_journal(uuid, text, text) to authenticated;
grant execute on function public.finance_create_reversal_transaction(uuid, text) to authenticated;
-- Legacy journal builders still need these two narrow helpers until they are
-- migrated; neither helper performs a privileged state transition by itself.
grant execute on function public.finance_generate_journal_no(text, date) to authenticated;
grant execute on function public.finance_validate_balanced_journal(uuid) to authenticated;

-- Secure adapters for legacy transactional functions. Caller identity is always
-- derived from the JWT; browser-supplied actor fields are no longer accepted.
create or replace function public.finance_record_general_request_payment_secure(
  p_fund_request_id uuid,
  p_amount numeric default null,
  p_payment_date date default current_date,
  p_payment_method text default 'Account Release',
  p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  perform public.finance_assert_journal_role('submit');
  select public.finance_record_general_request_payment(
    p_fund_request_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    p_payment_reference,
    auth.uid(),
    public.finance_journal_actor_name(),
    auth.jwt() ->> 'email'
  ) into result;
  return result;
end;
$$;

create or replace function public.finance_create_tax_draft_journal_secure(
  p_tax_transaction_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  journal_id uuid;
begin
  perform public.finance_assert_journal_role('create');
  select public.finance_create_tax_draft_journal(
    p_tax_transaction_id,
    auth.uid(),
    public.finance_journal_actor_name()
  ) into journal_id;
  return journal_id;
end;
$$;

revoke all on function public.finance_record_general_request_payment(
  uuid, numeric, date, text, text, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.finance_create_tax_draft_journal(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.finance_record_general_request_payment_secure(
  uuid, numeric, date, text, text
) from public, anon;
revoke all on function public.finance_create_tax_draft_journal_secure(uuid)
  from public, anon;
grant execute on function public.finance_record_general_request_payment_secure(
  uuid, numeric, date, text, text
) to authenticated;
grant execute on function public.finance_create_tax_draft_journal_secure(uuid)
  to authenticated;

create unique index if not exists finance_journals_one_reversal_per_original_uidx
  on public.finance_journals (reversal_of)
  where reversal_of is not null;

-- Ensure reporting views obey underlying RLS when journal RLS is enabled after
-- the remaining legacy direct-write workflows have been migrated.
alter view if exists public.finance_general_ledger_view set (security_invoker = true);
alter view if exists public.finance_account_statement_view set (security_invoker = true);
alter view if exists public.finance_trial_balance_view set (security_invoker = true);

alter table public.finance_audit_logs enable row level security;

drop policy if exists finance_audit_logs_select_authorized on public.finance_audit_logs;
create policy finance_audit_logs_select_authorized
on public.finance_audit_logs for select
to authenticated
using (public.finance_is_privileged_expense_role());

drop policy if exists finance_audit_logs_insert_self on public.finance_audit_logs;
create policy finance_audit_logs_insert_self
on public.finance_audit_logs for insert
to authenticated
with check (
  public.finance_is_privileged_expense_role()
  and changed_by = auth.uid()
);

create index if not exists finance_journals_source_record_idx
  on public.finance_journals (source_table, source_id)
  where source_table is not null and source_id is not null;

create or replace function public.finance_create_source_journal_transaction(
  p_source_table text,
  p_source_id text,
  p_journal_date date,
  p_narration text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  source_name text := lower(trim(coalesce(p_source_table, '')));
  source_key text := trim(coalesce(p_source_id, ''));
  prefix text;
  existing_id uuid;
  new_journal_id uuid;
  new_journal_no text;
  item jsonb;
  item_index integer := 0;
  account_uuid uuid;
  debit_amount numeric(18, 2);
  credit_amount numeric(18, 2);
  debit_total numeric(18, 2) := 0;
  credit_total numeric(18, 2) := 0;
begin
  perform public.finance_assert_journal_role('create');
  actor_name := public.finance_journal_actor_name();

  prefix := case source_name
    when 'invoices' then 'INV'
    when 'expenses' then 'EXP'
    when 'finance_expense_payments' then 'ERP'
    when 'lpos' then 'PO'
    when 'inventory_dispatch_fund_requests' then 'DF'
    else null
  end;
  if prefix is null then raise exception 'Unsupported journal source %', source_name; end if;
  if source_key = '' or length(source_key) > 200 then raise exception 'A valid source id is required'; end if;
  if p_journal_date is null or p_journal_date > current_date + 1 then
    raise exception 'A valid journal date is required';
  end if;
  if length(trim(coalesce(p_narration, ''))) < 3 then raise exception 'Journal narration is required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 or
     jsonb_array_length(p_lines) > 200 then
    raise exception 'A journal requires between 2 and 200 lines';
  end if;

  -- Serialize retries for the same source record even before a row exists.
  perform pg_advisory_xact_lock(hashtextextended(source_name || ':' || source_key, 0));
  select id into existing_id from public.finance_journals
  where source_table = source_name and source_id = source_key
  order by created_at asc limit 1;
  if existing_id is not null then
    return jsonb_build_object('id', existing_id, 'created', false);
  end if;

  new_journal_no := public.finance_generate_journal_no(prefix, p_journal_date);
  insert into public.finance_journals (
    journal_no, journal_date, source_module, source_table, source_id,
    status, narration, created_by, created_by_name
  ) values (
    new_journal_no, p_journal_date, 'finance', source_name, source_key,
    'draft', trim(p_narration), actor_id, actor_name
  ) returning id into new_journal_id;

  for item in select value from jsonb_array_elements(p_lines)
  loop
    item_index := item_index + 1;
    account_uuid := nullif(trim(item ->> 'account_id'), '')::uuid;
    debit_amount := round(coalesce(nullif(trim(item ->> 'debit'), '')::numeric, 0), 2);
    credit_amount := round(coalesce(nullif(trim(item ->> 'credit'), '')::numeric, 0), 2);
    if account_uuid is null or not exists (
      select 1 from public.finance_accounts a where a.id = account_uuid and a.is_active = true
    ) then raise exception 'Journal line % has an invalid or inactive account', item_index; end if;
    if debit_amount < 0 or credit_amount < 0 or
       not ((debit_amount > 0 and credit_amount = 0) or
            (credit_amount > 0 and debit_amount = 0)) then
      raise exception 'Journal line % must contain either a debit or a credit', item_index;
    end if;

    insert into public.finance_journal_lines (
      journal_id, line_no, account_id, debit, credit, description, department
    ) values (
      new_journal_id, item_index, account_uuid, debit_amount, credit_amount,
      nullif(left(trim(item ->> 'description'), 500), ''),
      nullif(left(trim(item ->> 'department'), 120), '')
    );
    debit_total := debit_total + debit_amount;
    credit_total := credit_total + credit_amount;
  end loop;
  if debit_total <= 0 or round(debit_total, 2) <> round(credit_total, 2) then
    raise exception 'Journal is not balanced. Debit %, credit %', debit_total, credit_total;
  end if;

  insert into public.finance_audit_logs (
    entity_table, entity_id, action, new_value, changed_by, changed_by_name
  ) values (
    'finance_journals', new_journal_id::text, 'source_journal_created',
    jsonb_build_object('journal_no', new_journal_no, 'status', 'draft',
      'source_table', source_name, 'source_id', source_key,
      'debit_total', debit_total, 'credit_total', credit_total), actor_id, actor_name
  );
  return jsonb_build_object('id', new_journal_id, 'journal_no', new_journal_no, 'created', true);
end;
$$;

revoke all on function public.finance_create_source_journal_transaction(
  text, text, date, text, jsonb
) from public, anon;
grant execute on function public.finance_create_source_journal_transaction(
  text, text, date, text, jsonb
) to authenticated;

alter table public.finance_journals enable row level security;
alter table public.finance_journal_lines enable row level security;

drop policy if exists finance_journals_select_authorized on public.finance_journals;
create policy finance_journals_select_authorized
on public.finance_journals for select
to authenticated
using (public.finance_is_privileged_expense_role());

drop policy if exists finance_journal_lines_select_authorized on public.finance_journal_lines;
create policy finance_journal_lines_select_authorized
on public.finance_journal_lines for select
to authenticated
using (public.finance_is_privileged_expense_role());

-- No client INSERT, UPDATE, or DELETE policies are created. All journal writes
-- must pass through the security-definer transaction functions above.
