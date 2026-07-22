-- Reliable notification-email scheduling and administrator-visible health.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

update public.notifications
set email_status = 'retry',
    email_last_error = 'Recovered after an interrupted notification worker run'
where major_notification is true
  and email_status = 'processing'
  and created_at < now() - interval '10 minutes';

create or replace function public.ark_install_notification_email_schedule()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, vault, cron, pg_temp
as $$
declare
  project_url_exists boolean;
  worker_secret_exists boolean;
  existing_job_id bigint;
  installed_job_id bigint;
begin
  if auth.uid() is not null and not public.ark_is_system_admin() then
    raise exception 'System administrator authorization required' using errcode = '42501';
  end if;

  select exists(select 1 from vault.decrypted_secrets where name = 'ark_one_project_url')
    into project_url_exists;
  select exists(select 1 from vault.decrypted_secrets where name = 'ark_one_notification_worker_secret')
    into worker_secret_exists;

  if not project_url_exists or not worker_secret_exists then
    return jsonb_build_object(
      'installed', false,
      'reason', 'missing_vault_configuration',
      'required_secrets', jsonb_build_array(
        'ark_one_project_url', 'ark_one_notification_worker_secret'
      )
    );
  end if;

  select jobid into existing_job_id
  from cron.job
  where jobname = 'ark-one-notification-email-dispatch'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  select cron.schedule(
    'ark-one-notification-email-dispatch',
    '* * * * *',
    $job$
      select net.http_post(
        url := (
          select rtrim(decrypted_secret, '/')
          from vault.decrypted_secrets
          where name = 'ark_one_project_url'
        ) || '/functions/v1/dispatch-notification-outbox',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'ark_one_notification_worker_secret'
          )
        ),
        body := jsonb_build_object('scheduled_at', now())
      );
    $job$
  ) into installed_job_id;

  return jsonb_build_object(
    'installed', true,
    'job_id', installed_job_id,
    'schedule', '* * * * *'
  );
end;
$$;

revoke all on function public.ark_install_notification_email_schedule() from public, anon;
grant execute on function public.ark_install_notification_email_schedule() to authenticated;

create or replace function public.ark_notification_email_delivery_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, vault, cron, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.ark_is_system_admin() then
    raise exception 'System administrator authorization required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'schedule_installed', exists(
      select 1 from cron.job where jobname = 'ark-one-notification-email-dispatch' and active
    ),
    'configuration_ready',
      exists(select 1 from vault.decrypted_secrets where name = 'ark_one_project_url')
      and exists(select 1 from vault.decrypted_secrets where name = 'ark_one_notification_worker_secret'),
    'queued', count(*) filter (where email_status = 'queued'),
    'retrying', count(*) filter (where email_status = 'retry'),
    'failed', count(*) filter (where email_status = 'failed'),
    'sent', count(*) filter (where email_status = 'sent'),
    'oldest_pending_at', min(created_at) filter (where email_status in ('queued', 'retry')),
    'last_sent_at', max(email_sent_at)
  ) into result
  from public.notifications
  where major_notification is true;

  return result;
end;
$$;

revoke all on function public.ark_notification_email_delivery_health() from public, anon;
grant execute on function public.ark_notification_email_delivery_health() to authenticated;

-- Install automatically when the two Vault entries already exist. Otherwise the
-- administrator runs ark_install_notification_email_schedule after provisioning.
do $$
begin
  if exists(select 1 from vault.decrypted_secrets where name = 'ark_one_project_url')
    and exists(select 1 from vault.decrypted_secrets where name = 'ark_one_notification_worker_secret') then
    perform public.ark_install_notification_email_schedule();
  end if;
exception when others then
  raise notice 'Notification email schedule was not installed automatically: %', sqlerrm;
end;
$$;

