import React, { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import {
  Plus,
  CheckCircle,
  XCircle,
  Image,
  Video,
  ChevronDown,
  ChevronUp,
  Printer,
  Share2,
  Clock,
  User,
  MapPin,
  Package,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import TicketFilters from '@/components/tickets/TicketFilters';
import TicketCard from '@/components/tickets/TicketCard';
import CreateTicketDialog from '@/components/tickets/CreateTicketDialog';

const DEFAULT_GROUP_LIMIT = 20;

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const niceDate = (value) => {
  if (!value) return 'Not recorded';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const isPendingReviewTicket = (ticket) =>
  normalize(ticket.status) === 'pending_review' ||
  normalize(ticket.completion_status) === 'pending';

const isClosedTicket = (ticket) =>
  [
    'closed',
    'resolved',
    'completed',
    'approved',
  ].includes(normalize(ticket.status)) ||
  ['approved', 'closed'].includes(normalize(ticket.completion_status));

const isRejectedTicket = (ticket) =>
  normalize(ticket.status).includes('reject') ||
  normalize(ticket.completion_status) === 'rejected';

const isPendingPartsTicket = (ticket) =>
  [
    'pending_parts',
    'pending_on_parts',
    'part_pending',
    'parts_pending',
  ].includes(normalize(ticket.status)) ||
  [
    'pending_parts',
    'pending_inventory_review',
    'pending_operations_review',
    'waiting_operations_approval',
  ].includes(normalize(ticket.part_request_status));

const isPendingBankTicket = (ticket) =>
  [
    'pending_bank',
    'pending_on_bank',
    'bank_pending',
    'bank_to_pay',
  ].includes(normalize(ticket.status)) ||
  normalize(ticket.part_request_type) === 'bank';

const getTicketGroup = (ticket) => {
  if (isPendingReviewTicket(ticket)) return 'pending_review';
  if (isPendingPartsTicket(ticket)) return 'pending_parts';
  if (isPendingBankTicket(ticket)) return 'pending_bank';
  if (isRejectedTicket(ticket)) return 'rejected';
  if (isClosedTicket(ticket)) return 'closed';
  return 'open';
};

const GROUPS = [
  {
    key: 'open',
    label: 'Open Tickets',
    description: 'New, assigned, accepted, travelling, arrived and in-progress tickets.',
    icon: Clock,
  },
  {
    key: 'pending_review',
    label: 'Pending Completion Review',
    description: 'Engineer submitted completion report awaiting Helpdesk/Admin approval.',
    icon: CheckCircle2,
  },
  {
    key: 'pending_parts',
    label: 'Pending on Parts',
    description: 'Tickets redirected because company/inventory part is required.',
    icon: Package,
  },
  {
    key: 'pending_bank',
    label: 'Pending on Bank',
    description: 'Tickets waiting for bank/customer payment or bank-caused damage approval.',
    icon: AlertTriangle,
  },
  {
    key: 'rejected',
    label: 'Rejected Calls',
    description: 'Completion reports rejected and returned for correction.',
    icon: XCircle,
  },
  {
    key: 'closed',
    label: 'Closed Tickets',
    description: 'Approved, resolved, completed or closed tickets.',
    icon: CheckCircle,
  },
];

const getTimeline = (ticket) => [
  {
    label: 'Created',
    value: ticket.created_at,
    note: ticket.created_by_name || ticket.client_name || ticket.client_email,
  },
  {
    label: 'Assigned',
    value: ticket.assigned_at || ticket.assignment_date,
    note: ticket.assigned_to_name || ticket.assigned_engineer_email || ticket.assigned_to,
  },
  {
    label: 'Accepted',
    value: ticket.accepted_at || ticket.engineer_accepted_at,
    note: ticket.accepted_by || ticket.assigned_to_name || ticket.assigned_engineer_email,
  },
  {
    label: 'Trip Started',
    value: ticket.trip_started_at || ticket.start_trip_at || ticket.travel_started_at,
    note: ticket.trip_note || ticket.location_note,
  },
  {
    label: 'Arrived On Site',
    value: ticket.arrived_at || ticket.arrived_on_site_at || ticket.site_arrival_at,
    note: ticket.arrival_note,
  },
  {
    label: 'Work Started',
    value: ticket.work_started_at || ticket.started_work_at || ticket.start_work_at,
    note: ticket.work_start_note,
  },
  {
    label: 'Submitted For Review',
    value: ticket.submitted_at || ticket.completion_submitted_at || ticket.pending_review_at,
    note: ticket.completion_note,
  },
  {
    label: 'Approved / Closed',
    value: ticket.approved_at || ticket.closed_date || ticket.resolved_at,
    note: ticket.approved_by || ticket.closed_by,
  },
];

const ticketPrintHtml = (ticket) => {
  const timelineRows = getTimeline(ticket)
    .map(
      (row) => `
        <tr>
          <td>${row.label}</td>
          <td>${niceDate(row.value)}</td>
          <td>${row.note || ''}</td>
        </tr>
      `
    )
    .join('');

  return `
    <html>
      <head>
        <title>${ticket.ticket_number || ticket.ticket_id || ticket.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin-bottom: 4px; }
          .muted { color: #6b7280; font-size: 13px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 16px 0; }
          .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
          .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
          .value { font-weight: 700; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f3f4f6; }
          .section { margin-top: 18px; }
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <h1>ARK ONE Ticket Report</h1>
        <p class="muted">${new Date().toLocaleString()}</p>

        <div class="grid">
          <div class="box"><div class="label">Ticket No.</div><div class="value">${ticket.ticket_number || ticket.ticket_id || ticket.id}</div></div>
          <div class="box"><div class="label">Status</div><div class="value">${ticket.status || 'Not set'}</div></div>
          <div class="box"><div class="label">Bank / Client</div><div class="value">${ticket.bank_name || ticket.client_name || 'Not set'}</div></div>
          <div class="box"><div class="label">Branch</div><div class="value">${ticket.branch_name || ticket.branch || 'Not set'}</div></div>
          <div class="box"><div class="label">Terminal</div><div class="value">${ticket.terminal_id || 'Not set'}</div></div>
          <div class="box"><div class="label">Engineer</div><div class="value">${ticket.assigned_to_name || ticket.assigned_engineer_email || ticket.assigned_to || 'Not assigned'}</div></div>
        </div>

        <div class="section">
          <h3>Issue Description</h3>
          <pre>${ticket.description || ticket.title || ticket.category || 'No description'}</pre>
        </div>

        <div class="section">
          <h3>Completion Report</h3>
          <pre>${ticket.completion_note || 'No completion report submitted.'}</pre>
        </div>

        <div class="section">
          <h3>Engineer Timeline</h3>
          <table>
            <thead><tr><th>Stage</th><th>Time</th><th>Note / Actor</th></tr></thead>
            <tbody>${timelineRows}</tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

export default function Tickets() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const role = user?.role || 'client';
  const normalizedRole = normalize(role);

  const [createOpen, setCreateOpen] = useState(false);
  const [rejectingTicket, setRejectingTicket] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all',
  });

  const [expandedGroups, setExpandedGroups] = useState({
    open: true,
    pending_review: true,
    pending_parts: true,
    pending_bank: true,
    rejected: false,
    closed: false,
  });

  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [visibleLimits, setVisibleLimits] = useState(
    GROUPS.reduce((acc, group) => {
      acc[group.key] = DEFAULT_GROUP_LIMIT;
      return acc;
    }, {})
  );

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', role, user?.email],

    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', {
          ascending: false,
        })
        .limit(1500);

      if (normalizedRole === 'client') {
        query = query.eq('client_email', user.email);
      }

      if (normalizedRole === 'engineer') {
        query = query.or(
          `assigned_engineer_email.eq.${user.email},assigned_to.eq.${user.email}`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('SUPABASE TICKETS ERROR:', error);
        throw error;
      }

      return data || [];
    },

    enabled: !!user?.email,
  });

  const canReviewCompletion = [
    'admin',
    'helpdesk',
    'operations',
    'operational_manager',
    'operation_manager',
    'ceo',
    'agm',
  ].includes(normalizedRole);

  const canShareTicket = [
    'admin',
    'helpdesk',
    'operations',
    'operational_manager',
    'operation_manager',
    'ceo',
    'agm',
  ].includes(normalizedRole);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filters.status !== 'all' && normalize(t.status) !== normalize(filters.status)) {
        return false;
      }

      if (filters.priority !== 'all' && normalize(t.priority) !== normalize(filters.priority)) {
        return false;
      }

      if (filters.category !== 'all' && normalize(t.category) !== normalize(filters.category)) {
        return false;
      }

      if (filters.search) {
        const s = filters.search.toLowerCase();

        return (
          t.title?.toLowerCase().includes(s) ||
          t.ticket_id?.toLowerCase().includes(s) ||
          t.ticket_number?.toLowerCase().includes(s) ||
          t.description?.toLowerCase().includes(s) ||
          t.client_name?.toLowerCase().includes(s) ||
          t.client_email?.toLowerCase().includes(s) ||
          t.bank_name?.toLowerCase().includes(s) ||
          t.branch_name?.toLowerCase().includes(s) ||
          t.terminal_id?.toLowerCase().includes(s) ||
          t.assigned_to_name?.toLowerCase().includes(s) ||
          t.assigned_engineer_email?.toLowerCase().includes(s) ||
          t.assigned_to?.toLowerCase().includes(s)
        );
      }

      return true;
    });
  }, [tickets, filters]);

  const groupedTickets = useMemo(() => {
    const grouped = GROUPS.reduce((acc, group) => {
      acc[group.key] = [];
      return acc;
    }, {});

    filteredTickets.forEach((ticket) => {
      const groupKey = getTicketGroup(ticket);
      grouped[groupKey] = grouped[groupKey] || [];
      grouped[groupKey].push(ticket);
    });

    return grouped;
  }, [filteredTickets]);

  const refreshTickets = () => {
    queryClient.invalidateQueries({
      queryKey: ['tickets'],
    });
  };

  const approveCompletion = async (ticket) => {
    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'approved',
        completion_status: 'approved',
        approved_by: user?.full_name || user?.email,
        approved_at: new Date().toISOString(),
        closed_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (error) {
      console.error('APPROVE COMPLETION ERROR:', error);
      alert('Could not approve completion.');
      return;
    }

    alert('Completion approved.');
    refreshTickets();
  };

  const rejectCompletion = async () => {
    if (!rejectingTicket) return;

    if (!rejectReason.trim()) {
      alert('Please enter rejection reason.');
      return;
    }

    const existingAttachments =
      typeof rejectingTicket.attachments === 'object' &&
      rejectingTicket.attachments !== null
        ? rejectingTicket.attachments
        : {};

    const rejectionLog = [
      ...(existingAttachments.rejection_log || []),
      {
        rejected_by: user?.full_name || user?.email,
        rejected_at: new Date().toISOString(),
        reason: rejectReason.trim(),
      },
    ];

    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'in_progress',
        completion_status: 'rejected',
        attachments: {
          ...existingAttachments,
          rejection_log: rejectionLog,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', rejectingTicket.id);

    if (error) {
      console.error('REJECT COMPLETION ERROR:', error);
      alert('Could not reject completion.');
      return;
    }

    alert('Completion rejected and returned to engineer.');
    setRejectingTicket(null);
    setRejectReason('');
    refreshTickets();
  };

  const printTicket = (ticket) => {
    const w = window.open('', '_blank', 'width=900,height=700');

    if (!w) {
      alert('Popup blocked. Please allow popups to print ticket.');
      return;
    }

    w.document.write(ticketPrintHtml(ticket));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const shareTicket = async (ticket) => {
    const message = [
      `ARK ONE Ticket: ${ticket.ticket_number || ticket.ticket_id || ticket.id}`,
      `Status: ${ticket.status || 'Not set'}`,
      `Bank/Client: ${ticket.bank_name || ticket.client_name || 'Not set'}`,
      `Branch: ${ticket.branch_name || ticket.branch || 'Not set'}`,
      `Terminal: ${ticket.terminal_id || 'Not set'}`,
      `Engineer: ${ticket.assigned_to_name || ticket.assigned_engineer_email || ticket.assigned_to || 'Not assigned'}`,
      `Issue: ${ticket.description || ticket.title || ticket.category || 'No description'}`,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ARK ONE Ticket',
          text: message,
        });
      } else {
        await navigator.clipboard.writeText(message);
        alert('Ticket summary copied. You can paste and share with client.');
      }
    } catch (err) {
      console.error(err);
      alert('Could not share ticket.');
    }
  };

  const title =
    normalizedRole === 'engineer'
      ? 'My Jobs'
      : normalizedRole === 'client'
        ? 'My Tickets'
        : normalizedRole === 'helpdesk'
          ? 'Ticket Queue'
          : 'All Tickets';

  const canCreateTicket = [
    'client',
    'helpdesk',
    'admin',
    'ceo',
    'agm',
  ].includes(normalizedRole);

  const totalFiltered = filteredTickets.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {title}
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {totalFiltered} ticket{totalFiltered !== 1 ? 's' : ''} found · grouped by status
          </p>
        </div>

        {canCreateTicket && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        )}
      </div>

      <TicketFilters
        filters={filters}
        onChange={setFilters}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {GROUPS.map((group) => {
            const Icon = group.icon;
            const groupTickets = groupedTickets[group.key] || [];
            const isOpen = !!expandedGroups[group.key];
            const limit = visibleLimits[group.key] || DEFAULT_GROUP_LIMIT;
            const visibleTickets = groupTickets.slice(0, limit);

            return (
              <section
                key={group.key}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.key]: !prev[group.key],
                    }))
                  }
                  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#ff5a00]" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="font-bold text-white">
                        {group.label}
                        <span className="ml-2 text-sm text-slate-400">
                          ({groupTickets.length})
                        </span>
                      </h2>

                      <p className="text-xs text-slate-400 line-clamp-1">
                        {group.description}
                      </p>
                    </div>
                  </div>

                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-slate-700">
                    {groupTickets.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">
                        No tickets in this group.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {visibleTickets.map((ticket) => (
                          <CompactTicketRow
                            key={ticket.id}
                            ticket={ticket}
                            expanded={expandedTicketId === ticket.id}
                            canReviewCompletion={canReviewCompletion}
                            canShareTicket={canShareTicket}
                            onToggle={() =>
                              setExpandedTicketId((prev) =>
                                prev === ticket.id ? null : ticket.id
                              )
                            }
                            onApprove={() => approveCompletion(ticket)}
                            onReject={() => {
                              setRejectingTicket(ticket);
                              setRejectReason('');
                            }}
                            onPrint={() => printTicket(ticket)}
                            onShare={() => shareTicket(ticket)}
                          />
                        ))}

                        {groupTickets.length > limit && (
                          <div className="p-3">
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() =>
                                setVisibleLimits((prev) => ({
                                  ...prev,
                                  [group.key]: (prev[group.key] || DEFAULT_GROUP_LIMIT) + DEFAULT_GROUP_LIMIT,
                                }))
                              }
                            >
                              Show more {group.label}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {totalFiltered === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">
                No tickets found
              </p>

              <p className="text-sm mt-1">
                Try adjusting your filters or create a new ticket
              </p>
            </div>
          )}
        </div>
      )}

      {rejectingTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900/50 border rounded-2xl p-5 max-w-lg w-full space-y-4">
            <div>
              <h2 className="text-xl font-bold">
                Reject Completion
              </h2>

              <p className="text-sm text-slate-400">
                Enter reason for rejection. This will return the job to engineer.
              </p>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={5}
              placeholder="Explain what the engineer must correct..."
              className="w-full rounded-xl border bg-background p-3 text-sm"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectingTicket(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={rejectCompletion}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        user={user}
      />
    </div>
  );
}

function CompactTicketRow({
  ticket,
  expanded,
  canReviewCompletion,
  canShareTicket,
  onToggle,
  onApprove,
  onReject,
  onPrint,
  onShare,
}) {
  const timeline = getTimeline(ticket).filter((row) => row.value);
  const canReviewThis = canReviewCompletion && isPendingReviewTicket(ticket);

  return (
    <div className="bg-slate-950/30">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-400">
                {ticket.ticket_number || ticket.ticket_id || ticket.id}
              </span>

              <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-300 capitalize">
                {String(ticket.status || 'open').replace(/_/g, ' ')}
              </span>

              {ticket.priority && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-orange-500/30 text-orange-300 capitalize">
                  {ticket.priority}
                </span>
              )}
            </div>

            <p className="font-semibold text-white mt-1 truncate">
              {ticket.title || ticket.category || ticket.description || 'Untitled ticket'}
            </p>

            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {ticket.bank_name || ticket.client_name || 'Bank'} ·{' '}
              {ticket.branch_name || ticket.branch || 'Branch'} ·{' '}
              {ticket.terminal_id || ticket.device_name || 'No terminal'} ·{' '}
              {ticket.assigned_to_name || ticket.assigned_engineer_email || ticket.assigned_to || 'Unassigned'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{niceDate(ticket.created_at)}</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <InfoRow label="Bank / Client" value={ticket.bank_name || ticket.client_name} />
            <InfoRow label="Branch" value={ticket.branch_name || ticket.branch} />
            <InfoRow label="Terminal" value={ticket.terminal_id} />
            <InfoRow label="Engineer" value={ticket.assigned_to_name || ticket.assigned_engineer_email || ticket.assigned_to} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-sm font-semibold text-white mb-1">
              Issue / Description
            </p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">
              {ticket.description || ticket.title || 'No description supplied.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-sm font-semibold text-white mb-3">
              Engineer Response Timeline
            </p>

            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">
                No engineer response times recorded yet.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-2">
                {timeline.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <p className="text-xs text-slate-400">
                      {row.label}
                    </p>

                    <p className="text-sm font-semibold text-white">
                      {niceDate(row.value)}
                    </p>

                    {row.note && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {row.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/tickets/${ticket.id}`}
                className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-slate-700 text-sm hover:bg-slate-800"
              >
                Open Full Ticket
              </Link>

              {canShareTicket && (
                <>
                  <Button variant="outline" size="sm" onClick={onPrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>

                  <Button variant="outline" size="sm" onClick={onShare}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </>
              )}
            </div>

            {canReviewThis && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onReject}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>

                <Button size="sm" onClick={onApprove}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-sm font-semibold text-white mb-2">
              Current Ticket Card Preview
            </p>
            <TicketCard ticket={ticket} />
          </div>
        </div>
      )}
    </div>
  );
}

