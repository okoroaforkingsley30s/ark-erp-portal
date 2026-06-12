import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
  Clock,
  Truck,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Wrench,
  Trash2,
  ShoppingBag,
  Printer,
  Search,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const categories = [
  { key: "all", title: "All Requests", icon: Package, color: "bg-[#102969]", text: "text-white" },
  { key: "waiting", title: "Waiting Approval", icon: Clock, color: "bg-amber-500", text: "text-white" },
  { key: "dispatched", title: "Dispatched", icon: Truck, color: "bg-green-600", text: "text-white" },
  { key: "failed", title: "Failed Field", icon: AlertTriangle, color: "bg-red-600", text: "text-white" },
  { key: "returned", title: "Returned", icon: RotateCcw, color: "bg-purple-600", text: "text-white" },
  { key: "used", title: "Used Parts", icon: CheckCircle, color: "bg-emerald-700", text: "text-white" },
  { key: "repair", title: "Under Repair", icon: Wrench, color: "bg-orange-600", text: "text-white" },
  { key: "scrapped", title: "Scrapped", icon: Trash2, color: "bg-slate-700", text: "text-white" },
  { key: "sold", title: "Sold Parts", icon: ShoppingBag, color: "bg-pink-700", text: "text-white" },
];

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function getRequestStatus(request) {
  return normalize(
    request.lifecycle_status ||
      request.status ||
      request.request_status ||
      request.part_status ||
      request.approval_status
  );
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
    request.ticket?.ticket_number ||
    "N/A"
  );
}

function getRequestDate(request) {
  return request.created_at || request.requested_at || request.date_created;
}

function matchesCategory(request, key) {
  const status = getRequestStatus(request);

  if (key === "all") return true;

  if (key === "waiting") {
    return [
      "pending",
      "waiting",
      "waiting_approval",
      "pending_approval",
      "pending_parts",
      "requested",
      "submitted",
      "new",
    ].includes(status);
  }

  if (key === "dispatched") {
    return [
      "dispatched",
      "issued",
      "issued_to_field",
      "field_supplied",
      "released",
    ].includes(status);
  }

  if (key === "failed") {
    return [
      "failed",
      "failed_in_field",
      "field_failed",
      "bad",
      "defective",
    ].includes(status);
  }

  if (key === "returned") {
    return [
      "returned",
      "returned_to_inventory",
      "return_to_inventory",
      "received_back",
    ].includes(status);
  }

  if (key === "used") {
    return [
      "used",
      "installed",
      "installed_at_bank",
      "completed",
      "consumed",
    ].includes(status);
  }

  if (key === "repair") {
    return [
      "under_repair",
      "repair",
      "issued_to_rr",
      "issued_to_repair",
      "rr",
      "repair_team",
      "repaired",
    ].includes(status);
  }

  if (key === "scrapped") return ["scrapped", "scrap"].includes(status);
  if (key === "sold") return ["sold"].includes(status);

  return false;
}

