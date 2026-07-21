-- Keep legacy and repaired notification body fields compatible.
-- This migration contains no production data and is safe to apply repeatedly.

alter table public.notifications
  add column if not exists message text,
  add column if not exists message_body text;

update public.notifications
set
  message = coalesce(message, message_body, ''),
  message_body = coalesce(message_body, message, '')
where message is null or message_body is null;

create or replace function public.ark_sync_notification_message()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.message := coalesce(new.message, new.message_body, '');
  new.message_body := coalesce(new.message_body, new.message, '');
  return new;
end;
$$;

drop trigger if exists ark_sync_notification_message_trigger
  on public.notifications;

create trigger ark_sync_notification_message_trigger
before insert or update of message, message_body
on public.notifications
for each row execute function public.ark_sync_notification_message();

revoke all on function public.ark_sync_notification_message() from public, anon, authenticated;
