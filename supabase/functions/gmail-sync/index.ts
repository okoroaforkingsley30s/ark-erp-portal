import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { googleApiError, requireEnv } from '../_shared/security.ts'

const ALLOWED_DOMAIN = '@arktechnologiesgroup.com'
const MAX_MESSAGES = 100
const FETCH_BATCH_SIZE = 10

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders })
}

function decodeBase64Url(value = '') {
  if (!value) return ''
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    const bytes = Uint8Array.from(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
      (char) => char.charCodeAt(0),
    )
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function header(headers: Array<{ name?: string; value?: string }>, name: string) {
  return headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function messageBody(part: any): string {
  if (!part) return ''
  if (part.body?.data && ['text/html', 'text/plain'].includes(part.mimeType)) {
    return decodeBase64Url(part.body.data)
  }
  const parts = Array.isArray(part.parts) ? part.parts : []
  const html = parts.find((item: any) => item.mimeType === 'text/html')
  const plain = parts.find((item: any) => item.mimeType === 'text/plain')
  return messageBody(html) || messageBody(plain) || parts.map(messageBody).find(Boolean) || ''
}

function messageAttachments(part: any, output: any[] = []): any[] {
  if (!part) return output
  const attachmentId = part.body?.attachmentId
  const filename = String(part.filename || '').trim()
  if (attachmentId && filename) {
    output.push({
      attachment_id: attachmentId,
      filename,
      mime_type: part.mimeType || 'application/octet-stream',
      size: Number(part.body?.size || 0),
    })
  }
  for (const child of Array.isArray(part.parts) ? part.parts : []) {
    messageAttachments(child, output)
  }
  return output
}

async function getAccessToken(supabase: any, connection: any, forceRefresh = false) {
  const expiresSoon = connection.expires_at &&
    new Date(connection.expires_at).getTime() <= Date.now() + 60_000
  if (!forceRefresh && !expiresSoon) return connection.access_token
  if (!connection.refresh_token) throw new Error('Gmail connection must be renewed')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tokens = await response.json()
  if (!response.ok || !tokens.access_token) {
    throw new Error(googleApiError(tokens, 'Unable to refresh Gmail access'))
  }

  await supabase.from('gmail_connections').update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
  }).eq('id', connection.id).eq('user_id', connection.user_id)
  return tokens.access_token
}

async function gmailFetch(url: string, accessToken: string, attempt = 0): Promise<Response> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if ((response.status === 429 || response.status >= 500) && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)))
    return gmailFetch(url, accessToken, attempt + 1)
  }
  return response
}

