import { Fragment, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PackageCheck,
  AlertTriangle,
  XCircle,
  Search,
  Package,
  Printer,
  Wrench,
  ListChecks,
  Truck,
  Boxes,
  RotateCcw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccess } from "@/lib/roleAccess";
import {
  canDoInventoryAction,
  canDoConsumableAction,
  getInventoryState,
  getConsumableState,
  workflowCan,
  INVENTORY_ALLOWED_ACTIONS,
  RR_CONSUMABLE_ALLOWED_ACTIONS,
} from "@/lib/workflowRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const engineerCards = [
  { key: "pending", title: "Pending Inventory", icon: Package, color: "bg-amber-500" },
  { key: "issued", title: "Ready Dispatch", icon: PackageCheck, color: "bg-green-600" },
  { key: "dispatched", title: "Dispatched To Field", icon: Truck, color: "bg-blue-600" },
  { key: "rr", title: "Transferred To RR", icon: Wrench, color: "bg-orange-600" },
  { key: "rr_return", title: "QA Passed / Returned From RR", icon: RotateCcw, color: "bg-purple-600" },
  { key: "out_stock", title: "Out Of Stock", icon: AlertTriangle, color: "bg-red-600" },
  { key: "rejected", title: "Rejected", icon: XCircle, color: "bg-slate-700" },
  { key: "all", title: "All Engineer Requests", icon: ListChecks, color: "bg-[#102969]" },
];

