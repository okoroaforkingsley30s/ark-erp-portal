import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import FinancePageHeader from '@/components/finance/FinancePageHeader';
import FinanceReportToolbar from '@/components/finance/FinanceReportToolbar';
import { notifyUser } from '@/lib/notificationService';
import { normalizeRole } from '@/lib/roleAccess';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';

import {
  DollarSign,
  Plus,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  BarChart3,
  Truck,
  CheckCircle2,
  XCircle,
  Wallet,
  Clock,
  PackageCheck,
  ShoppingCart,
  Building2,
} from 'lucide-react';

import { format, isValid } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

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

function OperationalFundCard({
  icon: Icon,
  iconClassName,
  valueClassName,
  label,
  count,
  amount,
  loading,
  error,
  showAmount = true,
  onClick,
}) {
  const value = loading ? '...' : error ? '!' : count;
  const detail = loading
    ? 'Loading live values...'
    : error
      ? 'Unable to load live values'
      : showAmount
        ? `${label} · ${fmt(amount)}`
        : label;

  const CardElement = onClick ? 'button' : 'div';

  return (
    <CardElement
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        'w-full rounded-xl border bg-slate-900/50 p-4 text-left ' +
        (onClick ? 'transition hover:border-primary/60 hover:bg-slate-900' : '')
      }
    >
      <Icon className={`w-5 h-5 mb-2 ${iconClassName}`} />
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </CardElement>
  );
}

