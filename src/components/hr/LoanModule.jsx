import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import {
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  CreditCard
} from 'lucide-react';

const STATUS_COLOR = {
  Pending: 'bg-amber-50 text-amber-700',
  Approved: 'bg-green-50 text-green-700',
  Rejected: 'bg-red-50 text-red-700'
};

const CLEAR_COLOR = {
  Active: 'bg-blue-50 text-blue-700',
  Cleared: 'bg-green-50 text-green-700',
  Defaulted: 'bg-red-50 text-red-700'
};

const EMPTY = {
  employee_name: '',
  staff_id: '',
  department: '',
  loan_amount: '',
  loan_purpose: '',
  repayment_amount: '',
  repayment_frequency: 'Monthly',
  notes: ''
};

export default function LoanModule({
  loans,
  canManage,
  user
}) {

  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (k, v) =>
    setForm(f => ({
      ...f,
      [k]: v
    }));

  const totalActive = loans
    .filter(
      l =>
        l.clearance_status === 'Active'
        && l.approval_status === 'Approved'
    )
    .reduce(
      (s, l) =>
        s + (l.outstanding_balance || 0),
      0
    );

  const submit = async () => {

    try {

      setSaving(true);

      const amount =
        parseFloat(form.loan_amount) || 0;

      const payload = {
        employee_name: form.employee_name,
        staff_id: form.staff_id || null,
        department: form.department || null,
        employee_id: user?.email || null,

        loan_amount: amount,
        loan_purpose: form.loan_purpose,

        repayment_amount:
          parseFloat(form.repayment_amount) || 0,

        repayment_frequency:
          form.repayment_frequency,

        notes: form.notes || null,

        outstanding_balance: amount,
        total_amount_collected: 0,

        clearance_status: 'Active',
        approval_status: 'Pending'
      };

      const { error } = await supabase
        .from('hr_loans')
        .insert([payload]);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-loans']
      });

      setForm(EMPTY);
      setOpen(false);

      alert('Loan request submitted');

    } catch (err) {

      alert(
        'Error submitting loan request: '
        + (err?.message || 'Unknown error')
      );

    } finally {

      setSaving(false);
    }
  };

  const approve = async (loan, status) => {

    try {

      const { error } = await supabase
        .from('hr_loans')
        .update({
          approval_status: status,
          approved_by: user?.email || null,
          approval_date: new Date().toISOString()
        })
        .eq('id', loan.id);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-loans']
      });

    } catch (err) {

      alert(
        'Error updating loan: '
        + (err?.message || 'Unknown error')
      );
    }
  };

  const recordRepayment = async () => {

    if (!selectedLoan || !repayAmount)
      return;

    try {

      setSaving(true);

      const amount =
        parseFloat(repayAmount);

      const newTotal =
        (selectedLoan.total_amount_collected || 0)
        + amount;

      const newBalance = Math.max(
        0,
        (selectedLoan.outstanding_balance || 0)
        - amount
      );

      const history = [
        ...(selectedLoan.repayment_history || []),
        {
          date: new Date().toISOString(),
          amount,
          recorded_by: user?.email || null
        }
      ];

      const { error } = await supabase
        .from('hr_loans')
        .update({
          total_amount_collected: newTotal,
          outstanding_balance: newBalance,
          repayment_history: history,
          clearance_status:
            newBalance === 0
              ? 'Cleared'
              : 'Active'
        })
        .eq('id', selectedLoan.id);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-loans']
      });

      setRepayOpen(false);
      setRepayAmount('');
      setSelectedLoan(null);

    } catch (err) {

      alert(
        'Error recording repayment: '
        + (err?.message || 'Unknown error')
      );

    } finally {

      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-3 gap-3">

        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Total Loans
          </p>

          <p className="text-2xl font-bold">
            {loans.length}
          </p>
        </Card>

        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Active
          </p>

          <p className="text-2xl font-bold">
            {
              loans.filter(
                l =>
                  l.clearance_status === 'Active'
              ).length
            }
          </p>
        </Card>

        <Card className="p-3 text-center border-red-200">
          <p className="text-xs text-red-700">
            Outstanding Balance
          </p>

          <p className="text-lg font-bold text-red-700">
            ₦{totalActive.toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Request Loan
        </Button>
      </div>

      <div className="space-y-3">

        {loans.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No loan records.
          </div>
        )}

        {loans.map(loan => (

          <Card key={loan.id} className="p-4">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div>

                <div className="flex items-center gap-2 mb-1">

                  <span className="font-semibold">
                    {loan.employee_name}
                  </span>

                  {loan.staff_id && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {loan.staff_id}
                    </span>
                  )}

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      STATUS_COLOR[
                        loan.approval_status
                      ] || ''
                    }`}
                  >
                    {loan.approval_status}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      CLEAR_COLOR[
                        loan.clearance_status
                      ] || ''
                    }`}
                  >
                    {loan.clearance_status}
                  </Badge>
                </div>

                <p className="text-sm">
                  Amount:{' '}
                  <span className="font-bold">
                    ₦{
                      (loan.loan_amount || 0)
                        .toLocaleString()
                    }
                  </span>
                </p>

                <p className="text-xs text-muted-foreground">
                  Purpose: {loan.loan_purpose}
                </p>

                {loan.approval_status === 'Approved' && (

                  <div className="flex gap-4 mt-1 text-xs">

                    <span>
                      Collected:{' '}
                      <span className="font-medium text-green-700">
                        ₦{
                          (
                            loan.total_amount_collected || 0
                          ).toLocaleString()
                        }
                      </span>
                    </span>

                    <span>
                      Balance:{' '}
                      <span className="font-medium text-red-700">
                        ₦{
                          (
                            loan.outstanding_balance || 0
                          ).toLocaleString()
                        }
                      </span>
                    </span>

                  </div>
                )}

              </div>

              {canManage && (

                <div className="flex flex-col gap-1">

                  {loan.approval_status === 'Pending' && (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() =>
                          approve(loan, 'Approved')
                        }
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive text-xs"
                        onClick={() =>
                          approve(loan, 'Rejected')
                        }
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}

                  {loan.approval_status === 'Approved'
                    && loan.clearance_status === 'Active' && (

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setSelectedLoan(loan);
                        setRepayOpen(true);
                      }}
                    >
                      <CreditCard className="w-3 h-3 mr-1" />
                      Record Repayment
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>

        <DialogContent className="sm:max-w-md">

          <DialogHeader>
            <DialogTitle>
              Request Loan
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1">
                <Label className="text-xs">
                  Your Name *
                </Label>

                <Input
                  value={form.employee_name}
                  onChange={e =>
                    set(
                      'employee_name',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Staff ID
                </Label>

                <Input
                  value={form.staff_id}
                  onChange={e =>
                    set(
                      'staff_id',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Loan Amount (₦) *
                </Label>

                <Input
                  type="number"
                  value={form.loan_amount}
                  onChange={e =>
                    set(
                      'loan_amount',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Repayment/Period (₦)
                </Label>

                <Input
                  type="number"
                  value={form.repayment_amount}
                  onChange={e =>
                    set(
                      'repayment_amount',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1 col-span-2">

                <Label className="text-xs">
                  Frequency
                </Label>

                <Select
                  value={form.repayment_frequency}
                  onValueChange={v =>
                    set(
                      'repayment_frequency',
                      v
                    )
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {[
                      'Monthly',
                      'Bi-Weekly',
                      'Weekly'
                    ].map(f => (
                      <SelectItem
                        key={f}
                        value={f}
                      >
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">

              <Label className="text-xs">
                Purpose *
              </Label>

              <Textarea
                value={form.loan_purpose}
                onChange={e =>
                  set(
                    'loan_purpose',
                    e.target.value
                  )
                }
                className="h-16 text-sm"
              />
            </div>

            <Button
              className="w-full"
              onClick={submit}
              disabled={
                !form.employee_name
                || !form.loan_amount
                || !form.loan_purpose
                || saving
              }
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              Submit
            </Button>

          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={repayOpen}
        onOpenChange={setRepayOpen}
      >

        <DialogContent className="sm:max-w-xs">

          <DialogHeader>
            <DialogTitle>
              Record Repayment
            </DialogTitle>
          </DialogHeader>

          {selectedLoan && (

            <div className="space-y-3">

              <p className="text-sm">
                {selectedLoan.employee_name}
                {' '}·{' '}
                Balance:{' '}
                <span className="font-bold text-red-700">
                  ₦{
                    (
                      selectedLoan.outstanding_balance || 0
                    ).toLocaleString()
                  }
                </span>
              </p>

              <div className="space-y-1">

                <Label className="text-xs">
                  Amount Paid (₦)
                </Label>

                <Input
                  type="number"
                  value={repayAmount}
                  onChange={e =>
                    setRepayAmount(
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <Button
                className="w-full"
                onClick={recordRepayment}
                disabled={!repayAmount || saving}
              >
                {saving
                  ? 'Saving…'
                  : 'Record Payment'}
              </Button>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}