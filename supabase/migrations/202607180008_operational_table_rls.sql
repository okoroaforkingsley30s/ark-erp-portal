-- Role and ownership policies for legacy operational tables used by the portal.
-- Functional enhancements are intentionally outside this security migration.

create or replace function public.ark_has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and public.ark_current_user_role() = any(p_roles);
$$;

create or replace function public.ark_row_belongs_to_current_user(p_row jsonb)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    auth.uid()::text = any(array[
      p_row ->> 'user_id', p_row ->> 'created_by', p_row ->> 'requested_by_id',
      p_row ->> 'employee_user_id', p_row ->> 'engineer_user_id', p_row ->> 'assigned_to'
    ])
    or lower(coalesce(auth.jwt() ->> 'email', '')) = any(array[
      lower(coalesce(p_row ->> 'user_email', '')),
      lower(coalesce(p_row ->> 'recipient_email', '')),
      lower(coalesce(p_row ->> 'email', '')),
      lower(coalesce(p_row ->> 'email_address', '')),
      lower(coalesce(p_row ->> 'requested_by_email', '')),
      lower(coalesce(p_row ->> 'engineer_email', ''))
    ])
  );
$$;

revoke all on function public.ark_has_any_role(text[]) from public, anon;
revoke all on function public.ark_row_belongs_to_current_user(jsonb) from public, anon;
grant execute on function public.ark_has_any_role(text[]) to authenticated;
grant execute on function public.ark_row_belongs_to_current_user(jsonb) to authenticated;

-- Each row defines the roles allowed to read and write a table. Ownership adds
-- access to a user's own records where that is appropriate for the workflow.
do $$
declare
  rule record;
  existing_policy record;
  owner_read text;
  owner_insert text;
