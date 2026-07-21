-- Section 5: canonical identity binding and transactional cross-table sync.
-- Run after 202607180020_rr_request_transactions.sql.

alter table public.users add column if not exists auth_user_id uuid;
alter table public.user_profiles add column if not exists auth_user_id uuid;
alter table public.employees add column if not exists auth_user_id uuid;
alter table public.engineers add column if not exists auth_user_id uuid;

-- Stop new case-variant duplicates. If this migration reports duplicates, merge
-- those identities deliberately before continuing rather than choosing one.
create unique index if not exists users_normalized_email_uidx
  on public.users(lower(trim(email)));
create unique index if not exists user_profiles_normalized_email_uidx
  on public.user_profiles(lower(trim(user_email)));
create unique index if not exists users_auth_user_id_uidx
  on public.users(auth_user_id) where auth_user_id is not null;
create unique index if not exists user_profiles_auth_user_id_uidx
  on public.user_profiles(auth_user_id) where auth_user_id is not null;
create unique index if not exists employees_auth_user_id_uidx
  on public.employees(auth_user_id) where auth_user_id is not null;
create unique index if not exists engineers_auth_user_id_uidx
  on public.engineers(auth_user_id) where auth_user_id is not null;

-- Preserve ambiguous legacy employee rows while recording which record owns the
-- login.  Duplicates are not deleted because they can contain HR history.
create table if not exists public.identity_record_conflicts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  normalized_email text not null,
  entity_type text not null,
  canonical_record_id uuid not null,
  duplicate_record_id uuid not null,
  reason text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (entity_type, auth_user_id, duplicate_record_id)
);

alter table public.identity_record_conflicts enable row level security;
revoke all on table public.identity_record_conflicts from public, anon, authenticated;

-- Confirmed production staff-number corrections. These make the canonical HR
-- employee deterministic without discarding either legacy employee row.
update public.users
set employee_id = 'ARK-181378', updated_at = now()
where lower(trim(email)) = 'idiohvictor2@gmail.com'
  and employee_id is distinct from 'ARK-181378';

update public.users
set employee_id = 'ARK-019', updated_at = now()
where lower(trim(email)) = 'olabanji@arktechnologiesgroup.com'
  and employee_id is distinct from 'ARK-019';

-- Move Omisore's unique contact address from the incomplete duplicate onto the
-- canonical ARK-122 employee. The duplicate row and all other HR history remain.
update public.employees
set email_address = null, updated_at = now()
where id = 'dcf7e1db-e914-41bf-9ee5-e7c06cf14f85'::uuid
  and lower(trim(coalesce(email_address, ''))) = 'omisore@arktechnologiesgroup.com';

update public.employees
set email_address = 'omisore@arktechnologiesgroup.com', updated_at = now()
where id = '6a8bcfb6-139e-4c0b-aaaf-a11002099a1f'::uuid
  and lower(trim(coalesce(email_address, ''))) = 'sarah@arktechnologiesgroup.com';

-- Bind legacy records to the actual Supabase Auth UUID by normalized email.
update public.users u set auth_user_id = au.id, email = lower(trim(u.email))
from auth.users au
where lower(trim(au.email)) = lower(trim(u.email))
  and u.auth_user_id is distinct from au.id;

update public.user_profiles p set auth_user_id = au.id, user_email = lower(trim(p.user_email))
from auth.users au
where lower(trim(au.email)) = lower(trim(p.user_email))
  and p.auth_user_id is distinct from au.id;

with ranked_employee_matches as (
  select
    e.id as employee_id,
    au.id as auth_user_id,
    lower(trim(au.email)) as normalized_email,
    row_number() over (
      partition by au.id
      order by
        case when nullif(trim(u.employee_id), '') is not null
          and upper(trim(e.staff_id)) = upper(trim(u.employee_id)) then 0 else 1 end,
        case when nullif(trim(e.staff_id), '') is not null
          and upper(trim(e.staff_id)) <> 'ARK-' then 0 else 1 end,
        e.created_at nulls last,
        e.id::text
    ) as match_rank
  from auth.users au
  join public.employees e
    on lower(trim(au.email)) = lower(trim(coalesce(
      nullif(e.user_account_email, ''), nullif(e.email_address, ''), ''
    )))
  left join public.users u on lower(trim(u.email)) = lower(trim(au.email))
), canonical_employee_matches as (
  select * from ranked_employee_matches where match_rank = 1
)
update public.employees e
set auth_user_id = match.auth_user_id
from canonical_employee_matches match
where e.id = match.employee_id
  and e.auth_user_id is distinct from match.auth_user_id;

