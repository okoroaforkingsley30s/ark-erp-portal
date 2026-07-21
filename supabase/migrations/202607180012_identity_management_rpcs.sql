-- Atomic, server-authorized identity administration and self-service updates.

alter table public.users add column if not exists specialization text;

create or replace function public.ark_create_pending_user(
  p_email text,
  p_full_name text,
  p_department text default null,
  p_employee_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.ark_current_user_role();
  clean_email text := lower(trim(coalesce(p_email, '')));
  target_id uuid;
begin
  if auth.uid() is null or actor_role not in ('system_admin','hr') then
    raise exception 'HR or system administrator authorization required' using errcode = '42501';
  end if;
  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pending-user:' || clean_email, 0));
  select id into target_id from public.users where lower(email) = clean_email order by created_at asc limit 1 for update;

  if target_id is null then
    insert into public.users (
      email, full_name, department, employee_id, role, status,
      approval_status, is_approved, account_status, updated_at
    ) values (
      clean_email, nullif(trim(p_full_name), ''), nullif(trim(p_department), ''),
      nullif(trim(p_employee_id), ''), null, 'pending', 'pending', false, 'active', now()
    ) returning id into target_id;
  else
    update public.users set
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      department = coalesce(nullif(trim(p_department), ''), department),
      employee_id = coalesce(nullif(trim(p_employee_id), ''), employee_id),
      updated_at = now()
    where id = target_id;
  end if;

  update public.user_profiles set
    employee_id = coalesce(nullif(trim(p_employee_id), ''), employee_id),
    department = coalesce(nullif(trim(p_department), ''), department),
    updated_at = now()
  where lower(user_email) = clean_email;
  if not found then
    insert into public.user_profiles (
      user_email, employee_id, department, role, account_status, is_approved, created_at, updated_at
    ) values (
      clean_email, nullif(trim(p_employee_id), ''), nullif(trim(p_department), ''),
      null, 'active', false, now(), now()
    );
  end if;
  return target_id;
end;
$$;

create or replace function public.ark_update_own_profile(
  p_phone text default null,
  p_department text default null,
  p_specialization text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.users set
    phone = nullif(left(trim(coalesce(p_phone, '')), 50), ''),
    department = nullif(left(trim(coalesce(p_department, '')), 120), ''),
    specialization = nullif(left(trim(coalesce(p_specialization, '')), 160), ''),
    updated_at = now()
  where id = auth.uid();
  if not found then raise exception 'User profile was not found'; end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.ark_admin_manage_user(
  p_target_user_id uuid,
  p_action text,
  p_changes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.users%rowtype;
  clean_action text := lower(trim(coalesce(p_action, '')));
  clean_role text;
  clean_status text;
  target_email text;
  approved boolean;
begin
  perform public.ark_assert_system_admin();

  if clean_action = 'force_all_password_reset' then
    update public.users set must_change_password = true, updated_at = now()
    where lower(coalesce(account_status, 'active')) = 'active';
    return jsonb_build_object('success', true, 'affected', found);
  end if;

  select * into target from public.users where id = p_target_user_id for update;
  if not found then raise exception 'User was not found'; end if;
  target_email := lower(trim(target.email));

  if clean_action = 'force_password_reset' then
    update public.users set must_change_password = true, updated_at = now() where id = target.id;
  elsif clean_action = 'deprovision' then
    if target.id = auth.uid() then raise exception 'You cannot deprovision your own account' using errcode = '42501'; end if;
    if lower(coalesce(target.role, '')) = 'system_admin' then
      raise exception 'System administrator accounts cannot be deprovisioned here' using errcode = '42501';
    end if;
    update public.users set role = null, is_approved = false, status = 'rejected',
      approval_status = 'rejected', account_status = 'deleted', updated_at = now()
    where id = target.id;
    update public.user_profiles set role = null, is_approved = false,
      account_status = 'deleted', updated_at = now() where lower(user_email) = target_email;
    update public.employees set employment_status = 'Terminated', user_account_email = null,
      access_role = null, updated_at = now()
    where lower(coalesce(user_account_email, email_address, '')) = target_email;
    update public.engineers set status = 'inactive', updated_at = now()
    where lower(coalesce(email, '')) = target_email;
  elsif clean_action = 'update_profile' then
    clean_role := lower(trim(coalesce(p_changes ->> 'role', target.role, '')));
    if clean_role not in (
      'system_admin','head_of_it','it','ceo','ceo_pa','agm','manager','admin_head','admin',
      'operations','repair_head','repair_technician','helpdesk','engineer','hr','finance',
      'head_of_account','inventory','procurement','crm','head_of_business_development',
      'business_developer','client'
    ) then raise exception 'Invalid role'; end if;
    clean_status := lower(trim(coalesce(p_changes ->> 'account_status', target.account_status, 'active')));
    if clean_status not in ('active','inactive','suspended') then raise exception 'Invalid account status'; end if;
    approved := coalesce((p_changes ->> 'is_approved')::boolean, target.is_approved, false);
    if lower(coalesce(target.role, '')) = 'system_admin' and
       (clean_role <> 'system_admin' or clean_status <> 'active' or approved is not true) then
      raise exception 'System administrator role and active approval cannot be removed here' using errcode = '42501';
    end if;

    update public.users set
      role = clean_role,
      employee_id = nullif(left(trim(coalesce(p_changes ->> 'employee_id', employee_id)), 80), ''),
      phone = nullif(left(trim(coalesce(p_changes ->> 'phone', phone)), 50), ''),
      department = nullif(left(trim(coalesce(p_changes ->> 'department', department)), 120), ''),
      branch = nullif(left(trim(coalesce(p_changes ->> 'branch', branch)), 120), ''),
      region = nullif(left(trim(coalesce(p_changes ->> 'region', region)), 120), ''),
      account_status = clean_status, is_approved = approved,
      must_change_password = coalesce((p_changes ->> 'must_change_password')::boolean, must_change_password),
      status = case when approved then 'active' else 'pending' end,
      approval_status = case when approved then 'approved' else 'pending' end,
      updated_at = now()
    where id = target.id;

    update public.user_profiles set role = clean_role,
      employee_id = nullif(left(trim(coalesce(p_changes ->> 'employee_id', employee_id)), 80), ''),
      department = nullif(left(trim(coalesce(p_changes ->> 'department', department)), 120), ''),
      account_status = clean_status, is_approved = approved,
      must_change_password = coalesce((p_changes ->> 'must_change_password')::boolean, must_change_password),
      updated_at = now()
    where lower(user_email) = target_email;
    update public.employees set access_role = clean_role,
      department = coalesce(nullif(trim(p_changes ->> 'department'), ''), department), updated_at = now()
    where lower(coalesce(user_account_email, email_address, '')) = target_email;
  else
    raise exception 'Unsupported user-management action';
  end if;
  return jsonb_build_object('success', true, 'action', clean_action, 'user_id', target.id);
end;
$$;

revoke all on function public.ark_create_pending_user(text, text, text, text) from public, anon;
revoke all on function public.ark_update_own_profile(text, text, text) from public, anon;
revoke all on function public.ark_admin_manage_user(uuid, text, jsonb) from public, anon;
grant execute on function public.ark_create_pending_user(text, text, text, text) to authenticated;
grant execute on function public.ark_update_own_profile(text, text, text) to authenticated;
grant execute on function public.ark_admin_manage_user(uuid, text, jsonb) to authenticated;