begin
  for rule in
    select * from (values
      -- Shared organization reference data.
      ('banks', array['system_admin','ceo','agm','manager','admin','admin_head','operations','helpdesk','engineer','inventory','repair_head','repair_technician','finance','procurement','hr','crm','business_developer','head_of_business_development','client']::text[], array['system_admin','admin','admin_head','crm','head_of_business_development']::text[], false),
      ('branches', array['system_admin','ceo','agm','manager','admin','admin_head','operations','helpdesk','engineer','inventory','repair_head','finance','procurement','hr','crm']::text[], array['system_admin','admin','admin_head']::text[], false),
      ('departments', array['system_admin','ceo','agm','manager','admin','admin_head','operations','helpdesk','engineer','inventory','repair_head','repair_technician','finance','procurement','hr','crm']::text[], array['system_admin','admin','admin_head','hr']::text[], false),
      ('sites', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','crm','client']::text[], array['system_admin','operations','helpdesk','crm']::text[], false),
      ('machines', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','crm','client']::text[], array['system_admin','operations','helpdesk','inventory','crm']::text[], false),
      ('bank_devices', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','crm','client']::text[], array['system_admin','operations','helpdesk','inventory','crm']::text[], false),
      ('devices', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','crm']::text[], array['system_admin','operations','helpdesk','inventory']::text[], false),

      -- Helpdesk, engineering and Operations workflow.
      ('tickets', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','repair_technician','crm','client']::text[], array['system_admin','operations','helpdesk','engineer','manager']::text[], true),
      ('comments', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','repair_technician','crm','client']::text[], array['system_admin','operations','helpdesk','engineer','inventory','repair_head','repair_technician','crm','client']::text[], true),
      ('site_visits', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','hr']::text[], array['system_admin','operations','helpdesk','engineer']::text[], true),
      ('engineer_statuses', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','hr']::text[], array['system_admin','operations','helpdesk','engineer']::text[], true),
      ('operations_events', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','hr']::text[], array['system_admin','operations','helpdesk','engineer','inventory','repair_head']::text[], true),
      ('operations_status', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','hr']::text[], array['system_admin','operations']::text[], false),
      ('part_requests', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','repair_technician','finance','procurement']::text[], array['system_admin','operations','helpdesk','engineer','inventory','repair_head','repair_technician']::text[], true),
      ('part_lifecycle_logs', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','repair_technician']::text[], array['system_admin','operations','helpdesk','engineer','inventory','repair_head','repair_technician']::text[], true),

      -- Inventory and RR.
      ('inventory', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','finance','procurement']::text[], array['system_admin','inventory']::text[], false),
      ('inventory_items', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','finance','procurement']::text[], array['system_admin','inventory']::text[], false),
      ('inventory_movements', array['system_admin','ceo','agm','manager','operations','inventory','repair_head','finance','procurement']::text[], array['system_admin','inventory']::text[], false),
      ('inventory_usage_logs', array['system_admin','ceo','agm','manager','operations','inventory','repair_head','finance']::text[], array['system_admin','inventory','repair_head']::text[], true),
      ('inventory_dispatch_fund_requests', array['system_admin','ceo','agm','manager','operations','inventory','repair_head','finance']::text[], array['system_admin','inventory','finance']::text[], true),
      ('spare_parts', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','repair_technician','finance','procurement']::text[], array['system_admin','inventory']::text[], false),
      ('spare_part_requests', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','repair_technician']::text[], array['system_admin','operations','engineer','inventory','repair_head','repair_technician']::text[], true),
      ('spare_part_serials', array['system_admin','ceo','agm','manager','operations','inventory','repair_head','repair_technician']::text[], array['system_admin','inventory','repair_head']::text[], false),
      ('repair_jobs', array['system_admin','ceo','agm','manager','operations','helpdesk','engineer','inventory','repair_head','repair_technician','hr']::text[], array['system_admin','inventory','repair_head','repair_technician']::text[], true),
      ('rr_consumable_requests', array['system_admin','ceo','agm','manager','operations','inventory','repair_head','repair_technician','finance','procurement']::text[], array['system_admin','inventory','repair_head','repair_technician']::text[], true),

      -- HR records: owners see their own records; HR and management operate them.
      ('employees', array['system_admin','ceo','agm','manager','admin_head','hr']::text[], array['system_admin','hr']::text[], true),
      ('engineers', array['system_admin','ceo','agm','manager','operations','helpdesk','inventory','repair_head','hr']::text[], array['system_admin','operations','hr']::text[], true),
      ('hr_attendance', array['system_admin','ceo','agm','manager','hr']::text[], array['system_admin','hr']::text[], true),
      ('hr_holidays', array['system_admin','ceo','agm','manager','hr']::text[], array['system_admin','hr']::text[], false),
      ('hr_leave', array['system_admin','ceo','agm','manager','hr']::text[], array['system_admin','hr']::text[], true),
      ('leave_requests', array['system_admin','ceo','agm','manager','hr']::text[], array['system_admin','hr']::text[], true),
      ('hr_loans', array['system_admin','ceo','agm','manager','hr','finance']::text[], array['system_admin','hr','finance']::text[], true),
      ('hr_performance', array['system_admin','ceo','agm','manager','hr']::text[], array['system_admin','hr','manager']::text[], true),
      ('hr_training', array['system_admin','ceo','agm','manager','hr']::text[], array['system_admin','hr']::text[], true),

      -- CRM, procurement and general requests.
      ('crm_clients', array['system_admin','ceo','agm','manager','crm','business_developer','head_of_business_development','helpdesk','operations']::text[], array['system_admin','crm','business_developer','head_of_business_development']::text[], true),
      ('crm_complaints', array['system_admin','ceo','agm','manager','crm','business_developer','head_of_business_development','helpdesk','operations']::text[], array['system_admin','crm','business_developer','head_of_business_development','helpdesk']::text[], true),
      ('leads', array['system_admin','ceo','agm','manager','crm','business_developer','head_of_business_development']::text[], array['system_admin','crm','business_developer','head_of_business_development']::text[], true),
      ('lpos', array['system_admin','ceo','agm','manager','admin_head','inventory','finance','procurement','hr']::text[], array['system_admin','procurement','inventory','hr','agm','manager','finance']::text[], true),
      ('purchase_requests', array['system_admin','ceo','agm','manager','admin_head','inventory','finance','procurement','hr']::text[], array['system_admin','procurement','inventory','hr','agm','manager','finance']::text[], true),
      ('fund_requests', array['system_admin','ceo','agm','manager','hr','finance']::text[], array['system_admin','hr','finance','manager','agm','ceo']::text[], true),
      ('workflow_requests', array['system_admin','ceo','agm','manager','admin_head','operations','hr','finance','procurement']::text[], array['system_admin','manager','agm','ceo','admin_head','operations','hr','finance','procurement']::text[], true),
      ('invoices', array['system_admin','ceo','agm','manager','finance','crm']::text[], array['system_admin','finance']::text[], true),
      ('expenses', array['system_admin','ceo','agm','manager','finance','hr']::text[], array['system_admin','finance']::text[], true)
    ) as configured(table_name, read_roles, write_roles, allow_owner)
  loop
    if to_regclass(format('public.%I', rule.table_name)) is null then continue; end if;

    execute format('alter table public.%I enable row level security', rule.table_name);
    for existing_policy in
      select policyname from pg_policies where schemaname = 'public' and tablename = rule.table_name
    loop
      execute format('drop policy if exists %I on public.%I', existing_policy.policyname, rule.table_name);
    end loop;

    owner_read := case when rule.allow_owner then
      format(' or public.ark_row_belongs_to_current_user(to_jsonb(%I))', rule.table_name)
      else '' end;
    -- Owners may submit their own records, but may not subsequently rewrite
    -- workflow status, approvals, balances, or other protected fields.
    owner_insert := owner_read;

    execute format(
      'create policy ark_role_select on public.%I for select to authenticated using (public.ark_has_any_role(%L::text[])%s)',
      rule.table_name, rule.read_roles, owner_read
    );
    execute format(
      'create policy ark_role_insert on public.%I for insert to authenticated with check (public.ark_has_any_role(%L::text[])%s)',
      rule.table_name, rule.write_roles, owner_insert
    );
    execute format(
      'create policy ark_role_update on public.%I for update to authenticated using (public.ark_has_any_role(%L::text[])%s) with check (public.ark_has_any_role(%L::text[])%s)',
      rule.table_name, rule.write_roles, '', rule.write_roles, ''
    );
    execute format(
      'create policy ark_admin_delete on public.%I for delete to authenticated using (public.ark_is_system_admin())',
      rule.table_name
    );
  end loop;
end
$$;

do $$
begin
  if to_regclass('public.chat_messages') is not null then
    alter table public.chat_messages enable row level security;
    drop policy if exists ark_chat_participant_read on public.chat_messages;
    drop policy if exists ark_chat_sender_insert on public.chat_messages;
    drop policy if exists ark_chat_sender_update on public.chat_messages;
    drop policy if exists ark_chat_sender_delete on public.chat_messages;
    create policy ark_chat_participant_read on public.chat_messages for select to authenticated
      using (
        lower(coalesce(message_type, 'channel')) = 'channel'
        or lower(sender_id) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(recipient_id) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
    create policy ark_chat_sender_insert on public.chat_messages for insert to authenticated
      with check (lower(sender_id) = lower(coalesce(auth.jwt() ->> 'email', '')));
    create policy ark_chat_sender_update on public.chat_messages for update to authenticated
      using (lower(sender_id) = lower(coalesce(auth.jwt() ->> 'email', '')))
      with check (lower(sender_id) = lower(coalesce(auth.jwt() ->> 'email', '')));
    create policy ark_chat_sender_delete on public.chat_messages for delete to authenticated
      using (lower(sender_id) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.ark_is_system_admin());
  end if;
end
$$;

-- Profile roles are authorization data. Users update personal setup through
-- ark_complete_password_setup; no direct profile UPDATE policy is retained.
drop policy if exists ark_user_profiles_self_update on public.user_profiles;
