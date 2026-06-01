import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, XCircle, Image, Video } from 'lucide-react';

import TicketFilters from '@/components/tickets/TicketFilters';
import TicketCard from '@/components/tickets/TicketCard';
import CreateTicketDialog from '@/components/tickets/CreateTicketDialog';

export default function Tickets() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const role = user?.role || 'client';

  const [createOpen, setCreateOpen] = useState(false);
  const [rejectingTicket, setRejectingTicket] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all',
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', role, user?.email],

    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', {
          ascending: false,
        })
        .limit(200);

      if (role === 'client') {
        query = query.eq('client_email', user.email);
      }

      if (role === 'engineer') {
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
    'operational manager',
    'operation manager',
    'ceo',
    'agm',
  ].includes(role?.toLowerCase?.());

  const pendingReviewTickets = useMemo(() => {
    if (!canReviewCompletion) return [];

    return tickets.filter((ticket) => {
      return (
        ticket.status === 'pending_review' ||
        ticket.completion_status === 'pending'
      );
    });
  }, [tickets, canReviewCompletion]);

  const normalTickets = useMemo(() => {
    if (!canReviewCompletion) return tickets;

    return tickets.filter((ticket) => {
      return !(
        ticket.status === 'pending_review' ||
        ticket.completion_status === 'pending'
      );
    });
  }, [tickets, canReviewCompletion]);

  const filtered = useMemo(() => {
    return normalTickets.filter((t) => {
      if (filters.status !== 'all' && t.status !== filters.status) {
        return false;
      }

      if (filters.priority !== 'all' && t.priority !== filters.priority) {
        return false;
      }

      if (filters.category !== 'all' && t.category !== filters.category) {
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
          t.assigned_to_name?.toLowerCase().includes(s)
        );
      }

      return true;
    });
  }, [normalTickets, filters]);

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

  const title =
    role === 'engineer'
      ? 'My Jobs'
      : role === 'client'
        ? 'My Tickets'
        : role === 'helpdesk'
          ? 'Ticket Queue'
          : 'All Tickets';

  const canCreateTicket = [
    'client',
    'helpdesk',
    'admin',
    'ceo',
    'agm',
  ].includes(role);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {title}
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} ticket
            {filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {canCreateTicket && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        )}
      </div>

      {canReviewCompletion && pendingReviewTickets.length > 0 && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-4">
          <div>
            <h2 className="text-xl font-bold">
              Pending Completion Review
            </h2>

            <p className="text-sm text-slate-400">
              Review engineer completion report, before/after evidence and approve or reject.
            </p>
          </div>

          <div className="grid gap-4">
            {pendingReviewTickets.map((ticket) => (
              <CompletionReviewCard
                key={ticket.id}
                ticket={ticket}
                onApprove={() => approveCompletion(ticket)}
                onReject={() => {
                  setRejectingTicket(ticket);
                  setRejectReason('');
                }}
              />
            ))}
          </div>
        </section>
      )}

      <TicketFilters
        filters={filters}
        onChange={setFilters}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
            />
          ))}

          {filtered.length === 0 && (
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
          <div className="bg-card border rounded-2xl p-5 max-w-lg w-full space-y-4">
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