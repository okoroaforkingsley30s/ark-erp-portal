import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildMimeMessage } from '../_shared/security.ts'

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

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function refreshGoogleAccessToken(connection: Record<string, unknown>) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const refreshToken = String(connection.refresh_token || '')
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google notification sender configuration is incomplete')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google token refresh returned ${response.status}`)
  }
  return { accessToken: String(payload.access_token), expiresIn: Number(payload.expires_in || 3600) }
}

async function sendWithGmail(accessToken: string, sender: string, recipient: string, subject: string, html: string) {
  const rawMessage = [
    `From: ARK ONE Notifications <${sender}>`,
    `To: ${recipient}`,
    `Subject: =?UTF-8?B?${encodeBase64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64(html),
  ].join('\r\n')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodeBase64Url(rawMessage) }),
  })
  if (!response.ok) throw new Error(`Gmail API returned ${response.status}`)
}

Deno.serve(async (request) => {
  const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET')
  const authorization = request.headers.get('authorization') || ''

  if (!workerSecret || authorization !== `Bearer ${workerSecret}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const senderEmail = String(Deno.env.get('NOTIFICATION_SENDER_EMAIL') || 'no-reply@arktechnologiesgroup.com')
    .trim().toLowerCase()
  const portalUrl = Deno.env.get('PORTAL_URL')

  if (!supabaseUrl || !serviceRoleKey || !portalUrl) {
    return jsonResponse({ error: 'Notification worker configuration is incomplete' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: connection, error: connectionError } = await admin
    .from('gmail_connections')
    .select('id, user_id, email, refresh_token')
    .eq('email', senderEmail)
    .eq('provider', 'google')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (connectionError || !connection?.refresh_token) {
    return jsonResponse({ error: 'Active Google notification sender connection was not found' }, 500)
  }

  let googleToken
  try {
    googleToken = await refreshGoogleAccessToken(connection)
    await admin.from('gmail_connections').update({
      access_token: googleToken.accessToken,
      expires_at: new Date(Date.now() + googleToken.expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id)
  } catch (tokenError) {
    return jsonResponse({ error: String(tokenError) }, 502)
  }
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
      await sendWithGmail(
        googleToken.accessToken,
        senderEmail,
        recipient,
        String(item.title || 'ARK ONE notification').slice(0, 160),
        `<p>${escapeHtml(message).replaceAll('\n', '<br>')}</p><p><a href="${escapeHtml(link)}">Open ARK ONE</a></p>`,
      )

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

  // The same audited Google worker also delivers user-scheduled Official Mail.
  // This keeps all outbound mail on approved company Gmail identities.
  const { data: scheduledRows } = await admin.from('ark_scheduled_emails')
    .select('*').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString())
    .lt('attempts', 5).order('scheduled_at', { ascending: true }).limit(10)

  let scheduledSent = 0
  let scheduledFailed = 0
  for (const mail of scheduledRows || []) {
    const attempts = Number(mail.attempts || 0) + 1
    const { data: claimed } = await admin.from('ark_scheduled_emails')
      .update({ status: 'processing', attempts, updated_at: new Date().toISOString() })
      .eq('id', mail.id).eq('status', 'scheduled').select('id').maybeSingle()
    if (!claimed) continue
    try {
      const { data: senderConnection } = await admin.from('gmail_connections').select('*')
        .eq('user_id', mail.user_id).eq('email', mail.sender_email).eq('is_active', true)
        .order('connected_at', { ascending: false }).limit(1).maybeSingle()
      if (!senderConnection?.refresh_token) throw new Error('Sender Gmail connection is unavailable')
      const token = await refreshGoogleAccessToken(senderConnection)
      await admin.from('gmail_connections').update({
        access_token: token.accessToken,
        expires_at: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', senderConnection.id)
      const mime = buildMimeMessage({
        from: mail.sender_email,
        to: mail.recipient_email,
        cc: mail.cc || '',
        bcc: mail.bcc || '',
        subject: mail.subject,
        html: mail.message_body,
        attachments: Array.isArray(mail.attachments) ? mail.attachments : [],
      })
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: mime.raw }),
      })
      const gmail = await response.json()
      if (!response.ok) throw new Error(`Gmail API returned ${response.status}`)
      await admin.from('ark_scheduled_emails').update({
        status: 'sent', gmail_message_id: gmail.id, gmail_thread_id: gmail.threadId,
        sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null,
      }).eq('id', mail.id)
      await admin.from('email_messages').insert({
        gmail_message_id: gmail.id, gmail_thread_id: gmail.threadId,
        sender_email: mail.sender_email, recipient_email: mail.recipient_email,
        cc: mail.cc, bcc: mail.bcc, subject: mail.subject, message_body: mail.message_body,
        snippet: String(mail.message_body).replace(/<[^>]*>/g, '').slice(0, 200),
        direction: 'sent', email_status: 'Sent', is_sent: true, is_read: true,
        folder: 'sent', label_ids: ['SENT'], attachments: mail.attachments,
        received_at: new Date().toISOString(), synced_at: new Date().toISOString(), created_by: mail.user_id,
      })
      scheduledSent += 1
    } catch (scheduledError) {
      await admin.from('ark_scheduled_emails').update({
        status: attempts >= 5 ? 'failed' : 'scheduled',
        last_error: String(scheduledError).slice(0, 1000), updated_at: new Date().toISOString(),
      }).eq('id', mail.id)
      scheduledFailed += 1
    }
  }

  let mobilePush: unknown = null
  try {
    const mobileResponse = await fetch(`${supabaseUrl}/functions/v1/dispatch-mobile-push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'notification-outbox' }),
    })
    mobilePush = await mobileResponse.json()
    if (!mobileResponse.ok) {
      console.error('Mobile push worker returned an error', mobilePush)
    }
  } catch (mobileError) {
    mobilePush = { error: String(mobileError) }
  }
  return jsonResponse({
    processed: sent + failed,
    sent,
    failed,
    scheduled_processed: scheduledSent + scheduledFailed,
    scheduled_sent: scheduledSent,
    scheduled_failed: scheduledFailed,
    mobile_push: mobilePush,
  })
})