export default function FinancePortal() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const qc = useQueryClient();

  const [activeFinanceTab, setActiveFinanceTab] = useState('dispatch-funds');
  const [activeFinanceNavGroup, setActiveFinanceNavGroup] = useState('operations');

  const [invOpen, setInvOpen] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [invForm, setInvForm] = useState(EMPTY_INV);
  const [savingInv, setSavingInv] = useState(false);
  const [invFilter, setInvFilter] = useState('all');

  const [expOpen, setExpOpen] = useState(false);
  const [editingExp, setEditingExp] = useState(null);
  const [expForm, setExpForm] = useState(EMPTY_EXP);
  const [savingExp, setSavingExp] = useState(false);
  const [expCatFilter, setExpCatFilter] = useState('all');
  const [expenseRequestOpen, setExpenseRequestOpen] = useState(false);
  const [expenseRequestForm, setExpenseRequestForm] = useState(EMPTY_EXPENSE_REQUEST);
  const [editingExpenseRequest, setEditingExpenseRequest] = useState(null);
  const [savingExpenseRequest, setSavingExpenseRequest] = useState(false);
  const [expenseRequestFilter, setExpenseRequestFilter] = useState('all');
  const [expenseRequestPaymentOpen, setExpenseRequestPaymentOpen] = useState(false);
  const [expenseRequestForPayment, setExpenseRequestForPayment] = useState(null);
  const [expensePaymentForm, setExpensePaymentForm] = useState(EMPTY_EXPENSE_PAYMENT);
  const [savingExpensePayment, setSavingExpensePayment] = useState(false);

  const [fundFilter, setFundFilter] = useState('all');
  const [fundSearch, setFundSearch] = useState('');
  const [fundActionBusy, setFundActionBusy] = useState(null);
  const [fundActionForms, setFundActionForms] = useState({});
  const [generalRequestFilter, setGeneralRequestFilter] = useState('ready_for_disbursement');
  const [generalRequestSearch, setGeneralRequestSearch] = useState('');

  const [poFilter, setPoFilter] = useState('all');
  const [poSearch, setPoSearch] = useState('');
  const [poActionBusy, setPoActionBusy] = useState(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [savingAccount, setSavingAccount] = useState(false);

  const [journalOpen, setJournalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState(EMPTY_JOURNAL);
  const [savingJournal, setSavingJournal] = useState(false);
  const [journalActionBusy, setJournalActionBusy] = useState(null);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const [statementAccountId, setStatementAccountId] = useState('all');

  const [bankOpen, setBankOpen] = useState(false);
  const [bankForm, setBankForm] = useState(EMPTY_BANK_ACCOUNT);
  const [savingBank, setSavingBank] = useState(false);

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState(EMPTY_BUDGET);
  const [savingBudget, setSavingBudget] = useState(false);

  const [assetOpen, setAssetOpen] = useState(false);
  const [assetForm, setAssetForm] = useState(EMPTY_FIXED_ASSET);
  const [savingAsset, setSavingAsset] = useState(false);

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      return data || [];
    },
  });

  const { data: expenses = [], isLoading: loadingExp } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      return data || [];
    },
  });

  const {
    data: dispatchFunds = [],
    isLoading: loadingDispatchFunds,
    error: dispatchFundError,
  } = useQuery({
    queryKey: ['inventory_dispatch_fund_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_dispatch_fund_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error('Finance dispatch fund query failed', error);
        throw error;
      }

      return data || [];
    },
  });

  const {
    data: purchaseOrders = [],
    isLoading: loadingPurchaseOrders,
    error: purchaseOrderError,
  } = useQuery({
    queryKey: ['finance_lpos_account_release'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lpos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error('Finance LPO query failed', error);
        throw error;
      }

      return data || [];
    },
  });

  const {
    data: generalRequests = [],
    isLoading: loadingGeneralRequests,
    error: generalRequestError,
  } = useQuery({
    queryKey: ['finance_general_fund_requests'],
    enabled: canViewFullFinance(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fund_requests')
        .select('*')
        .in('request_category', ['fund', 'loan', 'float'])
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Finance General Request query failed', error);
        throw error;
      }

      return data || [];
    },
  });

  const canSeeFullFinance = canViewFullFinance(user);
  const allowFinanceActions = canProcessDispatchFunds(user);
  const allowAddFinanceRecords = canAddFinanceRecord(user);
  const allowJournalDrafts = canSubmitJournal(user);

  const {
    data: expenseRequests = [],
    isLoading: loadingExpenseRequests,
    error: expenseRequestsError,
  } = useQuery({
    queryKey: ['finance_expense_requests', user?.email, getFinanceRole(user)],
    enabled: Boolean(user?.email),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_expense_requests')
        .select(`
          *,
          finance_expense_request_approvals(*),
          finance_expense_request_attachments(*),
          finance_expense_payments(*)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Finance expense request query failed', error);
        throw error;
      }

      return data || [];
    },
  });
  const financeNavGroups = useMemo(() => {
    const groups = [
      {
        key: 'operations',
        label: 'Operations',
        items: [
          { value: 'dispatch-funds', label: 'Dispatch Funds' },
          { value: 'general-requests', label: 'General Requests' },
        ],
      },
    ];

    if (canSeeFullFinance) {
      groups[0].items.push(
        { value: 'purchase-orders', label: 'PO Fund Release' },
        { value: 'income', label: 'Income / Invoices' },
        { value: 'expense-requests', label: 'Expense Requests' },
        { value: 'expenses', label: 'Expenses' }
      );
      groups.push(
        {
          key: 'accounting',
          label: 'Accounting',
          items: [
            { value: 'chart-of-accounts', label: 'Chart of Accounts' },
            { value: 'journal-entries', label: 'Journal Entries' },
            { value: 'historical-backfill', label: 'Backfill' },
            { value: 'general-ledger', label: 'General Ledger' },
            { value: 'account-statements', label: 'Account Statements' },
            { value: 'trial-balance', label: 'Trial Balance' },
          ],
        },
        {
          key: 'receivables',
          label: 'Receivables',
          items: [{ value: 'accounts-receivable', label: 'AR Ledger & Ageing' }],
        },
        {
          key: 'payables',
          label: 'Payables',
          items: [{ value: 'accounts-payable', label: 'AP Ledger & Ageing' }],
        },
        {
          key: 'planning-assets',
          label: 'Planning and Assets',
          items: [
            { value: 'bank-accounts', label: 'Bank Accounts' },
            { value: 'budgets', label: 'Budgets' },
            { value: 'fixed-assets', label: 'Fixed Assets' },
          ],
        },
        {
          key: 'reports-controls',
          label: 'Reports and Controls',
          items: [{ value: 'analytics', label: 'Analytics' }],
        }
      );
    }

    return groups.filter((group) => group.items.length > 0);
  }, [canSeeFullFinance]);

  const activeFinanceTabLabel = financeNavGroups
    .flatMap((group) => group.items)
    .find((item) => item.value === activeFinanceTab)?.label;

  const activeFinanceGroup =
    financeNavGroups.find((group) => group.items.some((item) => item.value === activeFinanceTab)) ||
    financeNavGroups.find((group) => group.key === activeFinanceNavGroup) ||
    financeNavGroups[0];

  const setFinanceSection = (groupKey, tabValue) => {
    setActiveFinanceNavGroup(groupKey);
    if (tabValue) setActiveFinanceTab(tabValue);
  };

  const {
    data: financeAccounts = [],
    isLoading: loadingFinanceAccounts,
    isError: financeAccountsError,
    error: financeAccountsLoadError,
  } = useQuery({
    queryKey: ['finance_accounts'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_accounts')
        .select('id, account_code, account_name, account_type, normal_balance, parent_account_id, description, is_active')
        .eq('is_active', true)
        .order('account_code', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: financeJournals = [], isLoading: loadingFinanceJournals } = useQuery({
    queryKey: ['finance_journals'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_journals')
        .select('*, finance_journal_lines(*)')
        .order('journal_date', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const {
    data: backfilledJournalSources = [],
    isLoading: loadingBackfillSources,
    error: backfillSourcesError,
  } = useQuery({
    queryKey: ['finance_journal_sources', BACKFILL_SOURCE_TABLES],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_journals')
        .select('id, source_table, source_id, status')
        .in('source_table', BACKFILL_SOURCE_TABLES)
        .limit(5000);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: historicalPaidInvoices = [], isLoading: loadingHistoricalPaidInvoices } = useQuery({
    queryKey: ['historical_paid_invoices_for_backfill'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .ilike('status', 'paid')
        .gt('amount', 0)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: historicalApprovedExpenses = [], isLoading: loadingHistoricalApprovedExpenses } =
    useQuery({
      queryKey: ['historical_approved_expenses_for_backfill'],
      enabled: canSeeFullFinance,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .ilike('approval_status', 'approved')
          .gt('amount', 0)
          .order('created_at', { ascending: false })
          .limit(5000);

        if (error) throw error;
        return data || [];
      },
    });

  const { data: historicalReleasedLpos = [], isLoading: loadingHistoricalReleasedLpos } = useQuery({
    queryKey: ['historical_released_lpos_for_backfill'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lpos')
        .select('*')
        .ilike('status', 'Funds Released')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
      return data || [];
    },
  });

  const {
    data: historicalDisbursedDispatchFunds = [],
    isLoading: loadingHistoricalDisbursedDispatchFunds,
  } = useQuery({
    queryKey: ['historical_disbursed_dispatch_funds_for_backfill'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_dispatch_fund_requests')
        .select('*')
        .or('finance_status.ilike.disbursed,status.ilike.disbursed')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: generalLedger = [], isLoading: loadingGeneralLedger } = useQuery({
    queryKey: ['finance_general_ledger_view'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_general_ledger_view')
        .select('*')
        .order('journal_date', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: accountStatement = [], isLoading: loadingAccountStatement } = useQuery({
    queryKey: ['finance_account_statement_view', statementAccountId],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      let query = supabase
        .from('finance_account_statement_view')
        .select('*')
        .order('journal_date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(500);

      if (statementAccountId !== 'all') {
        query = query.eq('account_id', statementAccountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  const { data: trialBalance = [], isLoading: loadingTrialBalance } = useQuery({
    queryKey: ['finance_trial_balance_view'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_trial_balance_view')
        .select('*')
        .order('account_code', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: bankAccounts = [], isLoading: loadingBankAccounts } = useQuery({
    queryKey: ['finance_bank_accounts'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_bank_accounts')
        .select('*, finance_accounts(account_code, account_name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['finance_budgets'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_budgets')
        .select('*, finance_accounts(account_code, account_name)')
        .order('period_start', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: fixedAssets = [], isLoading: loadingFixedAssets } = useQuery({
    queryKey: ['finance_fixed_assets'],
    enabled: canSeeFullFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_fixed_assets')
        .select('*, finance_accounts(account_code, account_name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const totalIncome = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const totalPending = invoices
    .filter((i) => i.status === 'sent')
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const totalOverdue = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const activeExpenses = expenses.filter((e) => normalize(e.approval_status) !== 'rejected');

  const totalExpenses = activeExpenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  const profit = totalIncome - totalExpenses;

  const dispatchFundStats = useMemo(() => {
    const pending = dispatchFunds.filter(isPendingDispatchFund);
    const approved = dispatchFunds.filter(isApprovedAwaitingDispatchFundDisbursement);
    const rejected = dispatchFunds.filter(isRejectedDispatchFund);
    const disbursed = dispatchFunds.filter(isDisbursedDispatchFund);

    return {
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      disbursedCount: disbursed.length,
      pendingAmount: pending.reduce((s, r) => s + getDispatchRequestedAmount(r), 0),
      approvedAmount: approved.reduce((s, r) => s + getDispatchApprovedAmount(r), 0),
      disbursedAmount: disbursed.reduce((s, r) => s + getDispatchApprovedAmount(r), 0),
      rejectedAmount: rejected.reduce((s, r) => s + getDispatchRequestedAmount(r), 0),
    };
  }, [dispatchFunds]);

  const purchaseOrderStats = useMemo(() => {
    const pendingRelease = purchaseOrders.filter(isPendingAccountReleaseLpo);

    const released = purchaseOrders.filter((po) => normalize(po.status) === 'funds released');
    const issued = purchaseOrders.filter((po) => normalize(po.status) === 'issued');
    const completed = purchaseOrders.filter((po) => normalize(po.status) === 'completed');

    return {
      pendingReleaseCount: pendingRelease.length,
      releasedCount: released.length,
      issuedCount: issued.length,
      completedCount: completed.length,
      pendingReleaseAmount: pendingRelease.reduce((s, po) => s + getPOTotal(po), 0),
      releasedAmount: released.reduce((s, po) => s + getPOTotal(po), 0),
    };
  }, [purchaseOrders]);

  const generalRequestStats = useMemo(() => {
    const financeRequests = generalRequests.filter(generalRequestNeedsFinance);
    const awaitingFinance = financeRequests.filter(isGeneralRequestReadyForFinance);
    const disbursed = financeRequests.filter(isGeneralRequestDisbursed);

    return {
      totalFinanceCount: financeRequests.length,
      awaitingFinanceCount: awaitingFinance.length,
      disbursedCount: disbursed.length,
      awaitingFinanceAmount: awaitingFinance.reduce((sum, request) => sum + getGeneralRequestAmount(request), 0),
      disbursedAmount: disbursed.reduce((sum, request) => sum + getGeneralRequestAmount(request), 0),
    };
  }, [generalRequests]);

  const backfilledSourceKeys = useMemo(() => {
    return new Set(
      backfilledJournalSources
        .filter((journal) => journal.source_table && journal.source_id)
        .map((journal) => `${journal.source_table}:${journal.source_id}`)
    );
  }, [backfilledJournalSources]);

  const backfillPreview = useMemo(() => {
    const paidInvoices = historicalPaidInvoices.filter(
      (invoice) => invoice.status === 'paid' && Number(invoice.amount || 0) > 0
    );
    const approvedExpenses = historicalApprovedExpenses.filter(
      (expense) =>
        normalize(expense.approval_status) === 'approved' && Number(expense.amount || 0) > 0
    );
    const releasedLpos = historicalReleasedLpos.filter(
      (lpo) => lpo.status === 'Funds Released' && getPOTotal(lpo) > 0
    );
    const disbursedFunds = historicalDisbursedDispatchFunds.filter((request) => {
      const status = getFundFinanceStatus(request);
      const amount = Number(request.approved_amount || request.requested_amount || 0);
      return status === 'disbursed' && amount > 0;
    });

    const sources = [
      {
        key: 'invoices',
        label: 'Paid invoices',
        sourceTable: 'invoices',
        journalType: 'Revenue receipt',
        records: paidInvoices,
      },
      {
        key: 'expenses',
        label: 'Approved expenses',
        sourceTable: 'expenses',
        journalType: 'Expense payment',
        records: approvedExpenses,
      },
      {
        key: 'lpos',
        label: 'Released LPOs',
        sourceTable: 'lpos',
        journalType: 'PO fund release',
        records: releasedLpos,
      },
      {
        key: 'dispatch',
        label: 'Disbursed dispatch funds',
        sourceTable: 'inventory_dispatch_fund_requests',
        journalType: 'Dispatch/waybill fund disbursement',
        records: disbursedFunds,
      },
    ];

    const rows = sources.map((source) => {
      const pending = source.records.filter(
        (record) => !backfilledSourceKeys.has(`${source.sourceTable}:${record.id}`)
      );

      return {
        ...source,
        eligibleCount: source.records.length,
        alreadyBackfilledCount: source.records.length - pending.length,
        pendingCount: pending.length,
        pendingRecords: pending,
      };
    });

    return {
      rows,
      eligibleCount: rows.reduce((sum, row) => sum + row.eligibleCount, 0),
      alreadyBackfilledCount: rows.reduce((sum, row) => sum + row.alreadyBackfilledCount, 0),
      pendingCount: rows.reduce((sum, row) => sum + row.pendingCount, 0),
    };
  }, [
    backfilledSourceKeys,
    historicalApprovedExpenses,
    historicalDisbursedDispatchFunds,
    historicalPaidInvoices,
    historicalReleasedLpos,
  ]);

  const loadingBackfillPreview =
    loadingBackfillSources ||
    loadingHistoricalPaidInvoices ||
    loadingHistoricalApprovedExpenses ||
    loadingHistoricalReleasedLpos ||
    loadingHistoricalDisbursedDispatchFunds;

  const ageDays = (value) => {
    const d = value ? new Date(value) : new Date();
    if (!isValid(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };

  const ageingBucket = (days) => {
    if (days >= 120) return 'bucket120';
    if (days >= 90) return 'bucket90';
    if (days >= 60) return 'bucket60';
    if (days >= 30) return 'bucket30';
    return 'current';
  };

  const emptyAgeing = () => ({
    current: 0,
    bucket30: 0,
    bucket60: 0,
    bucket90: 0,
    bucket120: 0,
  });

  const accountsReceivable = useMemo(() => {
    const outstandingInvoices = invoices
      .filter((invoice) => !['paid', 'cancelled'].includes(normalize(invoice.status)))
      .map((invoice) => {
        const amount = Number(invoice.amount || 0);
        const days = ageDays(invoice.due_date || invoice.created_at);
        return {
          ...invoice,
          customerName: invoice.client_name || 'Unknown Customer',
          customerEmail: invoice.client_email || '',
          outstandingAmount: amount,
          ageDays: days,
          bucket: ageingBucket(days),
        };
      })
      .filter((invoice) => invoice.outstandingAmount > 0);

    const customerMap = new Map();

    outstandingInvoices.forEach((invoice) => {
      const key = normalize(invoice.customerEmail || invoice.customerName);
      const current = customerMap.get(key) || {
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        creditLimit: 0,
        balance: 0,
        invoiceCount: 0,
        ageing: emptyAgeing(),
        invoices: [],
      };

      current.balance += invoice.outstandingAmount;
      current.invoiceCount += 1;
      current.ageing[invoice.bucket] += invoice.outstandingAmount;
      current.invoices.push(invoice);
      customerMap.set(key, current);
    });

    const customers = Array.from(customerMap.values()).sort((a, b) => b.balance - a.balance);

    return {
      customers,
      outstandingInvoices,
      totalBalance: customers.reduce((sum, customer) => sum + customer.balance, 0),
      ageing: customers.reduce((totals, customer) => {
        AGEING_BUCKETS.forEach((bucket) => {
          totals[bucket.key] += customer.ageing[bucket.key];
        });
        return totals;
      }, emptyAgeing()),
    };
  }, [invoices]);

  const accountsPayable = useMemo(() => {
    const provisionalExpenses = expenses
      .filter(
        (expense) =>
          normalize(expense.approval_status) === 'approved' &&
          !String(expense.payment_method || '').trim()
      )
      .map((expense) => {
        const amount = Number(expense.amount || 0);
        const days = ageDays(expense.approved_date || expense.expense_date || expense.created_at);
        return {
          ...expense,
          sourceTable: 'expenses',
          sourceId: String(expense.id),
          documentNumber: expense.expense_number || expense.id,
          supplierName: expense.staff_responsible || expense.staff_email || 'Expense Payee',
          supplierEmail: expense.staff_email || '',
          outstandingAmount: amount,
          paymentState: 'provisional_unverified',
          paymentStateLabel: 'Provisional / unverified',
          ageDays: days,
          bucket: ageingBucket(days),
        };
      })
      .filter((expense) => expense.outstandingAmount > 0);

    const pendingReleaseLpos = purchaseOrders
      .filter(isPendingAccountReleaseLpo)
      .map((lpo) => {
        const amount = getPOTotal(lpo);
        const days = ageDays(lpo.updated_at || lpo.created_at);
        return {
          ...lpo,
          sourceTable: 'lpos',
          sourceId: String(lpo.id),
          documentNumber: lpo.lpo_number || lpo.id,
          supplierName: getPOSupplier(lpo),
          supplierEmail: '',
          outstandingAmount: amount,
          paymentState: 'confirmed_outstanding',
          paymentStateLabel: 'Confirmed outstanding',
          ageDays: days,
          bucket: ageingBucket(days),
        };
      })
      .filter((lpo) => lpo.outstandingAmount > 0);

    const outstandingPayables = pendingReleaseLpos;
    const provisionalPayables = provisionalExpenses;
    const statementItems = [...outstandingPayables, ...provisionalPayables];
    const supplierMap = new Map();

    outstandingPayables.forEach((payable) => {
      const key = normalize(`${payable.supplierEmail || ''}:${payable.supplierName}`);
      const current = supplierMap.get(key) || {
        supplierName: payable.supplierName,
        supplierEmail: payable.supplierEmail,
        balance: 0,
        payableCount: 0,
        ageing: emptyAgeing(),
        payables: [],
      };

      current.balance += payable.outstandingAmount;
      current.payableCount += 1;
      current.ageing[payable.bucket] += payable.outstandingAmount;
      current.payables.push(payable);
      supplierMap.set(key, current);
    });

    const suppliers = Array.from(supplierMap.values()).sort((a, b) => b.balance - a.balance);

    return {
      suppliers,
      outstandingPayables,
      provisionalPayables,
      statementItems,
      totalBalance: suppliers.reduce((sum, supplier) => sum + supplier.balance, 0),
      provisionalBalance: provisionalPayables.reduce(
        (sum, payable) => sum + payable.outstandingAmount,
        0
      ),
      ageing: suppliers.reduce((totals, supplier) => {
        AGEING_BUCKETS.forEach((bucket) => {
          totals[bucket.key] += supplier.ageing[bucket.key];
        });
        return totals;
      }, emptyAgeing()),
    };
  }, [expenses, purchaseOrders]);

  const isExpenseRequester = (request) =>
    normalize(request?.requester_email) === normalize(user?.email || user?.user_email);

  const canApproveExpenseRequest = (request) => {
    if (!request || isExpenseRequester(request)) return false;
    const role = getFinanceRole(user);
    return [
      'system_admin',
      'admin',
      'ceo',
      'agm',
      'manager',
      'operations',
      'operational_manager',
      'hr',
      'finance_manager',
      'head_of_account',
    ].includes(role);
  };

  const canFinanceReviewExpenseRequest = (request) => {
    if (!request) return false;
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
  };

  const getExpenseRequestPaidTotal = (request) =>
    (request?.finance_expense_payments || [])
      .filter((payment) => normalize(payment.payment_status) !== 'voided')
      .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);

  const getExpenseRequestApprovedAmount = (request) =>
    Number(request?.amount_approved || request?.amount_requested || 0);

  const getExpenseRequestRemaining = (request) =>
    Math.max(0, getExpenseRequestApprovedAmount(request) - getExpenseRequestPaidTotal(request));

  const expenseRequestStats = useMemo(() => {
    const count = (status) => expenseRequests.filter((request) => request.status === status).length;
    return {
      draft: count('draft'),
      pendingApproval: expenseRequests.filter((request) =>
        ['submitted', 'pending_approval'].includes(request.status)
      ).length,
      pendingFinance: count('pending_finance_review'),
      approvedForPayment: count('approved_for_payment'),
      partiallyPaid: count('partially_paid'),
      paid: count('paid'),
      rejected: count('rejected'),
    };
  }, [expenseRequests]);

  const filteredExpenseRequests = useMemo(() => {
    return expenseRequests.filter((request) => {
      if (expenseRequestFilter === 'all') return true;
      if (expenseRequestFilter === 'mine') return isExpenseRequester(request);
      if (expenseRequestFilter === 'pending') {
        return ['submitted', 'pending_approval', 'pending_finance_review'].includes(request.status);
      }
      return request.status === expenseRequestFilter || request.payment_status === expenseRequestFilter;
    });
  }, [expenseRequestFilter, expenseRequests, user?.email, user?.user_email]);

  const expenseRequestReport = useMemo(
    () => ({
      title: 'Expense Requests',
      columns: [
        { key: 'request_number', label: 'Request No.' },
        { key: 'requester_name', label: 'Requester' },
        { key: 'department', label: 'Department' },
        { key: 'expense_category', label: 'Category' },
        { key: 'purpose', label: 'Purpose' },
        { key: 'status', label: 'Status' },
        { key: 'payment_status', label: 'Payment Status' },
        { key: 'amount_requested', label: 'Requested', type: 'currency' },
        { key: 'amount_approved', label: 'Approved', type: 'currency' },
        { key: 'paid', label: 'Paid', type: 'currency', accessor: getExpenseRequestPaidTotal },
      ],
      rows: filteredExpenseRequests,
      totals: {
        Requested: fmt(filteredExpenseRequests.reduce((sum, request) => sum + Number(request.amount_requested || 0), 0)),
        Approved: fmt(filteredExpenseRequests.reduce((sum, request) => sum + Number(request.amount_approved || 0), 0)),
        Paid: fmt(filteredExpenseRequests.reduce((sum, request) => sum + getExpenseRequestPaidTotal(request), 0)),
      },
    }),
    [filteredExpenseRequests]
  );

  const financeReports = useMemo(() => {
    const ageingColumns = [
      { key: 'name', label: 'Name' },
      { key: 'balance', label: 'Balance', type: 'currency' },
      ...AGEING_BUCKETS.map((bucket) => ({ key: bucket.key, label: bucket.label, type: 'currency' })),
    ];

    const arAgeingRows = accountsReceivable.customers.map((customer) => ({
      name: customer.customerName,
      balance: customer.balance,
      ...customer.ageing,
    }));

    const apAgeingRows = accountsPayable.suppliers.map((supplier) => ({
      name: supplier.supplierName,
      balance: supplier.balance,
      ...supplier.ageing,
    }));

    return {
      chartOfAccounts: {
        title: 'Chart of Accounts',
        columns: [
          { key: 'account_code', label: 'Code' },
          { key: 'account_name', label: 'Name' },
          { key: 'account_type', label: 'Type' },
          { key: 'normal_balance', label: 'Normal Balance' },
          { key: 'is_active', label: 'Status', accessor: (row) => (row.is_active ? 'Active' : 'Inactive') },
        ],
        rows: financeAccounts,
      },
      journals: {
        title: 'Journal Entries',
        columns: [
          { key: 'journal_no', label: 'Journal No.' },
          { key: 'journal_date', label: 'Date', type: 'date' },
          { key: 'status', label: 'Status' },
          { key: 'narration', label: 'Narration' },
          {
            key: 'debit',
            label: 'Debit Total',
            type: 'currency',
            accessor: (row) =>
              (row.finance_journal_lines || []).reduce((sum, line) => sum + Number(line.debit || 0), 0),
          },
          {
            key: 'credit',
            label: 'Credit Total',
            type: 'currency',
            accessor: (row) =>
              (row.finance_journal_lines || []).reduce((sum, line) => sum + Number(line.credit || 0), 0),
          },
        ],
        rows: financeJournals,
      },
      generalLedger: {
        title: 'General Ledger',
        columns: [
          { key: 'journal_date', label: 'Date', type: 'date' },
          { key: 'journal_no', label: 'Journal' },
          { key: 'account', label: 'Account', accessor: (row) => `${row.account_code || ''} - ${row.account_name || ''}` },
          { key: 'debit', label: 'Debit', type: 'currency' },
          { key: 'credit', label: 'Credit', type: 'currency' },
          { key: 'narration', label: 'Narration' },
        ],
        rows: generalLedger,
        totals: {
          Debit: fmt(generalLedger.reduce((sum, line) => sum + Number(line.debit || 0), 0)),
          Credit: fmt(generalLedger.reduce((sum, line) => sum + Number(line.credit || 0), 0)),
        },
      },
      accountStatement: {
        title: 'Account Statement',
        columns: [
          { key: 'journal_date', label: 'Date', type: 'date' },
          { key: 'account', label: 'Account', accessor: (row) => `${row.account_code || ''} - ${row.account_name || ''}` },
          { key: 'debit', label: 'Debit', type: 'currency' },
          { key: 'credit', label: 'Credit', type: 'currency' },
          { key: 'running_balance', label: 'Running Balance', type: 'currency' },
        ],
        rows: accountStatement,
        filters: {
          Account:
            statementAccountId === 'all'
              ? 'All Accounts'
              : financeAccounts.find((account) => account.id === statementAccountId)?.account_name || statementAccountId,
        },
      },
      trialBalance: {
        title: 'Trial Balance',
        columns: [
          { key: 'account', label: 'Account', accessor: (row) => `${row.account_code || ''} - ${row.account_name || ''}` },
          { key: 'account_type', label: 'Type' },
          { key: 'debit_total', label: 'Debit Total', type: 'currency' },
          { key: 'credit_total', label: 'Credit Total', type: 'currency' },
          { key: 'balance', label: 'Balance', type: 'currency' },
        ],
        rows: trialBalance,
        totals: {
          Debit: fmt(trialBalance.reduce((sum, account) => sum + Number(account.debit_total || 0), 0)),
          Credit: fmt(trialBalance.reduce((sum, account) => sum + Number(account.credit_total || 0), 0)),
        },
      },
      arAgeing: {
        title: 'Accounts Receivable Ageing',
        columns: ageingColumns,
        rows: arAgeingRows,
        totals: { Balance: fmt(accountsReceivable.totalBalance) },
      },
      outstandingInvoices: {
        title: 'Outstanding Invoices',
        columns: [
          { key: 'invoice_number', label: 'Invoice' },
          { key: 'customerName', label: 'Customer' },
          { key: 'due_date', label: 'Due Date', type: 'date', accessor: (row) => row.due_date || row.created_at },
          { key: 'ageDays', label: 'Age Days', type: 'number' },
          { key: 'outstandingAmount', label: 'Outstanding', type: 'currency' },
        ],
        rows: accountsReceivable.outstandingInvoices,
        totals: { Outstanding: fmt(accountsReceivable.totalBalance) },
      },
      apAgeing: {
        title: 'Accounts Payable Ageing',
        columns: ageingColumns,
        rows: apAgeingRows,
        totals: { Balance: fmt(accountsPayable.totalBalance) },
        metadata: { Scope: 'Confirmed outstanding payables only' },
      },
      outstandingPayables: {
        title: 'Outstanding Payables and Supplier Statements',
        columns: [
          { key: 'documentNumber', label: 'Document' },
          { key: 'supplierName', label: 'Supplier' },
          { key: 'sourceTable', label: 'Source' },
          { key: 'paymentStateLabel', label: 'Payment State' },
          { key: 'ageDays', label: 'Age Days', type: 'number' },
          { key: 'outstandingAmount', label: 'Amount', type: 'currency' },
        ],
        rows: accountsPayable.statementItems,
        totals: {
          'Confirmed Outstanding': fmt(accountsPayable.totalBalance),
          'Provisional / Unverified': fmt(accountsPayable.provisionalBalance),
        },
        metadata: { Scope: 'Payment-indicated expenses are visible but excluded from confirmed AP balance' },
      },
      generalRequestsAwaitingFinance: {
        title: 'General Requests Awaiting Finance',
        columns: [
          { key: 'request_type', label: 'Type' },
          { key: 'requested_by_name', label: 'Requester' },
          { key: 'department', label: 'Department' },
          { key: 'purpose', label: 'Purpose' },
          { key: 'finance_status', label: 'Finance Status' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'created_at', label: 'Created', type: 'date' },
        ],
        rows: generalRequests.filter(isGeneralRequestReadyForFinance),
        totals: {
          Amount: fmt(
            generalRequests
              .filter(isGeneralRequestReadyForFinance)
              .reduce((sum, request) => sum + getGeneralRequestAmount(request), 0)
          ),
        },
        metadata: { Source: 'fund_requests.finance_status = ready_for_disbursement' },
      },
      budgets: {
        title: 'Budget Report',
        columns: [
          { key: 'department', label: 'Department' },
          { key: 'period_start', label: 'Start', type: 'date' },
          { key: 'period_end', label: 'End', type: 'date' },
          { key: 'budget_amount', label: 'Budget', type: 'currency' },
          { key: 'spent_amount', label: 'Spent', type: 'currency' },
          { key: 'pending_amount', label: 'Pending', type: 'currency' },
          {
            key: 'remaining',
            label: 'Remaining',
            type: 'currency',
            accessor: (row) =>
              Number(row.budget_amount || 0) - Number(row.spent_amount || 0) - Number(row.pending_amount || 0),
          },
        ],
        rows: budgets,
      },
      bankAccounts: {
        title: 'Bank Accounts',
        columns: [
          { key: 'bank_name', label: 'Bank' },
          { key: 'account_name', label: 'Account Name' },
          { key: 'account_number', label: 'Account Number' },
          { key: 'current_balance', label: 'Current Balance', type: 'currency' },
          {
            key: 'gl_account',
            label: 'GL Account',
            accessor: (row) => row.finance_accounts?.account_name || 'No GL account linked',
          },
        ],
        rows: bankAccounts,
        totals: {
          'Total Balance': fmt(bankAccounts.reduce((sum, bank) => sum + Number(bank.current_balance || 0), 0)),
        },
      },
      fixedAssets: {
        title: 'Fixed Asset Register',
        columns: [
          { key: 'asset_code', label: 'Asset ID' },
          { key: 'asset_name', label: 'Asset' },
          { key: 'serial_number', label: 'Serial Number' },
          { key: 'assigned_department', label: 'Department' },
          { key: 'current_location', label: 'Location' },
          { key: 'purchase_cost', label: 'Purchase Cost', type: 'currency' },
          { key: 'current_book_value', label: 'Book Value', type: 'currency' },
          { key: 'status', label: 'Status' },
        ],
        rows: fixedAssets,
      },
    };
  }, [
    accountStatement,
    accountsPayable,
    accountsReceivable,
    budgets,
    bankAccounts,
    financeAccounts,
    financeJournals,
    fixedAssets,
    generalRequests,
    generalLedger,
    statementAccountId,
    trialBalance,
  ]);

  const monthlyIncome = Array.from({ length: 6 }, (_, i) => {    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));

    const m = d.toLocaleString('default', { month: 'short' });
    const y = d.getFullYear();
    const mo = d.getMonth();

    const total = invoices
      .filter((inv) => {
        if (inv.status !== 'paid' || !inv.paid_date) return false;

        const paid = new Date(inv.paid_date);

        return paid.getMonth() === mo && paid.getFullYear() === y;
      })
      .reduce((s, inv) => s + Number(inv.amount || 0), 0);

    return {
      month: m,
      income: total,
    };
  });

  const expByCategory = EXPENSE_CATEGORIES.map((cat) => ({
    name: cat,
    value: expenses
      .filter((e) => e.category === cat && normalize(e.approval_status) !== 'rejected')
      .reduce((s, e) => s + Number(e.amount || 0), 0),
  })).filter((c) => c.value > 0);

  const fi = (k, v) =>
    setInvForm((p) => ({
      ...p,
      [k]: v,
    }));

  const fe = (k, v) =>
    setExpForm((p) => ({
      ...p,
      [k]: v,
    }));

  const financeAccountName = (accountId) => {
    const account = financeAccounts.find((item) => item.id === accountId);
    return account ? `${account.account_code} - ${account.account_name}` : 'No account';
  };

  const setJournalLine = (index, field, value) => {
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const addJournalLine = () => {
    setJournalForm((current) => ({
      ...current,
      lines: [...current.lines, { ...EMPTY_JOURNAL_LINE }],
    }));
  };

  const removeJournalLine = (index) => {
    setJournalForm((current) => ({
      ...current,
      lines:
        current.lines.length <= 2
          ? current.lines
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const journalTotals = useMemo(() => {
    return journalForm.lines.reduce(
      (totals, line) => ({
        debit: totals.debit + Number(line.debit || 0),
        credit: totals.credit + Number(line.credit || 0),
      }),
      { debit: 0, credit: 0 }
    );
  }, [journalForm.lines]);

  const saveAccount = async () => {
    if (!allowAddFinanceRecords) {
      alert('You do not have permission to add finance accounts.');
      return;
    }

    try {
      setSavingAccount(true);

      const { error } = await supabase.from('finance_accounts').insert({
        account_code: accountForm.account_code.trim(),
        account_name: accountForm.account_name.trim(),
        account_type: accountForm.account_type,
        normal_balance: accountForm.normal_balance,
        parent_account_id:
          accountForm.parent_account_id === 'none' ? null : accountForm.parent_account_id,
        description: accountForm.description || null,
      });

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['finance_accounts'] });
      setAccountForm(EMPTY_ACCOUNT);
      setAccountOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to save account');
    } finally {
      setSavingAccount(false);
    }
  };

  const saveJournal = async () => {
    if (!allowJournalDrafts) {
      alert('You do not have permission to create journal entries.');
      return;
    }

    const parsedLines = journalForm.lines
      .map((line, index) => ({
        ...line,
        line_no: index + 1,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        hasText:
          Boolean(line.account_id) ||
          String(line.debit || '').trim() !== '' ||
          String(line.credit || '').trim() !== '' ||
          String(line.description || '').trim() !== '' ||
          String(line.department || '').trim() !== '',
      }));

    const invalidLines = parsedLines.filter((line) => {
      if (!line.hasText) return false;

      const hasDebit = line.debit > 0;
      const hasCredit = line.credit > 0;

      return !line.account_id || hasDebit === hasCredit;
    });

    if (invalidLines.length > 0) {
      alert('Each journal line must have an account and either debit or credit, not both.');
      return;
    }

    const cleanLines = parsedLines.filter(
      (line) => line.account_id && (line.debit > 0 || line.credit > 0)
    );

    const debitTotal =
      Math.round(cleanLines.reduce((sum, line) => sum + line.debit, 0) * 100) / 100;
    const creditTotal =
      Math.round(cleanLines.reduce((sum, line) => sum + line.credit, 0) * 100) / 100;

    if (cleanLines.length < 2 || debitTotal !== creditTotal || debitTotal <= 0) {
      alert('Journal must have at least two balanced lines before saving.');
      return;
    }

    try {
      setSavingJournal(true);

      const { data: journalNo, error: noError } = await supabase.rpc(
        'finance_generate_journal_no',
        {
          p_prefix: 'JV',
          p_journal_date: journalForm.journal_date,
        }
      );

      if (noError) throw noError;

      const { data: journal, error: journalError } = await supabase
        .from('finance_journals')
        .insert({
          journal_no: journalNo,
          journal_date: journalForm.journal_date,
          status: 'draft',
          narration: journalForm.narration,
          created_by: user?.id || null,
          created_by_name: user?.full_name || user?.name || user?.email || null,
        })
        .select('id')
        .single();

      if (journalError) throw journalError;

      const { error: lineError } = await supabase.from('finance_journal_lines').insert(
        cleanLines.map((line) => ({
          journal_id: journal.id,
          line_no: line.line_no,
          account_id: line.account_id,
          debit: line.debit,
          credit: line.credit,
          description: line.description || null,
          department: line.department || null,
        }))
      );

      if (lineError) throw lineError;

      qc.invalidateQueries({ queryKey: ['finance_journals'] });
      qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
      qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });
      setJournalForm(EMPTY_JOURNAL);
      setJournalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to save journal entry');
    } finally {
      setSavingJournal(false);
    }
  };

  const getActorName = () => user?.full_name || user?.name || user?.email || 'Finance';

  const logJournalAudit = async ({
    journal,
    action,
    previousStatus,
    newStatus,
    reason,
    extra = {},
  }) => {
    const timestamp = new Date().toISOString();

    const { error } = await supabase.from('finance_audit_logs').insert({
      entity_table: 'finance_journals',
      entity_id: String(journal.id),
      action,
      previous_value: {
        journal_no: journal.journal_no,
        status: previousStatus,
        ...extra.previous_value,
      },
      new_value: {
        journal_no: journal.journal_no,
        status: newStatus,
        reason: reason || null,
        timestamp,
        ...extra.new_value,
      },
      changed_by: user?.id || null,
      changed_by_name: getActorName(),
      created_at: timestamp,
    });

    if (error) throw error;
  };

  const refreshJournalQueries = async () => {
    await qc.invalidateQueries({ queryKey: ['finance_journals'] });
    await qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
    await qc.invalidateQueries({ queryKey: ['finance_account_statement_view'] });
    await qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });
  };

  const updateJournalStatus = async (journal, nextStatus, payload = {}, audit = {}) => {
    const previousStatus = journal.status;

    const { error } = await supabase
      .from('finance_journals')
      .update({
        ...payload,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', journal.id);

    if (error) throw error;

    await logJournalAudit({
      journal,
      action: audit.action,
      previousStatus,
      newStatus: nextStatus,
      reason: audit.reason,
      extra: audit.extra,
    });

    await refreshJournalQueries();
  };

  const submitJournalForReview = async (journal) => {
    if (!canSubmitJournal(user)) {
      alert('You do not have permission to submit journals.');
      return;
    }

    if (journal.status !== 'draft' && journal.status !== 'rejected') {
      alert('Only draft or rejected journals can be submitted for review.');
      return;
    }

    try {
      setJournalActionBusy(`${journal.id}:submit`);
      await updateJournalStatus(
        journal,
        'pending_review',
        { rejection_reason: null },
        {
          action: 'journal_submitted_for_review',
        }
      );
    } catch (err) {
      alert(err.message || 'Failed to submit journal.');
    } finally {
      setJournalActionBusy(null);
    }
  };

  const approveJournal = async (journal) => {
    if (!canApproveJournal(user)) {
      alert('You do not have permission to approve journals.');
      return;
    }

    if (journal.status !== 'pending_review') {
      alert('Only pending review journals can be approved.');
      return;
    }

    try {
      setJournalActionBusy(`${journal.id}:approve`);
      await updateJournalStatus(
        journal,
        'approved',
        {
          reviewed_by: user?.id || null,
          reviewed_by_name: getActorName(),
          reviewed_at: new Date().toISOString(),
          approved_by: user?.id || null,
          approved_by_name: getActorName(),
          approved_at: new Date().toISOString(),
        },
        { action: 'journal_approved' }
      );
    } catch (err) {
      alert(err.message || 'Failed to approve journal.');
    } finally {
      setJournalActionBusy(null);
    }
  };

  const rejectJournal = async (journal) => {
    if (!canApproveJournal(user)) {
      alert('You do not have permission to reject journals.');
      return;
    }

    if (!['pending_review', 'approved'].includes(journal.status)) {
      alert('Only pending or approved journals can be rejected.');
      return;
    }

    const reason = window.prompt('Reason for rejection?');

    if (!reason || !reason.trim()) return;

    try {
      setJournalActionBusy(`${journal.id}:reject`);
      await updateJournalStatus(
        journal,
        'rejected',
        {
          rejection_reason: reason.trim(),
        },
        {
          action: 'journal_rejected',
          reason: reason.trim(),
        }
      );
    } catch (err) {
      alert(err.message || 'Failed to reject journal.');
    } finally {
      setJournalActionBusy(null);
    }
  };

  const postJournal = async (journal) => {
    if (!canPostJournal(user)) {
      alert('You do not have permission to post journals.');
      return;
    }

    if (journal.status !== 'approved') {
      alert('Only approved journals can be posted.');
      return;
    }

    try {
      setJournalActionBusy(`${journal.id}:post`);

      const { error: validationError } = await supabase.rpc(
        'finance_validate_balanced_journal',
        { p_journal_id: journal.id }
      );

      if (validationError) throw validationError;

      await updateJournalStatus(
        journal,
        'posted',
        {
          posted_by: user?.id || null,
          posted_by_name: getActorName(),
          posted_at: new Date().toISOString(),
        },
        {
          action: 'journal_posted',
        }
      );
    } catch (err) {
      alert(err.message || 'Failed to post journal.');
    } finally {
      setJournalActionBusy(null);
    }
  };

  const createJournalReversal = async (journal) => {
    if (!canPostJournal(user)) {
      alert('You do not have permission to reverse journals.');
      return;
    }

    if (journal.status !== 'posted') {
      alert('Only posted journals can be reversed.');
      return;
    }

    const reason = window.prompt('Reason for reversal?');

    if (!reason || !reason.trim()) return;

    try {
      setJournalActionBusy(`${journal.id}:reverse`);

      const { data: reversalId, error } = await supabase.rpc(
        'finance_create_reversal_journal',
        {
          p_original_journal_id: journal.id,
          p_created_by: user?.id || null,
          p_created_by_name: getActorName(),
          p_narration: `Reversal for ${journal.journal_no}: ${reason.trim()}`,
        }
      );

      if (error) throw error;

      await logJournalAudit({
        journal,
        action: 'journal_reversal_created',
        previousStatus: journal.status,
        newStatus: journal.status,
        reason: reason.trim(),
        extra: {
          new_value: {
            reversal_journal_id: reversalId,
          },
        },
      });

      await refreshJournalQueries();
    } catch (err) {
      alert(err.message || 'Failed to create reversal journal.');
    } finally {
      setJournalActionBusy(null);
    }
  };

  const findFinanceAccountByCode = async (codes = []) => {
    const { data, error } = await supabase
      .from('finance_accounts')
      .select('id, account_code, account_name')
      .in('account_code', codes)
      .eq('is_active', true);

    if (error) throw error;

    return codes
      .map((code) => (data || []).find((account) => account.account_code === code))
      .find(Boolean);
  };

  const createPaidInvoiceDraftJournal = async (invoice) => {
    const amount = Number(invoice?.amount || 0);

    if (!invoice?.id || !Number.isFinite(amount) || amount <= 0) return false;

    const { data: existingJournal, error: existingError } = await supabase
      .from('finance_journals')
      .select('id')
      .eq('source_table', 'invoices')
      .eq('source_id', String(invoice.id))
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingJournal?.id) return false;

    const paymentText = normalize(`${invoice.payment_mode || ''} ${invoice.payment_source || ''}`);
    const invoiceText = normalize(`${invoice.payment_source || ''} ${invoice.description || ''}`);

    const debitAccount = paymentText.includes('cash')
      ? await findFinanceAccountByCode(['1010'])
      : paymentText.includes('receivable') || paymentText.includes('credit')
        ? await findFinanceAccountByCode(['1040'])
        : await findFinanceAccountByCode(['1020', '1010']);

    const creditAccount =
      invoiceText.includes('product') ||
      invoiceText.includes('sale') ||
      invoiceText.includes('part') ||
      invoiceText.includes('inventory')
        ? await findFinanceAccountByCode(['4020', '4010'])
        : await findFinanceAccountByCode(['4010', '4020']);

    if (!debitAccount || !creditAccount) {
      throw new Error('Required finance accounts were not found for invoice journal.');
    }

    const journalDate =
      invoice.paid_date || new Date().toISOString().slice(0, 10);

    const { data: journalNo, error: noError } = await supabase.rpc(
      'finance_generate_journal_no',
      {
        p_prefix: 'INV',
        p_journal_date: journalDate,
      }
    );

    if (noError) throw noError;

    const { data: journal, error: journalError } = await supabase
      .from('finance_journals')
      .insert({
        journal_no: journalNo,
        journal_date: journalDate,
        source_module: 'finance',
        source_table: 'invoices',
        source_id: String(invoice.id),
        status: 'draft',
        narration: `Paid invoice ${invoice.invoice_number || invoice.id} - ${invoice.client_name || 'Customer'}`,
        created_by: user?.id || null,
        created_by_name: user?.full_name || user?.name || user?.email || null,
      })
      .select('id')
      .single();

    if (journalError) throw journalError;

    const { error: lineError } = await supabase.from('finance_journal_lines').insert([
      {
        journal_id: journal.id,
        line_no: 1,
        account_id: debitAccount.id,
        debit: amount,
        credit: 0,
        description: `Payment received for invoice ${invoice.invoice_number || invoice.id}`,
      },
      {
        journal_id: journal.id,
        line_no: 2,
        account_id: creditAccount.id,
        debit: 0,
        credit: amount,
        description: invoice.description || invoice.payment_source || 'Invoice revenue',
      },
    ]);

    if (lineError) {
      await supabase
        .from('finance_journals')
        .delete()
        .eq('id', journal.id)
        .eq('status', 'draft');

      throw lineError;
    }

    return true;
  };

  const getExpenseAccountCodes = (expense = {}) => {
    const text = normalize(`${expense.category || ''} ${expense.description || ''}`);

    if (text.includes('salary') || text.includes('payroll')) return ['5010', '5060'];
    if (text.includes('fuel')) return ['5020', '5060'];
    if (text.includes('repair') || text.includes('maintenance')) return ['5030', '5070', '5060'];
    if (text.includes('electric') || text.includes('utility') || text.includes('utilities')) {
      return ['5040', '5060'];
    }
    if (text.includes('rent')) return ['5050', '5060'];
    if (text.includes('procurement') || text.includes('part') || text.includes('inventory')) {
      return ['5080', '5060'];
    }

    return ['5060'];
  };

  const createApprovedExpenseDraftJournal = async (expense) => {
    const amount = Number(expense?.amount || 0);

    if (!expense?.id || !Number.isFinite(amount) || amount <= 0) return false;

    const { data: existingJournal, error: existingError } = await supabase
      .from('finance_journals')
      .select('id')
      .eq('source_table', 'expenses')
      .eq('source_id', String(expense.id))
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingJournal?.id) return false;

    const expenseAccount = await findFinanceAccountByCode(getExpenseAccountCodes(expense));
    const paymentText = normalize(expense.payment_method || '');
    const creditAccount = paymentText.includes('cash')
      ? await findFinanceAccountByCode(['1010'])
      : await findFinanceAccountByCode(['1020', '1010']);

    if (!expenseAccount || !creditAccount) {
      throw new Error('Required finance accounts were not found for expense journal.');
    }

    const journalDate =
      expense.expense_date ||
      expense.approved_date?.slice?.(0, 10) ||
      new Date().toISOString().slice(0, 10);

    const { data: journalNo, error: noError } = await supabase.rpc(
      'finance_generate_journal_no',
      {
        p_prefix: 'EXP',
        p_journal_date: journalDate,
      }
    );

    if (noError) throw noError;

    const { data: journal, error: journalError } = await supabase
      .from('finance_journals')
      .insert({
        journal_no: journalNo,
        journal_date: journalDate,
        source_module: 'finance',
        source_table: 'expenses',
        source_id: String(expense.id),
        status: 'draft',
        narration: `Approved expense ${expense.expense_number || expense.id} - ${expense.category || 'Expense'}`,
        created_by: user?.id || null,
        created_by_name: user?.full_name || user?.name || user?.email || null,
      })
      .select('id')
      .single();

    if (journalError) throw journalError;

    const { error: lineError } = await supabase.from('finance_journal_lines').insert([
      {
        journal_id: journal.id,
        line_no: 1,
        account_id: expenseAccount.id,
        debit: amount,
        credit: 0,
        description: expense.description || expense.category || 'Approved expense',
      },
      {
        journal_id: journal.id,
        line_no: 2,
        account_id: creditAccount.id,
        debit: 0,
        credit: amount,
        description: `Payment for expense ${expense.expense_number || expense.id}`,
      },
    ]);

    if (lineError) {
      await supabase
        .from('finance_journals')
        .delete()
        .eq('id', journal.id)
        .eq('status', 'draft');

      throw lineError;
    }

    return true;
  };

  const logExpenseRequestHistory = async (request, action, previousStatus, newStatus, comments, metadata = {}) => {
    const { error } = await supabase.from('finance_expense_request_history').insert({
      expense_request_id: request.id,
      actor_user_id: user?.id || null,
      actor_email: user?.email || user?.user_email || null,
      actor_name: user?.full_name || user?.name || user?.email || 'User',
      action,
      previous_status: previousStatus || null,
      new_status: newStatus || null,
      comments: comments || null,
      metadata,
    });

    if (error) console.warn('Expense request history log failed:', error.message);
  };

  const notifyExpenseRequester = async (request, title, message) => {
    if (!request?.requester_email) return;
    await notifyUser({
      email: request.requester_email,
      name: request.requester_name,
      title,
      message,
      type: 'finance',
      link: '/finance',
      data: { expense_request_id: request.id, request_number: request.request_number },
      sendEmail: false,
    });
  };

  const notifyFinanceExpenseRequest = async (request) => {
    await notifyUser({
      email: user?.email || request?.requester_email,
      title: 'Expense request ready for Finance',
      message: `${request.request_number} is ready for Finance review.`,
      type: 'finance',
      link: '/finance',
      data: { expense_request_id: request.id, request_number: request.request_number },
      sendEmail: false,
    });
  };

  const createExpenseRequestPaymentDraftJournal = async (request, payment) => {
    const amount = Number(payment?.amount_paid || 0);
    if (!request?.id || !payment?.id || !Number.isFinite(amount) || amount <= 0) return false;

    const { data: existingJournal, error: existingError } = await supabase
      .from('finance_journals')
      .select('id')
      .eq('source_table', 'finance_expense_payments')
      .eq('source_id', String(payment.id))
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingJournal?.id) return false;

    const expenseAccount = await findFinanceAccountByCode(
      getExpenseAccountCodes({
        category: request.expense_category,
        description: `${request.purpose || ''} ${request.description || ''}`,
      })
    );
    const paymentText = normalize(payment.payment_method || '');
    const creditAccount = paymentText.includes('cash')
      ? await findFinanceAccountByCode(['1010'])
      : await findFinanceAccountByCode(['1020', '1010']);

    if (!expenseAccount || !creditAccount) {
      throw new Error('Required finance accounts were not found for expense request payment journal.');
    }

    const journalDate = payment.payment_date || new Date().toISOString().slice(0, 10);
    const { data: journalNo, error: noError } = await supabase.rpc('finance_generate_journal_no', {
      p_prefix: 'ERP',
      p_journal_date: journalDate,
    });

    if (noError) throw noError;

    const { data: journal, error: journalError } = await supabase
      .from('finance_journals')
      .insert({
        journal_no: journalNo,
        journal_date: journalDate,
        source_module: 'finance',
        source_table: 'finance_expense_payments',
        source_id: String(payment.id),
        status: 'draft',
        narration: `Expense request payment ${request.request_number} - ${request.purpose}`,
        created_by: user?.id || null,
        created_by_name: user?.full_name || user?.name || user?.email || null,
      })
      .select('id')
      .single();

    if (journalError) throw journalError;

    const { error: lineError } = await supabase.from('finance_journal_lines').insert([
      {
        journal_id: journal.id,
        line_no: 1,
        account_id: expenseAccount.id,
        debit: amount,
        credit: 0,
        description: request.purpose || 'Expense request payment',
        department: request.department || null,
      },
      {
        journal_id: journal.id,
        line_no: 2,
        account_id: creditAccount.id,
        debit: 0,
        credit: amount,
        description: payment.payment_reference || `Payment ${payment.payment_number}`,
        department: request.department || null,
      },
    ]);

    if (lineError) {
      await supabase.from('finance_journals').delete().eq('id', journal.id).eq('status', 'draft');
      throw lineError;
    }

    await supabase
      .from('finance_expense_payments')
      .update({ journal_id: journal.id })
      .eq('id', payment.id);

    return journal.id;
  };

  const getPOFundReleaseAccountCodes = (lpo = {}) => {
    const itemsText = getPOItems(lpo)
      .map((item) => `${item.category || ''} ${item.description || ''} ${item.part_number || ''}`)
      .join(' ');
    const text = normalize(`${lpo.category || ''} ${lpo.title || ''} ${lpo.description || ''} ${itemsText}`);

    if (
      text.includes('inventory') ||
      text.includes('stock') ||
      text.includes('spare') ||
      text.includes('part')
    ) {
      return ['1030', '5080', '5060'];
    }

    if (
      text.includes('procurement') ||
      text.includes('purchase') ||
      text.includes('supplier') ||
      text.includes('material')
    ) {
      return ['5080', '1030', '5060'];
    }

    if (text.includes('repair') || text.includes('maintenance')) return ['5030', '5070', '5060'];
    if (text.includes('fuel') || text.includes('logistic') || text.includes('transport')) return ['5020', '5060'];
    if (text.includes('electric') || text.includes('utility') || text.includes('utilities')) {
      return ['5040', '5060'];
    }
    if (text.includes('rent')) return ['5050', '5060'];

    return ['5060'];
  };

  const createPOFundReleaseDraftJournal = async (lpo) => {
    const amount = getPOTotal(lpo);

    if (!lpo?.id || !Number.isFinite(amount) || amount <= 0) return false;

    const { data: existingJournal, error: existingError } = await supabase
      .from('finance_journals')
      .select('id')
      .eq('source_table', 'lpos')
      .eq('source_id', String(lpo.id))
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingJournal?.id) return false;

    const debitAccount = await findFinanceAccountByCode(getPOFundReleaseAccountCodes(lpo));
    const paymentText = normalize(`${lpo.payment_method || ''} ${lpo.payment_mode || ''} ${lpo.funding_source || ''}`);
    const creditAccount = paymentText.includes('cash')
      ? await findFinanceAccountByCode(['1010'])
      : await findFinanceAccountByCode(['1020', '1010']);

    if (!debitAccount || !creditAccount) {
      throw new Error('Required finance accounts were not found for PO fund release journal.');
    }

    const journalDate = new Date().toISOString().slice(0, 10);

    const { data: journalNo, error: noError } = await supabase.rpc(
      'finance_generate_journal_no',
      {
        p_prefix: 'PO',
        p_journal_date: journalDate,
      }
    );

    if (noError) throw noError;

    const { data: journal, error: journalError } = await supabase
      .from('finance_journals')
      .insert({
        journal_no: journalNo,
        journal_date: journalDate,
        source_module: 'finance',
        source_table: 'lpos',
        source_id: String(lpo.id),
        status: 'draft',
        narration: `PO fund release ${lpo.lpo_number || lpo.id} - ${getPOSupplier(lpo)}`,
        created_by: user?.id || null,
        created_by_name: user?.full_name || user?.name || user?.email || null,
      })
      .select('id')
      .single();

    if (journalError) throw journalError;

    const { error: lineError } = await supabase.from('finance_journal_lines').insert([
      {
        journal_id: journal.id,
        line_no: 1,
        account_id: debitAccount.id,
        debit: amount,
        credit: 0,
        description: `PO fund release for ${lpo.lpo_number || lpo.id}`,
      },
      {
        journal_id: journal.id,
        line_no: 2,
        account_id: creditAccount.id,
        debit: 0,
        credit: amount,
        description: `Bank/cash release for ${lpo.lpo_number || lpo.id}`,
      },
    ]);

    if (lineError) {
      await supabase
        .from('finance_journals')
        .delete()
        .eq('id', journal.id)
        .eq('status', 'draft');

      throw lineError;
    }

    return true;
  };

  const getDispatchFundAccountCodes = (fundRequest = {}) => {
    const text = normalize(
      `${fundRequest.logistics_type || ''} ${fundRequest.reason || ''} ${fundRequest.inventory_note || ''} ${fundRequest.part_name || ''} ${fundRequest.part_number || ''} ${fundRequest.destination || ''}`
    );

    if (text.includes('fuel')) return ['5020', '5060'];
    if (text.includes('waybill') || text.includes('logistic') || text.includes('transport')) {
      return ['5020', '5060'];
    }
    if (text.includes('repair') || text.includes('maintenance')) return ['5030', '5070', '5060'];
    if (text.includes('part') || text.includes('spare') || text.includes('inventory')) {
      return ['5080', '5060'];
    }

    return ['5060'];
  };

  const createDispatchFundDraftJournal = async (fundRequest) => {
    const amount = Number(fundRequest?.approved_amount || fundRequest?.requested_amount || 0);

    if (!fundRequest?.id || !Number.isFinite(amount) || amount <= 0) return false;

    const { data: existingJournal, error: existingError } = await supabase
      .from('finance_journals')
      .select('id')
      .eq('source_table', 'inventory_dispatch_fund_requests')
      .eq('source_id', String(fundRequest.id))
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingJournal?.id) return false;

    const debitAccount = await findFinanceAccountByCode(getDispatchFundAccountCodes(fundRequest));
    const paymentText = normalize(
      `${fundRequest.payment_method || ''} ${fundRequest.payment_mode || ''} ${fundRequest.funding_source || ''}`
    );
    const creditAccount = paymentText.includes('cash')
      ? await findFinanceAccountByCode(['1010'])
      : await findFinanceAccountByCode(['1020', '1010']);

    if (!debitAccount || !creditAccount) {
      throw new Error('Required finance accounts were not found for dispatch fund journal.');
    }

    const journalDate =
      fundRequest.disbursed_at?.slice?.(0, 10) ||
      fundRequest.approved_at?.slice?.(0, 10) ||
      fundRequest.updated_at?.slice?.(0, 10) ||
      new Date().toISOString().slice(0, 10);

    const { data: journalNo, error: noError } = await supabase.rpc(
      'finance_generate_journal_no',
      {
        p_prefix: 'DF',
        p_journal_date: journalDate,
      }
    );

    if (noError) throw noError;

    const { data: journal, error: journalError } = await supabase
      .from('finance_journals')
      .insert({
        journal_no: journalNo,
        journal_date: journalDate,
        source_module: 'finance',
        source_table: 'inventory_dispatch_fund_requests',
        source_id: String(fundRequest.id),
        status: 'draft',
        narration: `Dispatch fund ${fundRequest.part_name || fundRequest.part_number || fundRequest.id} - ${getFundEngineerName(fundRequest)}`,
        created_by: user?.id || null,
        created_by_name: user?.full_name || user?.name || user?.email || null,
      })
      .select('id')
      .single();

    if (journalError) throw journalError;

    const { error: lineError } = await supabase.from('finance_journal_lines').insert([
      {
        journal_id: journal.id,
        line_no: 1,
        account_id: debitAccount.id,
        debit: amount,
        credit: 0,
        description: `Dispatch fund for ${fundRequest.part_name || fundRequest.part_number || fundRequest.id}`,
      },
      {
        journal_id: journal.id,
        line_no: 2,
        account_id: creditAccount.id,
        debit: 0,
        credit: amount,
        description: `Bank/cash disbursement for dispatch fund ${fundRequest.id}`,
      },
    ]);

    if (lineError) {
      await supabase
        .from('finance_journals')
        .delete()
        .eq('id', journal.id)
        .eq('status', 'draft');

      throw lineError;
    }

    return true;
  };

  const createHistoricalBackfillDraftJournals = async () => {
    if (!allowJournalDrafts) {
      alert('You do not have permission to create draft journals.');
      return;
    }

    if (backfillSourcesError) {
      alert('Cannot backfill until existing journal links load successfully.');
      return;
    }

    if (backfillPreview.pendingCount === 0) {
      alert('There are no eligible historical records left to backfill.');
      return;
    }

    const confirmed = window.confirm(
      `Create ${backfillPreview.pendingCount} draft journal(s) from eligible historical finance records?`
    );

    if (!confirmed) return;

    const failures = [];
    let createdCount = 0;

    try {
      setBackfillBusy(true);

      for (const invoice of backfillPreview.rows.find((row) => row.key === 'invoices')?.pendingRecords || []) {
        try {
          if (await createPaidInvoiceDraftJournal(invoice)) createdCount += 1;
        } catch (err) {
          failures.push(`Invoice ${invoice.invoice_number || invoice.id}: ${err.message}`);
        }
      }

      for (const expense of backfillPreview.rows.find((row) => row.key === 'expenses')?.pendingRecords || []) {
        try {
          if (await createApprovedExpenseDraftJournal(expense)) createdCount += 1;
        } catch (err) {
          failures.push(`Expense ${expense.expense_number || expense.id}: ${err.message}`);
        }
      }

      for (const lpo of backfillPreview.rows.find((row) => row.key === 'lpos')?.pendingRecords || []) {
        try {
          if (await createPOFundReleaseDraftJournal(lpo)) createdCount += 1;
        } catch (err) {
          failures.push(`LPO ${lpo.lpo_number || lpo.id}: ${err.message}`);
        }
      }

      for (const fundRequest of backfillPreview.rows.find((row) => row.key === 'dispatch')?.pendingRecords || []) {
        try {
          if (await createDispatchFundDraftJournal(fundRequest)) createdCount += 1;
        } catch (err) {
          failures.push(`Dispatch fund ${fundRequest.id}: ${err.message}`);
        }
      }

      await qc.invalidateQueries({ queryKey: ['finance_journals'] });
      await qc.invalidateQueries({ queryKey: ['finance_journal_sources'] });
      await qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
      await qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });

      if (failures.length > 0) {
        alert(
          `Created ${createdCount} draft journal(s). ${failures.length} record(s) failed:\n\n${failures
            .slice(0, 5)
            .join('\n')}${failures.length > 5 ? '\n...' : ''}`
        );
      } else {
        alert(`Created ${createdCount} draft journal(s).`);
      }
    } finally {
      setBackfillBusy(false);
    }
  };

  const saveBankAccount = async () => {
    if (!allowAddFinanceRecords) {
      alert('You do not have permission to add bank accounts.');
      return;
    }

    try {
      setSavingBank(true);

      const opening = Number(bankForm.opening_balance || 0);
      const current =
        bankForm.current_balance === '' ? opening : Number(bankForm.current_balance || 0);

      const { error } = await supabase.from('finance_bank_accounts').insert({
        account_id: bankForm.account_id === 'none' ? null : bankForm.account_id,
        bank_name: bankForm.bank_name,
        account_name: bankForm.account_name,
        account_number: bankForm.account_number || null,
        currency: bankForm.currency || 'NGN',
        opening_balance: opening,
        current_balance: current,
        created_by: user?.id || null,
      });

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['finance_bank_accounts'] });
      setBankForm(EMPTY_BANK_ACCOUNT);
      setBankOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to save bank account');
    } finally {
      setSavingBank(false);
    }
  };

  const saveBudget = async () => {
    if (!allowAddFinanceRecords) {
      alert('You do not have permission to add budgets.');
      return;
    }

    try {
      setSavingBudget(true);

      const { error } = await supabase.from('finance_budgets').insert({
        department: budgetForm.department,
        account_id: budgetForm.account_id === 'none' ? null : budgetForm.account_id,
        period_start: budgetForm.period_start,
        period_end: budgetForm.period_end,
        budget_amount: Number(budgetForm.budget_amount || 0),
        pending_amount: Number(budgetForm.pending_amount || 0),
        status: budgetForm.status,
        created_by: user?.id || null,
      });

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['finance_budgets'] });
      setBudgetForm(EMPTY_BUDGET);
      setBudgetOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to save budget');
    } finally {
      setSavingBudget(false);
    }
  };

  const saveFixedAsset = async () => {
    if (!allowAddFinanceRecords) {
      alert('You do not have permission to add fixed assets.');
      return;
    }

    try {
      setSavingAsset(true);

      const purchaseCost = Number(assetForm.purchase_cost || 0);

      const { error } = await supabase.from('finance_fixed_assets').insert({
        asset_code: assetForm.asset_code,
        asset_name: assetForm.asset_name,
        asset_type: assetForm.asset_type || null,
        serial_number: assetForm.serial_number || null,
        purchase_date: assetForm.purchase_date || null,
        purchase_cost: purchaseCost,
        account_id: assetForm.account_id === 'none' ? null : assetForm.account_id,
        assigned_department: assetForm.assigned_department || null,
        assigned_employee_name: assetForm.assigned_employee_name || null,
        current_location: assetForm.current_location || null,
        warranty_expiry: assetForm.warranty_expiry || null,
        depreciation_rate: Number(assetForm.depreciation_rate || 0),
        current_book_value: purchaseCost,
        created_by: user?.id || null,
      });

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['finance_fixed_assets'] });
      setAssetForm(EMPTY_FIXED_ASSET);
      setAssetOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to save fixed asset');
    } finally {
      setSavingAsset(false);
    }
  };

  const updateFundForm = (requestId, field, value) => {
    setFundActionForms((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        [field]: value,
      },
    }));
  };

  const getApprovedAmount = (request) => {
    const form = fundActionForms[request.id] || {};

    if (
      form.approved_amount !== undefined &&
      form.approved_amount !== null &&
      String(form.approved_amount).trim() !== ''
    ) {
      return form.approved_amount;
    }

    const savedApprovedAmount = Number(request.approved_amount || 0);

    if (savedApprovedAmount > 0) {
      return savedApprovedAmount;
    }

    return request.requested_amount ?? '';
  };

  const getDisplayApprovedAmount = (request) => {
    const savedApprovedAmount = Number(request.approved_amount || 0);

    if (savedApprovedAmount > 0) {
      return savedApprovedAmount;
    }

    const status = getFundFinanceStatus(request);

    if (['approved', 'disbursed'].includes(status)) {
      return Number(request.requested_amount || 0);
    }

    return 0;
  };

  const getFinanceNote = (request) => {
    const form = fundActionForms[request.id] || {};
    return form.finance_note ?? request.finance_note ?? '';
  };

  const saveInvoice = async () => {
    try {
      if (editingInv && !canManageFinance(user)) {
        alert('You cannot edit finance records. Please submit a correction request for CEO/AGM approval.');
        return;
      }

      if (!editingInv && !canAddFinanceRecord(user)) {
        alert('You do not have permission to add finance records.');
        return;
      }

      setSavingInv(true);

      const payload = {
        client_name: invForm.client_name,
        client_email: invForm.client_email || null,
        description: invForm.description || null,
        amount: parseFloat(invForm.amount) || 0,
        currency: invForm.currency || 'NGN',
        status: invForm.status || 'draft',
        due_date: invForm.due_date || null,
        payment_source: invForm.payment_source || null,
        payment_mode: invForm.payment_mode || null,
        notes: invForm.notes || null,
        invoice_number:
          editingInv?.invoice_number || 'INV-' + Date.now().toString().slice(-6),
        updated_at: new Date().toISOString(),
      };

      let error;

      if (editingInv) {
        ({ error } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', editingInv.id));
      } else {
        ({ error } = await supabase.from('invoices').insert({
          ...payload,
          created_at: new Date().toISOString(),
        }));
      }

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['invoices'] });

      alert(editingInv ? 'Invoice updated' : 'Invoice created');

      setInvForm(EMPTY_INV);
      setEditingInv(null);
      setInvOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save invoice');
    } finally {
      setSavingInv(false);
    }
  };

  const updateInvStatus = async (inv, status) => {
    if (!canManageFinance(user)) {
      alert('You cannot change invoice status. Please submit a correction request for CEO/AGM approval.');
      return;
    }

    const payload = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'paid') {
      payload.paid_date = new Date().toISOString().slice(0, 10);
    }

    const { error } = await supabase
      .from('invoices')
      .update(payload)
      .eq('id', inv.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (status === 'paid') {
      try {
        const journalCreated = await createPaidInvoiceDraftJournal({
          ...inv,
          ...payload,
        });

        if (journalCreated) {
          qc.invalidateQueries({ queryKey: ['finance_journals'] });
          qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
          qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });
        }
      } catch (journalError) {
        console.warn('Invoice was marked paid, but draft journal creation failed.', journalError);
      }
    }

    qc.invalidateQueries({ queryKey: ['invoices'] });
  };

  const deleteInvoice = async (id) => {
    const confirmed = window.confirm('Delete this invoice?');

    if (!confirmed) return;

    const { error } = await supabase.from('invoices').delete().eq('id', id);

    if (error) {
      alert(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ['invoices'] });
  };

  const saveExpenseRequest = async (submit = false) => {
    if (!expenseRequestForm.expense_category || !expenseRequestForm.purpose.trim()) {
      alert('Expense category and purpose are required.');
      return;
    }

    const amountRequested = Number(expenseRequestForm.amount_requested || 0);
    if (!Number.isFinite(amountRequested) || amountRequested <= 0) {
      alert('Amount requested must be greater than zero.');
      return;
    }

    try {
      setSavingExpenseRequest(true);
      const nextStatus = submit ? 'submitted' : 'draft';
      const now = new Date().toISOString();

      let requestNumber = editingExpenseRequest?.request_number;
      if (!requestNumber) {
        const { data, error } = await supabase.rpc('finance_generate_expense_request_no', {
          p_request_date: new Date().toISOString().slice(0, 10),
        });
        if (error) throw error;
        requestNumber = data;
      }

      const payload = {
        request_number: requestNumber,
        requester_user_id: editingExpenseRequest?.requester_user_id || user?.id || null,
        requester_email:
          editingExpenseRequest?.requester_email || user?.email || user?.user_email || null,
        requester_name:
          editingExpenseRequest?.requester_name || user?.full_name || user?.name || user?.email || 'User',
        department: editingExpenseRequest?.department || user?.department || null,
        expense_category: expenseRequestForm.expense_category,
        purpose: expenseRequestForm.purpose.trim(),
        description: expenseRequestForm.description || null,
        supplier_name: expenseRequestForm.supplier_name || null,
        supplier_email: expenseRequestForm.supplier_email || null,
        beneficiary_name: expenseRequestForm.beneficiary_name || null,
        amount_requested: amountRequested,
        amount_approved: Number(expenseRequestForm.amount_approved || 0),
        currency: expenseRequestForm.currency || 'NGN',
        required_date: expenseRequestForm.required_date || null,
        status: nextStatus,
        current_approval_stage: submit ? 'management_review' : 'requester',
        next_approver_role: submit ? 'manager' : null,
        submitted_at: submit ? editingExpenseRequest?.submitted_at || now : editingExpenseRequest?.submitted_at || null,
        updated_by: user?.id || null,
      };

      let savedRequest = null;
      if (editingExpenseRequest?.id) {
        if (!['draft', 'returned_for_correction'].includes(editingExpenseRequest.status)) {
          alert('Only draft or returned requests can be edited.');
          return;
        }
        const { data, error } = await supabase
          .from('finance_expense_requests')
          .update(payload)
          .eq('id', editingExpenseRequest.id)
          .select('*')
          .single();
        if (error) throw error;
        savedRequest = data;
      } else {
        const { data, error } = await supabase
          .from('finance_expense_requests')
          .insert({
            ...payload,
            created_by: user?.id || null,
          })
          .select('*')
          .single();
        if (error) throw error;
        savedRequest = data;
      }

      await logExpenseRequestHistory(
        savedRequest,
        submit ? 'submitted' : editingExpenseRequest ? 'updated' : 'created',
        editingExpenseRequest?.status,
        savedRequest.status,
        submit ? 'Submitted for approval' : 'Saved as draft'
      );

      if (submit) {
        await supabase.from('finance_expense_request_approvals').insert({
          expense_request_id: savedRequest.id,
          approval_stage: 'requester_submission',
          approver_user_id: user?.id || null,
          approver_email: user?.email || user?.user_email || null,
          approver_name: user?.full_name || user?.name || user?.email || 'User',
          decision: 'submitted',
          previous_status: editingExpenseRequest?.status || 'draft',
          new_status: savedRequest.status,
          comments: 'Submitted for review',
        });
      }

      qc.invalidateQueries({ queryKey: ['finance_expense_requests'] });
      setExpenseRequestForm(EMPTY_EXPENSE_REQUEST);
      setEditingExpenseRequest(null);
      setExpenseRequestOpen(false);
      alert(submit ? 'Expense request submitted.' : 'Expense request saved as draft.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save expense request.');
    } finally {
      setSavingExpenseRequest(false);
    }
  };

  const submitExistingExpenseRequest = async (request) => {
    if (!request || !['draft', 'returned_for_correction'].includes(request.status)) {
      alert('Only draft or returned requests can be submitted.');
      return;
    }

    try {
      const previousStatus = request.status;
      const { data: updated, error } = await supabase
        .from('finance_expense_requests')
        .update({
          status: 'submitted',
          current_approval_stage: 'management_review',
          next_approver_role: 'manager',
          submitted_at: request.submitted_at || new Date().toISOString(),
          updated_by: user?.id || null,
        })
        .eq('id', request.id)
        .select('*')
        .single();

      if (error) throw error;

      await supabase.from('finance_expense_request_approvals').insert({
        expense_request_id: request.id,
        approval_stage: 'requester_submission',
        approver_user_id: user?.id || null,
        approver_email: user?.email || user?.user_email || null,
        approver_name: user?.full_name || user?.name || user?.email || 'User',
        decision: 'submitted',
        previous_status: previousStatus,
        new_status: 'submitted',
        comments: 'Submitted for review',
      });

      await logExpenseRequestHistory(updated, 'submitted', previousStatus, 'submitted', 'Submitted for review');
      qc.invalidateQueries({ queryKey: ['finance_expense_requests'] });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to submit expense request.');
    }
  };

  const decideExpenseRequest = async (request, decision) => {
    const requiresComment = ['rejected', 'returned_for_correction'].includes(decision);
    const comments = window.prompt(
      requiresComment ? 'Enter reason/comment. This is required.' : 'Enter approval comment (optional).'
    );

    if (requiresComment && !comments?.trim()) {
      alert('Reason is required.');
      return;
    }

    if (['approved', 'rejected', 'returned_for_correction'].includes(decision) && !canApproveExpenseRequest(request)) {
      alert('You cannot approve your own request or you do not have approval permission.');
      return;
    }

    try {
      const previousStatus = request.status;
      let nextStatus = request.status;
      let nextStage = request.current_approval_stage;
      let paymentStatus = request.payment_status || 'unpaid';
      const payload = { updated_by: user?.id || null };

      if (decision === 'approved') {
        nextStatus = 'pending_finance_review';
        nextStage = 'finance_review';
        payload.amount_approved = Number(request.amount_approved || request.amount_requested || 0);
        payload.approved_at = new Date().toISOString();
      }

      if (decision === 'rejected') {
        nextStatus = 'rejected';
        nextStage = 'closed';
        payload.rejected_at = new Date().toISOString();
      }

      if (decision === 'returned_for_correction') {
        nextStatus = 'returned_for_correction';
        nextStage = 'requester';
        payload.returned_at = new Date().toISOString();
      }

      if (decision === 'approved_for_payment') {
        if (!canFinanceReviewExpenseRequest(request)) {
          alert('Only Finance or authorised management can approve for payment.');
          return;
        }
        nextStatus = 'approved_for_payment';
        nextStage = 'payment';
        paymentStatus = 'unpaid';
        payload.finance_reviewed_at = new Date().toISOString();
      }

      const { data: updated, error } = await supabase
        .from('finance_expense_requests')
        .update({
          ...payload,
          status: nextStatus,
          payment_status: paymentStatus,
          current_approval_stage: nextStage,
        })
        .eq('id', request.id)
        .select('*')
        .single();

      if (error) throw error;

      await supabase.from('finance_expense_request_approvals').insert({
        expense_request_id: request.id,
        approval_stage: request.current_approval_stage || 'management_review',
        approver_role: getFinanceRole(user),
        approver_user_id: user?.id || null,
        approver_email: user?.email || user?.user_email || null,
        approver_name: user?.full_name || user?.name || user?.email || 'Approver',
        decision,
        comments: comments || null,
        previous_status: previousStatus,
        new_status: nextStatus,
      });

      await logExpenseRequestHistory(updated, decision, previousStatus, nextStatus, comments);

      if (decision === 'approved') await notifyFinanceExpenseRequest(updated);
      if (['rejected', 'returned_for_correction', 'approved_for_payment'].includes(decision)) {
        await notifyExpenseRequester(
          updated,
          `Expense request ${EXPENSE_REQUEST_STATUS[nextStatus]?.label || nextStatus}`,
          `${updated.request_number} is now ${EXPENSE_REQUEST_STATUS[nextStatus]?.label || nextStatus}.`
        );
      }

      qc.invalidateQueries({ queryKey: ['finance_expense_requests'] });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to update expense request.');
    }
  };

  const openExpensePayment = (request) => {
    setExpenseRequestForPayment(request);
    setExpensePaymentForm({
      ...EMPTY_EXPENSE_PAYMENT,
      amount_paid: String(getExpenseRequestRemaining(request) || ''),
    });
    setExpenseRequestPaymentOpen(true);
  };

  const recordExpenseRequestPayment = async () => {
    const request = expenseRequestForPayment;
    if (!request) return;

    const amountPaid = Number(expensePaymentForm.amount_paid || 0);
    const remaining = getExpenseRequestRemaining(request);

    if (!canFinanceReviewExpenseRequest(request)) {
      alert('Only Finance or authorised management can record payments.');
      return;
    }

    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    if (amountPaid > remaining) {
      alert('Payment cannot exceed the approved remaining amount.');
      return;
    }

    if (!expensePaymentForm.payment_method) {
      alert('Payment method is required.');
      return;
    }

    try {
      setSavingExpensePayment(true);
      const paymentDate = expensePaymentForm.payment_date || new Date().toISOString().slice(0, 10);
      const { data: paymentNo, error: noError } = await supabase.rpc('finance_generate_expense_payment_no', {
        p_payment_date: paymentDate,
      });
      if (noError) throw noError;

      const { data: payment, error: paymentError } = await supabase
        .from('finance_expense_payments')
        .insert({
          expense_request_id: request.id,
          payment_number: paymentNo,
          amount_paid: amountPaid,
          payment_method: expensePaymentForm.payment_method,
          payment_reference: expensePaymentForm.payment_reference || null,
          bank_account_id:
            expensePaymentForm.bank_account_id === 'none' ? null : expensePaymentForm.bank_account_id,
          payment_date: paymentDate,
          payment_status: 'paid',
          paid_by: user?.id || null,
          paid_by_email: user?.email || user?.user_email || null,
          paid_by_name: user?.full_name || user?.name || user?.email || 'Finance',
          notes: expensePaymentForm.notes || null,
        })
        .select('*')
        .single();

      if (paymentError) throw paymentError;

      const newPaidTotal = getExpenseRequestPaidTotal(request) + amountPaid;
      const approvedAmount = getExpenseRequestApprovedAmount(request);
      const paidInFull = newPaidTotal >= approvedAmount;
      const nextStatus = paidInFull ? 'paid' : 'partially_paid';
      const nextPaymentStatus = paidInFull ? 'paid' : 'partially_paid';

      let resultingExpenseId = request.resulting_expense_id || null;
      if (!resultingExpenseId) {
        const { data: insertedExpense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            category: request.expense_category,
            amount: newPaidTotal,
            currency: request.currency || 'NGN',
            payment_method: expensePaymentForm.payment_method,
            description: request.purpose,
            staff_responsible: request.beneficiary_name || request.requester_name || null,
            staff_email: request.requester_email || null,
            approval_status: 'approved',
            approved_by: user?.email || '',
            approved_date: new Date().toISOString(),
            expense_date: paymentDate,
            notes: request.description || null,
            expense_number: `EXP-${Date.now().toString().slice(-6)}`,
            expense_request_id: request.id,
            expense_source_type: 'request_generated',
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (expenseError) throw expenseError;
        resultingExpenseId = String(insertedExpense.id);
      } else {
        await supabase
          .from('expenses')
          .update({
            amount: newPaidTotal,
            payment_method: expensePaymentForm.payment_method,
            expense_date: paymentDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resultingExpenseId);
      }

      const journalId = await createExpenseRequestPaymentDraftJournal(request, payment);

      const { error: updateError } = await supabase
        .from('finance_expense_requests')
        .update({
          amount_paid: newPaidTotal,
          payment_status: nextPaymentStatus,
          status: nextStatus,
          paid_at: paidInFull ? new Date().toISOString() : request.paid_at || null,
          resulting_expense_id: resultingExpenseId,
          resulting_journal_id: request.resulting_journal_id || journalId || null,
          updated_by: user?.id || null,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      await logExpenseRequestHistory(
        request,
        paidInFull ? 'final_payment_recorded' : 'partial_payment_recorded',
        request.status,
        nextStatus,
        expensePaymentForm.notes,
        { payment_number: payment.payment_number, amount_paid: amountPaid, journal_id: journalId }
      );

      await notifyExpenseRequester(
        request,
        'Expense payment recorded',
        `${fmt(amountPaid)} was recorded for ${request.request_number}.`
      );

      qc.invalidateQueries({ queryKey: ['finance_expense_requests'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance_journals'] });
      qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
      qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });
      setExpenseRequestPaymentOpen(false);
      setExpenseRequestForPayment(null);
      setExpensePaymentForm(EMPTY_EXPENSE_PAYMENT);
      alert('Expense payment recorded and draft journal created.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to record expense payment.');
    } finally {
      setSavingExpensePayment(false);
    }
  };

  const saveExpense = async () => {
    try {
      if (editingExp && !canManageFinance(user)) {
        alert('You cannot edit finance records. Please submit a correction request for CEO/AGM approval.');
        return;
      }

      if (!editingExp && !canAddFinanceRecord(user)) {
        alert('You do not have permission to add finance records.');
        return;
      }

      if (!editingExp) {
        if (!expForm.controlled_exception_type) {
          alert('Direct expense entries are now controlled exceptions. Select an exception type.');
          return;
        }

        if (!expForm.controlled_exception_reason?.trim()) {
          alert('Controlled exception reason is required.');
          return;
        }
      }

      setSavingExp(true);

      const payload = {
        category: expForm.category,
        amount: parseFloat(expForm.amount) || 0,
        currency: 'NGN',
        payment_method: expForm.payment_method,
        description: expForm.description,
        staff_responsible: expForm.staff_responsible || null,
        staff_email: user?.email || '',
        approval_status: editingExp
          ? expForm.approval_status || editingExp.approval_status || 'approved'
          : 'approved',
        approved_by: editingExp
          ? expForm.approved_by || editingExp.approved_by || user?.email || ''
          : user?.email || '',
        approved_date: editingExp
          ? expForm.approved_date || editingExp.approved_date || new Date().toISOString()
          : new Date().toISOString(),
        expense_date: expForm.expense_date || null,
        document_url: expForm.document_url || null,
        notes: expForm.notes || null,
        expense_source_type: editingExp
          ? editingExp.expense_source_type || (editingExp.expense_request_id ? 'request_generated' : 'legacy_manual')
          : 'controlled_exception',
        controlled_exception_type: expForm.controlled_exception_type || editingExp?.controlled_exception_type || null,
        controlled_exception_reason:
          expForm.controlled_exception_reason || editingExp?.controlled_exception_reason || null,
        expense_number:
          editingExp?.expense_number || 'EXP-' + Date.now().toString().slice(-6),
        updated_at: new Date().toISOString(),
      };

      let error;
      let savedExpense = editingExp ? { ...editingExp, ...payload } : null;

      if (editingExp) {
        ({ error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExp.id));
      } else {
        const { data: insertedExpense, error: insertError } = await supabase
          .from('expenses')
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        error = insertError;
        savedExpense = insertedExpense;
      }

      if (error) throw error;

      if (normalize(payload.approval_status) === 'approved' && savedExpense?.id) {
        try {
          const journalCreated = await createApprovedExpenseDraftJournal(savedExpense);

          if (journalCreated) {
            qc.invalidateQueries({ queryKey: ['finance_journals'] });
            qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
            qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });
          }
        } catch (journalError) {
          console.warn('Expense was saved, but draft journal creation failed.', journalError);
        }
      }

      if (!editingExp && savedExpense?.id) {
        await supabase.from('finance_audit_logs').insert({
          entity_table: 'expenses',
          entity_id: String(savedExpense.id),
          action: 'controlled_direct_expense_exception',
          new_value: {
            expense_number: savedExpense.expense_number,
            exception_type: payload.controlled_exception_type,
            reason: payload.controlled_exception_reason,
            amount: payload.amount,
          },
          changed_by: user?.id || null,
          changed_by_name: getActorName(),
        });
      }

      qc.invalidateQueries({ queryKey: ['expenses'] });

      alert(editingExp ? 'Expense updated' : 'Expense recorded');

      setExpForm(EMPTY_EXP);
      setEditingExp(null);
      setExpOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save expense');
    } finally {
      setSavingExp(false);
    }
  };

  const updateExpenseApproval = async (exp, approval_status) => {
    if (!canManageFinance(user)) {
      alert('Only CEO, AGM or Admin can approve or reject finance records.');
      return;
    }

    const payload = {
      approval_status,
      updated_at: new Date().toISOString(),
    };

    if (approval_status === 'approved') {
      payload.approved_by = user?.email || '';
      payload.approved_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', exp.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (approval_status === 'approved') {
      try {
        const journalCreated = await createApprovedExpenseDraftJournal({
          ...exp,
          ...payload,
        });

        if (journalCreated) {
          qc.invalidateQueries({ queryKey: ['finance_journals'] });
          qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
          qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });
        }
      } catch (journalError) {
        console.warn('Expense was approved, but draft journal creation failed.', journalError);
      }
    }

    qc.invalidateQueries({ queryKey: ['expenses'] });
  };

  const deleteExpense = async (id) => {
    const confirmed = window.confirm('Delete this expense?');

    if (!confirmed) return;

    const { error } = await supabase.from('expenses').delete().eq('id', id);

    if (error) {
      alert(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ['expenses'] });
  };

  const updateLinkedPartRequest = async (fundRequest, payload) => {
    if (!fundRequest.part_request_id) return;

    const { error } = await supabase
      .from('part_requests')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fundRequest.part_request_id);

    if (error) throw error;
  };

  const writeFinanceEvent = async (fundRequest, actionText, severity = 'info') => {
    await supabase.from('operations_events').insert({
      event_type: 'DISPATCH_FUND_FINANCE_UPDATE',
      title: `Finance ${actionText}`,
      description: `Finance ${actionText} for ${getFundPartName(fundRequest)} - ${getFundEngineerName(fundRequest)}`,
      source_module: 'Finance',
      entity_type: 'inventory_dispatch_fund_request',
      entity_id: fundRequest.id,
      severity,
    });
  };

  const approveDispatchFund = async (fundRequest) => {
    const approvedAmount = Number(getApprovedAmount(fundRequest) || 0);

    if (!approvedAmount || approvedAmount <= 0) {
      alert('Please enter a valid approved amount.');
      return;
    }

    try {
      setFundActionBusy(fundRequest.id);

      const financeNote = getFinanceNote(fundRequest);

      const { error } = await supabase
        .from('inventory_dispatch_fund_requests')
        .update({
          approved_amount: approvedAmount,
          status: 'approved',
          finance_status: 'approved',
          finance_note: financeNote || null,
          approved_by: user?.full_name || user?.name || user?.email || 'Finance',
          approved_by_email: user?.email || null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fundRequest.id);

      if (error) throw error;

      await updateLinkedPartRequest(fundRequest, {
        finance_status: 'approved',
        dispatch_status: 'awaiting_disbursement',
        lifecycle_status: 'dispatch_fund_approved',
      });

      await writeFinanceEvent(fundRequest, 'approved dispatch fund request');

      await qc.invalidateQueries({ queryKey: ['inventory_dispatch_fund_requests'] });
      await qc.invalidateQueries({ queryKey: ['inventory_part_requests'] });
      await qc.invalidateQueries({ queryKey: ['part_requests_dashboard'] });
      await qc.refetchQueries({ queryKey: ['inventory_dispatch_fund_requests'] });

      alert(`Dispatch fund approved for ${fmt(approvedAmount)}.`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to approve dispatch fund.');
    } finally {
      setFundActionBusy(null);
    }
  };

  const rejectDispatchFund = async (fundRequest) => {
    const financeNote = getFinanceNote(fundRequest);

    const confirmed = window.confirm('Reject this dispatch fund request?');
    if (!confirmed) return;

    try {
      setFundActionBusy(fundRequest.id);

      const { error } = await supabase
        .from('inventory_dispatch_fund_requests')
        .update({
          status: 'rejected',
          finance_status: 'rejected',
          finance_note: financeNote || 'Rejected by Finance',
          rejected_by: user?.full_name || user?.name || user?.email || 'Finance',
          rejected_by_email: user?.email || null,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fundRequest.id);

      if (error) throw error;

      await updateLinkedPartRequest(fundRequest, {
        finance_status: 'rejected',
        dispatch_status: 'finance_rejected',
        lifecycle_status: 'dispatch_fund_rejected',
      });

      await writeFinanceEvent(fundRequest, 'rejected dispatch fund request', 'warning');

      qc.invalidateQueries({ queryKey: ['inventory_dispatch_fund_requests'] });
      qc.invalidateQueries({ queryKey: ['inventory_part_requests'] });
      qc.invalidateQueries({ queryKey: ['part_requests_dashboard'] });

      alert('Dispatch fund rejected.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to reject dispatch fund.');
    } finally {
      setFundActionBusy(null);
    }
  };

  const markDispatchFundDisbursed = async (fundRequest) => {
    const approvedAmount = Number(getApprovedAmount(fundRequest) || fundRequest.requested_amount || 0);

    if (!approvedAmount || approvedAmount <= 0) {
      alert('Approved amount is missing. Approve the fund request first.');
      return;
    }

    const confirmed = window.confirm(
      'Mark this dispatch fund as disbursed? Inventory will now be allowed to dispatch to engineer.'
    );
    if (!confirmed) return;

    try {
      setFundActionBusy(fundRequest.id);

      const { error } = await supabase
        .from('inventory_dispatch_fund_requests')
        .update({
          approved_amount: approvedAmount,
          status: 'disbursed',
          finance_status: 'disbursed',
          disbursed_by: user?.full_name || user?.name || user?.email || 'Finance',
          disbursed_by_email: user?.email || null,
          disbursed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fundRequest.id);

      if (error) throw error;

      await updateLinkedPartRequest(fundRequest, {
        finance_status: 'disbursed',
        dispatch_status: 'ready_for_dispatch',
        lifecycle_status: 'dispatch_fund_disbursed',
      });

      await writeFinanceEvent(fundRequest, 'disbursed dispatch fund');

      await qc.invalidateQueries({ queryKey: ['inventory_dispatch_fund_requests'] });
      await qc.invalidateQueries({ queryKey: ['inventory_part_requests'] });
      await qc.invalidateQueries({ queryKey: ['part_requests_dashboard'] });
      await qc.refetchQueries({ queryKey: ['inventory_dispatch_fund_requests'] });

      alert(`Dispatch fund marked as disbursed for ${fmt(approvedAmount)}. Inventory can now dispatch.`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to mark fund as disbursed.');
    } finally {
      setFundActionBusy(null);
    }
  };

  const writePOFinanceEvent = async (lpo, actionText, severity = 'info') => {
    await supabase.from('operations_events').insert({
      event_type: 'PURCHASE_ORDER_FINANCE_UPDATE',
      title: `Finance ${actionText}`,
      description: `Finance ${actionText} for ${lpo.lpo_number || 'purchase order'} - ${getPOSupplier(lpo)}`,
      source_module: 'Finance',
      entity_type: 'lpo',
      entity_id: lpo.id,
      severity,
    });
  };

  const markPOFundsReleased = async (lpo) => {
    if (!allowFinanceActions) {
      alert('You do not have permission to release PO funds.');
      return;
    }

    if (lpo.status !== 'Pending Account Release') {
      alert('Only purchase orders waiting for Account Release can be released.');
      return;
    }

    const confirmed = window.confirm(
      'Mark funds as released for this purchase order? Procurement will now be able to issue the PO.'
    );

    if (!confirmed) return;

    try {
      setPoActionBusy(lpo.id);

      const { error } = await supabase
        .from('lpos')
        .update({
          status: 'Funds Released',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lpo.id);

      if (error) throw error;

      await writePOFinanceEvent(lpo, 'released purchase order funds');

      try {
        const journalCreated = await createPOFundReleaseDraftJournal({
          ...lpo,
          status: 'Funds Released',
        });

        if (journalCreated) {
          qc.invalidateQueries({ queryKey: ['finance_journals'] });
          qc.invalidateQueries({ queryKey: ['finance_general_ledger_view'] });
          qc.invalidateQueries({ queryKey: ['finance_trial_balance_view'] });
        }
      } catch (journalError) {
        console.warn('PO funds were released, but draft journal creation failed.', journalError);
      }

      qc.invalidateQueries({ queryKey: ['finance_lpos_account_release'] });
      qc.invalidateQueries({ queryKey: ['lpos'] });

      alert('PO funds released. Procurement can now issue the PO.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to release PO funds.');
    } finally {
      setPoActionBusy(null);
    }
  };

  const filteredInvoices = invoices.filter(
    (i) => invFilter === 'all' || i.status === invFilter
  );

  const filteredExpenses = expenses.filter(
    (e) => expCatFilter === 'all' || e.category === expCatFilter
  );

  const filteredGeneralRequests = generalRequests.filter((request) => {
    const q = generalRequestSearch.toLowerCase().trim();
    const financeStatus = normalize(request.finance_status);
    const category = getGeneralRequestCategory(request);
    const ready = isGeneralRequestReadyForFinance(request);
    const disbursed = isGeneralRequestDisbursed(request);

    const statusMatch =
      generalRequestFilter === 'all' ||
      financeStatus === normalize(generalRequestFilter) ||
      (generalRequestFilter === 'ready_for_disbursement' && ready) ||
      (generalRequestFilter === 'disbursed' && disbursed) ||
      (generalRequestFilter === 'loan' && category === 'loan') ||
      (generalRequestFilter === 'fund' && category === 'fund') ||
      (generalRequestFilter === 'float' && category === 'float');

    const searchMatch =
      !q ||
      String(request.request_type || '').toLowerCase().includes(q) ||
      String(request.request_subtype || '').toLowerCase().includes(q) ||
      String(request.purpose || '').toLowerCase().includes(q) ||
      String(request.requested_by_name || '').toLowerCase().includes(q) ||
      String(request.requested_by_email || '').toLowerCase().includes(q) ||
      String(request.department || '').toLowerCase().includes(q);

    return generalRequestNeedsFinance(request) && statusMatch && searchMatch;
  });

  const filteredDispatchFunds = dispatchFunds.filter((request) => {
    const status = getFundFinanceStatus(request);
    const q = fundSearch.toLowerCase().trim();

    const statusMatch =
      fundFilter === 'all' ||
      status === fundFilter ||
      (fundFilter === 'pending_review' && isPendingDispatchFund(request)) ||
      (fundFilter === 'approved' && isApprovedAwaitingDispatchFundDisbursement(request)) ||
      (fundFilter === 'disbursed' && isDisbursedDispatchFund(request)) ||
      (fundFilter === 'rejected' && isRejectedDispatchFund(request));

    const searchMatch =
      !q ||
      String(getFundPartName(request)).toLowerCase().includes(q) ||
      String(getFundEngineerName(request)).toLowerCase().includes(q) ||
      String(getFundDestination(request)).toLowerCase().includes(q) ||
      String(request.engineer_email || '').toLowerCase().includes(q) ||
      String(request.part_number || '').toLowerCase().includes(q) ||
      String(request.serial_number || '').toLowerCase().includes(q) ||
      String(request.logistics_type || '').toLowerCase().includes(q) ||
      String(request.warehouse || '').toLowerCase().includes(q);

    return statusMatch && searchMatch;
  });

  const filteredPurchaseOrders = purchaseOrders.filter((po) => {
    const q = poSearch.toLowerCase().trim();

    const statusMatch = poFilter === 'all' || normalize(po.status) === normalize(poFilter);

    const searchMatch =
      !q ||
      String(po.lpo_number || '').toLowerCase().includes(q) ||
      String(po.title || '').toLowerCase().includes(q) ||
      String(po.supplier_name || '').toLowerCase().includes(q) ||
      String(po.requested_by_name || '').toLowerCase().includes(q) ||
      getPOItems(po).some(
        (item) =>
          String(item.description || '').toLowerCase().includes(q) ||
          String(item.part_number || '').toLowerCase().includes(q)
      );

    return statusMatch && searchMatch;
  });

  const dispatchFundsLoadFailed = Boolean(dispatchFundError);
  const purchaseOrdersLoadFailed = Boolean(purchaseOrderError);
  const generalRequestsLoadFailed = Boolean(generalRequestError);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <DollarSign className="w-6 h-6 text-primary" />
            Finance Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Dispatch funds · PO fund release · Income & expense management · Financial reporting
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <OperationalFundCard
          icon={Wallet}
          iconClassName="text-amber-500"
          valueClassName="text-amber-500"
          label="Pending Dispatch Funds"
          count={dispatchFundStats.pendingCount}
          amount={dispatchFundStats.pendingAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('pending_review');
          }}
        />

        <OperationalFundCard
          icon={CheckCircle2}
          iconClassName="text-blue-500"
          valueClassName="text-blue-500"
          label="Approved Awaiting Disbursement"
          count={dispatchFundStats.approvedCount}
          amount={dispatchFundStats.approvedAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('approved');
          }}
        />

        <OperationalFundCard
          icon={PackageCheck}
          iconClassName="text-green-500"
          valueClassName="text-green-600"
          label="Disbursed"
          count={dispatchFundStats.disbursedCount}
          amount={dispatchFundStats.disbursedAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('disbursed');
          }}
        />

        <OperationalFundCard
          icon={XCircle}
          iconClassName="text-red-500"
          valueClassName="text-red-600"
          label="Rejected Dispatch Funds"
          count={dispatchFundStats.rejectedCount}
          amount={dispatchFundStats.rejectedAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('rejected');
          }}
        />

        <OperationalFundCard
          icon={ShoppingCart}
          iconClassName="text-cyan-500"
          valueClassName="text-cyan-500"
          label="PO Funds To Release"
          count={purchaseOrderStats.pendingReleaseCount}
          amount={purchaseOrderStats.pendingReleaseAmount}
          loading={loadingPurchaseOrders}
          error={purchaseOrdersLoadFailed}
          onClick={() => {
            setActiveFinanceTab('purchase-orders');
            setPoFilter('Pending Account Release');
          }}
        />

        <OperationalFundCard
          icon={FileText}
          iconClassName="text-purple-400"
          valueClassName="text-purple-300"
          label="General Requests Awaiting Finance"
          count={generalRequestStats.awaitingFinanceCount}
          amount={generalRequestStats.awaitingFinanceAmount}
          loading={loadingGeneralRequests}
          error={generalRequestsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('general-requests');
            setGeneralRequestFilter('ready_for_disbursement');
          }}
        />

        <OperationalFundCard
          icon={PackageCheck}
          iconClassName="text-emerald-400"
          valueClassName="text-emerald-300"
          label="Historical Disbursed General Requests"
          count={generalRequestStats.disbursedCount}
          amount={generalRequestStats.disbursedAmount}
          loading={loadingGeneralRequests}
          error={generalRequestsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('general-requests');
            setGeneralRequestFilter('disbursed');
          }}
        />

        <OperationalFundCard
          icon={Clock}
          iconClassName="text-amber-400"
          valueClassName="text-amber-300"
          label="Expense Requests Pending Approval"
          count={expenseRequestStats.pendingApproval + expenseRequestStats.pendingFinance}
          amount={expenseRequests
            .filter((request) =>
              ['submitted', 'pending_approval', 'pending_finance_review'].includes(request.status)
            )
            .reduce((sum, request) => sum + Number(request.amount_requested || 0), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('pending');
          }}
        />

        <OperationalFundCard
          icon={CheckCircle2}
          iconClassName="text-indigo-400"
          valueClassName="text-indigo-300"
          label="Approved for Payment"
          count={expenseRequestStats.approvedForPayment}
          amount={expenseRequests
            .filter((request) => request.status === 'approved_for_payment')
            .reduce((sum, request) => sum + getExpenseRequestApprovedAmount(request), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('approved_for_payment');
          }}
        />

        <OperationalFundCard
          icon={Wallet}
          iconClassName="text-blue-400"
          valueClassName="text-blue-300"
          label="Partially Paid"
          count={expenseRequestStats.partiallyPaid}
          amount={expenseRequests
            .filter((request) => request.status === 'partially_paid')
            .reduce((sum, request) => sum + getExpenseRequestPaidTotal(request), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('partially_paid');
          }}
        />

        <OperationalFundCard
          icon={PackageCheck}
          iconClassName="text-green-400"
          valueClassName="text-green-300"
          label="Paid Expense Requests"
          count={expenseRequestStats.paid}
          amount={expenseRequests
            .filter((request) => request.status === 'paid')
            .reduce((sum, request) => sum + getExpenseRequestPaidTotal(request), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('paid');
          }}
        />
      </div>

      {(dispatchFundError || purchaseOrderError || generalRequestError || expenseRequestsError) && (
        <Card className="border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-200">
            Finance dashboard data could not load completely.
          </p>
          {dispatchFundError && (
            <p className="text-xs text-red-300">Dispatch funds: {dispatchFundError.message}</p>
          )}
          {purchaseOrderError && (
            <p className="text-xs text-red-300">PO funds: {purchaseOrderError.message}</p>
          )}
          {generalRequestError && (
            <p className="text-xs text-red-300">General Requests: {generalRequestError.message}</p>
          )}
          {expenseRequestsError && (
            <p className="text-xs text-red-300">Expense Requests: {expenseRequestsError.message}</p>
          )}
        </Card>
      )}

      <div className="hidden">
        <div className="rounded-xl border bg-slate-900/50 p-4">
          <Wallet className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-amber-500">
            {dispatchFundStats.pendingCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Pending Dispatch Funds · {fmt(dispatchFundStats.pendingAmount)}
          </p>
        </div>

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <CheckCircle2 className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-blue-500">
            {dispatchFundStats.approvedCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Approved Awaiting Disbursement · {fmt(dispatchFundStats.approvedAmount)}
          </p>
        </div>

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <PackageCheck className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-green-600">
            {dispatchFundStats.disbursedCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Disbursed · {fmt(dispatchFundStats.disbursedAmount)}
          </p>
        </div>

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <XCircle className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold text-red-600">
            {dispatchFundStats.rejectedCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Rejected Dispatch Funds
          </p>
        </div>

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <ShoppingCart className="w-5 h-5 text-cyan-500 mb-2" />
          <p className="text-2xl font-bold text-cyan-500">
            {purchaseOrderStats.pendingReleaseCount}
          </p>
          <p className="text-xs text-muted-foreground">
            PO Funds To Release · {fmt(purchaseOrderStats.pendingReleaseAmount)}
          </p>
        </div>
      </div>

            {canSeeFullFinance && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border bg-slate-900/50 p-4">
                  <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
                  <p className="text-2xl font-bold text-green-600">{fmt(totalIncome)}</p>
                  <p className="text-xs text-muted-foreground">Total Income (Paid)</p>
                </div>
        
                <div className="rounded-xl border bg-slate-900/50 p-4">
                  <TrendingDown className="w-5 h-5 text-red-500 mb-2" />
                  <p className="text-2xl font-bold text-red-600">{fmt(totalExpenses)}</p>
                  <p className="text-xs text-muted-foreground">Total Expenses</p>
                </div>
        
                <div className="rounded-xl border bg-slate-900/50 p-4">
                  <BarChart3
                    className="w-5 h-5 mb-2"
                    style={{
                      color: profit >= 0 ? '#22c55e' : '#ef4444',
                    }}
                  />
                  <p
                    className="text-2xl font-bold"
                    style={{
                      color: profit >= 0 ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {fmt(Math.abs(profit))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profit >= 0 ? 'Net Profit' : 'Net Loss'}
                  </p>
                </div>
        
                <div className="rounded-xl border bg-slate-900/50 p-4">
                  <AlertCircle className="w-5 h-5 text-amber-500 mb-2" />
                  <p className="text-2xl font-bold text-amber-600">{fmt(totalOverdue)}</p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              </div>
      )}

      {canSeeFullFinance && monthlyIncome.some((m) => m.income > 0) && (
        <div className="rounded-xl border bg-slate-900/50 p-4">
          <p className="text-sm font-semibold mb-3">
            Monthly Income (Last 6 Months)
          </p>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyIncome}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => '₦' + (v / 1000).toFixed(0) + 'k'}
              />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="income" fill="#ff5a00" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <Tabs value={activeFinanceTab} onValueChange={setActiveFinanceTab}>
        <Card className="p-3 bg-slate-900/60 border-slate-700 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Finance</p>
              <p className="text-xs text-muted-foreground">
                {activeFinanceTabLabel || 'Select a finance section'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {financeNavGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setFinanceSection(group.key, group.items[0]?.value)}
                  className={
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-all ' +
                    (activeFinanceGroup?.key === group.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-slate-700 bg-slate-950/60 text-muted-foreground hover:bg-slate-800')
                  }
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          {activeFinanceGroup && (
            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
              {activeFinanceGroup.items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFinanceSection(activeFinanceGroup.key, item.value)}
                  className={
                    'rounded-md border px-3 py-1.5 text-xs transition-all ' +
                    (activeFinanceTab === item.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-slate-700 bg-slate-900/60 text-muted-foreground hover:bg-slate-800')
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </Card>

        <TabsContent value="general-requests" className="space-y-4">
          <FinancePageHeader
            title="General Requests Awaiting Finance"
            description="Approved fund, loan and float requests routed from General Requests into Accounts."
            searchValue={generalRequestSearch}
            onSearchChange={setGeneralRequestSearch}
            searchPlaceholder="Search requester, department, purpose..."
            toolbar={financeReports.generalRequestsAwaitingFinance}
          >
            <div className="flex gap-2 flex-wrap">
              {[
                ['all', 'All Finance Requests'],
                ['ready_for_disbursement', 'Awaiting Finance'],
                ['disbursed', 'Disbursed'],
                ['fund', 'Fund'],
                ['loan', 'Loan'],
                ['float', 'Float'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGeneralRequestFilter(key)}
                  className={
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                    (generalRequestFilter === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-slate-900/50 border-border text-muted-foreground hover:bg-muted')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </FinancePageHeader>

          {generalRequestError && (
            <Card className="p-4 border-red-500/30 bg-red-500/10">
              <p className="text-sm text-red-300">
                Failed to load General Requests: {generalRequestError.message}
              </p>
            </Card>
          )}

          {loadingGeneralRequests ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Loading General Requests for Finance...
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredGeneralRequests.map((request) => {
                const category = getGeneralRequestCategory(request);
                const ready = isGeneralRequestReadyForFinance(request);
                const disbursed = isGeneralRequestDisbursed(request);

                return (
                  <Card key={request.id} className="p-4 bg-slate-900/60 border-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {category}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              disbursed
                                ? 'bg-green-500/15 text-green-300 border-green-200 text-[10px]'
                                : ready
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-200 text-[10px]'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-200 text-[10px]'
                            }
                          >
                            {request.finance_status || request.status || 'pending'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Source: fund_requests/{request.id}
                          </span>
                        </div>

                        <p className="font-semibold text-white">
                          {request.request_type || request.request_subtype || 'General Finance Request'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.requested_by_name || request.requested_by_email || 'Requester not recorded'}
                          {request.department ? ` - ${request.department}` : ''}
                        </p>
                        {request.purpose && (
                          <p className="text-sm text-slate-300 max-w-3xl">{request.purpose}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Created: {safeDate(request.created_at) || 'N/A'}</span>
                          {request.disbursed_at && <span>Disbursed: {safeDate(request.disbursed_at)}</span>}
                          {request.disbursed_by && <span>By: {request.disbursed_by}</span>}
                        </div>
                      </div>

                      <div className="text-right min-w-[160px]">
                        <p className="text-xs text-muted-foreground">Approved Amount</p>
                        <p className="text-2xl font-bold text-[#ff5a00]">
                          {fmt(getGeneralRequestAmount(request))}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => window.open(`/fund-requests?id=${request.id}`, '_self')}
                        >
                          Open Source
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {filteredGeneralRequests.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  No General Requests found for this Finance filter.
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dispatch-funds" className="space-y-4">
          <div className="rounded-xl border bg-slate-900/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#ff5a00]" />
                  Dispatch Fund Requests
                </h2>
                <p className="text-xs text-muted-foreground">
                  Inventory cannot dispatch until Finance approves and marks fund as disbursed.
                </p>
              </div>

              <Input
                className="max-w-sm bg-slate-950/50"
                value={fundSearch}
                onChange={(e) => setFundSearch(e.target.value)}
                placeholder="Search engineer, part, destination, serial..."
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                ['all', 'All'],
                ['pending_review', 'Pending'],
                ['approved', 'Approved'],
                ['disbursed', 'Disbursed'],
                ['rejected', 'Rejected'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFundFilter(key)}
                  className={
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                    (fundFilter === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-slate-900/50 border-border text-muted-foreground hover:bg-muted')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {dispatchFundError && (
            <Card className="p-4 border-red-500/30 bg-red-500/10">
              <p className="text-sm text-red-300">
                Failed to load dispatch fund requests: {dispatchFundError.message}
              </p>
            </Card>
          )}

          {loadingDispatchFunds ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDispatchFunds.map((request) => {
                const status = getFundFinanceStatus(request);
                const statusStyle = getFundStatusStyle(request);
                const busy = fundActionBusy === request.id;
                const pending = ['pending_review', 'pending_finance'].includes(status);
                const approved = status === 'approved';
                const disbursed = status === 'disbursed';
                const rejected = status === 'rejected';

                return (
                  <Card key={request.id} className="p-4 bg-slate-900/60 border-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={statusStyle.color + ' text-[10px]'}
                          >
                            {statusStyle.label}
                          </Badge>

                          {request.warehouse && (
                            <Badge variant="outline" className="text-[10px]">
                              Warehouse: {request.warehouse}
                            </Badge>
                          )}

                          {request.logistics_type && (
                            <Badge variant="outline" className="text-[10px]">
                              {request.logistics_type}
                            </Badge>
                          )}

                          {request.created_at && (
                            <span className="text-xs text-muted-foreground">
                              {safeDate(request.created_at)}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-white">
                            {getFundPartName(request)}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Engineer: {getFundEngineerName(request)}
                            {request.engineer_email ? ` · ${request.engineer_email}` : ''}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Destination: {getFundDestination(request)}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Part No: {request.part_number || 'N/A'}
                            {request.serial_number ? ` · Serial: ${request.serial_number}` : ''}
                          </p>

                          {request.reason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Reason: {request.reason}
                            </p>
                          )}

                          {request.finance_note && (
                            <p className="text-xs text-blue-300 mt-1">
                              Finance Note: {request.finance_note}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right min-w-[180px]">
                        <p className="text-xs text-muted-foreground">Requested</p>
                        <p className="text-2xl font-bold text-[#ff5a00]">
                          {fmt(request.requested_amount)}
                        </p>

                        <p className="text-xs text-muted-foreground mt-2">Approved</p>
                        <p className="text-lg font-bold text-green-500">
                          {fmt(getDisplayApprovedAmount(request))}
                        </p>
                      </div>
                    </div>

                    {!allowFinanceActions && (
                      <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                        <p className="text-xs text-amber-300">
                          Your role can view dispatch fund requests, but cannot approve, reject or disburse.
                        </p>
                      </div>
                    )}

                    {allowFinanceActions && pending && (
                      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/40 p-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Approved Amount (₦)</Label>
                            <Input
                              type="number"
                              min="0"
                              className="mt-1"
                              value={getApprovedAmount(request)}
                              onChange={(e) =>
                                updateFundForm(
                                  request.id,
                                  'approved_amount',
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Finance Note</Label>
                            <Input
                              className="mt-1"
                              value={getFinanceNote(request)}
                              onChange={(e) =>
                                updateFundForm(request.id, 'finance_note', e.target.value)
                              }
                              placeholder="Optional note"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={busy}
                            onClick={() => approveDispatchFund(request)}
                          >
                            {busy ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                            )}
                            Approve
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => rejectDispatchFund(request)}
                          >
                            {busy ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-1" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {allowFinanceActions && approved && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-[#ff5a00] hover:bg-[#e24f00] text-white"
                          disabled={busy}
                          onClick={() => markDispatchFundDisbursed(request)}
                        >
                          {busy ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Wallet className="w-4 h-4 mr-1" />
                          )}
                          Mark Disbursed
                        </Button>

                        <span className="text-xs text-blue-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waiting for account disbursement.
                        </span>
                      </div>
                    )}

                    {disbursed && (
                      <div className="mt-4 rounded-lg border border-green-400/20 bg-green-500/10 p-3">
                        <p className="text-xs text-green-300">
                          Fund disbursed. Inventory can now dispatch this part to the engineer.
                        </p>
                      </div>
                    )}

                    {rejected && (
                      <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 p-3">
                        <p className="text-xs text-red-300">
                          Dispatch fund request rejected. Inventory cannot dispatch until a new fund approval is handled.
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })}

              {filteredDispatchFunds.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No dispatch fund requests found</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {canSeeFullFinance && (
          <TabsContent value="purchase-orders" className="space-y-4">
            <div className="rounded-xl border bg-slate-900/50 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-[#ff5a00]" />
                    Purchase Order Fund Release
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Fully approved purchase orders appear here when they reach Pending Account Release.
                  </p>
                </div>

                <Input
                  className="max-w-sm bg-slate-950/50"
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  placeholder="Search PO, supplier, requester, item..."
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {[
                  ['all', 'All'],
                  ['Pending Account Release', 'Pending Release'],
                  ['Funds Released', 'Funds Released'],
                  ['Issued', 'Issued'],
                  ['Completed', 'Completed'],
                  ['Rejected', 'Rejected'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPoFilter(key)}
                    className={
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                      (poFilter === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-slate-900/50 border-border text-muted-foreground hover:bg-muted')
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {purchaseOrderError && (
              <Card className="p-4 border-red-500/30 bg-red-500/10">
                <p className="text-sm text-red-300">
                  Failed to load purchase orders: {purchaseOrderError.message}
                </p>
              </Card>
            )}

            {loadingPurchaseOrders ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPurchaseOrders.map((po) => {
                  const statusStyle = getPOStatusStyle(po);
                  const busy = poActionBusy === po.id;
                  const pendingRelease = po.status === 'Pending Account Release';
                  const fundsReleased = po.status === 'Funds Released';
                  const issuedOrCompleted = ['Issued', 'Completed'].includes(po.status);

                  return (
                    <Card key={po.id} className="p-4 bg-slate-900/60 border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={statusStyle.color + ' text-[10px]'}
                            >
                              {statusStyle.label}
                            </Badge>

                            {po.lpo_number && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {po.lpo_number}
                              </Badge>
                            )}

                            {po.created_at && (
                              <span className="text-xs text-muted-foreground">
                                {safeDate(po.created_at)}
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-white">
                              {po.title || 'Purchase Order'}
                            </p>

                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3" />
                              Supplier: {getPOSupplier(po)}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              Requested By: {po.requested_by_name || 'N/A'}
                              {po.requested_by_email ? ` · ${po.requested_by_email}` : ''}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              Items: {getPOItemsCount(po)}
                              {po.delivery_expected_date
                                ? ` · Expected Delivery: ${safeDate(po.delivery_expected_date)}`
                                : ''}
                            </p>

                            {po.approved_by && (
                              <p className="text-xs text-green-300 mt-1">
                                Approved By: {po.approved_by}
                                {po.approval_date ? ` · ${safeDate(po.approval_date)}` : ''}
                              </p>
                            )}

                            {po.rejection_reason && (
                              <p className="text-xs text-red-300 mt-1">
                                Rejection Reason: {po.rejection_reason}
                              </p>
                            )}

                            {getPOItems(po).length > 0 && (
                              <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/40 p-2">
                                <p className="text-[11px] font-semibold text-slate-300 mb-1">
                                  Items Preview
                                </p>
                                <div className="space-y-1">
                                  {getPOItems(po)
                                    .slice(0, 3)
                                    .map((item, index) => (
                                      <p
                                        key={`${po.id}-item-${index}`}
                                        className="text-[11px] text-muted-foreground"
                                      >
                                        {index + 1}. {item.part_number ? `${item.part_number} · ` : ''}
                                        {item.description || 'Item'} × {item.quantity_requested || 0}
                                      </p>
                                    ))}
                                  {getPOItems(po).length > 3 && (
                                    <p className="text-[11px] text-muted-foreground">
                                      +{getPOItems(po).length - 3} more item(s)
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right min-w-[180px]">
                          <p className="text-xs text-muted-foreground">PO Total</p>
                          <p className="text-2xl font-bold text-[#ff5a00]">
                            {fmt(getPOTotal(po))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {po.currency || 'NGN'}
                          </p>
                        </div>
                      </div>

                      {!allowFinanceActions && pendingRelease && (
                        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                          <p className="text-xs text-amber-300">
                            Your role can view this PO, but cannot release funds.
                          </p>
                        </div>
                      )}

                      {allowFinanceActions && pendingRelease && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={busy}
                            onClick={() => markPOFundsReleased(po)}
                          >
                            {busy ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Wallet className="w-4 h-4 mr-1" />
                            )}
                            Release Funds
                          </Button>

                          <span className="text-xs text-cyan-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Waiting for Account to release funds.
                          </span>
                        </div>
                      )}

                      {fundsReleased && (
                        <div className="mt-4 rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
                          <p className="text-xs text-blue-300">
                            Funds released. Procurement can now issue this purchase order.
                          </p>
                        </div>
                      )}

                      {issuedOrCompleted && (
                        <div className="mt-4 rounded-lg border border-green-400/20 bg-green-500/10 p-3">
                          <p className="text-xs text-green-300">
                            Purchase order has moved beyond fund release stage.
                          </p>
                        </div>
                      )}
                    </Card>
                  );
                })}

                {filteredPurchaseOrders.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No purchase orders found</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="income" className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex gap-2 flex-wrap">
                        {['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'].map((s) => (
                          <button
                            key={s}
                            onClick={() => setInvFilter(s)}
                            className={
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ' +
                              (invFilter === s
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-slate-900/50 border-border text-muted-foreground hover:bg-muted')
                            }
                          >
                            {s === 'all' ? 'All' : INV_STATUS[s]?.label}
                          </button>
                        ))}
                      </div>
          
                      {allowAddFinanceRecords && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingInv(null);
                            setInvForm(EMPTY_INV);
                            setInvOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          New Invoice
                        </Button>
                      )}
                    </div>
          
                    {loadingInv ? (
                      <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredInvoices.map((inv) => {
                          const sc = INV_STATUS[inv.status] || INV_STATUS.draft;
          
                          return (
                            <Card key={inv.id} className="p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {inv.invoice_number}
                                    </span>
          
                                    <Badge
                                      variant="outline"
                                      className={sc.color + ' text-[10px]'}
                                    >
                                      {sc.label}
                                    </Badge>
                                  </div>
          
                                  <p className="font-semibold">{inv.client_name}</p>
          
                                  {inv.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {inv.description}
                                    </p>
                                  )}
          
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    {inv.payment_source && (
                                      <span>Source: {inv.payment_source}</span>
                                    )}
                                    {inv.payment_mode && <span>Mode: {inv.payment_mode}</span>}
                                    {inv.due_date && <span>Due: {safeDate(inv.due_date)}</span>}
                                    {inv.paid_date && (
                                      <span className="text-green-600">
                                        Paid: {safeDate(inv.paid_date)}
                                      </span>
                                    )}
                                  </div>
                                </div>
          
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-[#ff5a00]">{fmt(inv.amount)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {inv.currency || 'NGN'}
                                  </p>
                                </div>
                              </div>
          
                              <div className="flex gap-2 mt-3">
                                {allowFinanceActions ? (
                                  <>
                                    <Select
                                      value={inv.status}
                                      onValueChange={(v) => updateInvStatus(inv, v)}
                                    >
                                      <SelectTrigger className="h-8 text-xs w-[140px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(INV_STATUS).map(([k, v]) => (
                                          <SelectItem key={k} value={k}>
                                            {v.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
          
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingInv(inv);
                                        setInvForm({
                                          ...EMPTY_INV,
                                          ...inv,
                                          amount: inv.amount?.toString() || '',
                                        });
                                        setInvOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  </>
                                ) : (
                                  <p className="text-xs text-amber-600">
                                    Locked after entry. Submit correction request for CEO/AGM approval.
                                  </p>
                                )}
                              </div>
                            </Card>
                          );
                        })}
          
                        {filteredInvoices.length === 0 && (
                          <div className="text-center py-12 text-muted-foreground">
                            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>No invoices found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="expense-requests" className="space-y-4">
            <FinancePageHeader
              title="Expense Requests"
              description="Controlled request-first expense workflow with approval, payment, linked expense, and draft journal tracking."
              toolbar={expenseRequestReport}
            >
              <Select value={expenseRequestFilter} onValueChange={setExpenseRequestFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Requests</SelectItem>
                  <SelectItem value="mine">My Requests</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="returned_for_correction">Returned</SelectItem>
                  <SelectItem value="approved_for_payment">Approved for Payment</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => {
                  setEditingExpenseRequest(null);
                  setExpenseRequestForm(EMPTY_EXPENSE_REQUEST);
                  setExpenseRequestOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Expense Request
              </Button>
            </FinancePageHeader>

            <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
              {[
                ['Draft', expenseRequestStats.draft],
                ['Pending Approval', expenseRequestStats.pendingApproval],
                ['Pending Finance', expenseRequestStats.pendingFinance],
                ['Approved Pay', expenseRequestStats.approvedForPayment],
                ['Part Paid', expenseRequestStats.partiallyPaid],
                ['Paid', expenseRequestStats.paid],
                ['Rejected', expenseRequestStats.rejected],
              ].map(([label, value]) => (
                <Card key={label} className="p-3 bg-slate-900/60 border-slate-700">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{loadingExpenseRequests ? '...' : value}</p>
                </Card>
              ))}
            </div>

            {expenseRequestsError && (
              <Card className="p-4 border-red-500/30 bg-red-500/10">
                <p className="text-sm text-red-300">
                  Expense request workflow could not load: {expenseRequestsError.message}
                </p>
              </Card>
            )}

            {loadingExpenseRequests ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">Loading expense requests...</Card>
            ) : (
              <div className="space-y-3">
                {filteredExpenseRequests.map((request) => {
                  const statusStyle =
                    EXPENSE_REQUEST_STATUS[request.status] || EXPENSE_REQUEST_STATUS.draft;
                  const paidTotal = getExpenseRequestPaidTotal(request);
                  const remaining = getExpenseRequestRemaining(request);

                  return (
                    <Card key={request.id} className="p-4 bg-slate-900/60 border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={statusStyle.color + ' text-[10px]'}>
                              {statusStyle.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              Payment: {request.payment_status || 'unpaid'}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              {request.request_number}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold">{request.purpose}</p>
                            <p className="text-xs text-muted-foreground">
                              {request.requester_name || request.requester_email} · {request.department || 'No department'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {request.expense_category || 'Uncategorized'} · {request.supplier_name || request.beneficiary_name || 'No supplier/beneficiary'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Requested: {fmt(request.amount_requested)}</span>
                            <span>Approved: {fmt(getExpenseRequestApprovedAmount(request))}</span>
                            <span>Paid: {fmt(paidTotal)}</span>
                            <span>Remaining: {fmt(remaining)}</span>
                          </div>
                          {(request.finance_expense_request_approvals || []).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Approval history: {(request.finance_expense_request_approvals || []).length} action(s)
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end">
                          {isExpenseRequester(request) &&
                            ['draft', 'returned_for_correction'].includes(request.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingExpenseRequest(request);
                                  setExpenseRequestForm({
                                    ...EMPTY_EXPENSE_REQUEST,
                                    ...request,
                                    amount_requested: String(request.amount_requested || ''),
                                    amount_approved: String(request.amount_approved || ''),
                                    required_date: request.required_date || '',
                                  });
                                  setExpenseRequestOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          {isExpenseRequester(request) &&
                            ['draft', 'returned_for_correction'].includes(request.status) && (
                              <Button
                                size="sm"
                                onClick={() => submitExistingExpenseRequest(request)}
                              >
                                Submit
                              </Button>
                            )}
                          {canApproveExpenseRequest(request) &&
                            ['submitted', 'pending_approval'].includes(request.status) && (
                              <>
                                <Button size="sm" onClick={() => decideExpenseRequest(request, 'approved')}>
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => decideExpenseRequest(request, 'returned_for_correction')}
                                >
                                  Return
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => decideExpenseRequest(request, 'rejected')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          {canFinanceReviewExpenseRequest(request) &&
                            request.status === 'pending_finance_review' && (
                              <Button size="sm" onClick={() => decideExpenseRequest(request, 'approved_for_payment')}>
                                Approve for Payment
                              </Button>
                            )}
                          {canFinanceReviewExpenseRequest(request) &&
                            ['approved_for_payment', 'partially_paid'].includes(request.status) &&
                            remaining > 0 && (
                              <Button size="sm" onClick={() => openExpensePayment(request)}>
                                Record Payment
                              </Button>
                            )}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {filteredExpenseRequests.length === 0 && (
                  <Card className="p-8 text-center text-sm text-muted-foreground">
                    No expense requests found.
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="expenses" className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setExpCatFilter('all')}
                          className={
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                            (expCatFilter === 'all'
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-slate-900/50 border-border text-muted-foreground hover:bg-muted')
                          }
                        >
                          All Categories
                        </button>
          
                        {EXPENSE_CATEGORIES.map((c) => (
                          <button
                            key={c}
                            onClick={() => setExpCatFilter(c)}
                            className={
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                              (expCatFilter === c
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-slate-900/50 border-border text-muted-foreground hover:bg-muted')
                            }
                          >
                            {c}
                          </button>
                        ))}
                      </div>
          
                      {allowAddFinanceRecords && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingExp(null);
                            setExpForm(EMPTY_EXP);
                            setExpOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Controlled Exception
                        </Button>
                      )}
                    </div>
          
                    {loadingExp ? (
                      <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredExpenses.map((exp) => {
                          const sc = APPROVAL_STATUS[exp.approval_status] || APPROVAL_STATUS.pending;
          
                          return (
                            <Card key={exp.id} className="p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-slate-50 border-slate-200"
                                    >
                                      {exp.category || 'Uncategorized'}
                                    </Badge>
          
                                    <Badge
                                      variant="outline"
                                      className={sc.color + ' text-[10px]'}
                                    >
                                      {sc.label}
                                    </Badge>
          
                                    {exp.expense_number && (
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        {exp.expense_number}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">
                                      {exp.expense_request_id
                                        ? 'Request-Generated Expense'
                                        : exp.expense_source_type === 'controlled_exception'
                                          ? 'Controlled Finance Exception'
                                          : 'Legacy Manual Expense'}
                                    </Badge>
                                  </div>
          
                                  <p className="font-semibold text-sm">{exp.description}</p>
          
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    {exp.payment_method && (
                                      <span>Payment: {exp.payment_method}</span>
                                    )}
                                    {exp.staff_responsible && (
                                      <span>By: {exp.staff_responsible}</span>
                                    )}
                                    {exp.expense_date && <span>{safeDate(exp.expense_date)}</span>}
                                  </div>
          
                                  {exp.document_url && (
                                    <a
                                      href={exp.document_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary underline mt-1 block"
                                    >
                                      View Document
                                    </a>
                                  )}
                                </div>
          
                                <div className="text-right">
                                  <p className="text-xl font-bold text-red-600">
                                    {fmt(exp.amount)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {exp.currency || 'NGN'}
                                  </p>
                                </div>
                              </div>
          
                              <div className="flex gap-2 mt-3">
                                {allowFinanceActions ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingExp(exp);
                                        setExpForm({
                                          ...EMPTY_EXP,
                                          ...exp,
                                          amount: exp.amount?.toString() || '',
                                        });
                                        setExpOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
          
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-green-600"
                                      onClick={() => updateExpenseApproval(exp, 'approved')}
                                    >
                                      Approve
                                    </Button>
          
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600"
                                      onClick={() => updateExpenseApproval(exp, 'rejected')}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                ) : (
                                  <p className="text-xs text-amber-600">
                                    Locked after entry. Submit correction request for CEO/AGM approval.
                                  </p>
                                )}
                              </div>
                            </Card>
                          );
                        })}
          
                        {filteredExpenses.length === 0 && (
                          <div className="text-center py-12 text-muted-foreground">
                            <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>No expenses recorded</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="accounts-receivable" className="space-y-4">
            <FinancePageHeader
              title="Accounts Receivable"
              description="Customer balances from unpaid invoices. Payment allocation tables are proposed in the AR/AP migration."
              toolbar={financeReports.outstandingInvoices}
            >
              <Badge variant="outline" className="text-[10px]">
                {accountsReceivable.outstandingInvoices.length} outstanding invoice(s)
              </Badge>
            </FinancePageHeader>

            <div className="grid md:grid-cols-3 gap-3">
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Customer Balance</p>
                <p className="text-2xl font-bold">{fmt(accountsReceivable.totalBalance)}</p>
              </Card>
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Customers</p>
                <p className="text-2xl font-bold">{accountsReceivable.customers.length}</p>
              </Card>
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Credit Limit Support</p>
                <p className="text-sm font-semibold mt-2">Available in proposed `finance_customers` table</p>
              </Card>
            </div>

            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">AR Ageing Report</h3>
                <FinanceReportToolbar {...financeReports.arAgeing} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-slate-700">
                    <th className="py-2 text-left">Customer</th>
                    <th className="py-2 text-right">Balance</th>
                    {AGEING_BUCKETS.map((bucket) => (
                      <th key={bucket.key} className="py-2 text-right">{bucket.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accountsReceivable.customers.map((customer) => (
                    <tr key={customer.customerEmail || customer.customerName} className="border-b border-slate-800">
                      <td className="py-2">
                        <p className="font-medium">{customer.customerName}</p>
                        <p className="text-xs text-muted-foreground">{customer.customerEmail || 'No email'}</p>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(customer.balance)}</td>
                      {AGEING_BUCKETS.map((bucket) => (
                        <td key={bucket.key} className="py-2 text-right">{fmt(customer.ageing[bucket.key])}</td>
                      ))}
                    </tr>
                  ))}
                  {accountsReceivable.customers.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={7}>
                        No outstanding receivables.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Outstanding Invoices / Customer Statements</h3>
                <FinanceReportToolbar {...financeReports.outstandingInvoices} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-slate-700">
                    <th className="py-2 text-left">Invoice</th>
                    <th className="py-2 text-left">Customer</th>
                    <th className="py-2 text-left">Due Date</th>
                    <th className="py-2 text-right">Age</th>
                    <th className="py-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsReceivable.outstandingInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-800">
                      <td className="py-2 font-mono text-xs">{invoice.invoice_number || invoice.id}</td>
                      <td className="py-2">{invoice.customerName}</td>
                      <td className="py-2">{safeDate(invoice.due_date || invoice.created_at)}</td>
                      <td className="py-2 text-right">{invoice.ageDays} day(s)</td>
                      <td className="py-2 text-right font-semibold">{fmt(invoice.outstandingAmount)}</td>
                    </tr>
                  ))}
                  {accountsReceivable.outstandingInvoices.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                        No outstanding invoices.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="accounts-payable" className="space-y-4">
            <FinancePageHeader
              title="Accounts Payable"
              description="Confirmed supplier balances from LPOs pending account release. Approved expenses without payment evidence are shown as provisional."
              toolbar={financeReports.outstandingPayables}
            >
              <Badge variant="outline" className="text-[10px]">
                {accountsPayable.outstandingPayables.length} outstanding payable(s)
              </Badge>
            </FinancePageHeader>

            <div className="grid md:grid-cols-4 gap-3">
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Confirmed Supplier Balance</p>
                <p className="text-2xl font-bold">{fmt(accountsPayable.totalBalance)}</p>
              </Card>
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Suppliers</p>
                <p className="text-2xl font-bold">{accountsPayable.suppliers.length}</p>
              </Card>
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Provisional / Unverified</p>
                <p className="text-2xl font-bold">{fmt(accountsPayable.provisionalBalance)}</p>
              </Card>
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Payment Allocation</p>
                <p className="text-sm font-semibold mt-2">Available in proposed `finance_payable_allocations` table</p>
              </Card>
            </div>

            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">AP Ageing Report</h3>
                <FinanceReportToolbar {...financeReports.apAgeing} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-slate-700">
                    <th className="py-2 text-left">Supplier</th>
                    <th className="py-2 text-right">Balance</th>
                    {AGEING_BUCKETS.map((bucket) => (
                      <th key={bucket.key} className="py-2 text-right">{bucket.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accountsPayable.suppliers.map((supplier) => (
                    <tr key={`${supplier.supplierEmail}:${supplier.supplierName}`} className="border-b border-slate-800">
                      <td className="py-2">
                        <p className="font-medium">{supplier.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{supplier.supplierEmail || 'No email'}</p>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(supplier.balance)}</td>
                      {AGEING_BUCKETS.map((bucket) => (
                        <td key={bucket.key} className="py-2 text-right">{fmt(supplier.ageing[bucket.key])}</td>
                      ))}
                    </tr>
                  ))}
                  {accountsPayable.suppliers.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={7}>
                        No outstanding payables.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Outstanding Bills / Supplier Statements</h3>
                <FinanceReportToolbar {...financeReports.outstandingPayables} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-slate-700">
                    <th className="py-2 text-left">Document</th>
                    <th className="py-2 text-left">Supplier</th>
                    <th className="py-2 text-left">Source</th>
                    <th className="py-2 text-left">Payment State</th>
                    <th className="py-2 text-right">Age</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsPayable.statementItems.map((payable) => (
                    <tr key={`${payable.sourceTable}:${payable.sourceId}`} className="border-b border-slate-800">
                      <td className="py-2 font-mono text-xs">{payable.documentNumber}</td>
                      <td className="py-2">{payable.supplierName}</td>
                      <td className="py-2">{payable.sourceTable}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {payable.paymentStateLabel}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">{payable.ageDays} day(s)</td>
                      <td className="py-2 text-right font-semibold">{fmt(payable.outstandingAmount)}</td>
                    </tr>
                  ))}
                  {accountsPayable.statementItems.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={6}>
                        No outstanding bills or payables.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="chart-of-accounts" className="space-y-4">
            <FinancePageHeader
              title="Chart of Accounts"
              description="Canonical finance account structure."
              toolbar={financeReports.chartOfAccounts}
            >
              {allowAddFinanceRecords && (
                <Button onClick={() => setAccountOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Account
                </Button>
              )}
            </FinancePageHeader>

            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              {loadingFinanceAccounts ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading accounts...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-slate-700">
                      <th className="py-2 text-left">Code</th>
                      <th className="py-2 text-left">Name</th>
                      <th className="py-2 text-left">Type</th>
                      <th className="py-2 text-left">Normal</th>
                      <th className="py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeAccounts.map((account) => (
                      <tr key={account.id} className="border-b border-slate-800">
                        <td className="py-2 font-mono">{account.account_code}</td>
                        <td className="py-2 font-medium">{account.account_name}</td>
                        <td className="py-2 capitalize">{account.account_type}</td>
                        <td className="py-2 capitalize">{account.normal_balance}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {account.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="journal-entries" className="space-y-4">
            <FinancePageHeader
              title="Journal Entries"
              description="Draft and approved journals. Posting remains controlled by database validation."
              toolbar={financeReports.journals}
            >
              {allowJournalDrafts && (
                <Button onClick={() => setJournalOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Journal
                </Button>
              )}
            </FinancePageHeader>

            <div className="space-y-3">
              {loadingFinanceJournals ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading journals...</div>
              ) : financeJournals.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">No journal entries yet.</Card>
              ) : (
                financeJournals.map((journal) => {
                  const lines = journal.finance_journal_lines || [];
                  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
                  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
                  const statusLabel =
                    journal.status === 'posted'
                      ? 'posted / locked'
                      : String(journal.status || '').replaceAll('_', ' ');
                  const isBusy = (action) => journalActionBusy === `${journal.id}:${action}`;

                  return (
                    <Card key={journal.id} className="p-4 bg-slate-900/60 border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs">{journal.journal_no}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {statusLabel}
                            </Badge>
                          </div>
                          <p className="font-semibold">{journal.narration}</p>
                          {journal.rejection_reason && (
                            <p className="mt-1 text-xs text-red-300">Rejected: {journal.rejection_reason}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{safeDate(journal.journal_date)} Â· {lines.length} lines</p>
                        </div>
                        <div className="text-right text-sm">
                          <p>Debit: <span className="font-semibold">{fmt(debit)}</span></p>
                          <p>Credit: <span className="font-semibold">{fmt(credit)}</span></p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {allowJournalDrafts && ['draft', 'rejected'].includes(journal.status) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => submitJournalForReview(journal)}
                            disabled={isBusy('submit')}
                          >
                            {isBusy('submit') && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Submit for Review
                          </Button>
                        )}
                        {canApproveJournal(user) && journal.status === 'pending_review' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => approveJournal(journal)}
                            disabled={isBusy('approve')}
                          >
                            {isBusy('approve') && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Approve
                          </Button>
                        )}
                        {canApproveJournal(user) && ['pending_review', 'approved'].includes(journal.status) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectJournal(journal)}
                            disabled={isBusy('reject')}
                          >
                            {isBusy('reject') && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Reject
                          </Button>
                        )}
                        {canPostJournal(user) && journal.status === 'approved' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => postJournal(journal)}
                            disabled={isBusy('post')}
                          >
                            {isBusy('post') && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Post Journal
                          </Button>
                        )}
                        {canPostJournal(user) && journal.status === 'posted' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => createJournalReversal(journal)}
                            disabled={isBusy('reverse')}
                          >
                            {isBusy('reverse') && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Reversal Journal
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="historical-backfill" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Historical Backfill</h2>
                <p className="text-xs text-muted-foreground">
                  Create draft journals from eligible old finance records. Nothing is posted automatically.
                </p>
              </div>
              <Button
                type="button"
                onClick={createHistoricalBackfillDraftJournals}
                disabled={
                  backfillBusy ||
                  loadingBackfillPreview ||
                  Boolean(backfillSourcesError) ||
                  backfillPreview.pendingCount === 0
                }
                size="sm"
              >
                {backfillBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Draft Journals
              </Button>
            </div>

            {backfillSourcesError && (
              <Card className="p-4 border-red-500/30 bg-red-500/10">
                <p className="text-sm text-red-300">
                  Failed to load existing journal links: {backfillSourcesError.message}
                </p>
              </Card>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Eligible</p>
                <p className="text-2xl font-bold">{backfillPreview.eligibleCount}</p>
              </Card>
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Already Linked</p>
                <p className="text-2xl font-bold">{backfillPreview.alreadyBackfilledCount}</p>
              </Card>
              <Card className="p-4 bg-slate-900/60 border-slate-700">
                <p className="text-xs text-muted-foreground">Pending Drafts</p>
                <p className="text-2xl font-bold">{backfillPreview.pendingCount}</p>
              </Card>
            </div>

            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              {loadingBackfillPreview ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading backfill preview...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-slate-700">
                      <th className="py-2 text-left">Old Table</th>
                      <th className="py-2 text-left">Old Status</th>
                      <th className="py-2 text-left">Journal Type</th>
                      <th className="py-2 text-left">Debit</th>
                      <th className="py-2 text-left">Credit</th>
                      <th className="py-2 text-right">Eligible</th>
                      <th className="py-2 text-right">Linked</th>
                      <th className="py-2 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backfillPreview.rows.map((row) => {
                      const mapping = {
                        invoices: {
                          status: 'status = paid',
                          debit: 'Bank/Cash/Accounts Receivable',
                          credit: 'Service Revenue/Product Sales',
                        },
                        expenses: {
                          status: 'approval_status = approved',
                          debit: 'Expense account by category',
                          credit: 'Bank/Cash',
                        },
                        lpos: {
                          status: 'status = Funds Released',
                          debit: 'Inventory/Procurement/Expense',
                          credit: 'Bank/Cash',
                        },
                        dispatch: {
                          status: 'finance_status/status = disbursed',
                          debit: 'Logistics/Fuel/Office Expense',
                          credit: 'Bank/Cash',
                        },
                      }[row.key];

                      return (
                        <tr key={row.key} className="border-b border-slate-800">
                          <td className="py-2 font-mono text-xs">{row.sourceTable}</td>
                          <td className="py-2">{mapping.status}</td>
                          <td className="py-2">{row.journalType}</td>
                          <td className="py-2">{mapping.debit}</td>
                          <td className="py-2">{mapping.credit}</td>
                          <td className="py-2 text-right">{row.eligibleCount}</td>
                          <td className="py-2 text-right">{row.alreadyBackfilledCount}</td>
                          <td className="py-2 text-right font-semibold">{row.pendingCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="general-ledger" className="space-y-4">
            <FinancePageHeader
              title="General Ledger"
              description="Posted journal line activity by account."
              toolbar={financeReports.generalLedger}
            />
            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              {loadingGeneralLedger ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading ledger...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-slate-700">
                      <th className="py-2 text-left">Date</th>
                      <th className="py-2 text-left">Journal</th>
                      <th className="py-2 text-left">Account</th>
                      <th className="py-2 text-right">Debit</th>
                      <th className="py-2 text-right">Credit</th>
                      <th className="py-2 text-left">Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generalLedger.map((line) => (
                      <tr key={line.line_id} className="border-b border-slate-800">
                        <td className="py-2">{safeDate(line.journal_date)}</td>
                        <td className="py-2 font-mono text-xs">{line.journal_no}</td>
                        <td className="py-2">{line.account_code} - {line.account_name}</td>
                        <td className="py-2 text-right">{line.debit ? fmt(line.debit) : '-'}</td>
                        <td className="py-2 text-right">{line.credit ? fmt(line.credit) : '-'}</td>
                        <td className="py-2">{line.narration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="account-statements" className="space-y-4">
            <FinancePageHeader
              title="Account Statements"
              description="Posted journal activity with running balance."
              toolbar={financeReports.accountStatement}
            >
              <Select value={statementAccountId} onValueChange={setStatementAccountId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {financeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FinancePageHeader>

            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              {loadingAccountStatement ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading statement...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-slate-700">
                      <th className="py-2 text-left">Date</th>
                      <th className="py-2 text-left">Account</th>
                      <th className="py-2 text-right">Debit</th>
                      <th className="py-2 text-right">Credit</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountStatement.map((line) => (
                      <tr key={line.line_id} className="border-b border-slate-800">
                        <td className="py-2">{safeDate(line.journal_date)}</td>
                        <td className="py-2">{line.account_code} - {line.account_name}</td>
                        <td className="py-2 text-right">{line.debit ? fmt(line.debit) : '-'}</td>
                        <td className="py-2 text-right">{line.credit ? fmt(line.credit) : '-'}</td>
                        <td className="py-2 text-right font-semibold">{fmt(line.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="trial-balance" className="space-y-4">
            <FinancePageHeader
              title="Trial Balance"
              description="Debit and credit totals by account from posted journal lines."
              toolbar={financeReports.trialBalance}
            />
            <Card className="p-4 bg-slate-900/60 border-slate-700 overflow-x-auto">
              {loadingTrialBalance ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading trial balance...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-slate-700">
                      <th className="py-2 text-left">Account</th>
                      <th className="py-2 text-left">Type</th>
                      <th className="py-2 text-right">Debit Total</th>
                      <th className="py-2 text-right">Credit Total</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.map((account) => (
                      <tr key={account.account_id} className="border-b border-slate-800">
                        <td className="py-2">{account.account_code} - {account.account_name}</td>
                        <td className="py-2 capitalize">{account.account_type}</td>
                        <td className="py-2 text-right">{fmt(account.debit_total)}</td>
                        <td className="py-2 text-right">{fmt(account.credit_total)}</td>
                        <td className="py-2 text-right font-semibold">{fmt(account.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="bank-accounts" className="space-y-4">
            <FinancePageHeader
              title="Bank Accounts"
              description="Existing finance bank accounts and linked GL accounts. Reconciliation is deferred to a future batch."
              toolbar={financeReports.bankAccounts}
            >
              {allowAddFinanceRecords && (
                <Button onClick={() => setBankOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Bank Account
                </Button>
              )}
            </FinancePageHeader>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {loadingBankAccounts ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">Loading bank accounts...</Card>
              ) : bankAccounts.map((bank) => (
                <Card key={bank.id} className="p-4 bg-slate-900/60 border-slate-700">
                  <p className="font-semibold">{bank.bank_name}</p>
                  <p className="text-sm text-muted-foreground">{bank.account_name}</p>
                  <p className="font-mono text-xs mt-1">{bank.account_number || 'No account number'}</p>
                  <p className="text-xl font-bold mt-3">{fmt(bank.current_balance)}</p>
                  <p className="text-xs text-muted-foreground">{bank.finance_accounts?.account_name || 'No GL account linked'}</p>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="budgets" className="space-y-4">
            <FinancePageHeader
              title="Budgets"
              description="Department budget, spend, pending approvals, and remaining balance."
              toolbar={financeReports.budgets}
            >
              {allowAddFinanceRecords && (
                <Button onClick={() => setBudgetOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Budget
                </Button>
              )}
            </FinancePageHeader>
            <div className="space-y-3">
              {loadingBudgets ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">Loading budgets...</Card>
              ) : budgets.map((budget) => {
                const remaining = Number(budget.budget_amount || 0) - Number(budget.spent_amount || 0) - Number(budget.pending_amount || 0);
                return (
                  <Card key={budget.id} className="p-4 bg-slate-900/60 border-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{budget.department}</p>
                        <p className="text-xs text-muted-foreground">{safeDate(budget.period_start)} - {safeDate(budget.period_end)}</p>
                        <p className="text-xs text-muted-foreground">{budget.finance_accounts?.account_name || 'All accounts'}</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right text-sm">
                        <div><p className="text-muted-foreground text-xs">Budget</p><p className="font-semibold">{fmt(budget.budget_amount)}</p></div>
                        <div><p className="text-muted-foreground text-xs">Spent</p><p className="font-semibold">{fmt(budget.spent_amount)}</p></div>
                        <div><p className="text-muted-foreground text-xs">Pending</p><p className="font-semibold">{fmt(budget.pending_amount)}</p></div>
                        <div><p className="text-muted-foreground text-xs">Remaining</p><p className="font-semibold">{fmt(remaining)}</p></div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="fixed-assets" className="space-y-4">
            <FinancePageHeader
              title="Fixed Assets"
              description="Fixed asset register with location, assignment, status, and book value."
              toolbar={financeReports.fixedAssets}
            >
              {allowAddFinanceRecords && (
                <Button onClick={() => setAssetOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Asset
                </Button>
              )}
            </FinancePageHeader>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {loadingFixedAssets ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">Loading fixed assets...</Card>
              ) : fixedAssets.map((asset) => (
                <Card key={asset.id} className="p-4 bg-slate-900/60 border-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{asset.asset_name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{asset.asset_code}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{asset.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <p><span className="text-muted-foreground">Serial:</span> {asset.serial_number || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Dept:</span> {asset.assigned_department || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Location:</span> {asset.current_location || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Book:</span> {fmt(asset.current_book_value)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {canSeeFullFinance && (
          <TabsContent value="analytics" className="space-y-4">
            {expByCategory.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No finance analytics data is available yet.
              </Card>
            ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-slate-900/50 p-4">
                <p className="text-sm font-semibold mb-3">Expense by Category</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={expByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                      fontSize={10}
                    >
                      {expByCategory.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border bg-slate-900/50 p-4">
                <p className="text-sm font-semibold mb-3">Cash Flow Summary</p>

                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm font-medium text-green-700">
                      Total Income
                    </span>
                    <span className="text-lg font-bold text-green-700">
                      {fmt(totalIncome)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                    <span className="text-sm font-medium text-red-700">
                      Total Expenses
                    </span>
                    <span className="text-lg font-bold text-red-700">
                      {fmt(totalExpenses)}
                    </span>
                  </div>

                  <div
                    className={`flex justify-between items-center p-3 rounded-lg border ${
                      profit >= 0
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        profit >= 0 ? 'text-blue-700' : 'text-orange-700'
                      }`}
                    >
                      {profit >= 0 ? 'Net Profit' : 'Net Loss'}
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        profit >= 0 ? 'text-blue-700' : 'text-orange-700'
                      }`}
                    >
                      {fmt(Math.abs(profit))}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-sm font-medium text-amber-700">
                      Pending Payment
                    </span>
                    <span className="text-lg font-bold text-amber-700">
                      {fmt(totalPending)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={accountForm.account_code} onChange={(e) => setAccountForm((p) => ({ ...p, account_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={accountForm.account_name} onChange={(e) => setAccountForm((p) => ({ ...p, account_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={accountForm.account_type} onValueChange={(v) => setAccountForm((p) => ({ ...p, account_type: v, normal_balance: ['asset', 'expense'].includes(v) ? 'debit' : 'credit' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['asset', 'liability', 'equity', 'income', 'expense'].map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Parent</Label>
                <Select value={accountForm.parent_account_id} onValueChange={(v) => setAccountForm((p) => ({ ...p, parent_account_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {financeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.account_code} - {account.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={accountForm.description} onChange={(e) => setAccountForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={saveAccount} disabled={!accountForm.account_code || !accountForm.account_name || savingAccount}>
              {savingAccount && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={journalForm.journal_date} onChange={(e) => setJournalForm((p) => ({ ...p, journal_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Input value="Draft" readOnly />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Narration</Label>
              <Textarea value={journalForm.narration} onChange={(e) => setJournalForm((p) => ({ ...p, narration: e.target.value }))} />
            </div>
            <div className="space-y-3">
              {journalForm.lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-4 space-y-1.5">
                    <Label>Account</Label>
                    <Select
                      value={line.account_id}
                      onValueChange={(v) => setJournalLine(index, 'account_id', v)}
                      disabled={loadingFinanceAccounts || financeAccountsError || financeAccounts.length === 0}
                    >
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {loadingFinanceAccounts ? (
                          <SelectItem value="loading-accounts" disabled>
                            Loading accounts...
                          </SelectItem>
                        ) : financeAccountsError ? (
                          <SelectItem value="accounts-load-error" disabled>
                            Failed to load accounts
                          </SelectItem>
                        ) : financeAccounts.length === 0 ? (
                          <SelectItem value="no-active-accounts" disabled>
                            No active accounts found
                          </SelectItem>
                        ) : (
                          financeAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_code} - {account.account_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {financeAccountsError && (
                      <p className="text-xs text-red-300">
                        {financeAccountsLoadError?.message || 'Unable to load finance accounts.'}
                      </p>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1.5">
                    <Label>Debit</Label>
                    <Input type="number" value={line.debit} onChange={(e) => setJournalLine(index, 'debit', e.target.value)} />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1.5">
                    <Label>Credit</Label>
                    <Input type="number" value={line.credit} onChange={(e) => setJournalLine(index, 'credit', e.target.value)} />
                  </div>
                  <div className="col-span-10 md:col-span-3 space-y-1.5">
                    <Label>Description</Label>
                    <Input value={line.description} onChange={(e) => setJournalLine(index, 'description', e.target.value)} />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="col-span-2 md:col-span-1" onClick={() => removeJournalLine(index)}>
                    X
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <Button type="button" variant="outline" size="sm" onClick={addJournalLine}>Add Line</Button>
              <div className="flex gap-4">
                <span>Debit: <strong>{fmt(journalTotals.debit)}</strong></span>
                <span>Credit: <strong>{fmt(journalTotals.credit)}</strong></span>
              </div>
            </div>
            <Button className="w-full" onClick={saveJournal} disabled={!journalForm.narration || savingJournal}>
              {savingJournal && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Journal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Bank Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Bank name" value={bankForm.bank_name} onChange={(e) => setBankForm((p) => ({ ...p, bank_name: e.target.value }))} />
            <Input placeholder="Account name" value={bankForm.account_name} onChange={(e) => setBankForm((p) => ({ ...p, account_name: e.target.value }))} />
            <Input placeholder="Account number" value={bankForm.account_number} onChange={(e) => setBankForm((p) => ({ ...p, account_number: e.target.value }))} />
            <Select value={bankForm.account_id} onValueChange={(v) => setBankForm((p) => ({ ...p, account_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No GL account</SelectItem>
                {financeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.account_code} - {account.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Opening balance" value={bankForm.opening_balance} onChange={(e) => setBankForm((p) => ({ ...p, opening_balance: e.target.value }))} />
              <Input type="number" placeholder="Current balance" value={bankForm.current_balance} onChange={(e) => setBankForm((p) => ({ ...p, current_balance: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={saveBankAccount} disabled={!bankForm.bank_name || !bankForm.account_name || savingBank}>
              {savingBank && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Bank Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Budget</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Department" value={budgetForm.department} onChange={(e) => setBudgetForm((p) => ({ ...p, department: e.target.value }))} />
            <Select value={budgetForm.account_id} onValueChange={(v) => setBudgetForm((p) => ({ ...p, account_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All accounts</SelectItem>
                {financeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.account_code} - {account.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={budgetForm.period_start} onChange={(e) => setBudgetForm((p) => ({ ...p, period_start: e.target.value }))} />
              <Input type="date" value={budgetForm.period_end} onChange={(e) => setBudgetForm((p) => ({ ...p, period_end: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Budget amount" value={budgetForm.budget_amount} onChange={(e) => setBudgetForm((p) => ({ ...p, budget_amount: e.target.value }))} />
              <Input type="number" placeholder="Pending amount" value={budgetForm.pending_amount} onChange={(e) => setBudgetForm((p) => ({ ...p, pending_amount: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={saveBudget} disabled={!budgetForm.department || !budgetForm.period_start || !budgetForm.period_end || savingBudget}>
              {savingBudget && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Budget
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Fixed Asset</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Asset ID/code" value={assetForm.asset_code} onChange={(e) => setAssetForm((p) => ({ ...p, asset_code: e.target.value }))} />
              <Input placeholder="Asset name" value={assetForm.asset_name} onChange={(e) => setAssetForm((p) => ({ ...p, asset_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Type" value={assetForm.asset_type} onChange={(e) => setAssetForm((p) => ({ ...p, asset_type: e.target.value }))} />
              <Input placeholder="Serial number" value={assetForm.serial_number} onChange={(e) => setAssetForm((p) => ({ ...p, serial_number: e.target.value }))} />
            </div>
            <Select value={assetForm.account_id} onValueChange={(v) => setAssetForm((p) => ({ ...p, account_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No GL account</SelectItem>
                {financeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.account_code} - {account.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={assetForm.purchase_date} onChange={(e) => setAssetForm((p) => ({ ...p, purchase_date: e.target.value }))} />
              <Input type="number" placeholder="Purchase cost" value={assetForm.purchase_cost} onChange={(e) => setAssetForm((p) => ({ ...p, purchase_cost: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Department" value={assetForm.assigned_department} onChange={(e) => setAssetForm((p) => ({ ...p, assigned_department: e.target.value }))} />
              <Input placeholder="Assigned employee" value={assetForm.assigned_employee_name} onChange={(e) => setAssetForm((p) => ({ ...p, assigned_employee_name: e.target.value }))} />
            </div>
            <Input placeholder="Current location" value={assetForm.current_location} onChange={(e) => setAssetForm((p) => ({ ...p, current_location: e.target.value }))} />
            <Button className="w-full" onClick={saveFixedAsset} disabled={!assetForm.asset_code || !assetForm.asset_name || savingAsset}>
              {savingAsset && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Fixed Asset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInv ? 'Edit' : 'New'} Invoice / Payment Record
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client Name *</Label>
                <Input
                  value={invForm.client_name}
                  onChange={(e) => fi('client_name', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Client Email</Label>
                <Input
                  value={invForm.client_email}
                  onChange={(e) => fi('client_email', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description / Service</Label>
              <Textarea
                value={invForm.description}
                onChange={(e) => fi('description', e.target.value)}
                className="h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={invForm.amount}
                  onChange={(e) => fi('amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={invForm.currency} onValueChange={(v) => fi('currency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Source</Label>
                <Input
                  value={invForm.payment_source}
                  onChange={(e) => fi('payment_source', e.target.value)}
                  placeholder="e.g. Service Revenue, Contract"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Input
                  value={invForm.payment_mode}
                  onChange={(e) => fi('payment_mode', e.target.value)}
                  placeholder="e.g. Bank Transfer, Cash"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={invForm.status} onValueChange={(v) => fi('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INV_STATUS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={invForm.due_date || ''}
                  onChange={(e) => fi('due_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={invForm.notes}
                onChange={(e) => fi('notes', e.target.value)}
                className="h-14"
              />
            </div>

            <Button
              className="w-full"
              onClick={saveInvoice}
              disabled={!invForm.client_name || !invForm.amount || savingInv}
            >
              {savingInv && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingInv ? 'Update' : 'Save'} Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseRequestOpen} onOpenChange={setExpenseRequestOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpenseRequest ? 'Edit' : 'Create'} Expense Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Requester</Label>
                <Input
                  value={
                    editingExpenseRequest?.requester_name ||
                    user?.full_name ||
                    user?.name ||
                    user?.email ||
                    ''
                  }
                  readOnly
                />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input value={editingExpenseRequest?.department || user?.department || ''} readOnly />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expense Category *</Label>
                <Select
                  value={expenseRequestForm.expense_category}
                  onValueChange={(v) => setExpenseRequestForm((p) => ({ ...p, expense_category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount Requested *</Label>
                <Input
                  type="number"
                  value={expenseRequestForm.amount_requested}
                  onChange={(e) =>
                    setExpenseRequestForm((p) => ({ ...p, amount_requested: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Purpose *</Label>
              <Input
                value={expenseRequestForm.purpose}
                onChange={(e) => setExpenseRequestForm((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="Business purpose"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={expenseRequestForm.description}
                onChange={(e) =>
                  setExpenseRequestForm((p) => ({ ...p, description: e.target.value }))
                }
                className="h-20"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Input
                  value={expenseRequestForm.supplier_name}
                  onChange={(e) =>
                    setExpenseRequestForm((p) => ({ ...p, supplier_name: e.target.value }))
                  }
                  placeholder="Supplier name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Beneficiary</Label>
                <Input
                  value={expenseRequestForm.beneficiary_name}
                  onChange={(e) =>
                    setExpenseRequestForm((p) => ({ ...p, beneficiary_name: e.target.value }))
                  }
                  placeholder="Staff or beneficiary"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Required Date</Label>
                <Input
                  type="date"
                  value={expenseRequestForm.required_date}
                  onChange={(e) =>
                    setExpenseRequestForm((p) => ({ ...p, required_date: e.target.value }))
                  }
                />
              </div>
              {canFinanceReviewExpenseRequest(editingExpenseRequest || {}) && (
                <div className="space-y-1.5">
                  <Label>Amount Approved</Label>
                  <Input
                    type="number"
                    value={expenseRequestForm.amount_approved}
                    onChange={(e) =>
                      setExpenseRequestForm((p) => ({ ...p, amount_approved: e.target.value }))
                    }
                    placeholder="Finance/approver amount"
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-muted-foreground">
              Supporting document upload is recorded through the private attachment table after the
              migration is applied. Public document links are not generated.
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => saveExpenseRequest(false)}
                disabled={savingExpenseRequest}
              >
                {savingExpenseRequest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Draft
              </Button>
              <Button onClick={() => saveExpenseRequest(true)} disabled={savingExpenseRequest}>
                {savingExpenseRequest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseRequestPaymentOpen} onOpenChange={setExpenseRequestPaymentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Expense Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {expenseRequestForPayment && (
              <Card className="p-3 bg-slate-900/60 border-slate-700">
                <p className="font-semibold">{expenseRequestForPayment.request_number}</p>
                <p className="text-xs text-muted-foreground">{expenseRequestForPayment.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  Remaining: {fmt(getExpenseRequestRemaining(expenseRequestForPayment))}
                </p>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount Paid *</Label>
                <Input
                  type="number"
                  value={expensePaymentForm.amount_paid}
                  onChange={(e) => setExpensePaymentForm((p) => ({ ...p, amount_paid: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={expensePaymentForm.payment_date}
                  onChange={(e) => setExpensePaymentForm((p) => ({ ...p, payment_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <Select
                value={expensePaymentForm.payment_method}
                onValueChange={(v) => setExpensePaymentForm((p) => ({ ...p, payment_method: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={expensePaymentForm.payment_reference}
              onChange={(e) => setExpensePaymentForm((p) => ({ ...p, payment_reference: e.target.value }))}
              placeholder="Payment reference"
            />
            <Textarea
              value={expensePaymentForm.notes}
              onChange={(e) => setExpensePaymentForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Payment notes"
            />
            <Button
              className="w-full"
              onClick={recordExpenseRequestPayment}
              disabled={savingExpensePayment}
            >
              {savingExpensePayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record Payment and Draft Journal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExp ? 'Edit' : 'Record'} Expense</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={expForm.category} onValueChange={(v) => fe('category', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Amount (₦) *</Label>
                <Input
                  type="number"
                  value={expForm.amount}
                  onChange={(e) => fe('amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Method *</Label>
                <Select
                  value={expForm.payment_method}
                  onValueChange={(v) => fe('payment_method', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={expForm.expense_date || ''}
                  onChange={(e) => fe('expense_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Purpose / Description *</Label>
              <Textarea
                value={expForm.description}
                onChange={(e) => fe('description', e.target.value)}
                className="h-16"
                placeholder="Describe the expense purpose"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Staff Responsible</Label>
              <Input
                value={expForm.staff_responsible}
                onChange={(e) => fe('staff_responsible', e.target.value)}
                placeholder="Name of person responsible"
              />
            </div>

            {allowFinanceActions && (
              <div className="space-y-1.5">
                <Label>Approval Status</Label>
                <Select
                  value={expForm.approval_status}
                  onValueChange={(v) => fe('approval_status', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Supporting Document URL</Label>
              <Input
                value={expForm.document_url}
                onChange={(e) => fe('document_url', e.target.value)}
                placeholder="https://..."
              />
            </div>

            {!editingExp && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-3">
                <p className="text-sm font-semibold text-amber-200">
                  Controlled Finance Exception
                </p>
                <div className="space-y-1.5">
                  <Label>Exception Type *</Label>
                  <Select
                    value={expForm.controlled_exception_type}
                    onValueChange={(v) => fe('controlled_exception_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select exception type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_EXCEPTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mandatory Reason *</Label>
                  <Textarea
                    value={expForm.controlled_exception_reason}
                    onChange={(e) => fe('controlled_exception_reason', e.target.value)}
                    className="h-16"
                    placeholder="Explain why this cannot start as an expense request"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={expForm.notes}
                onChange={(e) => fe('notes', e.target.value)}
                className="h-12"
              />
            </div>

            <Button
              className="w-full"
              onClick={saveExpense}
              disabled={
                !expForm.category ||
                !expForm.amount ||
                !expForm.description ||
                savingExp
              }
            >
              {savingExp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingExp ? 'Update' : 'Record'} Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
