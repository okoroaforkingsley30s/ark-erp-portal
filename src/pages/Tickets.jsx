import React, { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import {
  Plus,
  CheckCircle,
  XCircle,
  Printer,
  Share2,
  Clock,
  User,
  Package,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  ArrowRight,
  Search,
  Users,
  Wrench,
  Building2,
  RotateCcw,
  FileText,
  Eye,
} from 'lucide-react';

import CreateTicketDialog from '@/components/tickets/CreateTicketDialog';

const DEFAULT_GROUP_LIMIT = 24;

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

const isFinalClosedTicket = (ticket) => {
  const status = normalize(ticket.status);
  const completionStatus = normalize(ticket.completion_status);

  return (
    ['approved', 'closed', 'completed'].includes(status) ||
    ['approved', 'closed', 'completed'].includes(completionStatus)
  );
};

/*
  IMPORTANT:
  completion_status = "pending" can exist before an engineer has submitted work.
  A ticket is only pending review when its workflow status is pending_review,
  or when the engineer actually submitted a review/completion time.
*/
const isPendingReviewTicket = (ticket) => {
  const status = normalize(ticket.status);

  return (
    status === 'pending_review' ||
    Boolean(ticket.submitted_at) ||
    Boolean(ticket.submitted_review_at) ||
    Boolean(ticket.completion_submitted_at) ||
    Boolean(ticket.pending_review_at)
  );
};

const isRejectedTicket = (ticket) =>
  normalize(ticket.status).includes('reject') ||
  normalize(ticket.completion_status) === 'rejected';

const isPendingPartsTicket = (ticket) =>
  ['pending_parts', 'pending_on_parts', 'part_pending', 'parts_pending'].includes(
    normalize(ticket.status)
  ) ||
  [
    'pending_parts',
    'pending_inventory_review',
    'pending_operations_review',
    'waiting_operations_approval',
  ].includes(normalize(ticket.part_request_status));

const isPendingBankTicket = (ticket) =>
  ['pending_bank', 'pending_on_bank', 'bank_pending', 'bank_to_pay'].includes(
    normalize(ticket.status)
  ) || normalize(ticket.part_request_type) === 'bank';

const getTicketGroup = (ticket) => {
  if (isFinalClosedTicket(ticket)) return 'closed';
  if (ticket.escalated) return 'escalated';
  if (isPendingReviewTicket(ticket)) return 'pending_review';
  return 'open';
};

const GROUPS = [
  {
    key: 'open',
    label: 'Open Tickets',
    description:
      'New, assigned, accepted, travelling, arrived, in progress, pending parts, pending bank and rejected tickets.',
    icon: Clock,
    tone: 'orange',
    action: 'View All Open Tickets',
  },
  {
    key: 'pending_review',
    label: 'Pending Completion Review',
    description:
      'Only calls where the engineer has submitted a completion report for approval.',
    icon: CheckCircle2,
    tone: 'yellow',
    action: 'View All Pending Review',
  },
  {
    key: 'escalated',
    label: 'Escalated Tickets',
    description:
      'Tickets escalated because of no action or a manual escalation.',
    icon: AlertTriangle,
    tone: 'red',
    action: 'View All Escalated',
  },
  {
    key: 'closed',
    label: 'Approved / Closed Tickets',
    description:
      'Tickets that have been approved, completed or permanently closed.',
    icon: CheckCircle,
    tone: 'green',
    action: 'View All Closed Tickets',
  },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All Status', icon: FileText, tone: 'blue' },
  { key: 'new', label: 'New', icon: Clock, tone: 'blue' },
  { key: 'assigned', label: 'Assigned', icon: Users, tone: 'cyan' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, tone: 'purple' },
  { key: 'traveling', label: 'Travelling', icon: ArrowRight, tone: 'blue' },
  { key: 'arrived_on_site', label: 'Arrived', icon: MapPin, tone: 'orange' },
  { key: 'in_progress', label: 'In Progress', icon: Wrench, tone: 'teal' },
  { key: 'pending_review', label: 'Pending Review', icon: Clock, tone: 'yellow' },
  { key: 'pending_parts', label: 'Pending Parts', icon: Package, tone: 'orange' },
  { key: 'pending_bank', label: 'Pending Bank', icon: Building2, tone: 'blue' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, tone: 'red' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, tone: 'green' },
  { key: 'closed', label: 'Closed', icon: CheckCircle, tone: 'green' },
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
    note:
      ticket.assigned_to_name ||
      ticket.assigned_engineer_email ||
      ticket.assigned_to,
  },
  {
    label: 'Accepted',
    value: ticket.accepted_at || ticket.engineer_accepted_at,
    note:
      ticket.accepted_by ||
      ticket.assigned_to_name ||
      ticket.assigned_engineer_email,
  },
  {
    label: 'Trip Started',
    value:
      ticket.trip_started_at || ticket.start_trip_at || ticket.travel_started_at,
    note: ticket.trip_note || ticket.location_note,
  },
  {
    label: 'Arrived On Site',
    value:
      ticket.arrived_at || ticket.arrived_on_site_at || ticket.site_arrival_at,
    note: ticket.arrival_note,
  },
  {
    label: 'Work Started',
    value: ticket.work_started_at || ticket.started_work_at || ticket.start_work_at,
    note: ticket.work_start_note,
  },
  {
    label: 'Submitted For Review',
    value:
      ticket.submitted_at ||
      ticket.submitted_review_at ||
      ticket.completion_submitted_at ||
      ticket.pending_review_at,
    note: ticket.completion_note,
  },
  {
    label: 'Approved / Closed',
    value: ticket.approved_at || ticket.closed_date || ticket.resolved_at,
    note: ticket.approved_by || ticket.closed_by,
  },
];

