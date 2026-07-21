-- Align the exported legacy production schema with fields required by the
-- version-controlled transactional workflow migrations. Every change is
-- additive and safe to re-run against the existing production schema.

-- Remove legacy privileged paths replaced by authenticated transactional RPCs.
-- The old approval function trusted one hardcoded email, while the trigger could
-- create a second repair job outside the new atomic inventory workflow.
drop trigger if exists trg_create_repair_job_from_part_request on public.part_requests;
drop function if exists public.create_repair_job_from_part_request();
drop function if exists public.approve_ark_user(uuid, text, text, text);

alter table public.part_lifecycle_logs
  add column if not exists status text,
  add column if not exists department text,
  add column if not exists note text;

alter table public.part_lifecycle_logs
  alter column movement_type set default 'workflow_transition';

alter table public.operations_events
  add column if not exists source_module text;

alter table public.part_requests
  add column if not exists part_id uuid,
  add column if not exists part_number text,
  add column if not exists request_number text,
  add column if not exists warehouse text,
  add column if not exists part_request_status text default 'pending',
  add column if not exists received_by_engineer_at timestamptz,
  add column if not exists assigned_to uuid;

alter table public.tickets
  add column if not exists received_part_at timestamptz;

alter table public.inventory_dispatch_fund_requests
  add column if not exists rejected_by text,
  add column if not exists rejected_by_email text,
  add column if not exists rejected_at timestamptz;

comment on column public.part_lifecycle_logs.status is
  'Canonical workflow status used by transactional ARK ONE RPCs.';
comment on column public.part_lifecycle_logs.department is
  'Department responsible for the workflow transition.';
comment on column public.part_lifecycle_logs.note is
  'Concise workflow transition note; rich legacy details remain in notes.';

-- Align legacy production identity and messaging tables with repaired contracts.
alter table public.gmail_connections
  add column if not exists token_type text,
  add column if not exists scope text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notifications
  add column if not exists recipient_email text,
  add column if not exists message_body text,
  add column if not exists is_read boolean not null default false,
  add column if not exists related_user_id uuid,
  add column if not exists related_user_email text;

alter table public.chat_messages
  add column if not exists message text,
  add column if not exists reply_to_id uuid,
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.user_profiles
  alter column online_status drop default;

alter table public.user_profiles
  alter column online_status type text
  using case
    when online_status is null then 'offline'
    when online_status then 'online'
    else 'offline'
  end;

alter table public.user_profiles
  alter column online_status set default 'offline';
-- Align legacy finance tax tables with repaired finance contracts.
alter table public.finance_tax_rates
  add column if not exists id uuid default gen_random_uuid();

create unique index if not exists finance_tax_codes_tax_code_uidx
  on public.finance_tax_codes (tax_code);

alter table public.finance_tax_returns
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists tax_return_no text,
  add column if not exists tax_code_id uuid,
  add column if not exists tax_authority text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists due_date date,
  add column if not exists taxable_amount numeric(18,2) default 0,
  add column if not exists tax_amount numeric(18,2) default 0,
  add column if not exists amount_paid numeric(18,2) default 0,
  add column if not exists balance_due numeric(18,2) default 0,
  add column if not exists status text default 'draft',
  add column if not exists filed_at timestamptz,
  add column if not exists filed_by uuid,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.finance_tax_payments
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists tax_payment_no text,
  add column if not exists tax_return_id uuid,
  add column if not exists tax_transaction_id uuid,
  add column if not exists tax_code_id uuid,
  add column if not exists bank_account_id uuid,
  add column if not exists journal_id uuid,
  add column if not exists payment_date date default current_date,
  add column if not exists amount numeric(18,2) default 0,
  add column if not exists currency text default 'NGN',
  add column if not exists tax_authority text,
  add column if not exists payment_reference text,
  add column if not exists status text default 'draft',
  add column if not exists created_by uuid,
  add column if not exists approved_by uuid,
  add column if not exists paid_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists finance_tax_returns_number_uidx
  on public.finance_tax_returns (tax_return_no);

create unique index if not exists finance_tax_payments_number_uidx
  on public.finance_tax_payments (tax_payment_no);