import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  Search,
  Wrench,
  Loader2,
  ClipboardCheck,
  PackageCheck,
  PackagePlus,
  AlertTriangle,
  RotateCcw,
  DollarSign,
} from 'lucide-react';

const STATUS = {
  received: 'Received By HOD',
  assigned: 'Assigned To Me',
  refurbishing: 'Under Repair',
  awaiting_parts: 'Awaiting Consumables',
  awaiting_fund: 'Awaiting Fund',
  testing: 'Submitted To HOD QA',
  qa_failed: 'QA Failed / Rework',
  ready_for_inventory: 'QA Passed / HOD Review',
  sent_to_inventory: 'Sent To Inventory',
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

function isRRHODOrAdmin(user) {
  const role = normalize(user?.role || user?.user_role || user?.position);
  return (
    role.includes('admin') ||
    role.includes('rr_hod') ||
    role.includes('repair_head') ||
    role.includes('repair hod') ||
    role.includes('hod') ||
    role.includes('head')
  );
}

function getJobTitle(job) {
  return job.item_name || job.device_name || 'R/R Item';
}

function getRepairJobState(job) {
  const status = normalize(job?.status);
  const testResult = normalize(job?.test_result);
  const transferStatus = normalize(job?.inventory_transfer_status);

  if (status === 'sent_to_inventory' || transferStatus === 'transferred') return 'sent_to_inventory';
  if (status === 'ready_for_inventory' || testResult === 'passed') return 'ready_for_inventory';
  if (status === 'qa_failed' || testResult === 'failed') return 'qa_failed';
  if (status === 'testing') return 'testing';
  if (status === 'awaiting_parts') return 'awaiting_parts';
  if (status === 'awaiting_fund') return 'awaiting_fund';
  if (status === 'refurbishing' || status === 'under_repair') return 'refurbishing';
  if (status === 'assigned' || status === 'received' || status === 'pending_rr') return 'assigned';
  if (status === 'scrap' || status === 'scrapped') return 'scrap';

  return status || 'assigned';
}

function canDoRepairJobAction(job, action) {
  const state = getRepairJobState(job);

  const allowed = {
    assigned: ['start_rr_repair'],
    refurbishing: ['request_consumable', 'request_fund', 'submit_rr_qa'],
    awaiting_parts: ['start_rr_repair', 'submit_rr_qa'],
    awaiting_fund: ['start_rr_repair', 'submit_rr_qa'],
    qa_failed: ['start_rr_repair', 'request_consumable', 'request_fund'],
    testing: [],
    ready_for_inventory: [],
    sent_to_inventory: [],
    scrap: [],
  };

  return allowed[state]?.includes(action) || false;
}

function filterPayloadByExistingColumns(row, payload) {
  const safePayload = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      safePayload[key] = value;
    }
  });

  return safePayload;
}