const ticketPrintHtml = (ticket) => {
  const logoSrc = '/logo.png';

  const esc = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const timelineRows = getTimeline(ticket)
    .map(
      (row, index) => `
        <tr>
          <td class="stage">${index + 1}. ${esc(row.label)}</td>
          <td>${esc(niceDate(row.value))}</td>
          <td>${esc(row.note || '')}</td>
        </tr>
      `
    )
    .join('');

  return `
    <html>
      <head>
        <title>${esc(ticket.ticket_number || ticket.ticket_id || ticket.id)}</title>
        <style>
          @page { size: A4; margin: 18mm; }

          * { box-sizing: border-box; }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 12px;
          }

          .report {
            width: 100%;
          }

          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 4px solid #0b1e4d;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .logo {
            width: 62px;
            height: 62px;
            object-fit: contain;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 6px;
          }

          .company {
            font-size: 18px;
            font-weight: 800;
            color: #0b1e4d;
            letter-spacing: 0.3px;
          }

          .subtitle {
            margin-top: 3px;
            font-size: 11px;
            color: #6b7280;
          }

          .report-title {
            text-align: right;
          }

          .report-title h1 {
            margin: 0;
            font-size: 20px;
            color: #ff6b00;
          }

          .report-title p {
            margin: 5px 0 0;
            color: #6b7280;
            font-size: 11px;
          }

          .ticket-strip {
            display: grid;
            grid-template-columns: 1.2fr 1fr 1fr;
            gap: 10px;
            margin-bottom: 16px;
          }

          .strip-box {
            background: #0b1e4d;
            color: white;
            border-radius: 12px;
            padding: 12px;
          }

          .strip-box.orange {
            background: #ff6b00;
          }

          .strip-label {
            font-size: 10px;
            text-transform: uppercase;
            opacity: 0.75;
            margin-bottom: 4px;
          }

          .strip-value {
            font-size: 14px;
            font-weight: 800;
            word-break: break-word;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }

          .box {
            border: 1px solid #d1d5db;
            border-left: 4px solid #0b1e4d;
            border-radius: 10px;
            padding: 10px;
            min-height: 58px;
          }

          .label {
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }

          .value {
            font-size: 12px;
            font-weight: 700;
            margin-top: 5px;
            color: #111827;
            word-break: break-word;
          }

          .section {
            margin-top: 16px;
            page-break-inside: avoid;
          }

          .section-title {
            background: #f3f4f6;
            border-left: 5px solid #ff6b00;
            padding: 8px 10px;
            font-size: 13px;
            font-weight: 800;
            color: #0b1e4d;
            margin-bottom: 8px;
          }

          .text-box {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 12px;
            min-height: 70px;
            white-space: pre-wrap;
            line-height: 1.55;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }

          th {
            background: #0b1e4d;
            color: #ffffff;
            padding: 9px;
            font-size: 11px;
            text-align: left;
          }

          td {
            border: 1px solid #d1d5db;
            padding: 8px;
            font-size: 11px;
            vertical-align: top;
          }

          tr:nth-child(even) td {
            background: #f9fafb;
          }

          .stage {
            font-weight: 700;
            color: #0b1e4d;
          }

          .footer {
            margin-top: 22px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .sign-box {
            border-top: 1px solid #9ca3af;
            padding-top: 7px;
            color: #6b7280;
            font-size: 11px;
          }

          .watermark {
            margin-top: 18px;
            text-align: center;
            color: #9ca3af;
            font-size: 10px;
          }

          @media print {
            .report { page-break-after: auto; }
          }
        </style>
      </head>

      <body>
        <div class="report">
          <div class="header">
            <div class="brand">
              <img src="${logoSrc}" class="logo" onerror="this.style.display='none'" />
              <div>
                <div class="company">ARK Technologies Group</div>
                <div class="subtitle">ARK ONE ERP Service Desk</div>
              </div>
            </div>

            <div class="report-title">
              <h1>Ticket Service Report</h1>
              <p>Printed: ${esc(new Date().toLocaleString())}</p>
            </div>
          </div>

          <div class="ticket-strip">
            <div class="strip-box orange">
              <div class="strip-label">Ticket Number</div>
              <div class="strip-value">${esc(ticket.ticket_number || ticket.ticket_id || ticket.id)}</div>
            </div>

            <div class="strip-box">
              <div class="strip-label">Current Status</div>
              <div class="strip-value">${esc(String(ticket.status || 'Not set').replace(/_/g, ' '))}</div>
            </div>

            <div class="strip-box">
              <div class="strip-label">Priority</div>
              <div class="strip-value">${esc(ticket.priority || 'Normal')}</div>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="label">Bank / Client</div>
              <div class="value">${esc(ticket.bank_name || ticket.client_name || 'Not set')}</div>
            </div>

            <div class="box">
              <div class="label">Branch / Location</div>
              <div class="value">${esc(ticket.branch_name || ticket.branch || 'Not set')}</div>
            </div>

            <div class="box">
              <div class="label">Terminal ID</div>
              <div class="value">${esc(ticket.terminal_id || 'Not set')}</div>
            </div>

            <div class="box">
              <div class="label">Device</div>
              <div class="value">${esc(ticket.device_name || 'Not set')}</div>
            </div>

            <div class="box">
              <div class="label">Assigned Engineer</div>
              <div class="value">${esc(ticket.assigned_to_name || ticket.assigned_engineer_email || ticket.assigned_to || 'Not assigned')}</div>
            </div>

            <div class="box">
              <div class="label">Created Date</div>
              <div class="value">${esc(niceDate(ticket.created_at))}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Issue Description</div>
            <div class="text-box">${esc(ticket.description || ticket.title || ticket.category || 'No description supplied.')}</div>
          </div>

          <div class="section">
            <div class="section-title">Engineer Completion Report</div>
            <div class="text-box">${esc(ticket.completion_note || 'No completion report submitted.')}</div>
          </div>

          <div class="section">
            <div class="section-title">Engineer Workflow Timeline</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 28%;">Stage</th>
                  <th style="width: 28%;">Date / Time</th>
                  <th>Note / Actor</th>
                </tr>
              </thead>
              <tbody>${timelineRows}</tbody>
            </table>
          </div>

          <div class="footer">
            <div class="sign-box">Prepared / Printed By</div>
            <div class="sign-box">Reviewed / Approved By</div>
          </div>

          <div class="watermark">
            Generated from ARK ONE ERP Portal
          </div>
        </div>
      </body>
    </html>
  `;
};

