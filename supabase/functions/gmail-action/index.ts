import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { googleApiError, requireEnv } from '../_shared/security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LABEL_ACTIONS: Record<string, { add?: string[]; remove?: string[] }> = {
  read: { remove: ['UNREAD'] },
  unread: { add: ['UNREAD'] },
  star: { add: ['STARRED'] },
  unstar: { remove: ['STARRED'] },
  archive: { remove: ['INBOX'] },
  unarchive: { add: ['INBOX'] },
  spam: { add: ['SPAM'], remove: ['INBOX'] },
  not_spam: { add: ['INBOX'], remove: ['SPAM'] },
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders })
}

async function refreshToken(supabase: any, connection: any) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
      refresh_token: connection.refresh_token || '',
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) throw new Error(googleApiError(payload, 'Gmail authorization expired'))
  await supabase.from('gmail_connections').update({
    access_token: payload.access_token,
    expires_at: new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString(),
  }).eq('id', connection.id).eq('user_id', connection.user_id)
  return payload.access_token
}

async function accessToken(supabase: any, connection: any) {
  const expired = !connection.access_token || (connection.expires_at && new Date(connection.expires_at).getTime() <= Date.now() + 60_000)
  return expired ? refreshToken(supabase, connection) : connection.access_token
}

async function googleRequest(supabase: any, connection: any, url: string, init: RequestInit) {
  let token = await accessToken(supabase, connection)
  let response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  if (response.status === 401) {
    token = await refreshToken(supabase, connection)
    response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  }
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(googleApiError(payload, 'Google rejected the mailbox action'))
  return payload
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const env = requireEnv([
      'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    ])
    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Authentication required' }, 401)
    const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Invalid session' }, 401)

    const body = await req.json()
    const emailId = String(body.emailId || '').trim()
    const action = String(body.action || '').trim().toLowerCase()
    if (!emailId || !action) return jsonResponse({ error: 'Email and action are required' }, 400)

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: mail } = await supabase.from('email_messages').select('*')
      .eq('id', emailId).eq('created_by', user.id).maybeSingle()
    if (!mail?.gmail_message_id) return jsonResponse({ error: 'Owned Gmail message not found' }, 404)
    const { data: connection } = await supabase.from('gmail_connections').select('*')
      .eq('user_id', user.id).eq('is_active', true)
      .order('connected_at', { ascending: false }).limit(1).maybeSingle()
    if (!connection) return jsonResponse({ error: 'No Gmail connection found' }, 404)
    const signedIn = String(user.email || '').trim().toLowerCase()
    const connected = String(connection.email || '').trim().toLowerCase()
    if (!connected.endsWith('@arktechnologiesgroup.com') || connected !== signedIn) {
      return jsonResponse({ error: 'Reconnect the same approved company mailbox used to sign in.' }, 403)
    }

    const base = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(mail.gmail_message_id)}`
    if (LABEL_ACTIONS[action]) {
      await googleRequest(supabase, connection, `${base}/modify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds: LABEL_ACTIONS[action].add || [], removeLabelIds: LABEL_ACTIONS[action].remove || [] }),
      })
    } else if (action === 'trash' || action === 'restore') {
      await googleRequest(supabase, connection, `${base}/${action === 'trash' ? 'trash' : 'untrash'}`, { method: 'POST' })
    } else if (action === 'delete') {
      await googleRequest(supabase, connection, base, { method: 'DELETE' })
      await supabase.from('email_messages').delete().eq('id', mail.id).eq('created_by', user.id)
      return jsonResponse({ success: true, action })
    } else if (action === 'snooze') {
      const until = new Date(body.until || '')
      if (Number.isNaN(until.getTime()) || until <= new Date()) return jsonResponse({ error: 'Choose a future snooze time' }, 400)
      await googleRequest(supabase, connection, `${base}/modify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      })
      await supabase.from('email_messages').update({ is_snoozed: true, snoozed_until: until.toISOString(), archived_status: true })
        .eq('id', mail.id).eq('created_by', user.id)
      return jsonResponse({ success: true, action, snoozed_until: until.toISOString() })
    } else if (action === 'unsnooze') {
      await googleRequest(supabase, connection, `${base}/modify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds: ['INBOX'] }),
      })
      await supabase.from('email_messages').update({ is_snoozed: false, snoozed_until: null, archived_status: false })
        .eq('id', mail.id).eq('created_by', user.id)
      return jsonResponse({ success: true, action })
    } else {
      return jsonResponse({ error: 'Unsupported mailbox action' }, 400)
    }

    const current = new Set(Array.isArray(mail.label_ids) ? mail.label_ids : [])
    for (const label of LABEL_ACTIONS[action]?.add || []) current.add(label)
    for (const label of LABEL_ACTIONS[action]?.remove || []) current.delete(label)
    if (action === 'trash') current.add('TRASH')
    if (action === 'restore') current.delete('TRASH')
    const labels = [...current]
    await supabase.from('email_messages').update({
      label_ids: labels,
      is_read: !labels.includes('UNREAD'),
      is_starred: labels.includes('STARRED'),
      is_spam: labels.includes('SPAM'),
      is_trash: labels.includes('TRASH'),
      archived_status: !labels.includes('INBOX') && !labels.includes('SENT') && !labels.includes('DRAFT'),
      folder: labels.includes('TRASH') ? 'trash' : labels.includes('SPAM') ? 'spam' : labels.includes('DRAFT') ? 'drafts' : labels.includes('SENT') ? 'sent' : labels.includes('INBOX') ? 'inbox' : 'all',
      updated_at: new Date().toISOString(),
    }).eq('id', mail.id).eq('created_by', user.id)

    return jsonResponse({ success: true, action })
  } catch (error) {
    console.error('gmail-action failure:', error)
    return jsonResponse({ error: 'Mailbox action failed', details: String(error instanceof Error ? error.message : error).slice(0, 500) }, 500)
  }
})
