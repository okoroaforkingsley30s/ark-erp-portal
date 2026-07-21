import { createClient } from '@supabase/supabase-js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal'])

function readEnvironment() {
  const url = process.env.SUPABASE_TEST_URL?.trim()
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY?.trim()
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim()

  if (!url || !anonKey || !serviceRoleKey) {
    return {
      enabled: false,
      reason: 'SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, and SUPABASE_TEST_SERVICE_ROLE_KEY are required',
    }
  }

  let hostname
  try {
    hostname = new URL(url).hostname
  } catch {
    return { enabled: false, reason: 'SUPABASE_TEST_URL is not a valid URL' }
  }

  const remoteAllowed = process.env.ARK_ALLOW_REMOTE_INTEGRATION_TESTS === 'true'
  if (!LOCAL_HOSTS.has(hostname) && !remoteAllowed) {
    return {
      enabled: false,
      reason: 'Remote integration tests require ARK_ALLOW_REMOTE_INTEGRATION_TESTS=true',
    }
  }

  return { enabled: true, url, anonKey, serviceRoleKey }
}

export const integrationEnvironment = readEnvironment()

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
}

export function createAdminClient() {
  const environment = integrationEnvironment
  if (!environment.enabled) throw new Error(environment.reason)
  return createClient(environment.url, environment.serviceRoleKey, clientOptions)
}

export function createAnonClient() {
  const environment = integrationEnvironment
  if (!environment.enabled) throw new Error(environment.reason)
  return createClient(environment.url, environment.anonKey, clientOptions)
}

export async function createUnregisteredIdentity(admin, runId) {
  const email = `${runId}-registration@integration.invalid`
  const password = `Ark-${crypto.randomUUID()}-aA1!`
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error
  const client = createAnonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, email, client }
}

export async function invokeFunction(functionName, { accessToken, body = {} } = {}) {
  const environment = integrationEnvironment
  if (!environment.enabled) throw new Error(environment.reason)
  return fetch(`${environment.url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: environment.anonKey,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

export async function createTestIdentity(admin, role, runId) {
  const email = `${runId}-${role}@integration.invalid`
  const password = `Ark-${crypto.randomUUID()}-aA1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Integration ${role}` },
  })
  if (error) throw error

  const user = data.user
  const { error: profileError } = await admin.from('users').upsert({
    id: user.id,
    auth_user_id: user.id,
    email,
    full_name: `Integration ${role}`,
    role,
    status: 'approved',
    approval_status: 'approved',
    account_status: 'active',
    is_approved: true,
  })
  if (profileError) throw profileError

  const client = createAnonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: user.id, email, client }
}

export async function cleanupTestRun(admin, runId, identities, objectPaths = []) {
  if (objectPaths.length) {
    await admin.storage.from('private-documents').remove(objectPaths)
  }
  await admin.from('sensitive_document_registry').delete().like('object_path', `%/${runId}/%`)
  await admin.from('notifications').delete().contains('data', { integration_run: runId })

  const ids = identities.map(({ id }) => id)
  if (ids.length) {
    await admin.from('user_profiles').delete().in('auth_user_id', ids)
    await admin.from('users').delete().in('auth_user_id', ids)
    await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)))
  }
}
