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
  operational_manager: "manager",

  account: "finance",
  accounts: "finance",
  accountant: "finance",
  account_officer: "finance",
  finance_officer: "finance",
  finance_manager: "head_of_account",
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

export function getUserRole(user) {
  return normalizeRole(
    user?.role ||
      user?.user_role ||
      user?.position ||
      user?.profile?.role ||
      ""
  );
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
  WORKFLOWS: "workflows",
  ADMIN_DIAGNOSTICS: "admin_diagnostics",

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

export const MODULES = {
  COMMAND_CENTER: "command_center",
  HELP_DESK: "help_desk",
  FIELD_OPERATIONS: "field_operations",
  OPERATIONS: "operations",
  INVENTORY: "inventory",
  REPAIR_REFURBISHMENT: "repair_refurbishment",
  FINANCE: "finance",
  PROCUREMENT: "procurement",
  BUSINESS_DEVELOPMENT: "business_development",
  HUMAN_RESOURCES: "human_resources",
  ASSETS: "assets",
  ADMINISTRATION: "administration",
  COMMUNICATION: "communication",
};

export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  ASSIGN: "assign",
  APPROVE: "approve",
  REJECT: "reject",
  RELEASE: "release",
  PRINT: "print",
  EXPORT: "export",
  MANAGE_USERS: "manage_users",
};

export const MODULE_ACCESS = {
  [MODULES.COMMAND_CENTER]: [PERMISSIONS.DASHBOARD, PERMISSIONS.REPORTS],
  [MODULES.HELP_DESK]: [
    PERMISSIONS.TICKETS,
    PERMISSIONS.CREATE_TICKET,
    PERMISSIONS.ASSIGN_TICKET,
    PERMISSIONS.CLOSE_TICKET,
    PERMISSIONS.SLA_ANALYTICS,
  ],
  [MODULES.FIELD_OPERATIONS]: [
    PERMISSIONS.ENGINEERING,
    PERMISSIONS.FIELD_OPS,
    PERMISSIONS.FIELD_ENGINEERS,
    PERMISSIONS.PARTS_REQUEST,
    PERMISSIONS.ENGINEER_RECEIVE_PART,
  ],
  [MODULES.OPERATIONS]: [
    PERMISSIONS.OPERATIONS,
    PERMISSIONS.OPS_DASHBOARD,
    PERMISSIONS.OPERATIONS_FEED,
    PERMISSIONS.OPERATIONS_PART_REQUESTS,
    PERMISSIONS.APPROVE_PART_REQUEST,
    PERMISSIONS.REJECT_PART_REQUEST,
    PERMISSIONS.SEND_TO_INVENTORY,
  ],
  [MODULES.INVENTORY]: [
    PERMISSIONS.INVENTORY,
    PERMISSIONS.INVENTORY_ANALYTICS,
    PERMISSIONS.INVENTORY_PART_REQUESTS,
    PERMISSIONS.SPARE_PARTS,
  ],
  [MODULES.REPAIR_REFURBISHMENT]: [
    PERMISSIONS.RR_INTAKE,
    PERMISSIONS.REPAIR_JOBS,
    PERMISSIONS.RR_CONSUMABLES,
    PERMISSIONS.RECEIVE_RR,
    PERMISSIONS.ASSIGN_RR_TECHNICIAN,
    PERMISSIONS.START_REPAIR,
    PERMISSIONS.REQUEST_CONSUMABLES,
    PERMISSIONS.SUBMIT_QA,
    PERMISSIONS.QA_PASS,
    PERMISSIONS.QA_FAIL,
    PERMISSIONS.RETURN_TO_INVENTORY,
    PERMISSIONS.SCRAP_PART,
    PERMISSIONS.SELL_PART,
  ],
  [MODULES.FINANCE]: [
    PERMISSIONS.FINANCE,
    PERMISSIONS.ACCOUNT,
    PERMISSIONS.FUND_REQUESTS,
    PERMISSIONS.APPROVE_PAYMENT,
    PERMISSIONS.RELEASE_FUND,
    PERMISSIONS.VENDOR_PAYMENT,
  ],
  [MODULES.PROCUREMENT]: [
    PERMISSIONS.PROCUREMENT,
    PERMISSIONS.PURCHASE_ORDERS,
    PERMISSIONS.CREATE_PURCHASE_REQUEST,
    PERMISSIONS.APPROVE_PURCHASE_REQUEST,
  ],
  [MODULES.BUSINESS_DEVELOPMENT]: [
    PERMISSIONS.BUSINESS,
    PERMISSIONS.CRM,
    PERMISSIONS.CLIENT_FOLLOW_UP,
  ],
  [MODULES.HUMAN_RESOURCES]: [PERMISSIONS.HR, PERMISSIONS.STAFF_DIRECTORY],
  [MODULES.ASSETS]: [
    PERMISSIONS.ASSETS_SECTION,
    PERMISSIONS.ASSETS,
    PERMISSIONS.BANKS,
    PERMISSIONS.BRANCHES,
    PERMISSIONS.DEVICES,
    PERMISSIONS.DEVICE_STATUS,
    PERMISSIONS.ASSIGNMENTS,
    PERMISSIONS.LIVE_MAP,
    PERMISSIONS.SITE_MONITOR,
    PERMISSIONS.REGIONAL_VIEW,
  ],
  [MODULES.ADMINISTRATION]: [
    PERMISSIONS.USERS,
    PERMISSIONS.USER_MANAGEMENT,
    PERMISSIONS.STAFF_DIRECTORY,
    PERMISSIONS.DEPARTMENTS,
    PERMISSIONS.AUDIT_LOGS,
    PERMISSIONS.SETTINGS,
    PERMISSIONS.DATA_IMPORT,
  ],
  [MODULES.COMMUNICATION]: [
    PERMISSIONS.COMMUNICATION,
    PERMISSIONS.OFFICIAL_MAIL,
    PERMISSIONS.ARK_CONNECT,
    PERMISSIONS.NOTIFICATIONS,
  ],
};

