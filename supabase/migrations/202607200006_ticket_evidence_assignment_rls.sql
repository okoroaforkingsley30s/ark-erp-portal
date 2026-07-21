-- Align private ticket evidence access with the ticket's email-based FE assignment.

create or replace function public.ark_can_access_ticket_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.tickets t
    where t.id::text = (storage.foldername(p_object_name))[1]
      and (
        lower(coalesce(auth.jwt() ->> 'email', '')) in (
          lower(coalesce(t.assigned_to, '')),
          lower(coalesce(t.assigned_engineer_email, '')),
          lower(coalesce(t.client_email, ''))
        )
        or public.ark_has_any_role(array[
          'system_admin','ceo','agm','manager','operations','operations_manager',
          'helpdesk','inventory','repair_head','repair_technician'
        ]::text[])
      )
  );
$$;

create or replace function public.ark_can_upload_ticket_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.tickets t
    where t.id::text = (storage.foldername(p_object_name))[1]
      and lower(coalesce(auth.jwt() ->> 'email', '')) in (
        lower(coalesce(t.assigned_to, '')),
        lower(coalesce(t.assigned_engineer_email, ''))
      )
      and lower(coalesce(t.status, '')) = 'in_progress'
  );
$$;

revoke all on function public.ark_can_access_ticket_evidence(text) from public, anon;
revoke all on function public.ark_can_upload_ticket_evidence(text) from public, anon;
grant execute on function public.ark_can_access_ticket_evidence(text) to authenticated;
grant execute on function public.ark_can_upload_ticket_evidence(text) to authenticated;

drop policy if exists ark_ticket_evidence_scoped_insert on storage.objects;
create policy ark_ticket_evidence_scoped_insert
on storage.objects for insert to authenticated
with check(
  bucket_id = 'ticket-evidence'
  and public.ark_can_upload_ticket_evidence(name)
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','mp4','webm','mov')
);
