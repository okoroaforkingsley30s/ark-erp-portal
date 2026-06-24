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

const normalize = (v) => String(v || '').toLowerCase().trim();

const canApproveHR = (user) => normalize(user?.role) === 'hr';
const canApproveAGM = (user) => normalize(user?.role) === 'agm';
const canApproveOps = (user) =>
  ['operations', 'operation', 'ops'].includes(normalize(user?.role));
const canCEOApprove = (user) => normalize(user?.role) === 'ceo';
const canDisburse = (user) =>
  ['finance', 'accounts', 'accountant'].includes(normalize(user?.role));

const isFullyApproved = (r) =>
  r.ceo_override ||
  (
    r.hr_status === 'approved' &&
    r.agm_status === 'approved' &&
    r.operations_status === 'approved'
  );

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
      let query = supabase
  .from('fund_requests')
  .select('*');

const role = String(user?.role || '').toLowerCase();

const approvalRoles = [
  'hr',
  'operations',
  'agm',
  'ceo',
  'finance',
  'admin',
];

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
      payload.hr_status = 'approved';
      payload.hr_approved_by = user?.email || '';
      payload.hr_approved_at = new Date().toISOString();
    }

    if (type === 'agm') {
      payload.agm_status = 'approved';
      payload.agm_approved_by = user?.email || '';
      payload.agm_approved_at = new Date().toISOString();
    }

    if (type === 'operations') {
      payload.operations_status = 'approved';
      payload.operations_approved_by = user?.email || '';
      payload.operations_approved_at = new Date().toISOString();
    }

    if (type === 'ceo') {
      payload.ceo_override = true;
      payload.ceo_approved_by = user?.email || '';
      payload.ceo_approved_at = new Date().toISOString();
      payload.status = 'approved';
      payload.finance_status = 'ready_for_disbursement';
    }

    if (type !== 'ceo') {
      const next = {
        ...request,
        ...payload,
      };

      if (isFullyApproved(next)) {
        payload.status = 'approved';
        payload.finance_status = 'ready_for_disbursement';
      }
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
    if (!isFullyApproved(request)) {
      alert('This request is not fully approved yet.');
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
          {requests.map((r) => (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-bold">{r.request_type}</p>
                  <p className="text-sm text-muted-foreground">{r.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {r.requested_by_name} · {r.department || 'No department'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-[#ff5a00]">
                    ₦{Number(r.amount || 0).toLocaleString()}
                  </p>
                  <Badge>{r.status}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">HR: {r.hr_status}</Badge>
                <Badge variant="outline">AGM: {r.agm_status}</Badge>
                <Badge variant="outline">Operations: {r.operations_status}</Badge>
                {r.ceo_override && <Badge>CEO Override</Badge>}
                <Badge variant="outline">Finance: {r.finance_status}</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {canApproveHR(user) && r.hr_status !== 'approved' && (
                  <Button size="sm" onClick={() => approve(r, 'hr')}>
                    HR Approve
                  </Button>
                )}

                {canApproveAGM(user) && r.agm_status !== 'approved' && (
                  <Button size="sm" onClick={() => approve(r, 'agm')}>
                    AGM Approve
                  </Button>
                )}

                {canApproveOps(user) && r.operations_status !== 'approved' && (
                  <Button size="sm" onClick={() => approve(r, 'operations')}>
                    Operations Approve
                  </Button>
                )}

                {canCEOApprove(user) && !r.ceo_override && (
                  <Button size="sm" onClick={() => approve(r, 'ceo')}>
                    CEO Approve
                  </Button>
                )}

                {canDisburse(user) &&
                  isFullyApproved(r) &&
                  r.finance_status !== 'disbursed' && (
                    <Button size="sm" onClick={() => disburse(r)}>
                      Mark Disbursed
                    </Button>
                  )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}