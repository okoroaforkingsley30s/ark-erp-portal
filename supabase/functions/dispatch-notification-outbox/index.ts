import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH_SIZE = 25

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET')
  const authorization = request.headers.get('authorization') || ''

  if (!workerSecret || authorization !== `Bearer ${workerSecret}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('FROM_EMAIL')
  const portalUrl = Deno.env.get('PORTAL_URL')

  if (!supabaseUrl || !serviceRoleKey || !resendKey || !fromEmail || !portalUrl) {
    return jsonResponse({ error: 'Notification worker configuration is incomplete' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: queued, error } = await admin
    .from('notifications')
    .select('id, recipient_email, user_email, title, message, message_body, link, email_attempts')
    .eq('major_notification', true)
    .in('email_status', ['queued', 'retry'])
    .lt('email_attempts', 5)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return jsonResponse({ error: 'Unable to load notification outbox' }, 500)

  let sent = 0
  let failed = 0

  for (const item of queued || []) {
    const attempts = Number(item.email_attempts || 0) + 1
    const { data: claimed } = await admin
      .from('notifications')
      .update({ email_status: 'processing', email_attempts: attempts, email_last_error: null })
      .eq('id', item.id)
      .in('email_status', ['queued', 'retry'])
      .select('id')
      .maybeSingle()

    if (!claimed) continue

    const recipient = String(item.recipient_email || item.user_email || '').trim().toLowerCase()
    const message = String(item.message || item.message_body || '').trim()
    const cleanPath = String(item.link || '/notifications').startsWith('/')
      ? String(item.link || '/notifications')
      : `/${String(item.link || 'notifications')}`
    const link = `${portalUrl.replace(/\/$/, '')}/#${cleanPath}`

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          subject: String(item.title || 'ARK ONE notification').slice(0, 160),
          html: `<p>${escapeHtml(message).replaceAll('\n', '<br>')}</p><p><a href="${escapeHtml(link)}">Open ARK ONE</a></p>`,
        }),
      })

      if (!response.ok) throw new Error(`Mail provider returned ${response.status}`)

      await admin.from('notifications').update({
        email_status: 'sent', email_sent_at: new Date().toISOString(), email_last_error: null,
      }).eq('id', item.id)
      sent += 1
    } catch (sendError) {
      await admin.from('notifications').update({
        email_status: attempts >= 5 ? 'failed' : 'retry',
        email_last_error: String(sendError).slice(0, 1000),
      }).eq('id', item.id)
      failed += 1
    }
  }

  return jsonResponse({ processed: sent + failed, sent, failed })
})
