import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Search,
  Printer,
  RefreshCw,
  Wrench,
  PackageCheck,
  ClipboardCheck,
  CheckCircle,
  Trash2,
  RotateCcw,
  UserCheck,
  XCircle,
  ShieldCheck,
  Activity,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";
import { canAccess } from "@/lib/roleAccess";

const RR_FILTERS = [
  { key: "pending", label: "Pending RR Intake" },
  { key: "received", label: "Received By RR" },
  { key: "assigned", label: "Assigned To Tech" },
  { key: "under_repair", label: "Under Repair" },
  { key: "waiting_qa", label: "Waiting HOD QA" },
  { key: "qa_passed", label: "QA Passed" },
  { key: "qa_failed", label: "QA Failed" },
  { key: "returned_inventory", label: "Sent Back Inventory" },
  { key: "scrapped", label: "Scrapped" },
  { key: "all", label: "All RR Jobs" },
];

const pageBg =
  "min-h-screen bg-gradient-to-br from-[#06102f] via-[#08153d] to-[#102969] p-4 md:p-6 space-y-6 text-white";
const glassCard =
  "bg-[#102969]/85 border border-white/10 text-white shadow-2xl shadow-black/20 backdrop-blur rounded-2xl";
const inputClass =
  "bg-[#08153d]/80 border-white/10 text-white placeholder:text-blue-100/60 focus-visible:ring-[#ff5a00]";
const outlineButton =
  "border-white/15 bg-white/5 text-white hover:bg-[#ff5a00]/15 hover:text-white hover:border-[#ff5a00]/60";

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function statusLabel(value) {
  return String(value || "waiting").replaceAll("_", " ").toUpperCase();
}

function getUserRole(user) {
  return normalize(user?.role || user?.user_role || user?.position);
}

function isRRHOD(user) {
  const role = getUserRole(user);
  return (
    role.includes("admin") ||
    role.includes("rr_hod") ||
    role.includes("repair_head") ||
    role.includes("repair hod") ||
    role.includes("hod") ||
    role.includes("head")
  );
}

function statusBadgeClass(value) {
  const status = normalize(value);

  if (
    status.includes("pass") ||
    status.includes("received") ||
    status.includes("returned") ||
    status.includes("ready") ||
    status.includes("verified") ||
    status.includes("sent_to_inventory")
  ) {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  }

  if (status.includes("fail") || status.includes("scrap") || status.includes("reject")) {
    return "bg-red-500/15 text-red-300 border-red-400/30";
  }

  if (status.includes("qa") || status.includes("pending") || status === "testing") {
    return "bg-[#ff5a00]/15 text-orange-300 border-[#ff5a00]/30";
  }

  if (status.includes("repair") || status.includes("assigned") || status.includes("refurbishing")) {
    return "bg-blue-500/15 text-blue-300 border-blue-400/30";
  }

  return "bg-white/10 text-blue-100 border-white/10";
}

function getJobName(job) {
  return (
    job.item_name ||
    job.device_name ||
    job.part_name ||
    job.module_name ||
    job.fault_description ||
    "RR Job"
  );
}

function getJobState(job) {
  const status = normalize(job.status);
  const testResult = normalize(job.test_result);
  const transfer = normalize(job.inventory_transfer_status);

  if (status === "sent_to_inventory" || transfer === "transferred") return "returned_inventory";
  if (status === "scrap" || status === "scrapped") return "scrapped";
  if (status === "ready_for_inventory" || status === "qa_passed") return "qa_passed";
  if (status === "qa_failed" || testResult === "failed") return "qa_failed";
  if (status === "testing" || status === "waiting_qa") return "waiting_qa";
  if (["refurbishing", "under_repair", "awaiting_parts", "awaiting_fund"].includes(status)) return "under_repair";
  if (status === "assigned") return "assigned";
  if (status === "received" || status === "received_by_rr") return "received";
  if (["pending_rr", "pending", "waiting_intake", ""].includes(status)) return "pending";

  return "pending";
}