function toneClasses(tone) {
  const map = {
    orange: {
      card: 'border-orange-500/40 bg-orange-500/10',
      icon: 'border-orange-500/40 bg-orange-500 text-white shadow-orange-500/30',
      text: 'text-orange-300',
      button: 'bg-orange-500 hover:bg-orange-600 text-white',
      glow: 'shadow-orange-500/10',
    },
    yellow: {
      card: 'border-yellow-500/40 bg-yellow-500/10',
      icon: 'border-yellow-500/40 bg-yellow-500 text-white shadow-yellow-500/30',
      text: 'text-yellow-300',
      button: 'bg-yellow-500 hover:bg-yellow-600 text-slate-950',
      glow: 'shadow-yellow-500/10',
    },
    red: {
      card: 'border-red-500/40 bg-red-500/10',
      icon: 'border-red-500/40 bg-red-500 text-white shadow-red-500/30',
      text: 'text-red-300',
      button: 'bg-red-500 hover:bg-red-600 text-white',
      glow: 'shadow-red-500/10',
    },
    green: {
      card: 'border-green-500/40 bg-green-500/10',
      icon: 'border-green-500/40 bg-green-500 text-white shadow-green-500/30',
      text: 'text-green-300',
      button: 'bg-green-600 hover:bg-green-700 text-white',
      glow: 'shadow-green-500/10',
    },
    blue: {
      card: 'border-blue-500/40 bg-blue-500/10',
      icon: 'border-blue-500/40 bg-blue-500 text-white shadow-blue-500/30',
      text: 'text-blue-300',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      glow: 'shadow-blue-500/10',
    },
    cyan: {
      card: 'border-cyan-500/40 bg-cyan-500/10',
      icon: 'border-cyan-500/40 bg-cyan-500 text-white shadow-cyan-500/30',
      text: 'text-cyan-300',
      button: 'bg-cyan-600 hover:bg-cyan-700 text-white',
      glow: 'shadow-cyan-500/10',
    },
    purple: {
      card: 'border-purple-500/40 bg-purple-500/10',
      icon: 'border-purple-500/40 bg-purple-500 text-white shadow-purple-500/30',
      text: 'text-purple-300',
      button: 'bg-purple-600 hover:bg-purple-700 text-white',
      glow: 'shadow-purple-500/10',
    },
    teal: {
      card: 'border-teal-500/40 bg-teal-500/10',
      icon: 'border-teal-500/40 bg-teal-500 text-white shadow-teal-500/30',
      text: 'text-teal-300',
      button: 'bg-teal-600 hover:bg-teal-700 text-white',
      glow: 'shadow-teal-500/10',
    },
  };

  return map[tone] || map.blue;
}

