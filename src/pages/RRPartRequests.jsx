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
  { key: "pending", label: "Pending RR" },
  { key: "received", label: "Received By RR" },
  { key: "assigned", label: "Assigned To Tech" },
  { key: "under_repair", label: "Under Repair" },
  { key: "waiting_qa", label: "Waiting HOD QA" },
  { key: "qa_passed", label: "QA Passed" },
  { key: "qa_failed", label: "QA Failed" },
  { key: "returned_inventory", label: "Sent Back Inventory" },
  { key: "scrapped", label: "Scrapped" },
  { key: "all", label: "All RR Parts" },
];

const RR_STATUSES = [
  "pending_rr",
  "received",
  "assigned",
  "under_repair",
  "waiting_qa",
  "qa_passed",
  "qa_failed",
  "returned_inventory",
  "scrapped",
  "sold",
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

  if (status.includes("pass") || status.includes("received") || status.includes("returned") || status.includes("ready") || status.includes("verified")) {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  }

  if (status.includes("fail") || status.includes("scrap") || status.includes("reject")) {
    return "bg-red-500/15 text-red-300 border-red-400/30";
  }

  if (status.includes("qa") || status.includes("pending")) {
    return "bg-[#ff5a00]/15 text-orange-300 border-[#ff5a00]/30";
  }

  if (status.includes("repair") || status.includes("assigned")) {
    return "bg-blue-500/15 text-blue-300 border-blue-400/30";
  }

  return "bg-white/10 text-blue-100 border-white/10";
}

function getPartName(item) {
  return (
    item.part_name ||
    item.spare_part_name ||
    item.item_name ||
    item.part_type ||
    item.description ||
    "Part Request"
  );
}

function getTicketNumber(item) {
  return item.ticket_number || item.ticket_id || item.ticket_ref || "-";
}

function getEngineerName(item) {
  return (
    item.engineer_name ||
    item.requested_by_name ||
    item.requester_name ||
    item.created_by_name ||
    item.engineer ||
    item.created_by ||
    "Not captured"
  );
}

function getRequestState(item) {
  const rr = normalize(item.rr_status);
  const qa = normalize(item.qa_status);
  const status = normalize(item.status);
  const lifecycle = normalize(item.lifecycle_status);
  const inventory = normalize(item.inventory_status);

  if (
    rr === "returned_inventory" ||
    inventory === "rr_verified" ||
    lifecycle === "ready_for_dispatch" ||
    lifecycle === "returned_to_inventory" ||
    status === "ready_for_dispatch"
  ) {
    return "returned_inventory";
  }

  if (rr === "scrapped" || rr === "scrap" || lifecycle === "scrapped" || lifecycle === "scrap") {
    return "scrapped";
  }

  if (rr === "qa_failed" || qa === "failed" || lifecycle === "qa_failed") {
    return "qa_failed";
  }

  if (rr === "qa_passed" || qa === "passed" || lifecycle === "qa_passed") {
    return "qa_passed";
  }

  if (rr === "waiting_qa" || lifecycle === "waiting_qa" || status === "waiting_qa") {
    return "waiting_qa";
  }

  if (rr === "under_repair" || lifecycle === "under_repair" || status === "under_repair") {
    return "under_repair";
  }

  if (rr === "assigned" || lifecycle === "assigned_to_rr_technician" || status === "rr_assigned") {
    return "assigned";
  }

  if (rr === "received" || lifecycle === "received_by_rr" || status === "rr_received") {
    return "received";
  }

  if (
    rr === "pending_rr" ||
    status === "pending_rr" ||
    lifecycle === "issued_to_rr" ||
    inventory === "transferred_rr"
  ) {
    return "pending";
  }

  return "pending";
}