export const ACTION_PERMISSIONS = {
  [ACTIONS.VIEW]: {
    [MODULES.COMMAND_CENTER]: PERMISSIONS.DASHBOARD,
    [MODULES.HELP_DESK]: PERMISSIONS.TICKETS,
    [MODULES.FIELD_OPERATIONS]: PERMISSIONS.FIELD_OPS,
    [MODULES.OPERATIONS]: PERMISSIONS.OPERATIONS,
    [MODULES.INVENTORY]: PERMISSIONS.INVENTORY,
    [MODULES.REPAIR_REFURBISHMENT]: PERMISSIONS.REPAIR_JOBS,
    [MODULES.FINANCE]: PERMISSIONS.FINANCE,
    [MODULES.PROCUREMENT]: PERMISSIONS.PROCUREMENT,
    [MODULES.BUSINESS_DEVELOPMENT]: PERMISSIONS.CRM,
    [MODULES.HUMAN_RESOURCES]: PERMISSIONS.HR,
    [MODULES.ASSETS]: PERMISSIONS.ASSETS,
    [MODULES.ADMINISTRATION]: PERMISSIONS.USERS,
    [MODULES.COMMUNICATION]: PERMISSIONS.COMMUNICATION,
  },
  [ACTIONS.CREATE]: {
    [MODULES.HELP_DESK]: PERMISSIONS.CREATE_TICKET,
    [MODULES.FIELD_OPERATIONS]: PERMISSIONS.PARTS_REQUEST,
    [MODULES.PROCUREMENT]: PERMISSIONS.CREATE_PURCHASE_REQUEST,
    [MODULES.REPAIR_REFURBISHMENT]: PERMISSIONS.REQUEST_CONSUMABLES,
  },
  [ACTIONS.ASSIGN]: {
    [MODULES.HELP_DESK]: PERMISSIONS.ASSIGN_TICKET,
    [MODULES.REPAIR_REFURBISHMENT]: PERMISSIONS.ASSIGN_RR_TECHNICIAN,
    [MODULES.ASSETS]: PERMISSIONS.ASSIGNMENTS,
  },
  [ACTIONS.APPROVE]: {
    [MODULES.OPERATIONS]: PERMISSIONS.APPROVE_PART_REQUEST,
    [MODULES.REPAIR_REFURBISHMENT]: PERMISSIONS.QA_PASS,
    [MODULES.FINANCE]: PERMISSIONS.APPROVE_PAYMENT,
    [MODULES.PROCUREMENT]: PERMISSIONS.APPROVE_PURCHASE_REQUEST,
  },
  [ACTIONS.REJECT]: {
    [MODULES.OPERATIONS]: PERMISSIONS.REJECT_PART_REQUEST,
    [MODULES.REPAIR_REFURBISHMENT]: PERMISSIONS.QA_FAIL,
  },
  [ACTIONS.RELEASE]: {
    [MODULES.OPERATIONS]: PERMISSIONS.SEND_TO_INVENTORY,
    [MODULES.REPAIR_REFURBISHMENT]: PERMISSIONS.RETURN_TO_INVENTORY,
    [MODULES.FINANCE]: PERMISSIONS.RELEASE_FUND,
  },
  [ACTIONS.PRINT]: {
    [MODULES.COMMAND_CENTER]: PERMISSIONS.PRINT_OFFICIAL_REPORT,
    [MODULES.HELP_DESK]: PERMISSIONS.PRINT_TICKET_REPORT,
    [MODULES.OPERATIONS]: PERMISSIONS.PRINT_OPERATIONS_REPORT,
    [MODULES.INVENTORY]: PERMISSIONS.PRINT_INVENTORY_REPORT,
    [MODULES.REPAIR_REFURBISHMENT]: PERMISSIONS.PRINT_RR_REPORT,
    [MODULES.FINANCE]: PERMISSIONS.PRINT_FINANCE_REPORT,
    [MODULES.HUMAN_RESOURCES]: PERMISSIONS.PRINT_HR_REPORT,
    [MODULES.BUSINESS_DEVELOPMENT]: PERMISSIONS.PRINT_CRM_REPORT,
  },
  [ACTIONS.MANAGE_USERS]: {
    [MODULES.ADMINISTRATION]: PERMISSIONS.USER_MANAGEMENT,
  },
};

