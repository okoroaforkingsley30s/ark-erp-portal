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

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export function base64UrlUtf8(value: string) {
  return bytesToBase64(new TextEncoder().encode(value))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function buildMimeMessage({
  from, to, cc = '', bcc = '', subject, html, attachments = [],
  inReplyTo = '', references = '',
}: {
  from: string; to: string; cc?: string; bcc?: string; subject: string; html: string;
  attachments?: Array<{ name?: string; type?: string; data?: string }>;
  inReplyTo?: string; references?: string;
}) {
  const messageId = `<${crypto.randomUUID()}@arkone.arktechnologiesgroup.com>`
  const boundary = `arkone_${crypto.randomUUID().replaceAll('-', '')}`
  const headers = [
    `From: ${safeMailHeader(from, 320)}`,
    `Reply-To: ${safeMailHeader(from, 320)}`,
    `To: ${safeMailHeader(to, 998)}`,
    cc ? `Cc: ${safeMailHeader(cc, 998)}` : '',
    bcc ? `Bcc: ${safeMailHeader(bcc, 998)}` : '',
    `Subject: ${encodeMimeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    inReplyTo ? `In-Reply-To: ${safeMailHeader(inReplyTo, 998)}` : '',
    inReplyTo ? `References: ${safeMailHeader([references, inReplyTo].filter(Boolean).join(' '), 998)}` : '',
    'MIME-Version: 1.0',
  ].filter(Boolean)

  const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 10) : []
  if (!safeAttachments.length) {
    return {
      raw: base64UrlUtf8([...headers, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', htmlMailDocument(html)].join('\r\n')),
      messageId,
    }
  }

  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlMailDocument(html),
  ]
  let totalBytes = 0
  for (const attachment of safeAttachments) {
    const name = safeMailHeader(attachment?.name || 'attachment', 200)
    const type = safeMailHeader(attachment?.type || 'application/octet-stream', 100)
    const data = String(attachment?.data || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '')
    totalBytes += Math.ceil(data.length * 0.75)
    if (!data || totalBytes > 20 * 1024 * 1024) throw new Error('Attachments exceed the 20 MB ARK Mail limit')
    parts.push(
      `--${boundary}`,
      `Content-Type: ${type}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      data.match(/.{1,76}/g)?.join('\r\n') || data,
    )
  }
  parts.push(`--${boundary}--`, '')
  return { raw: base64UrlUtf8(parts.join('\r\n')), messageId }
}
