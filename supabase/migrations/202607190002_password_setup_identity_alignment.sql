-- Complete invited-user setup through the canonical auth_user_id binding.
-- Legacy records may use auth.users.id as public.users.id, so both forms remain supported.
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
declare
  target public.users%rowtype;
  clean_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.users
  where auth_user_id = auth.uid()
     or id = auth.uid()
     or (clean_email <> '' and lower(trim(email)) = clean_email)
  order by
    (auth_user_id = auth.uid()) desc,
    (id = auth.uid()) desc
  limit 1
  for update;

  if not found then
    raise exception 'User profile was not found';
  end if;

  if target.is_approved is not true
     or lower(coalesce(target.approval_status, target.status, '')) not in ('approved', 'active') then
    raise exception 'Account approval is required before password setup' using errcode = '42501';
  end if;

  update public.users
  set auth_user_id = auth.uid(),
      email = case when clean_email <> '' then clean_email else email end,
      full_name = nullif(trim(p_full_name), ''),
      phone = nullif(trim(p_phone), ''),
      employee_id = nullif(trim(p_employee_id), ''),
      must_change_password = false,
      updated_at = now()
  where id = target.id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.ark_complete_password_setup(text, text, text)
  from public, anon;
grant execute on function public.ark_complete_password_setup(text, text, text)
  to authenticated;
