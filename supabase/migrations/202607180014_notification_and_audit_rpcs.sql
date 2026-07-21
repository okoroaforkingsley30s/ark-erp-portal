-- Legitimate operational notifications and actor-derived audit events.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  user_email text,
  user_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists ark_audit_logs_admin_read on public.audit_logs;
create policy ark_audit_logs_admin_read on public.audit_logs for select to authenticated
using (public.ark_is_system_admin());

drop policy if exists ark_notifications_authorized_insert on public.notifications;
create policy ark_notifications_authorized_insert
on public.notifications for insert to authenticated
with check (public.ark_current_user_role() in (
  'system_admin','ceo','agm','manager','admin','admin_head','hr','helpdesk',
  'operations','engineer','inventory','repair_head','repair_technician','finance',
  'procurement','crm','business_developer','head_of_business_development','client'
));

create or replace function public.ark_write_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actor_name text;
  audit_id uuid;
begin
  if auth.uid() is null or actor_role not in (
    'system_admin','ceo','agm','manager','admin','admin_head','hr','helpdesk',
    'operations','engineer','inventory','repair_head','repair_technician','finance','procurement','crm'
  ) then raise exception 'Audit authorization required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_action, ''))) not between 1 and 120 or
     length(trim(coalesce(p_entity_type, ''))) not between 1 and 80 or
     length(trim(coalesce(p_entity_id, ''))) not between 1 and 200 or
     length(p_details::text) > 20000 then raise exception 'Invalid audit event'; end if;

  select coalesce(nullif(trim(full_name), ''), actor_email) into actor_name
  from public.users where id = auth.uid() limit 1;
  insert into public.audit_logs (
    action, entity_type, entity_id, user_email, user_name, details, created_at
  ) values (
    trim(p_action), trim(p_entity_type), trim(p_entity_id), actor_email,
    coalesce(actor_name, actor_email), p_details, now()
  ) returning id into audit_id;
  return audit_id;
end;
$$;

revoke all on function public.ark_write_audit_event(text, text, text, jsonb) from public, anon;
grant execute on function public.ark_write_audit_event(text, text, text, jsonb) to authenticated;