function getStatusStyle(ticket) {
  const status = normalize(ticket.status);
  const completionStatus = normalize(ticket.completion_status);

  if (ticket.escalated) return `${toneClasses('red').card} text-red-200`;
  if (['approved', 'closed', 'completed'].includes(status)) {
    return `${toneClasses('green').card} text-green-300`;
  }
  if (completionStatus === 'rejected' || status.includes('reject')) {
    return `${toneClasses('red').card} text-red-300`;
  }
  if (isPendingReviewTicket(ticket)) {
    return `${toneClasses('yellow').card} text-yellow-300`;
  }
  if (isPendingPartsTicket(ticket)) {
    return `${toneClasses('orange').card} text-orange-300`;
  }
  if (isPendingBankTicket(ticket)) {
    return `${toneClasses('blue').card} text-blue-300`;
  }
  if (['in_progress', 'arrived_on_site'].includes(status)) {
    return `${toneClasses('teal').card} text-teal-300`;
  }

  return `${toneClasses('orange').card} text-orange-300`;
}

function getPriorityStyle(priority) {
  const value = normalize(priority);

  if (value === 'critical') return `${toneClasses('red').card} text-red-300`;
  if (value === 'high') return `${toneClasses('orange').card} text-orange-300`;
  if (value === 'low') return 'border-slate-500/40 bg-slate-500/10 text-slate-300';

  return `${toneClasses('blue').card} text-blue-300`;
}

const getFileUrl = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.url || item.publicUrl || item.file_url || item.href || '';
};

const getFileName = (item, fallback) => {
  if (!item) return fallback;
  if (typeof item === 'string') {
    const clean = item.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || fallback;
  }
  return item.name || item.filename || fallback;
};

const getTicketPhotoGroups = (ticket) => {
  const beforePhotos = Array.isArray(ticket?.before_photos)
    ? ticket.before_photos
    : [];

  const afterPhotos = Array.isArray(ticket?.after_photos)
    ? ticket.after_photos
    : [];

  const evidencePhotos = Array.isArray(ticket?.evidence_photos)
    ? ticket.evidence_photos.filter((item) => {
        const type = typeof item === 'object' && item !== null ? item.type : '';
        return type !== 'before-photos' && type !== 'after-photos';
      })
    : [];

  const closurePhotos = Array.isArray(ticket?.closure_photos)
    ? ticket.closure_photos
    : [];

  const closurePhotoUrl = ticket?.closure_photo_url
    ? [ticket.closure_photo_url]
    : [];

  return [
    { title: 'Before Photos', photos: beforePhotos },
    { title: 'After Photos', photos: afterPhotos },
    { title: 'Evidence Photos', photos: evidencePhotos },
    { title: 'Closure Photos', photos: [...closurePhotos, ...closurePhotoUrl] },
  ];
};

const hasTicketPhotos = (ticket) =>
  getTicketPhotoGroups(ticket).some((group) =>
    group.photos.some((photo) => Boolean(getFileUrl(photo)))
  );