function CompletionReviewCard({ ticket, onApprove, onReject }) {
  const beforePhotos = Array.isArray(ticket.before_photos)
    ? ticket.before_photos
    : [];

  const afterPhotos = Array.isArray(ticket.after_photos)
    ? ticket.after_photos
    : [];

  const videos = Array.isArray(ticket.evidence_videos)
    ? ticket.evidence_videos
    : [];

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            {ticket.ticket_number || ticket.ticket_id || ticket.id}
          </p>

          <h3 className="text-lg font-semibold">
            {ticket.title || ticket.category || 'Completed Job'}
          </h3>

          <p className="text-sm text-muted-foreground mt-1">
            {ticket.bank_name || ticket.client_name || 'Bank'} •{' '}
            {ticket.branch_name || ticket.branch || 'Branch'}
          </p>
        </div>

        <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Pending Review
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <InfoRow label="Engineer" value={ticket.completed_by || ticket.assigned_to_name || ticket.assigned_engineer_email} />
        <InfoRow label="Terminal" value={ticket.terminal_id} />
        <InfoRow label="Device" value={ticket.device_name} />
        <InfoRow label="SLA" value={ticket.sla_status || ticket.sla_level} />
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
        <p className="font-medium mb-2">
          Completion Report
        </p>

        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {ticket.completion_note || 'No completion note submitted.'}
        </p>
      </div>

      <EvidenceLinks
        title="Before Photos"
        icon={<Image className="w-4 h-4" />}
        items={beforePhotos}
      />

      <EvidenceLinks
        title="After Photos"
        icon={<Image className="w-4 h-4" />}
        items={afterPhotos}
      />

      <EvidenceLinks
        title="Videos"
        icon={<Video className="w-4 h-4" />}
        items={videos}
      />

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onReject}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Reject
        </Button>

        <Button onClick={onApprove}>
          <CheckCircle className="w-4 h-4 mr-2" />
          Approve
        </Button>
      </div>
    </div>
  );
}

function EvidenceLinks({ title, icon, items }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
      <div className="flex items-center gap-2 font-medium mb-2">
        {icon}
        {title}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">
          No evidence uploaded.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <a
              key={`${item.url}-${index}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm px-3 py-2 rounded-lg border hover:bg-muted"
            >
              View {index + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="font-medium text-white">
        {value || 'Not set'}
      </p>
    </div>
  );
}
