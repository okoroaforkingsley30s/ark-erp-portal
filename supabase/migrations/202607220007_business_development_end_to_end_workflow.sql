-- ARK ONE Business Development end-to-end workflow.
-- This migration is additive: existing leads, clients and complaints are preserved.

alter table public.leads
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists owner_email text,
  add column if not exists owner_name text,
  add column if not exists probability integer not null default 10,
  add column if not exists expected_close_date date,
  add column if not exists opportunity_type text not null default 'general',
  add column if not exists currency text not null default 'NGN',
  add column if not exists lost_reason text,
  add column if not exists won_approval_status text not null default 'not_required',
  add column if not exists won_submitted_by text,
  add column if not exists won_submitted_at timestamptz,
  add column if not exists won_reviewed_by text,
  add column if not exists won_reviewed_at timestamptz,
  add column if not exists won_review_note text,
  add column if not exists client_id uuid,
  add column if not exists last_activity_at timestamptz;

alter table public.crm_clients
  add column if not exists client_code text,
  add column if not exists onboarding_status text not null default 'pending',
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.crm_complaints
  add column if not exists complaint_type text not null default 'technical_support',
  add column if not exists routed_department text,
  add column if not exists relationship_manager_email text,
  add column if not exists resolved_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists resolution_summary text,
  add column if not exists last_synced_ticket_status text;

alter table public.tickets
  add column if not exists source text,
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

update public.leads
set
  owner_email = coalesce(nullif(lower(trim(owner_email)), ''), nullif(lower(trim(assigned_to)), '')),
  probability = case lower(coalesce(status, 'new'))
    when 'new' then 10 when 'contacted' then 20 when 'qualified' then 40
    when 'proposal' then 60 when 'negotiation' then 80 when 'won' then 100
    when 'lost' then 0 else greatest(0, least(100, coalesce(probability, 10))) end,
  won_approval_status = case when lower(coalesce(status, '')) = 'won' then 'legacy_won' else coalesce(won_approval_status, 'not_required') end,
  updated_at = coalesce(updated_at, created_at, now());

alter table public.leads drop constraint if exists leads_probability_check;
alter table public.leads add constraint leads_probability_check check (probability between 0 and 100);
alter table public.leads drop constraint if exists leads_opportunity_type_check;
alter table public.leads add constraint leads_opportunity_type_check check (
  opportunity_type in ('general','service_contract','product_supply','project_integration')
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete cascade,
  complaint_id uuid references public.crm_complaints(id) on delete cascade,
  activity_type text not null,
  subject text not null,
  notes text,
  outcome text,
  next_action_at timestamptz,
  created_by uuid default auth.uid(),
  created_by_email text,
  created_by_name text,
  created_at timestamptz not null default now(),
  check (lead_id is not null or client_id is not null or complaint_id is not null)
);

create table if not exists public.crm_workflow_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  actor_id uuid default auth.uid(),
  actor_email text,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_department_handoffs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  source_lead_id uuid references public.leads(id) on delete set null,
  handoff_type text not null,
  assigned_department text not null,
  assigned_role text not null,
  status text not null default 'pending',
  instructions text,
  response_note text,
  created_by_email text,
  acknowledged_by text,
  acknowledged_at timestamptz,
  completed_by text,
  completed_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, handoff_type, assigned_department)
);

create index if not exists crm_activities_lead_idx on public.crm_activities(lead_id, created_at desc);
create index if not exists crm_activities_client_idx on public.crm_activities(client_id, created_at desc);
create index if not exists crm_history_entity_idx on public.crm_workflow_history(entity_type, entity_id, created_at desc);
create index if not exists crm_handoffs_queue_idx on public.crm_department_handoffs(assigned_department, status, created_at desc);
create index if not exists leads_owner_status_idx on public.leads(lower(owner_email), status, updated_at desc);
create index if not exists crm_complaints_ticket_idx on public.crm_complaints(ticket_id) where ticket_id is not null;

alter table public.crm_activities enable row level security;
alter table public.crm_workflow_history enable row level security;
alter table public.crm_department_handoffs enable row level security;

revoke all on public.crm_activities, public.crm_workflow_history, public.crm_department_handoffs from public, anon;
grant select on public.crm_activities, public.crm_workflow_history, public.crm_department_handoffs to authenticated;

drop policy if exists crm_activities_select on public.crm_activities;
create policy crm_activities_select on public.crm_activities for select to authenticated using (
  public.ark_has_any_role(array['business_developer','head_of_business_development','crm','ceo','agm','manager']::text[])
);
drop policy if exists crm_history_select on public.crm_workflow_history;
create policy crm_history_select on public.crm_workflow_history for select to authenticated using (
  public.ark_has_any_role(array['business_developer','head_of_business_development','crm','ceo','agm','manager']::text[])
);
drop policy if exists crm_handoffs_select on public.crm_department_handoffs;
create policy crm_handoffs_select on public.crm_department_handoffs for select to authenticated using (
  public.ark_has_any_role(array[
    'business_developer','head_of_business_development','crm','ceo','agm','manager',
    'helpdesk','operations','operations_manager','inventory','procurement',
    'head_of_account','finance','head_of_it','it'
  ]::text[])
);

