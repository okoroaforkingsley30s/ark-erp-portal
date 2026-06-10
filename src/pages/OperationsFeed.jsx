import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
} from 'lucide-react';

async function fetchOperationsEvents() {
  const { data, error } = await supabase
    .from('operations_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return data || [];
}

function severityClass(severity) {
  const s = String(severity || '').toLowerCase();

  if (s === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (s === 'warning') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (s === 'success') return 'bg-green-500/15 text-green-300 border-green-500/30';

  return 'bg-primary/10 text-primary border-primary/30';
}

function eventIcon(severity) {
  const s = String(severity || '').toLowerCase();

  if (s === 'critical') return <AlertTriangle className="w-4 h-4 text-red-400" />;
  if (s === 'success') return <CheckCircle2 className="w-4 h-4 text-green-400" />;

  return <Activity className="w-4 h-4 text-primary" />;
}

function formatDate(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function OperationsFeed() {
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['operations-events-feed'],
    queryFn: fetchOperationsEvents,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-5 pb-16">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Operations Feed
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Real-time activity from Field Engineers, Helpdesk, Inventory, Finance and Operations.
        </p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Events</p>
            <p className="text-2xl font-bold">{events.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-red-400">
              {events.filter((e) => e.severity === 'critical').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tickets</p>
            <p className="text-2xl font-bold">
              {events.filter((e) => e.entity_type === 'ticket').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Departments</p>
            <p className="text-2xl font-bold">
              {new Set(events.map((e) => e.department).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Live Activity Timeline</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Loading operations feed...
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400 py-10 text-center">
              Could not load operations feed.
            </p>
          )}

          {!isLoading && !error && events.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No OIN events yet. Perform an action from FEMobi or Helpdesk.
            </p>
          )}

          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-border bg-card/70 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {eventIcon(event.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">
                        {event.title || event.event_type || 'Operation Event'}
                      </p>

                      <Badge
                        variant="outline"
                        className={`text-[10px] ${severityClass(event.severity)}`}
                      >
                        {event.severity || 'info'}
                      </Badge>

                      {event.department && (
                        <Badge variant="outline" className="text-[10px]">
                          {event.department}
                        </Badge>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {event.actor_name || 'System'}
                      </span>

                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(event.created_at)}
                      </span>

                      {event.entity_type && (
                        <span>
                          {event.entity_type}: {event.entity_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}