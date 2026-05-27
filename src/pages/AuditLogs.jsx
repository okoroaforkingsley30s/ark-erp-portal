import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Activity, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const actionColors = {
  ticket_created: 'bg-blue-100 text-blue-700',
  ticket_updated: 'bg-amber-100 text-amber-700',
  ticket_resolved: 'bg-green-100 text-green-700',
  user_updated: 'bg-purple-100 text-purple-700',
};

export default function AuditLogs() {
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Audit logs fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const filtered = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();

    return (
      l.action?.toLowerCase().includes(s) ||
      l.user_name?.toLowerCase().includes(s) ||
      l.user_email?.toLowerCase().includes(s) ||
      l.entity_type?.toLowerCase().includes(s) ||
      l.details?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System activity trail</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search logs..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No audit logs found</p>
            </div>
          )}

          {filtered.map(log => (
            <Card key={log.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge className={`${actionColors[log.action] || 'bg-slate-100 text-slate-600'} text-[10px]`}>
                      {log.action?.replace(/_/g, ' ') || 'activity'}
                    </Badge>

                    <span className="text-[10px] text-muted-foreground">
                      {log.entity_type || 'system'}
                    </span>
                  </div>

                  <p className="text-sm">{log.details || 'No details'}</p>

                  <p className="text-[10px] text-muted-foreground mt-1">
                    {log.user_name || log.user_email || 'System'} •{' '}
                    {log.created_at
                      ? format(new Date(log.created_at), 'MMM d, yyyy h:mm a')
                      : 'No date'}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}