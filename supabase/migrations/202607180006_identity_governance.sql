-- Server-authorized identity approval and password-setup workflows.

create or replace function public.ark_assert_system_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.ark_current_user_role() <> 'system_admin' then
    raise exception 'System administrator authorization required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.ark_manage_user_approval(
  p_target_user_id uuid,
  p_action text,
  p_role text default null,
  p_department text default null,
  p_employee_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.users%rowtype;
  clean_action text := lower(trim(coalesce(p_action, '')));
  clean_role text := lower(trim(coalesce(p_role, '')));
  clean_email text;
  now_value timestamptz := now();
begin
  perform public.ark_assert_system_admin();

  select * into target from public.users where id = p_target_user_id for update;
  if not found then raise exception 'User was not found'; end if;
  if target.id = auth.uid() then
    raise exception 'You cannot approve or reject your own account' using errcode = '42501';
  end if;

  clean_email := lower(trim(target.email));

  if clean_action = 'approve' then
    if clean_role not in (
      'system_admin', 'head_of_it', 'it', 'ceo', 'ceo_pa', 'agm', 'manager',
      'repair_head', 'repair_technician', 'helpdesk', 'engineer', 'hr', 'finance',
      'inventory', 'procurement', 'crm', 'admin', 'client'
    ) then raise exception 'A valid role is required'; end if;

    update public.users set
      role = clean_role, department = nullif(trim(p_department), ''),
      employee_id = nullif(trim(p_employee_id), ''), status = 'active',
      approval_status = 'approved', is_approved = true, account_status = 'active',
      updated_at = now_value
    where id = target.id;

    update public.user_profiles set
      role = clean_role, department = nullif(trim(p_department), ''),
      employee_id = nullif(trim(p_employee_id), ''), account_status = 'active',
      updated_at = now_value
    where lower(user_email) = clean_email;

    if not found then
      insert into public.user_profiles
        (user_email, role, department, employee_id, account_status, created_at, updated_at)
      values
        (clean_email, clean_role, nullif(trim(p_department), ''),
         nullif(trim(p_employee_id), ''), 'active', now_value, now_value);
    end if;

    update public.employees set
      access_role = clean_role, department = coalesce(nullif(trim(p_department), ''), department),
      updated_at = now_value
    where lower(coalesce(user_account_email, email_address, '')) = clean_email;

    insert into public.notifications
      (user_email, recipient_email, title, message, type, read, is_read, data, link, sound, created_at)
    values
      (clean_email, clean_email, 'Account Approved',
       'Your ARK ONE Portal account has been approved. A password setup email will be sent to you.',
       'system', false, false,
       jsonb_build_object('role', clean_role, 'department', p_department, 'employee_id', p_employee_id),
       '/dashboard', 'bell', now_value);
  elsif clean_action = 'reject' then
    if lower(coalesce(target.role, '')) = 'system_admin' then
      raise exception 'System administrator accounts cannot be rejected here' using errcode = '42501';
    end if;

    update public.users set role = null, status = 'rejected', approval_status = 'rejected',
      is_approved = false, account_status = 'suspended', updated_at = now_value
    where id = target.id;
    update public.user_profiles set account_status = 'suspended', updated_at = now_value
    where lower(user_email) = clean_email;
    insert into public.notifications
      (user_email, recipient_email, title, message, type, read, is_read, data, link, sound, created_at)
    values
      (clean_email, clean_email, 'Account Rejected',
       'Your ARK ONE Portal account request was rejected. Please contact an administrator.',
       'system', false, false, jsonb_build_object('status', 'rejected'),
       '/welcome', 'bell', now_value);
  else
    raise exception 'Action must be approve or reject';
  end if;

  return jsonb_build_object('success', true, 'action', clean_action, 'user_id', target.id,
    'email', clean_email, 'full_name', target.full_name, 'role', nullif(clean_role, ''));
end;
$$;

create or replace function public.ark_complete_password_setup(
  p_full_name text,
  p_phone text default null,
  p_employee_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.users%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into target from public.users where id = auth.uid() for update;
  if not found then raise exception 'User profile was not found'; end if;
  if target.is_approved is not true or lower(coalesce(target.approval_status, target.status, '')) not in ('approved', 'active') then
    raise exception 'Account approval is required before password setup' using errcode = '42501';
  end if;
  update public.users set full_name = nullif(trim(p_full_name), ''), phone = nullif(trim(p_phone), ''),
    employee_id = nullif(trim(p_employee_id), ''), must_change_password = false, updated_at = now()
  where id = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.ark_assert_system_admin() from public, anon;
revoke all on function public.ark_manage_user_approval(uuid, text, text, text, text) from public, anon;
revoke all on function public.ark_complete_password_setup(text, text, text) from public, anon;
grant execute on function public.ark_manage_user_approval(uuid, text, text, text, text) to authenticated;
grant execute on function public.ark_complete_password_setup(text, text, text) to authenticated;

create or replace function public.ark_notify_admins_of_pending_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.approval_status, new.status, '')) = 'pending'
     and (tg_op = 'INSERT' or lower(coalesce(old.approval_status, old.status, '')) <> 'pending') then
    insert into public.notifications
      (user_email, recipient_email, title, message, type, read, is_read, data, link, sound, created_at)
    select lower(trim(admin_user.email)), lower(trim(admin_user.email)),
      'New User Awaiting Approval',
      coalesce(nullif(trim(new.full_name), ''), new.email) || ' is awaiting account approval.',
      'user_approval', false, false,
      jsonb_build_object('user_id', new.id, 'email', new.email, 'full_name', new.full_name),
      '/users', 'bell', now()
    from public.users admin_user
    where lower(coalesce(admin_user.role, '')) = 'system_admin'
      and admin_user.is_approved is true
      and lower(coalesce(admin_user.account_status, 'active')) = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists ark_users_pending_admin_notification on public.users;
create trigger ark_users_pending_admin_notification
after insert or update of approval_status, status on public.users
for each row execute function public.ark_notify_admins_of_pending_user();
revoke all on function public.ark_notify_admins_of_pending_user() from public, anon, authenticated;
