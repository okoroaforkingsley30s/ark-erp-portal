export const ROLE_ALIASES = {
  super_admin: "admin",
  administrator: "admin",
  operation: "operations",
  ops: "operations",
  account: "finance",
  accounts: "finance",
  rr_hod: "repair_head",
  repair_hod: "repair_head",
  rr_head: "repair_head",
  field_engineer: "engineer",
  fe: "engineer",
};

export function normalizeRole(role) {
  const clean = String(role || "").toLowerCase().trim();
  return ROLE_ALIASES[clean] || clean;
}

export const PERMISSIONS = {
  // Core
  DASHBOARD: "dashboard",
  REPORTS: "reports",
  AUDIT_LOGS: "audit_logs",
  SETTINGS: "settings",
  USER_MANAGEMENT: "user_management",
  STAFF_DIRECTORY: "staff_directory",
  NOTIFICATIONS: "notifications",

  // Communication
  COMMUNICATION: "communication",
  OFFICIAL_MAIL: "official_mail",
  ARK_CONNECT: "ark_connect",

  // Tickets / Helpdesk
  TICKETS: "tickets",
  CREATE_TICKET: "create_ticket",
  ASSIGN_TICKET: "assign_ticket",
  CLOSE_TICKET: "close_ticket",
  SLA_ANALYTICS: "sla_analytics",

  // Field Engineering
  ENGINEERING: "engineering",
  FIELD_OPS: "field_ops",
  FIELD_ENGINEERS: "field_engineers",
  PARTS_REQUEST: "parts_request",
  ENGINEER_RECEIVE_PART: "engineer_receive_part",

  // Operations
  OPERATIONS: "operations",
  OPS_DASHBOARD: "ops_dashboard",
  OPERATIONS_FEED: "operations_feed",
  OPERATIONS_PART_REQUESTS: "operations_part_requests",
  APPROVE_PART_REQUEST: "approve_part_request",
  REJECT_PART_REQUEST: "reject_part_request",
  SEND_TO_INVENTORY: "send_to_inventory",

  // Inventory
INVENTORY: "inventory",
INVENTORY_ANALYTICS: "inventory_analytics",
INVENTORY_PART_REQUESTS: "inventory_part_requests",
SPARE_PARTS: "spare_parts",

  // RR
  RR_INTAKE: "rr_intake",
  REPAIR_JOBS: "repair_jobs",
  RR_CONSUMABLES: "rr_consumables",
  RECEIVE_RR: "receive_rr",
  ASSIGN_RR_TECHNICIAN: "assign_rr_technician",
  START_REPAIR: "start_repair",
  REQUEST_CONSUMABLES: "request_consumables",
  SUBMIT_QA: "submit_qa",
  QA_PASS: "qa_pass",
  QA_FAIL: "qa_fail",
  RETURN_TO_INVENTORY: "return_to_inventory",
  SCRAP_PART: "scrap_part",
  SELL_PART: "sell_part",

  // Finance / Account
  FINANCE: "finance",
  ACCOUNT: "account",
  FUND_REQUESTS: "fund_requests",
  APPROVE_PAYMENT: "approve_payment",
  RELEASE_FUND: "release_fund",
  VENDOR_PAYMENT: "vendor_payment",

  // Procurement
  PROCUREMENT: "procurement",
  PURCHASE_ORDERS: "purchase_orders",
  CREATE_PURCHASE_REQUEST: "create_purchase_request",
  APPROVE_PURCHASE_REQUEST: "approve_purchase_request",

  // CRM / Business
  BUSINESS: "business",
  CRM: "crm",
  CLIENT_FOLLOW_UP: "client_follow_up",

  // HR
  HR: "hr",

  // Assets / Devices
  ASSETS_SECTION: "assets_section",
  ASSETS: "assets",
  BANKS: "banks",
  BRANCHES: "branches",
  DEVICES: "devices",
  DEVICE_STATUS: "device_status",
  ASSIGNMENTS: "assignments",
  LIVE_MAP: "live_map",
  SITE_MONITOR: "site_monitor",
  REGIONAL_VIEW: "regional_view",

  // Printing
  PRINT_OFFICIAL_REPORT: "print_official_report",
  PRINT_TICKET_REPORT: "print_ticket_report",
  PRINT_OPERATIONS_REPORT: "print_operations_report",
  PRINT_INVENTORY_REPORT: "print_inventory_report",
  PRINT_RR_REPORT: "print_rr_report",
  PRINT_FINANCE_REPORT: "print_finance_report",
  PRINT_HR_REPORT: "print_hr_report",
  PRINT_CRM_REPORT: "print_crm_report",
  PRINT_OWN_JOB_REPORT: "print_own_job_report",
};

