import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Activity, CalendarDays, Download, Loader2, Printer, Search, ShieldCheck } from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const entityOptions = ['all', 'tickets', 'repair_jobs', 'part_requests', 'rr_consumable_requests', 'fund_requests', 'user_profiles', 'crm_leads', 'crm_clients', 'ark_department_import_batches'];

function displayDetails(value) {
  if (!value) return 'No details recorded';
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key.replace(/_/g, ' ')}: ${item}`).join(' · ');
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return displayDetails(parsed);
  } catch {
    // Older audit rows are plain text.
  }
  return String(value);
}

function downloadCsv(rows) {
  const header = ['Date', 'User', 'Email', 'Action', 'Module', 'Reference', 'Details'];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((row) => [row.created_at, row.user_name, row.user_email, row.action, row.entity_type, row.entity_id, displayDetails(row.details)].map(escape).join(','));
  const blob = new Blob([[header.map(escape).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ark-one-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-audit-feed', search, entityType, fromDate, toDate],
    queryFn: async () => {
      const { data: result, error: rpcError } = await supabase.rpc('ark_admin_audit_feed', {
        p_search: search.trim() || null,
        p_entity_type: entityType === 'all' ? null : entityType,
        p_from: fromDate ? `${fromDate}T00:00:00` : null,
        p_to: toDate ? `${toDate}T23:59:59` : null,
        p_limit: 750,
      });
      if (rpcError) throw rpcError;
      return result || { rows: [], count: 0 };
    },
  });

  const rows = useMemo(() => data?.rows || [], [data]);

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" />System Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-1">Searchable operational history across users, departments, tickets, RR and imports.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Print</Button>
          <Button variant="outline" onClick={() => downloadCsv(rows)} disabled={!rows.length}><Download className="w-4 h-4 mr-2" />CSV</Button>
          <Button onClick={() => refetch()} disabled={isFetching}>{isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}</Button>
        </div>
      </div>

      <Card className="p-4 grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="User, action, module or reference..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
          {entityOptions.map((option) => <option key={option} value={option}>{option === 'all' ? 'All modules' : option.replace(/_/g, ' ')}</option>)}
        </select>
        <label className="relative"><CalendarDays className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" /><Input className="pl-9" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Matching events</p><p className="text-2xl font-bold">{data?.count || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Users represented</p><p className="text-2xl font-bold">{new Set(rows.map((row) => row.user_email).filter(Boolean)).size}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Modules represented</p><p className="text-2xl font-bold">{new Set(rows.map((row) => row.entity_type).filter(Boolean)).size}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Last synchronized</p><p className="text-sm font-semibold mt-1">{data?.generated_at ? format(new Date(data.generated_at), 'MMM d, h:mm a') : '—'}</p></Card>
      </div>

      {error && <Card className="p-4 border-red-400/40 text-red-400">Audit feed could not load: {error.message}</Card>}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="text-center py-16 text-muted-foreground"><Activity className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No matching audit events.</p></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((log, index) => (
            <Card key={`${log.id}-${index}`} className="p-4 break-inside-avoid">
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">{log.action?.replace(/_/g, ' ') || 'activity'}</Badge>
                    <Badge className="capitalize">{log.entity_type?.replace(/_/g, ' ') || 'system'}</Badge>
                    {log.entity_id && <span className="font-mono text-[11px] text-muted-foreground">{log.entity_id}</span>}
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{displayDetails(log.details)}</p>
                  <p className="text-xs text-muted-foreground mt-2">{log.user_name || log.user_email || 'System'}{log.user_email && log.user_name !== log.user_email ? ` · ${log.user_email}` : ''} · {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy h:mm:ss a') : 'No date'}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
