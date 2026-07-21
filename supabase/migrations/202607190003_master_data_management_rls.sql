-- Align bank and branch master-data UI permissions with database enforcement.
-- Operations maintains operational master data; system administrators retain
-- explicit access. Helpdesk consumes these records when raising tickets but
-- does not modify the master list.

do $$
begin
  if to_regclass('public.banks') is not null then
    drop policy if exists ark_role_insert on public.banks;
    drop policy if exists ark_role_update on public.banks;

    create policy ark_role_insert on public.banks
      for insert to authenticated
      with check (public.ark_has_any_role(array[
        'system_admin','admin','admin_head','manager','operations',
        'crm','head_of_business_development'
      ]::text[]));

    create policy ark_role_update on public.banks
      for update to authenticated
      using (public.ark_has_any_role(array[
        'system_admin','admin','admin_head','manager','operations',
        'crm','head_of_business_development'
      ]::text[]))
      with check (public.ark_has_any_role(array[
        'system_admin','admin','admin_head','manager','operations',
        'crm','head_of_business_development'
      ]::text[]));
  end if;

  if to_regclass('public.branches') is not null then
    drop policy if exists ark_role_insert on public.branches;
    drop policy if exists ark_role_update on public.branches;

    create policy ark_role_insert on public.branches
      for insert to authenticated
      with check (public.ark_has_any_role(array[
        'system_admin','admin','admin_head','manager','operations'
      ]::text[]));

    create policy ark_role_update on public.branches
      for update to authenticated
      using (public.ark_has_any_role(array[
        'system_admin','admin','admin_head','manager','operations'
      ]::text[]))
      with check (public.ark_has_any_role(array[
        'system_admin','admin','admin_head','manager','operations'
      ]::text[]));
  end if;
end
$$;
