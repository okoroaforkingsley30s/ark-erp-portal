// src/lib/workflowRules.js

export const WORKFLOW_STATUS = {
  NEW: "new",
  ASSIGNED: "assigned",
  ACCEPTED: "accepted",
  TRAVELING: "traveling",
  ARRIVED: "arrived",
  IN_PROGRESS: "in_progress",
  PENDING_PART: "pending_part",
  PENDING_REVIEW: "pending_review",
  CLOSED: "closed",

  PENDING_OPERATIONS: "pending_operations",
  APPROVED_OPERATIONS: "approved_operations",
  REJECTED_OPERATIONS: "rejected_operations",

  SENT_TO_INVENTORY: "sent_to_inventory",
  PENDING_INVENTORY: "pending_inventory",
  INVENTORY_CHECKED: "inventory_checked",
  OUT_OF_STOCK: "out_of_stock",
  REJECTED_INVENTORY: "rejected_inventory",

  SENT_TO_RR: "sent_to_rr",
  ISSUED_TO_RR: "issued_to_rr",
  TRANSFERRED_RR: "transferred_rr",
  PENDING_RR: "pending_rr",
  RECEIVED_BY_RR: "received_by_rr",
  ASSIGNED_TO_RR_TECHNICIAN: "assigned_to_rr_technician",
  RR_TESTING: "rr_testing",

  UNDER_REPAIR: "under_repair",
  REFURBISHING: "refurbishing",
  AWAITING_CONSUMABLES: "awaiting_consumables",
  AWAITING_PARTS: "awaiting_parts",
  WAITING_PARTS: "waiting_parts",
  TESTING: "testing",
  WAITING_QA: "waiting_qa",
  QA_PASSED: "qa_passed",
  QA_FAILED: "qa_failed",

  RETURNED_TO_INVENTORY: "returned_to_inventory",
  RETURNED_INVENTORY: "returned_inventory",
  RR_VERIFIED: "rr_verified",
  READY_FOR_DISPATCH: "ready_for_dispatch",
  DISPATCHED_TO_ENGINEER: "dispatched_to_engineer",
  DISPATCHED: "dispatched",
  RECEIVED_BY_ENGINEER: "received_by_engineer",
  USED: "used",

  ENGINEER_COMPLETED: "engineer_completed",
  HELPDESK_CLOSED: "helpdesk_closed",
  COMPLETED: "completed",

  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  ISSUED: "issued",
  RELEASED: "released",
  SCRAPPED: "scrapped",
  SCRAP: "scrap",
  SOLD: "sold",
};

export function normalizeStatus(value) {
  const status = String(value || "").toLowerCase().trim();
  const aliases = {
    assigned_to_rr_tech: "assigned_to_rr_technician",
    rr_assigned: "assigned",
    under_repair: "refurbishing",
    waiting_qa: "testing",
    returned_to_inventory: "returned_inventory",
    scrapped: "scrap",
  };
  return aliases[status] || status;
}

export function firstStatus(...values) {
  const found = values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
  );

  return normalizeStatus(found);
}

export function workflowCan(allowedActions, currentState, action) {
  if (!allowedActions || !currentState || !action) return false;

  return (
    allowedActions[normalizeStatus(currentState)]?.includes(action) || false
  );
}

export const OPERATION_ALLOWED_ACTIONS = {
  pending_operations: [
    "approve",
    "reject",
    "approve_operations",
    "reject_operations",
  ],
  pending: ["approve", "reject", "approve_operations", "reject_operations"],
  pending_review: ["approve", "reject", "approve_operations", "reject_operations"],
  inventory_returned_to_operations: ["approve", "reject", "approve_operations", "reject_operations"],
  waiting: ["approve", "reject", "approve_operations", "reject_operations"],
  requested: ["approve", "reject", "approve_operations", "reject_operations"],
  submitted: ["approve", "reject", "approve_operations", "reject_operations"],
  new: ["approve", "reject", "approve_operations", "reject_operations"],

  approved_operations: ["send_to_inventory", "send_inventory"],
  approved: ["send_to_inventory", "send_inventory"],

  sent_to_inventory: [],
  pending_inventory: [],
  rejected_operations: [],
  rejected: [],
};

export const OPERATIONS_ALLOWED_ACTIONS = OPERATION_ALLOWED_ACTIONS;

