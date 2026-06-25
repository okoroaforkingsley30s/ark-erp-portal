import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  approval_status: 'pending',
  expense_date: new Date().toISOString().slice(0, 10),
  document_url: '',
  notes: '',
};

const fmt = (n) => '₦' + Number(n || 0).toLocaleString();

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

function getFinanceRole(user) {
  return normalize(user?.role || user?.user_role || user?.position);
}

function canViewFullFinance(user) {
  const role = getFinanceRole(user);
  return ['admin', 'ceo', 'finance', 'account', 'accounts', 'accountant'].includes(role);
}

function canManageFinance(user) {
  const role = getFinanceRole(user);
  return ['admin', 'ceo'].includes(role);
}

function canAddFinanceRecord(user) {
  const role = getFinanceRole(user);
  return ['admin', 'ceo', 'finance', 'accounts', 'accountant'].includes(role);
}

function canProcessDispatchFunds(user) {
  const role = getFinanceRole(user);
  return ['admin', 'ceo', 'finance', 'accounts', 'accountant'].includes(role);
}

export default function FinancePortal() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const qc = useQueryClient();

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

  const [fundFilter, setFundFilter] = useState('all');
  const [fundSearch, setFundSearch] = useState('');
  const [fundActionBusy, setFundActionBusy] = useState(null);
  const [fundActionForms, setFundActionForms] = useState({});

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

  const approvedExpenses = expenses.filter((e) => e.approval_status === 'approved');

  const totalExpenses = approvedExpenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  const profit = totalIncome - totalExpenses;

  const dispatchFundStats = useMemo(() => {
    const pending = dispatchFunds.filter((r) =>
      ['pending_review', 'pending_finance'].includes(getFundFinanceStatus(r))
    );

    const approved = dispatchFunds.filter((r) => getFundFinanceStatus(r) === 'approved');
    const rejected = dispatchFunds.filter((r) => getFundFinanceStatus(r) === 'rejected');
    const disbursed = dispatchFunds.filter((r) => getFundFinanceStatus(r) === 'disbursed');

    return {
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      disbursedCount: disbursed.length,
      pendingAmount: pending.reduce((s, r) => s + Number(r.requested_amount || 0), 0),
      approvedAmount: approved.reduce(
        (s, r) => s + Number(r.approved_amount || r.requested_amount || 0),
        0
      ),
      disbursedAmount: disbursed.reduce(
        (s, r) => s + Number(r.approved_amount || r.requested_amount || 0),
        0
      ),
    };
  }, [dispatchFunds]);

  const monthlyIncome = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
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
      .filter((e) => e.category === cat && e.approval_status === 'approved')
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
    return form.approved_amount ?? request.approved_amount ?? request.requested_amount ?? '';
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

      setSavingExp(true);

      const payload = {
        category: expForm.category,
        amount: parseFloat(expForm.amount) || 0,
        currency: 'NGN',
        payment_method: expForm.payment_method,
        description: expForm.description,
        staff_responsible: expForm.staff_responsible || null,
        staff_email: user?.email || '',
        approval_status: canManageFinance(user)
          ? expForm.approval_status || 'pending'
          : 'pending',
        expense_date: expForm.expense_date || null,
        document_url: expForm.document_url || null,
        notes: expForm.notes || null,
        expense_number:
          editingExp?.expense_number || 'EXP-' + Date.now().toString().slice(-6),
        updated_at: new Date().toISOString(),
      };

      let error;

      if (editingExp) {
        ({ error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExp.id));
      } else {
        ({ error } = await supabase.from('expenses').insert({
          ...payload,
          created_at: new Date().toISOString(),
        }));
      }

      if (error) throw error;

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

      qc.invalidateQueries({ queryKey: ['inventory_dispatch_fund_requests'] });
      qc.invalidateQueries({ queryKey: ['inventory_part_requests'] });
      qc.invalidateQueries({ queryKey: ['part_requests_dashboard'] });

      alert('Dispatch fund approved.');
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
    const approvedAmount = Number(fundRequest.approved_amount || fundRequest.requested_amount || 0);

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

      qc.invalidateQueries({ queryKey: ['inventory_dispatch_fund_requests'] });
      qc.invalidateQueries({ queryKey: ['inventory_part_requests'] });
      qc.invalidateQueries({ queryKey: ['part_requests_dashboard'] });

      alert('Dispatch fund marked as disbursed. Inventory can now dispatch.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to mark fund as disbursed.');
    } finally {
      setFundActionBusy(null);
    }
  };

  const filteredInvoices = invoices.filter(
    (i) => invFilter === 'all' || i.status === invFilter
  );

  const filteredExpenses = expenses.filter(
    (e) => expCatFilter === 'all' || e.category === expCatFilter
  );

  const filteredDispatchFunds = dispatchFunds.filter((request) => {
    const status = getFundFinanceStatus(request);
    const q = fundSearch.toLowerCase().trim();

    const statusMatch =
      fundFilter === 'all' ||
      status === fundFilter ||
      (fundFilter === 'pending_review' &&
        ['pending_review', 'pending_finance'].includes(status));

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

  const canSeeFullFinance = canViewFullFinance(user);
  const allowFinanceActions = canProcessDispatchFunds(user);
  const allowAddFinanceRecords = canAddFinanceRecord(user);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <DollarSign className="w-6 h-6 text-primary" />
            Finance Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Dispatch fund approval · Income & expense management · Financial reporting
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      <Tabs defaultValue="dispatch-funds">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dispatch-funds">Dispatch Funds</TabsTrigger>
          {canSeeFullFinance && (
            <>
              <TabsTrigger value="income">Income / Invoices</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              {expByCategory.length > 0 && (
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              )}
            </>
          )}
        </TabsList>

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
                          {fmt(request.approved_amount)}
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
                          Record Expense
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

        {canSeeFullFinance && expByCategory.length > 0 && (
          <TabsContent value="analytics" className="space-y-4">
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
          </TabsContent>
        )}
      </Tabs>

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
