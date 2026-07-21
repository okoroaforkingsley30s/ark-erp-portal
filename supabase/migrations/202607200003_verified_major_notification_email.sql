-- Allow an assigned engineer to obtain only the server-created major-event
-- notification IDs associated with their just-submitted completion report.

create or replace function public.ark_fe_major_notification_ids(p_ticket_id uuid)
returns table(notification_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  ticket_row public.tickets%rowtype;
begin
  if auth.uid() is null or public.ark_current_user_role() <> 'engineer' then
    raise exception 'Field Engineer authorization required' using errcode = '42501';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id;

  if not found or actor_email not in (
    lower(coalesce(ticket_row.assigned_to, '')),
    lower(coalesce(ticket_row.assigned_engineer_email, ''))
  ) then
    raise exception 'Assigned ticket not found' using errcode = '42501';
  end if;

  if lower(coalesce(ticket_row.status, '')) <> 'pending_review' then
    raise exception 'Ticket is not pending review' using errcode = '22023';
  end if;

  return query
  select n.id
  from public.notifications n
  where n.type = 'ticket_completion_submitted'
    and n.created_at >= now() - interval '10 minutes'
    and lower(coalesce(n.data ->> 'engineer_email', '')) = actor_email
    and coalesce(n.data ->> 'ticket_id', '') = p_ticket_id::text;
end;
$$;

revoke all on function public.ark_fe_major_notification_ids(uuid) from public, anon;
grant execute on function public.ark_fe_major_notification_ids(uuid) to authenticated;
