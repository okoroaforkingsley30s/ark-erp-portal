const normalizeWorkflowValue = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export const FINAL_TICKET_STATUSES = Object.freeze([
  'approved',
  'closed',
  'completed',
  'resolved',
]);

/**
 * A final closure can be recorded in either legacy `status`, the repaired
 * `completion_status`, or `review_status`. Every UI action gate must use this
 * helper so a closed job cannot become actionable through a different screen.
 */
export function isTicketFinallyClosed(ticket) {
  if (!ticket) return false;

  return [ticket.status, ticket.completion_status, ticket.review_status]
    .map(normalizeWorkflowValue)
    .some((value) => FINAL_TICKET_STATUSES.includes(value));
}
