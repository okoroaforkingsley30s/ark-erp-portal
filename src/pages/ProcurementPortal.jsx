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

import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Loader2,
  Package,
  Building2,
  Calendar,
} from 'lucide-react';

import { format } from 'date-fns';

const REQ_STATUS = {
  pending: {
    label: 'Pending',
    color:
      'bg-amber-50 text-amber-700 border-amber-200',
  },

  approved: {
    label: 'Approved',
    color:
      'bg-green-50 text-green-700 border-green-200',
  },

  rejected: {
    label: 'Rejected',
    color:
      'bg-red-50 text-red-700 border-red-200',
  },

  ordered: {
    label: 'Ordered',
    color:
      'bg-blue-50 text-blue-700 border-blue-200',
  },

  received: {
    label: 'Received',
    color:
      'bg-purple-50 text-purple-700 border-purple-200',
  },
};

const PRIORITY = {
  low: 'bg-slate-50 text-slate-600',

  medium:
    'bg-blue-50 text-blue-700',

  high:
    'bg-amber-50 text-amber-700',

  critical:
    'bg-red-50 text-red-700',
};

const EMPTY = {
  title: '',
  description: '',
  vendor_name: '',
  vendor_contact: '',
  total_amount: '',
  currency: 'NGN',
  priority: 'medium',
  expected_delivery: '',
};

async function fetchPurchaseRequests(
  role,
  email
) {
  let query = supabase
    .from('purchase_requests')
    .select('*')
    .order('created_at', {
      ascending: false,
    });

  if (
    ![
      'admin',
      'finance',
      'procurement',
    ].includes(role)
  ) {
    query = query.eq(
      'requester_email',
      email
    );
  }

  const { data, error } =
    await query.limit(
      [
        'admin',
        'finance',
        'procurement',
      ].includes(role)
        ? 200
        : 100
    );

  if (error) throw error;

  return data || [];
}