const consumableCards = [
  { key: "pending", title: "Pending RR Consumables", icon: Boxes, color: "bg-amber-500" },
  { key: "released", title: "Released", icon: PackageCheck, color: "bg-green-600" },
  { key: "out_stock", title: "Out Of Stock", icon: AlertTriangle, color: "bg-red-600" },
  { key: "rejected", title: "Rejected By HOD", icon: XCircle, color: "bg-slate-700" },
  { key: "all", title: "All Consumables", icon: ListChecks, color: "bg-[#102969]" },
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
  return request.ticket_number || request.ticket_id || request.ticket_ref || "N/A";
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

function getDestination(request) {
  return (
    request.destination ||
    request.location ||
    request.branch_name ||
    request.site_name ||
    request.bank_name ||
    request.terminal_id ||
    ""
  );
}

function getFinanceLabel(request) {
  const finance = normalize(request.finance_status);
  const dispatch = normalize(request.dispatch_status);

  if (finance === "disbursed") return "DISBURSED";
  if (finance === "approved" && dispatch === "awaiting_disbursement") {
    return "APPROVED - AWAITING DISBURSEMENT";
  }
  if (finance === "pending_review" || dispatch === "pending_finance") {
    return "PENDING FINANCE";
  }
  if (finance === "rejected") return "FINANCE REJECTED";

  return request.finance_status || "Waiting";
}

function matchesEngineerCard(request, key) {
  const status = normalize(request.status);
  const inventoryStatus = normalize(request.inventory_status);
  const lifecycleStatus = normalize(request.lifecycle_status);
  const dispatchStatus = normalize(request.dispatch_status);
  const rrStatus = normalize(request.rr_status);
  const qaStatus = normalize(request.qa_status);

  if (key === "all") return true;

  if (key === "pending") {
    return (
      status === "pending_inventory" ||
      status === "sent_to_inventory" ||
      status === "approved_operations" ||
      inventoryStatus === "sent_to_inventory" ||
      inventoryStatus === "pending_inventory" ||
      inventoryStatus === "pending" ||
      inventoryStatus === "waiting"
    );
  }

  if (key === "issued") {
    return (
      status === "ready_for_dispatch" ||
      lifecycleStatus === "ready_for_dispatch" ||
      dispatchStatus === "ready" ||
      dispatchStatus === "ready_for_dispatch" ||
      inventoryStatus === "rr_verified"
    );
  }

  if (key === "dispatched") {
    return (
      status === "dispatched" ||
      status === "dispatched_to_engineer" ||
      dispatchStatus === "dispatched" ||
      lifecycleStatus === "dispatched_to_engineer"
    );
  }

  if (key === "rr") {
    return (
      status === "pending_rr" ||
      inventoryStatus === "transferred_rr" ||
      lifecycleStatus === "issued_to_rr" ||
      rrStatus === "pending_rr"
    );
  }

  if (key === "rr_return") {
    return (
      qaStatus === "passed" &&
      (
        rrStatus === "returned_inventory" ||
        rrStatus === "returned_to_inventory" ||
        inventoryStatus === "rr_verified" ||
        inventoryStatus === "returned_inventory" ||
        inventoryStatus === "returned_to_inventory" ||
        lifecycleStatus === "returned_inventory" ||
        lifecycleStatus === "returned_to_inventory"
      )
    );
  }

  if (key === "out_stock") {
    return status === "waiting_stock" || inventoryStatus === "out_of_stock";
  }

  if (key === "rejected") {
    return status === "rejected_inventory" || inventoryStatus === "rejected";
  }

  return false;
}

function matchesConsumableCard(request, key) {
  const status = normalize(request.status);
  const inventoryStatus = normalize(request.inventory_status);
  const hodStatus = normalize(request.hod_status);

  if (key === "all") return true;

  if (key === "pending") {
    return status === "pending_inventory" || inventoryStatus === "pending";
  }

  if (key === "released") {
    return status === "released" || inventoryStatus === "released";
  }

  if (key === "out_stock") {
    return status === "out_of_stock" || inventoryStatus === "out_of_stock";
  }

  if (key === "rejected") {
    return status === "rejected_by_hod" || hodStatus === "rejected";
  }

  return false;
}

async function fetchInventoryPartRequests() {
  const { data, error } = await supabase
    .from("part_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchRRConsumableRequests() {
  const { data, error } = await supabase
    .from("rr_consumable_requests")
    .select(`
      *,
      repair_jobs (
        id,
        job_number,
        ticket_id,
        part_request_id,
        module_name,
        serial_number,
        status
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function updateEngineerInventoryStatus({ id, action, fundData = {}, user = null }) {
  const { data: currentRequest, error: currentError } = await supabase
    .from("part_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (currentError) throw currentError;

  const actionMap = {
    rr: "send_to_rr",
    out_stock: "mark_out_of_stock",
    reject: "reject_inventory",
    return_stock: "receive_rr_return",
    dispatch: "dispatch_to_engineer",
  };

  if (action === "issue") {
    throw new Error(
      "Direct Issue is no longer allowed. Inventory must send every part to RR for verification first."
    );
  }

  const workflowAction = actionMap[action];

  if (
    workflowAction &&
    !workflowCan(
      INVENTORY_ALLOWED_ACTIONS,
      getInventoryState(currentRequest),
      workflowAction
    )
  ) {
    throw new Error(
      "This request is not at the correct Inventory workflow stage for this action."
    );
  }

  if (action === "return_stock") {
    if (
      currentRequest.qa_status !== "passed" ||
      currentRequest.rr_status !== "returned_inventory"
    ) {
      throw new Error(
        "This part cannot return to stock until RR QA is passed and returned by RR."
      );
    }
  }

  if (action === "dispatch") {
    const state = getInventoryState(currentRequest);

    if (currentRequest.finance_status !== "disbursed") {
      throw new Error("Finance has not disbursed dispatch fund yet. Request dispatch fund and wait for Accounts disbursement before dispatching.");
    }

    if (state !== "ready_for_dispatch") {
      throw new Error(
        "This part is not ready for dispatch yet. It must pass RR QA and be returned to Inventory first."
      );
    }

    if (
      currentRequest.qa_status !== "passed" &&
      currentRequest.rr_status !== "returned_inventory" &&
      currentRequest.inventory_status !== "rr_verified"
    ) {
      throw new Error(
        "Inventory cannot dispatch this part until RR QA is passed and the part is returned to Inventory."
      );
    }
  }

  let updateData = {};
  let actionText = "";

  if (action === "rr") {
    updateData = {
      inventory_status: "transferred_rr",
      rr_status: "pending_rr",
      status: "pending_rr",
      lifecycle_status: "issued_to_rr",
      dispatch_status: "waiting_rr",
      updated_at: new Date().toISOString(),
    };
    actionText = "sent part to RR for mandatory verification";
  }

  if (action === "out_stock") {
    updateData = {
      inventory_status: "out_of_stock",
      status: "waiting_stock",
      lifecycle_status: "in_stock_pending",
      dispatch_status: "waiting_stock",
      updated_at: new Date().toISOString(),
    };
    actionText = "marked request as out of stock";
  }

  if (action === "reject") {
    updateData = {
      inventory_status: "rejected",
      status: "rejected_inventory",
      lifecycle_status: "rejected_inventory",
      dispatch_status: "rejected",
      updated_at: new Date().toISOString(),
    };
    actionText = "rejected request";
  }

  if (action === "return_stock") {
    updateData = {
      inventory_status: "rr_verified",
      dispatch_status: "ready",
      status: "ready_for_dispatch",
      lifecycle_status: "ready_for_dispatch",
      updated_at: new Date().toISOString(),
    };
    actionText = "received QA-passed part from RR and marked ready for dispatch";
  }

  if (action === "request_fund") {
    const state = getInventoryState(currentRequest);

    if (state !== "ready_for_dispatch") {
      throw new Error("This part is not ready for dispatch fund request yet. It must pass RR QA and be returned to Inventory first.");
    }

    if (
      currentRequest.qa_status !== "passed" &&
      currentRequest.rr_status !== "returned_inventory" &&
      currentRequest.inventory_status !== "rr_verified"
    ) {
      throw new Error("Inventory cannot request dispatch fund until RR QA is passed and the part is returned to Inventory.");
    }

    const requestedAmount = Number(fundData.requested_amount || 0);

    if (!requestedAmount || requestedAmount <= 0) {
      throw new Error("Please enter the amount required for dispatch.");
    }

    updateData = {
      finance_status: "pending_review",
      dispatch_status: "pending_finance",
      status: "ready_for_dispatch",
      lifecycle_status: "awaiting_dispatch_fund",
      updated_at: new Date().toISOString(),
    };
    actionText = "requested dispatch fund from Finance";
  }

  if (action === "dispatch") {
    updateData = {
      inventory_status: "issued",
      dispatch_status: "dispatched",
      status: "dispatched",
      lifecycle_status: "dispatched_to_engineer",
      dispatched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    actionText = "dispatched QA-passed part to field engineer";
  }

  if (!Object.keys(updateData).length) {
    throw new Error("Invalid inventory action.");
  }

  const { data, error } = await supabase
    .from("part_requests")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (action === "request_fund") {
    const requestedAmount = Number(fundData.requested_amount || 0);

    const { error: fundError } = await supabase
      .from("inventory_dispatch_fund_requests")
      .insert({
        part_request_id: id,
        request_type: "dispatch_fund",
        part_number:
          currentRequest.part_number ||
          currentRequest.requested_part_number ||
          currentRequest.spare_part_number ||
          "",
        part_name: getPartName(currentRequest),
        serial_number: currentRequest.serial_number || null,
        warehouse: currentRequest.warehouse || "Oshodi",
        destination:
          fundData.destination ||
          getDestination(currentRequest) ||
          "Not specified",
        engineer_name: getEngineerName(currentRequest),
        engineer_email: currentRequest.engineer_email || currentRequest.engineer || null,
        logistics_type: fundData.logistics_type || "waybill",
        requested_amount: requestedAmount,
        approved_amount: 0,
        reason: fundData.reason || "Dispatch fund requested by Inventory",
        inventory_note: fundData.inventory_note || fundData.reason || "Dispatch fund requested by Inventory",
        status: "pending_finance",
        finance_status: "pending_review",
        requested_by: user?.full_name || user?.name || user?.email || "Inventory",
        requested_by_email: user?.email || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (fundError) throw fundError;
  }

  await supabase.from("part_lifecycle_logs").insert({
    part_request_id: id,
    status: updateData.lifecycle_status || updateData.status,
    department: "Inventory",
    note: `Inventory ${actionText}`,
  });

  await supabase.from("operations_events").insert({
    event_type: "PART_REQUEST_INVENTORY_UPDATE",
    title: `Inventory ${actionText}`,
    description: `Inventory ${actionText}`,
    source_module: "Inventory",
    entity_type: "part_request",
    entity_id: id,
    severity:
      action === "out_stock" || action === "reject" ? "warning" : "info",
  });

  return data;
}

async function updateConsumableInventoryStatus({ request, action }) {
  const requestItems = Array.isArray(request.items) ? request.items : [];

  if (requestItems.length === 0) {
    throw new Error("No consumable items found on this request.");
  }

  if (action === "out_stock") {
    const { data, error } = await supabase
      .from("rr_consumable_requests")
      .update({
        status: "out_of_stock",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  if (action === "release") {
    for (const item of requestItems) {
      const requestedQty = Number(item.quantity || 0);

      const { data: part, error: partError } = await supabase
        .from("spare_parts")
        .select("*")
        .eq("id", item.spare_part_id)
        .maybeSingle();

      if (partError) throw partError;
      if (!part) throw new Error(`${item.item_name} not found in inventory.`);

      const stockColumn =
        part.quantity_available !== undefined
          ? "quantity_available"
          : part.quantity !== undefined
          ? "quantity"
          : "available_quantity";

      const currentQty = Number(part[stockColumn] || 0);

      if (currentQty < requestedQty) {
        throw new Error(`Insufficient stock for ${item.item_name}.`);
      }

      const { error: stockError } = await supabase
        .from("spare_parts")
        .update({
          [stockColumn]: currentQty - requestedQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", part.id);

      if (stockError) throw stockError;
    }

    const { data, error } = await supabase
      .from("rr_consumable_requests")
      .update({
        status: "released",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  throw new Error("Invalid consumable action.");
}

export default function InventoryPartRequests() {
  const qc = useQueryClient();
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || null;
  const role = user?.role || user?.user_role || user?.position || "";

  const [requestType, setRequestType] = useState("engineer");
  const [active, setActive] = useState("pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const {
    data: engineerRequests = [],
    isLoading: engineerLoading,
    error: engineerError,
  } = useQuery({
    queryKey: ["inventory_part_requests"],
    queryFn: fetchInventoryPartRequests,
  });

  const {
    data: consumableRequests = [],
    isLoading: consumableLoading,
    error: consumableError,
  } = useQuery({
    queryKey: ["inventory_rr_consumable_requests"],
    queryFn: fetchRRConsumableRequests,
  });

  const cards = requestType === "engineer" ? engineerCards : consumableCards;
  const activeTitle = cards.find((card) => card.key === active)?.title || "All Requests";

  const filteredEngineer = useMemo(() => {
    const q = search.toLowerCase().trim();

    return engineerRequests.filter((request) => {
      const cardMatch = matchesEngineerCard(request, active);

      const searchMatch =
        !q ||
        getPartName(request).toLowerCase().includes(q) ||
        String(getTicketNumber(request)).toLowerCase().includes(q) ||
        String(getEngineerName(request)).toLowerCase().includes(q) ||
        normalize(request.status).includes(q) ||
        normalize(request.inventory_status).includes(q) ||
        normalize(request.lifecycle_status).includes(q) ||
        normalize(request.dispatch_status).includes(q) ||
        normalize(request.rr_status).includes(q) ||
        normalize(request.qa_status).includes(q);

      return cardMatch && searchMatch;
    });
  }, [engineerRequests, active, search]);

  const filteredConsumables = useMemo(() => {
    const q = search.toLowerCase().trim();

    return consumableRequests.filter((request) => {
      const cardMatch = matchesConsumableCard(request, active);

      const searchMatch =
        !q ||
        String(request.item_name || "").toLowerCase().includes(q) ||
        String(request.reason || "").toLowerCase().includes(q) ||
        String(request.status || "").toLowerCase().includes(q) ||
        String(request.inventory_status || "").toLowerCase().includes(q) ||
        String(request.repair_jobs?.job_number || "").toLowerCase().includes(q) ||
        String(request.repair_jobs?.module_name || "").toLowerCase().includes(q) ||
        String(request.repair_jobs?.serial_number || "").toLowerCase().includes(q);

      return cardMatch && searchMatch;
    });
  }, [consumableRequests, active, search]);

  const visibleRows = requestType === "engineer" ? filteredEngineer : filteredConsumables;
  const isLoading = requestType === "engineer" ? engineerLoading : consumableLoading;
  const error = requestType === "engineer" ? engineerError : consumableError;

  const countFor = (key) => {
    if (requestType === "engineer") {
      return engineerRequests.filter((request) => matchesEngineerCard(request, key)).length;
    }

    return consumableRequests.filter((request) => matchesConsumableCard(request, key)).length;
  };

  const engineerMutation = useMutation({
    mutationFn: updateEngineerInventoryStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_part_requests"] });
      qc.invalidateQueries({ queryKey: ["part_requests_dashboard"] });
      qc.invalidateQueries({ queryKey: ["rr_part_requests"] });
      qc.invalidateQueries({ queryKey: ["inventory_dispatch_fund_requests"] });
      alert("Inventory request updated successfully.");
    },
    onError: (err) => {
      console.error(err);
      alert(`Update failed: ${err.message}`);
    },
  });

  const consumableMutation = useMutation({
    mutationFn: updateConsumableInventoryStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_rr_consumable_requests"] });
      alert("RR consumable request updated successfully.");
    },
    onError: (err) => {
      console.error(err);
      alert(`Update failed: ${err.message}`);
    },
  });

  const switchType = (type) => {
    setRequestType(type);
    setActive("pending");
    setExpanded(null);
    setSearch("");
  };

  return (
    <div className="p-4 space-y-6 bg-[#0b1f5e] min-h-screen print:bg-white print:p-0">
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #inventory-print-area, #inventory-print-area * { visibility: visible; }
            #inventory-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              background: white !important;
            }
            .no-print { display: none !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          }
        `}
      </style>

      <div className="no-print rounded-2xl border border-white/10 bg-[#102969] p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Inventory Requests
            </h1>
            <p className="text-sm text-blue-100">
              One inventory control center for engineer part requests and RR consumable requests. QA-passed RR parts can be returned to stock only after RR testing is passed.
            </p>
          </div>

          {canAccess(role, "print_inventory_report") && (
            <Button
              onClick={() => window.print()}
              className="gap-2 bg-[#ff5a00] hover:bg-[#e24f00] text-white"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          )}
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-3">
        <Button
          onClick={() => switchType("engineer")}
          className={
            requestType === "engineer"
              ? "bg-[#ff5a00] hover:bg-[#e24f00] text-white"
              : "bg-[#102969] hover:bg-[#173b9a] text-white"
          }
        >
          Engineer Part Requests
        </Button>

        <Button
          onClick={() => switchType("consumable")}
          className={
            requestType === "consumable"
              ? "bg-[#ff5a00] hover:bg-[#e24f00] text-white"
              : "bg-[#102969] hover:bg-[#173b9a] text-white"
          }
        >
          RR Consumable Requests
        </Button>
      </div>

      <div className="no-print grid grid-cols-1 md:grid-cols-3 xl:grid-cols-8 gap-4">
        {cards.map((card) => {
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

      <Card className="no-print bg-[#102969] border border-white/10 shadow-xl">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-300" />
            <Input
              className="pl-9 bg-[#08153d] border-white/20 text-white placeholder:text-slate-300"
              placeholder={
                requestType === "engineer"
                  ? "Search ticket, part, engineer, or status..."
                  : "Search consumable, repair job, module, serial, reason, or status..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div id="inventory-print-area">
        <Card className="bg-[#102969] border border-white/10 shadow-xl print:bg-white print:shadow-none print:border-none">
          <CardHeader className="bg-[#08153d] border-b border-white/10 print:bg-white print:border-b print:border-slate-300">
            <CardTitle className="text-white print:text-[#102969]">
              {activeTitle}{" "}
              <span className="text-sm font-normal text-blue-100 print:text-slate-500">
                ({visibleRows.length})
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

            {!isLoading && !error && visibleRows.length === 0 && (
              <p className="p-4 text-blue-100 print:text-slate-600">
                No request found for this category.
              </p>
            )}

            {!isLoading && !error && visibleRows.length > 0 && requestType === "engineer" && (
              <EngineerTable
  rows={visibleRows}
  expanded={expanded}
  setExpanded={setExpanded}
  mutation={engineerMutation}
  user={user}
/>
            )}

            {!isLoading && !error && visibleRows.length > 0 && requestType === "consumable" && (
              <ConsumableTable
  rows={visibleRows}
  mutation={consumableMutation}
  user={user}
/>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EngineerTable({ rows, expanded, setExpanded, mutation, user }) {
  const [fundOpen, setFundOpen] = useState(null);
  const [fundForms, setFundForms] = useState({});

  const getFundForm = (request) => {
    const existing = fundForms[request.id] || {};

    return {
      requested_amount: existing.requested_amount || "",
      logistics_type: existing.logistics_type || "waybill",
      destination: existing.destination ?? getDestination(request),
      reason:
        existing.reason ||
        `Dispatch fund for ${getPartName(request)} to ${getEngineerName(request)}`,
    };
  };

  const updateFundForm = (request, field, value) => {
    setFundForms((current) => ({
      ...current,
      [request.id]: {
        ...getFundForm(request),
        ...current[request.id],
        [field]: value,
      },
    }));
  };

  const submitFundRequest = (request) => {
    const form = getFundForm(request);
    const amount = Number(form.requested_amount || 0);

    if (!amount || amount <= 0) {
      alert("Please enter the amount required for dispatch.");
      return;
    }

    mutation.mutate({
      id: request.id,
      action: "request_fund",
      user,
      fundData: {
        ...form,
        requested_amount: amount,
        inventory_note: form.reason,
      },
    });

    setFundOpen(null);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[#ff5a00] text-white print:bg-[#102969]">
          <tr>
            <th className="text-left p-3 border border-white/20">Date</th>
            <th className="text-left p-3 border border-white/20">Ticket</th>
            <th className="text-left p-3 border border-white/20">Engineer</th>
            <th className="text-left p-3 border border-white/20">Part</th>
            <th className="text-left p-3 border border-white/20">Qty</th>
            <th className="text-left p-3 border border-white/20">Inventory</th>
            <th className="text-left p-3 border border-white/20">Dispatch</th>
            <th className="text-left p-3 border border-white/20">RR</th>
            <th className="text-left p-3 border border-white/20">QA</th>
            <th className="text-left p-3 border border-white/20">Lifecycle</th>
            <th className="text-left p-3 border border-white/20 no-print">Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((request, index) => (
            <Fragment key={request.id}>
              <tr
                className={`text-white ${
                  index % 2 === 0 ? "bg-[#102969]" : "bg-[#0b1f5e]"
                } hover:bg-[#173b9a] print:text-[#102969] print:bg-white`}
              >
                <td className="p-3 border border-white/10 print:border-slate-300">
                  {getRequestDate(request)
                    ? new Date(getRequestDate(request)).toLocaleDateString()
                    : "N/A"}
                </td>

                <td className="p-3 border border-white/10 print:border-slate-300">
                  {getTicketNumber(request)}
                </td>

                <td className="p-3 border border-white/10 print:border-slate-300">
                  {getEngineerName(request)}
                </td>

                <td className="p-3 border border-white/10 font-semibold print:border-slate-300">
                  {getPartName(request)}
                </td>

                <td className="p-3 border border-white/10 print:border-slate-300">
                  {request.quantity || 1}
                </td>

                <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                  {request.inventory_status || "waiting"}
                </td>

                <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                  {request.dispatch_status || "waiting"}
                </td>

                <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                  {request.rr_status || "waiting"}
                </td>

                <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                  {request.qa_status || "pending"}
                </td>

                <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                  {request.lifecycle_status || "requested"}
                </td>

                <td className="p-3 border border-white/10 no-print">
                  <div className="flex flex-wrap gap-2">
                    {canDoInventoryAction(request, "send_to_rr", user) && (
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, action: "rr" })}>
                        Send To RR For Testing
                      </Button>
                    )}

                    {canDoInventoryAction(request, "receive_rr_return", user) && (
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: request.id, action: "return_stock" })}
                      >
                        Receive RR Return
                      </Button>
                    )}

                    {canDoInventoryAction(request, "dispatch_to_engineer", user) &&
                      request.finance_status !== "disbursed" &&
                      normalize(request.finance_status) !== "pending_review" &&
                      normalize(request.dispatch_status) !== "pending_finance" && (
                        <Button
                          size="sm"
                          className="bg-yellow-600 hover:bg-yellow-700 text-white"
                          disabled={mutation.isPending}
                          onClick={() => setFundOpen(fundOpen === request.id ? null : request.id)}
                        >
                          Request Dispatch Fund
                        </Button>
                      )}

                    {canDoInventoryAction(request, "dispatch_to_engineer", user) &&
                      (normalize(request.finance_status) === "pending_review" ||
                        normalize(request.dispatch_status) === "pending_finance") && (
                        <span className="px-3 py-1 rounded-md bg-yellow-500/20 text-yellow-200 text-xs font-semibold border border-yellow-400/30">
                          Fund Pending Finance
                        </span>
                      )}

                    {canDoInventoryAction(request, "dispatch_to_engineer", user) &&
                      normalize(request.finance_status) === "approved" && (
                        <span className="px-3 py-1 rounded-md bg-purple-500/20 text-purple-200 text-xs font-semibold border border-purple-400/30">
                          Awaiting Disbursement
                        </span>
                      )}

                    {canDoInventoryAction(request, "dispatch_to_engineer", user) &&
                      request.finance_status === "disbursed" && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ id: request.id, action: "dispatch" })}
                        >
                          Dispatch To Engineer
                        </Button>
                      )}

                    {canDoInventoryAction(request, "mark_out_of_stock", user) && (
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, action: "out_stock" })}>
                        Out Stock
                      </Button>
                    )}

                    {canDoInventoryAction(request, "reject_inventory", user) && (
                      <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, action: "reject" })}>
                        Reject
                      </Button>
                    )}

                    <Button size="sm" variant="outline" className="bg-white text-[#102969] hover:bg-blue-50" onClick={() => setExpanded(expanded === request.id ? null : request.id)}>
                      {expanded === request.id ? "Hide" : "View"}
                    </Button>
                  </div>
                </td>
              </tr>

              {fundOpen === request.id && (
                <tr className="no-print bg-[#08153d] text-white">
                  <td colSpan={11} className="p-4 border border-white/10">
                    <div className="rounded-xl border border-yellow-400/30 bg-[#102969] p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-yellow-200">Request Dispatch Fund</h3>
                        <p className="text-xs text-blue-100">
                          Enter the amount Inventory needs from Accounts before this part can be dispatched.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-blue-100">Amount Required (₦)</label>
                          <Input
                            type="number"
                            min="0"
                            className="mt-1 bg-[#08153d] border-white/20 text-white placeholder:text-slate-300"
                            placeholder="e.g. 7500"
                            value={getFundForm(request).requested_amount}
                            onChange={(e) =>
                              updateFundForm(request, "requested_amount", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className="text-xs text-blue-100">Logistics Type</label>
                          <select
                            className="mt-1 h-10 w-full rounded-md bg-[#08153d] border border-white/20 px-3 text-sm text-white"
                            value={getFundForm(request).logistics_type}
                            onChange={(e) =>
                              updateFundForm(request, "logistics_type", e.target.value)
                            }
                          >
                            <option value="waybill">Waybill</option>
                            <option value="courier">Courier</option>
                            <option value="transport">Transport</option>
                            <option value="fuel">Fuel</option>
                            <option value="dispatch_rider">Dispatch Rider</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-blue-100">Destination</label>
                          <Input
                            className="mt-1 bg-[#08153d] border-white/20 text-white placeholder:text-slate-300"
                            placeholder="Destination / branch / location"
                            value={getFundForm(request).destination}
                            onChange={(e) =>
                              updateFundForm(request, "destination", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className="text-xs text-blue-100">Reason / Note</label>
                          <Input
                            className="mt-1 bg-[#08153d] border-white/20 text-white placeholder:text-slate-300"
                            placeholder="Reason for fund request"
                            value={getFundForm(request).reason}
                            onChange={(e) =>
                              updateFundForm(request, "reason", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-[#ff5a00] hover:bg-[#e24f00] text-white"
                          disabled={mutation.isPending}
                          onClick={() => submitFundRequest(request)}
                        >
                          Submit Fund Request
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white text-[#102969] hover:bg-blue-50"
                          onClick={() => setFundOpen(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {expanded === request.id && (
                <tr className="no-print bg-[#08153d] text-white">
                  <td colSpan={11} className="p-4 border border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <div className="border border-white/10 rounded p-3 bg-[#102969]">
                        <strong>Operations</strong>
                        <p className="text-blue-100">{request.operations_status || "Waiting"}</p>
                      </div>

                      <div className="border border-white/10 rounded p-3 bg-[#102969]">
                        <strong>Inventory</strong>
                        <p className="text-blue-100">{request.inventory_status || "Waiting"}</p>
                      </div>

                      <div className="border border-white/10 rounded p-3 bg-[#102969]">
                        <strong>Dispatch</strong>
                        <p className="text-blue-100">{request.dispatch_status || "Waiting"}</p>
                      </div>

                      <div className="border border-white/10 rounded p-3 bg-[#102969]">
                        <strong>RR</strong>
                        <p className="text-blue-100">{request.rr_status || "Waiting"}</p>
                      </div>

                      <div className="border border-white/10 rounded p-3 bg-[#102969]">
                        <strong>QA</strong>
                        <p className="text-blue-100">{request.qa_status || "Pending"}</p>
                      </div>

                      <div className="border border-white/10 rounded p-3 bg-[#102969]">
                        <strong>Finance</strong>
                        <p className="text-blue-100">{getFinanceLabel(request)}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConsumableTable({ rows, mutation, user }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[#ff5a00] text-white print:bg-[#102969]">
          <tr>
            <th className="text-left p-3 border border-white/20">Date</th>
            <th className="text-left p-3 border border-white/20">Repair Job</th>
            <th className="text-left p-3 border border-white/20">Module</th>
            <th className="text-left p-3 border border-white/20">Consumable</th>
            <th className="text-left p-3 border border-white/20">Qty</th>
            <th className="text-left p-3 border border-white/20">Reason</th>
            <th className="text-left p-3 border border-white/20">HOD</th>
            <th className="text-left p-3 border border-white/20">Inventory</th>
            <th className="text-left p-3 border border-white/20 no-print">Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((request, index) => {
            const requestItems = Array.isArray(request.items) ? request.items : [];

            const consumableNames =
              requestItems.length > 0
                ? requestItems.map((item) => item.item_name).join(", ")
                : "N/A";

            const quantities =
              requestItems.length > 0
                ? requestItems.map((item) => item.quantity).join(", ")
                : "N/A";

            const reasons =
              requestItems.length > 0
                ? requestItems.map((item) => item.reason || "N/A").join(", ")
                : request.notes || "N/A";

            const hodLabel =
              request.status === "pending_inventory"
                ? "APPROVED"
                : request.status === "pending_hod"
                ? "WAITING HOD"
                : request.status === "rejected_by_hod"
                ? "REJECTED"
                : "N/A";

            const inventoryLabel =
              request.status === "pending_inventory"
                ? "WAITING RELEASE"
                : request.status === "released"
                ? "RELEASED"
                : request.status === "out_of_stock"
                ? "OUT OF STOCK"
                : request.status || "WAITING";

            const canRelease = request.status === "pending_inventory";
            const canOutStock = request.status === "pending_inventory";

            return (
              <tr
                key={request.id}
                className={`text-white ${
                  index % 2 === 0 ? "bg-[#102969]" : "bg-[#0b1f5e]"
                } hover:bg-[#173b9a] print:text-[#102969] print:bg-white`}
              >
                <td className="p-3 border border-white/10 print:border-slate-300">
                  {request.created_at
                    ? new Date(request.created_at).toLocaleDateString()
                    : "N/A"}
                </td>

                <td className="p-3 border border-white/10 print:border-slate-300">
                  {request.job_number || request.repair_job_id || "N/A"}
                </td>

                <td className="p-3 border border-white/10 print:border-slate-300">
                  {request.module_name || "N/A"}
                </td>

                <td className="p-3 border border-white/10 font-semibold print:border-slate-300">
                  {consumableNames}
                </td>

                <td className="p-3 border border-white/10 print:border-slate-300">
                  {quantities}
                </td>

                <td className="p-3 border border-white/10 print:border-slate-300">
                  {reasons}
                </td>

                <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                  {hodLabel}
                </td>

                <td className="p-3 border border-white/10 uppercase text-xs font-semibold print:border-slate-300">
                  {inventoryLabel}
                </td>

                <td className="p-3 border border-white/10 no-print">
                  {canRelease || canOutStock ? (
                    <div className="flex flex-wrap gap-2">
                      {canRelease && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              request,
                              action: "release",
                            })
                          }
                        >
                          Release
                        </Button>
                      )}

                      {canOutStock && (
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              request,
                              action: "out_stock",
                            })
                          }
                        >
                          Out Stock
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-blue-100 text-xs uppercase">
                      {request.status || "No Action"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
