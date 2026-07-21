-- Final database exposure lockdown and deploy-time verification report.

revoke all on schema public from public, anon;
revoke all on all tables in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
revoke execute on all functions in schema public from public, anon;

grant usage on schema public to authenticated;

-- Authenticated sessions receive table privileges only where RLS is enabled.
-- Policies remain the actual row/action authorization boundary.
do $$
declare relation record;
begin
  for relation in
    select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.reloptions
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
  loop
    if relation.relkind in ('r','p') and relation.relrowsecurity then
      execute format('grant select, insert, update, delete on table %I.%I to authenticated',
        relation.nspname, relation.relname);
    elsif relation.relkind in ('r','p') then
      execute format('revoke all on table %I.%I from authenticated', relation.nspname, relation.relname);
    elsif relation.relkind = 'v' and coalesce(relation.reloptions, array[]::text[]) @> array['security_invoker=true'] then
      execute format('grant select on table %I.%I to authenticated', relation.nspname, relation.relname);
    elsif relation.relkind in ('v','m') then
      execute format('revoke all on table %I.%I from authenticated', relation.nspname, relation.relname);
    end if;
  end loop;
end
$$;

-- UUID is the preferred key, but legacy tables may still use sequence-backed
-- identities. RLS continues to govern inserted rows.
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public revoke all on tables from public, anon;
alter default privileges in schema public revoke all on sequences from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

create or replace function public.ark_database_exposure_audit()
returns table(object_name text, object_type text, severity text, issue text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ark_assert_system_admin();

  return query
  select format('%I.%I', n.nspname, c.relname), 'table'::text, 'critical'::text,
    'authenticated has privileges but RLS is disabled'::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity
    and (
      has_table_privilege('authenticated', c.oid, 'SELECT') or
      has_table_privilege('authenticated', c.oid, 'INSERT') or
      has_table_privilege('authenticated', c.oid, 'UPDATE') or
      has_table_privilege('authenticated', c.oid, 'DELETE')
    );

  return query
  select format('%I.%I', n.nspname, c.relname), 'table'::text, 'critical'::text,
    'RLS is enabled but no policy exists'::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
    and not exists (
      select 1 from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname
    );

  return query
  select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
    'function'::text, 'critical'::text, 'anonymous or PUBLIC can execute function'::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    left join pg_roles role_entry on role_entry.oid = acl.grantee
    where acl.privilege_type = 'EXECUTE'
      and (acl.grantee = 0 or role_entry.rolname = 'anon')
  );

  return query
  select format('%I.%I', n.nspname, c.relname), 'view'::text, 'high'::text,
    'view is not configured with security_invoker=true'::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not (coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']);
end;
$$;

revoke all on function public.ark_database_exposure_audit() from public, anon;
grant execute on function public.ark_database_exposure_audit() to authenticated;

-- Preserve trusted backend access after removing public and anonymous grants.
-- RLS remains enforced for normal authenticated users; service_role is reserved
-- for secured Edge Functions, administration and isolated integration tests.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;

alter default privileges in schema public
  grant all privileges on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;