create or replace function public.ark_crm_actor_allowed(p_head_only boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and public.ark_current_user_role() = any(
    case when p_head_only then array['head_of_business_development','ceo','agm','manager']::text[]
    else array['business_developer','head_of_business_development','crm']::text[] end
  );
$$;

create or replace function public.ark_crm_actor_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(trim(u.full_name), '') from public.users u where u.id = auth.uid()),
    auth.jwt() ->> 'email', 'ARK ONE user'
  );
$$;

create or replace function public.ark_crm_write_history(
  p_entity_type text, p_entity_id uuid, p_action text,
  p_from_status text, p_to_status text, p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare new_id uuid;
begin
  insert into public.crm_workflow_history(
    entity_type, entity_id, action, from_status, to_status, note,
    actor_id, actor_email, actor_name, metadata
  ) values (
    p_entity_type, p_entity_id, p_action, p_from_status, p_to_status, p_note,
    auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), public.ark_crm_actor_name(), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.ark_crm_save_lead(p_payload jsonb, p_lead_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actor_name text := public.ark_crm_actor_name();
  row_record public.leads%rowtype;
  requested_status text := lower(trim(coalesce(p_payload ->> 'status', 'new')));
  old_status text;
begin
  if not public.ark_crm_actor_allowed(false) then
    raise exception 'Business Development authorization required' using errcode = '42501';
  end if;
  if nullif(trim(p_payload ->> 'company_name'), '') is null or nullif(trim(p_payload ->> 'contact_name'), '') is null then
    raise exception 'Company name and contact name are required' using errcode = '22023';
  end if;
  if requested_status not in ('new','contacted','qualified','proposal','negotiation','pending_won_approval','lost','won') then
    raise exception 'Invalid lead status' using errcode = '22023';
  end if;
  if requested_status = 'won' then requested_status := 'pending_won_approval'; end if;

  if p_lead_id is null then
    insert into public.leads(
      company_name, contact_name, contact_email, contact_phone, industry, source,
      status, estimated_value, devices_interested, notes, next_followup, assigned_to,
      owner_email, owner_name, probability, expected_close_date, opportunity_type,
      currency, lost_reason, won_approval_status, created_at, updated_at
    ) values (
      trim(p_payload ->> 'company_name'), trim(p_payload ->> 'contact_name'),
      nullif(lower(trim(p_payload ->> 'contact_email')), ''), nullif(trim(p_payload ->> 'contact_phone'), ''),
      nullif(trim(p_payload ->> 'industry'), ''), coalesce(nullif(trim(p_payload ->> 'source'), ''), 'other'),
      requested_status, nullif(p_payload ->> 'estimated_value', '')::numeric,
      nullif(trim(p_payload ->> 'devices_interested'), ''), nullif(trim(p_payload ->> 'notes'), ''),
      nullif(p_payload ->> 'next_followup', '')::date, actor_email, actor_email, actor_name,
      greatest(0, least(100, coalesce(nullif(p_payload ->> 'probability', '')::integer, 10))),
      nullif(p_payload ->> 'expected_close_date', '')::date,
      coalesce(nullif(p_payload ->> 'opportunity_type', ''), 'general'),
      coalesce(nullif(p_payload ->> 'currency', ''), 'NGN'), nullif(trim(p_payload ->> 'lost_reason'), ''),
      case when requested_status = 'pending_won_approval' then 'pending' else 'not_required' end,
      now(), now()
    ) returning * into row_record;
    perform public.ark_crm_write_history('lead', row_record.id, 'created', null, requested_status, p_payload ->> 'notes');
  else
    select * into row_record from public.leads where id = p_lead_id for update;
    if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;
    old_status := lower(coalesce(row_record.status, 'new'));
    if old_status = 'won' and not public.ark_crm_actor_allowed(true) then
      raise exception 'Approved won leads are locked for Head review' using errcode = '42501';
    end if;
    update public.leads set
      company_name = trim(p_payload ->> 'company_name'), contact_name = trim(p_payload ->> 'contact_name'),
      contact_email = nullif(lower(trim(p_payload ->> 'contact_email')), ''),
      contact_phone = nullif(trim(p_payload ->> 'contact_phone'), ''), industry = nullif(trim(p_payload ->> 'industry'), ''),
      source = coalesce(nullif(trim(p_payload ->> 'source'), ''), source),
      estimated_value = nullif(p_payload ->> 'estimated_value', '')::numeric,
      devices_interested = nullif(trim(p_payload ->> 'devices_interested'), ''), notes = nullif(trim(p_payload ->> 'notes'), ''),
      next_followup = nullif(p_payload ->> 'next_followup', '')::date,
      probability = greatest(0, least(100, coalesce(nullif(p_payload ->> 'probability', '')::integer, probability))),
      expected_close_date = nullif(p_payload ->> 'expected_close_date', '')::date,
      opportunity_type = coalesce(nullif(p_payload ->> 'opportunity_type', ''), opportunity_type),
      currency = coalesce(nullif(p_payload ->> 'currency', ''), currency),
      lost_reason = nullif(trim(p_payload ->> 'lost_reason'), ''), updated_at = now()
    where id = p_lead_id returning * into row_record;
    perform public.ark_crm_write_history('lead', row_record.id, 'details_updated', old_status, old_status, p_payload ->> 'notes');
  end if;
  return to_jsonb(row_record);
end;
$$;

create or replace function public.ark_crm_transition_lead(p_lead_id uuid, p_target_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_row public.leads%rowtype;
  old_status text;
  target_status text := lower(trim(coalesce(p_target_status, '')));
  target_probability integer;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.ark_crm_actor_allowed(false) then
    raise exception 'Business Development authorization required' using errcode = '42501';
  end if;
  if target_status = 'won' then target_status := 'pending_won_approval'; end if;
  if target_status not in ('new','contacted','qualified','proposal','negotiation','pending_won_approval','lost') then
    raise exception 'Invalid lead transition' using errcode = '22023';
  end if;
  select * into lead_row from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;
  old_status := lower(coalesce(lead_row.status, 'new'));
  if old_status = 'won' then raise exception 'Approved won lead cannot be reopened' using errcode = '22023'; end if;
  if target_status = 'proposal' and coalesce(lead_row.estimated_value, 0) <= 0 then
    raise exception 'Estimated value is required before proposal' using errcode = '22023';
  end if;
  if target_status = 'pending_won_approval' and coalesce(lead_row.estimated_value, 0) <= 0 then
    raise exception 'Estimated value is required before Won approval' using errcode = '22023';
  end if;
  if target_status = 'lost' and nullif(trim(coalesce(p_note, lead_row.lost_reason, '')), '') is null then
    raise exception 'Lost reason is required' using errcode = '22023';
  end if;
  target_probability := case target_status
    when 'new' then 10 when 'contacted' then 20 when 'qualified' then 40
    when 'proposal' then 60 when 'negotiation' then 80 when 'pending_won_approval' then 90
    when 'lost' then 0 else lead_row.probability end;
  update public.leads set
    status = target_status, probability = target_probability,
    lost_reason = case when target_status = 'lost' then coalesce(nullif(trim(p_note), ''), lost_reason) else lost_reason end,
    won_approval_status = case when target_status = 'pending_won_approval' then 'pending' else won_approval_status end,
    won_submitted_by = case when target_status = 'pending_won_approval' then actor_email else won_submitted_by end,
    won_submitted_at = case when target_status = 'pending_won_approval' then now() else won_submitted_at end,
    updated_at = now(), last_activity_at = now()
  where id = p_lead_id returning * into lead_row;
  perform public.ark_crm_write_history('lead', p_lead_id, 'status_changed', old_status, target_status, p_note);
  perform public.ark_emit_workflow_notification(
    'crm_lead', p_lead_id::text, 'status_changed', target_status,
    case when target_status = 'pending_won_approval' then 'Won Business Awaiting Approval' else 'Lead ' || initcap(replace(target_status, '_', ' ')) end,
    lead_row.company_name || ' moved from ' || replace(old_status, '_', ' ') || ' to ' || replace(target_status, '_', ' ') || '.',
    '/crm', array[lead_row.owner_email],
    case when target_status = 'pending_won_approval' then array['head_of_business_development']::text[] else array['head_of_business_development','business_developer']::text[] end,
    target_status in ('pending_won_approval','lost'),
    jsonb_build_object('lead_id', p_lead_id, 'company_name', lead_row.company_name, 'event_nonce', lead_row.updated_at)
  );
  return to_jsonb(lead_row);
end;
$$;

create or replace function public.ark_crm_review_won_lead(p_lead_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_row public.leads%rowtype;
  client_row public.crm_clients%rowtype;
  decision text := lower(trim(coalesce(p_decision, '')));
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  handoff record;
begin
  if not public.ark_crm_actor_allowed(true) then
    raise exception 'Head of Business Development authorization required' using errcode = '42501';
  end if;
  if decision not in ('approve','reject') then raise exception 'Decision must be approve or reject' using errcode = '22023'; end if;
  select * into lead_row from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;
  if lower(coalesce(lead_row.status, '')) <> 'pending_won_approval' then
    raise exception 'Lead is not awaiting Won approval' using errcode = '22023';
  end if;
  if decision = 'reject' then
    if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Rejection reason is required' using errcode = '22023'; end if;
    update public.leads set status='negotiation', probability=80, won_approval_status='rejected',
      won_reviewed_by=actor_email, won_reviewed_at=now(), won_review_note=trim(p_note), updated_at=now()
    where id=p_lead_id returning * into lead_row;
    perform public.ark_crm_write_history('lead', p_lead_id, 'won_rejected', 'pending_won_approval', 'negotiation', p_note);
    perform public.ark_emit_workflow_notification('crm_lead',p_lead_id::text,'won_rejected','negotiation',
      'Won Business Rejected',lead_row.company_name||' was returned to negotiation. Reason: '||trim(p_note),'/crm',
      array[lead_row.owner_email],array['business_developer'],true,
      jsonb_build_object('lead_id',p_lead_id,'event_nonce',lead_row.updated_at));
    return jsonb_build_object('lead',to_jsonb(lead_row),'client',null,'handoffs',0);
  end if;

  select * into client_row from public.crm_clients where source_lead_id=p_lead_id order by created_at limit 1 for update;
  if not found then
    insert into public.crm_clients(
      client_code,client_name,industry,contact_name,contact_email,contact_phone,
      relationship_manager,relationship_manager_email,source_lead_id,contract_value,
      status,notes,onboarding_status,onboarding_started_at,created_at,updated_at
    ) values (
      'CLI-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
      lead_row.company_name,lead_row.industry,lead_row.contact_name,lead_row.contact_email,lead_row.contact_phone,
      coalesce(lead_row.owner_name,lead_row.owner_email),lead_row.owner_email,p_lead_id,coalesce(lead_row.estimated_value,0),
      'active',lead_row.notes,'in_progress',now(),now(),now()
    ) returning * into client_row;
  else
    update public.crm_clients set
      client_name=lead_row.company_name,industry=lead_row.industry,contact_name=lead_row.contact_name,
      contact_email=lead_row.contact_email,contact_phone=lead_row.contact_phone,
      contract_value=coalesce(lead_row.estimated_value,contract_value),onboarding_status='in_progress',
      onboarding_started_at=coalesce(onboarding_started_at,now()),updated_at=now()
    where id=client_row.id returning * into client_row;
  end if;
  update public.leads set status='won',probability=100,won_approval_status='approved',
    won_reviewed_by=actor_email,won_reviewed_at=now(),won_review_note=nullif(trim(p_note),''),
    client_id=client_row.id,updated_at=now()
  where id=p_lead_id returning * into lead_row;

  for handoff in
    select * from (
      select 'service_activation'::text handoff_type,'Operations'::text department,'operations'::text assigned_role,
        'Plan service delivery and operational ownership.'::text instructions
      where lead_row.opportunity_type in ('general','service_contract','project_integration')
      union all select 'support_setup','Helpdesk','helpdesk','Create client support profile and service contacts.'
      where lead_row.opportunity_type in ('general','service_contract')
      union all select 'commercial_setup','Finance & Accounts','head_of_account','Confirm commercial terms, billing and account setup.'
      union all select 'stock_fulfilment','Inventory','inventory','Confirm product availability and fulfilment plan.'
      where lead_row.opportunity_type='product_supply'
      union all select 'supplier_fulfilment','Procurement','procurement','Arrange unavailable products and supplier fulfilment.'
      where lead_row.opportunity_type='product_supply'
      union all select 'technical_integration','Information Technology','head_of_it','Plan technical integration and implementation.'
      where lead_row.opportunity_type='project_integration'
    ) routes
  loop
    insert into public.crm_department_handoffs(
      client_id,source_lead_id,handoff_type,assigned_department,assigned_role,status,instructions,created_by_email
    ) values (client_row.id,p_lead_id,handoff.handoff_type,handoff.department,handoff.assigned_role,'pending',handoff.instructions,actor_email)
    on conflict (client_id,handoff_type,assigned_department) do nothing;
    perform public.ark_emit_workflow_notification(
      'crm_handoff',client_row.id::text,handoff.handoff_type,'pending','New Client Department Handoff',
      client_row.client_name||': '||handoff.instructions,'/crm-handoffs',array[lead_row.owner_email],
      case handoff.assigned_role
        when 'head_of_account' then array['head_of_account','finance']::text[]
        when 'head_of_it' then array['head_of_it','it']::text[]
        else array[handoff.assigned_role]::text[] end,
      true,jsonb_build_object('client_id',client_row.id,'lead_id',p_lead_id,'department',handoff.department,'event_nonce',lead_row.updated_at)
    );
  end loop;
  perform public.ark_crm_write_history('lead',p_lead_id,'won_approved','pending_won_approval','won',p_note,
    jsonb_build_object('client_id',client_row.id));
  perform public.ark_emit_workflow_notification('crm_lead',p_lead_id::text,'won_approved','won','Won Business Approved',
    lead_row.company_name||' is now an approved ARK ONE client and departmental onboarding has started.','/crm',
    array[lead_row.owner_email],array['business_developer','head_of_business_development','manager'],true,
    jsonb_build_object('lead_id',p_lead_id,'client_id',client_row.id,'event_nonce',lead_row.updated_at));
  return jsonb_build_object('lead',to_jsonb(lead_row),'client',to_jsonb(client_row));
end;
$$;

create or replace function public.ark_crm_log_activity(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare row_record public.crm_activities%rowtype;
begin
  if not public.ark_crm_actor_allowed(false) then raise exception 'Business Development authorization required' using errcode='42501'; end if;
  if nullif(trim(p_payload->>'subject'),'') is null then raise exception 'Activity subject is required' using errcode='22023'; end if;
  insert into public.crm_activities(
    lead_id,client_id,complaint_id,activity_type,subject,notes,outcome,next_action_at,
    created_by,created_by_email,created_by_name
  ) values (
    nullif(p_payload->>'lead_id','')::uuid,nullif(p_payload->>'client_id','')::uuid,nullif(p_payload->>'complaint_id','')::uuid,
    coalesce(nullif(p_payload->>'activity_type',''),'note'),trim(p_payload->>'subject'),nullif(trim(p_payload->>'notes'),''),
    nullif(trim(p_payload->>'outcome'),''),nullif(p_payload->>'next_action_at','')::timestamptz,
    auth.uid(),lower(coalesce(auth.jwt()->>'email','')),public.ark_crm_actor_name()
  ) returning * into row_record;
  if row_record.lead_id is not null then
    update public.leads set last_activity_at=now(),next_followup=coalesce(row_record.next_action_at::date,next_followup),updated_at=now() where id=row_record.lead_id;
    perform public.ark_crm_write_history('lead',row_record.lead_id,'activity_logged',null,null,row_record.subject,jsonb_build_object('activity_id',row_record.id));
  end if;
  return to_jsonb(row_record);
end;
$$;

create or replace function public.ark_crm_save_complaint(p_payload jsonb, p_complaint_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare row_record public.crm_complaints%rowtype; actor_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if not public.ark_crm_actor_allowed(false) then raise exception 'Business Development authorization required' using errcode='42501'; end if;
  if nullif(trim(p_payload->>'client_name'),'') is null or nullif(trim(p_payload->>'issue_title'),'') is null then
    raise exception 'Client name and issue title are required' using errcode='22023';
  end if;
  if p_complaint_id is null then
    insert into public.crm_complaints(
      complaint_number,client_id,client_name,contact_name,contact_email,contact_phone,issue_title,issue_description,
      priority,status,followup_date,satisfaction_rating,feedback,created_by_email,created_by_name,
      complaint_type,routed_department,relationship_manager_email,created_at,updated_at
    ) values (
      'CRM-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
      nullif(p_payload->>'client_id','')::uuid,trim(p_payload->>'client_name'),nullif(trim(p_payload->>'contact_name'),''),
      nullif(lower(trim(p_payload->>'contact_email')),''),nullif(trim(p_payload->>'contact_phone'),''),trim(p_payload->>'issue_title'),
      nullif(trim(p_payload->>'issue_description'),''),coalesce(nullif(p_payload->>'priority',''),'medium'),'open',
      nullif(p_payload->>'followup_date','')::date,nullif(p_payload->>'satisfaction_rating','')::integer,nullif(trim(p_payload->>'feedback'),''),
      actor_email,public.ark_crm_actor_name(),coalesce(nullif(p_payload->>'complaint_type',''),'technical_support'),
      nullif(p_payload->>'routed_department',''),actor_email,now(),now()
    ) returning * into row_record;
    perform public.ark_crm_write_history('complaint',row_record.id,'created',null,'open',row_record.issue_description);
  else
    update public.crm_complaints set
      client_name=trim(p_payload->>'client_name'),contact_name=nullif(trim(p_payload->>'contact_name'),''),
      contact_email=nullif(lower(trim(p_payload->>'contact_email')),''),contact_phone=nullif(trim(p_payload->>'contact_phone'),''),
      issue_title=trim(p_payload->>'issue_title'),issue_description=nullif(trim(p_payload->>'issue_description'),''),
      priority=coalesce(nullif(p_payload->>'priority',''),priority),followup_date=nullif(p_payload->>'followup_date','')::date,
      satisfaction_rating=nullif(p_payload->>'satisfaction_rating','')::integer,feedback=nullif(trim(p_payload->>'feedback'),''),
      complaint_type=coalesce(nullif(p_payload->>'complaint_type',''),complaint_type),updated_at=now()
    where id=p_complaint_id returning * into row_record;
    if not found then raise exception 'Complaint not found' using errcode='P0002'; end if;
    perform public.ark_crm_write_history('complaint',row_record.id,'updated',row_record.status,row_record.status,p_payload->>'feedback');
  end if;
  return to_jsonb(row_record);
end;
$$;

create or replace function public.ark_crm_create_ticket_from_complaint(p_complaint_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare complaint_row public.crm_complaints%rowtype; ticket_row public.tickets%rowtype;
  actor_email text:=lower(coalesce(auth.jwt()->>'email','')); generated_number text;
begin
  if auth.uid() is null or public.ark_current_user_role() <> 'helpdesk' then
    raise exception 'Only Helpdesk may create a support ticket from a CRM complaint' using errcode='42501';
  end if;
  select * into complaint_row from public.crm_complaints where id=p_complaint_id for update;
  if not found then raise exception 'Complaint not found' using errcode='P0002'; end if;
  if complaint_row.ticket_id is not null then
    select * into ticket_row from public.tickets where id=complaint_row.ticket_id;
    return jsonb_build_object('ticket',to_jsonb(ticket_row),'already_created',true);
  end if;
  generated_number:='TCK-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.tickets(
    ticket_number,ticket_id,title,description,status,priority,created_by,department,category,
    client_email,client_name,bank_name,created_at,updated_at,completion_status,source,
    source_entity_type,source_entity_id,contact_name,contact_email,contact_phone
  ) values (
    generated_number,generated_number,complaint_row.issue_title,complaint_row.issue_description,'new',complaint_row.priority,
    actor_email,'Helpdesk','CRM Complaint',complaint_row.contact_email,complaint_row.client_name,complaint_row.client_name,
    now(),now(),'pending','CRM','crm_complaint',complaint_row.id,complaint_row.contact_name,complaint_row.contact_email,complaint_row.contact_phone
  ) returning * into ticket_row;
  update public.crm_complaints set ticket_id=ticket_row.id,ticket_number=ticket_row.ticket_number,status='ticket_created',
    routed_department='Helpdesk',last_synced_ticket_status=ticket_row.status,updated_at=now()
  where id=p_complaint_id returning * into complaint_row;
  perform public.ark_crm_write_history('complaint',p_complaint_id,'ticket_created','open','ticket_created',null,
    jsonb_build_object('ticket_id',ticket_row.id,'ticket_number',ticket_row.ticket_number));
  perform public.ark_emit_workflow_notification('crm_complaint',p_complaint_id::text,'ticket_created','ticket_created',
    'CRM Complaint Requires Helpdesk Action',complaint_row.client_name||': '||complaint_row.issue_title||' ('||ticket_row.ticket_number||')',
    '/tickets/'||ticket_row.id,array[complaint_row.created_by_email,complaint_row.relationship_manager_email],
    array['helpdesk','operations'],true,jsonb_build_object('complaint_id',p_complaint_id,'ticket_id',ticket_row.id,
    'ticket_number',ticket_row.ticket_number,'event_nonce',complaint_row.updated_at));
  return jsonb_build_object('ticket',to_jsonb(ticket_row),'complaint',to_jsonb(complaint_row),'already_created',false);
end;
$$;

create or replace function public.ark_crm_route_complaint_to_helpdesk(p_complaint_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare complaint_row public.crm_complaints%rowtype;
begin
  if not public.ark_crm_actor_allowed(false) then
    raise exception 'Business Development authorization required' using errcode='42501';
  end if;
  select * into complaint_row from public.crm_complaints where id=p_complaint_id for update;
  if not found then raise exception 'Complaint not found' using errcode='P0002'; end if;
  if complaint_row.ticket_id is not null then raise exception 'This complaint already has a Helpdesk ticket' using errcode='22023'; end if;
  if complaint_row.status not in ('open','routed_to_helpdesk') then
    raise exception 'Only an open complaint may be submitted to Helpdesk' using errcode='22023';
  end if;
  update public.crm_complaints set status='routed_to_helpdesk',routed_department='Helpdesk',updated_at=now()
  where id=p_complaint_id returning * into complaint_row;
  perform public.ark_crm_write_history('complaint',p_complaint_id,'submitted_to_helpdesk','open','routed_to_helpdesk',null);
  perform public.ark_emit_workflow_notification('crm_complaint',p_complaint_id::text,'submitted_to_helpdesk','routed_to_helpdesk',
    'Client Complaint Submitted to Helpdesk',complaint_row.client_name||': '||complaint_row.issue_title||'. Helpdesk must review and create the support ticket.',
    '/crm-handoffs',array[complaint_row.created_by_email,complaint_row.relationship_manager_email],array['helpdesk'],true,
    jsonb_build_object('complaint_id',p_complaint_id,'event_nonce',complaint_row.updated_at));
  return to_jsonb(complaint_row);
end;
$$;

create or replace function public.ark_crm_update_handoff(p_handoff_id uuid,p_action text,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare handoff_row public.crm_department_handoffs%rowtype; client_row public.crm_clients%rowtype;
  actor_role text:=public.ark_current_user_role(); actor_email text:=lower(coalesce(auth.jwt()->>'email',''));
  action_name text:=lower(trim(coalesce(p_action,''))); allowed boolean:=false; remaining_count integer; old_status text;
begin
  select * into handoff_row from public.crm_department_handoffs where id=p_handoff_id for update;
  if not found then raise exception 'Client handoff not found' using errcode='P0002'; end if;
  allowed := case handoff_row.assigned_department
    when 'Operations' then actor_role in ('operations','operations_manager','manager')
    when 'Helpdesk' then actor_role='helpdesk'
    when 'Finance & Accounts' then actor_role in ('head_of_account','finance')
    when 'Inventory' then actor_role='inventory'
    when 'Procurement' then actor_role='procurement'
    when 'Information Technology' then actor_role in ('head_of_it','it')
    else false end;
  if not allowed then raise exception 'This handoff belongs to another department' using errcode='42501'; end if;
  if action_name not in ('acknowledge','complete','reject') then raise exception 'Invalid handoff action' using errcode='22023'; end if;
  if handoff_row.status in ('completed','rejected') then raise exception 'This handoff is already final' using errcode='22023'; end if;
  old_status:=handoff_row.status;
  if action_name='acknowledge' then
    update public.crm_department_handoffs set status='acknowledged',acknowledged_by=actor_email,acknowledged_at=now(),response_note=nullif(trim(p_note),''),updated_at=now()
    where id=p_handoff_id returning * into handoff_row;
  elsif action_name='complete' then
    update public.crm_department_handoffs set status='completed',completed_by=actor_email,completed_at=now(),response_note=nullif(trim(p_note),''),updated_at=now()
    where id=p_handoff_id returning * into handoff_row;
  else
    if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Rejection reason is required' using errcode='22023'; end if;
    update public.crm_department_handoffs set status='rejected',rejected_by=actor_email,rejected_at=now(),response_note=trim(p_note),updated_at=now()
    where id=p_handoff_id returning * into handoff_row;
  end if;
  select * into client_row from public.crm_clients where id=handoff_row.client_id;
  select count(*) into remaining_count from public.crm_department_handoffs where client_id=handoff_row.client_id and status<>'completed';
  if remaining_count=0 then update public.crm_clients set onboarding_status='completed',onboarding_completed_at=now(),updated_at=now() where id=handoff_row.client_id; end if;
  perform public.ark_crm_write_history('client',handoff_row.client_id,'handoff_'||action_name,old_status,handoff_row.status,p_note,
    jsonb_build_object('handoff_id',p_handoff_id,'department',handoff_row.assigned_department));
  perform public.ark_emit_workflow_notification('crm_handoff',p_handoff_id::text,'handoff_'||action_name,handoff_row.status,
    'Client Handoff '||initcap(action_name),client_row.client_name||' handoff for '||handoff_row.assigned_department||' was '||action_name||'d.',
    '/crm',array[client_row.relationship_manager_email],array['head_of_business_development','business_developer'],
    action_name in ('complete','reject'),jsonb_build_object('client_id',client_row.id,'handoff_id',p_handoff_id,'event_nonce',handoff_row.updated_at));
  return to_jsonb(handoff_row);
end;
$$;

create or replace function public.ark_crm_close_complaint(
  p_complaint_id uuid,
  p_satisfaction_rating integer,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  complaint_row public.crm_complaints%rowtype;
begin
  if not public.ark_crm_actor_allowed(false) then
    raise exception 'Business Development authorization required' using errcode='42501';
  end if;
  if p_satisfaction_rating is null or p_satisfaction_rating not between 1 and 5 then
    raise exception 'Client satisfaction rating must be between 1 and 5' using errcode='22023';
  end if;
  select * into complaint_row from public.crm_complaints where id=p_complaint_id for update;
  if not found then raise exception 'Complaint not found' using errcode='P0002'; end if;
  if complaint_row.status <> 'resolved' then
    raise exception 'Complaint can be closed only after the linked work is resolved' using errcode='22023';
  end if;
  update public.crm_complaints set
    status='closed', satisfaction_rating=p_satisfaction_rating,
    feedback=nullif(trim(p_feedback),''), closed_at=now(), updated_at=now()
  where id=p_complaint_id returning * into complaint_row;
  perform public.ark_crm_write_history('complaint',p_complaint_id,'client_followup_completed','resolved','closed',p_feedback,
    jsonb_build_object('satisfaction_rating',p_satisfaction_rating));
  perform public.ark_emit_workflow_notification('crm_complaint',p_complaint_id::text,'client_followup_completed','closed',
    'Client Complaint Follow-up Completed',complaint_row.client_name||' complaint was closed after client follow-up. Rating: '||p_satisfaction_rating||'/5.',
    '/crm',array[complaint_row.created_by_email,complaint_row.relationship_manager_email],
    array['head_of_business_development'],false,
    jsonb_build_object('complaint_id',p_complaint_id,'rating',p_satisfaction_rating,'event_nonce',complaint_row.updated_at));
  return to_jsonb(complaint_row);
end;
$$;

create or replace function public.ark_crm_sync_ticket_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare complaint_row public.crm_complaints%rowtype; old_final boolean; new_final boolean;
begin
  if new.source_entity_type is distinct from 'crm_complaint' or new.source_entity_id is null then return new; end if;
  old_final:=lower(coalesce(old.status,'')) in ('closed','completed','approved','resolved') or lower(coalesce(old.completion_status,'')) in ('closed','completed','approved','resolved');
  new_final:=lower(coalesce(new.status,'')) in ('closed','completed','approved','resolved') or lower(coalesce(new.completion_status,'')) in ('closed','completed','approved','resolved');
  update public.crm_complaints set
    status=case when new_final then 'resolved' else status end,
    last_synced_ticket_status=new.status,
    resolution_summary=case when new_final then coalesce(new.completion_note,'Ticket '||coalesce(new.ticket_number,new.id::text)||' completed') else resolution_summary end,
    resolved_at=case when new_final then coalesce(resolved_at,now()) else resolved_at end,updated_at=now()
  where id=new.source_entity_id returning * into complaint_row;
  if found and new_final and not old_final then
    perform public.ark_crm_write_history('complaint',complaint_row.id,'ticket_resolved',old.status,new.status,complaint_row.resolution_summary,
      jsonb_build_object('ticket_id',new.id,'ticket_number',new.ticket_number));
    perform public.ark_emit_workflow_notification('crm_complaint',complaint_row.id::text,'ticket_resolved','resolved',
      'Client Complaint Resolved — Follow-up Required',complaint_row.client_name||' complaint was resolved under '||coalesce(new.ticket_number,new.id::text)||'. Contact the client, record satisfaction and close the CRM case.',
      '/crm',array[complaint_row.created_by_email,complaint_row.relationship_manager_email],
      array['business_developer','head_of_business_development'],true,
      jsonb_build_object('complaint_id',complaint_row.id,'ticket_id',new.id,'event_nonce',new.updated_at));
  end if;
  return new;
end;
$$;

drop trigger if exists ark_crm_ticket_resolution_sync on public.tickets;
create trigger ark_crm_ticket_resolution_sync after update on public.tickets
for each row execute function public.ark_crm_sync_ticket_resolution();

create or replace function public.ark_touch_crm_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$ begin new.updated_at:=now(); return new; end $$;
drop trigger if exists ark_leads_touch_updated_at on public.leads;
create trigger ark_leads_touch_updated_at before update on public.leads for each row execute function public.ark_touch_crm_updated_at();
drop trigger if exists ark_crm_clients_touch_updated_at on public.crm_clients;
create trigger ark_crm_clients_touch_updated_at before update on public.crm_clients for each row execute function public.ark_touch_crm_updated_at();
drop trigger if exists ark_crm_complaints_touch_updated_at on public.crm_complaints;
create trigger ark_crm_complaints_touch_updated_at before update on public.crm_complaints for each row execute function public.ark_touch_crm_updated_at();
drop trigger if exists ark_crm_handoffs_touch_updated_at on public.crm_department_handoffs;
create trigger ark_crm_handoffs_touch_updated_at before update on public.crm_department_handoffs for each row execute function public.ark_touch_crm_updated_at();

-- CRM uses explicit transactional notifications; remove the generic duplicate trigger.
drop trigger if exists ark_system_notification_trigger on public.leads;
drop trigger if exists ark_system_notification_trigger on public.crm_clients;
drop trigger if exists ark_system_notification_trigger on public.crm_complaints;

revoke all on function public.ark_crm_actor_allowed(boolean),public.ark_crm_actor_name(),
  public.ark_crm_write_history(text,uuid,text,text,text,text,jsonb),
  public.ark_crm_sync_ticket_resolution(),public.ark_touch_crm_updated_at() from public,anon,authenticated;
revoke all on function public.ark_crm_save_lead(jsonb,uuid),public.ark_crm_transition_lead(uuid,text,text),
  public.ark_crm_review_won_lead(uuid,text,text),public.ark_crm_log_activity(jsonb),
  public.ark_crm_save_complaint(jsonb,uuid),public.ark_crm_create_ticket_from_complaint(uuid),
  public.ark_crm_route_complaint_to_helpdesk(uuid),public.ark_crm_update_handoff(uuid,text,text),
  public.ark_crm_close_complaint(uuid,integer,text) from public,anon;
grant execute on function public.ark_crm_save_lead(jsonb,uuid),public.ark_crm_transition_lead(uuid,text,text),
  public.ark_crm_review_won_lead(uuid,text,text),public.ark_crm_log_activity(jsonb),
  public.ark_crm_save_complaint(jsonb,uuid),public.ark_crm_create_ticket_from_complaint(uuid),
  public.ark_crm_route_complaint_to_helpdesk(uuid),public.ark_crm_update_handoff(uuid,text,text),
  public.ark_crm_close_complaint(uuid,integer,text) to authenticated;

notify pgrst,'reload schema';
