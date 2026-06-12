import React, { useEffect, useMemo, useState } from 'react';
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
  PackagePlus,
  ShieldCheck,
  XCircle,
  RotateCcw,
  AlertTriangle,
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
  assigned: 'Assigned',
  refurbishing: 'Under Repair',
  awaiting_parts: 'Awaiting Consumables',
  testing: 'Waiting QA',
  qa_failed: 'QA Failed',
  ready_for_inventory: 'QA Passed / Ready for Inventory',
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

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function isPrivilegedRRUser(user) {
  const role = normalize(user?.role || user?.user_role || user?.position);
  const department = normalize(user?.department);
  const email = normalize(user?.email);

  return (
    role.includes('admin') ||
    role.includes('hod') ||
    role.includes('head') ||
    role.includes('qa') ||
    department.includes('management') ||
    email.includes('admin')
  );
}

function canQA(user) {
  const role = normalize(user?.role || user?.user_role || user?.position);
  return isPrivilegedRRUser(user) || role.includes('qa') || role.includes('quality');
}

function getJobTitle(job) {
  return job.item_name || job.device_name || job.part_name || job.part_type || 'R/R Item';
}

export default function RepairRefurbish() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || null;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_JOB);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('assigned_to_me');
  const [updatingId, setUpdatingId] = useState(null);

  const userId = user?.id || user?.user_id || user?.auth_id;
  const userEmail = user?.email || user?.user_email || '';
  const canCreateManualJob = isPrivilegedRRUser(user);
  const userCanQA = canQA(user);

  // IMPORTANT:
  // RR assignment stores user_profiles.id in repair_jobs.assigned_rr_technician / assigned_to.
  // Supabase auth user.id is different, so we first resolve the logged-in user's profile id.
  const [profileId, setProfileId] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);

      try {
        if (userEmail) {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('id, user_email, role, department')
            .eq('user_email', userEmail)
            .maybeSingle();

          if (error) throw error;

          if (data?.id) {
            setProfileId(data.id);
            console.log('RR REPAIR PROFILE FOUND:', data);
            return;
          }
        }

        // Fallback only, in case AppLayout already passed user_profiles.id.
        setProfileId(userId || null);
        console.log('RR REPAIR PROFILE FALLBACK:', { userId, userEmail, user });
      } catch (error) {
        console.error('Failed to load RR profile:', error);
        setProfileId(userId || null);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [userEmail, userId]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['repair-jobs', profileId, canCreateManualJob],
    enabled: canCreateManualJob || !!profileId,
    queryFn: async () => {
      let query = supabase
        .from('repair_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!canCreateManualJob && profileId) {
        query = query.or(
          `assigned_rr_technician.eq.${profileId},assigned_to.eq.${profileId}`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('RR REPAIR JOBS FOUND:', {
        profileId,
        canCreateManualJob,
        count: data?.length || 0,
        data,
      });

      return data || [];
    },
  });

  const counts = useMemo(() => ({
    assigned: jobs.filter((j) => j.status === 'assigned' || j.status === 'received').length,
    underRepair: jobs.filter((j) => j.status === 'refurbishing').length,
    awaitingParts: jobs.filter((j) => j.status === 'awaiting_parts').length,
    waitingQa: jobs.filter((j) => j.status === 'testing' || j.test_result === 'pending').length,
    qaFailed: jobs.filter((j) => j.status === 'qa_failed' || j.test_result === 'failed').length,
    ready: jobs.filter((j) => j.status === 'ready_for_inventory' || j.test_result === 'passed').length,
  }), [jobs]);

  const filtered = useMemo(() => {
    let list = jobs;

    if (activeFilter === 'assigned_to_me') {
      if (!canCreateManualJob && profileId) {
        list = list.filter((j) =>
          j.assigned_rr_technician === profileId ||
          j.assigned_to === profileId
        );
      }
    }

    if (activeFilter === 'under_repair') {
      list = list.filter((j) => j.status === 'refurbishing');
    }

    if (activeFilter === 'awaiting_parts') {
      list = list.filter((j) => j.status === 'awaiting_parts');
    }

    if (activeFilter === 'waiting_qa') {
      list = list.filter((j) => j.status === 'testing' || j.test_result === 'pending');
    }

    if (activeFilter === 'qa_failed') {
      list = list.filter((j) => j.status === 'qa_failed' || j.test_result === 'failed');
    }

    if (activeFilter === 'ready_inventory') {
      list = list.filter((j) => j.status === 'ready_for_inventory' || j.test_result === 'passed');
    }

    if (search) {
      const s = search.toLowerCase();

      list = list.filter((j) =>
        [
          j.job_number,
          j.source_type,
          j.received_from,
          j.item_name,
          j.device_name,
          j.part_name,
          j.part_type,
          j.part_number,
          j.machine_brand,
          j.machine_model,
          j.fault_description,
          j.final_remark,
          j.status,
          j.qa_status,
          j.ticket_number,
          j.ticket_id,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(s))
      );
    }

    return list;
  }, [jobs, search, activeFilter, profileId, canCreateManualJob]);

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const createJob = async () => {
    if (!canCreateManualJob) {
      alert('Only RR HOD/Admin can create manual R/R jobs. Technicians receive assigned jobs from RR HOD.');
      return;
    }

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
        received_by: userEmail,
        device_name: form.item_name,
        diagnosis: form.final_remark,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('repair_jobs').insert(payload);

      if (error) throw error;

      await supabase.from('operations_events').insert({
        event_type: 'RR_MANUAL_JOB_CREATED',
        title: 'Manual R/R job created',
        description: `${jobNumber} created by ${userEmail || 'RR user'}`,
        source_module: 'Repair & Refurbishment',
        entity_type: 'repair_job',
        severity: 'info',
      });

      qc.invalidateQueries({ queryKey: ['repair-jobs'] });
      setForm(EMPTY_JOB);
      setOpen(false);
    } catch (err) {
      alert('R/R job creation failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateJob = async (job, payload, message) => {
    setUpdatingId(job.id);

    const { error } = await supabase
      .from('repair_jobs')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (error) {
      alert('Status update failed: ' + error.message);
      setUpdatingId(null);
      return;
    }

    await supabase.from('operations_events').insert({
      event_type: 'RR_REPAIR_JOB_UPDATE',
      title: message,
      description: `${message} for ${job.job_number || job.id}`,
      source_module: 'Repair & Refurbishment',
      entity_type: 'repair_job',
      entity_id: job.id,
      severity: payload.test_result === 'failed' ? 'warning' : 'info',
    });

    qc.invalidateQueries({ queryKey: ['repair-jobs'] });
    setUpdatingId(null);
  };

  const startRepair = (job) => {
    updateJob(
      job,
      {
        status: 'refurbishing',
        inventory_transfer_status: 'not_ready',
      },
      'Repair started'
    );
  };

  const requestConsumables = (job) => {
    updateJob(
      job,
      {
        status: 'awaiting_parts',
        inventory_transfer_status: 'not_ready',
      },
      'Consumables requested / awaiting parts'
    );

    window.location.assign(`#/rr-consumable-requests?job=${job.id}`);
  };

  const submitQA = (job) => {
    updateJob(
      job,
      {
        status: 'testing',
        test_result: 'pending',
        inventory_transfer_status: 'not_ready',
      },
      'Submitted to QA'
    );
  };

  const qaPass = (job) => {
    if (!userCanQA) {
      alert('Only QA/RR HOD/Admin can pass QA.');
      return;
    }

    updateJob(
      job,
      {
        status: 'ready_for_inventory',
        test_result: 'passed',
        inventory_transfer_status: 'ready_to_transfer',
      },
      'QA passed - ready for Inventory'
    );
  };

  const qaFail = (job) => {
    if (!userCanQA) {
      alert('Only QA/RR HOD/Admin can fail QA.');
      return;
    }

    updateJob(
      job,
      {
        status: 'qa_failed',
        test_result: 'failed',
        inventory_transfer_status: 'not_ready',
      },
      'QA failed - returned for rework'
    );
  };

  const sendToInventory = (job) => {
    if (job.test_result !== 'passed') {
      alert('This job cannot be sent to Inventory until QA is passed.');
      return;
    }

    updateJob(
      job,
      {
        status: 'sent_to_inventory',
        inventory_transfer_status: 'transferred',
        completed_at: new Date().toISOString(),
      },
      'QA-passed job sent to Inventory'
    );
  };

  const statusCards = [
    { key: 'assigned_to_me', label: 'Assigned To Me', value: counts.assigned, icon: Wrench },
    { key: 'under_repair', label: 'Under Repair', value: counts.underRepair, icon: PackageCheck },
    { key: 'awaiting_parts', label: 'Awaiting Consumables', value: counts.awaitingParts, icon: PackagePlus },
    { key: 'waiting_qa', label: 'Waiting QA', value: counts.waitingQa, icon: ClipboardCheck },
    { key: 'qa_failed', label: 'QA Failed', value: counts.qaFailed, icon: AlertTriangle },
    { key: 'ready_inventory', label: 'Ready Inventory', value: counts.ready, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-7 h-7 text-[#ff5a00]" />
            Repair & Refurbish
          </h1>

          <p className="text-slate-300">
            Assigned RR jobs, repair activity, consumable request, mandatory QA, and inventory handover.
          </p>
        </div>

        {canCreateManualJob && (
          <Button
            onClick={() => setOpen(true)}
            className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Manual R/R Job
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statusCards.map(({ key, label, value, icon: Icon }) => (
          <Card
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`cursor-pointer bg-[#102969]/90 border rounded-xl p-4 transition hover:scale-[1.01] ${
              activeFilter === key ? 'border-[#ff5a00] ring-2 ring-[#ff5a00]/30' : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Icon className="w-5 h-5 text-[#ff5a00]" />
              <p className="text-3xl font-bold text-white">{value}</p>
            </div>
            <p className="text-slate-300 text-sm mt-2">{label}</p>
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

        {(isLoading || profileLoading) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-300">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No R/R jobs found.</p>
            {!canCreateManualJob && !profileId && (
              <p className="text-xs text-orange-300 mt-2">User profile not resolved yet. Check user_email in user_profiles.</p>
            )}
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
                      {job.job_number || job.ticket_number || job.id}
                    </p>

                    <h3 className="text-white font-bold">
                      {getJobTitle(job)}
                    </h3>

                    <p className="text-sm text-slate-300 mt-1">
                      {job.fault_description || job.reason || 'No observation recorded'}
                    </p>

                    <p className="text-xs text-slate-400 mt-2">
                      {job.machine_brand || 'No brand'} · {job.machine_model || 'No model'} · Qty: {job.quantity_received || job.quantity || 1}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-[#ff5a00]/15 text-[#ff5a00] border border-[#ff5a00]/30">
                      {STATUS[job.status] || job.status || 'Assigned'}
                    </Badge>

                    <Badge className="bg-green-500/10 text-green-300 border border-green-500/20">
                      QA: {TEST_RESULT[job.test_result] || job.test_result || 'pending'}
                    </Badge>
                  </div>
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingId === job.id}
                    onClick={() => startRepair(job)}
                    className="border-white/10 text-white hover:bg-white/10"
                  >
                    <Wrench className="w-4 h-4 mr-1" />
                    Start Repair
                  </Button>

                  <Button
                    size="sm"
                    disabled={updatingId === job.id}
                    onClick={() => requestConsumables(job)}
                    className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
                  >
                    <PackagePlus className="w-4 h-4 mr-1" />
                    Request Consumables
                  </Button>

                  <Button
                    size="sm"
                    disabled={updatingId === job.id}
                    onClick={() => submitQA(job)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <ClipboardCheck className="w-4 h-4 mr-1" />
                    Submit QA
                  </Button>

                  {userCanQA && (
                    <>
                      <Button
                        size="sm"
                        disabled={updatingId === job.id}
                        onClick={() => qaPass(job)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <ShieldCheck className="w-4 h-4 mr-1" />
                        QA Pass
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={updatingId === job.id}
                        onClick={() => qaFail(job)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        QA Fail
                      </Button>
                    </>
                  )}

                  {job.test_result === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingId === job.id}
                      onClick={() => startRepair(job)}
                      className="border-red-400/30 text-red-200 hover:bg-red-500/10"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Rework
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingId === job.id}
                    onClick={() => sendToInventory(job)}
                    className="border-green-400/30 text-green-200 hover:bg-green-500/10"
                  >
                    <PackageCheck className="w-4 h-4 mr-1" />
                    Send Inventory
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl bg-[#102969] border border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual R/R Job</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-orange-400/20 bg-orange-500/10 p-3 text-sm text-orange-100">
            Manual jobs should only be used by RR HOD/Admin for exceptional cases. Normal jobs should come from Inventory → RR HOD assignment.
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source Type</Label>
              <Select value={form.source_type} onValueChange={(v) => updateField('source_type', v)}>
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
              <Select value={form.received_from} onValueChange={(v) => updateField('received_from', v)}>
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
              <Input value={form.item_name} onChange={(e) => updateField('item_name', e.target.value)} className="bg-[#08153d]/80 border-white/10 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label>Part Number</Label>
              <Input value={form.part_number} onChange={(e) => updateField('part_number', e.target.value)} className="bg-[#08153d]/80 border-white/10 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label>Machine Brand</Label>
              <Select value={form.machine_brand} onValueChange={(v) => updateField('machine_brand', v)}>
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
              <Input value={form.machine_model} onChange={(e) => updateField('machine_model', e.target.value)} className="bg-[#08153d]/80 border-white/10 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label>Quantity Received</Label>
              <Input type="number" min="1" value={form.quantity_received} onChange={(e) => updateField('quantity_received', e.target.value)} className="bg-[#08153d]/80 border-white/10 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label>Condition on Arrival</Label>
              <Select value={form.condition_on_arrival} onValueChange={(v) => updateField('condition_on_arrival', v)}>
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
              <Select value={form.action_required} onValueChange={(v) => updateField('action_required', v)}>
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
              <Label>Repair Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField('status', v)}>
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Fault / Observation</Label>
              <Textarea value={form.fault_description} onChange={(e) => updateField('fault_description', e.target.value)} className="bg-[#08153d]/80 border-white/10 text-white min-h-[90px]" />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Parts Used During Repair</Label>
              <Textarea value={form.parts_used} onChange={(e) => updateField('parts_used', e.target.value)} className="bg-[#08153d]/80 border-white/10 text-white min-h-[70px]" />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Final Remark</Label>
              <Textarea value={form.final_remark} onChange={(e) => updateField('final_remark', e.target.value)} className="bg-[#08153d]/80 border-white/10 text-white min-h-[80px]" />
            </div>
          </div>

          <Button onClick={createJob} disabled={saving} className="w-full bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Manual R/R Job
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