with ranked_employee_matches as (
  select
    e.id as employee_id,
    au.id as auth_user_id,
    lower(trim(au.email)) as normalized_email,
    row_number() over (
      partition by au.id
      order by
        case when nullif(trim(u.employee_id), '') is not null
          and upper(trim(e.staff_id)) = upper(trim(u.employee_id)) then 0 else 1 end,
        case when nullif(trim(e.staff_id), '') is not null
          and upper(trim(e.staff_id)) <> 'ARK-' then 0 else 1 end,
        e.created_at nulls last,
        e.id::text
    ) as match_rank,
    first_value(e.id) over (
      partition by au.id
      order by
        case when nullif(trim(u.employee_id), '') is not null
          and upper(trim(e.staff_id)) = upper(trim(u.employee_id)) then 0 else 1 end,
        case when nullif(trim(e.staff_id), '') is not null
          and upper(trim(e.staff_id)) <> 'ARK-' then 0 else 1 end,
        e.created_at nulls last,
        e.id::text
    ) as canonical_employee_id
  from auth.users au
  join public.employees e
    on lower(trim(au.email)) = lower(trim(coalesce(
      nullif(e.user_account_email, ''), nullif(e.email_address, ''), ''
    )))
  left join public.users u on lower(trim(u.email)) = lower(trim(au.email))
)
insert into public.identity_record_conflicts(
  auth_user_id, normalized_email, entity_type, canonical_record_id,
  duplicate_record_id, reason
)
select
  auth_user_id, normalized_email, 'employee', canonical_employee_id,
  employee_id, 'Multiple legacy employee rows matched one authentication account'
from ranked_employee_matches
where match_rank > 1
on conflict (entity_type, auth_user_id, duplicate_record_id) do update set
  canonical_record_id = excluded.canonical_record_id,
  normalized_email = excluded.normalized_email,
  reason = excluded.reason,
  detected_at = now();

with ranked_engineer_matches as (
  select e.id as engineer_id, au.id as auth_user_id,
    row_number() over (partition by au.id order by e.created_at nulls last, e.id::text) as match_rank
  from auth.users au
  join public.engineers e on lower(trim(au.email)) = lower(trim(e.email))
)
update public.engineers e
set auth_user_id = match.auth_user_id, email = lower(trim(e.email))
from ranked_engineer_matches match
where e.id = match.engineer_id and match.match_rank = 1
  and e.auth_user_id is distinct from match.auth_user_id;

create or replace function public.ark_sync_identity_from_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  canonical public.users%rowtype;
  clean_email text;
  auth_id uuid;
  active boolean;
  employee_target_id uuid;
  engineer_target_id uuid;
