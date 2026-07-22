import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, FileCheck2, FlaskConical, Loader2, Pencil, Plus, Printer, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import PrivateDocumentUpload, { PrivateDocumentLink } from '@/components/files/PrivateDocumentUpload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const CONFIG = {
  poc: {
    label: 'POC', table: 'crm_pocs', icon: FlaskConical, reference: 'poc_reference', product: 'product_to_demo',
    statuses: ['planned', 'in_progress', 'successful', 'not_successful', 'cancelled'],
    empty: { poc_reference: '', client_id: '', client_name: '', product_to_demo: '', start_date: '', end_date: '', requirements: '', status: 'planned', outcome_notes: '' },
  },
  supply: {
    label: 'LPO / Offer to Supply', table: 'crm_supply_register', icon: BriefcaseBusiness, reference: 'lpo_number', product: 'product_requested',
    statuses: ['offer', 'lpo_received', 'procurement', 'ready_to_supply', 'supplied', 'cancelled'],
    empty: { lpo_number: '', client_id: '', client_name: '', industry: '', contact_name: '', contact_phone: '', product_requested: '', quantity: '1', invoice_value: '', invoice_document: '', ark_profit: '', supplier_name: '', supply_date: '', delivery_note_document: '', status: 'offer', notes: '' },
  },
  sla: {
    label: 'SLA', table: 'crm_slas', icon: FileCheck2, reference: 'sla_reference', product: 'product',
    statuses: ['draft', 'active', 'expired', 'renewal_due', 'terminated'],
    empty: { sla_reference: '', client_id: '', client_name: '', industry: '', contact_name: '', contact_phone: '', sla_type: '', product: '', agreement_start_date: '', agreement_end_date: '', support_fee_per_product: '', status: 'draft', notes: '', agreement_document: '' },
  },
};

const money = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
const nice = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const inputClass = 'border-white/10 bg-[#08153d] text-white';

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-slate-200">{label}</Label>{children}</div>;
}

