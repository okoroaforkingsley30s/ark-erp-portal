import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Wallet,
  CalendarDays,
  Landmark,
  HandCoins,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';

const normalize = (v) => String(v || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

const getRole = (user) => normalize(user?.role || user?.user_role || user?.position);

const isHRRole = (user) => getRole(user) === 'hr';
const isAGMRole = (user) => getRole(user) === 'agm';
const isOpsRole = (user) =>
  ['operations', 'operation', 'ops', 'manager', 'operational_manager'].includes(getRole(user));
const isCEORole = (user) => getRole(user) === 'ceo';
const isAdminRole = (user) => getRole(user) === 'admin';
const isFinanceRole = (user) =>
  ['finance', 'account', 'accounts', 'accountant'].includes(getRole(user));

const canApproveHR = (user) => isHRRole(user);
const canApproveAGM = (user) => isAGMRole(user);
const canApproveOps = (user) => isOpsRole(user);
const canCEOApprove = (user) => isCEORole(user) || isAdminRole(user);
const canDisburse = (user) => isFinanceRole(user);

const approvalRoles = [
  'hr',
  'operations',
  'operation',
  'ops',
  'manager',
  'operational_manager',
  'agm',
  'ceo',
  'finance',
  'account',
  'accounts',
  'accountant',
  'admin',
];

const REQUEST_CATEGORIES = {
  fund: {
    label: 'Fund Request',
    icon: Wallet,
    needsAmount: true,
    needsFinance: true,
    types: [
      'Salary Advance',
      'Travel Allowance',
      'Emergency Support',
      'Welfare',
      'Project Advance',
      'Other Fund Request',
    ],
  },
  loan: {
    label: 'Loan Request',
    icon: Landmark,
    needsAmount: true,
    needsFinance: true,
    types: [
      'Salary Loan',
      'Emergency Loan',
      'Staff Loan',
      'Asset Loan',
      'Other Loan',
    ],
  },
  float: {
    label: 'Float Request',
    icon: HandCoins,
    needsAmount: true,
    needsFinance: true,
    types: [
      'Field Float',
      'Travel Float',
      'Project Float',
      'Logistics Float',
      'Operational Float',
      'Other Float',
    ],
  },
  leave: {
    label: 'Leave Request',
    icon: CalendarDays,
    needsAmount: false,
    needsFinance: false,
    types: [
      'Annual Leave',
      'Sick Leave',
      'Casual Leave',
      'Maternity Leave',
      'Paternity Leave',
      'Compassionate Leave',
      'Study Leave',
      'Unpaid Leave',
    ],
  },
  other: {
    label: 'Other Request',
    icon: FileText,
    needsAmount: false,
    needsFinance: false,
    types: [
      'Work Tools Request',
      'Document Request',
      'Permission Request',
      'Schedule Request',
      'General Request',
    ],
  },
};

const DEFAULT_CATEGORY = 'fund';

const emptyForm = {
  request_category: DEFAULT_CATEGORY,
  request_type: REQUEST_CATEGORIES[DEFAULT_CATEGORY].types[0],
  amount: '',
  purpose: '',
  start_date: '',
  end_date: '',
  return_date: '',
  repayment_amount: '',
  repayment_frequency: 'Monthly',
  attachment_url: '',
  notes: '',
};

const isApproved = (value) => normalize(value) === 'approved';

const getRequestCategory = (request) => {
  const raw = normalize(request.request_category);

  if (raw && REQUEST_CATEGORIES[raw]) return raw;

  const type = normalize(request.request_type);

  if (type.includes('leave')) return 'leave';
  if (type.includes('loan')) return 'loan';
  if (type.includes('float')) return 'float';

  return 'fund';
};

const requestNeedsFinance = (request) => {
  const category = getRequestCategory(request);
  return Boolean(REQUEST_CATEGORIES[category]?.needsFinance);
};

const isFullyApproved = (request) =>
  request.ceo_override ||
  (
    isApproved(request.hr_status) &&
    isApproved(request.agm_status) &&
    isApproved(request.operations_status)
  );

const isCompletedWithoutFinance = (request) =>
  isFullyApproved(request) && !requestNeedsFinance(request);

const canHRAct = (request) => !isApproved(request.hr_status) && !request.ceo_override;
const canAGMAct = (request) =>
  isApproved(request.hr_status) && !isApproved(request.agm_status) && !request.ceo_override;
const canOpsAct = (request) =>
  isApproved(request.hr_status) &&
  isApproved(request.agm_status) &&
  !isApproved(request.operations_status) &&
  !request.ceo_override;

function money(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function dateLabel(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

function calculateDays(start, end) {
  if (!start || !end) return null;

  const s = new Date(start);
  const e = new Date(end);

  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;

  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;

  return diff > 0 ? diff : null;
}

function getRequestStage(request) {
  const financeStatus = normalize(request.finance_status);
  const status = normalize(request.status);

  if (financeStatus === 'disbursed' || status === 'disbursed') return 'Disbursed';
  if (status === 'completed') return 'Completed';
  if (request.ceo_override && requestNeedsFinance(request)) return 'CEO Approved - Ready for Account';
  if (request.ceo_override && !requestNeedsFinance(request)) return 'CEO Approved - Completed';
  if (!isApproved(request.hr_status)) return 'Pending HR Approval';
  if (!isApproved(request.agm_status)) return 'Pending AGM Approval';
  if (!isApproved(request.operations_status)) return 'Pending Operations Approval';
  if (requestNeedsFinance(request)) return 'Ready for Account Release';
  return 'Approved / Completed';
}

function getStatusBadgeClass(request) {
  const stage = getRequestStage(request);

  if (['Disbursed', 'Completed', 'Approved / Completed', 'CEO Approved - Completed'].includes(stage)) {
    return 'bg-green-500/15 text-green-300 border-green-300';
  }

  if (stage === 'Ready for Account Release' || stage === 'CEO Approved - Ready for Account') {
    return 'bg-blue-500/15 text-blue-300 border-blue-300';
  }

  return 'bg-amber-500/15 text-amber-300 border-amber-300';
}

function getCategoryBadgeClass(category) {
  if (category === 'leave') return 'bg-purple-500/15 text-purple-300 border-purple-300';
  if (category === 'loan') return 'bg-blue-500/15 text-blue-300 border-blue-300';
  if (category === 'float') return 'bg-orange-500/15 text-orange-300 border-orange-300';
  if (category === 'fund') return 'bg-green-500/15 text-green-300 border-green-300';
  return 'bg-slate-500/15 text-slate-300 border-slate-300';
}

export default function FundRequests() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const qc = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const activeCategory = REQUEST_CATEGORIES[form.request_category] || REQUEST_CATEGORIES.fund;
  const ActiveIcon = activeCategory.icon;

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['fund_requests', user?.email, getRole(user)],
    queryFn: async () => {
      let query = supabase.from('fund_requests').select('*');
      const role = getRole(user);

      if (!approvalRoles.includes(role)) {
        query = query.eq('requested_by_email', user?.email);
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      });

      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const pending = requests.filter((request) =>
      getRequestStage(request).startsWith('Pending')
    );

    const readyForAccount = requests.filter((request) =>
      ['Ready for Account Release', 'CEO Approved - Ready for Account'].includes(getRequestStage(request))
    );

    const completed = requests.filter((request) =>
      ['Disbursed', 'Completed', 'Approved / Completed', 'CEO Approved - Completed'].includes(getRequestStage(request))
    );

    return {
      total: requests.length,
      pending: pending.length,
      readyForAccount: readyForAccount.length,
      completed: completed.length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = search.toLowerCase().trim();

    return requests.filter((request) => {
      const category = getRequestCategory(request);
      const stage = getRequestStage(request).toLowerCase();

      const filterMatch =
        filter === 'all' ||
        category === filter ||
        stage.includes(filter);

      const searchMatch =
        !q ||
        String(request.request_type || '').toLowerCase().includes(q) ||
        String(request.request_subtype || '').toLowerCase().includes(q) ||
        String(request.purpose || '').toLowerCase().includes(q) ||
        String(request.requested_by_name || '').toLowerCase().includes(q) ||
        String(request.requested_by_email || '').toLowerCase().includes(q) ||
        String(request.department || '').toLowerCase().includes(q);

      return filterMatch && searchMatch;
    });
  }, [requests, filter, search]);

  const setCategory = (category) => {
    const next = REQUEST_CATEGORIES[category] ? category : DEFAULT_CATEGORY;

    setForm((current) => ({
      ...current,
      request_category: next,
      request_type: REQUEST_CATEGORIES[next].types[0],
      amount: REQUEST_CATEGORIES[next].needsAmount ? current.amount : '',
      start_date: next === 'leave' ? current.start_date : '',
      end_date: next === 'leave' ? current.end_date : '',
      return_date: next === 'leave' ? current.return_date : '',
      repayment_amount: next === 'loan' ? current.repayment_amount : '',
      repayment_frequency: next === 'loan' ? current.repayment_frequency : 'Monthly',
    }));
  };

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const createRequest = async () => {
    const categoryConfig = REQUEST_CATEGORIES[form.request_category] || REQUEST_CATEGORIES.fund;
    const needsAmount = categoryConfig.needsAmount;

    if (!form.request_type) {
      alert('Request type is required.');
      return;
    }

    if (needsAmount && (!form.amount || Number(form.amount) <= 0)) {
      alert('Amount is required for this request.');
      return;
    }

    if (!form.purpose.trim()) {
      alert('Purpose / reason is required.');
      return;
    }

    if (form.request_category === 'leave' && (!form.start_date || !form.end_date)) {
      alert('Leave start date and end date are required.');
      return;
    }

    const daysCount = calculateDays(form.start_date, form.end_date);

    if (form.request_category === 'leave' && !daysCount) {
      alert('Leave end date must be after or same as start date.');
      return;
    }

    const payload = {
      request_category: form.request_category,
      request_type: form.request_type,
      request_subtype: form.request_type,
      amount: needsAmount ? Number(form.amount || 0) : 0,
      purpose: form.purpose.trim(),
      notes: form.notes || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      return_date: form.return_date || null,
      days_count: daysCount,
      attachment_url: form.attachment_url || null,
      repayment_amount:
        form.request_category === 'loan' && form.repayment_amount
          ? Number(form.repayment_amount)
          : null,
      repayment_frequency:
        form.request_category === 'loan'
          ? form.repayment_frequency || 'Monthly'
          : null,
      requested_by: user?.id || null,
      requested_by_email: user?.email || user?.user_email || null,
      requested_by_name: user?.full_name || user?.name || user?.email || 'User',
      department: user?.department || null,
      role: user?.role || null,
      source_module: 'ARK ONE',
      status: 'pending',
      finance_status: categoryConfig.needsFinance ? 'pending_approval' : 'not_required',
      hr_status: 'pending',
      agm_status: 'pending',
      operations_status: 'pending',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('fund_requests').insert(payload);

    if (error) {
      alert(error.message);
      return;
    }

    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ['fund_requests'] });
    alert('Request submitted.');
  };

  const approve = async (request, type) => {
    const needsFinance = requestNeedsFinance(request);

    const payload = {
      updated_at: new Date().toISOString(),
    };

    if (type === 'hr') {
      if (!canHRAct(request)) {
        alert('This request is not at HR approval stage.');
        return;
      }

      payload.hr_status = 'approved';
      payload.hr_approved_by = user?.email || '';
      payload.hr_approved_at = new Date().toISOString();
      payload.status = 'pending_agm_approval';
      payload.finance_status = needsFinance ? 'pending_approval' : 'not_required';
    }

    if (type === 'agm') {
      if (!canAGMAct(request)) {
        alert('This request must be approved by HR before AGM approval.');
        return;
      }

      payload.agm_status = 'approved';
      payload.agm_approved_by = user?.email || '';
      payload.agm_approved_at = new Date().toISOString();
      payload.status = 'pending_operations_approval';
      payload.finance_status = needsFinance ? 'pending_approval' : 'not_required';
    }

    if (type === 'operations') {
      if (!canOpsAct(request)) {
        alert('This request must be approved by HR and AGM before Operations approval.');
        return;
      }

      payload.operations_status = 'approved';
      payload.operations_approved_by = user?.email || '';
      payload.operations_approved_at = new Date().toISOString();
      payload.status = needsFinance ? 'approved' : 'completed';
      payload.finance_status = needsFinance ? 'ready_for_disbursement' : 'not_required';
    }

    if (type === 'ceo') {
      payload.ceo_override = true;
      payload.ceo_approved_by = user?.email || '';
      payload.ceo_approved_at = new Date().toISOString();
      payload.status = needsFinance ? 'approved' : 'completed';
      payload.finance_status = needsFinance ? 'ready_for_disbursement' : 'not_required';
    }

    const { error } = await supabase
      .from('fund_requests')
      .update(payload)
      .eq('id', request.id);

    if (error) {
      alert(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ['fund_requests'] });
  };

  const disburse = async (request) => {
    if (!canDisburse(user)) {
      alert('Only Account/Finance can release funds.');
      return;
    }

    if (!requestNeedsFinance(request)) {
      alert('This request does not require Finance disbursement.');
      return;
    }

    if (!isFullyApproved(request)) {
      alert('This request is not fully approved yet. HR, AGM and Operations must approve before Account can release funds.');
      return;
    }

    const { error } = await supabase
      .from('fund_requests')
      .update({
        finance_status: 'disbursed',
        status: 'disbursed',
        disbursed_by: user?.email || '',
        disbursed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (getRequestCategory(request) === 'loan') {
      await supabase.from('hr_loans').insert({
        employee_name: request.requested_by_name || request.requested_by_email || 'Staff',
        staff_id: request.staff_id || null,
        department: request.department || null,
        employee_id: request.requested_by_email || null,
        loan_amount: Number(request.amount || 0),
        loan_purpose: request.purpose,
        repayment_amount: Number(request.repayment_amount || 0),
        repayment_frequency: request.repayment_frequency || 'Monthly',
        notes: request.notes || null,
        outstanding_balance: Number(request.amount || 0),
        total_amount_collected: 0,
        clearance_status: 'Active',
        approval_status: 'Approved',
        approved_by: user?.email || null,
        approval_date: new Date().toISOString(),
      });
    }

    qc.invalidateQueries({ queryKey: ['fund_requests'] });
    alert('Request marked as disbursed.');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-white">General Requests</h1>
        <p className="text-sm text-muted-foreground">
          Staff can request funds, loans, floats, leave and other internal approvals.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-slate-900/50 p-4">
          <FileText className="w-5 h-5 text-[#ff5a00] mb-2" />
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Requests</p>
        </div>

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <Clock className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Pending Approval</p>
        </div>

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <Wallet className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-blue-500">{stats.readyForAccount}</p>
          <p className="text-xs text-muted-foreground">Ready for Account</p>
        </div>

        <div className="rounded-xl border bg-slate-900/50 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
      </div>

      <Card className="p-4 space-y-4 bg-slate-900/60 border-slate-700">
        <div className="flex items-center gap-2">
          <ActiveIcon className="w-5 h-5 text-[#ff5a00]" />
          <h2 className="font-bold text-white">New Request</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Request Category</Label>
            <Select value={form.request_category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REQUEST_CATEGORIES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Request Type</Label>
            <Select
              value={form.request_type}
              onValueChange={(value) => updateForm('request_type', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeCategory.types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeCategory.needsAmount && (
            <div>
              <Label>Amount</Label>
              <Input
                className="mt-1"
                type="number"
                value={form.amount}
                onChange={(e) => updateForm('amount', e.target.value)}
                placeholder="0"
              />
            </div>
          )}
        </div>

        {form.request_category === 'leave' && (
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.start_date}
                onChange={(e) => updateForm('start_date', e.target.value)}
              />
            </div>

            <div>
              <Label>End Date</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.end_date}
                onChange={(e) => updateForm('end_date', e.target.value)}
              />
            </div>

            <div>
              <Label>Return Date</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.return_date}
                onChange={(e) => updateForm('return_date', e.target.value)}
              />
            </div>
          </div>
        )}

        {form.request_category === 'loan' && (
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Repayment Amount</Label>
              <Input
                className="mt-1"
                type="number"
                value={form.repayment_amount}
                onChange={(e) => updateForm('repayment_amount', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label>Repayment Frequency</Label>
              <Select
                value={form.repayment_frequency}
                onValueChange={(value) => updateForm('repayment_frequency', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="One-off">One-off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div>
          <Label>Purpose / Reason</Label>
          <Textarea
            className="mt-1"
            value={form.purpose}
            onChange={(e) => updateForm('purpose', e.target.value)}
            placeholder="Explain why this request is needed"
          />
        </div>

        <div>
          <Label>Attachment URL / Supporting Document</Label>
          <Input
            className="mt-1"
            value={form.attachment_url}
            onChange={(e) => updateForm('attachment_url', e.target.value)}
            placeholder="Optional document link"
          />
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea
            className="mt-1"
            value={form.notes}
            onChange={(e) => updateForm('notes', e.target.value)}
            placeholder="Optional extra notes"
          />
        </div>

        <Button onClick={createRequest}>Submit Request</Button>
      </Card>

      <Card className="p-4 bg-slate-900/60 border-slate-700">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['fund', 'Fund'],
              ['loan', 'Loan'],
              ['float', 'Float'],
              ['leave', 'Leave'],
              ['other', 'Other'],
              ['pending', 'Pending'],
              ['ready', 'Ready Account'],
              ['completed', 'Completed'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                  (filter === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-slate-900/50 border-border text-muted-foreground hover:bg-muted')
                }
              >
                {label}
              </button>
            ))}
          </div>

          <Input
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests..."
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const category = getRequestCategory(request);
            const categoryConfig = REQUEST_CATEGORIES[category] || REQUEST_CATEGORIES.fund;
            const CategoryIcon = categoryConfig.icon;
            const needsFinance = requestNeedsFinance(request);

            return (
              <Card key={request.id} className="p-4 space-y-3 bg-slate-900/60 border-slate-700">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={getCategoryBadgeClass(category)}>
                        <CategoryIcon className="w-3 h-3 mr-1" />
                        {categoryConfig.label}
                      </Badge>

                      <p className="font-bold text-white">{request.request_type}</p>

                      <Badge variant="outline" className={getStatusBadgeClass(request)}>
                        {getRequestStage(request)}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">{request.purpose}</p>

                    <p className="text-xs text-muted-foreground">
                      Requested by {request.requested_by_name || request.requested_by_email || 'User'} · {request.department || 'No department'}
                    </p>

                    {category === 'leave' && (
                      <p className="text-xs text-purple-300 mt-1">
                        Leave: {dateLabel(request.start_date)} - {dateLabel(request.end_date)}
                        {request.days_count ? ` · ${request.days_count} day(s)` : ''}
                        {request.return_date ? ` · Return: ${dateLabel(request.return_date)}` : ''}
                      </p>
                    )}

                    {request.attachment_url && (
                      <a
                        href={request.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-300 underline mt-1 block"
                      >
                        View attachment
                      </a>
                    )}

                    {request.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Notes: {request.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    {needsFinance ? (
                      <p className="text-2xl font-bold text-[#ff5a00]">
                        {money(request.amount)}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-slate-300">
                        No Finance Release
                      </p>
                    )}

                    <Badge>{request.status}</Badge>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-2 text-xs">
                  <Badge variant="outline">HR: {request.hr_status || 'pending'}</Badge>
                  <Badge variant="outline">AGM: {request.agm_status || 'pending'}</Badge>
                  <Badge variant="outline">Operations: {request.operations_status || 'pending'}</Badge>
                  <Badge variant="outline">Finance: {request.finance_status || (needsFinance ? 'pending_approval' : 'not_required')}</Badge>
                  {request.ceo_override && <Badge>CEO Override</Badge>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {canApproveHR(user) && canHRAct(request) && (
                    <Button size="sm" onClick={() => approve(request, 'hr')}>
                      HR Approve
                    </Button>
                  )}

                  {canApproveAGM(user) && canAGMAct(request) && (
                    <Button size="sm" onClick={() => approve(request, 'agm')}>
                      AGM Approve
                    </Button>
                  )}

                  {canApproveOps(user) && canOpsAct(request) && (
                    <Button size="sm" onClick={() => approve(request, 'operations')}>
                      Operations Approve
                    </Button>
                  )}

                  {canCEOApprove(user) &&
                    !request.ceo_override &&
                    normalize(request.finance_status) !== 'disbursed' &&
                    normalize(request.status) !== 'completed' && (
                      <Button size="sm" onClick={() => approve(request, 'ceo')}>
                        CEO Override Approve
                      </Button>
                    )}

                  {canDisburse(user) &&
                    needsFinance &&
                    isFullyApproved(request) &&
                    normalize(request.finance_status) !== 'disbursed' && (
                      <Button size="sm" onClick={() => disburse(request)}>
                        Mark Disbursed
                      </Button>
                    )}

                  {canDisburse(user) && needsFinance && !isFullyApproved(request) && (
                    <p className="text-xs text-amber-500 self-center">
                      Waiting for HR, AGM and Operations approval before Account release.
                    </p>
                  )}

                  {isCompletedWithoutFinance(request) && (
                    <p className="text-xs text-green-400 self-center">
                      Approved and completed. Finance release is not required for this request.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}

          {filteredRequests.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No requests found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}