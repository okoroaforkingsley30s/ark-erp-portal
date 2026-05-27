import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

import { Textarea } from '@/components/ui/textarea';

import {
  Plus,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  ChevronRight,
  Trash2,
  Loader2,
  Eye,
  Send,
} from 'lucide-react';

import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_COLORS = {
  Draft:
    'bg-slate-100 text-slate-600 border-slate-200',

  'Pending Approval':
    'bg-amber-100 text-amber-700 border-amber-200',

  Approved:
    'bg-green-100 text-green-700 border-green-200',

  Rejected:
    'bg-red-100 text-red-700 border-red-200',

  Issued:
    'bg-blue-100 text-blue-700 border-blue-200',

  Completed:
    'bg-emerald-100 text-emerald-700 border-emerald-200',

  Cancelled:
    'bg-slate-100 text-slate-400 border-slate-200',
};

const STATUS_ICONS = {
  Draft: FileText,
  'Pending Approval': Clock,
  Approved: CheckCircle2,
  Rejected: XCircle,
  Issued: Send,
  Completed: CheckCircle2,
  Cancelled: XCircle,
};

const EMPTY_ITEM = {
  description: '',
  part_number: '',
  quantity_requested: 1,
  unit_price_ngn: 0,
  unit_price_usd: 0,
  total_ngn: 0,
};

const EMPTY_LPO = {
  title: '',
  supplier_name: '',
  supplier_contact: '',
  supplier_email: '',
  supplier_address: '',
  currency: 'NGN',
  delivery_expected_date: '',
  notes: '',
  items: [{ ...EMPTY_ITEM }],
};

async function fetchLPOs() {
  const { data, error } = await supabase
    .from('lpos')
    .select('*')
    .order('created_at', {
      ascending: false,
    })
    .limit(200);

  if (error) throw error;

  return data || [];
}

async function fetchInventoryItems() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('description', {
      ascending: true,
    })
    .limit(500);

  if (error) throw error;

  return data || [];
}

