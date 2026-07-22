-- Mail attachments, safe mail-to-ticket linkage and narrow administrator finance separation.
alter table public.email_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists converted_to_ticket boolean not null default false,
  add column if not exists linked_ticket_id text;

create or replace function public.ark_link_email_to_ticket(
  p_email_id uuid,
  p_ticket_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mail_row public.email_messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into mail_row
  from public.email_messages
  where id = p_email_id and created_by = auth.uid()
  for update;

  if not found then
    raise exception 'Email not found' using errcode = 'P0002';
  end if;

  if mail_row.converted_to_ticket and mail_row.linked_ticket_id::text is distinct from p_ticket_id::text then
    raise exception 'Email is already linked to another ticket' using errcode = '23505';
  end if;

  if not exists (select 1 from public.tickets where id = p_ticket_id) then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  update public.email_messages
  set converted_to_ticket = true, linked_ticket_id = p_ticket_id::text, updated_at = now()
  where id = p_email_id;

  return jsonb_build_object('linked', true, 'email_id', p_email_id, 'ticket_id', p_ticket_id);
end;
$$;

revoke all on function public.ark_link_email_to_ticket(uuid, uuid) from public, anon;
grant execute on function public.ark_link_email_to_ticket(uuid, uuid) to authenticated;
