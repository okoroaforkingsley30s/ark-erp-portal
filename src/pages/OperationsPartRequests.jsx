import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  XCircle,
  Send,
  Search,
  Package,
  Printer,
  Clock,
  ListChecks,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const opsCards = [
  {
    key: "pending",
    title: "Pending Approval",
    icon: Clock,
    color: "bg-amber-500",
  },
  {
    key: "approved",
    title: "Approved",
    icon: CheckCircle,
    color: "bg-green-600",
  },
  {
    key: "sent_inventory",
    title: "Sent to Inventory",
    icon: Send,
    color: "bg-[#ff5a00]",
  },
  {
    key: "rejected",
    title: "Rejected",
    icon: XCircle,
    color: "bg-red-600",
  },
  {
    key: "all",
    title: "All Requests",
    icon: ListChecks,
    color: "bg-[#102969]",
  },
];

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function getPartName(request) {
  return (
    request.part_name ||
    request.spare_part_name ||
    request.item_name ||
    request.part_type ||
    request.description ||
    "Requested Part"
  );
}

function getTicketNumber(request) {
  return (
    request.ticket_number ||
    request.ticket_id ||
    request.ticket_ref ||
    "N/A"
  );
}

function getEngineerName(request) {
  return (
    request.engineer_name ||
    request.requested_by_name ||
    request.requested_by ||
    request.created_by_name ||
    request.created_by ||
    request.engineer ||
    request.engineer_id ||
    "N/A"
  );
}

function getRequestDate(request) {
  return request.created_at || request.requested_at || request.date_created;
}

function matchesOpsCard(request, key) {
  const status = normalize(request.status);
  const opsStatus = normalize(request.operations_status);
  const inventoryStatus = normalize(request.inventory_status);

  if (key === "all") return true;

  if (key === "pending") {
    return (
      opsStatus === "" ||
      opsStatus === "pending" ||
      opsStatus === "waiting" ||
      status === "" ||
      status === "pending" ||
      status === "pending_operations" ||
      status === "waiting_approval" ||
      status === "requested" ||
      status === "submitted" ||
      status === "new"
    );
  }

  if (key === "approved") {
    return opsStatus === "approved" || status === "approved_operations";
  }

  if (key === "sent_inventory") {
    return (
      opsStatus === "sent_to_inventory" ||
      status === "pending_inventory" ||
      inventoryStatus === "pending"
    );
  }

  if (key === "rejected") {
    return opsStatus === "rejected" || status === "rejected";
  }

  return false;
}

async function fetchOperationsPartRequests() {
  const { data, error } = await supabase
    .from("part_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function updateOperationsStatus({ id, action }) {
  let updateData = {};
  let actionText = "";

  if (action === "approve") {
    updateData = {
      operations_status: "approved",
      status: "approved_operations",
      updated_at: new Date().toISOString(),
    };
    actionText = "approved";
  }

  if (action === "reject") {
    updateData = {
      operations_status: "rejected",
      status: "rejected",
      updated_at: new Date().toISOString(),
    };
    actionText = "rejected";
  }

  if (action === "send_inventory") {
    updateData = {
      operations_status: "sent_to_inventory",
      inventory_status: "pending",
      status: "pending_inventory",
      updated_at: new Date().toISOString(),
    };
    actionText = "sent to inventory";
  }

  const { data, error } = await supabase
    .from("part_requests")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Part request update failed:", error);
    throw error;
  }

  const { error: lifecycleError } = await supabase
    .from("part_lifecycle_logs")
    .insert({
      part_request_id: id,
      status: updateData.status,
      department: "Operations",
      note: `Operations ${actionText}`,
    });

  if (lifecycleError) {
    console.warn("Lifecycle log failed:", lifecycleError);
  }

  const { error: eventError } = await supabase
    .from("operations_events")
    .insert({
      event_type: "PART_REQUEST_OPERATIONS_UPDATE",
      title: `Part request ${actionText}`,
      description: `Operations ${actionText} part request`,
      source_module: "Operations",
      entity_type: "part_request",
      entity_id: id,
      severity: action === "reject" ? "warning" : "info",
    });

  if (eventError) {
    console.warn("OIN event failed:", eventError);
  }

  return data;
}

