import { describe, expect, it } from 'vitest';
import {
  canTicketBeResolvedRemotely,
  getTicketWorkflowDisplayStatus,
  isTicketFinallyClosed,
  isTicketPendingCompletionReview,
} from './ticketWorkflowState';

describe('ticket workflow final closure', () => {
  it('treats an approved completion as closed even when a stale status remains', () => {
    const ticket = { status: 'in_progress', completion_status: 'approved' };

    expect(isTicketFinallyClosed(ticket)).toBe(true);
    expect(getTicketWorkflowDisplayStatus(ticket)).toBe('closed');
    expect(isTicketPendingCompletionReview(ticket)).toBe(false);
  });

  it('does not treat a closed ticket with stale pending completion as reviewable', () => {
    const ticket = { status: 'closed', completion_status: 'pending' };

    expect(isTicketFinallyClosed(ticket)).toBe(true);
    expect(isTicketPendingCompletionReview(ticket)).toBe(false);
  });

  it('recognizes only a genuine submitted completion as pending review', () => {
    const ticket = { status: 'pending_review', completion_status: 'pending' };

    expect(isTicketFinallyClosed(ticket)).toBe(false);
    expect(isTicketPendingCompletionReview(ticket)).toBe(true);
  });

  it('allows remote resolution only before field or part work starts', () => {
    expect(canTicketBeResolvedRemotely({ status: 'assigned', part_request_status: 'none' })).toBe(true);
    expect(canTicketBeResolvedRemotely({ status: 'accepted', part_request_status: 'none' })).toBe(false);
    expect(canTicketBeResolvedRemotely({ status: 'open', part_request_status: 'pending_operations' })).toBe(false);
    expect(canTicketBeResolvedRemotely({ status: 'closed', part_request_status: 'none' })).toBe(false);
  });
});