function getAllowedHODActions(item, user) {
  const state = getRequestState(item);
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


function isDirectRepairJob(item) {
  return item?._record_type === "repair_job";
}

function mapRepairJobState(statusValue) {
  const status = normalize(statusValue);

  if (status === "sent_to_inventory") return "returned_inventory";
  if (status === "scrap" || status === "scrapped") return "scrapped";
  if (status === "ready_for_inventory" || status === "qa_passed") return "qa_passed";
  if (status === "qa_failed") return "qa_failed";
  if (status === "testing" || status === "waiting_qa") return "waiting_qa";
  if (status === "refurbishing" || status === "under_repair") return "under_repair";
  if (status === "assigned") return "assigned";
  if (status === "received") return "received";
  return "pending_rr";
}

function normalizeRepairJob(job) {
  const rrStatus = mapRepairJobState(job.status);

  return {
    ...job,
    _record_type: "repair_job",
    _source_id: job.id,
    ticket_number: job.job_number || job.ticket_id || "-",
    part_name: job.item_name || job.device_name || "R/R Item",
    quantity: job.quantity_received || 1,
    engineer_name: job.received_from || "Inventory",
    rr_status: rrStatus,
    qa_status: job.test_result || "pending",
    lifecycle_status: rrStatus,
    inventory_status:
      job.inventory_transfer_status === "transferred"
        ? "rr_verified"
        : job.inventory_transfer_status || "transferred_rr",
    dispatch_status:
      rrStatus === "returned_inventory" ? "ready_for_dispatch" : "waiting_rr",
    finance_status: job.finance_status || "waiting",
  };
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

  const [requests, setRequests] = useState([]);
  const [rrUsers, setRrUsers] = useState([]);
  const [selectedTech, setSelectedTech] = useState({});
  const [activeFilter, setActiveFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const getAssignedTechName = (value) => {
    if (!value) return "Not assigned";

    const rrUser = rrUsers.find((u) => u.id === value || u.user_id === value || u.user_email === value || u.email === value);

    return rrUser?.full_name || rrUser?.name || rrUser?.user_email || rrUser?.email || value;
  };

  const matchesFilter = (item, key) => {
    const state = getRequestState(item);
    if (key === "all") return true;
    return state === key;
  };

  const fetchRRUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*");

      if (error) throw error;

      const profiles = data || [];

      const rrTechs = profiles.filter((profile) => {
        const role = normalize(profile.role || profile.user_role || profile.position);
        const department = normalize(profile.department || profile.department_name);

        return (
          role.includes("repair_technician") ||
          role.includes("rr_tech") ||
          role.includes("rr tech") ||
          role.includes("technician") ||
          role.includes("repair") ||
          department.includes("repair") ||
          department.includes("refurbishment") ||
          department.includes("rr")
        );
      });

      // Important fallback:
      // If role/department values are not clean yet, do not leave the dropdown empty.
      // Show all profiles so RR HOD can still assign, then roles can be cleaned later.
      setRrUsers(rrTechs.length > 0 ? rrTechs : profiles);
    } catch (error) {
      console.warn("RR users fetch failed:", error);
      setRrUsers([]);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);

    const [partResult, jobResult] = await Promise.all([
      supabase
        .from("part_requests")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("repair_jobs")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500),
    ]);

    if (partResult.error || jobResult.error) {
      const error = partResult.error || jobResult.error;
      console.error("RR intake fetch error:", JSON.stringify(error, null, 2));
      toast.error(error.message || "Failed to load RR intake records");
      setRequests([]);
      setLoading(false);
      return;
    }

    const partRows = (partResult.data || [])
      .filter((item) => {
        const rr = normalize(item.rr_status);
        const lifecycle = normalize(item.lifecycle_status);
        const inventory = normalize(item.inventory_status);
        const status = normalize(item.status);

        return (
          RR_STATUSES.includes(rr) ||
          lifecycle === "issued_to_rr" ||
          lifecycle === "received_by_rr" ||
          lifecycle === "assigned_to_rr_technician" ||
          lifecycle === "under_repair" ||
          lifecycle === "waiting_qa" ||
          lifecycle === "qa_passed" ||
          lifecycle === "qa_failed" ||
          lifecycle === "ready_for_dispatch" ||
          lifecycle === "scrapped" ||
          inventory === "transferred_rr" ||
          inventory === "rr_verified" ||
          status === "pending_rr" ||
          status === "rr_received" ||
          status === "rr_assigned" ||
          status === "under_repair" ||
          status === "waiting_qa"
        );
      })
      .map((item) => ({ ...item, _record_type: "part_request", _source_id: item.id }));

    const directJobRows = (jobResult.data || [])
      .filter((job) => !job.part_request_id)
      .map(normalizeRepairJob);

    const merged = [...partRows, ...directJobRows].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
    );

    setRequests(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchRRUsers();
    fetchRequests();

    const channel = supabase
      .channel("rr-intake-unified")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "part_requests" },
        () => fetchRequests()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "repair_jobs" },
        () => fetchRequests()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const logOIN = async (item, action, payload, severity = "info") => {
    try {
      await supabase.from("operations_events").insert({
        event_type: action,
        title: `RR HOD ${action}`,
        description: `${action} completed by RR HOD`,
        source_module: "Repair & Refurbishment",
        entity_type: isDirectRepairJob(item) ? "repair_job" : "part_request",
        entity_id: item._source_id || item.id,
        severity,
        metadata: {
          part_request_id: isDirectRepairJob(item) ? null : item._source_id || item.id,
          repair_job_id: isDirectRepairJob(item) ? item._source_id || item.id : null,
          ticket_id: item.ticket_id,
          ticket_number: item.ticket_number,
          engineer: getEngineerName(item),
          previous_rr_status: item.rr_status,
          previous_lifecycle_status: item.lifecycle_status,
          new_values: payload,
        },
      });
    } catch (error) {
      console.warn("OIN log skipped:", error);
    }
  };

  const writeLifecycleLog = async (item, payload, note) => {
    try {
      await supabase.from("part_lifecycle_logs").insert({
        part_request_id: item.id,
        status: payload.lifecycle_status || payload.rr_status || "rr_update",
        department: "Repair & Refurbishment",
        note,
      });
    } catch (error) {
      console.warn("Lifecycle log skipped:", error);
    }
  };

 const updateLinkedRepairJob = async (item, payload, actionLabel = "RR Update") => {
  try {
    const now = new Date().toISOString();
    const rrStatus = normalize(payload.rr_status || item.rr_status);
    const techId =
      payload.assigned_rr_technician ||
      item.assigned_rr_technician ||
      null;

    const jobStatusMap = {
      received: "received",
      assigned: "assigned",
      under_repair: "under_repair",
      waiting_qa: "waiting_qa",
      qa_passed: "ready_for_inventory",
      qa_failed: "qa_failed",
      returned_inventory: "sent_to_inventory",
      scrapped: "scrap",
    };

    const jobPayload = {
      updated_at: now,
      status: jobStatusMap[rrStatus] || rrStatus || "received",
      final_remark: actionLabel,
    };

    if (rrStatus === "received") {
      jobPayload.received_by = user?.full_name || user?.name || user?.email || "RR HOD";
      jobPayload.condition_on_arrival = item.condition_on_arrival || "received_from_inventory";
      jobPayload.action_required = item.action_required || "repair_required";
      jobPayload.inventory_transfer_status = "not_ready";
      jobPayload.test_result = "pending";
    }

    if (rrStatus === "assigned") {
      jobPayload.assigned_rr_technician = techId;
      jobPayload.assigned_to = techId;
      jobPayload.assigned_by = user?.id || user?.auth_id || null;
      jobPayload.assigned_at = payload.assigned_at || now;
      jobPayload.action_required = item.action_required || "repair_required";
      jobPayload.inventory_transfer_status = "not_ready";
      jobPayload.test_result = "pending";
    }

    if (rrStatus === "qa_passed") {
      jobPayload.test_result = "passed";
      jobPayload.inventory_transfer_status = "ready_to_transfer";
      jobPayload.good_quantity = item.quantity || item.good_quantity || 1;
      jobPayload.bad_quantity = item.bad_quantity || 0;
    }

    if (rrStatus === "qa_failed") {
      jobPayload.test_result = "failed";
      jobPayload.inventory_transfer_status = "not_ready";
      jobPayload.good_quantity = item.good_quantity || 0;
      jobPayload.bad_quantity = item.quantity || item.bad_quantity || 1;
    }

    if (rrStatus === "returned_inventory") {
      jobPayload.test_result = "passed";
      jobPayload.inventory_transfer_status = "transferred";
      jobPayload.completed_at = now;
      jobPayload.good_quantity = item.quantity || item.good_quantity || 1;
      jobPayload.bad_quantity = item.bad_quantity || 0;
    }

    if (rrStatus === "scrapped") {
      jobPayload.test_result = "failed";
      jobPayload.inventory_transfer_status = "not_ready";
      jobPayload.completed_at = now;
      jobPayload.good_quantity = 0;
      jobPayload.bad_quantity = item.quantity || item.bad_quantity || 1;
      jobPayload.action_required = "scrapped";
    }

    const { data: existingJob, error: findError } = await supabase
      .from("repair_jobs")
      .select("id")
      .eq("part_request_id", item.id)
      .maybeSingle();

    if (findError) throw findError;

    if (existingJob?.id) {
      const { error: updateError } = await supabase
        .from("repair_jobs")
        .update(jobPayload)
        .eq("id", existingJob.id);

      if (updateError) throw updateError;
      return existingJob.id;
    }

    const partName = getPartName(item);
    const newJob = {
      part_request_id: item.id,
      job_number: item.ticket_number
        ? `RR-${item.ticket_number}-${String(item.id).slice(0, 8)}`
        : `RR-${String(item.id).slice(0, 8)}`,
      ticket_id: item.ticket_number || item.ticket_id || null,
      device_name: item.device_name || partName,
      terminal_id: item.terminal_id || null,
      bank_name: item.bank_name || null,
      branch_name: item.branch_name || null,
      fault_description:
        item.reason_note ||
        item.reason_category ||
        item.operations_note ||
        item.inventory_note ||
        "Created from RR part request",
      assigned_to: jobPayload.assigned_to || techId,
      status: jobPayload.status || "received",
      priority: item.priority || "normal",
      received_by: jobPayload.received_by || user?.full_name || user?.email || null,
      created_at: now,
      updated_at: now,
      source_type: "part_request",
      received_from: "Inventory",
      item_name: partName,
      part_number: item.part_number || null,
      machine_brand: item.machine_brand || item.device_brand || null,
      machine_model: item.machine_model || item.device_model || null,
      quantity_received: item.quantity || 1,
      condition_on_arrival:
        item.condition_on_arrival || "received_from_inventory",
      action_required: jobPayload.action_required || "repair_required",
      test_result: jobPayload.test_result || "pending",
      good_quantity: jobPayload.good_quantity ?? 0,
      bad_quantity: jobPayload.bad_quantity ?? item.quantity ?? 1,
      inventory_transfer_status:
        jobPayload.inventory_transfer_status || "not_ready",
      final_remark: jobPayload.final_remark || "Created from RR HOD action",
      assigned_rr_technician: jobPayload.assigned_rr_technician || techId,
      assigned_by: jobPayload.assigned_by || user?.id || user?.auth_id || null,
      assigned_at: jobPayload.assigned_at || (techId ? now : null),
      completed_at: jobPayload.completed_at || null,
    };

    const { data: createdJob, error: insertError } = await supabase
      .from("repair_jobs")
      .insert(newJob)
      .select("id")
      .single();

    if (insertError) throw insertError;

    return createdJob?.id || null;
  } catch (error) {
    console.error("Linked repair job update failed:", error);
    toast.error(
      error.message ||
        "Part request updated, but repair job could not be created."
    );
    return null;
  }
};

  const updateRequest = async (item, payload, actionLabel, severity = "info") => {
    setUpdatingId(item.id);
    const now = new Date().toISOString();

    if (isDirectRepairJob(item)) {
      const rrStatus = normalize(payload.rr_status || item.rr_status);
      const statusMap = {
        received: "received",
        assigned: "assigned",
        under_repair: "under_repair",
        waiting_qa: "waiting_qa",
        qa_passed: "ready_for_inventory",
        qa_failed: "qa_failed",
        returned_inventory: "sent_to_inventory",
        scrapped: "scrap",
      };

      const jobPayload = {
        status: statusMap[rrStatus] || rrStatus,
        updated_at: now,
        final_remark: actionLabel,
      };

      if (rrStatus === "received") {
        jobPayload.received_by = user?.full_name || user?.name || user?.email || "RR HOD";
        jobPayload.condition_on_arrival = item.condition_on_arrival || "received_from_inventory";
        jobPayload.action_required = item.action_required || "repair_required";
        jobPayload.test_result = "pending";
        jobPayload.inventory_transfer_status = "not_ready";
      }

      if (rrStatus === "assigned") {
        const techId = payload.assigned_rr_technician || payload.assigned_to || null;
        jobPayload.assigned_rr_technician = techId;
        jobPayload.assigned_to = techId;
        jobPayload.assigned_by = user?.id || user?.auth_id || null;
        jobPayload.assigned_at = payload.assigned_at || now;
        jobPayload.test_result = "pending";
        jobPayload.inventory_transfer_status = "not_ready";
      }

      if (rrStatus === "qa_passed") {
        jobPayload.test_result = "passed";
        jobPayload.inventory_transfer_status = "ready_to_transfer";
        jobPayload.good_quantity = item.quantity_received || item.quantity || 1;
        jobPayload.bad_quantity = 0;
      }

      if (rrStatus === "qa_failed") {
        jobPayload.test_result = "failed";
        jobPayload.inventory_transfer_status = "not_ready";
        jobPayload.good_quantity = 0;
        jobPayload.bad_quantity = item.quantity_received || item.quantity || 1;
      }

      if (rrStatus === "returned_inventory") {
        jobPayload.test_result = "passed";
        jobPayload.inventory_transfer_status = "transferred";
        jobPayload.completed_at = now;
      }

      if (rrStatus === "scrapped") {
        jobPayload.test_result = "failed";
        jobPayload.inventory_transfer_status = "not_ready";
        jobPayload.completed_at = now;
        jobPayload.good_quantity = 0;
        jobPayload.bad_quantity = item.quantity_received || item.quantity || 1;
        jobPayload.action_required = "scrapped";
      }

      const safeJobPayload = filterPayloadByExistingColumns(item, jobPayload);
      const { error } = await supabase
        .from("repair_jobs")
        .update(safeJobPayload)
        .eq("id", item._source_id || item.id);

      if (error) {
        console.error("Direct repair job update failed:", error);
        toast.error(error.message || "Update failed");
        setUpdatingId(null);
        return;
      }

      await logOIN(item, actionLabel, safeJobPayload, severity);
      toast.success(`${actionLabel} successful`);
      setUpdatingId(null);
      fetchRequests();
      return;
    }

    const safePayload = filterPayloadByExistingColumns(item, {
      ...payload,
      updated_at: now,
    });

    if (Object.keys(safePayload).length === 0) {
      toast.error("No matching database columns found for this update.");
      setUpdatingId(null);
      return;
    }

    const { error } = await supabase
      .from("part_requests")
      .update(safePayload)
      .eq("id", item._source_id || item.id);

    if (error) {
      console.error("RR update failed:", JSON.stringify(error, null, 2));
      toast.error(error.message || "Update failed");
      setUpdatingId(null);
      return;
    }

    await updateLinkedRepairJob(item, safePayload, actionLabel);
    await writeLifecycleLog(item, safePayload, `RR HOD ${actionLabel}`);
    await logOIN(item, actionLabel, safePayload, severity);

    toast.success(`${actionLabel} successful`);
    setUpdatingId(null);
    fetchRequests();
  };

  const receivePart = async (item) => {
    if (!getAllowedHODActions(item, user).receive) {
      toast.error("Only RR HOD can receive parts from Inventory.");
      return;
    }

    await updateRequest(
      item,
      {
        rr_status: "received",
        lifecycle_status: "received_by_rr",
        inventory_status: "transferred_rr",
        dispatch_status: "waiting_rr",
      },
      "Receive Part"
    );
  };

  const assignTechnician = async (item) => {
    if (!getAllowedHODActions(item, user).assign) {
      toast.error("Only RR HOD can assign technician at this stage.");
      return;
    }

    const techId = selectedTech[item.id];

    if (!techId) {
      toast.error("Select RR technician first.");
      return;
    }

    await updateRequest(
      item,
      {
        rr_status: "assigned",
        lifecycle_status: "assigned_to_rr_technician",
        inventory_status: "transferred_rr",
        dispatch_status: "waiting_rr",
        assigned_rr_technician: techId,
        assigned_by: user?.id || user?.auth_id || null,
        assigned_at: new Date().toISOString(),
        assigned_to: techId,
      },
      "Assign Technician"
    );
  };

  const qaPass = async (item) => {
    if (!getAllowedHODActions(item, user).qaPass) {
      toast.error("Only RR HOD can pass QA after technician submits.");
      return;
    }

    await updateRequest(
      item,
      {
        rr_status: "qa_passed",
        qa_status: "passed",
        lifecycle_status: "qa_passed",
        inventory_status: "transferred_rr",
        dispatch_status: "waiting_inventory_return",
      },
      "QA Passed"
    );
  };

  const qaFail = async (item) => {
    if (!getAllowedHODActions(item, user).qaFail) {
      toast.error("Only RR HOD can fail QA after technician submits.");
      return;
    }

    await updateRequest(
      item,
      {
        rr_status: "qa_failed",
        qa_status: "failed",
        lifecycle_status: "qa_failed",
        inventory_status: "transferred_rr",
        dispatch_status: "waiting_rr_rework",
      },
      "QA Failed",
      "warning"
    );
  };

  const sendBackInventory = async (item) => {
    if (!getAllowedHODActions(item, user).sendInventory) {
      toast.error("Only QA-passed parts can be sent back to Inventory.");
      return;
    }

    await updateRequest(
      item,
      {
        rr_status: "returned_inventory",
        qa_status: "passed",
        inventory_status: "rr_verified",
        dispatch_status: "ready_for_dispatch",
        finance_status: "pending",
        lifecycle_status: "ready_for_dispatch",
      },
      "Send Back To Inventory"
    );
  };

  const scrapPart = async (item) => {
    if (!getAllowedHODActions(item, user).scrap) {
      toast.error("Only RR HOD can scrap after QA/review stage.");
      return;
    }

    const ok = window.confirm("Confirm this part cannot be fixed and should be scrapped?");
    if (!ok) return;

    await updateRequest(
      item,
      {
        rr_status: "scrapped",
        qa_status: "failed",
        inventory_status: "scrapped",
        dispatch_status: "not_dispatchable",
        lifecycle_status: "scrapped",
      },
      "Scrap",
      "warning"
    );
  };

  const filteredRequests = useMemo(() => {
    let list = requests.filter((item) => matchesFilter(item, activeFilter));

    if (search.trim()) {
      const q = search.trim().toLowerCase();

      list = list.filter((item) =>
        [
          item.ticket_number,
          item.ticket_id,
          item.job_number,
          item.source_type,
          item.received_from,
          item.part_name,
          item.spare_part_name,
          item.item_name,
          item.part_type,
          item.reason,
          item.reason_category,
          item.status,
          item.rr_status,
          item.qa_status,
          item.lifecycle_status,
          item.dispatch_status,
          item.inventory_status,
          item.finance_status,
          getEngineerName(item),
          getAssignedTechName(item.assigned_rr_technician || item.assigned_to),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }

    return list;
  }, [requests, activeFilter, search, rrUsers]);

  const rrPerformance = useMemo(() => {
    const counts = RR_FILTERS.reduce((acc, filter) => {
      acc[filter.key] = requests.filter((item) => matchesFilter(item, filter.key)).length;
      return acc;
    }, {});

    const total = requests.length;
    const completed =
      (counts.qa_passed || 0) +
      (counts.returned_inventory || 0) +
      (counts.scrapped || 0);

    const active = total - completed;
    const qaPassed = counts.qa_passed || 0;
    const qaFailed = counts.qa_failed || 0;
    const qaTotal = qaPassed + qaFailed;
    const passRate = qaTotal > 0 ? Math.round((qaPassed / qaTotal) * 100) : 0;

    const techMap = new Map();

    requests.forEach((item) => {
      const techKey = item.assigned_rr_technician || item.assigned_to;
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

      const state = getRequestState(item);
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
      total,
      active,
      completed,
      pending: counts.pending || 0,
      received: counts.received || 0,
      assigned: counts.assigned || 0,
      underRepair: counts.under_repair || 0,
      waitingQa: counts.waiting_qa || 0,
      qaPassed,
      qaFailed,
      returnedInventory: counts.returned_inventory || 0,
      scrapped: counts.scrapped || 0,
      passRate,
      technicians: Array.from(techMap.values()).sort((a, b) => b.total - a.total),
    };
  }, [requests, rrUsers]);

  const countByFilter = (key) =>
    requests.filter((item) => matchesFilter(item, key)).length;

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
                Inventory → RR HOD receive → Assign RR Tech → RR Tech repair → RR HOD QA → Send Back Inventory.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fetchRequests}
              disabled={loading}
              className={outlineButton}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>

            {canAccess(role, "print_rr_report") && (
              <Button
                onClick={printReport}
                className="bg-[#ff5a00] hover:bg-[#e24f00] text-white shadow-lg shadow-orange-950/40"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Report
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="no-print rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
        <p className="text-sm text-emerald-200 font-semibold">
          RR HOD page only:
        </p>
        <p className="text-xs text-emerald-100 mt-1">
          Receive, assign technician, QA pass/fail, scrap, and send back to Inventory. Repair, consumables, funds, and submit QA belong to RR Technician page.
        </p>
      </div>

      <div className="no-print grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className={glassCard}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-100/60">RR Active Workload</p>
            <h2 className="mt-2 text-3xl font-black text-white">{rrPerformance.active}</h2>
            <p className="mt-1 text-xs text-blue-100/70">Open RR parts not yet completed.</p>
          </CardContent>
        </Card>

        <Card className={glassCard}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-100/60">Waiting QA</p>
            <h2 className="mt-2 text-3xl font-black text-orange-300">{rrPerformance.waitingQa}</h2>
            <p className="mt-1 text-xs text-blue-100/70">Technician work awaiting HOD QA.</p>
          </CardContent>
        </Card>

        <Card className={glassCard}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-100/60">QA Pass Rate</p>
            <h2 className="mt-2 text-3xl font-black text-emerald-300">{rrPerformance.passRate}%</h2>
            <p className="mt-1 text-xs text-blue-100/70">Passed vs failed QA decisions.</p>
          </CardContent>
        </Card>

        <Card className={glassCard}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-100/60">Returned Inventory</p>
            <h2 className="mt-2 text-3xl font-black text-blue-300">{rrPerformance.returnedInventory}</h2>
            <p className="mt-1 text-xs text-blue-100/70">QA-passed parts sent back to Inventory.</p>
          </CardContent>
        </Card>
      </div>

      <Card className={`no-print ${glassCard}`}>
        <CardHeader className="border-b border-white/10 bg-[#08153d]/70">
          <CardTitle className="text-white">RR Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-blue-100/60">Pending RR</p>
              <p className="mt-1 text-2xl font-black text-white">{rrPerformance.pending}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-blue-100/60">Received</p>
              <p className="mt-1 text-2xl font-black text-white">{rrPerformance.received}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-blue-100/60">Assigned</p>
              <p className="mt-1 text-2xl font-black text-white">{rrPerformance.assigned}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-blue-100/60">Under Repair</p>
              <p className="mt-1 text-2xl font-black text-white">{rrPerformance.underRepair}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-blue-100/60">QA Failed</p>
              <p className="mt-1 text-2xl font-black text-red-300">{rrPerformance.qaFailed}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-blue-100/60">Scrapped</p>
              <p className="mt-1 text-2xl font-black text-red-300">{rrPerformance.scrapped}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#08153d] text-blue-100">
                  <th className="p-3 text-left">RR Technician</th>
                  <th className="p-3 text-left">Total</th>
                  <th className="p-3 text-left">Assigned</th>
                  <th className="p-3 text-left">Under Repair</th>
                  <th className="p-3 text-left">Waiting QA</th>
                  <th className="p-3 text-left">QA Passed</th>
                  <th className="p-3 text-left">QA Failed</th>
                  <th className="p-3 text-left">Returned</th>
                </tr>
              </thead>
              <tbody>
                {rrPerformance.technicians.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-4 text-blue-100/70">
                      No technician workload data yet.
                    </td>
                  </tr>
                ) : (
                  rrPerformance.technicians.slice(0, 8).map((tech) => (
                    <tr key={tech.id} className="border-t border-white/10">
                      <td className="p-3 font-semibold text-white">{tech.name}</td>
                      <td className="p-3">{tech.total}</td>
                      <td className="p-3">{tech.assigned}</td>
                      <td className="p-3">{tech.underRepair}</td>
                      <td className="p-3">{tech.waitingQa}</td>
                      <td className="p-3 text-emerald-300">{tech.qaPassed}</td>
                      <td className="p-3 text-red-300">{tech.qaFailed}</td>
                      <td className="p-3 text-blue-300">{tech.returnedInventory}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                <p className="text-[11px] leading-tight text-blue-100/80 min-h-[28px]">
                  {filter.label}
                </p>
                <h2 className="text-3xl font-black text-white mt-1">
                  {countByFilter(filter.key)}
                </h2>
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
                placeholder="Search ticket, part, engineer, technician, status..."
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
                {filteredRequests.length} records
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <p className="p-5 text-sm text-blue-100 print:text-slate-700">
                Loading RR requests...
              </p>
            ) : filteredRequests.length === 0 ? (
              <p className="p-5 text-sm text-blue-100 print:text-slate-700">
                No RR part request found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#ff5a00] text-white print:bg-[#102969]">
                      <th className="text-left p-3 border border-white/10">Ticket</th>
                      <th className="text-left p-3 border border-white/10">Part</th>
                      <th className="text-left p-3 border border-white/10">Qty</th>
                      <th className="text-left p-3 border border-white/10">Engineer</th>
                      <th className="text-left p-3 border border-white/10">RR Tech</th>
                      <th className="text-left p-3 border border-white/10">RR Status</th>
                      <th className="text-left p-3 border border-white/10">QA</th>
                      <th className="text-left p-3 border border-white/10">Inventory</th>
                      <th className="text-left p-3 border border-white/10">Dispatch</th>
                      <th className="text-left p-3 border border-white/10">Finance</th>
                      <th className="text-left p-3 border border-white/10">Lifecycle</th>
                      <th className="text-left p-3 border border-white/10">Updated</th>
                      <th className="text-left p-3 border border-white/10 min-w-[500px] no-print">
                        HOD Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRequests.map((item, index) => {
                      const actions = getAllowedHODActions(item, user);

                      return (
                        <tr
                          key={item.id}
                          className={`align-top text-white transition hover:bg-[#173b9a]/70 print:text-[#102969] print:bg-white ${
                            index % 2 === 0 ? "bg-[#102969]/80" : "bg-[#08153d]/80"
                          }`}
                        >
                          <td className="p-3 border border-white/10 print:border-slate-300 font-semibold">
                            {getTicketNumber(item)}
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <div className="font-semibold text-white print:text-[#102969]">
                              {getPartName(item)}
                            </div>
                            <div className="text-xs text-blue-100/70 print:text-slate-500">
                              {item.reason_category || item.reason || item.fault_description || "No reason captured"}
                            </div>
                            <div className="mt-1 text-[11px] font-semibold text-orange-200 print:text-slate-600">
                              Source: {isDirectRepairJob(item) ? (item.source_type === "new_purchase" ? "Inventory Direct" : item.source_type || "Inventory") : "Field Engineer Request"}
                            </div>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            {item.quantity || 1}
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            {getEngineerName(item)}
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            {item.assigned_rr_technician || item.assigned_to ? (
                              <span className="font-semibold text-orange-200 print:text-[#102969]">
                                {getAssignedTechName(item.assigned_rr_technician || item.assigned_to)}
                              </span>
                            ) : (
                              <span className="text-blue-100/60 print:text-slate-500">
                                Not assigned
                              </span>
                            )}
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(item.rr_status || getRequestState(item))}`}>
                              {statusLabel(item.rr_status || getRequestState(item))}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(item.qa_status || "pending")}`}>
                              {statusLabel(item.qa_status || "pending")}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(item.inventory_status || "waiting")}`}>
                              {statusLabel(item.inventory_status || "waiting")}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(item.dispatch_status || "waiting")}`}>
                              {statusLabel(item.dispatch_status || "waiting")}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(item.finance_status || "waiting")}`}>
                              {statusLabel(item.finance_status || "waiting")}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300">
                            <span className="text-xs uppercase text-blue-100 print:text-[#102969]">
                              {item.lifecycle_status || "-"}
                            </span>
                          </td>

                          <td className="p-3 border border-white/10 print:border-slate-300 text-xs">
                            {item.updated_at ? new Date(item.updated_at).toLocaleString() : "-"}
                          </td>

                          <td className="p-3 border border-white/10 no-print">
                            <div className="flex flex-wrap gap-2">
                              {actions.receive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={outlineButton}
                                  disabled={updatingId === item.id}
                                  onClick={() => receivePart(item)}
                                >
                                  Receive
                                </Button>
                              )}

                              {actions.assign && (
                                <>
                                  <select
                                    className="h-9 rounded-md border border-white/10 bg-[#08153d] px-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#ff5a00]"
                                    value={selectedTech[item.id] || ""}
                                    onChange={(event) =>
                                      setSelectedTech((prev) => ({
                                        ...prev,
                                        [item.id]: event.target.value,
                                      }))
                                    }
                                  >
                                    <option className="bg-[#08153d] text-white" value="">
                                      Select RR Tech
                                    </option>
                                    {rrUsers.map((rrUser) => (
                                      <option
                                        className="bg-[#08153d] text-white"
                                        key={rrUser.id || rrUser.user_id || rrUser.user_email}
                                        value={rrUser.id || rrUser.user_id || rrUser.user_email}
                                      >
                                        {rrUser.full_name ||
                                          rrUser.name ||
                                          rrUser.user_email ||
                                          rrUser.email ||
                                          rrUser.username ||
                                          rrUser.id ||
                                          "Unnamed User"}
                                      </option>
                                    ))}
                                  </select>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={outlineButton}
                                    disabled={updatingId === item.id}
                                    onClick={() => assignTechnician(item)}
                                  >
                                    Assign
                                  </Button>
                                </>
                              )}

                              {actions.qaPass && (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={updatingId === item.id}
                                  onClick={() => qaPass(item)}
                                >
                                  QA Pass
                                </Button>
                              )}

                              {actions.qaFail && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={updatingId === item.id}
                                  onClick={() => qaFail(item)}
                                >
                                  QA Fail
                                </Button>
                              )}

                              {actions.sendInventory && (
                                <Button
                                  size="sm"
                                  className="bg-[#ff5a00] hover:bg-[#e24f00] text-white"
                                  disabled={updatingId === item.id}
                                  onClick={() => sendBackInventory(item)}
                                >
                                  Send Back Inventory
                                </Button>
                              )}

                              {actions.scrap && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={updatingId === item.id}
                                  onClick={() => scrapPart(item)}
                                >
                                  Scrap
                                </Button>
                              )}

                              {!actions.receive &&
                                !actions.assign &&
                                !actions.qaPass &&
                                !actions.qaFail &&
                                !actions.sendInventory &&
                                !actions.scrap && (
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
