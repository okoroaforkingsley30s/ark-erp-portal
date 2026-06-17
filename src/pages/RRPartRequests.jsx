import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

    /*
      Important:
      Do not use a long .or(...) query here.
      Waiting HOD QA was missing because the server-side filter could exclude rows
      even when part_requests.rr_status = "waiting_qa".
      We load recent part_requests, then this page filters RR workflow rows locally.
    */
    const { data, error } = await supabase
      .from("part_requests")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("RR part request fetch error:", JSON.stringify(error, null, 2));
      toast.error(error.message || "Failed to load RR part requests");
      setRequests([]);
    } else {
      const rrRows = (data || []).filter((item) => {
        const state = getRequestState(item);
        const rr = normalize(item.rr_status);
        const lifecycle = normalize(item.lifecycle_status);
        const inventory = normalize(item.inventory_status);

        return (
          RR_FILTERS.some((filter) => filter.key === state) ||
          RR_STATUSES.includes(rr) ||
          lifecycle.includes("rr") ||
          lifecycle.includes("qa") ||
          inventory === "transferred_rr" ||
          inventory === "rr_verified"
        );
      });

      setRequests(rrRows);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRRUsers();
    fetchRequests();

    const channel = supabase
      .channel("rr-part-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "part_requests" },
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
        entity_type: "part_request",
        entity_id: item.id,
        severity,
        metadata: {
          part_request_id: item.id,
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

  const updateLinkedRepairJob = async (item, payload) => {
    try {
      const jobPayload = {
        updated_at: new Date().toISOString(),
      };

      if (payload.rr_status === "received") jobPayload.status = "received";

      if (payload.rr_status === "assigned") {
        jobPayload.status = "assigned";
        jobPayload.assigned_rr_technician = payload.assigned_rr_technician || null;
        jobPayload.assigned_to = payload.assigned_to || payload.assigned_rr_technician || null;
      }

      if (payload.rr_status === "qa_passed") {
        jobPayload.status = "ready_for_inventory";
        jobPayload.test_result = "passed";
        jobPayload.inventory_transfer_status = "ready_to_transfer";
      }

      if (payload.rr_status === "qa_failed") {
        jobPayload.status = "qa_failed";
        jobPayload.test_result = "failed";
        jobPayload.inventory_transfer_status = "not_ready";
      }

      if (payload.rr_status === "returned_inventory") {
        jobPayload.status = "sent_to_inventory";
        jobPayload.test_result = "passed";
        jobPayload.inventory_transfer_status = "transferred";
        jobPayload.completed_at = new Date().toISOString();
      }

      if (payload.rr_status === "scrapped") {
        jobPayload.status = "scrap";
        jobPayload.test_result = "failed";
        jobPayload.inventory_transfer_status = "not_ready";
      }

      const shouldUpdate = Object.keys(jobPayload).length > 1;
      if (!shouldUpdate) return;

      if (item.repair_job_id) {
        await supabase.from("repair_jobs").update(jobPayload).eq("id", item.repair_job_id);
        return;
      }

      await supabase.from("repair_jobs").update(jobPayload).eq("part_request_id", item.id);
    } catch (error) {
      console.warn("Linked repair job update skipped:", error);
    }
  };

  const updateRequest = async (item, payload, actionLabel, severity = "info") => {
    setUpdatingId(item.id);

    const safePayload = filterPayloadByExistingColumns(item, {
      ...payload,
      updated_at: new Date().toISOString(),
    });

    if (Object.keys(safePayload).length === 0) {
      toast.error("No matching database columns found for this update.");
      setUpdatingId(null);
      return;
    }

    const { error } = await supabase
      .from("part_requests")
      .update(safePayload)
      .eq("id", item.id);

    if (error) {
      console.error("RR update failed:", JSON.stringify(error, null, 2));
      toast.error(error.message || "Update failed");
      setUpdatingId(null);
      return;
    }

    await updateLinkedRepairJob(item, safePayload);
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
                              {item.reason_category || item.reason || "No reason captured"}
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