export function getOperationState(request) {
  if (!request) return "pending_operations";

  const status = firstStatus(
    request.operations_status,
    request.status,
    request.inventory_status
  );

  if (
    status === "pending_review" ||
    status === "pending_operations" ||
    status === "inventory_returned_to_operations" ||
    normalizeStatus(request.inventory_status) === "returned_to_operations"
  ) {
    return "pending_operations";
  }

  if (status === "rejected_operations" || status === "rejected") {
    return "rejected_operations";
  }

  if (status === "sent_to_inventory" || status === "pending_inventory") {
    return "sent_to_inventory";
  }

  if (status === "approved_operations" || status === "approved") {
    return "approved_operations";
  }

  return "pending_operations";
}

export function canDoOperationAction(request, action) {
  return workflowCan(
    OPERATION_ALLOWED_ACTIONS,
    getOperationState(request),
    action
  );
}

export function canDoOperationsAction(request, action) {
  return canDoOperationAction(request, action);
}

export const INVENTORY_ALLOWED_ACTIONS = {
  sent_to_inventory: [
    "check_stock",
    "send_to_rr",
    "mark_out_of_stock",
    "reject_inventory",
  ],
  pending_inventory: [
    "check_stock",
    "send_to_rr",
    "mark_out_of_stock",
    "reject_inventory",
  ],
  inventory_checked: ["send_to_rr", "mark_out_of_stock", "reject_inventory"],

  transferred_rr: [],
  pending_rr: [],
  issued_to_rr: [],
  sent_to_rr_waiting_rr: [],

  qa_passed: ["receive_rr_return", "mark_ready_for_dispatch", "return_to_inventory"],
  returned_inventory: ["receive_rr_return", "mark_ready_for_dispatch"],
  returned_to_inventory: ["receive_rr_return", "mark_ready_for_dispatch"],

  rr_verified: ["dispatch_to_engineer"],
  ready: ["dispatch_to_engineer"],
  ready_for_dispatch: ["dispatch_to_engineer"],

  dispatched: [],
  dispatched_to_engineer: [],
  out_of_stock: [],
  waiting_stock: [],
  rejected_inventory: [],
  rejected: [],
};

export function getInventoryState(request) {
  if (!request) return null;

  const dispatchStatus = normalizeStatus(request.dispatch_status);
  const inventoryStatus = normalizeStatus(request.inventory_status);
  const lifecycleStatus = normalizeStatus(request.lifecycle_status);
  const rrStatus = normalizeStatus(request.rr_status);
  const qaStatus = normalizeStatus(request.qa_status);
  const status = normalizeStatus(request.status);

  if (
    dispatchStatus === "dispatched" ||
    status === "dispatched" ||
    lifecycleStatus === "dispatched_to_engineer" ||
    status === "dispatched_to_engineer"
  ) {
    return "dispatched_to_engineer";
  }

  if (
    dispatchStatus === "ready" ||
    dispatchStatus === "ready_for_dispatch" ||
    status === "ready_for_dispatch" ||
    lifecycleStatus === "ready_for_dispatch"
  ) {
    return "ready_for_dispatch";
  }

  if (
    inventoryStatus === "rr_verified" ||
    inventoryStatus === "returned_to_inventory" ||
    inventoryStatus === "returned_inventory" ||
    lifecycleStatus === "returned_to_inventory" ||
    rrStatus === "returned_inventory" ||
    rrStatus === "returned_to_inventory" ||
    (qaStatus === "passed" && rrStatus.includes("returned"))
  ) {
    return "returned_to_inventory";
  }

  if (rrStatus === "qa_passed" || qaStatus === "passed" || status === "qa_passed") {
    return "qa_passed";
  }

  if (
    inventoryStatus === "transferred_rr" ||
    inventoryStatus === "pending_rr" ||
    rrStatus === "pending_rr" ||
    lifecycleStatus === "issued_to_rr" ||
    status === "pending_rr" ||
    status === "sent_to_rr"
  ) {
    return "pending_rr";
  }

  if (inventoryStatus === "inventory_checked") return "inventory_checked";

  if (
    inventoryStatus === "sent_to_inventory" ||
    inventoryStatus === "pending" ||
    inventoryStatus === "waiting" ||
    status === "pending_inventory" ||
    status === "sent_to_inventory" ||
    status === "approved_operations"
  ) {
    return "sent_to_inventory";
  }

  if (inventoryStatus === "out_of_stock" || status === "waiting_stock") {
    return "out_of_stock";
  }

  if (inventoryStatus === "rejected" || status === "rejected_inventory") {
    return "rejected_inventory";
  }

  return inventoryStatus || lifecycleStatus || rrStatus || status || null;
}

