-- General RR portal visibility repair.
-- Normalizes legacy human-readable roles (for example "RR HOD") and gives
-- RR HODs visibility of all repair jobs while technicians see assignments.

create or replace function public.ark_current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select regexp_replace(
    lower(trim(coalesce(
      (select u.role from public.users u where u.id = auth.uid() limit 1),
      (select up.role from public.user_profiles up
        where lower(up.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        limit 1),
      ''
    ))),
    '[[:space:]-]+', '_', 'g'
  );
$$;

revoke all on function public.ark_current_user_role() from public, anon;
grant execute on function public.ark_current_user_role() to authenticated;

alter table public.repair_jobs enable row level security;

drop policy if exists ark_rr_jobs_portal_read on public.repair_jobs;
create policy ark_rr_jobs_portal_read
on public.repair_jobs
for select
to authenticated
using (
  public.ark_has_any_role(array[
    'system_admin','ceo','agm','manager','repair_head',
    'rr_hod','repair_hod','head_of_rr'
  ]::text[])
  or assigned_rr_technician = public.ark_current_profile_id()
);

drop policy if exists ark_rr_units_read on public.rr_repair_units;
create policy ark_rr_units_read
on public.rr_repair_units
for select
to authenticated
using (
  public.ark_has_any_role(array[
    'system_admin','ceo','agm','manager','operations','inventory','repair_head',
    'rr_hod','repair_hod','head_of_rr'
  ]::text[])
  or assigned_technician_id = public.ark_current_profile_id()
);

grant select on public.repair_jobs to authenticated;
grant select on public.rr_repair_units to authenticated;
