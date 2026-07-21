-- Section 6: private financial/request documents with retention metadata.
-- Run after 202607180022_storage_ownership_policies.sql.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('private-documents','private-documents',false,15728640,array[
  'application/pdf','image/jpeg','image/png','image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.sensitive_document_registry(
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null default 'private-documents',
  object_path text not null,
  owner_user_id uuid not null,
  owner_email text not null,
  document_category text not null,
  original_file_name text not null,
  mime_type text not null,
  file_size bigint not null check(file_size>0 and file_size<=15728640),
  retention_until date not null,
  retention_status text not null default 'active'
    check(retention_status in ('active','eligible_for_deletion','legal_hold','deleted')),
  entity_table text,
  entity_id text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(bucket_id,object_path)
);

alter table public.sensitive_document_registry enable row level security;
create policy sensitive_documents_owner_or_authorized_read
on public.sensitive_document_registry for select to authenticated
using(owner_user_id=auth.uid() or public.ark_has_any_role(array[
  'system_admin','ceo','agm','manager','finance','head_of_account','hr'
]::text[]));

create or replace function public.ark_register_private_document(
  p_object_path text,p_category text,p_original_name text,p_mime_type text,p_file_size bigint,
  p_retention_years integer default 7
)
returns jsonb language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare saved public.sensitive_document_registry%rowtype; clean_path text:=trim(coalesce(p_object_path,''));
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode='42501'; end if;
  if (storage.foldername(clean_path))[1]<>auth.uid()::text then raise exception 'Document path does not belong to the current user'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document') then raise exception 'Unsupported document MIME type'; end if;
  if p_file_size is null or p_file_size<=0 or p_file_size>15728640 then raise exception 'Document exceeds the 15 MB limit'; end if;
  if lower(storage.extension(clean_path)) not in ('pdf','jpg','jpeg','png','webp','docx') then raise exception 'Unsupported document extension'; end if;
  if not exists(select 1 from storage.objects where bucket_id='private-documents' and name=clean_path and owner_id=auth.uid()::text) then raise exception 'Uploaded document was not found or is not owned by the current user'; end if;
  insert into public.sensitive_document_registry(bucket_id,object_path,owner_user_id,owner_email,
    document_category,original_file_name,mime_type,file_size,retention_until)
  values('private-documents',clean_path,auth.uid(),lower(coalesce(auth.jwt()->>'email','')),
    left(trim(p_category),100),left(trim(p_original_name),255),p_mime_type,p_file_size,
    current_date+make_interval(years=>greatest(1,least(coalesce(p_retention_years,7),10))))
  on conflict(bucket_id,object_path) do update set
    document_category=excluded.document_category,original_file_name=excluded.original_file_name,
    mime_type=excluded.mime_type,file_size=excluded.file_size
  returning * into saved;
  return to_jsonb(saved);
end; $$;

create or replace function public.ark_mark_expired_private_documents()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer;
begin
  update public.sensitive_document_registry set retention_status='eligible_for_deletion'
  where retention_status='active' and retention_until<current_date;
  get diagnostics affected=row_count;
  return affected;
end; $$;

revoke all on function public.ark_register_private_document(text,text,text,text,bigint,integer) from public,anon;
grant execute on function public.ark_register_private_document(text,text,text,text,bigint,integer) to authenticated;
revoke all on function public.ark_mark_expired_private_documents() from public,anon,authenticated;
grant execute on function public.ark_mark_expired_private_documents() to service_role;

create policy private_documents_authorized_read on storage.objects for select to authenticated
using(bucket_id='private-documents' and (owner_id=auth.uid()::text or public.ark_has_any_role(array[
  'system_admin','ceo','agm','manager','finance','head_of_account','hr'
]::text[])));
create policy private_documents_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='private-documents' and (storage.foldername(name))[1]=auth.uid()::text
  and lower(storage.extension(name)) in ('pdf','jpg','jpeg','png','webp','docx'));
create policy private_documents_owner_delete on storage.objects for delete to authenticated
using(bucket_id='private-documents' and owner_id=auth.uid()::text);
