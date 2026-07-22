import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Building2, CheckCircle2, Download, Loader2, MonitorCog, Printer, RefreshCw, Ticket, Users, Wrench } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const periods = [30, 90, 180, 365];

function exportReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ark-one-operational-report-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [days, setDays] = useState(90);
  const { data: report, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['system-operational-report', days],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('ark_system_operational_report', { p_days: days });
      if (rpcError) throw rpcError;
      return data || { summary: {}, ticket_trend: [], departments: [] };
    },
  });

  const summary = report?.summary || {};
  const cards = [
    ['Tickets', summary.tickets, Ticket],
    ['Open tickets', summary.open_tickets, Activity],
    ['Closed tickets', summary.closed_tickets, CheckCircle2],
    ['Escalations', summary.escalations, RefreshCw],
    ['RR jobs', summary.repair_jobs, Wrench],
    ['Active users', summary.active_users, Users],
    ['Managed devices', summary.devices, MonitorCog],
    ['Branches', summary.branches, Building2],
  ];

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">System Operational Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Live non-financial service, people, RR and infrastructure reporting. Confidential Finance records are excluded.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            {periods.map((period) => <option key={period} value={period}>Last {period} days</option>)}
          </select>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Print</Button>
          <Button variant="outline" disabled={!report} onClick={() => exportReport(report)}><Download className="w-4 h-4 mr-2" />Export</Button>
          <Button onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      {error && <Card className="p-4 border-red-400/40 text-red-400">Report could not load: {error.message}</Card>}
      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-9 h-9 animate-spin text-primary" /></div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map(([label, value, Icon]) => (
              <Card key={label} className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value || 0}</p></div><Icon className="w-6 h-6 text-primary" /></div></Card>
            ))}
          </div>

          <div className="grid xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ticket activity</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={report?.ticket_trend || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="created" name="Created" stroke="#f97316" strokeWidth={2} /><Line type="monotone" dataKey="closed" name="Closed" stroke="#22c55e" strokeWidth={2} /></LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Users by department</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report?.departments || []} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="users" name="Active records" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap justify-between gap-3 text-sm"><span>Audit events in period: <strong>{summary.audit_events || 0}</strong></span><span>Snapshot generated: <strong>{report?.generated_at ? new Date(report.generated_at).toLocaleString() : '—'}</strong></span><span>Source: <strong>Live production database</strong></span></div>
          </Card>
        </>
      )}
    </div>
  );
}
