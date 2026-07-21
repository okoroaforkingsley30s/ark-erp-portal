-- Duplicate-request protection, operational transitions, and final RPC allowlist corrections.

-- Number generators validate the caller instead of exposing sequences to every
-- authenticated session without a role check.
create or replace function public.finance_generate_journal_no(
  p_prefix text default 'JV', p_journal_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare next_number bigint;
begin
  if not public.finance_is_write_role() then raise exception 'Finance authorization required' using errcode = '42501'; end if;
  next_number := nextval('public.finance_journal_no_seq');
  return upper(coalesce(nullif(trim(p_prefix), ''), 'JV')) || '-' ||
    to_char(coalesce(p_journal_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.finance_generate_expense_request_no(p_request_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare next_number bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  next_number := nextval('public.finance_expense_request_no_seq');
  return 'ER-' || to_char(coalesce(p_request_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.finance_generate_expense_payment_no(p_payment_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare next_number bigint;
begin
  if not public.finance_is_write_role() then raise exception 'Finance authorization required' using errcode = '42501'; end if;
  next_number := nextval('public.finance_expense_payment_no_seq');
  return 'EP-' || to_char(coalesce(p_payment_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.finance_generate_tax_no(
  p_prefix text default 'TAX', p_tax_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare next_number bigint; sequence_name text; clean_prefix text;
begin
  if not public.finance_is_write_role() then raise exception 'Finance authorization required' using errcode = '42501'; end if;
  clean_prefix := upper(coalesce(nullif(trim(p_prefix), ''), 'TAX'));
  if clean_prefix not in ('TAX','TRN','TPY') then raise exception 'Unsupported tax number prefix'; end if;
  sequence_name := case clean_prefix when 'TRN' then 'public.finance_tax_return_no_seq'
    when 'TPY' then 'public.finance_tax_payment_no_seq' else 'public.finance_tax_transaction_no_seq' end;
  execute format('select nextval(%L::regclass)', sequence_name) into next_number;
  return clean_prefix || '-' || to_char(coalesce(p_tax_date, current_date), 'YYYYMMDD') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

revoke all on function public.finance_generate_journal_no(text, date) from public, anon;
revoke all on function public.finance_generate_expense_request_no(date) from public, anon;
revoke all on function public.finance_generate_expense_payment_no(date) from public, anon;
revoke all on function public.finance_generate_tax_no(text, date) from public, anon;
grant execute on function public.finance_generate_journal_no(text, date) to authenticated;
grant execute on function public.finance_generate_expense_request_no(date) to authenticated;
grant execute on function public.finance_generate_expense_payment_no(date) to authenticated;
grant execute on function public.finance_generate_tax_no(text, date) to authenticated;

-- Keep the newest non-rejected dispatch-fund request active. Older legacy
-- duplicates remain auditable but are closed before enforcing uniqueness.
with ranked as (
  select id, row_number() over (partition by part_request_id order by created_at desc, id desc) as position
  from public.inventory_dispatch_fund_requests
  where lower(coalesce(finance_status, '')) <> 'rejected'
)
update public.inventory_dispatch_fund_requests request
set status = 'rejected', finance_status = 'rejected',
  finance_note = coalesce(nullif(finance_note, ''), 'Closed automatically as a legacy duplicate'),
  updated_at = now()
from ranked where request.id = ranked.id and ranked.position > 1;

create unique index if not exists inventory_dispatch_fund_one_active_request_uidx
  on public.inventory_dispatch_fund_requests (part_request_id)
  where lower(coalesce(finance_status, '')) <> 'rejected';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_dispatch_fund_status_guard') then
    alter table public.inventory_dispatch_fund_requests
      add constraint inventory_dispatch_fund_status_guard
      check (status in ('pending_finance','approved','rejected','disbursed')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_dispatch_fund_finance_status_guard') then
    alter table public.inventory_dispatch_fund_requests
      add constraint inventory_dispatch_fund_finance_status_guard
      check (finance_status in ('pending_review','approved','rejected','disbursed')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rr_consumable_requests_status_guard') then
    alter table public.rr_consumable_requests
      add constraint rr_consumable_requests_status_guard
      check (status in ('pending_hod','pending_inventory','released','out_of_stock','rejected','rejected_by_hod')) not valid;
  end if;
end
$$;

create or replace function public.ark_guard_operational_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor_role text := public.ark_current_user_role(); allowed boolean := false;
begin
  if new.status is not distinct from old.status then return new; end if;
  if tg_table_name = 'inventory_dispatch_fund_requests' then
    if actor_role not in ('system_admin','finance','head_of_account','finance_manager','accountant') then
      raise exception 'Finance authorization required' using errcode = '42501';
    end if;
    allowed :=
      (old.status = 'pending_finance' and new.status in ('approved','rejected')) or
      (old.status = 'approved' and new.status in ('disbursed','rejected'));
  elsif tg_table_name = 'rr_consumable_requests' then
    if old.status = 'pending_hod' then
      if actor_role not in ('system_admin','repair_head') then raise exception 'RR HOD authorization required' using errcode = '42501'; end if;
      allowed := new.status in ('pending_inventory','rejected_by_hod');
    elsif old.status = 'pending_inventory' then
      if actor_role not in ('system_admin','inventory') then raise exception 'Inventory authorization required' using errcode = '42501'; end if;
      allowed := new.status in ('released','out_of_stock');
    end if;
  end if;
  if not allowed then raise exception 'Invalid % status transition: % -> %', tg_table_name, old.status, new.status; end if;
  return new;
end;
$$;

revoke all on function public.ark_guard_operational_transition() from public, anon, authenticated;
drop trigger if exists inventory_dispatch_fund_transition_guard on public.inventory_dispatch_fund_requests;
create trigger inventory_dispatch_fund_transition_guard
before update of status on public.inventory_dispatch_fund_requests
for each row execute function public.ark_guard_operational_transition();
drop trigger if exists rr_consumable_request_transition_guard on public.rr_consumable_requests;
create trigger rr_consumable_request_transition_guard
before update of status on public.rr_consumable_requests
for each row execute function public.ark_guard_operational_transition();

-- Explicitly keep insecure actor-supplied legacy functions unavailable.
revoke all on function public.finance_create_reversal_journal(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.finance_create_tax_draft_journal(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finance_record_general_request_payment(uuid, numeric, date, text, text, uuid, text, text)
  from public, anon, authenticated;
