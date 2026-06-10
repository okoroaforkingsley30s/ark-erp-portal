import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
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
  SelectValue
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
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
  Calendar
} from 'lucide-react';

import { format } from 'date-fns';

const LEAD_STATUS = {
  new: {
    label: 'New',
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  contacted: {
    label: 'Contacted',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200'
  },
  qualified: {
    label: 'Qualified',
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  proposal: {
    label: 'Proposal',
    color: 'bg-amber-500/15 text-amber-300 border-amber-200'
  },
  negotiation: {
    label: 'Negotiation',
    color: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  won: {
    label: 'Won',
    color: 'bg-green-500/15 text-green-300 border-green-200'
  },
  lost: {
    label: 'Lost',
    color: 'bg-red-500/15 text-red-300 border-red-200'
  },
};

const EMPTY = {
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
  next_followup: ''
};

export default function CRMPortal() {
  const { user } = useOutletContext();

  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState(EMPTY);

  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const filtered = leads.filter(
    l => statusFilter === 'all' || l.status === statusFilter
  );

  const wonValue = leads
    .filter(l => l.status === 'won')
    .reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);

  const pipelineValue = leads
    .filter(l => !['won', 'lost'].includes(l.status))
    .reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);

  const f = (k, v) =>
    setForm(p => ({
      ...p,
      [k]: v
    }));

  const handleSave = async () => {
    setSaving(true);

    try {
      const data = {
        ...form,
        estimated_value:
          parseFloat(form.estimated_value) || null
      };

      if (editing) {
        const { error } = await supabase
          .from('leads')
          .update(data)
          .eq('id', editing.id);

        if (error) throw error;

      } else {

        const { error } = await supabase
          .from('leads')
          .insert({
            ...data,
            assigned_to: user?.email || null
          });

        if (error) throw error;
      }

      qc.invalidateQueries({
        queryKey: ['leads']
      });

      setForm(EMPTY);
      setEditing(null);
      setOpen(false);

    } catch (err) {
      console.error(err);
      alert(err.message);

    } finally {
      setSaving(false);
    }
  };

  const moveStatus = async (lead, status) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', lead.id);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['leads']
      });

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            CRM & Marketing
          </h1>

          <p className="text-sm text-muted-foreground">
            Lead management and client relationship
          </p>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>

      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <p className="text-2xl font-bold">
            {leads.length}
          </p>

          <p className="text-xs text-muted-foreground">
            Total Leads
          </p>
        </div>

        <div className="rounded-xl border bg-green-50 border-green-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {leads.filter(l => l.status === 'won').length}
          </p>

          <p className="text-xs text-muted-foreground">
            Won
          </p>
        </div>

        <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
          <p className="text-2xl font-bold text-blue-600">
            ₦{(pipelineValue / 1000000).toFixed(1)}M
          </p>

          <p className="text-xs text-muted-foreground">
            Pipeline Value
          </p>
        </div>

        <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
          <p className="text-2xl font-bold text-amber-600">
            {
              leads.filter(
                l =>
                  l.next_followup &&
                  new Date(l.next_followup) <= new Date()
              ).length
            }
          </p>

          <p className="text-xs text-muted-foreground">
            Follow-ups Due
          </p>
        </div>

      </div>

      <div className="flex flex-wrap gap-2">

        <button
          onClick={() => setStatusFilter('all')}
          className={
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
            (
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-slate-900/50 border-border text-muted-foreground'
            )
          }
        >
          All ({leads.length})
        </button>

        {Object.entries(LEAD_STATUS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(k)}
            className={
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
              (
                statusFilter === k
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-slate-900/50 border-border text-muted-foreground'
              )
            }
          >
            {v.label} (
            {leads.filter(l => l.status === k).length})
          </button>
        ))}

      </div>

      {isLoading ? (

        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>

      ) : (

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">

          {filtered.map(lead => {

            const sc =
              LEAD_STATUS[lead.status] ||
              LEAD_STATUS.new;

            return (
              <Card
                key={lead.id}
                className="p-4 hover:shadow-md transition-shadow"
              >

                <div className="flex items-start justify-between mb-3">

                  <div>
                    <p className="font-semibold text-sm">
                      {lead.company_name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {lead.contact_name}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={sc.color + ' text-[10px]'}
                  >
                    {sc.label}
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
                    <p className="font-semibold text-foreground">
                      ₦{Number(lead.estimated_value).toLocaleString()}
                    </p>
                  )}

                  {lead.next_followup && (
                    <p className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Follow-up:{' '}
                      {format(
                        new Date(lead.next_followup),
                        'MMM d, yyyy'
                      )}
                    </p>
                  )}

                </div>

                <div className="flex gap-2">

                  <Select
                    value={lead.status}
                    onValueChange={v => moveStatus(lead, v)}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {Object.entries(LEAD_STATUS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>

                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(lead);

                      setForm({
                        ...EMPTY,
                        ...lead,
                        estimated_value:
                          lead.estimated_value || ''
                      });

                      setOpen(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>

                </div>

              </Card>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No leads found</p>
            </div>
          )}

        </div>

      )}

      <Dialog open={open} onOpenChange={setOpen}>

        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">

          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit' : 'Add'} Lead
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">
                <Label>Company Name *</Label>

                <Input
                  value={form.company_name}
                  onChange={e =>
                    f('company_name', e.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Contact Name *</Label>

                <Input
                  value={form.contact_name}
                  onChange={e =>
                    f('contact_name', e.target.value)
                  }
                />
              </div>

            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">
                <Label>Email</Label>

                <Input
                  value={form.contact_email}
                  onChange={e =>
                    f('contact_email', e.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Phone</Label>

                <Input
                  value={form.contact_phone}
                  onChange={e =>
                    f('contact_phone', e.target.value)
                  }
                />
              </div>

            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">
                <Label>Industry</Label>

                <Input
                  value={form.industry}
                  onChange={e =>
                    f('industry', e.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">

                <Label>Source</Label>

                <Select
                  value={form.source}
                  onValueChange={v => f('source', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>

                    {[
                      'referral',
                      'website',
                      'cold_call',
                      'email',
                      'event',
                      'other'
                    ].map(s => (
                      <SelectItem
                        key={s}
                        value={s}
                      >
                        {s.replace('_', ' ')}
                      </SelectItem>
                    ))}

                  </SelectContent>

                </Select>

              </div>

            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">

                <Label>Status</Label>

                <Select
                  value={form.status}
                  onValueChange={v => f('status', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>

                    {Object.entries(LEAD_STATUS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}

                  </SelectContent>

                </Select>

              </div>

              <div className="space-y-1.5">

                <Label>Estimated Value</Label>

                <Input
                  type="number"
                  value={form.estimated_value}
                  onChange={e =>
                    f('estimated_value', e.target.value)
                  }
                />

              </div>

            </div>

            <div className="space-y-1.5">

              <Label>Devices Interested In</Label>

              <Input
                value={form.devices_interested}
                onChange={e =>
                  f('devices_interested', e.target.value)
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Next Follow-up</Label>

              <Input
                type="date"
                value={form.next_followup}
                onChange={e =>
                  f('next_followup', e.target.value)
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Notes</Label>

              <Textarea
                value={form.notes}
                onChange={e =>
                  f('notes', e.target.value)
                }
                className="h-16"
              />

            </div>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={
                !form.company_name ||
                !form.contact_name ||
                saving
              }
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              {editing ? 'Update' : 'Add'} Lead

            </Button>

          </div>

        </DialogContent>

      </Dialog>

    </div>
  );
}