import React, { useState } from 'react';
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
  Trash2,
  BarChart3,
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

export default function FinancePortal() {
  const { user } = useOutletContext();
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

  const saveInvoice = async () => {
    try {
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
      setSavingExp(true);

      const payload = {
        category: expForm.category,
        amount: parseFloat(expForm.amount) || 0,
        currency: 'NGN',
        payment_method: expForm.payment_method,
        description: expForm.description,
        staff_responsible: expForm.staff_responsible || null,
        staff_email: user?.email || '',
        approval_status: expForm.approval_status || 'pending',
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

  const filteredInvoices = invoices.filter(
    (i) => invFilter === 'all' || i.status === invFilter
  );

  const filteredExpenses = expenses.filter(
    (e) => expCatFilter === 'all' || e.category === expCatFilter
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" />
            Finance Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Income & expense management · Financial reporting
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-green-600">{fmt(totalIncome)}</p>
          <p className="text-xs text-muted-foreground">Total Income (Paid)</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <TrendingDown className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold text-red-600">{fmt(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground">Total Expenses</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
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

        <div className="rounded-xl border bg-card p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-amber-600">{fmt(totalOverdue)}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
      </div>

      {monthlyIncome.some((m) => m.income > 0) && (
        <div className="rounded-xl border bg-card p-4">
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

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income / Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          {expByCategory.length > 0 && (
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          )}
        </TabsList>

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
                      : 'bg-card border-border text-muted-foreground hover:bg-muted')
                  }
                >
                  {s === 'all' ? 'All' : INV_STATUS[s]?.label}
                </button>
              ))}
            </div>

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
                        <p className="text-xl font-bold">{fmt(inv.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.currency || 'NGN'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
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

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive ml-auto"
                        onClick={() => deleteInvoice(inv.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
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

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setExpCatFilter('all')}
                className={
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                  (expCatFilter === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground hover:bg-muted')
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
                      : 'bg-card border-border text-muted-foreground hover:bg-muted')
                  }
                >
                  {c}
                </button>
              ))}
            </div>

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

                      {['admin', 'manager', 'agm', 'ceo'].includes(user?.role) && (
                        <>
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
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive ml-auto"
                        onClick={() => deleteExpense(exp.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
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

        {expByCategory.length > 0 && (
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-card p-4">
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

              <div className="rounded-xl border bg-card p-4">
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