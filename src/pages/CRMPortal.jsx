import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  TrendingUp,
  Plus,
  Phone,
  Mail,
  Building2,
  Target,
  Loader2,
  Pencil,
  Users,
  Calendar,
  BriefcaseBusiness,
  Handshake,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  FileText,
  RefreshCw,
  MessageSquareWarning,
  Star,
  ClipboardCheck,
} from 'lucide-react';

import { format } from 'date-fns';

const LEAD_STATUS = {
  new: { label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  contacted: { label: 'Contacted', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  qualified: { label: 'Qualified', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  proposal: { label: 'Proposal', color: 'bg-amber-500/15 text-amber-300 border-amber-200' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  won: { label: 'Won', color: 'bg-green-500/15 text-green-300 border-green-200' },
  lost: { label: 'Lost', color: 'bg-red-500/15 text-red-300 border-red-200' },
};

const CLIENT_STATUS = {
  active: { label: 'Active', color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  inactive: { label: 'Inactive', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  prospect: { label: 'Prospect', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  expired: { label: 'Expired', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

const COMPLAINT_STATUS = {
  open: { label: 'Open', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  ticket_created: { label: 'Ticket Created', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  resolved: { label: 'Resolved', color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  closed: { label: 'Closed', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

const EMPTY_LEAD = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  industry: '',
  source: 'other',
  status: 'new',
  estimated_value: '',
  devices_interested: '',
  notes: '',
  next_followup: '',
};

const EMPTY_CLIENT = {
  client_name: '',
  industry: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  relationship_manager: '',
  relationship_manager_email: '',
  contract_value: '',
  contract_start: '',
  contract_end: '',
  sla_level: 'standard',
  branch_count: 0,
  status: 'active',
  notes: '',
};

const EMPTY_COMPLAINT = {
  client_id: '',
  client_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  issue_title: '',
  issue_description: '',
  priority: 'medium',
  status: 'open',
  ticket_number: '',
  followup_date: '',
  satisfaction_rating: '',
  feedback: '',
};

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;

const normalize = (value) => String(value || '').toLowerCase().trim();

const safeNumber = (value) => {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function dateLabel(value) {
  if (!value) return '—';

  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return String(value);
  }
}

function isDue(value) {
  if (!value) return false;
  return new Date(value) <= new Date();
}

async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchClients() {
  const { data, error } = await supabase
    .from('crm_clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('crm_clients not ready:', error);
    return [];
  }

  return data || [];
}

async function fetchComplaints() {
  const { data, error } = await supabase
    .from('crm_complaints')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('crm_complaints not ready:', error);
    return [];
  }

  return data || [];
}

export default function CRMPortal() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const qc = useQueryClient();

  const [tab, setTab] = useState('leads');
  const [search, setSearch] = useState('');

  const [leadOpen, setLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD);

  const [clientOpen, setClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);

  const [complaintOpen, setComplaintOpen] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [complaintForm, setComplaintForm] = useState(EMPTY_COMPLAINT);

  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['crm-clients'],
    queryFn: fetchClients,
  });

  const { data: complaints = [], isLoading: complaintsLoading } = useQuery({
    queryKey: ['crm-complaints'],
    queryFn: fetchComplaints,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['crm-clients'] });
    qc.invalidateQueries({ queryKey: ['crm-complaints'] });
  };

  const filteredLeads = useMemo(() => {
    const q = normalize(search);

    return leads.filter((lead) => {
      const matchStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchSearch =
        !q ||
        [
          lead.company_name,
          lead.contact_name,
          lead.contact_email,
          lead.contact_phone,
          lead.industry,
          lead.devices_interested,
          lead.notes,
        ]
          .filter(Boolean)
          .some((value) => normalize(value).includes(q));

      return matchStatus && matchSearch;
    });
  }, [leads, search, statusFilter]);

  const filteredClients = useMemo(() => {
    const q = normalize(search);

    return clients.filter((client) =>
      !q ||
      [
        client.client_name,
        client.industry,
        client.contact_name,
        client.contact_email,
        client.contact_phone,
        client.relationship_manager,
        client.sla_level,
        client.status,
      ]
        .filter(Boolean)
        .some((value) => normalize(value).includes(q))
    );
  }, [clients, search]);

  const filteredComplaints = useMemo(() => {
    const q = normalize(search);

    return complaints.filter((complaint) =>
      !q ||
      [
        complaint.complaint_number,
        complaint.client_name,
        complaint.contact_name,
        complaint.issue_title,
        complaint.issue_description,
        complaint.ticket_number,
        complaint.status,
        complaint.priority,
      ]
        .filter(Boolean)
        .some((value) => normalize(value).includes(q))
    );
  }, [complaints, search]);

  const wonValue = leads
    .filter((lead) => lead.status === 'won')
    .reduce((sum, lead) => sum + safeNumber(lead.estimated_value), 0);

  const pipelineValue = leads
    .filter((lead) => !['won', 'lost'].includes(lead.status))
    .reduce((sum, lead) => sum + safeNumber(lead.estimated_value), 0);

  const contractValue = clients.reduce((sum, client) => sum + safeNumber(client.contract_value), 0);

  const followupsDue =
    leads.filter((lead) => isDue(lead.next_followup)).length +
    complaints.filter((complaint) => isDue(complaint.followup_date)).length;

  const expiringContracts = clients.filter((client) => {
    if (!client.contract_end) return false;
    const days = (new Date(client.contract_end) - new Date()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 60;
  }).length;

  const openComplaints = complaints.filter((complaint) =>
    ['open', 'in_progress', 'ticket_created'].includes(complaint.status || 'open')
  ).length;

  const setLeadField = (key, value) => setLeadForm((prev) => ({ ...prev, [key]: value }));
  const setClientField = (key, value) => setClientForm((prev) => ({ ...prev, [key]: value }));
  const setComplaintField = (key, value) => setComplaintForm((prev) => ({ ...prev, [key]: value }));

  const openNewLead = () => {
    setEditingLead(null);
    setLeadForm(EMPTY_LEAD);
    setLeadOpen(true);
  };

  const openEditLead = (lead) => {
    setEditingLead(lead);
    setLeadForm({
      ...EMPTY_LEAD,
      ...lead,
      estimated_value: lead.estimated_value || '',
      next_followup: lead.next_followup || '',
    });
    setLeadOpen(true);
  };

  const openNewClient = () => {
    setEditingClient(null);
    setClientForm({
      ...EMPTY_CLIENT,
      relationship_manager: user.full_name || user.name || '',
      relationship_manager_email: user.email || user.user_email || '',
    });
    setClientOpen(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      ...EMPTY_CLIENT,
      ...client,
      contract_value: client.contract_value || '',
      contract_start: client.contract_start || '',
      contract_end: client.contract_end || '',
    });
    setClientOpen(true);
  };

  const openNewComplaint = () => {
    setEditingComplaint(null);
    setComplaintForm(EMPTY_COMPLAINT);
    setComplaintOpen(true);
  };

  const openEditComplaint = (complaint) => {
    setEditingComplaint(complaint);
    setComplaintForm({
      ...EMPTY_COMPLAINT,
      ...complaint,
      satisfaction_rating: complaint.satisfaction_rating || '',
      followup_date: complaint.followup_date || '',
    });
    setComplaintOpen(true);
  };

  const convertLeadToClient = async (lead) => {
    try {
      const existing = clients.find(
        (client) =>
          normalize(client.source_lead_id) === normalize(lead.id) ||
          normalize(client.client_name) === normalize(lead.company_name)
      );

      if (existing) return existing;

      const payload = {
        client_name: lead.company_name,
        industry: lead.industry || '',
        contact_name: lead.contact_name || '',
        contact_email: lead.contact_email || '',
        contact_phone: lead.contact_phone || '',
        relationship_manager: user.full_name || user.name || user.email || '',
        relationship_manager_email: user.email || user.user_email || '',
        source_lead_id: lead.id,
        contract_value: safeNumber(lead.estimated_value),
        status: 'active',
        notes: lead.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('crm_clients')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['crm-clients'] });
      return data;
    } catch (err) {
      console.error(err);
      alert('Lead won, but client conversion failed: ' + (err?.message || 'Unknown error'));
      return null;
    }
  };

  const handleSaveLead = async () => {
    if (!leadForm.company_name || !leadForm.contact_name) return;

    setSaving(true);

    try {
      const data = {
        ...leadForm,
        estimated_value: safeNumber(leadForm.estimated_value) || null,
        updated_at: new Date().toISOString(),
      };

      let savedLead = editingLead;

      if (editingLead) {
        const { data: updated, error } = await supabase
          .from('leads')
          .update(data)
          .eq('id', editingLead.id)
          .select()
          .single();

        if (error) throw error;
        savedLead = updated;
      } else {
        const { data: inserted, error } = await supabase
          .from('leads')
          .insert({
            ...data,
            assigned_to: user?.email || user?.user_email || null,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        savedLead = inserted;
      }

      if (savedLead?.status === 'won') {
        await convertLeadToClient(savedLead);
      }

      qc.invalidateQueries({ queryKey: ['leads'] });

      setLeadForm(EMPTY_LEAD);
      setEditingLead(null);
      setLeadOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const moveStatus = async (lead, status) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
        .select()
        .single();

      if (error) throw error;

      if (status === 'won') {
        await convertLeadToClient(data || { ...lead, status });
      }

      qc.invalidateQueries({ queryKey: ['leads'] });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleSaveClient = async () => {
    if (!clientForm.client_name) return;

    setSaving(true);

    try {
      const data = {
        ...clientForm,
        contract_value: safeNumber(clientForm.contract_value),
        branch_count: safeNumber(clientForm.branch_count),
        updated_at: new Date().toISOString(),
      };

      if (editingClient) {
        const { error } = await supabase
          .from('crm_clients')
          .update(data)
          .eq('id', editingClient.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_clients')
          .insert({
            ...data,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['crm-clients'] });
      setClientForm(EMPTY_CLIENT);
      setEditingClient(null);
      setClientOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveComplaint = async () => {
    if (!complaintForm.client_name || !complaintForm.issue_title) return;

    setSaving(true);

    try {
      const complaintNumber =
        editingComplaint?.complaint_number ||
        `CRM-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

      const data = {
        ...complaintForm,
        complaint_number: complaintNumber,
        satisfaction_rating: complaintForm.satisfaction_rating
          ? safeNumber(complaintForm.satisfaction_rating)
          : null,
        created_by_email: user.email || user.user_email || '',
        created_by_name: user.full_name || user.name || user.email || '',
        updated_at: new Date().toISOString(),
      };

      if (editingComplaint) {
        const { error } = await supabase
          .from('crm_complaints')
          .update(data)
          .eq('id', editingComplaint.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_complaints')
          .insert({
            ...data,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['crm-complaints'] });
      setComplaintForm(EMPTY_COMPLAINT);
      setEditingComplaint(null);
      setComplaintOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startComplaintForClient = (client) => {
    setEditingComplaint(null);
    setComplaintForm({
      ...EMPTY_COMPLAINT,
      client_id: client.id,
      client_name: client.client_name,
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
    });
    setComplaintOpen(true);
  };

  const createTicketFromComplaint = async (complaint) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title: complaint.issue_title,
          description: complaint.issue_description,
          bank_name: complaint.client_name,
          contact_name: complaint.contact_name,
          contact_phone: complaint.contact_phone,
          contact_email: complaint.contact_email,
          priority: complaint.priority || 'medium',
          status: 'open',
          source: 'CRM',
          created_by_email: user.email || user.user_email || '',
          created_by_name: user.full_name || user.name || user.email || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const ticketNumber = data?.ticket_number || data?.id || '';

      const { error: updateError } = await supabase
        .from('crm_complaints')
        .update({
          ticket_id: data?.id || null,
          ticket_number: ticketNumber,
          status: 'ticket_created',
          updated_at: new Date().toISOString(),
        })
        .eq('id', complaint.id);

      if (updateError) throw updateError;

      qc.invalidateQueries({ queryKey: ['crm-complaints'] });
      alert('Ticket created from CRM complaint.');
    } catch (err) {
      console.error(err);
      alert('Ticket creation failed: ' + (err?.message || 'Unknown error'));
    }
  };

  const dashboardCards = [
    {
      title: 'Total Leads',
      value: leads.length,
      icon: TrendingUp,
      note: `${leads.filter((lead) => lead.status === 'won').length} won`,
    },
    {
      title: 'Active Clients',
      value: clients.filter((client) => client.status === 'active').length,
      icon: BriefcaseBusiness,
      note: `${clients.length} total clients`,
    },
    {
      title: 'Pipeline Value',
      value: money(pipelineValue),
      icon: Target,
      note: 'Open opportunities',
    },
    {
      title: 'Contract Value',
      value: money(contractValue || wonValue),
      icon: Handshake,
      note: contractValue ? 'Active client contracts' : 'Based on won leads',
    },
    {
      title: 'Open Complaints',
      value: openComplaints,
      icon: MessageSquareWarning,
      note: 'CRM issues needing attention',
    },
    {
      title: 'Follow-ups Due',
      value: followupsDue,
      icon: Calendar,
      note: 'Leads + complaints',
    },
    {
      title: 'Expiring Contracts',
      value: expiringContracts,
      icon: AlertTriangle,
      note: 'Within 60 days',
    },
    {
      title: 'Won Value',
      value: money(wonValue),
      icon: CheckCircle2,
      note: 'Converted business',
    },
  ];

  return (
    <div className="space-y-5 pb-20 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <TrendingUp className="w-7 h-7 text-[#ff5a00]" />
            CRM, Marketing & Business Development
          </h1>
          <p className="text-sm text-muted-foreground">
            Lead pipeline, client relationship, contracts, complaints, follow-ups and customer satisfaction.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={openNewLead} className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
          <Button variant="outline" onClick={openNewClient}>
            <BriefcaseBusiness className="w-4 h-4 mr-2" />
            Add Client
          </Button>
          <Button variant="outline" onClick={openNewComplaint}>
            <MessageSquareWarning className="w-4 h-4 mr-2" />
            Add Complaint
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {dashboardCards.map(({ title, value, icon: Icon, note }) => (
          <Card key={title} className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
            <CardContent className="p-4">
              <Icon className="w-5 h-5 text-[#ff5a00]" />
              <p className="text-2xl font-black text-white mt-2">{value}</p>
              <p className="text-xs text-muted-foreground">{title}</p>
              <p className="text-[11px] text-slate-400 mt-1">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border border-[#ff5a00]/20 bg-[#102969] p-4">
        <p className="text-sm text-[#ff5a00] font-semibold">
          CRM workflow
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Lead → Won → Auto Client Record → Contract/SLA → Complaint → Helpdesk Ticket → Follow-up → Satisfaction.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'leads', label: 'Marketing Pipeline' },
          { key: 'clients', label: 'Clients & Contracts' },
          { key: 'complaints', label: 'Complaints & Follow-up' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={
              'px-4 py-2 rounded-lg text-sm font-medium border transition-all ' +
              (tab === item.key
                ? 'bg-[#ff5a00] text-white border-[#ff5a00]'
                : 'bg-[#102969] border-[#ff5a00]/20 text-slate-300 hover:border-[#ff5a00]/50')
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search company, client, contact, complaint, ticket..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {tab === 'leads' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lead Status</SelectItem>
              {Object.entries(LEAD_STATUS).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {tab === 'leads' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                (statusFilter === 'all'
                  ? 'bg-[#ff5a00] text-white border-[#ff5a00]'
                  : 'bg-[#102969] border-[#ff5a00]/20 text-muted-foreground')
              }
            >
              All ({leads.length})
            </button>

            {Object.entries(LEAD_STATUS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                  (statusFilter === key
                    ? 'bg-[#ff5a00] text-white border-[#ff5a00]'
                    : 'bg-[#102969] border-[#ff5a00]/20 text-muted-foreground')
                }
              >
                {value.label} ({leads.filter((lead) => lead.status === key).length})
              </button>
            ))}
          </div>

          {leadsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLeads.map((lead) => {
                const status = LEAD_STATUS[lead.status] || LEAD_STATUS.new;

                return (
                  <Card key={lead.id} className="bg-[#102969] border border-[#ff5a00]/20 p-4 hover:border-[#ff5a00]/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm text-white">{lead.company_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.contact_name}</p>
                      </div>

                      <Badge variant="outline" className={`${status.color} text-[10px]`}>
                        {status.label}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      {lead.contact_email && (
                        <p className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {lead.contact_email}
                        </p>
                      )}

                      {lead.contact_phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lead.contact_phone}
                        </p>
                      )}

                      {lead.industry && (
                        <p className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {lead.industry}
                        </p>
                      )}

                      {lead.devices_interested && (
                        <p className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {lead.devices_interested}
                        </p>
                      )}

                      {lead.estimated_value && (
                        <p className="font-semibold text-[#ff5a00]">
                          {money(lead.estimated_value)}
                        </p>
                      )}

                      {lead.next_followup && (
                        <p className={`flex items-center gap-1 ${isDue(lead.next_followup) ? 'text-amber-300' : ''}`}>
                          <Calendar className="w-3 h-3" />
                          Follow-up: {dateLabel(lead.next_followup)}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Select value={lead.status} onValueChange={(value) => moveStatus(lead, value)}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LEAD_STATUS).map(([key, value]) => (
                            <SelectItem key={key} value={key}>
                              {value.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button variant="outline" size="sm" onClick={() => openEditLead(lead)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                );
              })}

              {filteredLeads.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No leads found</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'clients' && (
        <>
          {clientsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredClients.map((client) => {
                const status = CLIENT_STATUS[client.status] || CLIENT_STATUS.active;

                return (
                  <Card key={client.id} className="bg-[#102969] border border-[#ff5a00]/20 p-4 hover:border-[#ff5a00]/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm text-white">{client.client_name}</p>
                        <p className="text-xs text-muted-foreground">{client.industry || 'No industry'}</p>
                      </div>

                      <Badge variant="outline" className={`${status.color} text-[10px]`}>
                        {status.label}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      {client.contact_name && <p>Contact: {client.contact_name}</p>}
                      {client.contact_email && (
                        <p className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.contact_email}
                        </p>
                      )}
                      {client.contact_phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.contact_phone}
                        </p>
                      )}
                      <p>Branches: {client.branch_count || 0}</p>
                      <p>SLA: {client.sla_level || 'standard'}</p>
                      <p>Contract: {dateLabel(client.contract_start)} → {dateLabel(client.contract_end)}</p>
                      <p className="font-semibold text-[#ff5a00]">{money(client.contract_value)}</p>
                      {client.relationship_manager && <p>RM: {client.relationship_manager}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditClient(client)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" onClick={() => startComplaintForClient(client)} className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
                        <MessageSquareWarning className="w-3 h-3 mr-1" />
                        Complaint
                      </Button>
                    </div>
                  </Card>
                );
              })}

              {filteredClients.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <BriefcaseBusiness className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No clients found. Won leads will auto-convert to clients.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'complaints' && (
        <>
          {complaintsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredComplaints.map((complaint) => {
                const status = COMPLAINT_STATUS[complaint.status] || COMPLAINT_STATUS.open;

                return (
                  <Card key={complaint.id} className="bg-[#102969] border border-[#ff5a00]/20 p-4 hover:border-[#ff5a00]/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-mono text-[11px] text-muted-foreground">{complaint.complaint_number}</p>
                        <p className="font-semibold text-sm text-white">{complaint.issue_title}</p>
                        <p className="text-xs text-muted-foreground">{complaint.client_name}</p>
                      </div>

                      <Badge variant="outline" className={`${status.color} text-[10px]`}>
                        {status.label}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                      {complaint.issue_description || 'No description'}
                    </p>

                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      {complaint.ticket_number && <p>Ticket: {complaint.ticket_number}</p>}
                      <p>Priority: {complaint.priority || 'medium'}</p>
                      {complaint.followup_date && (
                        <p className={isDue(complaint.followup_date) ? 'text-amber-300' : ''}>
                          Follow-up: {dateLabel(complaint.followup_date)}
                        </p>
                      )}
                      {complaint.satisfaction_rating && (
                        <p className="flex items-center gap-1 text-[#ff5a00]">
                          <Star className="w-3 h-3" />
                          Rating: {complaint.satisfaction_rating}/5
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditComplaint(complaint)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      {!complaint.ticket_number && (
                        <Button size="sm" onClick={() => createTicketFromComplaint(complaint)} className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
                          <ClipboardCheck className="w-3 h-3 mr-1" />
                          Create Ticket
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}

              {filteredComplaints.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <MessageSquareWarning className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No complaints found</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit' : 'Add'} Lead</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Company Name *</Label>
                <Input value={leadForm.company_name} onChange={(e) => setLeadField('company_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Name *</Label>
                <Input value={leadForm.contact_name} onChange={(e) => setLeadField('contact_name', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={leadForm.contact_email} onChange={(e) => setLeadField('contact_email', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={leadForm.contact_phone} onChange={(e) => setLeadField('contact_phone', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={leadForm.industry} onChange={(e) => setLeadField('industry', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={leadForm.source} onValueChange={(value) => setLeadField('source', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['referral', 'website', 'cold_call', 'email', 'event', 'other'].map((source) => (
                      <SelectItem key={source} value={source}>{source.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={leadForm.status} onValueChange={(value) => setLeadField('status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAD_STATUS).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estimated Value</Label>
                <Input type="number" value={leadForm.estimated_value} onChange={(e) => setLeadField('estimated_value', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Devices / Services Interested In</Label>
              <Input value={leadForm.devices_interested} onChange={(e) => setLeadField('devices_interested', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Next Follow-up</Label>
              <Input type="date" value={leadForm.next_followup || ''} onChange={(e) => setLeadField('next_followup', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={leadForm.notes} onChange={(e) => setLeadField('notes', e.target.value)} className="h-20" />
            </div>

            <Button className="w-full" onClick={handleSaveLead} disabled={!leadForm.company_name || !leadForm.contact_name || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLead ? 'Update' : 'Add'} Lead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit' : 'Add'} Client</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client Name *</Label>
                <Input value={clientForm.client_name} onChange={(e) => setClientField('client_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={clientForm.industry} onChange={(e) => setClientField('industry', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input value={clientForm.contact_name} onChange={(e) => setClientField('contact_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={clientForm.contact_email} onChange={(e) => setClientField('contact_email', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={clientForm.contact_phone} onChange={(e) => setClientField('contact_phone', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Contract Value</Label>
                <Input type="number" value={clientForm.contract_value} onChange={(e) => setClientField('contract_value', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contract Start</Label>
                <Input type="date" value={clientForm.contract_start || ''} onChange={(e) => setClientField('contract_start', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contract End</Label>
                <Input type="date" value={clientForm.contract_end || ''} onChange={(e) => setClientField('contract_end', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>SLA Level</Label>
                <Select value={clientForm.sla_level} onValueChange={(value) => setClientField('sla_level', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['standard', 'premium', 'critical', '24_7'].map((sla) => (
                      <SelectItem key={sla} value={sla}>{sla.replace('_', '/')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branches</Label>
                <Input type="number" value={clientForm.branch_count} onChange={(e) => setClientField('branch_count', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={clientForm.status} onValueChange={(value) => setClientField('status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_STATUS).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Relationship Manager</Label>
                <Input value={clientForm.relationship_manager} onChange={(e) => setClientField('relationship_manager', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Manager Email</Label>
                <Input value={clientForm.relationship_manager_email} onChange={(e) => setClientField('relationship_manager_email', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={clientForm.notes} onChange={(e) => setClientField('notes', e.target.value)} className="h-20" />
            </div>

            <Button className="w-full" onClick={handleSaveClient} disabled={!clientForm.client_name || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingClient ? 'Update' : 'Add'} Client
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingComplaint ? 'Edit' : 'Add'} Complaint / Follow-up</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client Name *</Label>
                <Input value={complaintForm.client_name} onChange={(e) => setComplaintField('client_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input value={complaintForm.contact_name} onChange={(e) => setComplaintField('contact_name', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={complaintForm.contact_email} onChange={(e) => setComplaintField('contact_email', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={complaintForm.contact_phone} onChange={(e) => setComplaintField('contact_phone', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Issue Title *</Label>
              <Input value={complaintForm.issue_title} onChange={(e) => setComplaintField('issue_title', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Issue Description</Label>
              <Textarea value={complaintForm.issue_description} onChange={(e) => setComplaintField('issue_description', e.target.value)} className="h-24" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={complaintForm.priority} onValueChange={(value) => setComplaintField('priority', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['low', 'medium', 'high', 'critical'].map((priority) => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={complaintForm.status} onValueChange={(value) => setComplaintField('status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPLAINT_STATUS).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Follow-up Date</Label>
                <Input type="date" value={complaintForm.followup_date || ''} onChange={(e) => setComplaintField('followup_date', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ticket Number</Label>
                <Input value={complaintForm.ticket_number || ''} onChange={(e) => setComplaintField('ticket_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Satisfaction Rating /5</Label>
                <Input type="number" min="1" max="5" value={complaintForm.satisfaction_rating || ''} onChange={(e) => setComplaintField('satisfaction_rating', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Feedback</Label>
              <Textarea value={complaintForm.feedback || ''} onChange={(e) => setComplaintField('feedback', e.target.value)} className="h-20" />
            </div>

            <Button className="w-full" onClick={handleSaveComplaint} disabled={!complaintForm.client_name || !complaintForm.issue_title || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingComplaint ? 'Update' : 'Add'} Complaint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
