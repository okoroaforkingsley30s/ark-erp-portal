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
  Loader2
} from 'lucide-react';

import {
  differenceInDays
} from 'date-fns';

const STATUS_COLOR = {
  Pending: 'bg-amber-50 text-amber-700',
  'HR Reviewed': 'bg-blue-50 text-blue-700',
  Approved: 'bg-green-50 text-green-700',
  Rejected: 'bg-red-50 text-red-700'
};

const EMPTY = {
  employee_name: '',
  staff_id: '',
  department: '',
  leave_type: 'Annual Leave',
  start_date: '',
  end_date: '',
  number_of_days: 0,
  reason: '',
  supporting_document: ''
};

export default function LeaveModule({
  leaveRequests,
  canManage,
  user
}) {

  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const set = (k, v) =>
    setForm(f => ({
      ...f,
      [k]: v
    }));

  const calcDays = (start, end) => {
    if (!start || !end) return 0;

    return Math.max(
      0,
      differenceInDays(
        new Date(end),
        new Date(start)
      ) + 1
    );
  };

  const filtered = leaveRequests.filter(
    l => filterStatus === 'all'
      || l.approval_status === filterStatus
  );

  const pending = leaveRequests.filter(
    l => l.approval_status === 'Pending'
  ).length;

  const submit = async () => {
    try {
      setSaving(true);

      const payload = {
        employee_name: form.employee_name,
        staff_id: form.staff_id || null,
        department: form.department || null,
        leave_type: form.leave_type,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        number_of_days: calcDays(
          form.start_date,
          form.end_date
        ),
        reason: form.reason,
        supporting_document: form.supporting_document || null,
        employee_id: user?.email || null,
        approval_status: 'Pending'
      };

      const { error } = await supabase
        .from('hr_leave')
        .insert([payload]);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-leaves']
      });

      setForm(EMPTY);
      setOpen(false);

      alert('Leave request submitted successfully');

    } catch (err) {

      alert(
        'Error submitting leave request: '
        + (err?.message || 'Unknown error')
      );

    } finally {
      setSaving(false);
    }
  };

  const approve = async (req, status) => {
    try {

      const { error } = await supabase
        .from('hr_leave')
        .update({
          approval_status: status,
          approved_by: user?.email || null,
          approval_date: new Date().toISOString()
        })
        .eq('id', req.id);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-leaves']
      });

    } catch (err) {

      alert(
        'Error updating leave request: '
        + (err?.message || 'Unknown error')
      );
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap gap-2 items-center justify-between">

        <div className="flex gap-2 flex-wrap">
          {[
            'all',
            'Pending',
            'HR Reviewed',
            'Approved',
            'Rejected'
          ].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s === 'all' ? 'All' : s}
              {s === 'Pending' && pending > 0
                ? ` (${pending})`
                : ''}
            </button>
          ))}
        </div>

        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Request Leave
        </Button>
      </div>

      <div className="space-y-3">

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No leave requests found.
          </div>
        )}

        {filtered.map(req => (

          <Card key={req.id} className="p-4">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">
                    {req.employee_name}
                  </span>

                  {req.staff_id && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {req.staff_id}
                    </span>
                  )}

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      STATUS_COLOR[req.approval_status] || ''
                    }`}
                  >
                    {req.approval_status}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {req.leave_type}
                  </span>
                  {' '}·{' '}
                  {req.number_of_days} day(s)
                </p>

                <p className="text-xs text-muted-foreground">
                  {req.start_date} → {req.end_date}
                </p>

                {req.reason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reason: {req.reason}
                  </p>
                )}

                {req.approved_by && (
                  <p className="text-xs text-muted-foreground">
                    {req.approval_status === 'Approved'
                      ? 'Approved'
                      : 'Reviewed'} by: {req.approved_by}
                  </p>
                )}
              </div>
            </div>

            {canManage && req.approval_status === 'Pending' && (

              <div className="flex gap-2 mt-3">

                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() =>
                    approve(req, 'HR Reviewed')
                  }
                >
                  Mark HR Reviewed
                </Button>

                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={() =>
                    approve(req, 'Approved')
                  }
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Approve
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive text-xs"
                  onClick={() =>
                    approve(req, 'Rejected')
                  }
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Reject
                </Button>

              </div>
            )}

          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>

        <DialogContent className="sm:max-w-md">

          <DialogHeader>
            <DialogTitle>
              Submit Leave Request
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
                    set('employee_name', e.target.value)
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
                    set('staff_id', e.target.value)
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1 col-span-2">

                <Label className="text-xs">
                  Leave Type
                </Label>

                <Select
                  value={form.leave_type}
                  onValueChange={v =>
                    set('leave_type', v)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {[
                      'Sick Leave',
                      'Examination Leave',
                      'Bereavement Leave',
                      'Annual Leave',
                      'Casual Leave'
                    ].map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Start Date *
                </Label>

                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => {
                    set('start_date', e.target.value);

                    set(
                      'number_of_days',
                      calcDays(
                        e.target.value,
                        form.end_date
                      )
                    );
                  }}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  End Date *
                </Label>

                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => {
                    set('end_date', e.target.value);

                    set(
                      'number_of_days',
                      calcDays(
                        form.start_date,
                        e.target.value
                      )
                    );
                  }}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {form.start_date && form.end_date && (
              <p className="text-xs text-primary font-medium">
                {calcDays(
                  form.start_date,
                  form.end_date
                )} day(s) requested
              </p>
            )}

            <div className="space-y-1">

              <Label className="text-xs">
                Reason *
              </Label>

              <Textarea
                value={form.reason}
                onChange={e =>
                  set('reason', e.target.value)
                }
                className="h-16 text-sm"
              />
            </div>

            <Button
              className="w-full"
              onClick={submit}
              disabled={
                !form.employee_name
                || !form.start_date
                || !form.end_date
                || !form.reason
                || saving
              }
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              Submit Request
            </Button>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}