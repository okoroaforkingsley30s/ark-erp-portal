export const ROLE_ALIASES = {
  super_admin: "system_admin",
  developer_admin: "system_admin",
  erp_admin: "system_admin",
  system_administrator: "system_admin",

  administrator: "admin",
  administrative_officer: "admin",

  ceo_pa: "admin_head",
  ceopa: "admin_head",
  admin_hod: "admin_head",
  head_admin: "admin_head",
  head_of_admin: "admin_head",
  head_of_administration: "admin_head",

  operation: "operations",
  ops: "operations",
  operations_officer: "operations",
  operations_manager: "manager",

  account: "finance",
  accounts: "finance",
  accountant: "finance",
  account_officer: "finance",
  finance_officer: "finance",
  accounts_head: "head_of_account",
  head_account: "head_of_account",
  head_accounts: "head_of_account",
  head_of_accounts: "head_of_account",

  it_officer: "it",
  head_it: "head_of_it",
  it_head: "head_of_it",

  rr_hod: "repair_head",
  repair_hod: "repair_head",
  rr_head: "repair_head",
  head_of_repair: "repair_head",
  head_of_rr: "repair_head",
  repair_refurbishment_head: "repair_head",

  field_engineer: "engineer",
  fe: "engineer",

  crm: "business_developer",
  marketing: "business_developer",
  business_development: "business_developer",
  bd: "business_developer",
  business_dev: "business_developer",
  head_business_development: "head_of_business_development",
  business_development_head: "head_of_business_development",
};

export function normalizeRole(role) {
  const clean = String(role || "").toLowerCase().trim();
  return ROLE_ALIASES[clean] || clean;
}

