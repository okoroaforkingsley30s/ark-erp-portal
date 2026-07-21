import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const globalRule = config.headers?.find((rule) => rule.source === '/(.*)');

if (!globalRule) {
  throw new Error('vercel.json must define a global security-header rule.');
}

const headers = new Map(
  globalRule.headers.map(({ key, value }) => [key.toLowerCase(), String(value)])
);

const requiredHeaders = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
];

for (const name of requiredHeaders) {
  if (!headers.has(name)) throw new Error(`Missing required production header: ${name}`);
}

const csp = headers.get('content-security-policy');
const requiredCspRules = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
];

for (const rule of requiredCspRules) {
  if (!csp.includes(rule)) throw new Error(`CSP is missing required rule: ${rule}`);
}

if (/script-src[^;]*'unsafe-(inline|eval)'/.test(csp)) {
  throw new Error("CSP must not permit 'unsafe-inline' or 'unsafe-eval' scripts.");
}

if (csp.includes('SUPABASE_URL') || csp.includes('*;')) {
  throw new Error('CSP contains an unresolved placeholder or unrestricted source.');
}

console.log('Production security headers and CSP are valid.');
