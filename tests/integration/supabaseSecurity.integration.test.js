import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cleanupTestRun,
  createAdminClient,
  createAnonClient,
  createTestIdentity,
  integrationEnvironment,
} from './supabaseTestHarness.js'

const describeSupabase = integrationEnvironment.enabled ? describe : describe.skip

describeSupabase('Supabase authorization and transaction integration', () => {
  const runId = `ark_it_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
  const identities = []
  const objectPaths = []
  let admin
  let financeUser
  let engineerUser

  beforeAll(async () => {
    admin = createAdminClient()
    financeUser = await createTestIdentity(admin, 'finance', runId)
    identities.push(financeUser)
    engineerUser = await createTestIdentity(admin, 'engineer', runId)
    identities.push(engineerUser)
  })

  afterAll(async () => {
    if (admin) await cleanupTestRun(admin, runId, identities, objectPaths)
  })

  it('rejects anonymous execution of a privileged inventory RPC', async () => {
    const anon = createAnonClient()
    const { error } = await anon.rpc('inventory_transition_dispatch_fund', {
      p_fund_request_id: crypto.randomUUID(),
      p_action: 'approve',
      p_approved_amount: 1,
      p_reason: 'integration authorization check',
    })

    expect(error).toBeTruthy()
  })

  it('isolates notification rows by the authenticated recipient', async () => {
    const rows = [financeUser, engineerUser].map((identity) => ({
      user_email: identity.email,
      recipient_email: identity.email,
      title: `Integration ${runId}`,
      message_body: 'RLS isolation test',
      data: { integration_run: runId, owner: identity.id },
    }))
    const { error: insertError } = await admin.from('notifications').insert(rows)
    expect(insertError).toBeNull()

    const { data: financeRows, error: financeError } = await financeUser.client
      .from('notifications').select('recipient_email,data').contains('data', { integration_run: runId })
    const { data: engineerRows, error: engineerError } = await engineerUser.client
      .from('notifications').select('recipient_email,data').contains('data', { integration_run: runId })

    expect(financeError).toBeNull()
    expect(engineerError).toBeNull()
    expect(financeRows).toHaveLength(1)
    expect(financeRows[0].recipient_email).toBe(financeUser.email)
    expect(engineerRows).toHaveLength(1)
    expect(engineerRows[0].recipient_email).toBe(engineerUser.email)
  })

  it('enforces private storage path ownership and read isolation', async () => {
    const ownerPath = `${financeUser.id}/${runId}/evidence.png`
    objectPaths.push(ownerPath)
    const body = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

    const { error: ownerUploadError } = await financeUser.client.storage
      .from('private-documents').upload(ownerPath, body, { contentType: 'image/png' })
    expect(ownerUploadError).toBeNull()

    const foreignPath = `${financeUser.id}/${runId}/foreign.png`
    const { error: foreignUploadError } = await engineerUser.client.storage
      .from('private-documents').upload(foreignPath, body, { contentType: 'image/png' })
    expect(foreignUploadError).toBeTruthy()

    const { error: ownerDownloadError } = await financeUser.client.storage
      .from('private-documents').download(ownerPath)
    const { error: foreignDownloadError } = await engineerUser.client.storage
      .from('private-documents').download(ownerPath)
    expect(ownerDownloadError).toBeNull()
    expect(foreignDownloadError).toBeTruthy()
  })

  it('rolls back a journal header and first line when a later line fails', async () => {
    const narration = `Integration rollback ${runId}`
    const { data: accounts, error: accountError } = await admin
      .from('finance_accounts').select('id').eq('is_active', true).limit(1)
    expect(accountError).toBeNull()
    expect(accounts?.length, 'Seed at least one active finance account in the test database').toBeGreaterThan(0)

    const { error: rpcError } = await financeUser.client.rpc('finance_create_journal_transaction', {
      p_journal_date: new Date().toISOString().slice(0, 10),
      p_narration: narration,
      p_lines: [
        { account_id: accounts[0].id, debit: 100, credit: 0, description: 'inserted before failure' },
        { account_id: crypto.randomUUID(), debit: 0, credit: 100, description: 'invalid account' },
      ],
    })
    expect(rpcError).toBeTruthy()

    const { data: journals, error: lookupError } = await admin
      .from('finance_journals').select('id').eq('narration', narration)
    expect(lookupError).toBeNull()
    expect(journals).toEqual([])
  })
})

if (!integrationEnvironment.enabled) {
  describe('Supabase integration environment', () => {
    it.skip(integrationEnvironment.reason, () => {})
  })
}
