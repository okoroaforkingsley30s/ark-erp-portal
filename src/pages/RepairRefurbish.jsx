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
  CheckCircle,
  Archive,
  History,
  XCircle,
  BarChart3,
  Printer,
  Share2,
} from 'lucide-react';

const STATUS = {
  pending_rr: 'Waiting RR HOD Intake',
  received: 'Received By HOD',
  assigned: 'Assigned To Me',
  refurbishing: 'Under Repair',
  under_repair: 'Under Repair',
  awaiting_parts: 'Awaiting Consumables',
  awaiting_fund: 'Awaiting Fund',
  testing: 'Submitted To HOD QA',
  waiting_qa: 'Submitted To HOD QA',
  qa_failed: 'QA Failed / Rework',
  ready_for_inventory: 'QA Passed / Waiting Inventory Return',
  qa_passed: 'QA Passed',
  sent_to_inventory: 'Job Completed / Sent To Inventory',
  scrap: 'Scrapped',
  scrapped: 'Scrapped',
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
  return [
    'system_admin', 'ceo', 'agm', 'manager', 'repair_head',
    'rr_hod', 'repair_hod', 'head_of_rr',
  ].includes(role);
}

function isRRHOD(user) {
  const role = normalize(user?.role || user?.user_role || user?.position);
  return ['repair_head', 'rr_hod', 'repair_hod', 'head_of_rr'].includes(role);
}

function getJobTitle(job) {
  return job.item_name || job.device_name || 'R/R Item';
}

function getRepairJobState(job) {
  const status = normalize(job?.status);
  const testResult = normalize(job?.test_result);
  const transferStatus = normalize(job?.inventory_transfer_status);

  if (status === 'sent_to_inventory' || status === 'inventory_received' || transferStatus === 'transferred') {
    return 'sent_to_inventory';
  }

  if (status === 'scrap' || status === 'scrapped') return 'scrap';
  if (status === 'ready_for_inventory' || status === 'qa_passed' || testResult === 'passed') {
    return 'ready_for_inventory';
  }

  if (status === 'qa_failed' || testResult === 'failed') return 'qa_failed';
  if (status === 'testing' || status === 'waiting_qa') return 'testing';
  if (status === 'awaiting_parts') return 'awaiting_parts';
  if (status === 'awaiting_fund') return 'awaiting_fund';
  if (status === 'refurbishing' || status === 'under_repair') return 'refurbishing';
  if (status === 'assigned' || status === 'received' || status === 'pending_rr') return 'assigned';

  return status || 'assigned';
}

function isCompletedJob(job) {
  const state = getRepairJobState(job);
  return ['sent_to_inventory', 'scrap'].includes(state);
}

