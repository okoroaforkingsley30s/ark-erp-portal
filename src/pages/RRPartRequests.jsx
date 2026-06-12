import { useEffect, useMemo, useState } from "react";
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
  Banknote,
  RotateCcw,
  UserCheck,
  XCircle,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

const RR_FILTERS = [
  { key: "pending", label: "Pending RR", accent: "from-amber-500 to-orange-600" },
  { key: "received", label: "Received By RR", accent: "from-blue-500 to-cyan-600" },
  { key: "assigned", label: "Assigned", accent: "from-indigo-500 to-blue-700" },
  { key: "under_repair", label: "Under Repair", accent: "from-orange-500 to-red-600" },
  { key: "waiting_qa", label: "Waiting QA", accent: "from-purple-500 to-fuchsia-700" },
  { key: "qa_passed", label: "QA Passed", accent: "from-emerald-500 to-green-700" },
  { key: "qa_failed", label: "QA Failed", accent: "from-red-500 to-rose-700" },
  { key: "returned_inventory", label: "Returned Inventory", accent: "from-cyan-500 to-blue-700" },
  { key: "scrapped", label: "Scrapped", accent: "from-slate-500 to-slate-800" },
  { key: "sold", label: "Sold", accent: "from-green-500 to-emerald-800" },
  { key: "all", label: "All RR Parts", accent: "from-[#ff5a00] to-[#102969]" },
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

const pageBg = "min-h-screen bg-gradient-to-br from-[#06102f] via-[#08153d] to-[#102969] p-4 md:p-6 space-y-6 text-white";
const glassCard = "bg-[#102969]/85 border border-white/10 text-white shadow-2xl shadow-black/20 backdrop-blur rounded-2xl";
const inputClass = "bg-[#08153d]/80 border-white/10 text-white placeholder:text-blue-100/60 focus-visible:ring-[#ff5a00]";
const outlineButton = "border-white/15 bg-white/5 text-white hover:bg-[#ff5a00]/15 hover:text-white hover:border-[#ff5a00]/60";

function statusLabel(value) {
  return String(value || "waiting").replaceAll("_", " ").toUpperCase();
}

function statusBadgeClass(value) {
  const status = String(value || "").toLowerCase();

  if (status.includes("pass") || status.includes("received") || status.includes("returned")) {
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

function RRPartRequests() {
  const [requests, setRequests] = useState([]);
  const [rrUsers, setRrUsers] = useState([]);
  const [selectedTech, setSelectedTech] = useState({});
  const [activeFilter, setActiveFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const getEngineerName = (item) =>
    item.engineer_name ||
    item.requested_by_name ||
    item.requester_name ||
    item.created_by_name ||
    item.engineer ||
    item.created_by ||
    "Not captured";

  const getAssignedTechName = (id) => {
    const user = rrUsers.find((u) => u.id === id || u.user_id === id);
    return user?.full_name || user?.name || user?.email || id || "Not assigned";
  };

  const isPendingRR = (item) =>
    item.rr_status === "pending_rr" ||
    item.status === "pending_rr" ||
    item.lifecycle_status === "issued_to_rr";

  const matchesFilter = (item, key) => {
    if (key === "all") return true;
    if (key === "pending") return isPendingRR(item);

    if (key === "waiting_qa") {
      return item.rr_status === "waiting_qa" || item.qa_status === "pending";
    }

    if (key === "qa_passed") {
      return item.rr_status === "qa_passed" || item.qa_status === "passed";
    }

    if (key === "qa_failed") {
      return item.rr_status === "qa_failed" || item.qa_status === "failed";
    }

    if (key === "returned_inventory") {
      return (
        item.rr_status === "returned_inventory" ||
        item.lifecycle_status === "returned_to_inventory"
      );
    }

    return item.rr_status === key || item.lifecycle_status === key;
  };

  const fetchRRUsers = async () => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, user_id, full_name, name, email, department, role")
      .eq("department", "Repair & Refurbishment")
      .order("full_name", { ascending: true });

    if (error) {
      console.warn("RR users fetch failed:", error);
      setRrUsers([]);
      return;
    }

    setRrUsers(data || []);
  };

  const fetchRequests = async () => {
    setLoading(true);

    const rrQuery = RR_STATUSES.map((s) => `rr_status.eq.${s}`).join(",");

    const { data, error } = await supabase
      .from("part_requests")
      .select("*")
      .or(`${rrQuery},status.eq.pending_rr,lifecycle_status.eq.issued_to_rr`)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("RR part request fetch error:", error);
      toast.error("Failed to load RR part requests");
      setRequests([]);
    } else {
      setRequests(data || []);
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

  const logOIN = async (item, action, payload) => {
    try {
      await supabase.from("operations_events").insert({
        module: "Repair & Refurbishment",
        event_type: action,
        entity_type: "part_request",
        entity_id: item.id,
        title: `RR ${action}`,
        message: `${action} completed by Repair & Refurbishment`,
        metadata: {
          part_request_id: item.id,
          ticket_id: item.ticket_id,
          ticket_number: item.ticket_number,
          engineer: getEngineerName(item),
          previous_rr_status: item.rr_status,
          previous_status: item.status,
          previous_lifecycle_status: item.lifecycle_status,
          new_values: payload,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("OIN log skipped:", error);
    }
  };

  const updateRequest = async (item, payload, actionLabel) => {
    setUpdatingId(item.id);

    const updatePayload = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("part_requests")
      .update(updatePayload)
      .eq("id", item.id);

    if (error) {
      console.error("RR update failed:", error);
      toast.error(error.message || "Update failed");
      setUpdatingId(null);
      return;
    }

    await logOIN(item, actionLabel, updatePayload);

    toast.success(`${actionLabel} successful`);
    setUpdatingId(null);
    fetchRequests();
  };

  const assignTechnician = async (item) => {
    const techId = selectedTech[item.id];

    if (!techId) {
      toast.error("Select RR technician first");
      return;
    }

    await updateRequest(
      item,
      {
        rr_status: "assigned",
        status: "rr_assigned",
        lifecycle_status: "assigned_to_rr_technician",
        assigned_rr_technician: techId,
        assigned_by: null,
        assigned_at: new Date().toISOString(),
      },
      "Assign Technician"
    );
  };

  const returnToInventory = async (item) => {
    if (item.qa_status !== "passed" && item.rr_status !== "qa_passed") {
      toast.error("This part cannot return to Inventory until QA is passed.");
      return;
    }

    await updateRequest(
      item,
      {
        rr_status: "returned_inventory",
        status: "pending_inventory_return",
        lifecycle_status: "returned_to_inventory",
      },
      "Return To Inventory"
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
          item.part_type,
          item.reason,
          item.reason_category,
          item.status,
          item.rr_status,
          item.qa_status,
          item.lifecycle_status,
          item.dispatch_status,
          getEngineerName(item),
          getAssignedTechName(item.assigned_rr_technician),
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
    sold: Banknote,
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
                ARK ONE ERP / Repair & Refurbishment
              </p>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                RR Part Requests
              </h1>
              <p className="text-sm text-blue-100 mt-1 max-w-3xl">
                Receive failed parts, assign RR technician, repair, submit to QA, and return only QA-passed parts to Inventory.
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
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button
              onClick={printReport}
              className="bg-[#ff5a00] hover:bg-[#e24f00] text-white shadow-lg shadow-orange-950/40"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      <div className="no-print grid grid-cols-2 md:grid-cols-4 xl:grid-cols-11 gap-3">
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
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${filter.accent}`} />
                <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${filter.accent} p-2 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
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
                Active filter: <strong className="text-white">{RR_FILTERS.find((item) => item.key === activeFilter)?.label}</strong>
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
              <p className="p-5 text-sm text-blue-100 print:text-slate-700">Loading RR requests...</p>
            ) : filteredRequests.length === 0 ? (
              <p className="p-5 text-sm text-blue-100 print:text-slate-700">No RR part request found.</p>
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
                      <th className="text-left p-3 border border-white/10">Lifecycle</th>
                      <th className="text-left p-3 border border-white/10">Updated</th>
                      <th className="text-left p-3 border border-white/10 min-w-[560px] no-print">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRequests.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`align-top text-white transition hover:bg-[#173b9a]/70 print:text-[#102969] print:bg-white ${
                          index % 2 === 0 ? "bg-[#102969]/80" : "bg-[#08153d]/80"
                        }`}
                      >
                        <td className="p-3 border border-white/10 print:border-slate-300 font-semibold">
                          {item.ticket_number || item.ticket_id || "-"}
                        </td>

                        <td className="p-3 border border-white/10 print:border-slate-300">
                          <div className="font-semibold text-white print:text-[#102969]">
                            {item.part_name || item.part_type || "Part Request"}
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
                          {item.assigned_rr_technician ? (
                            <span className="font-semibold text-orange-200 print:text-[#102969]">
                              {getAssignedTechName(item.assigned_rr_technician)}
                            </span>
                          ) : (
                            <span className="text-blue-100/60 print:text-slate-500">Not assigned</span>
                          )}
                        </td>

                        <td className="p-3 border border-white/10 print:border-slate-300">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(item.rr_status)}`}>
                            {statusLabel(item.rr_status)}
                          </span>
                        </td>

                        <td className="p-3 border border-white/10 print:border-slate-300">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(item.qa_status)}`}>
                            {statusLabel(item.qa_status || "pending")}
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
                            <Button
                              size="sm"
                              variant="outline"
                              className={outlineButton}
                              disabled={updatingId === item.id}
                              onClick={() =>
                                updateRequest(
                                  item,
                                  {
                                    rr_status: "received",
                                    status: "rr_received",
                                    lifecycle_status: "received_by_rr",
                                  },
                                  "Receive Part"
                                )
                              }
                            >
                              Receive
                            </Button>

                            <select
                              className="h-9 rounded-md border border-white/10 bg-[#08153d] px-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#ff5a00]"
                              value={selectedTech[item.id] || ""}
                              onChange={(e) =>
                                setSelectedTech((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                            >
                              <option className="bg-[#08153d] text-white" value="">Select RR Tech</option>
                              {rrUsers.map((user) => (
                                <option
                                  className="bg-[#08153d] text-white"
                                  key={user.id || user.user_id}
                                  value={user.user_id || user.id}
                                >
                                  {user.full_name || user.name || user.email}
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

                            <Button
                              size="sm"
                              variant="outline"
                              className={outlineButton}
                              disabled={updatingId === item.id}
                              onClick={() =>
                                updateRequest(
                                  item,
                                  {
                                    rr_status: "under_repair",
                                    lifecycle_status: "under_repair",
                                  },
                                  "Start Repair"
                                )
                              }
                            >
                              Repair
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className={outlineButton}
                              disabled={updatingId === item.id}
                              onClick={() =>
                                updateRequest(
                                  item,
                                  {
                                    rr_status: "waiting_qa",
                                    qa_status: "pending",
                                    lifecycle_status: "waiting_qa",
                                  },
                                  "Submit To QA"
                                )
                              }
                            >
                              Submit QA
                            </Button>

                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={updatingId === item.id}
                              onClick={() =>
                                updateRequest(
                                  item,
                                  {
                                    rr_status: "qa_passed",
                                    qa_status: "passed",
                                    qa_tested_by: null,
                                    qa_tested_at: new Date().toISOString(),
                                    lifecycle_status: "qa_passed",
                                  },
                                  "QA Passed"
                                )
                              }
                            >
                              QA Pass
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={updatingId === item.id}
                              onClick={() =>
                                updateRequest(
                                  item,
                                  {
                                    rr_status: "qa_failed",
                                    qa_status: "failed",
                                    qa_tested_by: null,
                                    qa_tested_at: new Date().toISOString(),
                                    lifecycle_status: "qa_failed",
                                  },
                                  "QA Failed"
                                )
                              }
                            >
                              QA Fail
                            </Button>

                            <Button
                              size="sm"
                              className="bg-[#ff5a00] hover:bg-[#e24f00] text-white"
                              disabled={updatingId === item.id}
                              onClick={() => returnToInventory(item)}
                            >
                              Return Inventory
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={updatingId === item.id}
                              onClick={() =>
                                updateRequest(
                                  item,
                                  {
                                    rr_status: "scrapped",
                                    lifecycle_status: "scrapped",
                                  },
                                  "Scrap"
                                )
                              }
                            >
                              Scrap
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className={outlineButton}
                              disabled={updatingId === item.id}
                              onClick={() =>
                                updateRequest(
                                  item,
                                  {
                                    rr_status: "sold",
                                    lifecycle_status: "sold",
                                  },
                                  "Sold"
                                )
                              }
                            >
                              Sold
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

export default RRPartRequests;