export default function CRMCommercialRegisters() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('poc');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(CONFIG.poc.empty);
  const [saving, setSaving] = useState(false);
  const config = CONFIG[tab];

  const query = useQuery({
    queryKey: ['crm-commercial', tab],
    queryFn: async () => {
      const { data, error } = await supabase.from(config.table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const clientsQuery = useQuery({ queryKey: ['crm-client-choices'], queryFn: async () => {
    const { data, error } = await supabase.from('crm_clients').select('id,client_name,industry,contact_name,contact_phone').order('client_name');
    if (error) throw error;
    return data || [];
  }});
  const suppliersQuery = useQuery({ queryKey: ['crm-supplier-choices'], queryFn: async () => {
    const { data, error } = await supabase.from('inventory_suppliers').select('id,supplier_name').order('supplier_name');
    if (error) return [];
    return data || [];
  }});

  const rows = useMemo(() => (query.data || []).filter((row) => !search || [row[config.reference], row.client_name, row[config.product], row.status, row.contact_name].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()))), [query.data, search, config]);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const pickClient = (clientId) => {
    const client = (clientsQuery.data || []).find((item) => item.id === clientId);
    setForm((current) => ({ ...current, client_id: clientId, client_name: client?.client_name || '', industry: client?.industry || current.industry || '', contact_name: client?.contact_name || current.contact_name || '', contact_phone: client?.contact_phone || current.contact_phone || '' }));
  };
  const startEdit = (row = null) => {
    setEditing(row);
    setForm(row ? { ...config.empty, ...row } : { ...config.empty });
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('ark_crm_save_commercial_record', { p_record_type: tab, p_payload: form, p_record_id: editing?.id || null });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['crm-commercial', tab] });
      setOpen(false);
    } catch (error) {
      alert(error.message || 'Commercial record could not be saved.');
    } finally { setSaving(false); }
  };

  const commonContactFields = tab !== 'poc' && <>
    <Field label="Industry"><Input className={inputClass} value={form.industry || ''} onChange={(e) => change('industry', e.target.value)} /></Field>
    <Field label="Contact name"><Input className={inputClass} value={form.contact_name || ''} onChange={(e) => change('contact_name', e.target.value)} /></Field>
    <Field label="Contact phone number"><Input className={inputClass} value={form.contact_phone || ''} onChange={(e) => change('contact_phone', e.target.value)} /></Field>
  </>;

  return <div className="space-y-6 pb-20">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-3xl font-bold text-white">BD Commercial Registers</h1><p className="text-sm text-slate-300">Manage POCs, LPO/offers and SLAs. Helpdesk ticket ownership is unchanged.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button onClick={() => startEdit()} className="bg-[#ff5a00] text-white"><Plus className="mr-2 h-4 w-4" />New {config.label}</Button></div>
    </div>
    <div className="grid gap-3 md:grid-cols-3">{Object.entries(CONFIG).map(([key, item]) => { const Icon=item.icon; return <Card key={key} onClick={() => { setTab(key); setSearch(''); }} className={`cursor-pointer p-4 ${tab===key?'border-[#ff5a00] bg-[#102969]':'border-white/10 bg-[#102969]/70'}`}><div className="flex items-center gap-3"><Icon className="h-5 w-5 text-[#ff5a00]" /><span className="font-semibold text-white">{item.label}</span></div></Card>; })}</div>
    <Card className="border-white/10 bg-[#102969]/90 p-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className={`${inputClass} pl-9`} placeholder={`Search ${config.label} records…`} value={search} onChange={(e) => setSearch(e.target.value)} /></div></Card>
    {query.isLoading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#ff5a00]" /> : query.error ? <Card className="border-red-400/30 bg-red-500/10 p-5 text-red-200">Could not load {config.label}: {query.error.message}</Card> : rows.length===0 ? <Card className="border-white/10 bg-[#102969]/90 p-12 text-center text-slate-300">No {config.label} records found.</Card> : <div className="grid gap-3">{rows.map((row) => <Card key={row.id} className="border-white/10 bg-[#102969]/90 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-orange-300">{row[config.reference]}</p><h3 className="font-bold text-white">{row.client_name}</h3><p className="text-sm text-slate-300">{row[config.product]}</p></div><div className="flex gap-2"><Badge className="border-blue-400/30 bg-blue-500/10 text-blue-200">{nice(row.status)}</Badge><Button size="sm" variant="outline" onClick={() => startEdit(row)}><Pencil className="mr-1 h-3 w-3" />Edit</Button></div></div><div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-4"><span>Owner: {row.owner_email || '—'}</span><span>Created: {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</span>{tab==='poc'&&<><span>Start: {row.start_date || '—'}</span><span>End: {row.end_date || '—'}</span></>}{tab==='supply'&&<><span>Qty: {row.quantity}</span><span>Value: {money(row.invoice_value)}</span></>}{tab==='sla'&&<><span>Period: {row.agreement_start_date} — {row.agreement_end_date}</span><span>Fee/product: {money(row.support_fee_per_product)}</span></>}</div>{tab==='supply'&&<div className="mt-3 flex gap-4"><PrivateDocumentLink value={row.invoice_document} className="text-xs text-blue-300 underline">Open invoice</PrivateDocumentLink><PrivateDocumentLink value={row.delivery_note_document} className="text-xs text-blue-300 underline">Open delivery note</PrivateDocumentLink></div>}{tab==='sla'&&<PrivateDocumentLink value={row.agreement_document} className="mt-3 block text-xs text-blue-300 underline">Open SLA agreement</PrivateDocumentLink>}</Card>)}</div>}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-white/10 bg-[#102969] text-white"><DialogHeader><DialogTitle>{editing?'Update':'New'} {config.label}</DialogTitle></DialogHeader><div className="grid gap-4 md:grid-cols-2">
      <Field label="Existing client"><Select value={form.client_id || 'manual'} onValueChange={(value) => value==='manual' ? change('client_id','') : pickClient(value)}><SelectTrigger className={inputClass}><SelectValue placeholder="Select existing client or enter manually" /></SelectTrigger><SelectContent><SelectItem value="manual">Enter client manually</SelectItem>{(clientsQuery.data||[]).map((client)=><SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Client"><Input className={inputClass} value={form.client_name || ''} onChange={(e)=>change('client_name',e.target.value)} /></Field>
      {commonContactFields}
      {tab==='poc'&&<><Field label="POC reference"><Input className={inputClass} value={form.poc_reference} onChange={(e)=>change('poc_reference',e.target.value)} /></Field><Field label="Product to demo"><Input className={inputClass} value={form.product_to_demo} onChange={(e)=>change('product_to_demo',e.target.value)} /></Field><Field label="POC start date"><Input type="date" className={inputClass} value={form.start_date} onChange={(e)=>change('start_date',e.target.value)} /></Field><Field label="POC end date"><Input type="date" className={inputClass} value={form.end_date} onChange={(e)=>change('end_date',e.target.value)} /></Field><div className="md:col-span-2"><Field label="POC requirements"><Textarea className={inputClass} value={form.requirements} onChange={(e)=>change('requirements',e.target.value)} /></Field></div><div className="md:col-span-2"><Field label="Outcome / other necessary information"><Textarea className={inputClass} value={form.outcome_notes || ''} onChange={(e)=>change('outcome_notes',e.target.value)} /></Field></div></>}
      {tab==='supply'&&<><Field label="LPO / offer number"><Input className={inputClass} value={form.lpo_number} onChange={(e)=>change('lpo_number',e.target.value)} /></Field><Field label="Product requested"><Input className={inputClass} value={form.product_requested} onChange={(e)=>change('product_requested',e.target.value)} /></Field><Field label="Quantity"><Input type="number" min="1" className={inputClass} value={form.quantity} onChange={(e)=>change('quantity',e.target.value)} /></Field><Field label="Product / invoice value"><Input type="number" min="0" className={inputClass} value={form.invoice_value} onChange={(e)=>change('invoice_value',e.target.value)} /></Field><Field label="ARK profit"><Input type="number" className={inputClass} value={form.ark_profit} onChange={(e)=>change('ark_profit',e.target.value)} /></Field><Field label="Supplier"><Select value={form.supplier_name || 'manual'} onValueChange={(value)=>change('supplier_name',value==='manual'?'':value)}><SelectTrigger className={inputClass}><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent><SelectItem value="manual">Enter supplier manually</SelectItem>{(suppliersQuery.data||[]).map((supplier)=><SelectItem key={supplier.id} value={supplier.supplier_name}>{supplier.supplier_name}</SelectItem>)}</SelectContent></Select><Input className={`${inputClass} mt-2`} value={form.supplier_name || ''} onChange={(e)=>change('supplier_name',e.target.value)} placeholder="Supplier name" /></Field><Field label="Date of supply"><Input type="date" className={inputClass} value={form.supply_date || ''} onChange={(e)=>change('supply_date',e.target.value)} /></Field><Field label="Invoice upload"><PrivateDocumentUpload value={form.invoice_document} onChange={(value)=>change('invoice_document',value)} category="crm-supply-invoice" /></Field><Field label="Delivery note upload"><PrivateDocumentUpload value={form.delivery_note_document} onChange={(value)=>change('delivery_note_document',value)} category="crm-supply-delivery-note" /></Field><div className="md:col-span-2"><Field label="Notes"><Textarea className={inputClass} value={form.notes || ''} onChange={(e)=>change('notes',e.target.value)} /></Field></div></>}
      {tab==='sla'&&<><Field label="SLA reference"><Input className={inputClass} value={form.sla_reference} onChange={(e)=>change('sla_reference',e.target.value)} /></Field><Field label="Type of SLA"><Input className={inputClass} value={form.sla_type} onChange={(e)=>change('sla_type',e.target.value)} /></Field><Field label="Product"><Input className={inputClass} value={form.product} onChange={(e)=>change('product',e.target.value)} /></Field><Field label="Support fee for each product"><Input type="number" min="0" className={inputClass} value={form.support_fee_per_product} onChange={(e)=>change('support_fee_per_product',e.target.value)} /></Field><Field label="Agreement start date"><Input type="date" className={inputClass} value={form.agreement_start_date} onChange={(e)=>change('agreement_start_date',e.target.value)} /></Field><Field label="Agreement end date"><Input type="date" className={inputClass} value={form.agreement_end_date} onChange={(e)=>change('agreement_end_date',e.target.value)} /></Field><Field label="SLA agreement upload"><PrivateDocumentUpload value={form.agreement_document} onChange={(value)=>change('agreement_document',value)} category="crm-sla-agreement" /></Field><div className="md:col-span-2"><Field label="Notes"><Textarea className={inputClass} value={form.notes || ''} onChange={(e)=>change('notes',e.target.value)} /></Field></div></>}
      <Field label="Status"><Select value={form.status} onValueChange={(value)=>change('status',value)}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent>{config.statuses.map((status)=><SelectItem key={status} value={status}>{nice(status)}</SelectItem>)}</SelectContent></Select></Field>
    </div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} className="bg-[#ff5a00] text-white">{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save {config.label}</Button></div></DialogContent></Dialog>
  </div>;
}