async function fetchPartRequests() {
  const { data, error } = await supabase
    .from("part_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export default function PartsScreen() {
  const [active, setActive] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["part_requests_dashboard"],
    queryFn: fetchPartRequests,
  });

  const filtered = useMemo(() => {
    return requests.filter((request) => {
      const q = search.toLowerCase().trim();
      const status = getRequestStatus(request);
      const partName = getPartName(request).toLowerCase();
      const ticketNumber = String(getTicketNumber(request)).toLowerCase();

      const categoryMatch = matchesCategory(request, active);

      const searchMatch =
        !q ||
        partName.includes(q) ||
        ticketNumber.includes(q) ||
        status.includes(q);

      const createdAt = getRequestDate(request)
        ? new Date(getRequestDate(request))
        : null;

      const fromMatch =
        !fromDate || (createdAt && createdAt >= new Date(fromDate));

      const toMatch =
        !toDate || (createdAt && createdAt <= new Date(`${toDate}T23:59:59`));

      return categoryMatch && searchMatch && fromMatch && toMatch;
    });
  }, [requests, active, search, fromDate, toDate]);

  const countFor = (key) => {
    return requests.filter((request) => matchesCategory(request, key)).length;
  };

  const activeTitle =
    categories.find((c) => c.key === active)?.title || "All Requests";

  return (
    <div className="p-4 space-y-6 bg-[#0b1f5e] min-h-screen print:bg-white print:p-0">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }

            #parts-print-area, #parts-print-area * {
              visibility: visible;
            }

            #parts-print-area {
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

            tfoot {
              display: table-footer-group;
            }
          }
        `}
      </style>

      <div className="no-print rounded-2xl border border-white/10 bg-[#102969] p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Parts Workflow</h1>
            <p className="text-sm text-blue-100">
              Full part movement tracking across Operations, Inventory, Finance,
              Dispatch, Field and Repair.
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
        {categories.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.key}
              onClick={() => setActive(card.key)}
              className={`cursor-pointer border border-white/10 shadow-lg transition hover:scale-[1.01] ${
                active === card.key ? "ring-2 ring-[#ff5a00] ring-offset-2 ring-offset-[#0b1f5e]" : ""
              } ${card.color} ${card.text}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Icon className="h-6 w-6 opacity-90" />
                  <span className="text-3xl font-bold">{countFor(card.key)}</span>
                </div>
                <CardTitle className="text-sm font-semibold">
                  {card.title}
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card className="no-print shadow-xl border border-white/10 bg-[#102969]">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-300" />
              <Input
                className="pl-9 bg-[#08153d] border-white/20 text-white placeholder:text-slate-300"
                placeholder="Search part, ticket, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Input
              type="date"
              className="bg-[#08153d] border-white/20 text-white"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />

            <Input
              type="date"
              className="bg-[#08153d] border-white/20 text-white"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div id="parts-print-area">
        <div className="hidden print:flex items-center justify-between border-b-4 border-[#ff5a00] pb-3 mb-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ARK Logo" className="w-16 h-16 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-[#102969]">
                ARK TECHNOLOGIES GROUP
              </h1>
              <p className="text-sm font-semibold">ARK ONE ERP</p>
              <p className="text-xs text-slate-600">Parts Workflow Report</p>
            </div>
          </div>

          <div className="text-right text-xs">
            <p>
              <strong>Category:</strong> {activeTitle}
            </p>
            <p>
              <strong>Period:</strong> {fromDate || "Beginning"} to{" "}
              {toDate || "Today"}
            </p>
            <p>
              <strong>Total:</strong> {filtered.length}
            </p>
            <p>
              <strong>Printed:</strong> {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        <Card className="shadow-xl border border-white/10 bg-[#102969] print:bg-white print:shadow-none print:border-none">
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
                Loading part requests...
              </p>
            )}

            {error && (
              <div className="m-4 border border-red-300 bg-red-950/40 text-red-100 rounded-lg p-3 text-sm print:bg-red-50 print:text-red-700">
                Failed to load part requests: {error.message}
              </div>
            )}

            {!isLoading && !error && filtered.length === 0 && (
              <p className="p-4 text-blue-100 print:text-slate-600">
                No part requests found for this category/date range.
              </p>
            )}

            {!isLoading && !error && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-[#ff5a00] text-white print:bg-[#102969]">
                    <tr>
                      <th className="text-left p-3 border border-white/20">Date</th>
                      <th className="text-left p-3 border border-white/20">Ticket</th>
                      <th className="text-left p-3 border border-white/20">Part</th>
                      <th className="text-left p-3 border border-white/20">Qty</th>
                      <th className="text-left p-3 border border-white/20">Status</th>
                      <th className="text-left p-3 border border-white/20 no-print">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((request, index) => {
                      const status = getRequestStatus(request);
                      const requestDate = getRequestDate(request);

                      return (
                        <Fragment key={request.id}>
                          <tr
                            className={`text-white ${
                              index % 2 === 0 ? "bg-[#102969]" : "bg-[#0b1f5e]"
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
                            <td className="p-3 border border-white/10 font-semibold print:border-slate-300">
                              {getPartName(request)}
                            </td>
                            <td className="p-3 border border-white/10 print:border-slate-300">
                              {request.quantity || 1}
                            </td>
                            <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                              {status || "pending"}
                            </td>
                            <td className="p-3 border border-white/10 no-print">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white text-[#ff5a00] border-[#ff5a00] hover:bg-orange-50"
                                onClick={() =>
                                  setExpanded(
                                    expanded === request.id ? null : request.id
                                  )
                                }
                              >
                                {expanded === request.id ? "Hide" : "View Flow"}
                              </Button>
                            </td>
                          </tr>

                          {expanded === request.id && (
                            <tr className="no-print bg-[#08153d] text-white">
                              <td colSpan={6} className="p-4 border border-white/10">
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

                                <div className="border border-white/10 rounded-lg p-3 bg-[#102969]">
                                  <strong>Part Movement Flow</strong>

                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                                    <div className="border border-blue-300/30 rounded p-2 bg-blue-900/40">
                                      Main Stock / Inventory
                                    </div>
                                    <div className="border border-green-300/30 rounded p-2 bg-green-900/40">
                                      Field Supplied Parts
                                    </div>
                                    <div className="border border-red-300/30 rounded p-2 bg-red-900/40">
                                      Failed / Returned Parts
                                    </div>
                                    <div className="border border-orange-300/30 rounded p-2 bg-orange-900/40">
                                      RR / Repair Team / QA
                                    </div>
                                    <div className="border border-slate-300/30 rounded p-2 bg-slate-800">
                                      Repaired / Scrapped / Sold / Closed
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-blue-100">
                                  <div>
                                    <strong className="text-white">Requested By:</strong>{" "}
                                    {request.engineer_name ||
                                      request.requested_by_name ||
                                      request.created_by ||
                                      "N/A"}
                                  </div>

                                  <div>
                                    <strong className="text-white">Reason:</strong>{" "}
                                    {request.reason ||
                                      request.reason_category ||
                                      request.issue_reason ||
                                      "N/A"}
                                  </div>

                                  <div>
                                    <strong className="text-white">Lifecycle:</strong>{" "}
                                    {request.lifecycle_status ||
                                      request.status ||
                                      "N/A"}
                                  </div>

                                  <div>
                                    <strong className="text-white">Notes:</strong>{" "}
                                    {request.notes || request.comment || "No note"}
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