export default function ProcurementPortal() {
  const { user } =
    useOutletContext();

  const role = user?.role;

  const qc = useQueryClient();

  const [open, setOpen] =
    useState(false);

  const [form, setForm] =
    useState(EMPTY);

  const [saving, setSaving] =
    useState(false);

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('all');

  const {
    data: requests = [],
    isLoading,
  } = useQuery({
    queryKey: [
      'purchase-requests',
      role,
      user?.email,
    ],

    queryFn: () =>
      fetchPurchaseRequests(
        role,
        user.email
      ),

    enabled: !!user?.email,
  });

  const pending =
    requests.filter(
      (r) => r.status === 'pending'
    ).length;

  const filtered =
    requests.filter(
      (r) =>
        statusFilter === 'all' ||
        r.status === statusFilter
    );

  const totalValue =
    filtered.reduce(
      (s, r) =>
        s + (r.total_amount || 0),
      0
    );

  const f = (k, v) =>
    setForm((p) => ({
      ...p,
      [k]: v,
    }));

  const refresh = () => {
    qc.invalidateQueries({
      queryKey: [
        'purchase-requests',
      ],
    });
  };

  const submitRequest =
    async () => {
      try {
        setSaving(true);

        const { error } =
          await supabase
            .from(
              'purchase_requests'
            )
            .insert({
              ...form,

              total_amount:
                parseFloat(
                  form.total_amount
                ) || 0,

              requester_email:
                user.email,

              requester_name:
                user.full_name,

              status: 'pending',

              request_number:
                'PO-' +
                Date.now()
                  .toString()
                  .slice(-6),
            });

        if (error) throw error;

        refresh();

        setForm(EMPTY);

        setOpen(false);
      } catch (err) {
        console.error(err);
        alert(
          err.message ||
            'Failed to submit request'
        );
      } finally {
        setSaving(false);
      }
    };

  const handleAction =
    async (req, status) => {
      try {
        const { error } =
          await supabase
            .from(
              'purchase_requests'
            )
            .update({
              status,

              approver_email:
                user.email,

              approved_date:
                new Date().toISOString(),
            })
            .eq('id', req.id);

        if (error) throw error;

        refresh();
      } catch (err) {
        console.error(err);
        alert(
          err.message ||
            'Failed to update request'
        );
      }
    };

  const isApprover = [
    'admin',
    'finance',
    'procurement',
  ].includes(role);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Procurement
          </h1>

          <p className="text-sm text-muted-foreground">
            Purchase requests and vendor management
          </p>
        </div>

        <Button
          onClick={() => {
            setForm(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-bold">
            {requests.length}
          </p>

          <p className="text-xs text-muted-foreground">
            Total Requests
          </p>
        </div>

        <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
          <p className="text-2xl font-bold text-amber-600">
            {pending}
          </p>

          <p className="text-xs text-muted-foreground">
            Pending Approval
          </p>
        </div>

        <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
          <p className="text-2xl font-bold text-blue-600">
            {
              requests.filter(
                (r) =>
                  r.status ===
                  'ordered'
              ).length
            }
          </p>

          <p className="text-xs text-muted-foreground">
            Ordered
          </p>
        </div>

        <div className="rounded-xl border bg-green-50 border-green-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            ₦
            {(
              totalValue / 1000
            ).toFixed(0)}
            K
          </p>

          <p className="text-xs text-muted-foreground">
            Total Value
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          'all',
          ...Object.keys(
            REQ_STATUS
          ),
        ].map((s) => (
          <button
            key={s}
            onClick={() =>
              setStatusFilter(s)
            }
            className={
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
              (statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground')
            }
          >
            {s === 'all'
              ? 'All'
              : REQ_STATUS[s]
                  ?.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const sc =
              REQ_STATUS[
                req.status
              ] ||
              REQ_STATUS.pending;

            return (
              <Card
                key={req.id}
                className="p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {
                          req.request_number
                        }
                      </span>

                      <Badge
                        variant="outline"
                        className={
                          sc.color +
                          ' text-[10px]'
                        }
                      >
                        {sc.label}
                      </Badge>

                      <Badge
                        variant="outline"
                        className={
                          (PRIORITY[
                            req.priority
                          ] || '') +
                          ' text-[10px] capitalize border'
                        }
                      >
                        {req.priority}
                      </Badge>
                    </div>

                    <p className="font-semibold">
                      {req.title}
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      By:{' '}
                      {
                        req.requester_name
                      }{' '}
                      ·{' '}
                      {req.department ||
                        ''}
                    </p>

                    {req.vendor_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        Vendor:{' '}
                        {
                          req.vendor_name
                        }
                      </p>
                    )}

                    {req.expected_delivery && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        Expected:{' '}
                        {format(
                          new Date(
                            req.expected_delivery
                          ),
                          'MMM d, yyyy'
                        )}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold">
                      ₦
                      {Number(
                        req.total_amount ||
                          0
                      ).toLocaleString()}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {req.currency ||
                        'NGN'}
                    </p>
                  </div>
                </div>

                {isApprover && (
                  <div className="flex gap-2 pt-3 border-t border-border">
                    {req.status ===
                      'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() =>
                            handleAction(
                              req,
                              'approved'
                            )
                          }
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Approve
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() =>
                            handleAction(
                              req,
                              'rejected'
                            )
                          }
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}

                    {req.status ===
                      'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleAction(
                            req,
                            'ordered'
                          )
                        }
                      >
                        <Truck className="w-3 h-3 mr-1" />
                        Mark Ordered
                      </Button>
                    )}

                    {req.status ===
                      'ordered' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleAction(
                            req,
                            'received'
                          )
                        }
                      >
                        <Package className="w-3 h-3 mr-1" />
                        Mark Received
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {filtered.length ===
            0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>
                No requests found
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              New Purchase Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>
                Title *
              </Label>

              <Input
                value={form.title}
                onChange={(e) =>
                  f(
                    'title',
                    e.target.value
                  )
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Description
              </Label>

              <Textarea
                value={
                  form.description
                }
                onChange={(e) =>
                  f(
                    'description',
                    e.target.value
                  )
                }
                className="h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Vendor Name
                </Label>

                <Input
                  value={
                    form.vendor_name
                  }
                  onChange={(e) =>
                    f(
                      'vendor_name',
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Vendor Contact
                </Label>

                <Input
                  value={
                    form.vendor_contact
                  }
                  onChange={(e) =>
                    f(
                      'vendor_contact',
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Total Amount
                  (₦) *
                </Label>

                <Input
                  type="number"
                  value={
                    form.total_amount
                  }
                  onChange={(e) =>
                    f(
                      'total_amount',
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Priority
                </Label>

                <Select
                  value={
                    form.priority
                  }
                  onValueChange={(
                    v
                  ) =>
                    f(
                      'priority',
                      v
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="low">
                      Low
                    </SelectItem>

                    <SelectItem value="medium">
                      Medium
                    </SelectItem>

                    <SelectItem value="high">
                      High
                    </SelectItem>

                    <SelectItem value="critical">
                      Critical
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Expected Delivery
              </Label>

              <Input
                type="date"
                value={
                  form.expected_delivery
                }
                onChange={(e) =>
                  f(
                    'expected_delivery',
                    e.target.value
                  )
                }
              />
            </div>

            <Button
              className="w-full"
              onClick={
                submitRequest
              }
              disabled={
                !form.title ||
                !form.total_amount ||
                saving
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