export function canDoInventoryAction(request, action) {
  return workflowCan(
    INVENTORY_ALLOWED_ACTIONS,
    getInventoryState(request),
    action
  );
}

export const RR_ALLOWED_ACTIONS = {
  pending_rr: ["receive_rr", "receive"],
  sent_to_rr: ["receive_rr", "receive"],
  issued_to_rr: ["receive_rr", "receive"],
  transferred_rr: ["receive_rr", "receive"],

  received_by_rr: ["assign_technician", "assign", "test_part", "test"],
  received: ["assign_technician", "assign", "test_part", "test"],

  assigned_to_rr_technician: ["start_repair", "test_part", "test"],
  assigned: ["start_repair", "test_part", "test"],

  under_repair: ["request_consumable", "send_qa", "qa_pass", "qa_fail"],
  refurbishing: ["request_consumable", "send_qa", "qa_pass", "qa_fail"],
  awaiting_consumables: ["request_consumable"],
  awaiting_parts: ["request_consumable"],
  waiting_parts: ["request_consumable"],

  rr_testing: ["qa_pass", "qa_fail"],
  testing: ["qa_pass", "qa_fail"],
  waiting_qa: ["qa_pass", "qa_fail"],

  qa_failed: ["assign_technician", "assign", "start_repair", "scrap"],
  qa_passed: ["return_inventory", "return_to_inventory"],

  returned_inventory: [],
  returned_to_inventory: [],
  ready_for_dispatch: [],
  dispatched_to_engineer: [],
  completed: [],
  scrapped: [],
  scrap: [],
  sold: [],
};

export function getRRState(request) {
  if (!request) return null;

  const rrStatus = normalizeStatus(request.rr_status);
  const lifecycleStatus = normalizeStatus(request.lifecycle_status);
  const status = normalizeStatus(request.status);
  const qaStatus = normalizeStatus(request.qa_status);
  const inventoryStatus = normalizeStatus(request.inventory_status);

  if (rrStatus) return rrStatus;
  if (lifecycleStatus) return lifecycleStatus;

  if (
    inventoryStatus === "transferred_rr" ||
    inventoryStatus === "pending_rr" ||
    lifecycleStatus === "issued_to_rr" ||
    status === "pending_rr" ||
    status === "sent_to_rr"
  ) {
    return "pending_rr";
  }

  if (qaStatus === "passed") return "qa_passed";
  if (qaStatus === "failed") return "qa_failed";

  return status || null;
}

export function canDoRRAction(request, action) {
  return workflowCan(RR_ALLOWED_ACTIONS, getRRState(request), action);
}

export function canDoRRPartAction(request, action) {
  return canDoRRAction(request, action);
}

export const RR_CONSUMABLE_ALLOWED_ACTIONS = {
  pending_inventory: [
    "release",
    "release_consumable",
    "out_of_stock",
    "mark_out_of_stock",
    "reject",
  ],
  pending: [
    "release",
    "release_consumable",
    "out_of_stock",
    "mark_out_of_stock",
    "reject",
  ],
  waiting_inventory: [
    "release",
    "release_consumable",
    "out_of_stock",
    "mark_out_of_stock",
    "reject",
  ],
  approved: ["release", "release_consumable", "out_of_stock", "mark_out_of_stock"],
  released: [],
  issued: [],
  out_of_stock: [],
  rejected: [],
  rejected_by_hod: [],
};

export function getConsumableState(request) {
  if (!request) return "pending_inventory";

  const status = firstStatus(
    request.status,
    request.inventory_status,
    request.approval_status,
    request.hod_status
  );

  if (status === "pending_inventory" || status === "pending") {
    return "pending_inventory";
  }

  if (status === "released" || status === "issued") return "released";
  if (status === "out_of_stock") return "out_of_stock";
  if (status === "rejected" || status === "rejected_by_hod") return "rejected";

  return status || "pending_inventory";
}

export function canDoRRConsumableAction(request, action) {
  return workflowCan(
    RR_CONSUMABLE_ALLOWED_ACTIONS,
    getConsumableState(request),
    action
  );
}

export function canDoConsumableAction(request, action) {
  return canDoRRConsumableAction(request, action);
}

export function getWorkflowStepLabel(state) {
  return state ? String(state).replaceAll("_", " ").toUpperCase() : "UNKNOWN";
}
// @ts-check