export default function RepairRefurbish() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || null;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('assigned_to_me');
  const [updatingId, setUpdatingId] = useState(null);

  const userEmail = user?.email || user?.user_email || '';
  const canViewAll = isRRHODOrAdmin(user);

  const [profileId, setProfileId] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);

      try {
        let email = userEmail;

        if (!email) {
          const { data: authData } = await supabase.auth.getUser();
          email = authData?.user?.email || '';
        }

        if (!email) {
          setProfileId(null);
          return;
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, user_email, role, department')
          .ilike('user_email', email.trim())
          .maybeSingle();

        if (error) throw error;

        setProfileId(data?.id || null);
      } catch (error) {
        console.error('RR profile lookup failed:', error);
        setProfileId(null);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [userEmail]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['repair-jobs', profileId, canViewAll],
    enabled: canViewAll || !!profileId,
    queryFn: async () => {
      let query = supabase
        .from('repair_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!canViewAll) {
        query = query.eq('assigned_rr_technician', profileId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    },
  });

  const updateLinkedPartRequest = async (job, payload) => {
    try {
      if (!job.part_request_id) return;

      const partPayload = {};

      if (payload.status === 'refurbishing') {
        partPayload.rr_status = 'under_repair';
        partPayload.lifecycle_status = 'under_repair';
        partPayload.inventory_status = 'transferred_rr';
        partPayload.dispatch_status = 'waiting_rr';
      }

      if (payload.status === 'awaiting_parts') {
        partPayload.rr_status = 'under_repair';
        partPayload.lifecycle_status = 'awaiting_consumables';
        partPayload.inventory_status = 'transferred_rr';
        partPayload.dispatch_status = 'waiting_rr';
      }

      if (payload.status === 'awaiting_fund') {
        partPayload.rr_status = 'under_repair';
        partPayload.lifecycle_status = 'awaiting_rr_fund';
        partPayload.inventory_status = 'transferred_rr';
        partPayload.dispatch_status = 'waiting_rr';
      }

      if (payload.status === 'testing') {
        partPayload.rr_status = 'waiting_qa';
        partPayload.qa_status = 'pending';
        partPayload.lifecycle_status = 'waiting_qa';
        partPayload.inventory_status = 'transferred_rr';
        partPayload.dispatch_status = 'waiting_rr';
      }

      const shouldUpdate = Object.keys(partPayload).length > 0;
      if (!shouldUpdate) return;

      partPayload.updated_at = new Date().toISOString();

      await supabase
        .from('part_requests')
        .update(partPayload)
        .eq('id', job.part_request_id);
    } catch (error) {
      console.warn('Linked part request update skipped:', error);
    }
  };

  const updateJob = async (job, payload, message) => {
    setUpdatingId(job.id);

    const safePayload = filterPayloadByExistingColumns(job, {
      ...payload,
      updated_at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from('repair_jobs')
      .update(safePayload)
      .eq('id', job.id);

    if (error) {
      alert('Status update failed: ' + error.message);
      setUpdatingId(null);
      return;
    }

    await updateLinkedPartRequest(job, safePayload);

    await supabase.from('operations_events').insert({
      event_type: 'RR_TECH_JOB_UPDATE',
      title: message,
      description: `${message} for ${job.job_number || job.id}`,
      source_module: 'Repair & Refurbishment',
      entity_type: 'repair_job',
      entity_id: job.id,
      severity: payload.status === 'qa_failed' ? 'warning' : 'info',
    });

    qc.invalidateQueries({ queryKey: ['repair-jobs'] });
    setUpdatingId(null);
  };

  const startRepair = (job) => {
    if (!canDoRepairJobAction(job, 'start_rr_repair')) {
      alert('This repair job is not ready to start/rework.');
      return;
    }

    updateJob(
      job,
      {
        status: 'refurbishing',
        test_result: 'pending',
        inventory_transfer_status: 'not_ready',
      },
      getRepairJobState(job) === 'qa_failed' ? 'Rework started' : 'Repair started'
    );
  };

  const requestConsumables = async (job) => {
    if (!canDoRepairJobAction(job, 'request_consumable')) {
      alert('Consumables can only be requested while the job is under repair or rework stage.');
      return;
    }

    await updateJob(
      job,
      {
        status: 'awaiting_parts',
        inventory_transfer_status: 'not_ready',
      },
      'RR technician requested consumables'
    );

    navigate(`/rr-consumable-requests?job_id=${job.id}`);
  };

  const requestFund = async (job) => {
    if (!canDoRepairJobAction(job, 'request_fund')) {
      alert('Funds can only be requested while the job is under repair or rework stage.');
      return;
    }

    await updateJob(
      job,
      {
        status: 'awaiting_fund',
        inventory_transfer_status: 'not_ready',
      },
      'RR technician requested repair fund'
    );

    navigate(`/rr-fund-requests?job_id=${job.id}`);
  };

  const submitQA = (job) => {
    if (!canDoRepairJobAction(job, 'submit_rr_qa')) {
      alert('This repair job is not ready for QA submission.');
      return;
    }

    updateJob(
      job,
      {
        status: 'testing',
        test_result: 'pending',
        inventory_transfer_status: 'not_ready',
      },
      'Submitted to RR HOD for QA'
    );
  };

  const counts = useMemo(
    () => ({
      assigned: jobs.filter((j) =>
        ['assigned', 'received', 'pending_rr'].includes(normalize(j.status))
      ).length,
      underRepair: jobs.filter((j) => j.status === 'refurbishing').length,
      awaitingParts: jobs.filter((j) => j.status === 'awaiting_parts').length,
      awaitingFund: jobs.filter((j) => j.status === 'awaiting_fund').length,
      waitingQa: jobs.filter((j) => j.status === 'testing').length,
      qaFailed: jobs.filter((j) => j.status === 'qa_failed' || j.test_result === 'failed').length,
    }),
    [jobs]
  );

  const filtered = useMemo(() => {
    let list = jobs;

    if (activeFilter === 'assigned_to_me') {
      if (!canViewAll && profileId) {
        list = list.filter((j) => j.assigned_rr_technician === profileId);
      }
    }

    if (activeFilter === 'under_repair') {
      list = list.filter((j) => j.status === 'refurbishing');
    }

    if (activeFilter === 'awaiting_parts') {
      list = list.filter((j) => j.status === 'awaiting_parts');
    }

    if (activeFilter === 'awaiting_fund') {
      list = list.filter((j) => j.status === 'awaiting_fund');
    }

    if (activeFilter === 'waiting_qa') {
      list = list.filter((j) => j.status === 'testing');
    }

    if (activeFilter === 'qa_failed') {
      list = list.filter((j) => j.status === 'qa_failed' || j.test_result === 'failed');
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
          j.part_number,
          j.machine_brand,
          j.machine_model,
          j.fault_description,
          j.final_remark,
          j.status,
          j.ticket_id,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(s))
      );
    }

    return list;
  }, [jobs, search, activeFilter, profileId, canViewAll]);

  const statusCards = [
    {
      key: 'assigned_to_me',
      label: canViewAll ? 'Assigned Jobs' : 'Assigned To Me',
      value: counts.assigned,
      icon: Wrench,
    },
    { key: 'under_repair', label: 'Under Repair', value: counts.underRepair, icon: PackageCheck },
    { key: 'awaiting_parts', label: 'Awaiting Consumables', value: counts.awaitingParts, icon: PackagePlus },
    { key: 'awaiting_fund', label: 'Awaiting Fund', value: counts.awaitingFund, icon: DollarSign },
    { key: 'waiting_qa', label: 'Submitted QA', value: counts.waitingQa, icon: ClipboardCheck },
    { key: 'qa_failed', label: 'QA Failed', value: counts.qaFailed, icon: AlertTriangle },
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
            RR Technician workspace: repair, request consumables/funds, and submit completed jobs to RR HOD for QA.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
        <p className="text-sm text-emerald-200 font-semibold">
          RR Technician page only:
        </p>
        <p className="text-xs text-emerald-100 mt-1">
          Start repair, request consumables, request repair fund, and submit QA. QA pass/fail, scrap, and send Inventory belong to RR HOD.
        </p>
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
            <h2 className="text-lg font-bold text-white">R/R Technician Jobs</h2>
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

        {isLoading || profileLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-300">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No R/R jobs found.</p>
            {!canViewAll && !profileId && (
              <p className="text-xs text-orange-300 mt-2">
                User profile not resolved yet. Check user_email in user_profiles.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((job) => {
              const state = getRepairJobState(job);

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-white/10 bg-[#08153d]/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400 font-mono">
                        {job.job_number || job.ticket_id || job.id}
                      </p>

                      <h3 className="text-white font-bold">
                        {getJobTitle(job)}
                      </h3>

                      <p className="text-sm text-slate-300 mt-1">
                        {job.fault_description || 'No observation recorded'}
                      </p>

                      <p className="text-xs text-slate-400 mt-2">
                        {job.machine_brand || 'No brand'} · {job.machine_model || 'No model'} · Qty: {job.quantity_received || 1}
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
                    {canDoRepairJobAction(job, 'start_rr_repair') && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === job.id}
                        onClick={() => startRepair(job)}
                        className="border-white/10 text-white hover:bg-white/10"
                      >
                        {state === 'qa_failed' ? (
                          <RotateCcw className="w-4 h-4 mr-1" />
                        ) : (
                          <Wrench className="w-4 h-4 mr-1" />
                        )}
                        {state === 'qa_failed' ? 'Rework' : 'Start Repair'}
                      </Button>
                    )}

                    {canDoRepairJobAction(job, 'request_consumable') && (
                      <Button
                        size="sm"
                        disabled={updatingId === job.id}
                        onClick={() => requestConsumables(job)}
                        className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
                      >
                        <PackagePlus className="w-4 h-4 mr-1" />
                        Request Consumables
                      </Button>
                    )}

                    {canDoRepairJobAction(job, 'request_fund') && (
                      <Button
                        size="sm"
                        disabled={updatingId === job.id}
                        onClick={() => requestFund(job)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Request Fund
                      </Button>
                    )}

                    {canDoRepairJobAction(job, 'submit_rr_qa') && (
                      <Button
                        size="sm"
                        disabled={updatingId === job.id}
                        onClick={() => submitQA(job)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <ClipboardCheck className="w-4 h-4 mr-1" />
                        Submit To HOD QA
                      </Button>
                    )}

                    {!canDoRepairJobAction(job, 'start_rr_repair') &&
                      !canDoRepairJobAction(job, 'request_consumable') &&
                      !canDoRepairJobAction(job, 'request_fund') &&
                      !canDoRepairJobAction(job, 'submit_rr_qa') && (
                        <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                          Waiting for RR HOD action
                        </span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
