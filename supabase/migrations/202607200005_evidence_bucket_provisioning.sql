-- Reproducibly provision private evidence buckets.
-- Earlier migrations configured these buckets but did not create them.

insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'inventory',
    'inventory',
    false,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'ticket-evidence',
    'ticket-evidence',
    false,
    52428800,
    array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
