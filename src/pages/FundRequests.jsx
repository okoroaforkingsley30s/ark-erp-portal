import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

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
const canApproveOps = (user) =>
  ['operations', 'operation', 'ops', 'manager', 'operational_manager'].includes(normalize(user?.role));
const canCEOApprove = (user) => isCEORole(user) || isAdminRole(user);
const canDisburse = (user) => isFinanceRole(user);

const isApproved = (value) => normalize(value) === 'approved';

const isFullyApproved = (request) =>
  request.ceo_override ||
  (
    isApproved(request.hr_status) &&
    isApproved(request.agm_status) &&
    isApproved(request.operations_status)
  );

const canHRAct = (request) => !isApproved(request.hr_status) && !request.ceo_override;
const canAGMAct = (request) =>
  isApproved(request.hr_status) && !isApproved(request.agm_status) && !request.ceo_override;
const canOpsAct = (request) =>
  isApproved(request.hr_status) &&
  isApproved(request.agm_status) &&
  !isApproved(request.operations_status) &&
  !request.ceo_override;

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
  'accounts',
  'accountant',
  'admin',
];

function getRequestStage(request) {
  if (normalize(request.finance_status) === 'disbursed' || normalize(request.status) === 'disbursed') {
    return 'Disbursed';
  }

  if (request.ceo_override) return 'CEO Approved - Ready for Account';
  if (!isApproved(request.hr_status)) return 'Pending HR Approval';
  if (!isApproved(request.agm_status)) return 'Pending AGM Approval';
  if (!isApproved(request.operations_status)) return 'Pending Operations Approval';
  return 'Ready for Account Release';
}

function getStatusBadgeClass(request) {
  const stage = getRequestStage(request);

  if (stage === 'Disbursed') return 'bg-green-500/15 text-green-300 border-green-300';
  if (stage === 'Ready for Account Release' || stage === 'CEO Approved - Ready for Account') {
    return 'bg-blue-500/15 text-blue-300 border-blue-300';
  }
  return 'bg-amber-500/15 text-amber-300 border-amber-300';
}

export default function FundRequests() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const qc = useQueryClient();

  const [form, setForm] = useState({
    request_type: 'Float',
    amount: '',
    purpose: '',
    notes: '',
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['fund_requests'],
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

  const createRequest = async () => {
    if (!form.amount || !form.purpose) {
      alert('Amount and purpose are required.');
      return;
    }

    const { error } = await supabase.from('fund_requests').insert({
      request_type: form.request_type,
      amount: Number(form.amount),
      purpose: form.purpose,
      notes: form.notes || null,
      requested_by: user?.id || null,
      requested_by_email: user?.email || null,
      requested_by_name: user?.full_name || user?.name || user?.email || 'User',
      department: user?.department || null,
      role: user?.role || null,
      source_module: 'ARK ONE',
      status: 'pending',
      finance_status: 'pending_approval',
      hr_status: 'pending',
      agm_status: 'pending',
      operations_status: 'pending',
    });

    if (error) {
      alert(error.message);
      return;
    }

    setForm({
      request_type: 'Float',
      amount: '',
      purpose: '',
      notes: '',
    });

    qc.invalidateQueries({ queryKey: ['fund_requests'] });
    alert('Fund request submitted.');
  };

  const approve = async (request, type) => {
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
      payload.finance_status = 'pending_approval';
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
      payload.finance_status = 'pending_approval';
    }

    if (type === 'operations') {
      if (!canOpsAct(request)) {
        alert('This request must be approved by HR and AGM before Operations approval.');
        return;
      }

      payload.operations_status = 'approved';
      payload.operations_approved_by = user?.email || '';
      payload.operations_approved_at = new Date().toISOString();
      payload.status = 'approved';
      payload.finance_status = 'ready_for_disbursement';
    }

    if (type === 'ceo') {
      payload.ceo_override = true;
      payload.ceo_approved_by = user?.email || '';
      payload.ceo_approved_at = new Date().toISOString();
      payload.status = 'approved';
      payload.finance_status = 'ready_for_disbursement';
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

    if (String(request.request_type || '').toLowerCase() === 'loan') {
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
    alert('Fund marked as disbursed.');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-white">Fund / Loan Requests</h1>
        <p className="text-sm text-muted-foreground">
          All ARK ONE users can request funds, float, advance or loan.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-bold">New Request</h2>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Request Type</Label>
            <Input
              value={form.request_type}
              onChange={(e) =>
                setForm((p) => ({ ...p, request_type: e.target.value }))
              }
              placeholder="Float, Loan, Advance..."
            />
          </div>

          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, amount: e.target.value }))
              }
            />
          </div>

          <div>
            <Label>Purpose</Label>
            <Input
              value={form.purpose}
              onChange={(e) =>
                setForm((p) => ({ ...p, purpose: e.target.value }))
              }
            />
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea
            value={form.notes}
            onChange={(e) =>
              setForm((p) => ({ ...p, notes: e.target.value }))
            }
          />
        </div>

        <Button onClick={createRequest}>Submit Request</Button>
      </Card>

      {isLoading ? (
        <p className="text-white">Loading requests...</p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} className="p-4 space-y-3">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{request.request_type}</p>
                    <Badge variant="outline" className={getStatusBadgeClass(request)}>
                      {getRequestStage(request)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{request.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {request.requested_by_name} · {request.department || 'No department'}
                  </p>
                  {request.notes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Notes: {request.notes}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-[#ff5a00]">
                    ₦{Number(request.amount || 0).toLocaleString()}
                  </p>
                  <Badge>{request.status}</Badge>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-2 text-xs">
                <Badge variant="outline">HR: {request.hr_status || 'pending'}</Badge>
                <Badge variant="outline">AGM: {request.agm_status || 'pending'}</Badge>
                <Badge variant="outline">Operations: {request.operations_status || 'pending'}</Badge>
                <Badge variant="outline">Finance: {request.finance_status || 'pending_approval'}</Badge>
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

                {canCEOApprove(user) && !request.ceo_override && normalize(request.finance_status) !== 'disbursed' && (
                  <Button size="sm" onClick={() => approve(request, 'ceo')}>
                    CEO Override Approve
                  </Button>
                )}

                {canDisburse(user) &&
                  isFullyApproved(request) &&
                  normalize(request.finance_status) !== 'disbursed' && (
                    <Button size="sm" onClick={() => disburse(request)}>
                      Mark Disbursed
                    </Button>
                  )}

                {canDisburse(user) && !isFullyApproved(request) && (
                  <p className="text-xs text-amber-500 self-center">
                    Waiting for HR, AGM and Operations approval before Account release.
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