export default function OperationsPartRequests() {
  const qc = useQueryClient();

  const [active, setActive] = useState("pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["operations_part_requests"],
    queryFn: fetchOperationsPartRequests,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return requests.filter((request) => {
      const status = normalize(request.status);
      const opsStatus = normalize(request.operations_status);
      const inventoryStatus = normalize(request.inventory_status);

      const cardMatch = matchesOpsCard(request, active);

      const searchMatch =
        !q ||
        getPartName(request).toLowerCase().includes(q) ||
        String(getTicketNumber(request)).toLowerCase().includes(q) ||
        String(getEngineerName(request)).toLowerCase().includes(q) ||
        status.includes(q) ||
        opsStatus.includes(q) ||
        inventoryStatus.includes(q);

      return cardMatch && searchMatch;
    });
  }, [requests, active, search]);

  const countFor = (key) => {
    return requests.filter((request) => matchesOpsCard(request, key)).length;
  };

  const activeTitle =
    opsCards.find((card) => card.key === active)?.title || "All Requests";

  const mutation = useMutation({
    mutationFn: updateOperationsStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations_part_requests"] });
      qc.invalidateQueries({ queryKey: ["part_requests_dashboard"] });
      alert("Part request updated successfully.");
    },
    onError: (err) => {
      console.error(err);
      alert(`Update failed: ${err.message}`);
    },
  });

  return (
    <div className="p-4 space-y-6 bg-[#0b1f5e] min-h-screen print:bg-white print:p-0">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }

            #operations-print-area,
            #operations-print-area * {
              visibility: visible;
            }

            #operations-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              background: white !important;
            }

            .no-print {
              display: none !important;
            }

            table {
              page-break-inside: auto;
            }

            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }

            thead {
              display: table-header-group;
            }
          }
        `}
      </style>

      <div className="no-print rounded-2xl border border-white/10 bg-[#102969] p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Operations Part Approval
            </h1>
            <p className="text-sm text-blue-100">
              Review engineer part requests, approve, reject, or send approved
              requests to Inventory.
            </p>
          </div>

          <Button
            onClick={() => window.print()}
            className="gap-2 bg-[#ff5a00] hover:bg-[#e24f00] text-white"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>

      <div className="no-print grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {opsCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.key}
              onClick={() => setActive(card.key)}
              className={`cursor-pointer border border-white/10 shadow-lg transition hover:scale-[1.01] ${
                active === card.key
                  ? "ring-2 ring-white ring-offset-2 ring-offset-[#0b1f5e]"
                  : ""
              } ${card.color} text-white`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Icon className="h-6 w-6 opacity-90" />
                  <span className="text-3xl font-bold">
                    {countFor(card.key)}
                  </span>
                </div>
                <CardTitle className="text-sm font-semibold">
                  {card.title}
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card className="no-print bg-[#102969] border border-white/10 shadow-xl">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-300" />
            <Input
              className="pl-9 bg-[#08153d] border-white/20 text-white placeholder:text-slate-300"
              placeholder="Search ticket, part, engineer, or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div id="operations-print-area">
        <div className="hidden print:flex items-center justify-between border-b-4 border-[#ff5a00] pb-3 mb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="ARK Logo"
              className="w-16 h-16 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-[#102969]">
                ARK TECHNOLOGIES GROUP
              </h1>
              <p className="text-sm font-semibold">ARK ONE ERP</p>
              <p className="text-xs text-slate-600">
                Operations Part Request Report
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <p>
              <strong>Category:</strong> {activeTitle}
            </p>
            <p>
              <strong>Total:</strong> {filtered.length}
            </p>
            <p>
              <strong>Printed:</strong> {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        <Card className="bg-[#102969] border border-white/10 shadow-xl print:bg-white print:shadow-none print:border-none">
          <CardHeader className="bg-[#08153d] border-b border-white/10 print:bg-white print:border-b print:border-slate-300">
            <CardTitle className="text-white print:text-[#102969]">
              {activeTitle}{" "}
              <span className="text-sm font-normal text-blue-100 print:text-slate-500">
                ({filtered.length})
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 bg-[#102969] print:bg-white">
            {isLoading && (
              <p className="p-4 text-white print:text-slate-700">
                Loading requests...
              </p>
            )}

            {error && (
              <p className="p-4 text-red-300 print:text-red-700">
                Failed to load requests: {error.message}
              </p>
            )}

            {!isLoading && !error && filtered.length === 0 && (
              <p className="p-4 text-blue-100 print:text-slate-600">
                No part requests found for this category.
              </p>
            )}

            {!isLoading && !error && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-[#ff5a00] text-white print:bg-[#102969]">
                    <tr>
                      <th className="text-left p-3 border border-white/20">
                        Date
                      </th>
                      <th className="text-left p-3 border border-white/20">
                        Ticket
                      </th>
                      <th className="text-left p-3 border border-white/20">
                        Engineer
                      </th>
                      <th className="text-left p-3 border border-white/20">
                        Part
                      </th>
                      <th className="text-left p-3 border border-white/20">
                        Qty
                      </th>
                      <th className="text-left p-3 border border-white/20">
                        Ops Status
                      </th>
                      <th className="text-left p-3 border border-white/20">
                        Current Status
                      </th>
                      <th className="text-left p-3 border border-white/20 no-print">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((request, index) => {
                      const requestDate = getRequestDate(request);
                      const status = request.status || "pending";
                      const opsStatus = request.operations_status || "pending";

                      return (
                        <Fragment key={request.id}>
                          <tr
                            className={`text-white ${
                              index % 2 === 0
                                ? "bg-[#102969]"
                                : "bg-[#0b1f5e]"
                            } hover:bg-[#173b9a] print:text-[#102969] print:bg-white`}
                          >
                            <td className="p-3 border border-white/10 print:border-slate-300">
                              {requestDate
                                ? new Date(requestDate).toLocaleDateString()
                                : "N/A"}
                            </td>

                            <td className="p-3 border border-white/10 print:border-slate-300">
                              {getTicketNumber(request)}
                            </td>

                            <td className="p-3 border border-white/10 print:border-slate-300">
                              {getEngineerName(request)}
                            </td>

                            <td className="p-3 border border-white/10 font-semibold print:border-slate-300">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-[#ff5a00] print:hidden" />
                                {getPartName(request)}
                              </div>
                            </td>

                            <td className="p-3 border border-white/10 print:border-slate-300">
                              {request.quantity || 1}
                            </td>

                            <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                              {opsStatus}
                            </td>

                            <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                              {status}
                            </td>

                            <td className="p-3 border border-white/10 no-print">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  disabled={mutation.isPending}
                                  onClick={() =>
                                    mutation.mutate({
                                      id: request.id,
                                      action: "approve",
                                    })
                                  }
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>

                                <Button
                                  size="sm"
                                  className="bg-[#ff5a00] hover:bg-[#e24f00] text-white"
                                  disabled={mutation.isPending}
                                  onClick={() =>
                                    mutation.mutate({
                                      id: request.id,
                                      action: "send_inventory",
                                    })
                                  }
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Send Inventory
                                </Button>

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={mutation.isPending}
                                  onClick={() =>
                                    mutation.mutate({
                                      id: request.id,
                                      action: "reject",
                                    })
                                  }
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-white text-[#102969] hover:bg-blue-50"
                                  onClick={() =>
                                    setExpanded(
                                      expanded === request.id
                                        ? null
                                        : request.id
                                    )
                                  }
                                >
                                  {expanded === request.id
                                    ? "Hide"
                                    : "View"}
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {expanded === request.id && (
                            <tr className="no-print bg-[#08153d] text-white">
                              <td
                                colSpan={8}
                                className="p-4 border border-white/10"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                  <div className="border border-white/10 rounded p-3 bg-[#102969]">
                                    <strong>Operations</strong>
                                    <p className="text-blue-100">
                                      {request.operations_status || "Waiting"}
                                    </p>
                                  </div>

                                  <div className="border border-white/10 rounded p-3 bg-[#102969]">
                                    <strong>Inventory</strong>
                                    <p className="text-blue-100">
                                      {request.inventory_status || "Waiting"}
                                    </p>
                                  </div>

                                  <div className="border border-white/10 rounded p-3 bg-[#102969]">
                                    <strong>Finance</strong>
                                    <p className="text-blue-100">
                                      {request.finance_status || "Waiting"}
                                    </p>
                                  </div>

                                  <div className="border border-white/10 rounded p-3 bg-[#102969]">
                                    <strong>Dispatch</strong>
                                    <p className="text-blue-100">
                                      {request.dispatch_status || "Waiting"}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-blue-100">
                                  <div>
                                    <strong className="text-white">
                                      Engineer:
                                    </strong>{" "}
                                    {getEngineerName(request)}
                                  </div>

                                  <div>
                                    <strong className="text-white">
                                      Reason:
                                    </strong>{" "}
                                    {request.reason ||
                                      request.reason_category ||
                                      request.issue_reason ||
                                      "N/A"}
                                  </div>

                                  <div>
                                    <strong className="text-white">
                                      Lifecycle:
                                    </strong>{" "}
                                    {request.lifecycle_status ||
                                      request.status ||
                                      "N/A"}
                                  </div>

                                  <div>
                                    <strong className="text-white">
                                      Notes:
                                    </strong>{" "}
                                    {request.notes ||
                                      request.comment ||
                                      "No note"}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
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