export const ROLE_ACCESS = {
  admin: ["*"],

 ceo: [
  "dashboard", "fund_requests", "live_map", "business", "finance", "reports", "tickets",
    "site_monitor", "assets_section", "assets", "notifications",
    "communication", "official_mail", "ark_connect", "operations_feed",
    "ops_dashboard", "inventory", "repair_jobs", "rr_intake",
    "rr_consumables", "staff_directory", "audit_logs",
    "print_official_report", "print_ticket_report", "print_operations_report",
    "print_inventory_report", "print_rr_report", "print_finance_report",
    "print_crm_report",
  ],

  ceo_pa: [
    "dashboard", "fund_requests", "reports", "notifications", "communication",
    "official_mail", "ark_connect", "print_official_report",
  ],

  agm: [
    "dashboard", "fund_requests", "live_map", "tickets", "site_monitor", "engineering",
    "field_ops", "operations", "ops_dashboard", "operations_feed",
    "operations_part_requests", "approve_part_request", "reject_part_request",
    "send_to_inventory", "banks", "branches", "devices", "device_status",
    "assignments", "regional_view", "field_engineers", "assets_section",
    "assets", "inventory", "inventory_part_requests", "purchase_orders", "business",
    "hr", "reports", "notifications", "communication", "official_mail",
    "ark_connect", "repair_jobs", "rr_intake", "rr_consumables",
    "staff_directory", "audit_logs", "print_official_report",
    "print_ticket_report", "print_operations_report", "print_inventory_report",
    "print_rr_report", "print_finance_report", "print_hr_report",
  ],

  manager: [
    "dashboard", "fund_requests", "live_map", "tickets", "site_monitor", "engineering",
    "field_ops", "operations", "ops_dashboard", "operations_feed",
    "operations_part_requests", "approve_part_request", "reject_part_request",
    "send_to_inventory", "banks", "branches", "devices", "device_status",
    "assignments", "regional_view", "field_engineers", "assets_section",
    "assets", "inventory", "inventory_part_requests", "purchase_orders", "business",
    "hr", "reports", "data_import", "notifications", "communication",
    "official_mail", "ark_connect", "repair_jobs", "rr_intake",
    "rr_consumables", "print_official_report", "print_ticket_report",
    "print_operations_report", "print_inventory_report", "print_rr_report",
    "print_finance_report",
  ],

  operations: [
    "dashboard", "fund_requests", "operations", "ops_dashboard", "operations_feed",
    "operations_part_requests", "tickets", "field_ops", "purchase_orders", "reports",
    "approve_part_request", "reject_part_request", "send_to_inventory",
    "print_operations_report", "print_ticket_report", "notifications",
    "communication", "official_mail", "ark_connect",
  ],

  helpdesk: [
    "dashboard", "fund_requests", "sla_analytics", "live_map", "tickets", "create_ticket",
    "assign_ticket", "close_ticket", "site_monitor", "engineering",
    "field_ops", "operations", "ops_dashboard", "operations_feed",
    "banks", "branches", "devices", "device_status", "assignments",
    "regional_view", "field_engineers", "assets_section", "assets",
    "reports", "print_ticket_report", "notifications", "communication",
    "official_mail", "ark_connect",
  ],

  engineer: [
    "dashboard", "fund_requests", "tickets", "field_ops", "engineering", "assets_section",
    "assets", "parts_request", "engineer_receive_part", "print_own_job_report",
    "notifications", "communication", "official_mail", "ark_connect",
  ],

  repair_head: [
    "dashboard", "fund_requests", "tickets", "repair_jobs", "rr_intake", "rr_consumables",
    "operations_feed", "receive_rr", "assign_rr_technician", "qa_pass",
    "qa_fail", "return_to_inventory", "scrap_part", "sell_part",
    "print_rr_report", "reports", "notifications", "communication",
    "official_mail", "ark_connect",
  ],

  repair_technician: [
    "dashboard", "fund_requests", "repair_jobs", "rr_consumables", "operations_feed",
    "start_repair", "request_consumables", "submit_qa", "print_own_job_report",
    "notifications", "communication", "official_mail", "ark_connect",
  ],

  inventory: [
  "dashboard", "fund_requests",
  "assets_section",
  "assets",

  "inventory",
  "inventory_analytics",
  "spare_parts",
  "inventory_part_requests",

  "purchase_orders",

  "parts_request",
  "send_to_rr",
  "receive_from_rr",
  "dispatch_to_engineer",
  "stock_adjustment",

  "rr_consumables",
  "operations_feed",

  "print_inventory_report",

  "notifications",
  "communication",
  "official_mail",
  "ark_connect",
],

  finance: [
    "dashboard", "business", "finance", "account", "fund_requests",
    "approve_payment", "release_fund", "vendor_payment", "operations_feed",
    "print_finance_report", "notifications", "communication",
    "official_mail", "ark_connect",
  ],

  procurement: [
    "dashboard", "fund_requests", "business", "procurement", "purchase_orders",
    "create_purchase_request", "operations_feed", "notifications",
    "communication", "official_mail", "ark_connect",
  ],

  crm: [
    "dashboard", "fund_requests", "business", "crm", "client_follow_up", "tickets",
    "operations_feed", "print_crm_report", "notifications", "communication",
    "official_mail", "ark_connect",
  ],

  hr: [
    "dashboard", "fund_requests", "hr", "staff_directory", "purchase_orders", "print_hr_report",
    "notifications", "communication", "official_mail", "ark_connect",
  ],

  client: [
    "dashboard", "tickets", "notifications", "ark_connect",
  ],
};

