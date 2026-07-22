import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CheckCircle2, Clock3, Loader2, MessageSquareWarning, Printer, RefreshCw, Route, Ticket, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getUserRole } from '@/lib/roleAccess';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';

async function fetchRows(table) {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export default function CRMDepartmentHandoffs() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const isHelpdesk = getUserRole(user) === 'helpdesk';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('open');
  const [working, setWorking] = useState('');
  const handoffsQuery = useQuery({ queryKey: ['crm-handoffs'], queryFn: () => fetchRows('crm_department_handoffs') });
  const clientsQuery = useQuery({ queryKey: ['crm-handoff-clients'], queryFn: () => fetchRows('crm_clients') });
  const complaintsQuery = useQuery({ queryKey: ['crm-helpdesk-complaints'], queryFn: () => fetchRows('crm_complaints'), enabled: isHelpdesk });
  const clients = useMemo(() => Object.fromEntries((clientsQuery.data || []).map((row) => [row.id, row])), [clientsQuery.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['crm-handoffs'] }); qc.invalidateQueries({ queryKey: ['crm-handoff-clients'] }); qc.invalidateQueries({ queryKey: ['crm-helpdesk-complaints'] }); };

  useEffect(() => {
    const channel = supabase.channel('crm-handoffs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_department_handoffs' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_complaints' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = (handoffsQuery.data || []).filter((row) => {
    const client = clients[row.client_id] || {};
    const text = `${client.client_name || ''} ${client.client_code || ''} ${row.assigned_department} ${row.handoff_type} ${row.instructions}`.toLowerCase();
    const matchesStatus = status === 'all' || (status === 'open' ? !['completed', 'rejected'].includes(row.status) : row.status === status);
    return matchesStatus && text.includes(search.toLowerCase().trim());
  });

  const act = async (row, action) => {
    const note = window.prompt(action === 'reject' ? 'Rejection reason (required):' : 'Response note (optional):') || '';
    if (action === 'reject' && !note) return;
    setWorking(row.id);
    try {
      const { error } = await supabase.rpc('ark_crm_update_handoff', { p_handoff_id: row.id, p_action: action, p_note: note });
      if (error) throw error;
      refresh();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Handoff update failed');
    } finally { setWorking(''); }
  };

  const createComplaintTicket = async (complaint) => {
    setWorking(complaint.id);
    try {
      const { data, error } = await supabase.rpc('ark_crm_create_ticket_from_complaint', { p_complaint_id: complaint.id });
      if (error) throw error;
      refresh();
      if (data?.ticket?.id) navigate(`/tickets/${data.ticket.id}`);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Helpdesk ticket creation failed');
    } finally { setWorking(''); }
  };

  const routedComplaints = (complaintsQuery.data || []).filter((row) => row.status === 'routed_to_helpdesk' && !row.ticket_id);

  return <div className="space-y-5 pb-20 text-slate-100">
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><Route className="text-[#ff5a00]" />Client Department Handoffs</h1><p className="text-sm text-slate-400">Receiving departments acknowledge and complete approved Business Development onboarding work here.</p></div><div className="flex gap-2"><Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button></div></header>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['Pending', (handoffsQuery.data || []).filter((r) => r.status === 'pending').length],
      ['Acknowledged', (handoffsQuery.data || []).filter((r) => r.status === 'acknowledged').length],
      ['Completed', (handoffsQuery.data || []).filter((r) => r.status === 'completed').length],
      ['Rejected', (handoffsQuery.data || []).filter((r) => r.status === 'rejected').length],
    ].map(([label,value]) => <Card key={label} className="border-[#ff5a00]/20 bg-[#102969] p-4"><p className="text-xs uppercase text-slate-400">{label}</p><p className="text-3xl font-black">{value}</p></Card>)}</section>
    <div className="flex gap-2"><Input placeholder="Search client, department or work…" value={search} onChange={(e) => setSearch(e.target.value)} /><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{['open','all','pending','acknowledged','completed','rejected'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
    {isHelpdesk && <section className="space-y-3"><h2 className="flex items-center gap-2 text-xl font-bold"><MessageSquareWarning className="text-[#ff5a00]" />CRM Complaints Awaiting Helpdesk Ticket</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{routedComplaints.map((complaint) => <Card key={complaint.id} className="border-amber-400/30 bg-[#102969] p-4"><div className="flex justify-between"><div><p className="font-mono text-xs text-slate-400">{complaint.complaint_number}</p><b>{complaint.issue_title}</b></div><Badge variant="outline">{complaint.priority}</Badge></div><p className="mt-2 text-sm">{complaint.client_name}</p><p className="my-3 line-clamp-3 text-xs text-slate-300">{complaint.issue_description}</p><div className="text-xs text-slate-400"><p>Contact: {complaint.contact_name || '—'}</p><p>{complaint.contact_email || complaint.contact_phone || 'No contact recorded'}</p><p>Submitted: {dateTime(complaint.updated_at)}</p></div><Button className="mt-3 bg-[#ff5a00]" size="sm" disabled={working === complaint.id} onClick={() => createComplaintTicket(complaint)}><Ticket className="mr-2 h-3 w-3" />Create Helpdesk Ticket</Button></Card>)}{!routedComplaints.length && <p className="col-span-full rounded-lg border border-white/10 p-6 text-center text-sm text-slate-500">No CRM complaints are awaiting ticket creation.</p>}</div>
    </section>}
    {(handoffsQuery.isLoading || clientsQuery.isLoading || complaintsQuery.isLoading) && <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#ff5a00]" />}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => { const client = clients[row.client_id] || {}; const final = ['completed','rejected'].includes(row.status); return <Card key={row.id} className="border-[#ff5a00]/20 bg-[#102969] p-4">
      <div className="flex justify-between gap-2"><div><p className="font-mono text-xs text-slate-400">{client.client_code || row.client_id.slice(0,8)}</p><b>{client.client_name || 'Client record'}</b></div><Badge variant="outline">{row.status}</Badge></div>
      <div className="my-3 space-y-1 text-xs text-slate-300"><p><b>Department:</b> {row.assigned_department}</p><p><b>Work:</b> {row.handoff_type.replaceAll('_',' ')}</p><p><b>Instruction:</b> {row.instructions}</p><p><b>Created:</b> {dateTime(row.created_at)}</p>{row.response_note && <p className="rounded bg-black/20 p-2"><b>Response:</b> {row.response_note}</p>}</div>
      {!final && <div className="flex flex-wrap gap-2">{row.status === 'pending' && <Button size="sm" variant="outline" disabled={working === row.id} onClick={() => act(row,'acknowledge')}><Clock3 className="mr-1 h-3 w-3" />Acknowledge</Button>}<Button size="sm" className="bg-emerald-600" disabled={working === row.id} onClick={() => act(row,'complete')}><CheckCircle2 className="mr-1 h-3 w-3" />Complete</Button><Button size="sm" variant="destructive" disabled={working === row.id} onClick={() => act(row,'reject')}><XCircle className="mr-1 h-3 w-3" />Reject</Button></div>}
    </Card>; })}{!rows.length && !handoffsQuery.isLoading && <p className="col-span-full py-12 text-center text-slate-500">No handoffs match this view.</p>}</section>
  </div>;
}
