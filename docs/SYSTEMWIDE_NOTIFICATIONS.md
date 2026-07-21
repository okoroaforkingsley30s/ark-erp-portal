# System-wide workflow notifications

Migration `202607200023_systemwide_notification_outbox.sql` installs a common
notification emitter for operational workflow tables.

Routine status changes create in-app notifications only. Major transitions
(approval, rejection, assignment, escalation, dispatch, receipt, payment,
completion and closure) also enter the email outbox. Duplicate button presses
do not create duplicate notifications, while a genuine later workflow cycle
can notify recipients again.

Recipients are limited to active, approved ARK ONE users who are either named
participants in the record or members of the department responsible for the
current stage. The actor is excluded.

## Email worker

The `dispatch-notification-outbox` Edge Function delivers queued major-event
email and records `sent`, `retry`, or `failed` status. Deploy it without the
Supabase JWT gateway because it authenticates using the dedicated
`NOTIFICATION_WORKER_SECRET` header. Configure these server-only secrets:

- `NOTIFICATION_WORKER_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `PORTAL_URL`

Invoke the worker on a one-minute schedule using Supabase Cron/Vault. Never put
the worker secret, service-role key, or Resend key in frontend environment
variables.

Local Docker testing validates in-app delivery without external email. Email
delivery requires network access and valid mail-provider credentials.
