import { format, isValid } from 'date-fns';
import { normalizeRole } from '@/lib/roleAccess';

const INV_STATUS = {
  draft: { label: 'Draft', color: 'bg-slate-500/15 text-slate-300 border-slate-200' },
  sent: { label: 'Sent', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Paid', color: 'bg-green-500/15 text-green-300 border-green-200' },
  overdue: { label: 'Overdue', color: 'bg-red-500/15 text-red-300 border-red-200' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const DISPATCH_FUND_STATUS = {
  pending_review: {
    label: 'Pending Review',
    color: 'bg-amber-500/15 text-amber-300 border-amber-200',
  },
  pending_finance: {
    label: 'Pending Finance',
    color: 'bg-amber-500/15 text-amber-300 border-amber-200',
  },
  approved: {
    label: 'Approved',
    color: 'bg-blue-500/15 text-blue-300 border-blue-200',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-500/15 text-red-300 border-red-200',
  },
  disbursed: {
    label: 'Disbursed',
    color: 'bg-green-500/15 text-green-300 border-green-200',
  },
};

const PO_STATUS = {
  Draft: { label: 'Draft', color: 'bg-slate-500/15 text-slate-300 border-slate-200' },
  'Pending Approval': {
    label: 'Pending Approval',
    color: 'bg-amber-500/15 text-amber-300 border-amber-200',
  },
  'Pending HR Approval': {
    label: 'Pending HR Approval',
    color: 'bg-amber-500/15 text-amber-300 border-amber-200',
  },
  'Pending AGM Approval': {
    label: 'Pending AGM Approval',
    color: 'bg-purple-500/15 text-purple-300 border-purple-200',
  },
  'Pending Operations Approval': {
    label: 'Pending Operations Approval',
    color: 'bg-orange-500/15 text-orange-300 border-orange-200',
  },
  'Pending Account Release': {
    label: 'Pending Account Release',
    color: 'bg-cyan-500/15 text-cyan-300 border-cyan-200',
  },
  'Funds Released': {
    label: 'Funds Released',
    color: 'bg-blue-500/15 text-blue-300 border-blue-200',
  },
  Approved: {
    label: 'Approved',
    color: 'bg-green-500/15 text-green-300 border-green-200',
  },
  Rejected: {
    label: 'Rejected',
    color: 'bg-red-500/15 text-red-300 border-red-200',
  },
  Issued: {
    label: 'Issued',
    color: 'bg-blue-500/15 text-blue-300 border-blue-200',
  },
  Completed: {
    label: 'Completed',
    color: 'bg-green-500/15 text-green-300 border-green-200',
  },
};

const EMPTY_INV = {
  client_name: '',
  client_email: '',
  description: '',
  amount: '',
  currency: 'NGN',
  status: 'draft',
  due_date: '',
  payment_source: '',
  payment_mode: '',
  notes: '',
};

const EXPENSE_CATEGORIES = [
  'Logistics',
  'Procurement',
  'Fuel',
  'Staff Welfare',
  'Transportation',
  'Device Repair',
  'Operational',
  'Maintenance',
  'Utilities',
  'Other',
];

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'Cheque',
  'POS',
  'Online Transfer',
  'Other',
];

const APPROVAL_STATUS = {
  pending: { label: 'Pending', color: 'bg-amber-500/15 text-amber-300 border-amber-200' },
  approved: { label: 'Approved', color: 'bg-green-500/15 text-green-300 border-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-300 border-red-200' },
};

const EMPTY_EXP = {
  category: '',
  amount: '',
  currency: 'NGN',
  payment_method: '',
  description: '',
  staff_responsible: '',
  approval_status: 'approved',
  expense_date: new Date().toISOString().slice(0, 10),
  document_url: '',
  notes: '',
  expense_source_type: 'controlled_exception',
  controlled_exception_type: '',
  controlled_exception_reason: '',
};

const EMPTY_EXPENSE_REQUEST = {
  expense_category: '',
  purpose: '',
  description: '',
  supplier_name: '',
  supplier_email: '',
  beneficiary_name: '',
  amount_requested: '',
  amount_approved: '',
  currency: 'NGN',
  required_date: '',
};

const EMPTY_EXPENSE_PAYMENT = {
  amount_paid: '',
  payment_method: '',
  payment_reference: '',
  payment_date: new Date().toISOString().slice(0, 10),
  bank_account_id: 'none',
  notes: '',
};

const EXPENSE_REQUEST_STATUS = {
  draft: { label: 'Draft', color: 'bg-slate-500/15 text-slate-300 border-slate-200' },
  submitted: { label: 'Submitted', color: 'bg-blue-500/15 text-blue-300 border-blue-200' },
  pending_approval: { label: 'Pending Approval', color: 'bg-amber-500/15 text-amber-300 border-amber-200' },
  approved: { label: 'Approved', color: 'bg-green-500/15 text-green-300 border-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-300 border-red-200' },
  returned_for_correction: { label: 'Returned', color: 'bg-orange-500/15 text-orange-300 border-orange-200' },
  pending_finance_review: { label: 'Pending Finance Review', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-200' },
  approved_for_payment: { label: 'Approved for Payment', color: 'bg-purple-500/15 text-purple-300 border-purple-200' },
  partially_paid: { label: 'Partially Paid', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-200' },
  paid: { label: 'Paid', color: 'bg-green-500/15 text-green-300 border-green-200' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500/15 text-slate-300 border-slate-200' },
};

const EXPENSE_EXCEPTION_TYPES = [
  'Bank Charge',
  'Depreciation',
  'Tax Adjustment',
  'Statutory Charge',
  'Journal Correction',
  'Opening Balance',
  'System Adjustment',
  'Other Accounting Entry',
];

const fmt = (n) => '₦' + Number(n || 0).toLocaleString();

const EMPTY_ACCOUNT = {
  account_code: '',
  account_name: '',
  account_type: 'asset',
  normal_balance: 'debit',
  parent_account_id: 'none',
  description: '',
};

const EMPTY_BANK_ACCOUNT = {
  account_id: 'none',
  bank_name: '',
  account_name: '',
  account_number: '',
  currency: 'NGN',
  opening_balance: '',
  current_balance: '',
};

const EMPTY_BUDGET = {
  department: '',
  account_id: 'none',
  period_start: '',
  period_end: '',
  budget_amount: '',
  pending_amount: '',
  status: 'draft',
};

const EMPTY_FIXED_ASSET = {
  asset_code: '',
  asset_name: '',
  asset_type: '',
  serial_number: '',
  purchase_date: '',
  purchase_cost: '',
  account_id: 'none',
  assigned_department: '',
  assigned_employee_name: '',
  current_location: '',
  warranty_expiry: '',
  depreciation_rate: '',
};

const EMPTY_JOURNAL_LINE = {
  account_id: '',
  debit: '',
  credit: '',
  description: '',
  department: '',
};

const EMPTY_JOURNAL = {
  journal_date: new Date().toISOString().slice(0, 10),
  narration: '',
  status: 'draft',
  lines: [{ ...EMPTY_JOURNAL_LINE }, { ...EMPTY_JOURNAL_LINE }],
};

const BACKFILL_SOURCE_TABLES = [
  'invoices',
  'expenses',
  'lpos',
  'inventory_dispatch_fund_requests',
];

const AGEING_BUCKETS = [
  { key: 'current', label: 'Current' },
  { key: 'bucket30', label: '30' },
  { key: 'bucket60', label: '60' },
  { key: 'bucket90', label: '90' },
  { key: 'bucket120', label: '120+' },
];

const CHART_COLORS = [
  '#ff5a00',
  '#ef4444',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#6366f1',
  '#84cc16',
];

const safeDate = (value) => {
  if (!value) return '';

  const d = new Date(value);

  if (!isValid(d)) return '';

  return format(d, 'MMM d, yyyy');
};

const normalize = (value) => String(value || '').toLowerCase().trim();

const DISPATCH_FINANCE_STATUS = {
  APPROVED: 'approved',
  DISBURSED: 'disbursed',
  REJECTED: 'rejected',
};

const hasTimestamp = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const getDispatchFinanceStatus = (request) => normalize(request?.finance_status);

function isPendingDispatchFund(request) {
  return (
    !isRejectedDispatchFund(request) &&
    !isApprovedAwaitingDispatchFundDisbursement(request) &&
    !isDisbursedDispatchFund(request)
  );
}

function isApprovedAwaitingDispatchFundDisbursement(request) {
  return (
    getDispatchFinanceStatus(request) === DISPATCH_FINANCE_STATUS.APPROVED &&
    !hasTimestamp(request?.disbursed_at)
  );
}

function isDisbursedDispatchFund(request) {
  return (
    getDispatchFinanceStatus(request) === DISPATCH_FINANCE_STATUS.DISBURSED &&
    hasTimestamp(request?.disbursed_at)
  );
}

function isRejectedDispatchFund(request) {
  return getDispatchFinanceStatus(request) === DISPATCH_FINANCE_STATUS.REJECTED;
}

function getDispatchRequestedAmount(request) {
  return Number(request?.requested_amount || 0);
}

function getDispatchApprovedAmount(request) {
  return Number(request?.approved_amount || request?.requested_amount || 0);
}

function isPendingAccountReleaseLpo(lpo) {
  return normalize(lpo?.status) === 'pending account release';
}

function getGeneralRequestCategory(request) {
  const category = normalize(request?.request_category);
  if (['fund', 'loan', 'float'].includes(category)) return category;

  const type = normalize(`${request?.request_type || ''} ${request?.request_subtype || ''}`);
  if (type.includes('loan')) return 'loan';
  if (type.includes('float')) return 'float';
  return 'fund';
}

function generalRequestNeedsFinance(request) {
  return ['fund', 'loan', 'float'].includes(getGeneralRequestCategory(request));
}

function hasApprovedGeneralRequestWorkflow(request) {
  return (
    normalize(request?.hr_status) === 'approved' &&
    normalize(request?.agm_status) === 'approved' &&
    normalize(request?.operations_status) === 'approved'
  );
}

function isGeneralRequestReadyForFinance(request) {
  return (
    generalRequestNeedsFinance(request) &&
    hasApprovedGeneralRequestWorkflow(request) &&
    ['ready_for_disbursement', 'partially_paid'].includes(normalize(request?.finance_status)) &&
    ['approved', 'partially_paid'].includes(normalize(request?.status))
  );
}

function isGeneralRequestDisbursed(request) {
  return (
    generalRequestNeedsFinance(request) &&
    normalize(request?.finance_status) === 'disbursed' &&
    normalize(request?.status) === 'disbursed' &&
    hasTimestamp(request?.disbursed_at)
  );
}

function getGeneralRequestAmount(request) {
  return Number(request?.amount || request?.approved_amount || 0);
}

function getFundFinanceStatus(request) {
  return normalize(request.finance_status || request.status || 'pending_review');
}

function getFundStatusStyle(request) {
  const status = getFundFinanceStatus(request);
  return DISPATCH_FUND_STATUS[status] || DISPATCH_FUND_STATUS.pending_review;
}

function getFundPartName(request) {
  return request.part_name || request.item_name || request.part_number || 'Requested Part';
}

function getFundEngineerName(request) {
  return request.engineer_name || request.requested_for || 'N/A';
}

function getFundDestination(request) {
  return request.destination || request.branch_name || request.location || 'N/A';
}

function getPOStatusStyle(lpo) {
  return PO_STATUS[lpo?.status] || PO_STATUS.Draft;
}

function getPOItems(lpo) {
  return Array.isArray(lpo?.items) ? lpo.items : [];
}

function getPOItemsCount(lpo) {
  return getPOItems(lpo).length;
}

function getPOTotal(lpo) {
  return Number(lpo?.total_amount_ngn || 0);
}

function getPOSupplier(lpo) {
  return lpo?.supplier_name || 'No supplier';
}

function getFinanceRole(user) {
  return normalizeRole(user?.role || user?.user_role || user?.position);
}

function canViewFullFinance(user) {
  const role = getFinanceRole(user);
  return [
    'system_admin',
    'admin',
    'ceo',
    'agm',
    'finance',
    'finance_manager',
    'head_of_account',
    'account',
    'accounts',
    'accountant',
  ].includes(role);
}

function canManageFinance(user) {
  const role = getFinanceRole(user);
  return ['admin', 'ceo'].includes(role);
}

function canAddFinanceRecord(user) {
  const role = getFinanceRole(user);
  return ['system_admin', 'admin', 'ceo', 'finance', 'finance_manager', 'head_of_account'].includes(role);
}

function canProcessDispatchFunds(user) {
  const role = getFinanceRole(user);
  return ['system_admin', 'admin', 'ceo', 'agm', 'finance', 'finance_manager', 'head_of_account'].includes(role);
}

function canSubmitJournal(user) {
  const role = getFinanceRole(user);
  return [
    'system_admin',
    'admin',
    'ceo',
    'agm',
    'finance',
    'finance_manager',
    'head_of_account',
    'account',
    'accounts',
    'accountant',
  ].includes(role);
}

function canApproveJournal(user) {
  const role = getFinanceRole(user);
  return [
    'system_admin',
    'admin',
    'ceo',
    'agm',
    'finance_manager',
    'head_of_account',
  ].includes(role);
}

function canPostJournal(user) {
  const role = getFinanceRole(user);
  return [
    'system_admin',
    'admin',
    'ceo',
    'agm',
    'finance_manager',
    'head_of_account',
  ].includes(role);
}

export {
  INV_STATUS, DISPATCH_FUND_STATUS, PO_STATUS, EMPTY_INV, EXPENSE_CATEGORIES, PAYMENT_METHODS,
  APPROVAL_STATUS, EMPTY_EXP, EMPTY_EXPENSE_REQUEST, EMPTY_EXPENSE_PAYMENT, EXPENSE_REQUEST_STATUS,
  EXPENSE_EXCEPTION_TYPES, fmt, EMPTY_ACCOUNT, EMPTY_BANK_ACCOUNT, EMPTY_BUDGET, EMPTY_FIXED_ASSET,
  EMPTY_JOURNAL_LINE, EMPTY_JOURNAL, BACKFILL_SOURCE_TABLES, AGEING_BUCKETS, CHART_COLORS, safeDate,
  normalize, isPendingDispatchFund, isApprovedAwaitingDispatchFundDisbursement, isDisbursedDispatchFund,
  isRejectedDispatchFund, getDispatchRequestedAmount, getDispatchApprovedAmount, isPendingAccountReleaseLpo,
  getGeneralRequestCategory, generalRequestNeedsFinance, hasApprovedGeneralRequestWorkflow,
  isGeneralRequestReadyForFinance, isGeneralRequestDisbursed, getGeneralRequestAmount, getFundFinanceStatus,
  getFundStatusStyle, getFundPartName, getFundEngineerName, getFundDestination, getPOStatusStyle, getPOItems,
  getPOItemsCount, getPOTotal, getPOSupplier, getFinanceRole, canViewFullFinance, canManageFinance,
  canAddFinanceRecord, canProcessDispatchFunds, canSubmitJournal, canApproveJournal, canPostJournal,
};
// @ts-check
