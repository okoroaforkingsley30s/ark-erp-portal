-- Gmail synchronization uses this key to make retries idempotent per ARK ONE user.
-- The conditional block keeps this migration compatible with environments where
-- the legacy email schema has not been installed yet.
do $$
begin
  if to_regclass('public.email_messages') is not null then
    execute '
      create unique index if not exists email_messages_owner_gmail_message_uidx
      on public.email_messages (created_by, gmail_message_id)
      where created_by is not null and gmail_message_id is not null
    ';
  end if;
end
$$;
