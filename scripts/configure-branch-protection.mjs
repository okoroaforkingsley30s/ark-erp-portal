const repository = process.env.GITHUB_REPOSITORY || 'okoroaforkingsley30s/ark-erp-portal'
const branch = process.env.GITHUB_PROTECTED_BRANCH || 'main'
const token = process.env.GITHUB_TOKEN?.trim()
const api = process.env.GITHUB_API_URL || 'https://api.github.com'

if (!token) {
  console.error('GITHUB_TOKEN is required. Use a short-lived token with repository Administration write access.')
  process.exit(1)
}

if (repository !== 'okoroaforkingsley30s/ark-erp-portal' || branch !== 'main') {
  console.error(`Refusing unexpected target ${repository}:${branch}.`)
  process.exit(1)
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ark-one-branch-protection-installer',
}

async function github(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`GitHub ${response.status}: ${details}`)
  }
  return response.status === 204 ? null : response.json()
}

const requiredWorkflowPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/secret-scan.yml',
]

for (const workflowPath of requiredWorkflowPaths) {
  const encodedPath = workflowPath.split('/').map(encodeURIComponent).join('/')
  await github(`/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`)
}

const requiredChecks = [
  'Build, lint, types, tests and audit',
  'Browser journeys',
  'Supabase integration tests (optional test project)',
  'Gitleaks history scan',
]

await github(`/repos/${repository}/branches/${encodeURIComponent(branch)}/protection`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    required_status_checks: {
      strict: true,
      checks: requiredChecks.map((context) => ({ context })),
    },
    enforce_admins: true,
    required_pull_request_reviews: null,
    restrictions: null,
    required_conversation_resolution: true,
    required_linear_history: false,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_signatures: false,
    lock_branch: false,
    allow_fork_syncing: false,
  }),
})

const protection = await github(`/repos/${repository}/branches/${encodeURIComponent(branch)}/protection`)
const activeChecks = protection.required_status_checks?.checks?.map(({ context }) => context) || []
const missingChecks = requiredChecks.filter((check) => !activeChecks.includes(check))

if (missingChecks.length) {
  throw new Error(`Protection verification failed; missing checks: ${missingChecks.join(', ')}`)
}

console.log(`Protected ${repository}:${branch} with ${activeChecks.length} required checks.`)
