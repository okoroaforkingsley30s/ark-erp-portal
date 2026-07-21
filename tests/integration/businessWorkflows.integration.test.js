import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cleanupTestRun,
  createAdminClient,
  createTestIdentity,
  createUnregisteredIdentity,
  integrationEnvironment,
  invokeFunction,
} from './supabaseTestHarness.js'

const describeSupabase = integrationEnvironment.enabled ? describe : describe.skip

describeSupabase('critical business workflow boundaries', () => {
  const runId = `ark_flow_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
  const identities = []
  let admin
  let financeUser
  let engineerUser
  let unregisteredUser

  beforeAll(async () => {
    admin = createAdminClient()
    financeUser = await createTestIdentity(admin, 'finance', runId)
    identities.push(financeUser)
    engineerUser = await createTestIdentity(admin, 'engineer', runId)
    identities.push(engineerUser)
    unregisteredUser = await createUnregisteredIdentity(admin, runId)
    identities.push(unregisteredUser)
  })

  afterAll(async () => {
    if (admin) await cleanupTestRun(admin, runId, identities)
  })

  it('Finance rejects maker attempts to perform checker actions', async () => {
    const { error } = await financeUser.client.rpc('finance_transition_journal', {
      p_journal_id: crypto.randomUUID(),
      p_action: 'approve',
      p_reason: 'maker-checker integration test',
    })

    expect(error).toBeTruthy()
    expect(error.message).toMatch(/not authorized|approve|review/i)
  })

  it('Inventory rejects an engineer attempting an inventory-only operation', async () => {
    const { error } = await engineerUser.client.rpc('inventory_dispatch_stock_request', {
      p_part_request_id: crypto.randomUUID(),
      p_stock_item_id: crypto.randomUUID(),
    })

    expect(error).toBeTruthy()
    expect(error.message).toMatch(/inventory|authoriz|not found/i)
  })

  it('RR rejects invalid workflow transitions without creating a repair job', async () => {
    const recordId = crypto.randomUUID()
    const { error } = await engineerUser.client.rpc('rr_transition_repair_job', {
      p_record_id: recordId,
      p_record_type: 'repair_job',
      p_action: 'qa_pass',
    })
    expect(error).toBeTruthy()

    const { data, error: lookupError } = await admin
      .from('repair_jobs').select('id').eq('id', recordId)
    expect(lookupError).toBeNull()
    expect(data).toEqual([])
  })

  it('Dispatch funding rejects non-finance actors before reading the request', async () => {
    const { error } = await engineerUser.client.rpc('inventory_transition_dispatch_fund', {
      p_fund_request_id: crypto.randomUUID(),
      p_action: 'approve',
      p_approved_amount: 50,
      p_finance_note: 'must not be accepted',
    })

    expect(error).toBeTruthy()
    expect(error.message).toMatch(/finance authorization/i)
  })

  it('Authentication blocks self-registration and requires an administrator invitation', async () => {
    const { error } = await unregisteredUser.client.rpc('ark_register_current_user', {
      p_full_name: 'Unauthorized Registration User',
    })
    expect(error).toBeTruthy()

    const { data: rows, error: lookupError } = await admin.from('users')
      .select('id').eq('auth_user_id', unregisteredUser.id)
    expect(lookupError).toBeNull()
    expect(rows).toEqual([])
  })

  it('Invitation and Gmail functions enforce caller identity and account binding', async () => {
    const { data: sessionData } = await engineerUser.client.auth.getSession()
    const accessToken = sessionData.session?.access_token
    expect(accessToken).toBeTruthy()

    const inviteResponse = await invokeFunction('invite-user', {
      accessToken,
      body: { email: `${runId}-invite@integration.invalid`, role: 'system_admin' },
    })
    expect(inviteResponse.status).toBe(403)

    const gmailResponse = await invokeFunction('gmail-send', {
      accessToken,
      body: { to: engineerUser.email, subject: 'Binding test', body: 'Do not send' },
    })
    expect(gmailResponse.status).toBe(404)
    expect(await gmailResponse.json()).toMatchObject({ error: 'No Gmail connected' })
  })
})
