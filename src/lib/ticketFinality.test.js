import { describe, expect, it } from 'vitest';
import { isTicketFinallyClosed } from './ticketFinality';

describe('ticket finality', () => {
  it('treats final status in any workflow column as closed', () => {
    expect(isTicketFinallyClosed({ status: 'closed', completion_status: 'pending' })).toBe(true);
    expect(isTicketFinallyClosed({ status: 'pending_review', completion_status: 'approved' })).toBe(true);
    expect(isTicketFinallyClosed({ status: 'pending_review', review_status: 'approved' })).toBe(true);
    expect(isTicketFinallyClosed({ status: 'Resolved' })).toBe(true);
  });

  it('keeps active and rejected jobs actionable', () => {
    expect(isTicketFinallyClosed({ status: 'in_progress', completion_status: 'pending' })).toBe(false);
    expect(isTicketFinallyClosed({ status: 'rejected', completion_status: 'rejected' })).toBe(false);
  });
});
