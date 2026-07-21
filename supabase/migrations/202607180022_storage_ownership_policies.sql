-- Section 6: evidence storage ownership and workflow-scoped access.
-- Run after 202607180021_identity_record_consolidation.sql.

create or replace function public.ark_can_access_ticket_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select auth.uid() is not null and exists(
    select 1 from public.tickets t
    where t.id::text = (storage.foldername(p_object_name))[1]
      and (
        public.ark_row_belongs_to_current_user(to_jsonb(t))
        or public.ark_has_any_role(array[
          'system_admin','ceo','agm','manager','operations','helpdesk',
          'inventory','repair_head','repair_technician'
        ]::text[])
      )
  );
$$;

revoke all on function public.ark_can_access_ticket_evidence(text) from public,anon;
grant execute on function public.ark_can_access_ticket_evidence(text) to authenticated;

drop policy if exists ark_evidence_authenticated_read on storage.objects;
drop policy if exists ark_evidence_authenticated_insert on storage.objects;
drop policy if exists ark_evidence_owner_update on storage.objects;
drop policy if exists ark_evidence_owner_delete on storage.objects;

create policy ark_ticket_evidence_scoped_read
on storage.objects for select to authenticated
using(
  bucket_id='ticket-evidence'
  and (owner_id=auth.uid()::text or public.ark_can_access_ticket_evidence(name))
);

create policy ark_ticket_evidence_scoped_insert
on storage.objects for insert to authenticated
with check(
  bucket_id='ticket-evidence'
  and public.ark_can_access_ticket_evidence(name)
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','mp4','webm','mov')
);

create policy ark_inventory_evidence_scoped_read
on storage.objects for select to authenticated
using(
  bucket_id='inventory'
  and (
    owner_id=auth.uid()::text
    or public.ark_has_any_role(array[
      'system_admin','ceo','agm','manager','operations','inventory','repair_head'
    ]::text[])
  )
);

create policy ark_inventory_evidence_owner_insert
on storage.objects for insert to authenticated
with check(
  bucket_id='inventory'
  and (storage.foldername(name))[1]=auth.uid()::text
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

create policy ark_private_evidence_owner_update
on storage.objects for update to authenticated
using(bucket_id in ('inventory','ticket-evidence') and owner_id=auth.uid()::text)
with check(bucket_id in ('inventory','ticket-evidence') and owner_id=auth.uid()::text);

create policy ark_private_evidence_owner_delete
on storage.objects for delete to authenticated
using(bucket_id in ('inventory','ticket-evidence') and owner_id=auth.uid()::text);