export const PERMISSIONS = {
  DASHBOARD: "dashboard",
  REPORTS: "reports",
  AUDIT_LOGS: "audit_logs",
  SETTINGS: "settings",
  USER_MANAGEMENT: "user_management",
  USERS: "users",
  STAFF_DIRECTORY: "staff_directory",
  DEPARTMENTS: "departments",
  NOTIFICATIONS: "notifications",
  DATA_IMPORT: "data_import",

  COMMUNICATION: "communication",
  OFFICIAL_MAIL: "official_mail",
  ARK_CONNECT: "ark_connect",

  TICKETS: "tickets",
  CREATE_TICKET: "create_ticket",
  ASSIGN_TICKET: "assign_ticket",
  CLOSE_TICKET: "close_ticket",
  SLA_ANALYTICS: "sla_analytics",

  ENGINEERING: "engineering",
  FIELD_OPS: "field_ops",
  FIELD_ENGINEERS: "field_engineers",
  PARTS_REQUEST: "parts_request",
  ENGINEER_RECEIVE_PART: "engineer_receive_part",

  OPERATIONS: "operations",
  OPS_DASHBOARD: "ops_dashboard",
  OPERATIONS_FEED: "operations_feed",
  OPERATIONS_PART_REQUESTS: "operations_part_requests",
  APPROVE_PART_REQUEST: "approve_part_request",
  REJECT_PART_REQUEST: "reject_part_request",
  SEND_TO_INVENTORY: "send_to_inventory",

  INVENTORY: "inventory",
  INVENTORY_ANALYTICS: "inventory_analytics",
  INVENTORY_PART_REQUESTS: "inventory_part_requests",
  SPARE_PARTS: "spare_parts",

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

  FINANCE: "finance",
  ACCOUNT: "account",
  FUND_REQUESTS: "fund_requests",
  APPROVE_PAYMENT: "approve_payment",
  RELEASE_FUND: "release_fund",
  VENDOR_PAYMENT: "vendor_payment",

  PROCUREMENT: "procurement",
  PURCHASE_ORDERS: "purchase_orders",
  CREATE_PURCHASE_REQUEST: "create_purchase_request",
  APPROVE_PURCHASE_REQUEST: "approve_purchase_request",

  BUSINESS: "business",
  CRM: "crm",
  CLIENT_FOLLOW_UP: "client_follow_up",

  HR: "hr",

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

const COMMON_STAFF_ACCESS = [
  PERMISSIONS.DASHBOARD,
  PERMISSIONS.FUND_REQUESTS,
  PERMISSIONS.NOTIFICATIONS,
  PERMISSIONS.COMMUNICATION,
  PERMISSIONS.OFFICIAL_MAIL,
  PERMISSIONS.ARK_CONNECT,
];

const EXECUTIVE_REPORT_ACCESS = [
  PERMISSIONS.REPORTS,
  PERMISSIONS.AUDIT_LOGS,
  PERMISSIONS.PRINT_OFFICIAL_REPORT,
  PERMISSIONS.PRINT_TICKET_REPORT,
  PERMISSIONS.PRINT_OPERATIONS_REPORT,
  PERMISSIONS.PRINT_INVENTORY_REPORT,
  PERMISSIONS.PRINT_RR_REPORT,
  PERMISSIONS.PRINT_FINANCE_REPORT,
  PERMISSIONS.PRINT_HR_REPORT,
  PERMISSIONS.PRINT_CRM_REPORT,
];

export const ROLE_ACCESS = {
  system_admin: ["*"],

  ceo: ["*"],

  agm: [
    ...COMMON_STAFF_ACCESS,
    ...EXECUTIVE_REPORT_ACCESS,

    PERMISSIONS.LIVE_MAP,
    PERMISSIONS.TICKETS,
    PERMISSIONS.SLA_ANALYTICS,
    PERMISSIONS.SITE_MONITOR,

    PERMISSIONS.ENGINEERING,
    PERMISSIONS.FIELD_OPS,
    PERMISSIONS.FIELD_ENGINEERS,

    PERMISSIONS.OPERATIONS,
    PERMISSIONS.OPS_DASHBOARD,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.OPERATIONS_PART_REQUESTS,
    PERMISSIONS.APPROVE_PART_REQUEST,
    PERMISSIONS.REJECT_PART_REQUEST,
    PERMISSIONS.SEND_TO_INVENTORY,

    PERMISSIONS.BANKS,
    PERMISSIONS.BRANCHES,
    PERMISSIONS.DEVICES,
    PERMISSIONS.DEVICE_STATUS,
    PERMISSIONS.ASSIGNMENTS,
    PERMISSIONS.REGIONAL_VIEW,

    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,

    PERMISSIONS.INVENTORY,
    PERMISSIONS.INVENTORY_ANALYTICS,
    PERMISSIONS.INVENTORY_PART_REQUESTS,
    PERMISSIONS.SPARE_PARTS,

    PERMISSIONS.PURCHASE_ORDERS,
    PERMISSIONS.BUSINESS,
    PERMISSIONS.CRM,
    PERMISSIONS.HR,

    PERMISSIONS.REPAIR_JOBS,
    PERMISSIONS.RR_INTAKE,
    PERMISSIONS.RR_CONSUMABLES,

    PERMISSIONS.STAFF_DIRECTORY,
  ],

  admin_head: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.REPORTS,
    PERMISSIONS.USERS,
    PERMISSIONS.USER_MANAGEMENT,
    PERMISSIONS.STAFF_DIRECTORY,
    PERMISSIONS.DEPARTMENTS,
    PERMISSIONS.AUDIT_LOGS,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.PRINT_OFFICIAL_REPORT,
  ],

  admin: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.STAFF_DIRECTORY,
    PERMISSIONS.DEPARTMENTS,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.REPORTS,
    PERMISSIONS.PRINT_OFFICIAL_REPORT,
  ],

  head_of_it: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.USERS,
    PERMISSIONS.USER_MANAGEMENT,
    PERMISSIONS.STAFF_DIRECTORY,
    PERMISSIONS.DEPARTMENTS,
    PERMISSIONS.SETTINGS,
    PERMISSIONS.DATA_IMPORT,
    PERMISSIONS.AUDIT_LOGS,
    PERMISSIONS.REPORTS,

    PERMISSIONS.SITE_MONITOR,
    PERMISSIONS.LIVE_MAP,
    PERMISSIONS.DEVICES,
    PERMISSIONS.DEVICE_STATUS,
    PERMISSIONS.ASSIGNMENTS,
    PERMISSIONS.BANKS,
    PERMISSIONS.BRANCHES,
    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,

    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.PRINT_OFFICIAL_REPORT,
  ],

  it: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.STAFF_DIRECTORY,
    PERMISSIONS.SITE_MONITOR,
    PERMISSIONS.LIVE_MAP,
    PERMISSIONS.DEVICES,
    PERMISSIONS.DEVICE_STATUS,
    PERMISSIONS.ASSIGNMENTS,
    PERMISSIONS.BANKS,
    PERMISSIONS.BRANCHES,
    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.REPORTS,
  ],

  manager: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.LIVE_MAP,
    PERMISSIONS.TICKETS,
    PERMISSIONS.SITE_MONITOR,

    PERMISSIONS.ENGINEERING,
    PERMISSIONS.FIELD_OPS,
    PERMISSIONS.FIELD_ENGINEERS,

    PERMISSIONS.OPERATIONS,
    PERMISSIONS.OPS_DASHBOARD,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.OPERATIONS_PART_REQUESTS,
    PERMISSIONS.APPROVE_PART_REQUEST,
    PERMISSIONS.REJECT_PART_REQUEST,
    PERMISSIONS.SEND_TO_INVENTORY,

    PERMISSIONS.BANKS,
    PERMISSIONS.BRANCHES,
    PERMISSIONS.DEVICES,
    PERMISSIONS.DEVICE_STATUS,
    PERMISSIONS.ASSIGNMENTS,
    PERMISSIONS.REGIONAL_VIEW,

    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,

    PERMISSIONS.INVENTORY,
    PERMISSIONS.INVENTORY_ANALYTICS,
    PERMISSIONS.INVENTORY_PART_REQUESTS,
    PERMISSIONS.PURCHASE_ORDERS,

    PERMISSIONS.REPAIR_JOBS,
    PERMISSIONS.RR_INTAKE,
    PERMISSIONS.RR_CONSUMABLES,

    PERMISSIONS.BUSINESS,
    PERMISSIONS.HR,
    PERMISSIONS.REPORTS,
    PERMISSIONS.DATA_IMPORT,

    PERMISSIONS.PRINT_OFFICIAL_REPORT,
    PERMISSIONS.PRINT_TICKET_REPORT,
    PERMISSIONS.PRINT_OPERATIONS_REPORT,
    PERMISSIONS.PRINT_INVENTORY_REPORT,
    PERMISSIONS.PRINT_RR_REPORT,
    PERMISSIONS.PRINT_FINANCE_REPORT,
  ],

  operations: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.OPERATIONS,
    PERMISSIONS.OPS_DASHBOARD,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.OPERATIONS_PART_REQUESTS,
    PERMISSIONS.TICKETS,
    PERMISSIONS.FIELD_OPS,
    PERMISSIONS.PURCHASE_ORDERS,
    PERMISSIONS.REPORTS,
    PERMISSIONS.APPROVE_PART_REQUEST,
    PERMISSIONS.REJECT_PART_REQUEST,
    PERMISSIONS.SEND_TO_INVENTORY,
    PERMISSIONS.PRINT_OPERATIONS_REPORT,
    PERMISSIONS.PRINT_TICKET_REPORT,
  ],

  helpdesk: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.SLA_ANALYTICS,
    PERMISSIONS.LIVE_MAP,
    PERMISSIONS.TICKETS,
    PERMISSIONS.CREATE_TICKET,
    PERMISSIONS.ASSIGN_TICKET,
    PERMISSIONS.CLOSE_TICKET,
    PERMISSIONS.SITE_MONITOR,
    PERMISSIONS.ENGINEERING,
    PERMISSIONS.FIELD_OPS,
    PERMISSIONS.OPERATIONS,
    PERMISSIONS.OPS_DASHBOARD,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.BANKS,
    PERMISSIONS.BRANCHES,
    PERMISSIONS.DEVICES,
    PERMISSIONS.DEVICE_STATUS,
    PERMISSIONS.ASSIGNMENTS,
    PERMISSIONS.REGIONAL_VIEW,
    PERMISSIONS.FIELD_ENGINEERS,
    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,
    PERMISSIONS.REPORTS,
    PERMISSIONS.PRINT_TICKET_REPORT,
  ],

  engineer: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.TICKETS,
    PERMISSIONS.FIELD_OPS,
    PERMISSIONS.ENGINEERING,
    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,
    PERMISSIONS.PARTS_REQUEST,
    PERMISSIONS.ENGINEER_RECEIVE_PART,
    PERMISSIONS.PRINT_OWN_JOB_REPORT,
  ],

  repair_head: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.TICKETS,
    PERMISSIONS.REPAIR_JOBS,
    PERMISSIONS.RR_INTAKE,
    PERMISSIONS.RR_CONSUMABLES,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.RECEIVE_RR,
    PERMISSIONS.ASSIGN_RR_TECHNICIAN,
    PERMISSIONS.QA_PASS,
    PERMISSIONS.QA_FAIL,
    PERMISSIONS.RETURN_TO_INVENTORY,
    PERMISSIONS.SCRAP_PART,
    PERMISSIONS.SELL_PART,
    PERMISSIONS.REPORTS,
    PERMISSIONS.PRINT_RR_REPORT,
  ],

  repair_technician: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.REPAIR_JOBS,
    PERMISSIONS.RR_CONSUMABLES,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.START_REPAIR,
    PERMISSIONS.REQUEST_CONSUMABLES,
    PERMISSIONS.SUBMIT_QA,
    PERMISSIONS.PRINT_OWN_JOB_REPORT,
  ],

  inventory: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,
    PERMISSIONS.INVENTORY,
    PERMISSIONS.INVENTORY_ANALYTICS,
    PERMISSIONS.SPARE_PARTS,
    PERMISSIONS.INVENTORY_PART_REQUESTS,
    PERMISSIONS.PURCHASE_ORDERS,
    PERMISSIONS.PARTS_REQUEST,
    PERMISSIONS.RR_CONSUMABLES,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.PRINT_INVENTORY_REPORT,
  ],

  head_of_account: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.BUSINESS,
    PERMISSIONS.FINANCE,
    PERMISSIONS.ACCOUNT,
    PERMISSIONS.FUND_REQUESTS,
    PERMISSIONS.APPROVE_PAYMENT,
    PERMISSIONS.RELEASE_FUND,
    PERMISSIONS.VENDOR_PAYMENT,
    PERMISSIONS.PURCHASE_ORDERS,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.REPORTS,
    PERMISSIONS.AUDIT_LOGS,
    PERMISSIONS.PRINT_FINANCE_REPORT,
  ],

  finance: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.BUSINESS,
    PERMISSIONS.FINANCE,
    PERMISSIONS.ACCOUNT,
    PERMISSIONS.FUND_REQUESTS,
    PERMISSIONS.RELEASE_FUND,
    PERMISSIONS.VENDOR_PAYMENT,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.PRINT_FINANCE_REPORT,
  ],

  procurement: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.BUSINESS,
    PERMISSIONS.PROCUREMENT,
    PERMISSIONS.PURCHASE_ORDERS,
    PERMISSIONS.CREATE_PURCHASE_REQUEST,
    PERMISSIONS.OPERATIONS_FEED,
  ],

  head_of_business_development: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.BUSINESS,
    PERMISSIONS.CRM,
    PERMISSIONS.CLIENT_FOLLOW_UP,
    PERMISSIONS.TICKETS,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.REPORTS,
    PERMISSIONS.PRINT_CRM_REPORT,
  ],

  business_developer: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.BUSINESS,
    PERMISSIONS.CRM,
    PERMISSIONS.CLIENT_FOLLOW_UP,
    PERMISSIONS.TICKETS,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.PRINT_CRM_REPORT,
  ],

  hr: [
    ...COMMON_STAFF_ACCESS,
    PERMISSIONS.HR,
    PERMISSIONS.STAFF_DIRECTORY,
    PERMISSIONS.PURCHASE_ORDERS,
    PERMISSIONS.PRINT_HR_REPORT,
  ],

  client: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.TICKETS,
    PERMISSIONS.NOTIFICATIONS,
    PERMISSIONS.ARK_CONNECT,
  ],
};

