-- Section 4: atomic Finance decisions for Inventory dispatch funding.
-- Run after 202607180016_finance_expense_tax_transactions.sql.

create or replace function public.inventory_transition_dispatch_fund(
  p_fund_request_id uuid,
  p_action text,
  p_approved_amount numeric default null,
  p_finance_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fund public.inventory_dispatch_fund_requests%rowtype;
  actor jsonb;
  action_name text := lower(trim(coalesce(p_action, '')));
  next_status text;
  next_dispatch_status text;
  next_lifecycle_status text;
  event_text text;
  severity_name text := 'info';
  amount_value numeric(18,2);
begin
  if auth.uid() is null or not public.finance_is_write_role() then
    raise exception 'Finance authorization is required' using errcode = '42501';
  end if;
  if action_name not in ('approve', 'reject', 'disburse') then
    raise exception 'Unsupported dispatch fund action';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('dispatch-fund-finance:' || p_fund_request_id::text, 0));
  select * into fund from public.inventory_dispatch_fund_requests
  where id = p_fund_request_id for update;
  if not found then raise exception 'Dispatch fund request was not found'; end if;
  actor := public.finance_actor_identity();

  if action_name = 'approve' then
    if lower(coalesce(fund.finance_status, '')) = 'approved' then
      return to_jsonb(fund) || jsonb_build_object('changed', false);
    end if;
    if lower(coalesce(fund.finance_status, '')) not in ('pending', 'pending_review') then
      raise exception 'Only pending dispatch fund requests can be approved';
    end if;
    amount_value := round(coalesce(p_approved_amount, 0), 2);
    if amount_value <= 0 or amount_value > coalesce(fund.requested_amount, amount_value) then
      raise exception 'Approved amount must be positive and cannot exceed the requested amount';
    end if;
    next_status := 'approved';
    next_dispatch_status := 'awaiting_disbursement';
    next_lifecycle_status := 'dispatch_fund_approved';
    event_text := 'approved dispatch fund request';
    update public.inventory_dispatch_fund_requests set
      approved_amount = amount_value, status = 'approved', finance_status = 'approved',
      finance_note = nullif(left(trim(p_finance_note), 2000), ''),
      approved_by = actor ->> 'name', approved_by_email = actor ->> 'email',
      approved_at = now(), updated_at = now()
    where id = fund.id returning * into fund;
  elsif action_name = 'reject' then
    if lower(coalesce(fund.finance_status, '')) = 'rejected' then
      return to_jsonb(fund) || jsonb_build_object('changed', false);
    end if;
    if lower(coalesce(fund.finance_status, '')) not in ('pending', 'pending_review', 'approved') then
      raise exception 'This dispatch fund request cannot be rejected from its current state';
    end if;
    next_status := 'rejected';
    next_dispatch_status := 'finance_rejected';
    next_lifecycle_status := 'dispatch_fund_rejected';
    event_text := 'rejected dispatch fund request';
    severity_name := 'warning';
    update public.inventory_dispatch_fund_requests set
      status = 'rejected', finance_status = 'rejected',
      finance_note = coalesce(nullif(left(trim(p_finance_note), 2000), ''), 'Rejected by Finance'),
      rejected_by = actor ->> 'name', rejected_by_email = actor ->> 'email',
      rejected_at = now(), updated_at = now()
    where id = fund.id returning * into fund;
  else
    if lower(coalesce(fund.finance_status, '')) = 'disbursed' then
      return to_jsonb(fund) || jsonb_build_object('changed', false);
    end if;
    if lower(coalesce(fund.finance_status, '')) <> 'approved' then
      raise exception 'Only approved dispatch funds can be disbursed';
    end if;
    amount_value := round(coalesce(fund.approved_amount, 0), 2);
    if amount_value <= 0 then raise exception 'Approved amount is missing'; end if;
    next_status := 'disbursed';
    next_dispatch_status := 'ready_for_dispatch';
    next_lifecycle_status := 'dispatch_fund_disbursed';
    event_text := 'disbursed dispatch fund';
    update public.inventory_dispatch_fund_requests set
      status = 'disbursed', finance_status = 'disbursed',
      disbursed_by = actor ->> 'name', disbursed_by_email = actor ->> 'email',
      disbursed_at = now(), updated_at = now()
    where id = fund.id returning * into fund;
  end if;

  if fund.part_request_id is not null then
    update public.part_requests set
      finance_status = next_status,
      dispatch_status = next_dispatch_status,
      lifecycle_status = next_lifecycle_status,
      updated_at = now()
    where id = fund.part_request_id;
    if not found then raise exception 'Linked part request was not found'; end if;

    insert into public.part_lifecycle_logs(part_request_id, status, department, note)
    values(fund.part_request_id, next_lifecycle_status, 'Finance', 'Finance ' || event_text);
  end if;

  insert into public.operations_events(
    event_type, title, description, source_module, entity_type, entity_id, severity
  ) values(
    'DISPATCH_FUND_FINANCE_UPDATE', 'Finance ' || event_text,
    'Finance ' || event_text || ' for ' || coalesce(fund.part_name, fund.part_number, fund.id::text),
    'Finance', 'inventory_dispatch_fund_request', fund.id, severity_name
  );

  return to_jsonb(fund) || jsonb_build_object(
    'changed', true,
    'part_request_status', next_status,
    'dispatch_status', next_dispatch_status,
    'lifecycle_status', next_lifecycle_status
  );
end;
$$;

revoke all on function public.inventory_transition_dispatch_fund(uuid, text, numeric, text)
  from public, anon;
grant execute on function public.inventory_transition_dispatch_fund(uuid, text, numeric, text)
  to authenticated;
