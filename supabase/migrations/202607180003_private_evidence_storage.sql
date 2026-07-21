-- Evidence must require an authenticated session. Application pages exchange
-- stored object paths for short-lived signed URLs when rendering evidence.
update storage.buckets
set public = false
where id in ('inventory', 'ticket-evidence');

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'inventory';

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
where id = 'ticket-evidence';

revoke select, insert, update, delete on storage.objects from anon;

drop policy if exists ark_evidence_authenticated_read on storage.objects;
create policy ark_evidence_authenticated_read
on storage.objects for select
to authenticated
using (bucket_id in ('inventory', 'ticket-evidence'));

drop policy if exists ark_evidence_authenticated_insert on storage.objects;
create policy ark_evidence_authenticated_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('inventory', 'ticket-evidence')
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov')
);

drop policy if exists ark_evidence_owner_update on storage.objects;
create policy ark_evidence_owner_update
on storage.objects for update
to authenticated
using (
  bucket_id in ('inventory', 'ticket-evidence')
  and owner_id = auth.uid()::text
)
with check (
  bucket_id in ('inventory', 'ticket-evidence')
  and owner_id = auth.uid()::text
);

drop policy if exists ark_evidence_owner_delete on storage.objects;
create policy ark_evidence_owner_delete
on storage.objects for delete
to authenticated
using (
  bucket_id in ('inventory', 'ticket-evidence')
  and owner_id = auth.uid()::text
);
