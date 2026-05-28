import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Plus,
  Search,
  Wrench,
  Loader2,
  ClipboardCheck,
  PackageCheck,
} from 'lucide-react';

const EMPTY_JOB = {
  source_type: 'returned_damaged_part',
  received_from: 'field_engineer',
  item_name: '',
  part_number: '',
  machine_brand: '',
  machine_model: '',
  quantity_received: 1,
  condition_on_arrival: 'faulty',
  fault_description: '',
  action_required: 'repair',
  test_result: 'pending',
  status: 'received',
  good_quantity: 0,
  bad_quantity: 0,
  parts_used: '',
  final_remark: '',
  inventory_transfer_status: 'not_ready',
};

const STATUS = {
  received: 'Received',
  testing: 'Testing',
  diagnosing: 'Diagnosing',
  awaiting_parts: 'Awaiting Parts',
  refurbishing: 'Refurbishing',
  ready_for_inventory: 'Ready for Inventory',
  sent_to_inventory: 'Sent to Inventory',
  scrap: 'Scrap',
};

const TEST_RESULT = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
  partially_working: 'Partially Working',
};

const TRANSFER_STATUS = {
  not_ready: 'Not Ready',
  ready_to_transfer: 'Ready to Transfer',
  transferred: 'Transferred',
};