export const ROLE_HOME = {
  system_admin: "/dashboard",
  ceo: "/dashboard",
  agm: "/dashboard",

  admin_head: "/dashboard",
  admin: "/dashboard",

  head_of_it: "/dashboard",
  it: "/sites",

  manager: "/dashboard",
  operations: "/operations/part-requests",

  helpdesk: "/tickets",
  engineer: "/tickets",

  repair_head: "/rr-part-requests",
  repair_technician: "/repair-jobs",

  inventory: "/inventory/part-requests",

  head_of_account: "/finance",
  finance: "/finance",

  procurement: "/procurement",

  head_of_business_development: "/crm",
  business_developer: "/crm",

  hr: "/hr",
  client: "/tickets",
};

export const ROLE_LABELS = {
  system_admin: "System Administrator",
  ceo: "CEO",
  agm: "Assistant General Manager",

  admin_head: "Head of Administration",
  admin: "Administrative Officer",

  head_of_it: "Head of IT",
  it: "IT Officer",

  manager: "Operations Manager",
  operations: "Operations Officer",

  helpdesk: "Helpdesk Officer",
  engineer: "Field Engineer",

  repair_head: "Head of Repair & Refurbishment",
  repair_technician: "Repair Technician",

  inventory: "Inventory Officer",

  head_of_account: "Head of Account",
  finance: "Finance Officer",

  procurement: "Procurement Officer",

  head_of_business_development: "Head of Business Development",
  business_developer: "Business Development Officer",

  hr: "Human Resource Officer",
  client: "Client / Bank",
};

