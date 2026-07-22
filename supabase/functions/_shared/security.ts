export function requireEnv(names: string[]) {
  const values: Record<string, string> = {}
  const missing: string[] = []
  for (const name of names) {
    const value = Deno.env.get(name)?.trim()
    if (!value) missing.push(name)
    else values[name] = value
  }
  if (missing.length) throw new Error(`Missing server configuration: ${missing.join(', ')}`)
  return values
}

export function safeMailHeader(value: unknown, maxLength = 998) {
  const text = String(value ?? '').trim()
  if (!text || /[\r\n]/.test(text) || text.length > maxLength) {
    throw new Error('Invalid email header value')
  }
  return text
}

export function parseEmailList(value: unknown, required = false) {
  const text = String(value ?? '').trim()
  if (!text && !required) return ''
  const emails = text.split(',').map((item) => safeMailHeader(item, 320).toLowerCase())
  if (!emails.length || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Invalid email recipient')
  }
  return emails.join(', ')
}

export function encodeMimeHeader(value: unknown) {
  const text = safeMailHeader(value, 300)
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `=?UTF-8?B?${btoa(binary)}?=`
}

export function htmlMailDocument(value: unknown) {
  const body = String(value || '')
  return `<!doctype html><html><head><meta charset="UTF-8"></head><body>${body}</body></html>`
}

export function googleApiError(payload: unknown, fallback: string) {
  const candidate = payload as { error?: { message?: string }; message?: string }
  return String(candidate?.error?.message || candidate?.message || fallback).slice(0, 500)
}