begin
  select * into canonical from public.users where id=p_user_id for update;
  if not found then raise exception 'Canonical user was not found'; end if;
  clean_email := lower(trim(canonical.email));
  auth_id := coalesce(canonical.auth_user_id,case when canonical.id in (select id from auth.users) then canonical.id end);
  active := canonical.is_approved is true
    and lower(coalesce(canonical.approval_status,canonical.status,'')) in ('approved','active')
    and lower(coalesce(canonical.account_status,'active')) = 'active';

  update public.users set email=clean_email,auth_user_id=auth_id
  where id=canonical.id and (email is distinct from clean_email or auth_user_id is distinct from auth_id);

  insert into public.user_profiles(
    auth_user_id,user_email,employee_id,department,role,account_status,is_approved,
    must_change_password,created_at,updated_at
  ) values(
    auth_id,clean_email,canonical.employee_id,canonical.department,canonical.role,
    canonical.account_status,active,canonical.must_change_password,now(),now()
  ) on conflict (lower(trim(user_email))) do update set
    auth_user_id=excluded.auth_user_id,employee_id=excluded.employee_id,
    department=excluded.department,role=excluded.role,account_status=excluded.account_status,
    is_approved=excluded.is_approved,must_change_password=excluded.must_change_password,updated_at=now();

  select e.id into employee_target_id
  from public.employees e
  where e.auth_user_id=auth_id
     or lower(trim(coalesce(nullif(e.user_account_email,''),nullif(e.email_address,''),'')))=clean_email
     or (canonical.employee_id is not null and upper(trim(e.staff_id))=upper(trim(canonical.employee_id)))
  order by
    case when e.auth_user_id=auth_id then 0 else 1 end,
    case when canonical.employee_id is not null
      and upper(trim(e.staff_id))=upper(trim(canonical.employee_id)) then 0 else 1 end,
    case when nullif(trim(e.staff_id),'') is not null
      and upper(trim(e.staff_id)) <> 'ARK-' then 0 else 1 end,
    e.created_at nulls last,
    e.id::text
  limit 1 for update;

  update public.employees set
    auth_user_id=auth_id,user_account_email=clean_email,
    email_address=coalesce(nullif(email_address,''),clean_email),
    full_name=coalesce(nullif(canonical.full_name,''),full_name),
    staff_id=coalesce(nullif(canonical.employee_id,''),staff_id),
    department=coalesce(nullif(canonical.department,''),department),
    access_role=canonical.role,
    phone_number=coalesce(nullif(canonical.phone,''),phone_number),
    updated_at=now()
  where id=employee_target_id;

  select e.id into engineer_target_id
  from public.engineers e
  where e.auth_user_id=auth_id or lower(trim(e.email))=clean_email
  order by case when e.auth_user_id=auth_id then 0 else 1 end,
    e.created_at nulls last, e.id::text
  limit 1 for update;

  update public.engineers set
    auth_user_id=auth_id,email=clean_email,
    engineer_name=coalesce(nullif(canonical.full_name,''),engineer_name),
    phone_number=coalesce(nullif(canonical.phone,''),phone_number),
    status=case when active then 'active' else 'inactive' end,
    updated_at=now()
  where id=engineer_target_id;
end;
$$;

create or replace function public.ark_sync_identity_user_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ark_sync_identity_from_user(new.id);
  return new;
end;
$$;

drop trigger if exists ark_users_identity_sync on public.users;
create trigger ark_users_identity_sync
after insert or update of email,full_name,phone,employee_id,department,role,status,
  approval_status,is_approved,account_status,must_change_password,auth_user_id
on public.users
for each row execute function public.ark_sync_identity_user_trigger();

create or replace function public.ark_register_current_user(p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare clean_email text:=lower(trim(coalesce(auth.jwt()->>'email',''))); target_id uuid;
begin
  if auth.uid() is null or clean_email='' then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('register:'||clean_email,0));
  select id into target_id from public.users
  where auth_user_id=auth.uid() or id=auth.uid() or lower(trim(email))=clean_email
  order by (auth_user_id=auth.uid()) desc,(id=auth.uid()) desc limit 1 for update;
  if target_id is null then
    insert into public.users(id,auth_user_id,email,full_name,role,status,approval_status,is_approved,account_status,updated_at)
    values(auth.uid(),auth.uid(),clean_email,nullif(trim(p_full_name),''),null,'pending','pending',false,'active',now())
    returning id into target_id;
  else
    update public.users set auth_user_id=auth.uid(),email=clean_email,
      full_name=coalesce(nullif(trim(p_full_name),''),full_name),updated_at=now()
    where id=target_id;
  end if;
  return target_id;
end;
$$;

-- Backfill dependent records after the trigger and canonical function exist.
do $$ declare target_id uuid; begin
  for target_id in select id from public.users loop
    perform public.ark_sync_identity_from_user(target_id);
  end loop;
end $$;

revoke all on function public.ark_sync_identity_from_user(uuid) from public,anon,authenticated;
revoke all on function public.ark_sync_identity_user_trigger() from public,anon,authenticated;
revoke all on function public.ark_register_current_user(text) from public,anon;
grant execute on function public.ark_register_current_user(text) to authenticated;