function EngineerPhotoGallery({ ticket }) {
  const groups = getTicketPhotoGroups(ticket).filter((group) =>
    group.photos.some((photo) => Boolean(getFileUrl(photo)))
  );

  if (groups.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-blue-400/10 bg-[#06143A] p-4">
        <p className="text-sm font-bold text-white">Engineer Photos</p>
        <p className="mt-2 text-sm text-blue-100/50">
          No engineer photos are attached to this ticket yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-blue-400/10 bg-[#06143A] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">Engineer Photos</p>
        <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-orange-200">
          Saved on ticket
        </span>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-bold text-orange-300">
              {group.title}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {group.photos.map((photo, index) => {
                const url = getFileUrl(photo);
                const name = getFileName(photo, `${group.title} ${index + 1}`);

                if (!url) return null;

                return (
                  <a
                    key={`${group.title}-${index}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border border-blue-400/10 bg-[#0B1E4D]"
                    title={name}
                  >
                    <img
                      src={url}
                      alt={name}
                      loading="lazy"
                      className="h-28 w-full object-cover"
                    />
                    <div className="truncate px-2 py-1 text-[10px] text-blue-100/60">
                      {name}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Tickets() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const role = user?.role || 'client';
  const normalizedRole = normalize(role);

  const [createOpen, setCreateOpen] = useState(false);
  const [rejectingTicket, setRejectingTicket] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [activeGroup, setActiveGroup] = useState('open');

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all',
  });

  const [expandedGroups, setExpandedGroups] = useState({
    open: true,
    pending_review: true,
    escalated: true,
    closed: false,
  });

  const [visibleLimits, setVisibleLimits] = useState({
    open: DEFAULT_GROUP_LIMIT,
    pending_review: DEFAULT_GROUP_LIMIT,
    escalated: DEFAULT_GROUP_LIMIT,
    closed: DEFAULT_GROUP_LIMIT,
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', role, user?.email],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
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

  const canReviewCompletion = true;

  const canShareTicket = true;

  const canCreateTicket = true;

  const statusCounts = useMemo(() => {
    return STATUS_FILTERS.reduce((acc, item) => {
      if (item.key === 'all') {
        acc[item.key] = tickets.length;
      } else if (item.key === 'rejected') {
        acc[item.key] = tickets.filter(isRejectedTicket).length;
      } else if (item.key === 'pending_review') {
        acc[item.key] = tickets.filter(isPendingReviewTicket).length;
      } else if (item.key === 'pending_parts') {
        acc[item.key] = tickets.filter(isPendingPartsTicket).length;
      } else if (item.key === 'pending_bank') {
        acc[item.key] = tickets.filter(isPendingBankTicket).length;
      } else {
        acc[item.key] = tickets.filter(
          (ticket) => normalize(ticket.status) === item.key
        ).length;
      }

      return acc;
    }, {});
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (filters.status !== 'all') {
        if (filters.status === 'rejected') {
          if (!isRejectedTicket(ticket)) return false;
        } else if (filters.status === 'pending_review') {
          if (!isPendingReviewTicket(ticket)) return false;
        } else if (filters.status === 'pending_parts') {
          if (!isPendingPartsTicket(ticket)) return false;
        } else if (filters.status === 'pending_bank') {
          if (!isPendingBankTicket(ticket)) return false;
        } else if (normalize(ticket.status) !== normalize(filters.status)) {
          return false;
        }
      }

      if (
        filters.priority !== 'all' &&
        normalize(ticket.priority) !== normalize(filters.priority)
      ) {
        return false;
      }

      if (
        filters.category !== 'all' &&
        normalize(ticket.category) !== normalize(filters.category)
      ) {
        return false;
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();

        return (
          ticket.title?.toLowerCase().includes(search) ||
          ticket.ticket_id?.toLowerCase().includes(search) ||
          ticket.ticket_number?.toLowerCase().includes(search) ||
          ticket.description?.toLowerCase().includes(search) ||
          ticket.client_name?.toLowerCase().includes(search) ||
          ticket.client_email?.toLowerCase().includes(search) ||
          ticket.bank_name?.toLowerCase().includes(search) ||
          ticket.branch_name?.toLowerCase().includes(search) ||
          ticket.terminal_id?.toLowerCase().includes(search) ||
          ticket.assigned_to_name?.toLowerCase().includes(search) ||
          ticket.assigned_engineer_email?.toLowerCase().includes(search) ||
          ticket.assigned_to?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [tickets, filters]);

  const groupedTickets = useMemo(() => {
    const grouped = {
      open: [],
      pending_review: [],
      escalated: [],
      closed: [],
    };

    filteredTickets.forEach((ticket) => {
      grouped[getTicketGroup(ticket)].push(ticket);
    });

    return grouped;
  }, [filteredTickets]);

  const stats = useMemo(() => {
    const open = tickets.filter((ticket) => !isFinalClosedTicket(ticket));
    const closed = tickets.filter(isFinalClosedTicket);

    return {
      total: tickets.length,
      open: open.length,
      closed: closed.length,
      pendingReview: open.filter(isPendingReviewTicket).length,
      escalated: open.filter((ticket) => ticket.escalated).length,
    };
  }, [tickets]);

  const refreshTickets = () => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const clearAndSetGroup = (groupKey) => {
    setActiveGroup(groupKey);
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: true,
    }));

    setTimeout(() => {
      document.getElementById(`ticket-group-${groupKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  };

  const setStatusFilter = (status) => {
    setFilters((current) => ({
      ...current,
      status,
    }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      priority: 'all',
      category: 'all',
    });
  };

  const approveCompletion = async (ticket) => {
    if (isFinalClosedTicket(ticket)) {
      alert('This ticket is already approved or closed.');
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'approved',
        completion_status: 'approved',
        approved_by: user?.full_name || user?.email,
        approved_at: now,
        closed_date: now,
        last_action_at: now,
        updated_at: now,
      })
      .eq('id', ticket.id);

    if (error) {
      console.error('APPROVE COMPLETION ERROR:', error);
      alert('Could not approve completion.');
      return;
    }

    alert('Completion approved and ticket moved to closed group.');
    refreshTickets();
  };

  const rejectCompletion = async () => {
    if (!rejectingTicket) return;

    if (isFinalClosedTicket(rejectingTicket)) {
      alert('This ticket is already approved or closed.');
      setRejectingTicket(null);
      setRejectReason('');
      return;
    }

    if (!rejectReason.trim()) {
      alert('Please enter rejection reason.');
      return;
    }

    const now = new Date().toISOString();

    const existingAttachments =
      typeof rejectingTicket.attachments === 'object' &&
      rejectingTicket.attachments !== null
        ? rejectingTicket.attachments
        : {};

    const rejectionLog = [
      ...(existingAttachments.rejection_log || []),
      {
        rejected_by: user?.full_name || user?.email,
        rejected_at: now,
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
        last_action_at: now,
        updated_at: now,
      })
      .eq('id', rejectingTicket.id);

    if (error) {
      console.error('REJECT COMPLETION ERROR:', error);
      alert('Could not reject completion.');
      return;
    }

    alert('Completion rejected and returned to engineer. Ticket remains open.');
    setRejectingTicket(null);
    setRejectReason('');
    refreshTickets();
  };

  const escalateTicket = async (ticket) => {
    if (isFinalClosedTicket(ticket)) {
      alert('Closed or approved tickets cannot be escalated.');
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('tickets')
      .update({
        escalated: true,
        escalated_at: now,
        escalation_level: ticket.escalation_level || 'manual',
        escalation_reason:
          ticket.escalation_reason ||
          'Manually escalated from Tickets dashboard.',
        last_action_at: now,
        updated_at: now,
      })
      .eq('id', ticket.id);

    if (error) {
      console.error('MANUAL ESCALATION ERROR:', error);
      alert('Could not escalate ticket.');
      return;
    }

    await supabase.from('notifications').insert({
      user_email: 'operations@arktechnologiesgroup.com',
      title: 'Ticket Escalated',
      message: `${ticket.ticket_number || ticket.ticket_id || ticket.id} has been escalated from Tickets dashboard.`,
      type: 'ticket_escalated',
      link: `/tickets/${ticket.id}`,
      related_id: ticket.id,
      related_type: 'ticket',
      sound: 'bell',
      read: false,
      created_at: now,
    });

    alert('Ticket escalated.');
    refreshTickets();
  };

  const printTicket = (ticket) => {
    const popup = window.open('', '_blank', 'width=900,height=700');

    if (!popup) {
      alert('Popup blocked. Please allow popups to print ticket.');
      return;
    }

    popup.document.write(ticketPrintHtml(ticket));
    popup.document.close();
    popup.focus();

    setTimeout(() => popup.print(), 400);
  };

  const shareTicket = async (ticket) => {
    const message = [
      `ARK ONE Ticket: ${ticket.ticket_number || ticket.ticket_id || ticket.id}`,
      `Status: ${ticket.status || 'Not set'}`,
      `Bank/Client: ${ticket.bank_name || ticket.client_name || 'Not set'}`,
      `Branch: ${ticket.branch_name || ticket.branch || 'Not set'}`,
      `Terminal: ${ticket.terminal_id || 'Not set'}`,
      `Engineer: ${
        ticket.assigned_to_name ||
        ticket.assigned_engineer_email ||
        ticket.assigned_to ||
        'Not assigned'
      }`,
      `Issue: ${
        ticket.description ||
        ticket.title ||
        ticket.category ||
        'No description'
      }`,
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
    } catch (error) {
      console.error(error);
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

  return (
    <div className="min-h-screen space-y-6 bg-[#06143A] p-1 text-white">
      <section className="overflow-hidden rounded-3xl border border-blue-400/10 bg-gradient-to-br from-[#06143A] via-[#0B1E4D] to-[#081738] p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-400">
              ARK ONE Service Desk
            </p>

            <h1 className="mt-2 text-3xl font-black text-white">{title}</h1>

            <p className="mt-2 max-w-3xl text-sm text-blue-100/70">
              Open calls remain active until approved, completed, or permanently
              closed. Pending review is only for an engineer-submitted completion.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={refreshTickets}
              className="border-blue-400/20 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            {canCreateTicket && (
              <Button
  type="button"
  onMouseDown={(event) => event.preventDefault()}
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    setCreateOpen(true);
  }}
  className="bg-[#ff6b00] text-white hover:bg-[#e85f00]"
>
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            )}
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Open Tickets"
            value={stats.open}
            subtitle="View active calls"
            icon={<Clock className="h-6 w-6" />}
            tone="orange"
            onClick={() => clearAndSetGroup('open')}
          />

          <DashboardCard
            title="Pending Review"
            value={stats.pendingReview}
            subtitle="Completion awaiting approval"
            icon={<CheckCircle2 className="h-6 w-6" />}
            tone="yellow"
            onClick={() => clearAndSetGroup('pending_review')}
          />

          <DashboardCard
            title="Escalated Tickets"
            value={stats.escalated}
            subtitle="Needs authority attention"
            icon={<AlertTriangle className="h-6 w-6" />}
            tone="red"
            onClick={() => clearAndSetGroup('escalated')}
          />

          <DashboardCard
            title="Approved / Closed"
            value={stats.closed}
            subtitle="View finalized calls"
            icon={<CheckCircle className="h-6 w-6" />}
            tone="green"
            onClick={() => clearAndSetGroup('closed')}
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-7">
          {STATUS_FILTERS.filter((item) => item.key !== 'all')
            .slice(0, 7)
            .map((item) => (
              <StatusQuickCard
                key={item.key}
                item={item}
                value={statusCounts[item.key] || 0}
                active={filters.status === item.key}
                onClick={() => setStatusFilter(item.key)}
              />
            ))}
        </div>
      </section>

      <section className="rounded-3xl border border-blue-400/10 bg-[#081738] p-5 shadow-xl">
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_220px_220px_220px_auto]">
          <div>
            <label className="mb-2 block text-xs font-medium text-blue-100/70">
              Search
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-100/35" />
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search tickets..."
                className="h-11 w-full rounded-xl border border-blue-400/10 bg-[#06143A] pl-10 pr-3 text-sm text-white outline-none placeholder:text-blue-100/30 focus:border-orange-500"
              />
            </div>
          </div>

          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: value,
              }))
            }
            options={STATUS_FILTERS.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
          />

          <FilterSelect
            label="Priority"
            value={filters.priority}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                priority: value,
              }))
            }
            options={[
              { value: 'all', label: 'All Priority' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
          />

          <FilterSelect
            label="Category"
            value={filters.category}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                category: value,
              }))
            }
            options={[
              { value: 'all', label: 'All Category' },
              { value: 'hardware', label: 'Hardware' },
              { value: 'software', label: 'Software' },
              { value: 'network', label: 'Network' },
              { value: 'security', label: 'Security' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'installation', label: 'Installation' },
              { value: 'consultation', label: 'Consultation' },
              { value: 'other', label: 'Other' },
            ]}
          />

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="h-11 w-full border-blue-400/20 bg-white/5 text-white hover:bg-white/10"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center rounded-3xl border border-blue-400/10 bg-[#081738] py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-orange-500/20 border-t-orange-500" />
        </div>
      ) : (
        <div className="space-y-5">
          {GROUPS.map((group) => {
            const Icon = group.icon;
            const tone = toneClasses(group.tone);
            const groupTickets = groupedTickets[group.key] || [];
            const isOpen = !!expandedGroups[group.key];
            const limit = visibleLimits[group.key] || DEFAULT_GROUP_LIMIT;
            const visibleTickets = groupTickets.slice(0, limit);

            return (
              <section
                key={group.key}
                id={`ticket-group-${group.key}`}
                className={`overflow-hidden rounded-3xl border bg-[#071332] shadow-2xl ${tone.card} ${
                  activeGroup === group.key ? 'ring-1 ring-white/10' : ''
                }`}
              >
                <div className="flex w-full items-center justify-between gap-3 border-b border-blue-400/10 bg-[#0B1E4D] p-5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-lg ${tone.icon}`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-white">
                        {group.label}
                      </h2>

                      <p className="mt-1 line-clamp-1 text-xs text-blue-100/60">
                        {group.description}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    <span
                      className={`hidden rounded-xl border px-4 py-2 text-base font-black lg:inline-flex ${tone.card} ${tone.text}`}
                    >
                      {groupTickets.length}
                    </span>

                    <Button
                      onClick={() => clearAndSetGroup(group.key)}
                      className={`${tone.button} hidden xl:inline-flex`}
                    >
                      {group.action}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [group.key]: !prev[group.key],
                        }))
                      }
                      className="rounded-xl p-2 text-blue-100/70 hover:bg-white/10"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="p-4">
                    {groupTickets.length === 0 ? (
                      <div className="rounded-2xl border border-blue-400/10 bg-[#06143A] p-10 text-center text-sm text-blue-100/60">
                        No tickets in this group.
                      </div>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                        {visibleTickets.map((ticket) => (
                          <TicketDashboardCard
                            key={ticket.id}
                            ticket={ticket}
                            expanded={expandedTicketId === ticket.id}
                            canReviewCompletion={canReviewCompletion}
                            canShareTicket={canShareTicket}
                            onToggle={() =>
                              setExpandedTicketId((current) =>
                                current === ticket.id ? null : ticket.id
                              )
                            }
                            onApprove={() => approveCompletion(ticket)}
                            onReject={() => {
                              setRejectingTicket(ticket);
                              setRejectReason('');
                            }}
                            onPrint={() => printTicket(ticket)}
                            onShare={() => shareTicket(ticket)}
                            onEscalate={() => escalateTicket(ticket)}
                          />
                        ))}
                      </div>
                    )}

                    {groupTickets.length > limit && (
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          className="w-full border-blue-400/20 bg-white/5 text-white hover:bg-white/10"
                          onClick={() =>
                            setVisibleLimits((prev) => ({
                              ...prev,
                              [group.key]:
                                (prev[group.key] || DEFAULT_GROUP_LIMIT) +
                                DEFAULT_GROUP_LIMIT,
                            }))
                          }
                        >
                          Show more {group.label}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {rejectingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-red-500/20 bg-[#071332] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white">
              Reject Completion
            </h2>

            <p className="mt-1 text-sm text-blue-100/60">
              Enter reason for rejection. This returns the job to engineer but
              keeps the ticket open.
            </p>

            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={5}
              placeholder="Explain what the engineer must correct..."
              className="mt-4 w-full rounded-2xl border border-blue-400/10 bg-[#06143A] p-3 text-sm text-white outline-none placeholder:text-blue-100/30 focus:border-orange-500"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                className="border-blue-400/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  setRejectingTicket(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>

              <Button variant="destructive" onClick={rejectCompletion}>
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

function DashboardCard({ title, value, subtitle, icon, tone, onClick }) {
  const toneClass = toneClasses(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left shadow-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 ${toneClass.card} ${toneClass.glow}`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg ${toneClass.icon}`}
        >
          {icon}
        </div>

        <p className="text-4xl font-black text-white">{value}</p>
      </div>

      <h3 className="mt-4 font-black text-white">{title}</h3>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-blue-100/65">{subtitle}</p>
        <ArrowRight className={`h-4 w-4 ${toneClass.text}`} />
      </div>
    </button>
  );
}

function StatusQuickCard({ item, value, active, onClick }) {
  const Icon = item.icon;
  const tone = toneClasses(item.tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center justify-between rounded-2xl border p-4 text-left transition hover:bg-white/10',
        active
          ? `${tone.card} ring-1 ring-white/10`
          : 'border-blue-400/10 bg-white/5',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tone.icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-xs text-blue-100/60">{item.label}</p>
          <p className="text-lg font-black text-white">{value}</p>
        </div>
      </div>

      <ArrowRight className={`h-4 w-4 ${tone.text}`} />
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-blue-100/70">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-blue-400/10 bg-[#06143A] px-3 text-sm text-white outline-none focus:border-orange-500"
      >
        {options.map((item) => (
          <option
            key={item.value}
            value={item.value}
            className="bg-[#06143A] text-white"
          >
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TicketDashboardCard({
  ticket,
  expanded,
  canReviewCompletion,
  canShareTicket,
  onToggle,
  onApprove,
  onReject,
  onPrint,
  onShare,
  onEscalate,
}) {
  const timeline = getTimeline(ticket).filter((row) => row.value);
  const finalClosed = isFinalClosedTicket(ticket);
  const canReviewThis =
    canReviewCompletion &&
    isPendingReviewTicket(ticket) &&
    !finalClosed;

  return (
    <article className="overflow-hidden rounded-3xl border border-blue-400/10 bg-[#0B1E4D] shadow-xl transition hover:border-orange-500/30">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-5 pb-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-orange-300">
              {ticket.ticket_number || ticket.ticket_id || ticket.id}
            </p>

            <h3 className="mt-2 line-clamp-2 text-lg font-black text-white">
              {ticket.title ||
                ticket.category ||
                ticket.description ||
                'Untitled ticket'}
            </h3>
          </div>

          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold capitalize ${getStatusStyle(ticket)}`}
          >
            {ticket.escalated
              ? 'Escalated'
              : String(ticket.status || 'open').replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-blue-100/65 md:grid-cols-2">
          <InfoLine
            icon={<User className="h-3.5 w-3.5" />}
            value={ticket.bank_name || ticket.client_name || 'Bank not set'}
          />
          <InfoLine
            icon={<MapPin className="h-3.5 w-3.5" />}
            value={ticket.branch_name || ticket.branch || 'Branch not set'}
          />
          <InfoLine
            icon={<Package className="h-3.5 w-3.5" />}
            value={ticket.terminal_id || ticket.device_name || 'Terminal not set'}
          />
          <InfoLine
            icon={<Clock className="h-3.5 w-3.5" />}
            value={niceDate(ticket.created_at)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-bold capitalize ${getPriorityStyle(ticket.priority)}`}
          >
            {ticket.priority || 'normal'}
          </span>

          {ticket.assigned_to_name ||
          ticket.assigned_engineer_email ||
          ticket.assigned_to ? (
            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-bold text-blue-200">
              {ticket.assigned_to_name ||
                ticket.assigned_engineer_email ||
                ticket.assigned_to}
            </span>
          ) : (
            <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-200">
              Unassigned
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-wrap gap-2 border-t border-blue-400/10 bg-[#081738] p-3">
        <Link
          to={`/tickets/${ticket.id}`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-orange-400/30 bg-orange-500/10 px-3 text-sm font-medium text-orange-200 hover:bg-orange-500/20"
        >
          <Eye className="mr-2 h-4 w-4" />
          Open Ticket
        </Link>

        {canShareTicket && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-400/20 bg-white/5 text-white hover:bg-white/10"
              onClick={onPrint}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-blue-400/20 bg-white/5 text-white hover:bg-white/10"
              onClick={onShare}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </>
        )}

        {!ticket.escalated && !finalClosed && (
          <Button
            variant="outline"
            size="sm"
            className="border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            onClick={onEscalate}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Escalate
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-blue-400/10 bg-[#071332] p-5">
          <div className="rounded-2xl border border-blue-400/10 bg-[#06143A] p-4">
            <p className="text-sm font-bold text-white">Issue / Description</p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-100/70">
              {ticket.description || ticket.title || 'No description supplied.'}
            </p>
          </div>

          {ticket.escalated && (
            <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm font-bold text-red-200">Escalation</p>
              <p className="mt-1 text-xs text-red-100/70">
                {ticket.escalation_reason || 'Escalated ticket.'}
              </p>
              <p className="mt-1 text-xs text-red-100/50">
                {ticket.escalated_at
                  ? niceDate(ticket.escalated_at)
                  : 'Time not recorded'}
              </p>
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-blue-400/10 bg-[#06143A] p-4">
            <p className="mb-3 text-sm font-bold text-white">
              Engineer Timeline
            </p>

            {timeline.length === 0 ? (
              <p className="text-sm text-blue-100/50">
                No engineer response times recorded yet.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {timeline.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl border border-blue-400/10 bg-[#0B1E4D] p-3"
                  >
                    <p className="text-xs text-blue-100/45">{row.label}</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {niceDate(row.value)}
                    </p>

                    {row.note && (
                      <p className="mt-1 line-clamp-2 text-xs text-blue-100/45">
                        {row.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <EngineerPhotoGallery ticket={ticket} />

          {canReviewThis && (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                onClick={onReject}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>

              <Button
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={onApprove}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve / Close
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function InfoLine({ icon, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-orange-300">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}