function isHistoryJob(job) {
  const state = getRepairJobState(job);
  return ['sent_to_inventory', 'scrap', 'ready_for_inventory'].includes(state);
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

function getTerminalMessage(job) {
  const state = getRepairJobState(job);

  if (state === 'sent_to_inventory') {
    return 'Job completed and sent back to Inventory';
  }

  if (state === 'ready_for_inventory') {
    return 'QA passed. Waiting for RR HOD to send back to Inventory';
  }

  if (state === 'testing') {
    return 'Submitted to RR HOD for QA review';
  }

  if (state === 'scrap') {
    return 'Job closed as scrapped';
  }

  return 'Waiting for RR HOD action';
}

function statusBadgeClass(job) {
  const state = getRepairJobState(job);

  if (state === 'sent_to_inventory') {
    return 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30';
  }

  if (state === 'ready_for_inventory') {
    return 'bg-green-500/10 text-green-300 border border-green-500/20';
  }

  if (state === 'qa_failed' || state === 'scrap') {
    return 'bg-red-500/10 text-red-300 border border-red-500/20';
  }

  if (state === 'testing') {
    return 'bg-blue-500/10 text-blue-300 border border-blue-500/20';
  }

  return 'bg-[#ff5a00]/15 text-[#ff5a00] border border-[#ff5a00]/30';
}

function jobReportText(job) {
  return [
    'ARK ONE REPAIR & REFURBISHMENT JOB REPORT',
    `Job Number: ${job.job_number || job.id}`,
    `Item: ${getJobTitle(job)}`,
    `Status: ${STATUS[job.status] || job.status || '—'}`,
    `Source: ${job.source_type || '—'} / ${job.received_from || '—'}`,
    `Brand / Model: ${job.machine_brand || '—'} / ${job.machine_model || '—'}`,
    `Fault: ${job.fault_description || '—'}`,
    `Diagnosis: ${job.diagnosis || '—'}`,
    `Action Required: ${job.action_required || '—'}`,
    `Parts / Consumables Used: ${job.parts_used || '—'}`,
    `QA Result: ${TEST_RESULT[job.test_result] || job.test_result || '—'}`,
    `Good / Bad Quantity: ${job.good_quantity || 0} / ${job.bad_quantity || 0}`,
    `Final Remark: ${job.final_remark || '—'}`,
    `RR HOD Owner: ${job.hod_owner_email || '—'}`,
    `Received: ${job.created_at ? new Date(job.created_at).toLocaleString() : '—'}`,
    `Assigned: ${job.assigned_at ? new Date(job.assigned_at).toLocaleString() : '—'}`,
    `Completed: ${job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}`,
  ].join('\n');
}

function printJob(job) {
  const popup = window.open('', '_blank', 'width=850,height=900');
  if (!popup) return;
  const safeText = jobReportText(job).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  popup.document.write(`<html><head><title>${job.job_number || 'RR Job'}</title><style>body{font-family:Arial,sans-serif;padding:36px;color:#172554}h1{font-size:22px;border-bottom:3px solid #f97316;padding-bottom:12px}pre{white-space:pre-wrap;line-height:1.7;font:14px Arial,sans-serif}.footer{margin-top:40px;border-top:1px solid #bbb;padding-top:12px;font-size:11px;color:#666}</style></head><body><h1>ARK ONE · Repair & Refurbishment</h1><pre>${safeText}</pre><div class="footer">Generated from ARK ONE on ${new Date().toLocaleString()}</div><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

async function shareJob(job) {
  const text = jobReportText(job);
  if (navigator.share) {
    await navigator.share({ title: `RR Job ${job.job_number || ''}`, text });
    return;
  }
  await navigator.clipboard.writeText(text);
  alert('Job report copied. You can paste it into WhatsApp, email or ARK Connect.');
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
  const canTakeUp = isRRHOD(user);

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
        query = query.or(
          `assigned_rr_technician.eq.${profileId},assigned_to.eq.${profileId}`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).filter((job) =>
        canViewAll ||
        String(job.assigned_rr_technician || '') === String(profileId) ||
        String(job.assigned_to || '') === String(profileId)
      );
    },
  });

  const { data: performance } = useQuery({
    queryKey: ['rr-performance', 90],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ark_rr_performance_snapshot', { p_days: 90 });
      if (error) throw error;
      return data || { summary: {}, people: [], trend: [] };
    },
  });

  const updateJob = async (job, payload) => {
    setUpdatingId(job.id);

    const actionByStatus = {
      refurbishing: 'start_repair',
      awaiting_parts: 'request_consumables',
      awaiting_fund: 'request_fund',
      testing: 'submit_qa',
    };
    const action = actionByStatus[normalize(payload.status)];

    if (!action) {
      alert('Unsupported RR workflow transition.');
      setUpdatingId(null);
      return;
    }

    const { error } = await supabase.rpc('rr_transition_repair_job', {
      p_record_id: job.id,
      p_record_type: 'repair_job',
      p_action: action,
      p_technician_id: null,
    });

    if (error) alert('Status update failed: ' + error.message);
    else qc.invalidateQueries({ queryKey: ['repair-jobs'] });
    setUpdatingId(null);
  };

  const takeUpJob = async (job) => {
    setUpdatingId(job.id);
    try {
      const { error } = await supabase.rpc('rr_hod_take_repair_job', { p_repair_job_id: job.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['repair-jobs'] });
    } catch (error) {
      alert('RR HOD take-up failed: ' + (error.message || 'Unknown error'));
    } finally {
      setUpdatingId(null);
    }
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

    navigate(`/rr-consumable-requests?job_id=${job.id}`);
  };

  const requestFund = async (job) => {
    if (!canDoRepairJobAction(job, 'request_fund')) {
      alert('Funds can only be requested while the job is under repair or rework stage.');
      return;
    }

    navigate(`/fund-requests?job_id=${job.id}`);
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
      underRepair: jobs.filter((j) => ['refurbishing', 'under_repair'].includes(normalize(j.status))).length,
      awaitingParts: jobs.filter((j) => normalize(j.status) === 'awaiting_parts').length,
      awaitingFund: jobs.filter((j) => normalize(j.status) === 'awaiting_fund').length,
      waitingQa: jobs.filter((j) => ['testing', 'waiting_qa'].includes(normalize(j.status))).length,
      qaFailed: jobs.filter((j) => normalize(j.status) === 'qa_failed' || normalize(j.test_result) === 'failed').length,
      completed: jobs.filter((j) => getRepairJobState(j) === 'sent_to_inventory').length,
      history: jobs.filter(isHistoryJob).length,
    }),
    [jobs]
  );

  const filtered = useMemo(() => {
    let list = jobs;

    if (activeFilter === 'assigned_to_me') {
      list = list.filter((j) => !isHistoryJob(j));
    }

    if (activeFilter === 'under_repair') {
      list = list.filter((j) => ['refurbishing', 'under_repair'].includes(normalize(j.status)));
    }

    if (activeFilter === 'awaiting_parts') {
      list = list.filter((j) => normalize(j.status) === 'awaiting_parts');
    }

    if (activeFilter === 'awaiting_fund') {
      list = list.filter((j) => normalize(j.status) === 'awaiting_fund');
    }

    if (activeFilter === 'waiting_qa') {
      list = list.filter((j) => ['testing', 'waiting_qa'].includes(normalize(j.status)));
    }

    if (activeFilter === 'qa_failed') {
      list = list.filter((j) => normalize(j.status) === 'qa_failed' || normalize(j.test_result) === 'failed');
    }

    if (activeFilter === 'completed') {
      list = list.filter((j) => getRepairJobState(j) === 'sent_to_inventory');
    }

    if (activeFilter === 'history') {
      list = list.filter(isHistoryJob);
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
  }, [jobs, search, activeFilter]);

  const statusCards = [
    {
      key: 'assigned_to_me',
      label: canViewAll ? 'Active Jobs' : 'Assigned To Me',
      value: counts.assigned,
      icon: Wrench,
    },
    { key: 'under_repair', label: 'Under Repair', value: counts.underRepair, icon: PackageCheck },
    { key: 'awaiting_parts', label: 'Awaiting Consumables', value: counts.awaitingParts, icon: PackagePlus },
    { key: 'awaiting_fund', label: 'Awaiting Fund', value: counts.awaitingFund, icon: DollarSign },
    { key: 'waiting_qa', label: 'Submitted QA', value: counts.waitingQa, icon: ClipboardCheck },
    { key: 'qa_failed', label: 'QA Failed', value: counts.qaFailed, icon: AlertTriangle },
    { key: 'completed', label: 'Completed', value: counts.completed, icon: CheckCircle },
    { key: 'history', label: 'Job History', value: counts.history, icon: History },
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
            RR workspace: RR HOD can take ownership without assigning a technician; technicians repair, request support and submit QA.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
        <p className="text-sm text-emerald-200 font-semibold">
          Controlled RR workflow:
        </p>
        <p className="text-xs text-emerald-100 mt-1">
          A HOD-owned job remains unassigned to an RR Technician and can still be assigned later. Completed jobs move into Job History.
        </p>
      </div>

      <Card className="bg-[#102969]/90 border border-white/10 p-4 text-white">
        <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-5 h-5 text-[#ff5a00]" /><h2 className="font-bold">RR Performance · Last 90 Days</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Jobs received', performance?.summary?.total || 0],
            ['Completed', performance?.summary?.completed || 0],
            ['Pending', performance?.summary?.pending || 0],
            ['QA failed / rework', performance?.summary?.qa_failed || 0],
            ['Avg turnaround', `${performance?.summary?.avg_turnaround_hours || 0}h`],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-[#08153d]/80 border border-white/10 p-3"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-slate-300">{label}</p></div>)}
        </div>
        {(performance?.people || []).length > 0 && (
          <div className="overflow-x-auto mt-4"><table className="w-full text-xs"><thead className="text-slate-300 text-left"><tr><th className="py-2">RR owner/technician</th><th>Assigned</th><th>Completed</th><th>Pending</th><th>Rework</th><th>Avg turnaround</th></tr></thead><tbody>{performance.people.map((person) => <tr key={person.owner_email} className="border-t border-white/10"><td className="py-2"><p className="font-semibold">{person.owner_name}</p><p className="text-slate-400">{person.owner_email}</p></td><td>{person.assigned}</td><td className="text-emerald-300">{person.completed}</td><td>{person.pending}</td><td className="text-amber-300">{person.rework}</td><td>{person.avg_turnaround_hours ? `${person.avg_turnaround_hours}h` : '—'}</td></tr>)}</tbody></table></div>
        )}
      </Card>

      <div className="grid md:grid-cols-4 xl:grid-cols-8 gap-4">
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
            <h2 className="text-lg font-bold text-white">
              {activeFilter === 'history'
                ? 'R/R Job History'
                : activeFilter === 'completed'
                  ? 'Completed R/R Jobs'
                  : 'R/R Technician Jobs'}
            </h2>
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
              const terminal = isCompletedJob(job);

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
                      <Badge className={statusBadgeClass(job)}>
                        {STATUS[job.status] || STATUS[state] || job.status || 'Assigned'}
                      </Badge>

                      <Badge className="bg-green-500/10 text-green-300 border border-green-500/20">
                        QA: {TEST_RESULT[job.test_result] || job.test_result || 'pending'}
                      </Badge>

                      {terminal && (
                        <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Completed
                        </Badge>
                      )}
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

                  {job.hod_owner_email && (
                    <p className="mt-2 text-xs text-orange-200">
                      RR HOD owner: {job.hod_owner_email}
                    </p>
                  )}

                  {job.completed_at && (
                    <p className="text-xs text-emerald-300 mt-2">
                      Completed: {new Date(job.completed_at).toLocaleString()}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => printJob(job)} className="border-white/10 text-white hover:bg-white/10">
                      <Printer className="w-4 h-4 mr-1" />Print Job
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => shareJob(job).catch((error) => alert('Share failed: ' + error.message))} className="border-white/10 text-white hover:bg-white/10">
                      <Share2 className="w-4 h-4 mr-1" />Share Job
                    </Button>
                    {canTakeUp &&
                      !job.hod_owner_profile_id &&
                      !job.assigned_rr_technician &&
                      !job.assigned_to &&
                      ['pending_rr', 'received', 'assigned', ''].includes(normalize(job.status)) && (
                        <Button
                          size="sm"
                          disabled={updatingId === job.id}
                          onClick={() => takeUpJob(job)}
                          className="bg-[#ff5a00] text-white hover:bg-[#ff5a00]/90"
                        >
                          <Wrench className="mr-1 h-4 w-4" />
                          Take Up Job
                        </Button>
                      )}
                    {!canViewAll && canDoRepairJobAction(job, 'start_rr_repair') && (
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

                    {!canViewAll && canDoRepairJobAction(job, 'request_consumable') && (
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

                    {!canViewAll && canDoRepairJobAction(job, 'request_fund') && (
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

                    {!canViewAll && canDoRepairJobAction(job, 'submit_rr_qa') && (
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

                    {(canViewAll || (
                      !canDoRepairJobAction(job, 'start_rr_repair') &&
                      !canDoRepairJobAction(job, 'request_consumable') &&
                      !canDoRepairJobAction(job, 'request_fund') &&
                      !canDoRepairJobAction(job, 'submit_rr_qa')
                    )) && (
                        <span
                          className={[
                            'inline-flex items-center rounded-md border px-3 py-2 text-xs',
                            terminal
                              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                              : state === 'ready_for_inventory'
                                ? 'border-green-400/30 bg-green-500/10 text-green-200'
                                : state === 'scrap'
                                  ? 'border-red-400/30 bg-red-500/10 text-red-200'
                                  : 'border-white/10 bg-white/5 text-slate-300',
                          ].join(' ')}
                        >
                          {terminal ? (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          ) : state === 'scrap' ? (
                            <XCircle className="mr-2 h-4 w-4" />
                          ) : state === 'ready_for_inventory' ? (
                            <Archive className="mr-2 h-4 w-4" />
                          ) : (
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                          )}
                          {getTerminalMessage(job)}
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
