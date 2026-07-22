import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Building2, ClipboardCheck,
  Clock3, History, Loader2, Mail, MessageSquareWarning, Pencil,
  Phone, Plus, Printer, RefreshCw, Route, Search, Star, Target, TrendingUp, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getUserRole } from '@/lib/roleAccess';
import { useFormDraft } from '@/hooks/useFormDraft';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const LEAD_STATUS = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', pending_won_approval: 'Won — Awaiting Approval', won: 'Won', lost: 'Lost',
};
const LEAD_FLOW = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'pending_won_approval', 'lost'];
const STATUS_STYLE = {
  new: 'border-blue-400/40 text-blue-200', contacted: 'border-cyan-400/40 text-cyan-200',
  qualified: 'border-violet-400/40 text-violet-200', proposal: 'border-amber-400/40 text-amber-200',
  negotiation: 'border-orange-400/40 text-orange-200', pending_won_approval: 'border-yellow-300 text-yellow-200',
  won: 'border-emerald-400/40 text-emerald-200', lost: 'border-red-400/40 text-red-200',
  open: 'border-red-400/40 text-red-200', ticket_created: 'border-blue-400/40 text-blue-200',
  routed_to_helpdesk: 'border-amber-400/40 text-amber-200',
  resolved: 'border-emerald-400/40 text-emerald-200', closed: 'border-slate-400/40 text-slate-200',
};
const EMPTY_LEAD = {
  company_name: '', contact_name: '', contact_email: '', contact_phone: '', industry: '', source: 'other',
  status: 'new', estimated_value: '', devices_interested: '', notes: '', next_followup: '', probability: 10,
  expected_close_date: '', opportunity_type: 'general', currency: 'NGN', lost_reason: '',
};
const EMPTY_COMPLAINT = {
  client_id: '', client_name: '', contact_name: '', contact_email: '', contact_phone: '', issue_title: '',
  issue_description: '', priority: 'medium', complaint_type: 'technical_support', routed_department: 'Helpdesk',
  followup_date: '', satisfaction_rating: '', feedback: '',
};
const EMPTY_ACTIVITY = {
  activity_type: 'call', subject: '', notes: '', outcome: '', next_action_at: '',
};
const money = (value, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const norm = (value) => String(value || '').toLowerCase().trim();
const when = (value, withTime = false) => value ? format(new Date(value), withTime ? 'MMM d, yyyy h:mm a' : 'MMM d, yyyy') : '—';
const due = (value) => Boolean(value && new Date(value) <= new Date());

async function tableRows(table) {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export default function CRMPortal() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const role = getUserRole(user);
  const canReview = ['head_of_business_development', 'ceo', 'agm', 'manager'].includes(role);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState('leads');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leadOpen, setLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [complaintForm, setComplaintForm] = useState(EMPTY_COMPLAINT);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityTarget, setActivityTarget] = useState(null);
  const [activityForm, setActivityForm] = useState(EMPTY_ACTIVITY);
  const [saving, setSaving] = useState(false);

  const draft = { userId: user?.id || user?.email, storage: 'session', maxAgeMs: 8 * 60 * 60 * 1000 };
  useFormDraft({ key: editingLead?.id ? `crm-lead:${editingLead.id}` : 'crm-lead:new', form: leadForm, setForm: setLeadForm, enabled: leadOpen, ...draft });
  useFormDraft({ key: editingComplaint?.id ? `crm-complaint:${editingComplaint.id}` : 'crm-complaint:new', form: complaintForm, setForm: setComplaintForm, enabled: complaintOpen, ...draft });

  const leadsQuery = useQuery({ queryKey: ['crm-leads'], queryFn: () => tableRows('leads') });
  const clientsQuery = useQuery({ queryKey: ['crm-clients'], queryFn: () => tableRows('crm_clients') });
  const complaintsQuery = useQuery({ queryKey: ['crm-complaints'], queryFn: () => tableRows('crm_complaints') });
  const activitiesQuery = useQuery({ queryKey: ['crm-activities'], queryFn: () => tableRows('crm_activities') });
  const historyQuery = useQuery({ queryKey: ['crm-history'], queryFn: () => tableRows('crm_workflow_history') });
  const leads = leadsQuery.data || [];
  const clients = clientsQuery.data || [];
  const complaints = complaintsQuery.data || [];
  const activities = activitiesQuery.data || [];
  const history = historyQuery.data || [];
  const loading = leadsQuery.isLoading || clientsQuery.isLoading || complaintsQuery.isLoading;

  const refresh = () => ['crm-leads', 'crm-clients', 'crm-complaints', 'crm-activities', 'crm-history']
    .forEach((key) => qc.invalidateQueries({ queryKey: [key] }));

  useEffect(() => {
    const channel = supabase.channel('crm-live-workflow')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_clients' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_complaints' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_activities' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_department_handoffs' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = (row, fields) => !norm(search) || fields.some((field) => norm(row[field]).includes(norm(search)));
  const filteredLeads = useMemo(() => leads.filter((row) =>
    (statusFilter === 'all' || row.status === statusFilter) && matches(row, ['company_name', 'contact_name', 'contact_email', 'industry', 'devices_interested', 'owner_name'])
  ), [leads, search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredClients = useMemo(() => clients.filter((row) => matches(row, ['client_code', 'client_name', 'contact_name', 'contact_email', 'relationship_manager', 'onboarding_status'])), [clients, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredComplaints = useMemo(() => complaints.filter((row) => matches(row, ['complaint_number', 'client_name', 'issue_title', 'ticket_number', 'routed_department'])), [complaints, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const rpc = async (name, args) => {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
  };
  const run = async (work, success) => {
    setSaving(true);
    try { await work(); refresh(); if (success) alert(success); }
    catch (error) { console.error(error); alert(error.message || 'Action failed'); }
    finally { setSaving(false); }
  };

  const editLead = (lead = null) => {
    setEditingLead(lead);
    setLeadForm(lead ? { ...EMPTY_LEAD, ...lead, estimated_value: lead.estimated_value || '', next_followup: lead.next_followup || '', expected_close_date: lead.expected_close_date || '' } : EMPTY_LEAD);
    setLeadOpen(true);
  };
  const saveLead = () => run(async () => {
    await rpc('ark_crm_save_lead', { p_payload: leadForm, p_lead_id: editingLead?.id || null });
    setLeadOpen(false); setEditingLead(null); setLeadForm(EMPTY_LEAD);
  }, editingLead ? 'Lead updated.' : 'Lead created and assigned to you.');
  const transitionLead = (lead, target) => {
    let note = null;
    if (target === 'lost') note = window.prompt('Enter the reason this opportunity was lost:');
    if (target === 'lost' && !note) return;
    run(() => rpc('ark_crm_transition_lead', { p_lead_id: lead.id, p_target_status: target, p_note: note }),
      target === 'pending_won_approval' ? 'Won business submitted to Head of Business Development.' : 'Lead stage updated.');
  };
  const reviewWon = (lead, decision) => {
    const note = window.prompt(decision === 'reject' ? 'Rejection reason (required):' : 'Approval note (optional):') || '';
    if (decision === 'reject' && !note) return;
    run(() => rpc('ark_crm_review_won_lead', { p_lead_id: lead.id, p_decision: decision, p_note: note }),
      decision === 'approve' ? 'Won business approved. Client and departmental handoffs created.' : 'Lead returned to negotiation.');
  };
  const openActivity = (lead) => { setActivityTarget(lead); setActivityForm(EMPTY_ACTIVITY); setActivityOpen(true); };
  const saveActivity = () => run(async () => {
    await rpc('ark_crm_log_activity', { p_payload: { ...activityForm, lead_id: activityTarget.id } });
    setActivityOpen(false);
  }, 'Activity recorded.');

  const editComplaint = (complaint = null, client = null) => {
    setEditingComplaint(complaint);
    setComplaintForm(complaint ? { ...EMPTY_COMPLAINT, ...complaint, satisfaction_rating: complaint.satisfaction_rating || '', followup_date: complaint.followup_date || '' } : client ? {
      ...EMPTY_COMPLAINT, client_id: client.id, client_name: client.client_name, contact_name: client.contact_name || '',
      contact_email: client.contact_email || '', contact_phone: client.contact_phone || '', relationship_manager_email: client.relationship_manager_email || '',
    } : EMPTY_COMPLAINT);
    setComplaintOpen(true);
  };
  const saveComplaint = () => run(async () => {
    await rpc('ark_crm_save_complaint', { p_payload: complaintForm, p_complaint_id: editingComplaint?.id || null });
    setComplaintOpen(false); setEditingComplaint(null);
  }, editingComplaint ? 'CRM complaint updated.' : 'CRM complaint logged.');
  const routeComplaint = (complaint) => run(
    () => rpc('ark_crm_route_complaint_to_helpdesk', { p_complaint_id: complaint.id }),
    'Complaint submitted to Helpdesk. Helpdesk will create and own the support ticket.'
  );
  const closeComplaint = (complaint) => {
    const rating = Number(window.prompt('Enter the client satisfaction rating (1–5):'));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return alert('Enter a rating from 1 to 5.');
    const feedback = window.prompt('Record the client feedback or closure note:') || '';
    run(() => rpc('ark_crm_close_complaint', { p_complaint_id: complaint.id, p_satisfaction_rating: rating, p_feedback: feedback }), 'Complaint closed after client follow-up.');
  };

  const pipeline = leads.filter((lead) => !['won', 'lost'].includes(lead.status)).reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  const cards = [
    ['Pipeline', leads.filter((lead) => !['won', 'lost'].includes(lead.status)).length, `${money(pipeline)} open value`],
    ['Won Approval', leads.filter((lead) => lead.status === 'pending_won_approval').length, 'Head BD action required'],
    ['Active Clients', clients.filter((client) => client.status === 'active').length, `${clients.filter((client) => client.onboarding_status === 'in_progress').length} onboarding`],
    ['Open Complaints', complaints.filter((item) => !['closed'].includes(item.status)).length, `${complaints.filter((item) => item.status === 'resolved').length} need client follow-up`],
  ];

  return <div className="space-y-5 pb-20 text-slate-100">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-3xl font-bold text-white"><TrendingUp className="text-[#ff5a00]" />Business Development & CRM</h1>
        <p className="text-sm text-slate-400">Lead ownership, Head approval, client onboarding, departmental handoffs and complaint recovery.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print CRM Report</Button>
        <Button variant="outline" onClick={() => navigate('/crm-handoffs')}><Route className="mr-2 h-4 w-4" />Department Handoffs</Button>
        <Button className="bg-[#ff5a00]" onClick={() => editLead()}><Plus className="mr-2 h-4 w-4" />Add Lead</Button></div>
    </header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(([title, value, note]) =>
      <Card key={title} className="border-[#ff5a00]/20 bg-[#102969]"><CardContent className="p-4"><p className="text-xs uppercase text-slate-400">{title}</p><p className="mt-1 text-3xl font-black text-white">{value}</p><p className="text-xs text-[#ff8a45]">{note}</p></CardContent></Card>)}</section>

    <div className="rounded-xl border border-[#ff5a00]/25 bg-[#102969] p-4 text-sm">
      <b className="text-[#ff8a45]">Controlled workflow:</b> Lead → Qualification → Proposal → Negotiation → Head BD Won Approval → Client → Department Handoffs → Delivery. Complaints route to Helpdesk and return here for client satisfaction closure.
    </div>

    <div className="flex flex-wrap gap-2">{[['leads','Lead Pipeline'],['clients','Clients & Onboarding'],['complaints','Complaints'],['activities','Activity & Audit']].map(([key,label]) =>
      <Button key={key} variant={tab === key ? 'default' : 'outline'} className={tab === key ? 'bg-[#ff5a00]' : ''} onClick={() => setTab(key)}>{label}</Button>)}</div>
    <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search CRM records…" /></div>
      {tab === 'leads' && <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{Object.entries(LEAD_STATUS).map(([key,label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>}</div>

    {loading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#ff5a00]" />}

    {tab === 'leads' && !loading && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredLeads.map((lead) =>
      <Card key={lead.id} className="border-[#ff5a00]/20 bg-[#102969] p-4">
        <div className="flex justify-between gap-3"><div><b className="text-white">{lead.company_name}</b><p className="text-xs text-slate-400">{lead.contact_name}</p></div><Badge variant="outline" className={STATUS_STYLE[lead.status]}>{LEAD_STATUS[lead.status] || lead.status}</Badge></div>
        <div className="my-3 space-y-1 text-xs text-slate-300">
          {lead.contact_email && <p className="flex gap-1"><Mail className="h-3 w-3" />{lead.contact_email}</p>}{lead.contact_phone && <p className="flex gap-1"><Phone className="h-3 w-3" />{lead.contact_phone}</p>}
          <p className="flex gap-1"><Target className="h-3 w-3" />{lead.opportunity_type?.replaceAll('_',' ')} · {lead.probability || 0}%</p>
          <p className="font-semibold text-[#ff8a45]">{money(lead.estimated_value, lead.currency || 'NGN')}</p>
          <p>Owner: {lead.owner_name || lead.owner_email || lead.assigned_to || 'Unassigned'}</p>
          <p className={due(lead.next_followup) ? 'text-yellow-300' : ''}>Next follow-up: {when(lead.next_followup)}</p>
          {lead.won_review_note && <p className="rounded bg-black/15 p-2">Review: {lead.won_review_note}</p>}
        </div>
        <div className="flex flex-wrap gap-2"><Select value={lead.status === 'won' ? 'won' : lead.status} disabled={lead.status === 'won' || lead.status === 'pending_won_approval'} onValueChange={(value) => transitionLead(lead, value)}><SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger><SelectContent>{LEAD_FLOW.map((key) => <SelectItem key={key} value={key}>{LEAD_STATUS[key]}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant="outline" onClick={() => openActivity(lead)}><Clock3 className="h-3 w-3" /></Button><Button size="sm" variant="outline" onClick={() => editLead(lead)}><Pencil className="h-3 w-3" /></Button></div>
        {canReview && lead.status === 'pending_won_approval' && <div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" variant="destructive" onClick={() => reviewWon(lead,'reject')}>Reject</Button><Button size="sm" className="bg-emerald-600" onClick={() => reviewWon(lead,'approve')}>Approve Won</Button></div>}
      </Card>)}{!filteredLeads.length && <Empty icon={Users} label="No leads found" />}</section>}

    {tab === 'clients' && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredClients.map((client) =>
      <Card key={client.id} className="border-[#ff5a00]/20 bg-[#102969] p-4"><div className="flex justify-between"><div><b>{client.client_name}</b><p className="font-mono text-xs text-slate-400">{client.client_code || 'Legacy client'}</p></div><Badge variant="outline">{client.onboarding_status || 'pending'}</Badge></div>
        <div className="my-3 space-y-1 text-xs text-slate-300"><p>{client.industry || 'Industry not recorded'}</p><p>{client.contact_name || 'No contact'} · {client.contact_email || 'No email'}</p><p>Relationship manager: {client.relationship_manager || 'Not assigned'}</p><p>Contract: {money(client.contract_value)}</p><p>Created: {when(client.created_at, true)}</p></div>
        <Button size="sm" className="bg-[#ff5a00]" onClick={() => editComplaint(null, client)}><MessageSquareWarning className="mr-2 h-3 w-3" />Log Complaint</Button>
      </Card>)}{!filteredClients.length && <Empty icon={Building2} label="No approved clients found" />}</section>}

    {tab === 'complaints' && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredComplaints.map((item) =>
      <Card key={item.id} className="border-[#ff5a00]/20 bg-[#102969] p-4"><div className="flex justify-between"><div><p className="font-mono text-xs text-slate-400">{item.complaint_number}</p><b>{item.issue_title}</b><p className="text-xs text-slate-400">{item.client_name}</p></div><Badge variant="outline" className={STATUS_STYLE[item.status]}>{item.status?.replaceAll('_',' ')}</Badge></div>
        <p className="my-3 line-clamp-3 text-xs text-slate-300">{item.issue_description}</p><div className="space-y-1 text-xs text-slate-400"><p>Type: {item.complaint_type?.replaceAll('_',' ')}</p><p>Route: {item.routed_department || 'Awaiting route'}</p><p>Ticket: {item.ticket_number || 'Not created'}</p>{item.resolution_summary && <p>Resolution: {item.resolution_summary}</p>}{item.satisfaction_rating && <p className="flex gap-1 text-yellow-300"><Star className="h-3 w-3" />{item.satisfaction_rating}/5</p>}</div>
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => editComplaint(item)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>{item.status === 'open' && !item.ticket_id && <Button size="sm" className="bg-[#ff5a00]" onClick={() => routeComplaint(item)}><ClipboardCheck className="mr-1 h-3 w-3" />Submit to Helpdesk</Button>}{item.status === 'routed_to_helpdesk' && <Badge variant="outline" className="border-amber-400/40 text-amber-200">Awaiting Helpdesk ticket</Badge>}{item.status === 'resolved' && <Button size="sm" className="bg-emerald-600" onClick={() => closeComplaint(item)}>Client Follow-up & Close</Button>}</div>
      </Card>)}{!filteredComplaints.length && <Empty icon={MessageSquareWarning} label="No complaints found" />}</section>}

    {tab === 'activities' && <section className="grid gap-4 lg:grid-cols-2"><AuditList title="Sales Activities" rows={activities} subject={(row) => row.subject} detail={(row) => `${row.activity_type} · ${row.created_by_name || row.created_by_email} · ${when(row.created_at, true)}`} /><AuditList title="Workflow Audit" rows={history} subject={(row) => row.action?.replaceAll('_',' ')} detail={(row) => `${row.entity_type}: ${row.from_status || 'start'} → ${row.to_status || 'recorded'} · ${row.actor_name || row.actor_email} · ${when(row.created_at, true)}`} /></section>}

    <Dialog open={leadOpen} onOpenChange={setLeadOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingLead ? 'Update Lead' : 'Capture New Lead'}</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2">
      <Field label="Company *"><Input value={leadForm.company_name} onChange={(e) => setLeadForm({...leadForm,company_name:e.target.value})} /></Field><Field label="Contact name *"><Input value={leadForm.contact_name} onChange={(e) => setLeadForm({...leadForm,contact_name:e.target.value})} /></Field>
      <Field label="Contact email"><Input type="email" value={leadForm.contact_email} onChange={(e) => setLeadForm({...leadForm,contact_email:e.target.value})} /></Field><Field label="Contact phone"><Input value={leadForm.contact_phone} onChange={(e) => setLeadForm({...leadForm,contact_phone:e.target.value})} /></Field>
      <Field label="Industry"><Input value={leadForm.industry} onChange={(e) => setLeadForm({...leadForm,industry:e.target.value})} /></Field><SelectField label="Source" value={leadForm.source} values={['referral','website','cold_call','email','event','other']} onChange={(value) => setLeadForm({...leadForm,source:value})} />
      <SelectField label="Opportunity type" value={leadForm.opportunity_type} values={['general','service_contract','product_supply','project_integration']} onChange={(value) => setLeadForm({...leadForm,opportunity_type:value})} /><Field label="Products / services"><Input value={leadForm.devices_interested} onChange={(e) => setLeadForm({...leadForm,devices_interested:e.target.value})} /></Field>
      <Field label="Estimated value"><Input type="number" min="0" value={leadForm.estimated_value} onChange={(e) => setLeadForm({...leadForm,estimated_value:e.target.value})} /></Field><Field label="Probability %"><Input type="number" min="0" max="100" value={leadForm.probability} onChange={(e) => setLeadForm({...leadForm,probability:e.target.value})} /></Field>
      <Field label="Next follow-up"><Input type="date" value={leadForm.next_followup || ''} onChange={(e) => setLeadForm({...leadForm,next_followup:e.target.value})} /></Field><Field label="Expected close"><Input type="date" value={leadForm.expected_close_date || ''} onChange={(e) => setLeadForm({...leadForm,expected_close_date:e.target.value})} /></Field>
      <div className="md:col-span-2"><Field label="Notes"><Textarea value={leadForm.notes} onChange={(e) => setLeadForm({...leadForm,notes:e.target.value})} /></Field></div></div><Button disabled={saving || !leadForm.company_name || !leadForm.contact_name} onClick={saveLead}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Lead</Button></DialogContent></Dialog>

    <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingComplaint ? 'Update Complaint' : 'Log Client Complaint'}</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2">
      <Field label="Client *"><Input value={complaintForm.client_name} onChange={(e) => setComplaintForm({...complaintForm,client_name:e.target.value})} /></Field><Field label="Contact"><Input value={complaintForm.contact_name} onChange={(e) => setComplaintForm({...complaintForm,contact_name:e.target.value})} /></Field>
      <Field label="Email"><Input value={complaintForm.contact_email} onChange={(e) => setComplaintForm({...complaintForm,contact_email:e.target.value})} /></Field><Field label="Phone"><Input value={complaintForm.contact_phone} onChange={(e) => setComplaintForm({...complaintForm,contact_phone:e.target.value})} /></Field>
      <SelectField label="Complaint type" value={complaintForm.complaint_type} values={['technical_support','service_delivery','billing','product_supply','relationship']} onChange={(value) => setComplaintForm({...complaintForm,complaint_type:value,routed_department:value === 'billing' ? 'Finance & Accounts' : value === 'product_supply' ? 'Inventory' : 'Helpdesk'})} /><SelectField label="Priority" value={complaintForm.priority} values={['low','medium','high','critical']} onChange={(value) => setComplaintForm({...complaintForm,priority:value})} />
      <div className="md:col-span-2"><Field label="Issue title *"><Input value={complaintForm.issue_title} onChange={(e) => setComplaintForm({...complaintForm,issue_title:e.target.value})} /></Field></div><div className="md:col-span-2"><Field label="Full complaint"><Textarea className="min-h-28" value={complaintForm.issue_description} onChange={(e) => setComplaintForm({...complaintForm,issue_description:e.target.value})} /></Field></div>
      <Field label="Client follow-up date"><Input type="date" value={complaintForm.followup_date || ''} onChange={(e) => setComplaintForm({...complaintForm,followup_date:e.target.value})} /></Field><Field label="Destination"><Input value={complaintForm.routed_department} disabled /></Field></div><Button disabled={saving || !complaintForm.client_name || !complaintForm.issue_title} onClick={saveComplaint}>Save Complaint</Button></DialogContent></Dialog>

    <Dialog open={activityOpen} onOpenChange={setActivityOpen}><DialogContent><DialogHeader><DialogTitle>Log Activity — {activityTarget?.company_name}</DialogTitle></DialogHeader><SelectField label="Activity type" value={activityForm.activity_type} values={['call','email','meeting','site_visit','proposal','note']} onChange={(value) => setActivityForm({...activityForm,activity_type:value})} /><Field label="Subject *"><Input value={activityForm.subject} onChange={(e) => setActivityForm({...activityForm,subject:e.target.value})} /></Field><Field label="Notes"><Textarea value={activityForm.notes} onChange={(e) => setActivityForm({...activityForm,notes:e.target.value})} /></Field><Field label="Outcome"><Input value={activityForm.outcome} onChange={(e) => setActivityForm({...activityForm,outcome:e.target.value})} /></Field><Field label="Next action"><Input type="datetime-local" value={activityForm.next_action_at} onChange={(e) => setActivityForm({...activityForm,next_action_at:e.target.value})} /></Field><Button disabled={saving || !activityForm.subject} onClick={saveActivity}>Record Activity</Button></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function SelectField({ label, value, values, onChange }) { return <Field label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{item.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></Field>; }
function Empty({ icon: Icon, label }) { return <div className="col-span-full py-12 text-center text-slate-500"><Icon className="mx-auto mb-2 h-8 w-8" /><p>{label}</p></div>; }
function AuditList({ title, rows, subject, detail }) { return <Card className="border-[#ff5a00]/20 bg-[#102969] p-4"><h2 className="mb-3 flex items-center gap-2 font-bold"><History className="h-4 w-4 text-[#ff5a00]" />{title}</h2><div className="max-h-[34rem] space-y-2 overflow-y-auto">{rows.map((row) => <div key={row.id} className="rounded-lg border border-white/10 p-3"><p className="text-sm font-semibold capitalize">{subject(row)}</p><p className="text-xs text-slate-400">{detail(row)}</p>{(row.notes || row.note || row.outcome) && <p className="mt-1 text-xs text-slate-300">{row.notes || row.note || row.outcome}</p>}</div>)}{!rows.length && <p className="py-8 text-center text-sm text-slate-500">No records yet.</p>}</div></Card>; }
