const FINAL_TICKET_STATUSES = new Set([
  'approved',
  'closed',
  'completed',
  'resolved',
]);

export const normalizeTicketWorkflowStatus = (value) =>
  String(value || '').trim().toLowerCase();

export const isTicketFinallyClosed = (ticket) => {
  const status = normalizeTicketWorkflowStatus(ticket?.status);
  const completionStatus = normalizeTicketWorkflowStatus(
    ticket?.completion_status
  );

  return (
    FINAL_TICKET_STATUSES.has(status) ||
    FINAL_TICKET_STATUSES.has(completionStatus)
  );
};

export const isTicketPendingCompletionReview = (ticket) =>
  !isTicketFinallyClosed(ticket) &&
  normalizeTicketWorkflowStatus(ticket?.status) === 'pending_review' &&
  normalizeTicketWorkflowStatus(ticket?.completion_status) === 'pending';

export const getTicketWorkflowDisplayStatus = (ticket) =>
  isTicketFinallyClosed(ticket)
    ? 'closed'
    : normalizeTicketWorkflowStatus(ticket?.status) || 'open';

export const canTicketBeResolvedRemotely = (ticket) => {
  const status = normalizeTicketWorkflowStatus(ticket?.status) || 'open';
  const partRequestStatus = normalizeTicketWorkflowStatus(
    ticket?.part_request_status
  );

  return (
    !isTicketFinallyClosed(ticket) &&
    ['new', 'open', 'assigned'].includes(status) &&
    !ticket?.linked_part_request_id &&
    ['', 'none', 'cancelled', 'rejected'].includes(partRequestStatus)
  );
};
