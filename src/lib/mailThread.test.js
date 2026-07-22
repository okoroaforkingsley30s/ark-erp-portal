import { describe, expect, it } from 'vitest'
import { normalizeMailBody, splitMailThread } from './mailThread'

describe('mail thread formatting', () => {
  it('preserves readable breaks from common HTML mail', () => {
    expect(normalizeMailBody('<p>Hello team</p><ul><li>First</li><li>Second</li></ul>'))
      .toBe('Hello team\n\nFirst\nSecond')
  })

  it('separates a reply from the quoted conversation', () => {
    const result = splitMailThread('Approved.\n\nOn 21 July 2026, Jane wrote:\nPlease review this.')
    expect(result.current).toBe('Approved.')
    expect(result.quoted).toContain('Jane wrote:')
  })

  it('separates forwarded mail from the new message', () => {
    const result = splitMailThread('Please handle.\n\n---------- Forwarded message ----------\nFrom: User')
    expect(result.current).toBe('Please handle.')
    expect(result.quoted).toContain('Forwarded message')
  })
})
