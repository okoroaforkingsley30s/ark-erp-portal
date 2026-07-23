import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { importPKCS8, SignJWT } from 'npm:jose@6.1.0'

const BATCH_SIZE = 50

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function decodeCredential() {
  const encoded = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_BASE64')
  if (!encoded) throw new Error('Firebase service account secret is missing')
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

async function firebaseAccessToken(credential: Record<string, string>) {
  const now = Math.floor(Date.now() / 1000)
  const key = await importPKCS8(credential.private_key, 'RS256')
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credential.client_email)
    .setSubject(credential.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) {
    throw new Error(`Firebase OAuth returned ${response.status}`)
  }
  return String(payload.access_token)
}

Deno.serve(async (request) => {
  const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET')
  if (!workerSecret || request.headers.get('authorization') !== `Bearer ${workerSecret}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase configuration is incomplete' }, 500)
  }

  let credential
  let accessToken
  try {
    credential = decodeCredential()
    accessToken = await firebaseAccessToken(credential)
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: rows, error } = await admin
    .from('ark_mobile_push_outbox')
    .select('*')
    .in('status', ['queued', 'retry'])
    .lte('next_attempt_at', new Date().toISOString())
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return jsonResponse({ error: 'Unable to load mobile push queue' }, 500)

  const deviceIds = [...new Set((rows || []).map((row) => row.mobile_device_id))]
  const { data: devices } = deviceIds.length
    ? await admin.from('ark_mobile_devices').select('*').in('id', deviceIds).eq('active', true)
    : { data: [] }
  const devicesById = new Map((devices || []).map((device) => [device.id, device]))

  let sent = 0
  let failed = 0

  for (const row of rows || []) {
    const device = devicesById.get(row.mobile_device_id)
    const attempts = Number(row.attempts || 0) + 1
    if (!device?.push_token) {
      await admin.from('ark_mobile_push_outbox').update({
        status: 'failed', attempts, last_error: 'Active mobile device was not found', updated_at: new Date().toISOString(),
      }).eq('id', row.id)
      failed += 1
      continue
    }

    await admin.from('ark_mobile_push_outbox').update({
      status: 'processing', attempts, last_error: null, updated_at: new Date().toISOString(),
    }).eq('id', row.id)

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${credential.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: device.push_token,
            notification: {
              title: String(row.title).slice(0, 160),
              body: String(row.message).slice(0, 500),
            },
            data: {
              link: String(row.link || '/notifications'),
              notification_id: String(row.notification_id),
              ...Object.fromEntries(
                Object.entries(row.payload || {}).map(([key, value]) => [key, String(value)])
              ),
            },
            android: {
              priority: 'high',
              notification: {
                channel_id: device.sound_key || 'ark_default',
                icon: 'ic_stat_ark_one',
                color: '#ff5a00',
                default_vibrate_timings: true,
              },
            },
          },
        }),
      },
    )

    const result = await response.json()
    if (response.ok) {
      await admin.from('ark_mobile_push_outbox').update({
        status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', row.id)
      sent += 1
      continue
    }

    const errorText = JSON.stringify(result).slice(0, 1000)
    const invalidToken = response.status === 404 || errorText.includes('UNREGISTERED')
    if (invalidToken) {
      await admin.from('ark_mobile_devices').update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', device.id)
    }
    await admin.from('ark_mobile_push_outbox').update({
      status: attempts >= 5 || invalidToken ? 'failed' : 'retry',
      next_attempt_at: new Date(Date.now() + Math.min(attempts * 60000, 300000)).toISOString(),
      last_error: errorText,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    failed += 1
  }

  return jsonResponse({ processed: sent + failed, sent, failed })
})