export const ROLE_DEPARTMENTS = {
  system_admin: "Information Technology",
  ceo: "Executive Management",
  agm: "Executive Management",

  admin_head: "Administration",
  admin: "Administration",

  head_of_it: "Information Technology",
  it: "Information Technology",

  manager: "Operations",
  operations: "Operations",

  helpdesk: "Helpdesk",
  engineer: "Field Engineering",

  repair_head: "Repair & Refurbishment",
  repair_technician: "Repair & Refurbishment",

  inventory: "Inventory",

  head_of_account: "Finance & Accounts",
  finance: "Finance & Accounts",

  procurement: "Procurement",

  head_of_business_development: "Business Development",
  business_developer: "Business Development",

  hr: "Human Resources",
  client: "Client",
};

export const ROUTE_PERMISSIONS = {
  "/dashboard": PERMISSIONS.DASHBOARD,
  "/fund-requests": PERMISSIONS.FUND_REQUESTS,

  "/tickets": PERMISSIONS.TICKETS,
  "/tickets/:id": PERMISSIONS.TICKETS,
  "/ticket": PERMISSIONS.TICKETS,

  "/operations": PERMISSIONS.OPERATIONS,
  "/operations-feed": PERMISSIONS.OPERATIONS_FEED,
  "/operations/part-requests": PERMISSIONS.OPERATIONS_PART_REQUESTS,

  "/inventory": PERMISSIONS.INVENTORY,
  "/inventory/part-requests": PERMISSIONS.INVENTORY_PART_REQUESTS,
  "/spare-parts": PERMISSIONS.SPARE_PARTS,
  "/inventory-analytics": PERMISSIONS.INVENTORY_ANALYTICS,
  "/parts": PERMISSIONS.PARTS_REQUEST,

  "/rr-part-requests": PERMISSIONS.RR_INTAKE,
  "/repair-jobs": PERMISSIONS.REPAIR_JOBS,
  "/repair-refurbish": PERMISSIONS.REPAIR_JOBS,
  "/rr-consumable-requests": PERMISSIONS.RR_CONSUMABLES,

  "/finance": PERMISSIONS.FINANCE,
  "/procurement": PERMISSIONS.PROCUREMENT,
  "/procurement-lpo": PERMISSIONS.PURCHASE_ORDERS,
  "/crm": PERMISSIONS.CRM,
  "/hr": PERMISSIONS.HR,

  "/reports": PERMISSIONS.REPORTS,
  "/live-map": PERMISSIONS.LIVE_MAP,
  "/sites": PERMISSIONS.SITE_MONITOR,
  "/site-monitor": PERMISSIONS.SITE_MONITOR,

  "/assets": PERMISSIONS.ASSETS,
  "/banks": PERMISSIONS.BANKS,
  "/branches": PERMISSIONS.BRANCHES,
  "/branches/:id/devices": PERMISSIONS.DEVICES,
  "/devices": PERMISSIONS.DEVICES,
  "/bank-devices": PERMISSIONS.DEVICES,
  "/device-status": PERMISSIONS.DEVICE_STATUS,
  "/device-assignment": PERMISSIONS.ASSIGNMENTS,
  "/regional-coverage": PERMISSIONS.REGIONAL_VIEW,

  "/engineers": PERMISSIONS.ENGINEERING,
  "/engineers-ops": PERMISSIONS.FIELD_ENGINEERS,
  "/field-ops": PERMISSIONS.FIELD_OPS,

  "/users": PERMISSIONS.USERS,
  "/user-management": PERMISSIONS.USER_MANAGEMENT,
  "/staff": PERMISSIONS.STAFF_DIRECTORY,
  "/staff-directory": PERMISSIONS.STAFF_DIRECTORY,
  "/departments": PERMISSIONS.DEPARTMENTS,
  "/audit-logs": PERMISSIONS.AUDIT_LOGS,
  "/settings": PERMISSIONS.SETTINGS,
  "/notifications": PERMISSIONS.NOTIFICATIONS,
  "/data-import": PERMISSIONS.DATA_IMPORT,

  "/official-mail": PERMISSIONS.OFFICIAL_MAIL,
  "/ark-connect": PERMISSIONS.ARK_CONNECT,
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

export function getRoleDepartment(role) {
  return ROLE_DEPARTMENTS[normalizeRole(role)] || "";
}

export function isSystemAdmin(role) {
  return normalizeRole(role) === "system_admin";
}

export function isAdmin(role) {
  return ["system_admin", "admin_head"].includes(normalizeRole(role));
}

export function isExecutive(role) {
  return ["system_admin", "ceo", "agm", "manager"].includes(normalizeRole(role));
}

export function isExecutiveRole(role) {
  return isExecutive(role);
}

export function isOperationsRole(role) {
  return [
    "system_admin",
    "ceo",
    "agm",
    "manager",
    "operations",
    "helpdesk",
  ].includes(normalizeRole(role));
}

export function isInventoryRole(role) {
  return [
    "system_admin",
    "ceo",
    "agm",
    "manager",
    "inventory",
  ].includes(normalizeRole(role));
}

export function isRRHeadRole(role) {
  return [
    "system_admin",
    "ceo",
    "agm",
    "manager",
    "repair_head",
  ].includes(normalizeRole(role));
}

export function isRRTechnicianRole(role) {
  return normalizeRole(role) === "repair_technician";
}

export function isFinanceRole(role) {
  return [
    "system_admin",
    "ceo",
    "agm",
    "manager",
    "head_of_account",
    "finance",
  ].includes(normalizeRole(role));
}

export function isITRole(role) {
  return ["system_admin", "head_of_it", "it"].includes(normalizeRole(role));
}

export function isBusinessDevelopmentRole(role) {
  return [
    "system_admin",
    "ceo",
    "agm",
    "head_of_business_development",
    "business_developer",
  ].includes(normalizeRole(role));
}

export function canPrint(role, printPermission = PERMISSIONS.PRINT_OFFICIAL_REPORT) {
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