const HTML_BREAKS = [
  [/<br\s*\/?>/gi, '\n'],
  [/<\/p>/gi, '\n\n'],
  [/<\/div>/gi, '\n'],
  [/<\/li>/gi, '\n'],
  [/<\/tr>/gi, '\n'],
  [/<\/t[dh]>/gi, '  '],
  [/<\/h[1-6]>/gi, '\n\n'],
]

export function normalizeMailBody(value = '') {
  let text = String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')

  for (const [pattern, replacement] of HTML_BREAKS) {
    text = text.replace(pattern, replacement)
  }

  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const QUOTE_MARKERS = [
  /^\s*-{2,}\s*Forwarded message\s*-{2,}\s*$/im,
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^\s*On .+ wrote:\s*$/im,
  /^\s*From:\s*.+\n\s*(?:Sent|Date):\s*.+\n\s*To:\s*.+\n\s*Subject:\s*.+$/im,
]

export function splitMailThread(value = '') {
  const body = normalizeMailBody(value)
  if (!body) return { current: '', quoted: '' }

  let splitAt = -1
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(body)
    if (match && match.index > 0 && (splitAt === -1 || match.index < splitAt)) {
      splitAt = match.index
    }
  }

  if (splitAt === -1) return { current: body, quoted: '' }

  return {
    current: body.slice(0, splitAt).trim(),
    quoted: body.slice(splitAt).trim(),
  }
}

