-- Narrow RPCs for registration, activity, field availability and HR identity sync.

alter table public.users add column if not exists field_status text default 'available';
alter table public.email_messages add column if not exists sender_name text;
alter table public.email_messages add column if not exists email_category text;
alter table public.email_messages add column if not exists linked_ticket_id uuid;

create or replace function public.ark_register_current_user(p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare clean_email text := lower(coalesce(auth.jwt() ->> 'email', '')); target_id uuid;
begin
  if auth.uid() is null or clean_email = '' then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('register:' || clean_email, 0));
  select id into target_id from public.users where id = auth.uid() or lower(email) = clean_email
    order by (id = auth.uid()) desc limit 1 for update;
  if target_id is null then
    insert into public.users (id, email, full_name, role, status, approval_status, is_approved, account_status, updated_at)
    values (auth.uid(), clean_email, nullif(trim(p_full_name), ''), null, 'pending', 'pending', false, 'active', now())
    returning id into target_id;
  else
    update public.users set full_name = coalesce(nullif(trim(p_full_name), ''), full_name), updated_at = now()
    where id = target_id;
  end if;
  return target_id;
end;
$$;

create or replace function public.ark_update_user_activity(
  p_last_seen timestamptz,
  p_online_status text,
  p_record_login boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare clean_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or clean_email = '' then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.user_profiles set
    last_seen = least(coalesce(p_last_seen, now()), now() + interval '1 minute'),
    online_status = case when lower(coalesce(p_online_status, 'offline')) in ('online','true') then 'online' else 'offline' end,
    last_login = case when p_record_login then now() else last_login end,
    updated_at = now()
  where lower(user_email) = clean_email;
end;
$$;

create or replace function public.ark_update_field_status(p_field_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare clean_status text := lower(trim(coalesce(p_field_status, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if public.ark_current_user_role() not in ('engineer','system_admin') then
    raise exception 'Engineer authorization required' using errcode = '42501';
  end if;
  if clean_status not in ('available','traveling','on_site','busy','offline') then raise exception 'Invalid field status'; end if;
  update public.users set field_status = clean_status, updated_at = now() where id = auth.uid();
end;
$$;

create or replace function public.ark_sync_identity_details(
  p_email text,
  p_full_name text default null,
  p_department text default null,
  p_employee_id text default null,
  p_phone text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor_role text := public.ark_current_user_role(); clean_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null or actor_role not in ('system_admin','hr') then
    raise exception 'HR or system administrator authorization required' using errcode = '42501';
  end if;
  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid email is required'; end if;
  update public.users set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    department = coalesce(nullif(trim(p_department), ''), department),
    employee_id = coalesce(nullif(trim(p_employee_id), ''), employee_id),
    phone = coalesce(nullif(trim(p_phone), ''), phone), updated_at = now()
  where lower(email) = clean_email;
  update public.user_profiles set
    department = coalesce(nullif(trim(p_department), ''), department),
    employee_id = coalesce(nullif(trim(p_employee_id), ''), employee_id), updated_at = now()
  where lower(user_email) = clean_email;
  update public.employees set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    department = coalesce(nullif(trim(p_department), ''), department),
    staff_id = coalesce(nullif(trim(p_employee_id), ''), staff_id),
    phone_number = coalesce(nullif(trim(p_phone), ''), phone_number), updated_at = now()
  where lower(coalesce(user_account_email, email_address, '')) = clean_email;
end;
$$;

revoke all on function public.ark_register_current_user(text) from public, anon;
revoke all on function public.ark_update_user_activity(timestamptz, text, boolean) from public, anon;
revoke all on function public.ark_update_field_status(text) from public, anon;
revoke all on function public.ark_sync_identity_details(text, text, text, text, text) from public, anon;
grant execute on function public.ark_register_current_user(text) to authenticated;
grant execute on function public.ark_update_user_activity(timestamptz, text, boolean) to authenticated;
grant execute on function public.ark_update_field_status(text) to authenticated;
grant execute on function public.ark_sync_identity_details(text, text, text, text, text) to authenticated;
