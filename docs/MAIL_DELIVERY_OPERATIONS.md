# ARK ONE mail delivery operations

ARK ONE uses two separate external mail paths:

1. **Official Mail** sends and replies through each user's verified ARK Google
   Workspace mailbox. The UI reports success only after Google accepts the
   message and confirms it in that mailbox's Sent folder.
2. **Workflow notification email** is queued in `public.notifications` and sent
   through the `dispatch-notification-outbox` worker every minute.

## Production notification worker setup

Keep the same random value in the Edge Function secret
`NOTIFICATION_WORKER_SECRET` and the Database Vault secret
`ark_one_notification_worker_secret`. Store the production Supabase URL in the
Vault secret `ark_one_project_url`.

Create or update the two Vault entries in the Supabase SQL Editor without
committing their values to Git:

```sql
select vault.create_secret(
  'https://PROJECT_REF.supabase.co',
  'ark_one_project_url',
  'ARK ONE Edge Function base URL'
);

select vault.create_secret(
  'THE_SAME_RANDOM_VALUE_USED_BY_THE_EDGE_FUNCTION',
  'ark_one_notification_worker_secret',
  'Authorizes the notification outbox cron worker'
);

select public.ark_install_notification_email_schedule();
select public.ark_notification_email_delivery_health();
```

If a named Vault secret already exists, update it in Dashboard > Vault rather
than creating a duplicate. The health function reveals only readiness and
delivery counts; it never returns secret values.

## Required Edge Function secrets

- `RESEND_API_KEY`
- `FROM_EMAIL`
- `PORTAL_URL`
- `NOTIFICATION_WORKER_SECRET`
- Google OAuth secrets already required by Official Mail

Deploy `gmail-send`, `gmail-reply`, `gmail-sync`, `send-notification-email`, and
`dispatch-notification-outbox` after applying this repair.