function getAllowedHODActions(job, user) {
  const state = getJobState(job);
  const hod = isRRHOD(user);

  const actions = {
    receive: false,
    assign: false,
    qaPass: false,
    qaFail: false,
    sendInventory: false,
    scrap: false,
  };

  if (!hod) return actions;

  if (state === "pending") actions.receive = true;
  if (state === "received") actions.assign = true;

  if (state === "waiting_qa") {
    actions.qaPass = true;
    actions.qaFail = true;
    actions.scrap = true;
  }

  if (state === "qa_failed") actions.scrap = true;
  if (state === "qa_passed") actions.sendInventory = true;

  return actions;
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

export default function RRPartRequests() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || null;
  const role = user?.role || user?.user_role || user?.position || "";

  const [jobs, setJobs] = useState([]);
  const [rrUsers, setRrUsers] = useState([]);
  const [selectedTech, setSelectedTech] = useState({});
  const [activeFilter, setActiveFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const getAssignedTechName = (value) => {
    if (!value) return "Not assigned";

    const rrUser = rrUsers.find(
      (u) =>
        String(u.id) === String(value) ||
        String(u.user_id) === String(value) ||
        String(u.user_email) === String(value) ||
        String(u.email) === String(value)
    );

    return rrUser?.full_name || rrUser?.name || rrUser?.user_email || rrUser?.email || value;
  };

  const matchesFilter = (job, key) => {
    const state = getJobState(job);
    if (key === "all") return true;
    return state === key;
  };

  const fetchRRUsers = async () => {
    try {
      const { data, error } = await supabase.from("user_profiles").select("*");
      if (error) throw error;

      const profiles = data || [];
      const rrTechs = profiles.filter((profile) => {
        const profileRole = normalize(profile.role || profile.user_role || profile.position);
        const department = normalize(profile.department || profile.department_name);

        return (
          profileRole.includes("repair_technician") ||
          profileRole.includes("rr_tech") ||
          profileRole.includes("rr tech") ||
          profileRole.includes("technician") ||
          profileRole.includes("repair") ||
          department.includes("repair") ||
          department.includes("refurbishment") ||
          department.includes("rr")
        );
      });

      setRrUsers(rrTechs.length > 0 ? rrTechs : profiles);
    } catch (error) {
      console.warn("RR users fetch failed:", error);
      setRrUsers([]);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("repair_jobs")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("RR repair jobs fetch error:", error);
      toast.error(error.message || "Failed to load RR jobs");
      setJobs([]);
    } else {
      setJobs(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRRUsers();
    fetchJobs();

    const channel = supabase
      .channel("rr-repair-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "repair_jobs" },
        () => fetchJobs()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const logOIN = async (job, action, payload, severity = "info") => {
    try {
      await supabase.from("operations_events").insert({
        event_type: `RR_HOD_${String(action).toUpperCase().replaceAll(" ", "_")}`,
        title: `RR HOD ${action}`,
        description: `${action} completed by RR HOD for ${job.job_number || job.id}`,
        source_module: "Repair & Refurbishment",
        entity_type: "repair_job",
        entity_id: job.id,
        severity,
        metadata: {
          repair_job_id: job.id,
          part_request_id: job.part_request_id,
          job_number: job.job_number,
          previous_status: job.status,
          new_values: payload,
        },
      });
    } catch (error) {
      console.warn("OIN log skipped:", error);
    }
  };

  const updateLinkedPartRequest = async (job, payload) => {
    if (!job.part_request_id) return;

    try {
      const partPayload = { updated_at: new Date().toISOString() };

      if (payload.status === "received") {
        partPayload.rr_status = "received";
        partPayload.lifecycle_status = "received_by_rr";
        partPayload.inventory_status = "transferred_rr";
        partPayload.dispatch_status = "waiting_rr";
      }

      if (payload.status === "assigned") {
        partPayload.rr_status = "assigned";
        partPayload.lifecycle_status = "assigned_to_rr_technician";
        partPayload.inventory_status = "transferred_rr";
        partPayload.dispatch_status = "waiting_rr";
        partPayload.assigned_rr_technician =
          payload.assigned_rr_technician || job.assigned_rr_technician || null;
        partPayload.assigned_by = payload.assigned_by || null;
        partPayload.assigned_at = payload.assigned_at || null;
      }

      if (payload.status === "ready_for_inventory") {
        partPayload.rr_status = "qa_passed";
        partPayload.qa_status = "passed";
        partPayload.lifecycle_status = "qa_passed";
        partPayload.inventory_status = "transferred_rr";
        partPayload.dispatch_status = "waiting_inventory_return";
      }

      if (payload.status === "qa_failed") {
        partPayload.rr_status = "qa_failed";
        partPayload.qa_status = "failed";
        partPayload.lifecycle_status = "qa_failed";
        partPayload.inventory_status = "transferred_rr";
        partPayload.dispatch_status = "waiting_rr_rework";
      }

      if (payload.status === "sent_to_inventory") {
        partPayload.rr_status = "returned_inventory";
        partPayload.qa_status = "passed";
        partPayload.inventory_status = "rr_verified";
        partPayload.dispatch_status = "ready_for_dispatch";
        partPayload.lifecycle_status = "ready_for_dispatch";
        partPayload.finance_status = "pending";
      }

      if (payload.status === "scrap") {
        partPayload.rr_status = "scrapped";
        partPayload.qa_status = "failed";
        partPayload.inventory_status = "scrapped";
        partPayload.dispatch_status = "not_dispatchable";
        partPayload.lifecycle_status = "scrapped";
      }

      if (Object.keys(partPayload).length <= 1) return;

      await supabase
        .from("part_requests")
        .update(partPayload)
        .eq("id", job.part_request_id);
    } catch (error) {
      console.warn("Linked part request update skipped:", error);
    }
  };

  const updateJob = async (job, payload, actionLabel, severity = "info") => {
    setUpdatingId(job.id);

    const safePayload = filterPayloadByExistingColumns(job, {
      ...payload,
      updated_at: new Date().toISOString(),
    });

    if (Object.keys(safePayload).length === 0) {
      toast.error("No matching database columns found for this update.");
      setUpdatingId(null);
      return;
    }

    const { error } = await supabase
      .from("repair_jobs")
      .update(safePayload)
      .eq("id", job.id);

    if (error) {
      console.error("RR repair job update failed:", error);
      toast.error(error.message || "Update failed");
      setUpdatingId(null);
      return;
    }

    await updateLinkedPartRequest(job, safePayload);
    await logOIN(job, actionLabel, safePayload, severity);

    toast.success(`${actionLabel} successful`);
    setUpdatingId(null);
    fetchJobs();
  };

  const receiveJob = async (job) => {
    if (!getAllowedHODActions(job, user).receive) {
      toast.error("Only RR HOD can receive this RR job at this stage.");
      return;
    }

    await updateJob(
      job,
      {
        status: "received",
        received_by: user?.full_name || user?.name || user?.email || "RR HOD",
        condition_on_arrival: job.condition_on_arrival || "received_from_inventory",
        action_required: job.action_required || "repair_required",
        test_result: job.test_result || "pending",
        inventory_transfer_status: job.inventory_transfer_status || "not_ready",
        final_remark: "Received by RR HOD",
      },
      "Receive Job"
    );
  };

  const assignTechnician = async (job) => {
    if (!getAllowedHODActions(job, user).assign) {
      toast.error("Only RR HOD can assign technician at this stage.");
      return;
    }

    const techId = selectedTech[job.id];

    if (!techId) {
      toast.error("Select RR technician first.");
      return;
    }

    const now = new Date().toISOString();

    await updateJob(
      job,
      {
        status: "assigned",
        assigned_rr_technician: techId,
        assigned_to: techId,
        assigned_by: user?.id || user?.auth_id || null,
        assigned_at: now,
        test_result: job.test_result || "pending",
        inventory_transfer_status: "not_ready",
        action_required: job.action_required || "repair_required",
        final_remark: `Assigned to ${getAssignedTechName(techId)}`,
      },
      "Assign Technician"
    );
  };

  const qaPass = async (job) => {
    if (!getAllowedHODActions(job, user).qaPass) {
      toast.error("Only RR HOD can pass QA after technician submits.");
      return;
    }

    await updateJob(
      job,
      {
        status: "ready_for_inventory",
        test_result: "passed",
        inventory_transfer_status: "ready_to_transfer",
        good_quantity: job.quantity_received || job.good_quantity || 1,
        bad_quantity: job.bad_quantity || 0,
        final_remark: "QA passed by RR HOD",
      },
      "QA Passed"
    );
  };

  const qaFail = async (job) => {
    if (!getAllowedHODActions(job, user).qaFail) {
      toast.error("Only RR HOD can fail QA after technician submits.");
      return;
    }

    await updateJob(
      job,
      {
        status: "qa_failed",
        test_result: "failed",
        inventory_transfer_status: "not_ready",
        good_quantity: job.good_quantity || 0,
        bad_quantity: job.quantity_received || job.bad_quantity || 1,
        final_remark: "QA failed by RR HOD",
      },
      "QA Failed",
      "warning"
    );
  };

  const sendBackInventory = async (job) => {
    if (!getAllowedHODActions(job, user).sendInventory) {
      toast.error("Only QA-passed jobs can be sent back to Inventory.");
      return;
    }

    await updateJob(
      job,
      {
        status: "sent_to_inventory",
        test_result: "passed",
        inventory_transfer_status: "transferred",
        completed_at: new Date().toISOString(),
        final_remark: "Sent back to Inventory after QA pass",
      },
      "Send Back Inventory"
    );
  };

  const scrapJob = async (job) => {
    if (!getAllowedHODActions(job, user).scrap) {
      toast.error("Only RR HOD can scrap this job at this stage.");
      return;
    }

    const ok = window.confirm("Confirm this part cannot be fixed and should be scrapped?");
    if (!ok) return;

    await updateJob(
      job,
      {
        status: "scrap",
        test_result: "failed",
        inventory_transfer_status: "not_ready",
        completed_at: new Date().toISOString(),
        good_quantity: 0,
        bad_quantity: job.quantity_received || job.bad_quantity || 1,
        action_required: "scrapped",
        final_remark: "Scrapped by RR HOD",
      },
      "Scrap",
      "warning"
    );
  };

  const filteredJobs = useMemo(() => {
    let list = jobs.filter((job) => matchesFilter(job, activeFilter));

    if (search.trim()) {
      const q = search.trim().toLowerCase();

      list = list.filter((job) =>
        [
          job.job_number,
          job.ticket_id,
          job.item_name,
          job.device_name,
          job.part_number,
          job.machine_brand,
          job.machine_model,
          job.fault_description,
          job.status,
          job.test_result,
          job.inventory_transfer_status,
          job.final_remark,
          getAssignedTechName(job.assigned_rr_technician || job.assigned_to),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }

    return list;
  }, [jobs, activeFilter, search, rrUsers]);

  const rrPerformance = useMemo(() => {
    const count = (key) => jobs.filter((job) => matchesFilter(job, key)).length;

    const qaPassed = count("qa_passed") + count("returned_inventory");
    const qaFailed = count("qa_failed") + count("scrapped");
    const qaTotal = qaPassed + qaFailed;
    const passRate = qaTotal > 0 ? Math.round((qaPassed / qaTotal) * 100) : 0;

    const active =
      count("pending") +
      count("received") +
      count("assigned") +
      count("under_repair") +
      count("waiting_qa") +
      count("qa_failed");

    const techMap = new Map();

    jobs.forEach((job) => {
      const techKey = job.assigned_rr_technician || job.assigned_to;
      if (!techKey) return;

      const current = techMap.get(techKey) || {
        id: techKey,
        name: getAssignedTechName(techKey),
        assigned: 0,
        underRepair: 0,
        waitingQa: 0,
        qaPassed: 0,
        qaFailed: 0,
        returnedInventory: 0,
        scrapped: 0,
        total: 0,
      };

      const state = getJobState(job);
      current.total += 1;

      if (state === "assigned") current.assigned += 1;
      if (state === "under_repair") current.underRepair += 1;
      if (state === "waiting_qa") current.waitingQa += 1;
      if (state === "qa_passed") current.qaPassed += 1;
      if (state === "qa_failed") current.qaFailed += 1;
      if (state === "returned_inventory") current.returnedInventory += 1;
      if (state === "scrapped") current.scrapped += 1;

      techMap.set(techKey, current);
    });

    return {
      active,
      pending: count("pending"),
      received: count("received"),
      assigned: count("assigned"),
      underRepair: count("under_repair"),
      waitingQa: count("waiting_qa"),
      qaPassed,
      qaFailed,
      returnedInventory: count("returned_inventory"),
      scrapped: count("scrapped"),
      passRate,
      technicians: Array.from(techMap.values()).sort((a, b) => b.total - a.total),
    };
  }, [jobs, rrUsers]);

  const countByFilter = (key) => jobs.filter((job) => matchesFilter(job, key)).length;

  const printReport = () => window.print();

  const cardIcon = {
    pending: Wrench,
    received: PackageCheck,
    assigned: UserCheck,
    under_repair: Wrench,
    waiting_qa: ClipboardCheck,
    qa_passed: CheckCircle,
    qa_failed: XCircle,
    returned_inventory: RotateCcw,
    scrapped: Trash2,
    all: PackageCheck,
  };

  return (
    <div className={pageBg}>
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #rr-print-area, #rr-print-area * { visibility: visible; }
            #rr-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              background: white !important;
              color: #102969 !important;
            }
            .no-print { display: none !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          }
        `}
      </style>

      <div className="no-print relative overflow-hidden rounded-3xl border border-white/10 bg-[#102969]/80 p-5 md:p-6 shadow-2xl shadow-black/30">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#ff5a00]/20 blur-3xl" />
        <div className="absolute -bottom-20 left-16 h-52 w-52 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/30 p-3 shadow-lg">
              <ShieldCheck className="h-8 w-8 text-[#ff5a00]" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-orange-300 font-semibold">
                ARK ONE ERP / RR HOD CONTROL
              </p>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                RR Intake, Assignment & QA
              </h1>
              <p className="text-sm text-blue-100 mt-1 max-w-3xl">
                RR Intake now reads repair_jobs only. One RR job, one source of truth.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchJobs} disabled={loading} className={outlineButton}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>

            {canAccess(role, "print_rr_report") && (
              <Button onClick={printReport} className="bg-[#ff5a00] hover:bg-[#e24f00] text-white shadow-lg shadow-orange-950/40">
                <Printer className="w-4 h-4 mr-2" />
                Print Report
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="no-print rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
        <p className="text-sm text-emerald-200 font-semibold">RR source of truth:</p>
        <p className="text-xs text-emerald-100 mt-1">
          RR Intake no longer reads part_requests. Everything inside RR now comes from repair_jobs.
        </p>
      </div>

      <div className="no-print grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="RR Active Workload" value={rrPerformance.active} note="Open RR jobs not yet completed." />
        <KpiCard title="Waiting QA" value={rrPerformance.waitingQa} note="Technician work awaiting HOD QA." valueClass="text-orange-300" />
        <KpiCard title="QA Pass Rate" value={`${rrPerformance.passRate}%`} note="Passed vs failed QA decisions." valueClass="text-emerald-300" />
        <KpiCard title="Returned Inventory" value={rrPerformance.returnedInventory} note="QA-passed parts sent back to Inventory." valueClass="text-blue-300" />
      </div>

      <Card className={`no-print ${glassCard}`}>
        <CardHeader className="border-b border-white/10 bg-[#08153d]/70">
          <CardTitle className="text-white">RR Performance Analysis</CardTitle>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MiniMetric label="Pending RR" value={rrPerformance.pending} />
            <MiniMetric label="Received" value={rrPerformance.received} />
            <MiniMetric label="Assigned" value={rrPerformance.assigned} />
            <MiniMetric label="Under Repair" value={rrPerformance.underRepair} />
            <MiniMetric label="QA Failed" value={rrPerformance.qaFailed} danger />
            <MiniMetric label="Scrapped" value={rrPerformance.scrapped} danger />
          </div>
        </CardContent>
      </Card>

      <div className="no-print grid grid-cols-2 md:grid-cols-4 xl:grid-cols-10 gap-3">
        {RR_FILTERS.map((filter) => {
          const Icon = cardIcon[filter.key] || PackageCheck;
          const isActive = activeFilter === filter.key;

          return (
            <Card
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`group cursor-pointer overflow-hidden border text-white shadow-xl transition hover:-translate-y-1 hover:shadow-2xl ${
                isActive
                  ? "border-[#ff5a00]/70 ring-2 ring-[#ff5a00]/40 bg-[#102969]"
                  : "border-white/10 bg-[#102969]/75 hover:border-[#ff5a00]/40"
              }`}
            >
              <CardContent className="relative p-4">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#ff5a00] to-[#102969]" />
                <div className="mb-3 inline-flex rounded-xl bg-[#ff5a00]/20 p-2 shadow-lg">
                  <Icon className="w-5 h-5 text-[#ff5a00]" />
                </div>
                <p className="text-[11px] leading-tight text-blue-100/80 min-h-[28px]">{filter.label}</p>
                <h2 className="text-3xl font-black text-white mt-1">{countByFilter(filter.key)}</h2>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className={`no-print ${glassCard}`}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2 text-blue-100">
              <Activity className="h-4 w-4 text-[#ff5a00]" />
              <span className="text-sm">
                Active filter:{" "}
                <strong className="text-white">
                  {RR_FILTERS.find((item) => item.key === activeFilter)?.label}
                </strong>
              </span>
            </div>

            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-3 w-4 h-4 text-blue-100/60" />
              <Input
                placeholder="Search job, part, technician, status..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`pl-9 ${inputClass}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="rr-print-area">
        <Card className={`${glassCard} print:bg-white print:text-[#102969] print:shadow-none print:border-slate-300`}>
          <CardHeader className="border-b border-white/10 bg-[#08153d]/70 print:bg-white print:border-slate-300">
            <CardTitle className="flex items-center justify-between gap-3 text-white print:text-[#102969]">
              <span>{RR_FILTERS.find((item) => item.key === activeFilter)?.label}</span>
              <span className="rounded-full border border-[#ff5a00]/30 bg-[#ff5a00]/10 px-3 py-1 text-xs text-orange-200 print:text-[#102969]">
                {filteredJobs.length} records
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <p className="p-5 text-sm text-blue-100 print:text-slate-700">Loading RR jobs...</p>
            ) : filteredJobs.length === 0 ? (
              <p className="p-5 text-sm text-blue-100 print:text-slate-700">No RR repair job found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#ff5a00] text-white print:bg-[#102969]">
                      <th className="text-left p-3 border border-white/10">Job</th>
                      <th className="text-left p-3 border border-white/10">Part / Item</th>
                      <th className="text-left p-3 border border-white/10">Qty</th>
                      <th className="text-left p-3 border border-white/10">Source</th>
                      <th className="text-left p-3 border border-white/10">RR Tech</th>
                      <th className="text-left p-3 border border-white/10">Status</th>
                      <th className="text-left p-3 border border-white/10">Test</th>
                      <th className="text-left p-3 border border-white/10">Inventory</th>
                      <th className="text-left p-3 border border-white/10">Updated</th>
                      <th className="text-left p-3 border border-white/10 min-w-[500px] no-print">HOD Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredJobs.map((job, index) => {
                      const actions = getAllowedHODActions(job, user);
                      const assignedValue = job.assigned_rr_technician || job.assigned_to;

                      return (
                        <tr
                          key={job.id}
                          className={`align-top text-white transition hover:bg-[#173b9a]/70 print:text-[#102969] print:bg-white ${
                            index % 2 === 0 ? "bg-[#102969]/80" : "bg-[#08153d]/80"
                          }`}
                        >
                          <td className="p-3 border border-white/10 print:border-slate-300 font-semibold">
                            {job.job_number || job.id}
                            <div className="text-xs text-blue-100/60">{job.ticket_id || job.part_request_id || ""}</div>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <div className="font-semibold text-white print:text-[#102969]">{getJobName(job)}</div>
                            <div className="text-xs text-blue-100/70 print:text-slate-500">
                              {job.fault_description || job.action_required || "No reason captured"}
                            </div>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">{job.quantity_received || 1}</td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className="text-xs uppercase">{job.source_type || "repair_job"}</span>
                            <div className="text-xs text-blue-100/60">{job.received_from || "Inventory"}</div>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            {assignedValue ? (
                              <span className="font-semibold text-orange-200 print:text-[#102969]">
                                {getAssignedTechName(assignedValue)}
                              </span>
                            ) : (
                              <span className="text-blue-100/60 print:text-slate-500">Not assigned</span>
                            )}
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(job.status || getJobState(job))}`}>
                              {statusLabel(job.status || getJobState(job))}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(job.test_result || "pending")}`}>
                              {statusLabel(job.test_result || "pending")}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(job.inventory_transfer_status || "not_ready")}`}>
                              {statusLabel(job.inventory_transfer_status || "not_ready")}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300 text-xs">
                            {job.updated_at ? new Date(job.updated_at).toLocaleString() : "-"}
                          </td>

                          <td className="p-3 border border-white/10 no-print">
                            <div className="flex flex-wrap gap-2">
                              {actions.receive && (
                                <Button size="sm" variant="outline" className={outlineButton} disabled={updatingId === job.id} onClick={() => receiveJob(job)}>
                                  Receive
                                </Button>
                              )}

                              {actions.assign && (
                                <>
                                  <select
                                    className="h-9 rounded-md border border-white/10 bg-[#08153d] px-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#ff5a00]"
                                    value={selectedTech[job.id] || ""}
                                    onChange={(event) =>
                                      setSelectedTech((prev) => ({ ...prev, [job.id]: event.target.value }))
                                    }
                                  >
                                    <option className="bg-[#08153d] text-white" value="">Select RR Tech</option>
                                    {rrUsers.map((rrUser) => (
                                      <option className="bg-[#08153d] text-white" key={rrUser.id || rrUser.user_id || rrUser.user_email} value={rrUser.id || rrUser.user_id || rrUser.user_email}>
                                        {rrUser.full_name || rrUser.name || rrUser.user_email || rrUser.email || rrUser.username || rrUser.id || "Unnamed User"}
                                      </option>
                                    ))}
                                  </select>

                                  <Button size="sm" variant="outline" className={outlineButton} disabled={updatingId === job.id} onClick={() => assignTechnician(job)}>
                                    Assign
                                  </Button>
                                </>
                              )}

                              {actions.qaPass && (
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={updatingId === job.id} onClick={() => qaPass(job)}>
                                  QA Pass
                                </Button>
                              )}

                              {actions.qaFail && (
                                <Button size="sm" variant="destructive" disabled={updatingId === job.id} onClick={() => qaFail(job)}>
                                  QA Fail
                                </Button>
                              )}

                              {actions.sendInventory && (
                                <Button size="sm" className="bg-[#ff5a00] hover:bg-[#e24f00] text-white" disabled={updatingId === job.id} onClick={() => sendBackInventory(job)}>
                                  Send Back Inventory
                                </Button>
                              )}

                              {actions.scrap && (
                                <Button size="sm" variant="destructive" disabled={updatingId === job.id} onClick={() => scrapJob(job)}>
                                  Scrap
                                </Button>
                              )}

                              {!actions.receive && !actions.assign && !actions.qaPass && !actions.qaFail && !actions.sendInventory && !actions.scrap && (
                                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-blue-100">
                                  No HOD action at this stage
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, note, valueClass = "text-white" }) {
  return (
    <Card className={glassCard}>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100/60">{title}</p>
        <h2 className={`mt-2 text-3xl font-black ${valueClass}`}>{value}</h2>
        <p className="mt-1 text-xs text-blue-100/70">{note}</p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value, danger = false }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-blue-100/60">{label}</p>
      <p className={`mt-1 text-2xl font-black ${danger ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