export default function RepairRefurbish() {
  const { user } = useOutletContext();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_JOB);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['repair-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repair_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const counts = useMemo(() => ({
    received: jobs.filter((j) => j.status === 'received').length,
    testing: jobs.filter((j) => j.status === 'testing').length,
    refurbishing: jobs.filter((j) => j.status === 'refurbishing').length,
    ready: jobs.filter((j) => j.status === 'ready_for_inventory').length,
  }), [jobs]);

  const filtered = useMemo(() => {
    if (!search) return jobs;

    const s = search.toLowerCase();

    return jobs.filter((j) =>
      [
        j.job_number,
        j.source_type,
        j.received_from,
        j.item_name,
        j.part_number,
        j.machine_brand,
        j.machine_model,
        j.fault_description,
        j.final_remark,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [jobs, search]);

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const createJob = async () => {
    if (!form.item_name.trim()) {
      alert('Item / Part Name is required.');
      return;
    }

    setSaving(true);

    try {
      const jobNumber = `RR-${Date.now()}`;

      const payload = {
        ...form,
        quantity_received: Number(form.quantity_received) || 1,
        good_quantity: Number(form.good_quantity) || 0,
        bad_quantity: Number(form.bad_quantity) || 0,
        job_number: jobNumber,
        received_by: user?.email || '',
        device_name: form.item_name,
        diagnosis: form.final_remark,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('repair_jobs').insert(payload);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['repair-jobs'] });
      setForm(EMPTY_JOB);
      setOpen(false);
    } catch (err) {
      alert('R/R job creation failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (job, status) => {
    const payload = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'sent_to_inventory') {
      payload.inventory_transfer_status = 'transferred';
      payload.completed_at = new Date().toISOString();
    }

    if (status === 'ready_for_inventory') {
      payload.inventory_transfer_status = 'ready_to_transfer';
    }

    const { error } = await supabase
      .from('repair_jobs')
      .update(payload)
      .eq('id', job.id);

    if (error) {
      alert('Status update failed: ' + error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ['repair-jobs'] });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-7 h-7 text-[#ff5a00]" />
            Repair & Refurbish
          </h1>

          <p className="text-slate-300">
            Returned damaged parts, decommissioned machines, testing, repair, and inventory handover.
          </p>
        </div>

        <Button
          onClick={() => setOpen(true)}
          className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New R/R Job
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {[
          ['Received', counts.received],
          ['Testing', counts.testing],
          ['Refurbishing', counts.refurbishing],
          ['Ready for Inventory', counts.ready],
        ].map(([label, value]) => (
          <Card
            key={label}
            className="bg-[#102969]/90 border border-white/10 rounded-xl p-4"
          >
            <p className="text-slate-300 text-sm">{label}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="bg-[#102969]/90 border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">R/R Jobs</h2>
            <p className="text-xs text-slate-300">
              {filtered.length} job{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search R/R jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#08153d]/80 border-white/10 text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-300">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No R/R jobs found.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-white/10 bg-[#08153d]/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400 font-mono">
                      {job.job_number}
                    </p>

                    <h3 className="text-white font-bold">
                      {job.item_name || job.device_name || 'R/R Item'}
                    </h3>

                    <p className="text-sm text-slate-300 mt-1">
                      {job.fault_description || 'No observation recorded'}
                    </p>

                    <p className="text-xs text-slate-400 mt-2">
                      {job.machine_brand || 'No brand'} · {job.machine_model || 'No model'} · Qty: {job.quantity_received || 1}
                    </p>
                  </div>

                  <Badge className="bg-[#ff5a00]/15 text-[#ff5a00] border border-[#ff5a00]/30">
                    {STATUS[job.status] || job.status}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-4 gap-3 mt-4 text-xs text-slate-300">
                  <p>Source: {job.source_type || '—'}</p>
                  <p>From: {job.received_from || '—'}</p>
                  <p>Good: {job.good_quantity || 0}</p>
                  <p>Bad/Scrap: {job.bad_quantity || 0}</p>
                </div>

                <div className="grid md:grid-cols-3 gap-3 mt-2 text-xs text-slate-300">
                  <p>Action: {job.action_required || '—'}</p>
                  <p>Test: {TEST_RESULT[job.test_result] || job.test_result || '—'}</p>
                  <p>Inventory: {TRANSFER_STATUS[job.inventory_transfer_status] || job.inventory_transfer_status || '—'}</p>
                </div>

                {job.parts_used && (
                  <p className="text-xs text-slate-300 mt-2">
                    Parts Used: {job.parts_used}
                  </p>
                )}

                {job.final_remark && (
                  <p className="text-xs text-slate-300 mt-2">
                    Remark: {job.final_remark}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {Object.entries(STATUS).map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(job, key)}
                      className={
                        job.status === key
                          ? 'bg-[#ff5a00] text-white border-[#ff5a00]'
                          : 'border-white/10 text-white hover:bg-white/10'
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl bg-[#102969] border border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New R/R Job</DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source Type</Label>
              <Select
                value={form.source_type}
                onValueChange={(v) => updateField('source_type', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="returned_damaged_part">Returned Damaged Part</SelectItem>
                  <SelectItem value="decommissioned_machine">Decommissioned Machine</SelectItem>
                  <SelectItem value="inventory_test_request">Inventory Test Request</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Received From</Label>
              <Select
                value={form.received_from}
                onValueChange={(v) => updateField('received_from', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="field_engineer">Field Engineer</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="procurement">Procurement</SelectItem>
                  <SelectItem value="client_bank">Client / Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Item / Part Name *</Label>
              <Input
                value={form.item_name}
                onChange={(e) => updateField('item_name', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Part Number</Label>
              <Input
                value={form.part_number}
                onChange={(e) => updateField('part_number', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Machine Brand</Label>
              <Select
                value={form.machine_brand}
                onValueChange={(v) => updateField('machine_brand', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NCR">NCR</SelectItem>
                  <SelectItem value="Wincor">Wincor</SelectItem>
                  <SelectItem value="Hyosung">Hyosung</SelectItem>
                  <SelectItem value="Diebold">Diebold</SelectItem>
                  <SelectItem value="Entrust">Entrust</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Machine Model</Label>
              <Input
                value={form.machine_model}
                onChange={(e) => updateField('machine_model', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Quantity Received</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity_received}
                onChange={(e) => updateField('quantity_received', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Condition on Arrival</Label>
              <Select
                value={form.condition_on_arrival}
                onValueChange={(v) => updateField('condition_on_arrival', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="faulty">Faulty</SelectItem>
                  <SelectItem value="untested">Untested</SelectItem>
                  <SelectItem value="scrap">Scrap</SelectItem>
                  <SelectItem value="reusable">Reusable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Action Required</Label>
              <Select
                value={form.action_required}
                onValueChange={(v) => updateField('action_required', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test_only">Test Only</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="refurbish">Refurbish</SelectItem>
                  <SelectItem value="extract_good_parts">Extract Good Parts</SelectItem>
                  <SelectItem value="scrap_assessment">Scrap Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Test Result</Label>
              <Select
                value={form.test_result}
                onValueChange={(v) => updateField('test_result', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="partially_working">Partially Working</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Good Quantity Recovered</Label>
              <Input
                type="number"
                min="0"
                value={form.good_quantity}
                onChange={(e) => updateField('good_quantity', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Bad Quantity / Scrap</Label>
              <Input
                type="number"
                min="0"
                value={form.bad_quantity}
                onChange={(e) => updateField('bad_quantity', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Inventory Transfer Status</Label>
              <Select
                value={form.inventory_transfer_status}
                onValueChange={(v) => updateField('inventory_transfer_status', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_ready">Not Ready</SelectItem>
                  <SelectItem value="ready_to_transfer">Ready to Transfer</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Repair Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField('status', v)}
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Fault / Observation</Label>
              <Textarea
                value={form.fault_description}
                onChange={(e) => updateField('fault_description', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white min-h-[90px]"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Parts Used During Repair</Label>
              <Textarea
                value={form.parts_used}
                onChange={(e) => updateField('parts_used', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white min-h-[70px]"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Final Remark</Label>
              <Textarea
                value={form.final_remark}
                onChange={(e) => updateField('final_remark', e.target.value)}
                className="bg-[#08153d]/80 border-white/10 text-white min-h-[80px]"
              />
            </div>
          </div>

          <Button
            onClick={createJob}
            disabled={saving}
            className="w-full bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create R/R Job
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}