const COMMON_STAFF_ACCESS = [
  PERMISSIONS.DASHBOARD,
  PERMISSIONS.FUND_REQUESTS,
  PERMISSIONS.NOTIFICATIONS,
  PERMISSIONS.WORKFLOWS,
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
    PERMISSIONS.SITE_MONITOR,
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
    PERMISSIONS.SITE_MONITOR,
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
    PERMISSIONS.SITE_MONITOR,
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
    PERMISSIONS.SITE_MONITOR,
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
    PERMISSIONS.SITE_MONITOR,
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
    PERMISSIONS.SITE_MONITOR,
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
  engineer: "/dashboard",

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

export const ROLE_DEFINITIONS = Object.freeze(
  Object.fromEntries(
    Object.keys(ROLE_ACCESS).map((role) => [
      role,
      {
        key: role,
        label: ROLE_LABELS[role] || role,
        department: ROLE_DEPARTMENTS[role] || "",
        home: ROLE_HOME[role] || "/dashboard",
        isExecutive: ["system_admin", "ceo", "agm", "manager"].includes(role),
        isHod: [
          "admin_head",
          "head_of_it",
          "manager",
          "repair_head",
          "head_of_account",
          "head_of_business_development",
          "hr",
        ].includes(role),
        permissions: ROLE_ACCESS[role] || [],
      },
    ])
  )
);

export const DEPARTMENT_HODS = {
  "Executive Management": ["ceo", "agm"],
  Administration: ["admin_head"],
  "Information Technology": ["head_of_it"],
  Operations: ["manager"],
  Helpdesk: ["manager", "helpdesk"],
  "Field Engineering": ["manager"],
  Inventory: ["manager"],
  "Repair & Refurbishment": ["repair_head"],
  "Finance & Accounts": ["head_of_account"],
  Procurement: ["manager"],
  "Business Development": ["head_of_business_development"],
  "Human Resources": ["hr"],
  Client: ["manager"],
};

export const APPROVAL_HIERARCHY = {
  default: ["department_hod", "agm", "ceo"],
  operations: ["manager", "agm", "ceo"],
  inventory: ["manager", "agm", "ceo"],
  repair_refurbishment: ["repair_head", "manager", "agm", "ceo"],
  finance: ["head_of_account", "agm", "ceo"],
  procurement: ["manager", "agm", "ceo"],
  human_resources: ["hr", "agm", "ceo"],
  business_development: ["head_of_business_development", "agm", "ceo"],
  administration: ["admin_head", "agm", "ceo"],
  information_technology: ["head_of_it", "agm", "ceo"],
};

export const ROUTE_PERMISSIONS = {
  "/dashboard": PERMISSIONS.DASHBOARD,
  "/fund-requests": PERMISSIONS.FUND_REQUESTS,
  "/workflows": PERMISSIONS.WORKFLOWS,

  "/tickets": PERMISSIONS.TICKETS,
  "/tickets/:id": PERMISSIONS.TICKETS,
  "/ticket": PERMISSIONS.TICKETS,

  "/operations": PERMISSIONS.OPERATIONS,
  "/ops-dashboard": PERMISSIONS.OPS_DASHBOARD,
  "/manager": PERMISSIONS.OPS_DASHBOARD,
  "/operations-feed": PERMISSIONS.OPERATIONS_FEED,
  "/operations/part-requests": PERMISSIONS.OPERATIONS_PART_REQUESTS,

  "/inventory": PERMISSIONS.INVENTORY,
  "/inventory/part-requests": PERMISSIONS.INVENTORY_PART_REQUESTS,
  "/spare-parts": PERMISSIONS.SPARE_PARTS,
  "/inventory-analytics": PERMISSIONS.INVENTORY_ANALYTICS,
  "/parts": PERMISSIONS.PARTS_REQUEST,
  "/part-requests": PERMISSIONS.PARTS_REQUEST,

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
  "/sla-analytics": PERMISSIONS.SLA_ANALYTICS,
  "/live-map": PERMISSIONS.LIVE_MAP,
  "/sites": PERMISSIONS.SITE_MONITOR,
  "/site-monitor": PERMISSIONS.SITE_MONITOR,

  "/assets": PERMISSIONS.ASSETS,
  "/banks": PERMISSIONS.BANKS,
  "/branches": PERMISSIONS.BRANCHES,
  "/branches/:id/devices": PERMISSIONS.DEVICES,
  "/devices": PERMISSIONS.DEVICES,
  "/machines": PERMISSIONS.DEVICES,
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
  "/admin-diagnostics": PERMISSIONS.ADMIN_DIAGNOSTICS,

  "/official-mail": PERMISSIONS.OFFICIAL_MAIL,
  "/ark-connect": PERMISSIONS.ARK_CONNECT,
};

export function canAccess(role, permission) {
  if (!role || !permission) return false;

  const normalizedRole = normalizeRole(role);
  if (permission === PERMISSIONS.ADMIN_DIAGNOSTICS) return normalizedRole === "system_admin";
  const access = ROLE_ACCESS[normalizedRole];

  if (!access) return false;
  if (access.includes("*")) return true;

  return access.includes(permission);
}

export function canUserAccess(user, permission) {
  return canAccess(getUserRole(user), permission);
}

export function hasAnyAccess(role, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((permission) => canAccess(role, permission));
}

export function canAccessAny(userOrRole, permissions = []) {
  if (!permissions.length) return true;

  const role =
    typeof userOrRole === "string" ? normalizeRole(userOrRole) : getUserRole(userOrRole);

  return permissions.some((permission) => canAccess(role, permission));
}

export function canAccessModule(userOrRole, module) {
  const permissions = MODULE_ACCESS[module] || [];
  return canAccessAny(userOrRole, permissions);
}

export function canPerformAction(userOrRole, module, action) {
  const permission = ACTION_PERMISSIONS[action]?.[module];

  if (!permission) return false;

  const role =
    typeof userOrRole === "string" ? normalizeRole(userOrRole) : getUserRole(userOrRole);

  return canAccess(role, permission);
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

export function getUserDepartment(user) {
  return (
    user?.department ||
    user?.profile?.department ||
    user?.employee?.department ||
    getRoleDepartment(getUserRole(user))
  );
}

export function getDepartmentHodRoles(department) {
  return DEPARTMENT_HODS[String(department || "").trim()] || [];
}

export function isDepartmentHod(userOrRole, department) {
  const role =
    typeof userOrRole === "string" ? normalizeRole(userOrRole) : getUserRole(userOrRole);

  if (["system_admin", "admin", "ceo", "agm"].includes(role)) return true;

  return getDepartmentHodRoles(department).includes(role);
}

export function getApprovalHierarchy(departmentOrModule) {
  const key = String(departmentOrModule || "default")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return APPROVAL_HIERARCHY[key] || APPROVAL_HIERARCHY.default;
}

export function getApprovalOwners({ department, module } = {}) {
  const hodRoles = getDepartmentHodRoles(department);
  const hierarchy = getApprovalHierarchy(module || department);

  return hierarchy.flatMap((owner) =>
    owner === "department_hod" ? hodRoles : [normalizeRole(owner)]
  );
}

export function canApproveForDepartment(userOrRole, department) {
  const role =
    typeof userOrRole === "string" ? normalizeRole(userOrRole) : getUserRole(userOrRole);

  if (["system_admin", "admin", "ceo", "agm"].includes(role)) return true;

  return getApprovalOwners({ department }).includes(role);
}

export function isSystemAdmin(role) {
  return normalizeRole(role) === "system_admin";
}

export function isAdmin(role) {
  return ["system_admin", "admin", "admin_head"].includes(normalizeRole(role));
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