export const ROLE_HOME = {
  admin: "/dashboard",
  ceo: "/dashboard",
  ceo_pa: "/dashboard",
  agm: "/dashboard",
  manager: "/dashboard",
  operations: "/operations/part-requests",
  helpdesk: "/tickets",
  engineer: "/tickets",
  repair_head: "/rr-part-requests",
  repair_technician: "/repair-jobs",
  inventory: "/inventory/part-requests",
  finance: "/finance",
  procurement: "/procurement",
  crm: "/crm",
  hr: "/hr",
  client: "/tickets",
};

export const ROLE_LABELS = {
  admin: "Administrator",
  ceo: "CEO",
  ceo_pa: "CEO Personal Assistant",
  agm: "Asst. General Manager",
  manager: "Operational Manager",
  operations: "Operations",
  helpdesk: "Help Desk",
  engineer: "Field Engineer",
  repair_head: "Head of Repair & Refurbish",
  repair_technician: "Repair Technician",
  inventory: "Inventory",
  finance: "Finance / Accounts",
  procurement: "Procurement",
  crm: "CRM / Marketing",
  hr: "Human Resource",
  client: "Client / Bank",
};

export const ROUTE_PERMISSIONS = {
  "/dashboard": "dashboard",
  "/fund-requests": "fund_requests",
  "/tickets": "tickets",
  "/ticket": "tickets",
  "/operations": "operations",
  "/operations-feed": "operations_feed",
  "/operations/part-requests": "operations_part_requests",
  "/inventory": "inventory",
  "/inventory/part-requests": "inventory_part_requests",
  "/spare-parts": "spare_parts",
"/inventory-analytics": "inventory_analytics",
"/procurement-lpo": "purchase_orders",
"/parts": "parts_request",
  "/rr-part-requests": "rr_intake",
  "/repair-jobs": "repair_jobs",
  "/rr-consumable-requests": "rr_consumables",
  "/finance": "finance",
  "/procurement": "procurement",
  "/crm": "crm",
  "/hr": "hr",
  "/reports": "reports",
  "/live-map": "live_map",
  "/site-monitor": "site_monitor",
  "/assets": "assets",
  "/banks": "banks",
  "/branches": "branches",
  "/devices": "devices",
  "/device-status": "device_status",
  "/user-management": "user_management",
  "/staff-directory": "staff_directory",
  "/audit-logs": "audit_logs",
  "/settings": "settings",
  "/notifications": "notifications",
  "/official-mail": "official_mail",
  "/ark-connect": "ark_connect",
};

export function canAccess(role, permission) {
  if (!role || !permission) return false;
  const normalizedRole = normalizeRole(role);
  const access = ROLE_ACCESS[normalizedRole];
  if (!access) return false;
  if (access.includes("*")) return true;
  return access.includes(permission);
}

export function canUserAccess(user, permission) {
  const role =
    user?.role ||
    user?.user_role ||
    user?.position ||
    user?.profile?.role ||
    "";

  return canAccess(role, permission);
}

export function hasAnyAccess(role, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((permission) => canAccess(role, permission));
}

export function getRoleHome(role) {
  return ROLE_HOME[normalizeRole(role)] || "/dashboard";
}

export function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || normalizeRole(role) || "User";
}

export function isAdmin(role) {
  return normalizeRole(role) === "admin";
}

export function isExecutive(role) {
  return ["admin", "ceo", "agm", "manager"].includes(normalizeRole(role));
}

export function isExecutiveRole(role) {
  return isExecutive(role);
}

export function isOperationsRole(role) {
  return ["admin", "operations", "helpdesk", "agm", "manager"].includes(normalizeRole(role));
}

export function isInventoryRole(role) {
  return ["admin", "inventory", "agm", "manager"].includes(normalizeRole(role));
}

export function isRRHeadRole(role) {
  return ["admin", "repair_head", "agm", "manager"].includes(normalizeRole(role));
}

export function isRRTechnicianRole(role) {
  return normalizeRole(role) === "repair_technician";
}

export function isFinanceRole(role) {
  return ["admin", "finance", "agm", "manager", "ceo"].includes(normalizeRole(role));
}

export function canPrint(role, printPermission = "print_official_report") {
  return canAccess(role, printPermission);
}

export function isPendingUser(user) {
  return (
    !user?.role ||
    user?.status === "pending" ||
    user?.approval_status === "pending" ||
    user?.is_approved === false
  );
}