async function listMessages(supabase: any, connection: any, pageToken = '', query = '') {
  const params = new URLSearchParams({ maxResults: String(MAX_MESSAGES), includeSpamTrash: 'true' })
  if (pageToken) params.set('pageToken', pageToken)
  if (query) params.set('q', query)
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`
  let accessToken = await getAccessToken(supabase, connection)
  let response = await gmailFetch(url, accessToken)

  if (response.status === 401) {
    accessToken = await getAccessToken(supabase, connection, true)
    response = await gmailFetch(url, accessToken)
  }

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(googleApiError(payload, 'Gmail message list failed'))
  }
  return {
    accessToken,
    messages: Array.isArray(payload.messages) ? payload.messages : [],
    nextPageToken: String(payload.nextPageToken || ''),
    resultSizeEstimate: Number(payload.resultSizeEstimate || 0),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const env = requireEnv([
      'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    ])
    const supabaseUrl = env.SUPABASE_URL
    const anonKey = env.SUPABASE_ANON_KEY
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Authentication required' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Invalid session' }, 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: connection, error: connectionError } = await supabase
      .from('gmail_connections').select('*')
      .eq('user_id', user.id).eq('is_active', true)
      .order('connected_at', { ascending: false }).limit(1).maybeSingle()
    if (connectionError) return jsonResponse({ error: 'Unable to load Gmail connection' }, 500)
    if (!connection) return jsonResponse({ error: 'No Gmail connection found' }, 404)

    const connectedEmail = String(connection.email || '').trim().toLowerCase()
    const signedInEmail = String(user.email || '').trim().toLowerCase()
    if (!connectedEmail.endsWith(ALLOWED_DOMAIN) || connectedEmail !== signedInEmail) {
      return jsonResponse({
        error: 'Reconnect the same approved ARK Technologies email used to sign in.',
      }, 403)
    }

    const requestBody = await req.json().catch(() => ({}))
    const pageToken = String(requestBody.pageToken || connection.next_page_token || '')
    const query = String(requestBody.query || '').trim().slice(0, 500)
    const { accessToken, messages: summaries, nextPageToken, resultSizeEstimate } =
      await listMessages(supabase, connection, pageToken, query)
    const rows = []
    const failures: Array<{ id: string; status: number }> = []

    for (let offset = 0; offset < summaries.length; offset += FETCH_BATCH_SIZE) {
      const batch = summaries.slice(offset, offset + FETCH_BATCH_SIZE)
      const messages = await Promise.all(batch.map(async (summary: { id: string }) => {
        const response = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(summary.id)}?format=full`,
          accessToken,
        )
        if (!response.ok) {
          failures.push({ id: summary.id, status: response.status })
          return null
        }
        return response.json()
      }))

      for (const message of messages.filter(Boolean)) {
        const headers = message.payload?.headers || []
        const labels: string[] = message.labelIds || []
        const isSent = labels.includes('SENT')
        const isDraft = labels.includes('DRAFT')
        const isTrash = labels.includes('TRASH')
        rows.push({
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId,
          sender_email: header(headers, 'From'),
          recipient_email: header(headers, 'To'),
          cc: header(headers, 'Cc'),
          subject: header(headers, 'Subject') || '(No subject)',
          snippet: message.snippet || '',
          message_body: messageBody(message.payload),
          attachments: messageAttachments(message.payload),
          received_at: new Date(Number(message.internalDate || Date.now())).toISOString(),
          direction: isSent ? 'sent' : 'received',
          email_status: isDraft ? 'Draft' : isSent ? 'Sent' : 'Received',
          is_read: !labels.includes('UNREAD'),
          is_sent: isSent,
          is_draft: isDraft,
          archived_status: !labels.includes('INBOX') && !isSent && !isDraft,
          folder: isTrash ? 'trash' : isDraft ? 'drafts' : isSent ? 'sent' : 'inbox',
          raw_headers: headers,
          label_ids: labels,
          is_starred: labels.includes('STARRED'),
          is_snoozed: false,
          is_spam: labels.includes('SPAM'),
          is_trash: labels.includes('TRASH'),
          synced_at: new Date().toISOString(),
          created_by: user.id,
        })
      }
    }

    if (rows.length) {
      const { error: saveError } = await supabase
        .from('email_messages')
        .upsert(rows, { onConflict: 'created_by,gmail_message_id' })
      if (saveError) {
        console.error('Gmail message save failed:', saveError)
        return jsonResponse({
          error: 'Messages were fetched but could not be saved',
          details: String(saveError.message || saveError).slice(0, 500),
        }, 500)
      }
    }

    await supabase.from('gmail_connections').update({
      next_page_token: nextPageToken || null,
      initial_sync_complete: !nextPageToken,
      last_synced_at: new Date().toISOString(),
      last_sync_error: failures.length ? `${failures.length} message(s) could not be fetched` : null,
    }).eq('id', connection.id).eq('user_id', user.id)

    return jsonResponse({
      success: true,
      synced: rows.length,
      failed: failures,
      next_page_token: nextPageToken || null,
      initial_sync_complete: !nextPageToken,
      result_size_estimate: resultSizeEstimate,
    })
  } catch (error) {
    console.error('gmail-sync failure:', error)
    return jsonResponse({
      error: 'Unable to synchronize Gmail',
      details: String(error instanceof Error ? error.message : error).slice(0, 500),
    }, 500)
  }
})
