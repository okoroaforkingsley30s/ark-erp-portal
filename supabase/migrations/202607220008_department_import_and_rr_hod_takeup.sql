-- Central, audited System Administrator department imports and RR HOD self-take.

alter table public.crm_clients
  add column if not exists client_origin text not null default 'standard',
  add column if not exists legacy_reference text,
  add column if not exists original_relationship_start_date date,
  add column if not exists imported_at timestamptz,
  add column if not exists imported_by_email text;

alter table public.repair_jobs
  add column if not exists hod_owner_profile_id uuid references public.user_profiles(id),
  add column if not exists hod_owner_email text,
  add column if not exists hod_taken_at timestamptz;

create table if not exists public.crm_pocs (
  id uuid primary key default gen_random_uuid(),
  poc_reference text not null unique,
  client_id uuid references public.crm_clients(id) on delete set null,
  client_name text not null,
  product_to_demo text not null,
  start_date date not null,
  end_date date not null,
  requirements text not null,
  status text not null default 'planned' check (status in ('planned','in_progress','successful','not_successful','cancelled')),
  outcome_notes text,
  owner_email text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.crm_supply_register (
  id uuid primary key default gen_random_uuid(),
  lpo_number text not null unique,
  client_id uuid references public.crm_clients(id) on delete set null,
  client_name text not null,
  industry text,
  contact_name text,
  contact_phone text,
  product_requested text not null,
  quantity integer not null check (quantity > 0),
  invoice_value numeric not null default 0 check (invoice_value >= 0),
  invoice_document text,
  ark_profit numeric not null default 0,
  supplier_id uuid references public.inventory_suppliers(id) on delete set null,
  supplier_name text,
  supply_date date,
  delivery_note_document text,
  status text not null default 'offer' check (status in ('offer','lpo_received','procurement','ready_to_supply','supplied','cancelled')),
  notes text,
  owner_email text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_slas (
  id uuid primary key default gen_random_uuid(),
  sla_reference text not null unique,
  client_id uuid references public.crm_clients(id) on delete set null,
  client_name text not null,
  industry text,
  contact_name text,
  contact_phone text,
  sla_type text not null,
  product text not null,
  agreement_start_date date not null,
  agreement_end_date date not null,
  support_fee_per_product numeric not null default 0 check (support_fee_per_product >= 0),
  status text not null default 'draft' check (status in ('draft','active','expired','renewal_due','terminated')),
  notes text,
  agreement_document text,
  owner_email text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (agreement_end_date >= agreement_start_date)
);

create index if not exists crm_pocs_client_idx on public.crm_pocs(client_id, status, created_at desc);
create index if not exists crm_supply_client_idx on public.crm_supply_register(client_id, status, created_at desc);
create index if not exists crm_slas_client_idx on public.crm_slas(client_id, status, agreement_end_date);

alter table public.crm_pocs enable row level security;
alter table public.crm_supply_register enable row level security;
alter table public.crm_slas enable row level security;

drop policy if exists crm_pocs_role_read on public.crm_pocs;
create policy crm_pocs_role_read on public.crm_pocs for select to authenticated using (
  public.ark_has_any_role(array['system_admin','agm','business_developer','crm','operations','it','head_of_it']::text[])
);
drop policy if exists crm_supply_role_read on public.crm_supply_register;
create policy crm_supply_role_read on public.crm_supply_register for select to authenticated using (
  public.ark_has_any_role(array['system_admin','agm','business_developer','crm','finance','head_of_account','inventory','procurement','procurement_head','operations']::text[])
);
drop policy if exists crm_slas_role_read on public.crm_slas;
create policy crm_slas_role_read on public.crm_slas for select to authenticated using (
  public.ark_has_any_role(array['system_admin','agm','business_developer','crm','finance','head_of_account','helpdesk','operations']::text[])
);
grant select on public.crm_pocs,public.crm_supply_register,public.crm_slas to authenticated;

create table if not exists public.ark_department_import_batches (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  dataset text not null,
  mode text not null check (mode in ('merge','insert_only','update_only','replace')),
  filename text not null,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  skipped_rows integer not null default 0,
  error_rows integer not null default 0,
  deactivated_rows integer not null default 0,
  status text not null default 'processing',
  summary jsonb not null default '{}'::jsonb,
  imported_by uuid not null default auth.uid(),
  imported_by_email text not null,
  imported_by_name text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ark_department_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ark_department_import_batches(id) on delete cascade,
  row_number integer not null,
  source_data jsonb not null,
  status text not null check (status in ('inserted','updated','skipped','error')),
  action text,
  target_table text,
  target_id uuid,
  natural_key text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create table if not exists public.ark_department_import_links (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  dataset text not null,
  target_table text not null,
  target_id uuid not null,
  natural_key text not null,
  last_batch_id uuid not null references public.ark_department_import_batches(id),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (dataset, target_table, target_id)
);

create index if not exists ark_department_import_batches_created_idx
  on public.ark_department_import_batches(created_at desc);
create index if not exists ark_department_import_rows_batch_idx
  on public.ark_department_import_rows(batch_id, row_number);
create index if not exists ark_department_import_links_dataset_idx
  on public.ark_department_import_links(department, dataset, active);

alter table public.ark_department_import_batches enable row level security;
alter table public.ark_department_import_rows enable row level security;
alter table public.ark_department_import_links enable row level security;

drop policy if exists ark_department_import_batches_admin_read on public.ark_department_import_batches;
create policy ark_department_import_batches_admin_read on public.ark_department_import_batches
for select to authenticated using (public.ark_current_user_role() = 'system_admin');
drop policy if exists ark_department_import_rows_admin_read on public.ark_department_import_rows;
create policy ark_department_import_rows_admin_read on public.ark_department_import_rows
for select to authenticated using (public.ark_current_user_role() = 'system_admin');
drop policy if exists ark_department_import_links_admin_read on public.ark_department_import_links;
create policy ark_department_import_links_admin_read on public.ark_department_import_links
for select to authenticated using (public.ark_current_user_role() = 'system_admin');

grant select on public.ark_department_import_batches, public.ark_department_import_rows to authenticated;
revoke all on public.ark_department_import_links from public, anon, authenticated;

create or replace function public.ark_admin_import_department_data(
  p_department text,
  p_dataset text,
  p_filename text,
  p_rows jsonb,
  p_mode text default 'merge'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actor_name text := public.ark_crm_actor_name();
  clean_department text := lower(trim(coalesce(p_department, '')));
  clean_dataset text := lower(trim(coalesce(p_dataset, '')));
  clean_mode text := lower(trim(coalesce(p_mode, 'merge')));
  batch public.ark_department_import_batches%rowtype;
  row_item record;
  row_data jsonb;
  target_id uuid;
  target_table text;
  natural_key text;
  row_action text;
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  error_count integer := 0;
  deactivated_count integer := 0;
  existing boolean;
  clean_status text;
  clean_tracking text;
  branch_key_value text;
  prior record;
begin
  if auth.uid() is null or actor_role <> 'system_admin' then
    raise exception 'System administrator authorization required' using errcode = '42501';
  end if;
  if clean_mode not in ('merge','insert_only','update_only','replace') then
    raise exception 'Import mode must be merge, insert_only, update_only or replace';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception 'Import must contain between 1 and 2,000 rows';
  end if;
  if nullif(trim(coalesce(p_filename, '')), '') is null then raise exception 'Filename is required'; end if;
  if not (
    (clean_dataset='legacy_clients' and clean_department='business_development') or
    (clean_dataset='poc_register' and clean_department='business_development') or
    (clean_dataset='supply_register' and clean_department='business_development') or
    (clean_dataset='sla_register' and clean_department='business_development') or
    (clean_dataset='employees' and clean_department='human_resources') or
    (clean_dataset='banks_branches' and clean_department='operations') or
    (clean_dataset='supported_devices' and clean_department='helpdesk') or
    (clean_dataset='device_assignments' and clean_department='field_engineering') or
    (clean_dataset='spare_parts' and clean_department='inventory') or
    (clean_dataset='suppliers' and clean_department='procurement') or
    (clean_dataset='chart_of_accounts' and clean_department='finance_accounts') or
    (clean_dataset='company_assets' and clean_department='information_technology') or
    (clean_dataset='repair_intake' and clean_department='repair_refurbishment')
  ) then raise exception 'Unsupported department and dataset combination'; end if;
  if clean_mode = 'replace' and clean_dataset in ('device_assignments','repair_intake') then
    raise exception 'Replace is not permitted for workflow or assignment datasets';
  end if;

  insert into public.ark_department_import_batches(
    department,dataset,mode,filename,total_rows,imported_by_email,imported_by_name
  ) values (
    clean_department,clean_dataset,clean_mode,left(trim(p_filename),255),jsonb_array_length(p_rows),actor_email,actor_name
  ) returning * into batch;

  for row_item in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    row_data := row_item.value;
    target_id := null; target_table := null; natural_key := null; row_action := null; existing := false;
    begin
      if jsonb_typeof(row_data) <> 'object' then raise exception 'Row must be an object'; end if;

      if clean_dataset = 'legacy_clients' then
        natural_key := lower(trim(coalesce(row_data ->> 'client_name', '')));
        if natural_key = '' then raise exception 'client_name is required'; end if;
        target_table := 'crm_clients';
        select id into target_id from public.crm_clients
          where lower(trim(client_name)) = natural_key
             or (nullif(lower(trim(row_data ->> 'contact_email')), '') is not null and lower(trim(contact_email)) = lower(trim(row_data ->> 'contact_email')))
          order by created_at limit 1 for update;
        existing := found;
        if existing and clean_mode = 'insert_only' then row_action := 'skipped';
        elsif not existing and clean_mode = 'update_only' then row_action := 'skipped';
        elsif existing then
          update public.crm_clients set
            client_name=trim(row_data->>'client_name'), industry=coalesce(nullif(trim(row_data->>'industry'),''),industry),
            contact_name=coalesce(nullif(trim(row_data->>'contact_name'),''),contact_name), contact_email=coalesce(nullif(lower(trim(row_data->>'contact_email')),''),contact_email),
            contact_phone=coalesce(nullif(trim(row_data->>'contact_phone'),''),contact_phone), relationship_manager_email=coalesce(nullif(lower(trim(row_data->>'relationship_manager_email')),''),relationship_manager_email),
            contract_value=case when nullif(trim(row_data->>'contract_value'),'') is null then contract_value else (row_data->>'contract_value')::numeric end,
            contract_start=coalesce(nullif(row_data->>'contract_start','')::date,contract_start), contract_end=coalesce(nullif(row_data->>'contract_end','')::date,contract_end),
            sla_level=coalesce(nullif(trim(row_data->>'sla_level'),''),sla_level), branch_count=case when nullif(trim(row_data->>'branch_count'),'') is null then branch_count else (row_data->>'branch_count')::integer end,
            status=coalesce(nullif(lower(trim(row_data->>'status')),''),status), notes=coalesce(nullif(trim(row_data->>'notes'),''),notes),
            client_origin='legacy_import',legacy_reference=coalesce(nullif(trim(row_data->>'legacy_reference'),''),legacy_reference),
            original_relationship_start_date=coalesce(nullif(row_data->>'relationship_start_date','')::date,original_relationship_start_date),
            imported_at=now(),imported_by_email=actor_email,updated_at=now()
          where id=target_id;
          row_action := 'updated';
        else
          insert into public.crm_clients(
            client_code,client_name,industry,contact_name,contact_email,contact_phone,relationship_manager,relationship_manager_email,
            contract_value,contract_start,contract_end,sla_level,branch_count,status,notes,onboarding_status,client_origin,legacy_reference,
            original_relationship_start_date,imported_at,imported_by_email,created_at,updated_at
          ) values (
            'LEG-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),trim(row_data->>'client_name'),nullif(trim(row_data->>'industry'),''),
            nullif(trim(row_data->>'contact_name'),''),nullif(lower(trim(row_data->>'contact_email')),''),nullif(trim(row_data->>'contact_phone'),''),
            coalesce(nullif(trim(row_data->>'relationship_manager_email'),''),'Unassigned'),nullif(lower(trim(row_data->>'relationship_manager_email')),''),coalesce(nullif(row_data->>'contract_value','')::numeric,0),
            nullif(row_data->>'contract_start','')::date,nullif(row_data->>'contract_end','')::date,coalesce(nullif(trim(row_data->>'sla_level'),''),'standard'),coalesce(nullif(row_data->>'branch_count','')::integer,0),
            coalesce(nullif(lower(trim(row_data->>'status')),''),'active'),nullif(trim(row_data->>'notes'),''),'pending','legacy_import',nullif(trim(row_data->>'legacy_reference'),''),
            nullif(row_data->>'relationship_start_date','')::date,now(),actor_email,now(),now()
          ) returning id into target_id;
          row_action := 'inserted';
        end if;

      elsif clean_dataset = 'poc_register' then
        natural_key:=lower(trim(coalesce(row_data->>'poc_reference','')));
        if natural_key='' or nullif(trim(row_data->>'client_name'),'') is null or nullif(trim(row_data->>'product_to_demo'),'') is null or nullif(trim(row_data->>'requirements'),'') is null then
          raise exception 'poc_reference, client_name, product_to_demo and requirements are required';
        end if;
        if nullif(row_data->>'start_date','')::date is null or nullif(row_data->>'end_date','')::date is null then raise exception 'POC start and end dates are required'; end if;
        clean_status:=coalesce(nullif(lower(trim(row_data->>'status')),''),'planned');
        if clean_status not in ('planned','in_progress','successful','not_successful','cancelled') then raise exception 'Invalid POC status'; end if;
        target_table:='crm_pocs'; select id into target_id from public.crm_pocs where lower(trim(poc_reference))=natural_key for update; existing:=found;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.crm_pocs set client_name=trim(row_data->>'client_name'),product_to_demo=trim(row_data->>'product_to_demo'),start_date=(row_data->>'start_date')::date,end_date=(row_data->>'end_date')::date,requirements=trim(row_data->>'requirements'),status=clean_status,outcome_notes=nullif(trim(row_data->>'outcome_notes'),''),owner_email=actor_email,updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.crm_pocs(poc_reference,client_name,product_to_demo,start_date,end_date,requirements,status,outcome_notes,owner_email,created_by,created_at,updated_at)
          values(trim(row_data->>'poc_reference'),trim(row_data->>'client_name'),trim(row_data->>'product_to_demo'),(row_data->>'start_date')::date,(row_data->>'end_date')::date,trim(row_data->>'requirements'),clean_status,nullif(trim(row_data->>'outcome_notes'),''),actor_email,auth.uid(),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset = 'supply_register' then
        natural_key:=lower(trim(coalesce(row_data->>'lpo_number','')));
        if natural_key='' or nullif(trim(row_data->>'client_name'),'') is null or nullif(trim(row_data->>'product_requested'),'') is null then raise exception 'lpo_number, client_name and product_requested are required'; end if;
        if coalesce(nullif(row_data->>'quantity','')::integer,0)<=0 then raise exception 'quantity must be greater than zero'; end if;
        if coalesce(nullif(row_data->>'invoice_value','')::numeric,-1)<0 then raise exception 'invoice_value must be zero or greater'; end if;
        clean_status:=coalesce(nullif(lower(trim(row_data->>'status')),''),'offer');
        if clean_status not in ('offer','lpo_received','procurement','ready_to_supply','supplied','cancelled') then raise exception 'Invalid supply status'; end if;
        target_table:='crm_supply_register'; select id into target_id from public.crm_supply_register where lower(trim(lpo_number))=natural_key for update; existing:=found;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.crm_supply_register set client_name=trim(row_data->>'client_name'),industry=nullif(trim(row_data->>'industry'),''),contact_name=nullif(trim(row_data->>'contact_name'),''),contact_phone=nullif(trim(row_data->>'contact_phone'),''),product_requested=trim(row_data->>'product_requested'),quantity=(row_data->>'quantity')::integer,invoice_value=(row_data->>'invoice_value')::numeric,ark_profit=coalesce(nullif(row_data->>'ark_profit','')::numeric,ark_profit),supplier_name=nullif(trim(row_data->>'supplier_name'),''),supply_date=nullif(row_data->>'supply_date','')::date,status=clean_status,notes=nullif(trim(row_data->>'notes'),''),owner_email=actor_email,updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.crm_supply_register(lpo_number,client_name,industry,contact_name,contact_phone,product_requested,quantity,invoice_value,ark_profit,supplier_name,supply_date,status,notes,owner_email,created_by,created_at,updated_at)
          values(trim(row_data->>'lpo_number'),trim(row_data->>'client_name'),nullif(trim(row_data->>'industry'),''),nullif(trim(row_data->>'contact_name'),''),nullif(trim(row_data->>'contact_phone'),''),trim(row_data->>'product_requested'),(row_data->>'quantity')::integer,(row_data->>'invoice_value')::numeric,coalesce(nullif(row_data->>'ark_profit','')::numeric,0),nullif(trim(row_data->>'supplier_name'),''),nullif(row_data->>'supply_date','')::date,clean_status,nullif(trim(row_data->>'notes'),''),actor_email,auth.uid(),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset = 'sla_register' then
        natural_key:=lower(trim(coalesce(row_data->>'sla_reference','')));
        if natural_key='' or nullif(trim(row_data->>'client_name'),'') is null or nullif(trim(row_data->>'sla_type'),'') is null or nullif(trim(row_data->>'product'),'') is null then raise exception 'sla_reference, client_name, sla_type and product are required'; end if;
        if nullif(row_data->>'agreement_start_date','')::date is null or nullif(row_data->>'agreement_end_date','')::date is null then raise exception 'Agreement start and end dates are required'; end if;
        if coalesce(nullif(row_data->>'support_fee_per_product','')::numeric,-1)<0 then raise exception 'support_fee_per_product must be zero or greater'; end if;
        clean_status:=coalesce(nullif(lower(trim(row_data->>'status')),''),'draft');
        if clean_status not in ('draft','active','expired','renewal_due','terminated') then raise exception 'Invalid SLA status'; end if;
        target_table:='crm_slas'; select id into target_id from public.crm_slas where lower(trim(sla_reference))=natural_key for update; existing:=found;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.crm_slas set client_name=trim(row_data->>'client_name'),industry=nullif(trim(row_data->>'industry'),''),contact_name=nullif(trim(row_data->>'contact_name'),''),contact_phone=nullif(trim(row_data->>'contact_phone'),''),sla_type=trim(row_data->>'sla_type'),product=trim(row_data->>'product'),agreement_start_date=(row_data->>'agreement_start_date')::date,agreement_end_date=(row_data->>'agreement_end_date')::date,support_fee_per_product=(row_data->>'support_fee_per_product')::numeric,status=clean_status,notes=nullif(trim(row_data->>'notes'),''),owner_email=actor_email,updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.crm_slas(sla_reference,client_name,industry,contact_name,contact_phone,sla_type,product,agreement_start_date,agreement_end_date,support_fee_per_product,status,notes,owner_email,created_by,created_at,updated_at)
          values(trim(row_data->>'sla_reference'),trim(row_data->>'client_name'),nullif(trim(row_data->>'industry'),''),nullif(trim(row_data->>'contact_name'),''),nullif(trim(row_data->>'contact_phone'),''),trim(row_data->>'sla_type'),trim(row_data->>'product'),(row_data->>'agreement_start_date')::date,(row_data->>'agreement_end_date')::date,(row_data->>'support_fee_per_product')::numeric,clean_status,nullif(trim(row_data->>'notes'),''),actor_email,auth.uid(),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset = 'employees' then
        natural_key := lower(trim(coalesce(row_data ->> 'email_address', '')));
        if natural_key = '' or nullif(trim(row_data->>'full_name'),'') is null or nullif(trim(row_data->>'staff_id'),'') is null then raise exception 'full_name, staff_id and email_address are required'; end if;
        target_table := 'employees';
        select id into target_id from public.employees where lower(trim(email_address))=natural_key order by created_at limit 1 for update;
        existing := found;
        if existing and clean_mode='insert_only' then row_action:='skipped';
        elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then
          update public.employees set full_name=trim(row_data->>'full_name'),staff_id=upper(trim(row_data->>'staff_id')),
            email_address=natural_key,email=coalesce(email,natural_key),phone_number=coalesce(nullif(trim(row_data->>'phone_number'),''),phone_number),
            department=trim(row_data->>'department'),job_title=coalesce(nullif(trim(row_data->>'job_title'),''),job_title),
            date_of_employment=coalesce(nullif(row_data->>'date_of_employment','')::date,date_of_employment),
            employment_status=coalesce(nullif(trim(row_data->>'employment_status'),''),employment_status),updated_at=now()
          where id=target_id; row_action:='updated';
        else
          insert into public.employees(full_name,staff_id,email_address,email,phone_number,department,job_title,date_of_employment,employment_status,status,created_at,updated_at)
          values(trim(row_data->>'full_name'),upper(trim(row_data->>'staff_id')),natural_key,natural_key,nullif(trim(row_data->>'phone_number'),''),trim(row_data->>'department'),
            nullif(trim(row_data->>'job_title'),''),nullif(row_data->>'date_of_employment','')::date,coalesce(nullif(trim(row_data->>'employment_status'),''),'Active'),'active',now(),now()) returning id into target_id;
          row_action:='inserted';
        end if;

      elsif clean_dataset = 'banks_branches' then
        if nullif(trim(row_data->>'bank_name'),'') is null or nullif(trim(row_data->>'branch_name'),'') is null or nullif(trim(row_data->>'location'),'') is null then raise exception 'bank_name, branch_name and location are required'; end if;
        branch_key_value := upper(trim(row_data->>'bank_name'))||'-'||upper(trim(row_data->>'branch_name'));
        natural_key := lower(branch_key_value); target_table := 'branches';
        insert into public.banks(bank_name,name,status,created_at,updated_at) values(upper(trim(row_data->>'bank_name')),upper(trim(row_data->>'bank_name')),coalesce(nullif(lower(trim(row_data->>'status')),''),'active'),now(),now())
        on conflict(bank_name) do update set name=excluded.name,updated_at=now();
        select id into target_id from public.branches where branch_key=branch_key_value for update; existing:=found;
        if existing and clean_mode='insert_only' then row_action:='skipped';
        elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.branches set bank_name=upper(trim(row_data->>'bank_name')),branch_name=trim(row_data->>'branch_name'),location=trim(row_data->>'location'),region=nullif(trim(row_data->>'region'),''),
          assigned_engineer=nullif(lower(trim(row_data->>'assigned_engineer_email')),''),assigned_engineer_name=nullif(trim(row_data->>'assigned_engineer_name'),''),status=coalesce(nullif(lower(trim(row_data->>'status')),''),'active'),notes=nullif(trim(row_data->>'notes'),''),updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.branches(bank_name,branch_name,location,region,assigned_engineer,assigned_engineer_name,status,notes,branch_key,created_at,updated_at)
          values(upper(trim(row_data->>'bank_name')),trim(row_data->>'branch_name'),trim(row_data->>'location'),nullif(trim(row_data->>'region'),''),nullif(lower(trim(row_data->>'assigned_engineer_email')),''),nullif(trim(row_data->>'assigned_engineer_name'),''),coalesce(nullif(lower(trim(row_data->>'status')),''),'active'),nullif(trim(row_data->>'notes'),''),branch_key_value,now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset in ('supported_devices','device_assignments') then
        natural_key:=lower(trim(coalesce(row_data->>'terminal_id',''))); if natural_key='' then raise exception 'terminal_id is required'; end if;
        target_table:='devices'; select id into target_id from public.devices where lower(trim(terminal_id))=natural_key limit 1 for update; existing:=found;
        if clean_dataset='supported_devices' and nullif(trim(row_data->>'device_name'),'') is null then raise exception 'device_name is required'; end if;
        if clean_dataset='device_assignments' and (nullif(trim(row_data->>'assigned_engineer_email'),'') is null or nullif(trim(row_data->>'assigned_engineer_name'),'') is null) then raise exception 'assigned engineer email and name are required'; end if;
        if existing and clean_mode='insert_only' then row_action:='skipped';
        elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif not existing and clean_dataset='device_assignments' then raise exception 'Device does not exist; register it through the Helpdesk template first';
        elsif existing then update public.devices set
          device_name=coalesce(nullif(trim(row_data->>'device_name'),''),device_name),device_type=coalesce(nullif(trim(row_data->>'device_type'),''),device_type),device_model=coalesce(nullif(trim(row_data->>'device_model'),''),device_model),
          serial_number=coalesce(nullif(trim(row_data->>'serial_number'),''),serial_number),client_name=coalesce(nullif(trim(row_data->>'client_name'),''),client_name),branch_name=coalesce(nullif(trim(row_data->>'branch_name'),''),branch_name),
          location=coalesce(nullif(trim(row_data->>'location'),''),location),assigned_engineer_email=coalesce(nullif(lower(trim(row_data->>'assigned_engineer_email')),''),assigned_engineer_email),assigned_engineer_name=coalesce(nullif(trim(row_data->>'assigned_engineer_name'),''),assigned_engineer_name),
          status=coalesce(nullif(lower(trim(row_data->>'status')),''),status),installation_date=coalesce(nullif(row_data->>'installation_date','')::date,installation_date),warranty_expiry=coalesce(nullif(row_data->>'warranty_expiry','')::date,warranty_expiry),notes=coalesce(nullif(trim(row_data->>'notes'),''),notes),updated_at=now()
          where id=target_id; row_action:='updated';
        else insert into public.devices(terminal_id,atm_terminal_id,device_name,name,device_type,device_model,serial_number,client_name,branch_name,location,assigned_engineer_email,assigned_engineer_name,status,installation_date,warranty_expiry,notes,created_at,updated_at)
          values(trim(row_data->>'terminal_id'),trim(row_data->>'terminal_id'),trim(row_data->>'device_name'),trim(row_data->>'device_name'),nullif(trim(row_data->>'device_type'),''),nullif(trim(row_data->>'device_model'),''),nullif(trim(row_data->>'serial_number'),''),trim(row_data->>'client_name'),nullif(trim(row_data->>'branch_name'),''),nullif(trim(row_data->>'location'),''),nullif(lower(trim(row_data->>'assigned_engineer_email')),''),nullif(trim(row_data->>'assigned_engineer_name'),''),coalesce(nullif(lower(trim(row_data->>'status')),''),'active'),nullif(row_data->>'installation_date','')::date,nullif(row_data->>'warranty_expiry','')::date,nullif(trim(row_data->>'notes'),''),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset='spare_parts' then
        natural_key:=lower(trim(coalesce(row_data->>'part_number',''))); if natural_key='' or nullif(trim(row_data->>'part_name'),'') is null then raise exception 'part_number and part_name are required'; end if;
        if coalesce(nullif(row_data->>'quantity_available','')::integer,-1)<0 then raise exception 'quantity_available must be zero or greater'; end if;
        target_table:='spare_parts'; select id into target_id from public.spare_parts where lower(trim(part_number))=natural_key order by created_at limit 1 for update; existing:=found;
        clean_tracking:=coalesce(nullif(lower(trim(row_data->>'tracking_type')),''),'quantity'); if clean_tracking not in ('quantity','serial') then raise exception 'tracking_type must be quantity or serial'; end if;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.spare_parts set part_name=trim(row_data->>'part_name'),category=coalesce(nullif(trim(row_data->>'category'),''),category),device_brand=coalesce(nullif(trim(row_data->>'device_brand'),''),device_brand),device_model=coalesce(nullif(trim(row_data->>'device_model'),''),device_model),
          quantity_available=(row_data->>'quantity_available')::integer,quantity=(row_data->>'quantity_available')::integer,minimum_stock_level=coalesce(nullif(row_data->>'minimum_stock_level','')::integer,minimum_stock_level),unit_price_ngn=coalesce(nullif(row_data->>'unit_price_ngn','')::numeric,unit_price_ngn),
          warehouse=coalesce(nullif(trim(row_data->>'warehouse'),''),warehouse),storage_location=coalesce(nullif(trim(row_data->>'storage_location'),''),storage_location),tracking_type=clean_tracking,serial_tracking=(clean_tracking='serial'),status=coalesce(nullif(lower(trim(row_data->>'status')),''),status),notes=coalesce(nullif(trim(row_data->>'notes'),''),notes),updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.spare_parts(part_number,part_name,category,device_brand,device_model,quantity_available,quantity,minimum_stock_level,unit_price_ngn,warehouse,storage_location,tracking_type,serial_tracking,status,notes,created_at,updated_at)
          values(trim(row_data->>'part_number'),trim(row_data->>'part_name'),nullif(trim(row_data->>'category'),''),nullif(trim(row_data->>'device_brand'),''),nullif(trim(row_data->>'device_model'),''),(row_data->>'quantity_available')::integer,(row_data->>'quantity_available')::integer,coalesce(nullif(row_data->>'minimum_stock_level','')::integer,2),coalesce(nullif(row_data->>'unit_price_ngn','')::numeric,0),coalesce(nullif(trim(row_data->>'warehouse'),''),'Oshodi'),nullif(trim(row_data->>'storage_location'),''),clean_tracking,(clean_tracking='serial'),coalesce(nullif(lower(trim(row_data->>'status')),''),'available'),nullif(trim(row_data->>'notes'),''),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset='suppliers' then
        natural_key:=lower(trim(coalesce(row_data->>'supplier_name',''))); if natural_key='' then raise exception 'supplier_name is required'; end if;
        target_table:='inventory_suppliers'; select id into target_id from public.inventory_suppliers where lower(trim(supplier_name))=natural_key limit 1 for update; existing:=found;
        clean_status:=coalesce(nullif(lower(trim(row_data->>'status')),''),'active'); if clean_status not in ('active','inactive') then raise exception 'status must be active or inactive'; end if;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.inventory_suppliers set contact_person=nullif(trim(row_data->>'contact_person'),''),phone=nullif(trim(row_data->>'phone'),''),email=nullif(lower(trim(row_data->>'email')),''),address=nullif(trim(row_data->>'address'),''),tax_identification_number=nullif(trim(row_data->>'tax_identification_number'),''),registration_number=nullif(trim(row_data->>'registration_number'),''),payment_terms=nullif(trim(row_data->>'payment_terms'),''),bank_name=nullif(trim(row_data->>'bank_name'),''),bank_account_name=nullif(trim(row_data->>'bank_account_name'),''),bank_account_number=nullif(trim(row_data->>'bank_account_number'),''),status=clean_status,notes=nullif(trim(row_data->>'notes'),''),updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.inventory_suppliers(supplier_name,contact_person,phone,email,address,tax_identification_number,registration_number,payment_terms,bank_name,bank_account_name,bank_account_number,status,notes,created_by,created_at,updated_at)
          values(trim(row_data->>'supplier_name'),nullif(trim(row_data->>'contact_person'),''),nullif(trim(row_data->>'phone'),''),nullif(lower(trim(row_data->>'email')),''),nullif(trim(row_data->>'address'),''),nullif(trim(row_data->>'tax_identification_number'),''),nullif(trim(row_data->>'registration_number'),''),nullif(trim(row_data->>'payment_terms'),''),nullif(trim(row_data->>'bank_name'),''),nullif(trim(row_data->>'bank_account_name'),''),nullif(trim(row_data->>'bank_account_number'),''),clean_status,nullif(trim(row_data->>'notes'),''),auth.uid(),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset='chart_of_accounts' then
        natural_key:=lower(trim(coalesce(row_data->>'account_code',''))); if natural_key='' or nullif(trim(row_data->>'account_name'),'') is null then raise exception 'account_code and account_name are required'; end if;
        if lower(trim(row_data->>'account_type')) not in ('asset','liability','equity','income','expense') then raise exception 'Invalid account_type'; end if;
        if lower(trim(row_data->>'normal_balance')) not in ('debit','credit') then raise exception 'normal_balance must be debit or credit'; end if;
        target_table:='finance_accounts'; select id into target_id from public.finance_accounts where lower(trim(account_code))=natural_key for update; existing:=found;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.finance_accounts set account_name=trim(row_data->>'account_name'),account_type=lower(trim(row_data->>'account_type')),normal_balance=lower(trim(row_data->>'normal_balance')),description=nullif(trim(row_data->>'description'),''),is_active=coalesce(nullif(lower(trim(row_data->>'is_active')),'')::boolean,is_active),updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.finance_accounts(account_code,account_name,account_type,normal_balance,description,is_active,created_at,updated_at)
          values(trim(row_data->>'account_code'),trim(row_data->>'account_name'),lower(trim(row_data->>'account_type')),lower(trim(row_data->>'normal_balance')),nullif(trim(row_data->>'description'),''),coalesce(nullif(lower(trim(row_data->>'is_active')),'')::boolean,true),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset='company_assets' then
        natural_key:=lower(trim(coalesce(row_data->>'asset_code',''))); if natural_key='' or nullif(trim(row_data->>'asset_name'),'') is null then raise exception 'asset_code and asset_name are required'; end if;
        target_table:='finance_fixed_assets'; select id into target_id from public.finance_fixed_assets where lower(trim(asset_code))=natural_key for update; existing:=found;
        clean_status:=coalesce(nullif(lower(trim(row_data->>'status')),''),'active'); if clean_status not in ('active','assigned','under_repair','disposed','lost','retired') then raise exception 'Invalid asset status'; end if;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.finance_fixed_assets set asset_name=trim(row_data->>'asset_name'),asset_type=nullif(trim(row_data->>'asset_type'),''),serial_number=nullif(trim(row_data->>'serial_number'),''),purchase_date=nullif(row_data->>'purchase_date','')::date,purchase_cost=coalesce(nullif(row_data->>'purchase_cost','')::numeric,purchase_cost),assigned_department=nullif(trim(row_data->>'assigned_department'),''),assigned_employee_id=nullif(trim(row_data->>'assigned_employee_id'),''),assigned_employee_name=nullif(trim(row_data->>'assigned_employee_name'),''),current_location=nullif(trim(row_data->>'current_location'),''),warranty_expiry=nullif(row_data->>'warranty_expiry','')::date,status=clean_status,updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.finance_fixed_assets(asset_code,asset_name,asset_type,serial_number,purchase_date,purchase_cost,assigned_department,assigned_employee_id,assigned_employee_name,current_location,warranty_expiry,current_book_value,status,created_by,created_at,updated_at)
          values(trim(row_data->>'asset_code'),trim(row_data->>'asset_name'),nullif(trim(row_data->>'asset_type'),''),nullif(trim(row_data->>'serial_number'),''),nullif(row_data->>'purchase_date','')::date,coalesce(nullif(row_data->>'purchase_cost','')::numeric,0),nullif(trim(row_data->>'assigned_department'),''),nullif(trim(row_data->>'assigned_employee_id'),''),nullif(trim(row_data->>'assigned_employee_name'),''),nullif(trim(row_data->>'current_location'),''),nullif(row_data->>'warranty_expiry','')::date,coalesce(nullif(row_data->>'purchase_cost','')::numeric,0),clean_status,auth.uid(),now(),now()) returning id into target_id; row_action:='inserted'; end if;

      elsif clean_dataset='repair_intake' then
        natural_key:=lower(trim(coalesce(row_data->>'job_number',''))); if natural_key='' or nullif(trim(row_data->>'item_name'),'') is null or nullif(trim(row_data->>'received_from'),'') is null then raise exception 'job_number, item_name and received_from are required'; end if;
        if coalesce(nullif(row_data->>'quantity_received','')::integer,0)<=0 then raise exception 'quantity_received must be greater than zero'; end if;
        target_table:='repair_jobs'; select id into target_id from public.repair_jobs where lower(trim(job_number))=natural_key order by created_at limit 1 for update; existing:=found;
        if existing and clean_mode='insert_only' then row_action:='skipped'; elsif not existing and clean_mode='update_only' then row_action:='skipped';
        elsif existing then update public.repair_jobs set item_name=trim(row_data->>'item_name'),part_number=nullif(trim(row_data->>'part_number'),''),machine_brand=nullif(trim(row_data->>'machine_brand'),''),machine_model=nullif(trim(row_data->>'machine_model'),''),quantity_received=(row_data->>'quantity_received')::integer,received_from=trim(row_data->>'received_from'),condition_on_arrival=nullif(trim(row_data->>'condition_on_arrival'),''),fault_description=nullif(trim(row_data->>'fault_description'),''),action_required=nullif(trim(row_data->>'action_required'),''),priority=coalesce(nullif(lower(trim(row_data->>'priority')),''),priority),final_remark=coalesce(nullif(trim(row_data->>'notes'),''),final_remark),updated_at=now() where id=target_id; row_action:='updated';
        else insert into public.repair_jobs(job_number,item_name,part_number,machine_brand,machine_model,quantity_received,received_from,condition_on_arrival,fault_description,action_required,priority,source_type,status,test_result,inventory_transfer_status,final_remark,created_at,updated_at)
          values(trim(row_data->>'job_number'),trim(row_data->>'item_name'),nullif(trim(row_data->>'part_number'),''),nullif(trim(row_data->>'machine_brand'),''),nullif(trim(row_data->>'machine_model'),''),(row_data->>'quantity_received')::integer,trim(row_data->>'received_from'),nullif(trim(row_data->>'condition_on_arrival'),''),nullif(trim(row_data->>'fault_description'),''),nullif(trim(row_data->>'action_required'),''),coalesce(nullif(lower(trim(row_data->>'priority')),''),'medium'),'legacy_import','pending_rr','pending','not_ready',nullif(trim(row_data->>'notes'),''),now(),now()) returning id into target_id; row_action:='inserted'; end if;
      end if;

      if row_action='inserted' then inserted_count:=inserted_count+1;
      elsif row_action='updated' then updated_count:=updated_count+1;
      else skipped_count:=skipped_count+1; end if;

      insert into public.ark_department_import_rows(batch_id,row_number,source_data,status,action,target_table,target_id,natural_key)
      values(batch.id,row_item.ordinality::integer+1,row_data,row_action,row_action,target_table,target_id,natural_key);

      if target_id is not null then
        insert into public.ark_department_import_links(department,dataset,target_table,target_id,natural_key,last_batch_id,active,updated_at)
        values(clean_department,clean_dataset,target_table,target_id,natural_key,batch.id,true,now())
        on conflict(dataset,target_table,target_id) do update set department=excluded.department,natural_key=excluded.natural_key,last_batch_id=excluded.last_batch_id,active=true,updated_at=now();
      end if;
    exception when others then
      error_count:=error_count+1;
      insert into public.ark_department_import_rows(batch_id,row_number,source_data,status,action,target_table,target_id,natural_key,error_message)
      values(batch.id,row_item.ordinality::integer+1,row_data,'error','error',target_table,target_id,natural_key,left(sqlerrm,1000));
    end;
  end loop;

  if clean_mode='replace' and error_count=0 then
    for prior in select * from public.ark_department_import_links where department=clean_department and dataset=clean_dataset and active is true and last_batch_id<>batch.id for update loop
      if prior.target_table='crm_clients' then update public.crm_clients set status='inactive',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='crm_pocs' then update public.crm_pocs set status='cancelled',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='crm_supply_register' then update public.crm_supply_register set status='cancelled',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='crm_slas' then update public.crm_slas set status='terminated',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='employees' then update public.employees set employment_status='Inactive',status='inactive',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='branches' then update public.branches set status='inactive',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='devices' then update public.devices set status='inactive',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='spare_parts' then update public.spare_parts set status='inactive',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='inventory_suppliers' then update public.inventory_suppliers set status='inactive',updated_at=now() where id=prior.target_id;
      elsif prior.target_table='finance_accounts' then update public.finance_accounts set is_active=false,updated_at=now() where id=prior.target_id;
      elsif prior.target_table='finance_fixed_assets' then update public.finance_fixed_assets set status='retired',updated_at=now() where id=prior.target_id;
      end if;
      update public.ark_department_import_links set active=false,updated_at=now() where id=prior.id;
      deactivated_count:=deactivated_count+1;
    end loop;
  end if;

  update public.ark_department_import_batches set
    imported_rows=inserted_count+updated_count,inserted_rows=inserted_count,updated_rows=updated_count,
    skipped_rows=skipped_count,error_rows=error_count,deactivated_rows=deactivated_count,
    status=case when error_count=0 then 'completed' when inserted_count+updated_count>0 then 'completed_with_errors' else 'failed' end,
    summary=jsonb_build_object('inserted',inserted_count,'updated',updated_count,'skipped',skipped_count,'errors',error_count,'deactivated',deactivated_count),completed_at=now()
  where id=batch.id;

  return jsonb_build_object('batch_id',batch.id,'inserted',inserted_count,'updated',updated_count,'skipped',skipped_count,'errors',error_count,'deactivated',deactivated_count);
end;
$$;

create or replace function public.ark_crm_save_commercial_record(
  p_record_type text,
  p_payload jsonb,
  p_record_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  record_type text := lower(trim(coalesce(p_record_type, '')));
  saved jsonb;
  target_id uuid;
  client_match uuid;
  notify_roles text[];
  notify_title text;
  notify_message text;
begin
  if auth.uid() is null or actor_role not in ('system_admin','agm','business_developer','crm') then
    raise exception 'Business Development authorization required' using errcode='42501';
  end if;
  if record_type not in ('poc','supply','sla') then raise exception 'Commercial record type must be POC, supply or SLA'; end if;
  select id into client_match from public.crm_clients
    where id=nullif(p_payload->>'client_id','')::uuid or lower(trim(client_name))=lower(trim(p_payload->>'client_name'))
    order by case when id=nullif(p_payload->>'client_id','')::uuid then 0 else 1 end,created_at limit 1;

  if record_type='poc' then
    if nullif(trim(p_payload->>'poc_reference'),'') is null or nullif(trim(p_payload->>'client_name'),'') is null or nullif(trim(p_payload->>'product_to_demo'),'') is null or nullif(trim(p_payload->>'requirements'),'') is null then raise exception 'POC reference, client, product and requirements are required'; end if;
    if nullif(p_payload->>'start_date','')::date is null or nullif(p_payload->>'end_date','')::date is null then raise exception 'POC start and end dates are required'; end if;
    if p_record_id is null then
      insert into public.crm_pocs(poc_reference,client_id,client_name,product_to_demo,start_date,end_date,requirements,status,outcome_notes,owner_email,created_by,created_at,updated_at)
      values(trim(p_payload->>'poc_reference'),client_match,trim(p_payload->>'client_name'),trim(p_payload->>'product_to_demo'),(p_payload->>'start_date')::date,(p_payload->>'end_date')::date,trim(p_payload->>'requirements'),coalesce(nullif(lower(trim(p_payload->>'status')),''),'planned'),nullif(trim(p_payload->>'outcome_notes'),''),actor_email,auth.uid(),now(),now()) returning id into target_id;
    else
      update public.crm_pocs set poc_reference=trim(p_payload->>'poc_reference'),client_id=client_match,client_name=trim(p_payload->>'client_name'),product_to_demo=trim(p_payload->>'product_to_demo'),start_date=(p_payload->>'start_date')::date,end_date=(p_payload->>'end_date')::date,requirements=trim(p_payload->>'requirements'),status=coalesce(nullif(lower(trim(p_payload->>'status')),''),status),outcome_notes=nullif(trim(p_payload->>'outcome_notes'),''),owner_email=actor_email,updated_at=now() where id=p_record_id returning id into target_id;
      if not found then raise exception 'POC record not found'; end if;
    end if;
    select to_jsonb(record_row) into saved from public.crm_pocs record_row where record_row.id=target_id;
    notify_roles:=array['business_developer','agm','operations','it']; notify_title:='Business Development POC Updated'; notify_message:=(p_payload->>'client_name')||': '||(p_payload->>'product_to_demo')||' — '||coalesce(p_payload->>'status','planned');
  elsif record_type='supply' then
    if nullif(trim(p_payload->>'lpo_number'),'') is null or nullif(trim(p_payload->>'client_name'),'') is null or nullif(trim(p_payload->>'product_requested'),'') is null then raise exception 'LPO number, client and product are required'; end if;
    if coalesce(nullif(p_payload->>'quantity','')::integer,0)<=0 then raise exception 'Quantity must be greater than zero'; end if;
    if p_record_id is null then
      insert into public.crm_supply_register(lpo_number,client_id,client_name,industry,contact_name,contact_phone,product_requested,quantity,invoice_value,invoice_document,ark_profit,supplier_name,supply_date,delivery_note_document,status,notes,owner_email,created_by,created_at,updated_at)
      values(trim(p_payload->>'lpo_number'),client_match,trim(p_payload->>'client_name'),nullif(trim(p_payload->>'industry'),''),nullif(trim(p_payload->>'contact_name'),''),nullif(trim(p_payload->>'contact_phone'),''),trim(p_payload->>'product_requested'),(p_payload->>'quantity')::integer,coalesce(nullif(p_payload->>'invoice_value','')::numeric,0),nullif(p_payload->>'invoice_document',''),coalesce(nullif(p_payload->>'ark_profit','')::numeric,0),nullif(trim(p_payload->>'supplier_name'),''),nullif(p_payload->>'supply_date','')::date,nullif(p_payload->>'delivery_note_document',''),coalesce(nullif(lower(trim(p_payload->>'status')),''),'offer'),nullif(trim(p_payload->>'notes'),''),actor_email,auth.uid(),now(),now()) returning id into target_id;
    else
      update public.crm_supply_register set lpo_number=trim(p_payload->>'lpo_number'),client_id=client_match,client_name=trim(p_payload->>'client_name'),industry=nullif(trim(p_payload->>'industry'),''),contact_name=nullif(trim(p_payload->>'contact_name'),''),contact_phone=nullif(trim(p_payload->>'contact_phone'),''),product_requested=trim(p_payload->>'product_requested'),quantity=(p_payload->>'quantity')::integer,invoice_value=coalesce(nullif(p_payload->>'invoice_value','')::numeric,0),invoice_document=nullif(p_payload->>'invoice_document',''),ark_profit=coalesce(nullif(p_payload->>'ark_profit','')::numeric,0),supplier_name=nullif(trim(p_payload->>'supplier_name'),''),supply_date=nullif(p_payload->>'supply_date','')::date,delivery_note_document=nullif(p_payload->>'delivery_note_document',''),status=coalesce(nullif(lower(trim(p_payload->>'status')),''),status),notes=nullif(trim(p_payload->>'notes'),''),owner_email=actor_email,updated_at=now() where id=p_record_id returning id into target_id;
      if not found then raise exception 'Supply record not found'; end if;
    end if;
    select to_jsonb(record_row) into saved from public.crm_supply_register record_row where record_row.id=target_id;
    notify_roles:=array['business_developer','agm','finance','head_of_account','inventory','procurement','operations']; notify_title:='LPO / Offer To Supply Updated'; notify_message:=(p_payload->>'client_name')||': '||(p_payload->>'product_requested')||' — '||coalesce(p_payload->>'status','offer');
  else
    if nullif(trim(p_payload->>'sla_reference'),'') is null or nullif(trim(p_payload->>'client_name'),'') is null or nullif(trim(p_payload->>'sla_type'),'') is null or nullif(trim(p_payload->>'product'),'') is null then raise exception 'SLA reference, client, SLA type and product are required'; end if;
    if nullif(p_payload->>'agreement_start_date','')::date is null or nullif(p_payload->>'agreement_end_date','')::date is null then raise exception 'Agreement start and end dates are required'; end if;
    if p_record_id is null then
      insert into public.crm_slas(sla_reference,client_id,client_name,industry,contact_name,contact_phone,sla_type,product,agreement_start_date,agreement_end_date,support_fee_per_product,status,notes,agreement_document,owner_email,created_by,created_at,updated_at)
      values(trim(p_payload->>'sla_reference'),client_match,trim(p_payload->>'client_name'),nullif(trim(p_payload->>'industry'),''),nullif(trim(p_payload->>'contact_name'),''),nullif(trim(p_payload->>'contact_phone'),''),trim(p_payload->>'sla_type'),trim(p_payload->>'product'),(p_payload->>'agreement_start_date')::date,(p_payload->>'agreement_end_date')::date,coalesce(nullif(p_payload->>'support_fee_per_product','')::numeric,0),coalesce(nullif(lower(trim(p_payload->>'status')),''),'draft'),nullif(trim(p_payload->>'notes'),''),nullif(p_payload->>'agreement_document',''),actor_email,auth.uid(),now(),now()) returning id into target_id;
    else
      update public.crm_slas set sla_reference=trim(p_payload->>'sla_reference'),client_id=client_match,client_name=trim(p_payload->>'client_name'),industry=nullif(trim(p_payload->>'industry'),''),contact_name=nullif(trim(p_payload->>'contact_name'),''),contact_phone=nullif(trim(p_payload->>'contact_phone'),''),sla_type=trim(p_payload->>'sla_type'),product=trim(p_payload->>'product'),agreement_start_date=(p_payload->>'agreement_start_date')::date,agreement_end_date=(p_payload->>'agreement_end_date')::date,support_fee_per_product=coalesce(nullif(p_payload->>'support_fee_per_product','')::numeric,0),status=coalesce(nullif(lower(trim(p_payload->>'status')),''),status),notes=nullif(trim(p_payload->>'notes'),''),agreement_document=nullif(p_payload->>'agreement_document',''),owner_email=actor_email,updated_at=now() where id=p_record_id returning id into target_id;
      if not found then raise exception 'SLA record not found'; end if;
    end if;
    select to_jsonb(record_row) into saved from public.crm_slas record_row where record_row.id=target_id;
    notify_roles:=array['business_developer','agm','helpdesk','operations','finance','head_of_account']; notify_title:='Client SLA Updated'; notify_message:=(p_payload->>'client_name')||': '||(p_payload->>'product')||' — '||coalesce(p_payload->>'status','draft');
  end if;
  perform public.ark_emit_workflow_notification('crm_'||record_type,target_id::text,'saved',coalesce(saved->>'status','updated'),notify_title,notify_message,'/crm-commercial',array[]::text[],notify_roles,
    coalesce(saved->>'status','') in ('successful','lpo_received','supplied','active','renewal_due'),jsonb_build_object('record_type',record_type,'record_id',target_id,'event_nonce',saved->>'updated_at'));
  return saved;
end;
$$;

drop policy if exists sensitive_documents_crm_commercial_read on public.sensitive_document_registry;
create policy sensitive_documents_crm_commercial_read on public.sensitive_document_registry for select to authenticated using (
  document_category in ('crm-supply-invoice','crm-supply-delivery-note','crm-sla-agreement')
  and public.ark_has_any_role(array['system_admin','agm','business_developer','crm','finance','head_of_account','inventory','procurement','operations','helpdesk']::text[])
);
drop policy if exists private_documents_crm_commercial_read on storage.objects;
create policy private_documents_crm_commercial_read on storage.objects for select to authenticated using (
  bucket_id='private-documents' and exists(
    select 1 from public.sensitive_document_registry registry
    where registry.bucket_id=storage.objects.bucket_id and registry.object_path=storage.objects.name
      and registry.document_category in ('crm-supply-invoice','crm-supply-delivery-note','crm-sla-agreement')
      and public.ark_has_any_role(array['system_admin','agm','business_developer','crm','finance','head_of_account','inventory','procurement','operations','helpdesk']::text[])
  )
);

create or replace function public.rr_hod_take_repair_job(p_repair_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_profile uuid := public.ark_current_profile_id();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  job public.repair_jobs%rowtype;
  job_status text;
begin
  if auth.uid() is null or actor_role not in ('repair_head','rr_hod','repair_hod','head_of_rr') then
    raise exception 'RR HOD authorization required' using errcode='42501';
  end if;
  if actor_profile is null then raise exception 'RR HOD user profile could not be resolved' using errcode='42501'; end if;
  select * into job from public.repair_jobs where id=p_repair_job_id for update;
  if not found then raise exception 'Repair job was not found'; end if;
  job_status:=lower(trim(coalesce(job.status,'')));
  if job_status not in ('pending_rr','received','assigned','') then raise exception 'This job cannot be taken up at its current stage: %',job.status; end if;
  if job.assigned_rr_technician is not null or nullif(trim(coalesce(job.assigned_to,'')),'') is not null then
    raise exception 'This repair job is already assigned to an RR Technician';
  end if;
  if job.hod_owner_profile_id is not null and job.hod_owner_profile_id<>actor_profile then
    raise exception 'This repair job has already been taken up by another RR HOD';
  end if;
  perform set_config('ark.rr_workflow_rpc','on',true);
  update public.repair_jobs set status='assigned',hod_owner_profile_id=actor_profile,hod_owner_email=actor_email,
    hod_taken_at=coalesce(hod_taken_at,now()),assigned_by=auth.uid(),assigned_at=coalesce(assigned_at,now()),
    final_remark='RR HOD took ownership without technician assignment: '||actor_email,updated_at=now()
  where id=job.id;
  perform public.ark_emit_workflow_notification('repair_job',job.id::text,'hod_take_up','assigned','RR HOD Took Up Repair Job',
    actor_email||' took ownership of '||coalesce(job.job_number,job.id::text)||' without assigning an RR Technician.','/repair-jobs',array[]::text[],array['repair_head','rr_hod','inventory']::text[],false,
    jsonb_build_object('repair_job_id',job.id,'job_number',job.job_number,'hod_owner_email',actor_email,'event_nonce',now()));
  return jsonb_build_object('repair_job_id',job.id,'status','assigned','hod_owner_profile_id',actor_profile,'hod_owner_email',actor_email);
end;
$$;

revoke all on function public.ark_admin_import_department_data(text,text,text,jsonb,text) from public,anon;
grant execute on function public.ark_admin_import_department_data(text,text,text,jsonb,text) to authenticated;
revoke all on function public.ark_crm_save_commercial_record(text,jsonb,uuid) from public,anon;
grant execute on function public.ark_crm_save_commercial_record(text,jsonb,uuid) to authenticated;
revoke all on function public.rr_hod_take_repair_job(uuid) from public,anon;
grant execute on function public.rr_hod_take_repair_job(uuid) to authenticated;
