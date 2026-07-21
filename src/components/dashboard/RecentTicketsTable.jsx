import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  statusColors,
  statusLabels,
  priorityColors,
  priorityLabels,
} from '@/lib/utils/ticketUtils';
import { format, isValid } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const safeDate = (value) => {
  if (!value) return 'No date';

  const date = new Date(value);

  if (!isValid(date)) return 'No date';

  return format(date, 'MMM d, h:mm a');
};

export default function RecentTicketsTable({
  tickets = [],
}) {
  const recent = tickets.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">
          Recent Tickets
        </CardTitle>

        <Link to="/tickets">
          <Button variant="ghost" size="sm" className="text-xs">
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tickets yet
            </p>
          )}

          {recent.map((ticket) => {
            const created =
              ticket.created_date ||
              ticket.created_at ||
              ticket.received_at ||
              ticket.updated_at;

            return (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {ticket.title || 'Untitled Ticket'}
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(ticket.ticket_id || ticket.id || 'NO-ID')} • {safeDate(created)}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={`${priorityColors[ticket.priority] || ''} text-[10px] shrink-0`}
                >
                  {priorityLabels[ticket.priority] || ticket.priority || 'medium'}
                </Badge>

                <Badge
                  variant="outline"
                  className={`${statusColors[ticket.status] || ''} text-[10px] shrink-0`}
                >
                  {statusLabels[ticket.status] || ticket.status || 'open'}
                </Badge>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
