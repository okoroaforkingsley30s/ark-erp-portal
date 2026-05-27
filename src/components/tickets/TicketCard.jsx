import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  statusColors,
  statusLabels,
  priorityColors,
  priorityLabels,
  categoryLabels,
} from '@/lib/utils/ticketUtils';
import { format, isValid } from 'date-fns';
import { User, Clock, Tag } from 'lucide-react';

const safeDate = (value) => {
  if (!value) return 'No date';

  const date = new Date(value);

  if (!isValid(date)) return 'No date';

  return format(date, 'MMM d, yyyy h:mm a');
};

export default function TicketCard({ ticket }) {
  const created =
    ticket.created_date ||
    ticket.created_at ||
    ticket.received_at ||
    ticket.updated_at;

  return (
    <Link to={`/tickets/${ticket.id}`}>
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">
                {ticket.ticket_id || ticket.ticket_number || ticket.id}
              </span>

              <Badge
                variant="outline"
                className={`${priorityColors[ticket.priority] || ''} text-[10px]`}
              >
                {priorityLabels[ticket.priority] || ticket.priority || 'Medium'}
              </Badge>

              <Badge
                variant="outline"
                className={`${statusColors[ticket.status] || ''} text-[10px]`}
              >
                {statusLabels[ticket.status] || ticket.status || 'New'}
              </Badge>
            </div>

            <h3 className="font-semibold text-sm truncate">
              {ticket.title || 'Untitled Ticket'}
            </h3>

            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {ticket.description || 'No description provided'}
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {ticket.assigned_to_name ||
                  ticket.assigned_to ||
                  ticket.assigned_engineer_email ||
                  'Unassigned'}
              </span>

              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {safeDate(created)}
              </span>

              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {categoryLabels[ticket.category] || ticket.category || 'General'}
              </span>
            </div>

            {(ticket.bank_name || ticket.branch_name || ticket.terminal_id) && (
              <p className="text-xs text-muted-foreground mt-2">
                {ticket.bank_name || ''}
                {ticket.branch_name ? ` · ${ticket.branch_name}` : ''}
                {ticket.terminal_id ? ` · ${ticket.terminal_id}` : ''}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}