export default function ProcurementLPO() {
  const { user } = useOutletContext();

  const qc = useQueryClient();

  const role = user?.role || 'user';

  const canApprove = [
    'admin',
    'ceo',
    'agm',
    'manager',
  ].includes(role);

  const canCreate = [
    'admin',
    'procurement',
    'inventory',
    'manager',
    'ceo',
    'agm',
    'finance',
    'hr',
  ].includes(role);

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [viewLPO, setViewLPO] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_LPO);

  const [saving, setSaving] =
    useState(false);

  const [
    rejectionReason,
    setRejectionReason,
  ] = useState('');

  const [
    rejectDialogOpen,
    setRejectDialogOpen,
  ] = useState(false);

  const [rejectTarget, setRejectTarget] =
    useState(null);

  const {
    data: lpos = [],
    isLoading,
  } = useQuery({
    queryKey: ['lpos'],
    queryFn: fetchLPOs,
  });

  const {
    data: inventoryItems = [],
  } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchInventoryItems,
  });

  const lowStockItems = useMemo(
    () =>
      inventoryItems.filter(
        (i) =>
          (i.quantity_available ?? 0) <
          (i.minimum_stock_level ?? 2)
      ),
    [inventoryItems]
  );

  const filtered = useMemo(
    () =>
      lpos.filter((l) => {
        if (
          statusFilter !== 'all' &&
          l.status !== statusFilter
        )
          return false;

        if (search) {
          const q =
            search.toLowerCase();

          return (
            l.lpo_number
              ?.toLowerCase()
              .includes(q) ||
            l.title
              ?.toLowerCase()
              .includes(q) ||
            l.supplier_name
              ?.toLowerCase()
              .includes(q)
          );
        }

        return true;
      }),
    [lpos, statusFilter, search]
  );

  const stats = useMemo(
    () => ({
      total: lpos.length,

      pending: lpos.filter(
        (l) =>
          l.status ===
          'Pending Approval'
      ).length,

      approved: lpos.filter(
        (l) => l.status === 'Approved'
      ).length,

      lowStock: lowStockItems.length,
    }),
    [lpos, lowStockItems]
  );

  const updateItem = (
    idx,
    field,
    val
  ) => {
    setForm((f) => {
      const items = [...f.items];

      items[idx] = {
        ...items[idx],
        [field]: val,
      };

      if (
        field ===
          'quantity_requested' ||
        field === 'unit_price_ngn'
      ) {
        items[idx].total_ngn =
          (items[idx]
            .unit_price_ngn || 0) *
          (items[idx]
            .quantity_requested || 0);
      }

      const total = items.reduce(
        (s, i) =>
          s + (i.total_ngn || 0),
        0
      );

      return {
        ...f,
        items,
        total_amount_ngn: total,
      };
    });
  };

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { ...EMPTY_ITEM },
      ],
    }));

  const removeItem = (idx) =>
    setForm((f) => ({
      ...f,
      items: f.items.filter(
        (_, i) => i !== idx
      ),
    }));

  const prefillFromLowStock = (
    item
  ) => {
    const qty = Math.max(
      (item.minimum_stock_level ??
        2) * 3,
      5
    );

    setForm((f) => ({
      ...f,

      title:
        f.title ||
        `Replenishment: ${item.description}`,

      items: [
        {
          ...EMPTY_ITEM,
          description:
            item.description,
          part_number:
            item.part_number,
          quantity_requested: qty,
          unit_price_ngn:
            item.unit_price_ngn || 0,
          unit_price_usd:
            item.supplier_price_usd ||
            0,
          total_ngn:
            (item.unit_price_ngn ||
              0) * qty,
          item_id: item.id,
        },
      ],

      total_amount_ngn:
        (item.unit_price_ngn || 0) *
        qty,

      linked_inventory_items: [
        item.id,
      ],
    }));

    setDialogOpen(true);
  };

  const refresh = () => {
    qc.invalidateQueries({
      queryKey: ['lpos'],
    });
  };

  const handleSave = async (
    submitForApproval = false
  ) => {
    if (!form.title?.trim()) {
      toast.error(
        'Title is required'
      );

      return;
    }

    if (
      !form.items.length ||
      !form.items[0].description
    ) {
      toast.error(
        'At least one item is required'
      );

      return;
    }

    setSaving(true);

    try {
      const lpoNumber = `LPO-${
        new Date().getFullYear()
      }-${Date.now()
        .toString()
        .slice(-5)}`;

      const total =
        form.items.reduce(
          (s, i) =>
            s +
            (i.total_ngn || 0),
          0
        );

      const { error } =
        await supabase
          .from('lpos')
          .insert({
            ...form,

            lpo_number: lpoNumber,

            status:
              submitForApproval
                ? 'Pending Approval'
                : 'Draft',

            requested_by_email:
              user.email,

            requested_by_name:
              user.full_name,

            total_amount_ngn:
              total,

            trigger_type:
              'manual',
          });

      if (error) throw error;

      toast.success(
        submitForApproval
          ? 'LPO submitted for approval!'
          : 'LPO saved as draft'
      );

      refresh();

      setDialogOpen(false);

      setForm(EMPTY_LPO);
    } catch (err) {
      toast.error(
        'Error saving LPO: ' +
          (err?.message ||
            'Unknown error')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (
    lpo
  ) => {
    const { error } =
      await supabase
        .from('lpos')
        .update({
          status:
            'Pending Approval',
        })
        .eq('id', lpo.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    refresh();

    if (viewLPO?.id === lpo.id) {
      setViewLPO({
        ...viewLPO,
        status:
          'Pending Approval',
      });
    }

    toast.success(
      'LPO submitted for approval'
    );
  };

  const handleApprove = async (
    lpo
  ) => {
    const { error } =
      await supabase
        .from('lpos')
        .update({
          status: 'Approved',

          approved_by:
            user.full_name,

          approval_date:
            new Date().toISOString(),
        })
        .eq('id', lpo.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    refresh();

    if (viewLPO?.id === lpo.id) {
      setViewLPO({
        ...viewLPO,
        status: 'Approved',
        approved_by:
          user.full_name,
      });
    }

    toast.success(
      'LPO approved!'
    );
  };

  const handleReject = async () => {
    if (!rejectTarget) return;

    const { error } =
      await supabase
        .from('lpos')
        .update({
          status: 'Rejected',

          rejection_reason:
            rejectionReason,

          approved_by:
            user.full_name,

          approval_date:
            new Date().toISOString(),
        })
        .eq('id', rejectTarget.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    refresh();

    if (
      viewLPO?.id ===
      rejectTarget.id
    ) {
      setViewLPO({
        ...viewLPO,
        status: 'Rejected',
      });
    }

    setRejectDialogOpen(false);

    setRejectTarget(null);

    setRejectionReason('');

    toast.success(
      'LPO rejected'
    );
  };

  const handleIssue = async (
    lpo
  ) => {
    const { error } =
      await supabase
        .from('lpos')
        .update({
          status: 'Issued',
        })
        .eq('id', lpo.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    refresh();

    if (viewLPO?.id === lpo.id) {
      setViewLPO({
        ...viewLPO,
        status: 'Issued',
      });
    }

    toast.success(
      'LPO marked as Issued'
    );
  };

  return (
    <div className="space-y-5">
      {/* KEEP ALL YOUR EXISTING JSX UI BELOW UNCHANGED */}
    </div>
  );
}