import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Plus,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Trash2,
  Loader2,
  Eye,
  Send,
  Printer,
  Share2,
  Copy,
  ShoppingCart,
  Building2,
  CalendarDays,
  BadgeDollarSign,
  RefreshCw,
} from 'lucide-react';

import { format } from 'date-fns';
import { toast } from 'sonner';

const COMPANY = {
  name: 'ARK TECHNOLOGIES GROUP',
  subtitle: 'ATM Solutions • Technology • Support Services',
  address: 'Lagos, Nigeria',
  email: 'info@arktechnologiesgroup.com',
  logoUrl:
    'https://fryidzyhqhdenghyxjfp.supabase.co/storage/v1/object/public/public-assets/logo.png',
};

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  'Pending Approval': 'bg-amber-100 text-amber-700 border-amber-200',
  Approved: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
  Issued: 'bg-blue-100 text-blue-700 border-blue-200',
  Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const EMPTY_ITEM = {
  description: '',
  part_number: '',
  quantity_requested: 1,
  unit_price_ngn: 0,
  unit_price_usd: 0,
  condition: '',
  total_ngn: 0,
  item_id: null,
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
  vat_rate: 0,
  items: [{ ...EMPTY_ITEM }],
  linked_inventory_items: [],
  total_amount_ngn: 0,
};

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function safeNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function money(value, currency = 'NGN') {
  const amount = Number(value || 0);

  if (currency === 'USD') {
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `₦${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(value) {
  if (!value) return '—';

  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return String(value);
  }
}

function calculateItemTotal(item) {
  return safeNumber(item.quantity_requested, 0) * safeNumber(item.unit_price_ngn, 0);
}

function calculateSubtotal(items) {
  return (items || []).reduce((sum, item) => sum + calculateItemTotal(item), 0);
}

function calculateGrandTotal(items, vatRate = 0) {
  const subtotal = calculateSubtotal(items);
  const vat = subtotal * (safeNumber(vatRate, 0) / 100);
  return { subtotal, vat, grandTotal: subtotal + vat };
}

function getItemDescription(item) {
  return item.description || item.part_name || item.item_name || item.device_name || 'Stock Item';
}

async function fetchLPOs() {
  const { data, error } = await supabase
    .from('lpos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

async function fetchInventoryItems() {
  const { data, error } = await supabase
    .from('spare_parts')
    .select('*')
    .order('description', { ascending: true })
    .limit(1000);

  if (error) throw error;
  return data || [];
}

export default function ProcurementLPO() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || {};
  const qc = useQueryClient();

  const role = normalizeRole(user?.role || user?.user_role || user?.position || 'user');

  const canApprove = ['admin', 'ceo', 'agm', 'manager', 'procurement_head'].includes(role);
  const canCreate = [
    'admin',
    'procurement',
    'inventory',
    'manager',
    'ceo',
    'agm',
    'finance',
    'hr',
    'procurement_head',
  ].includes(role);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewLPO, setViewLPO] = useState(null);
  const [form, setForm] = useState(EMPTY_LPO);
  const [saving, setSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [lowStockSearch, setLowStockSearch] = useState('');

  const {
    data: lpos = [],
    isLoading,
    error: lpoError,
  } = useQuery({
    queryKey: ['lpos'],
    queryFn: fetchLPOs,
  });

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchInventoryItems,
  });

  const lowStockItems = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          Number(item.quantity_available || 0) <=
          Number(item.minimum_stock_level || 2)
      ),
    [inventoryItems]
  );

  const filteredLowStock = useMemo(() => {
    const q = lowStockSearch.toLowerCase().trim();

    return lowStockItems
      .filter((item) => {
        if (!q) return true;

        return [
          item.description,
          item.part_name,
          item.part_number,
          item.device_brand,
          item.device_model,
          item.category_group,
          item.warehouse,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, 12);
  }, [lowStockItems, lowStockSearch]);

  const filtered = useMemo(
    () =>
      lpos.filter((lpo) => {
        if (statusFilter !== 'all' && lpo.status !== statusFilter) return false;

        if (search) {
          const q = search.toLowerCase();

          return (
            lpo.lpo_number?.toLowerCase().includes(q) ||
            lpo.title?.toLowerCase().includes(q) ||
            lpo.supplier_name?.toLowerCase().includes(q) ||
            lpo.requested_by_name?.toLowerCase().includes(q)
          );
        }

        return true;
      }),
    [lpos, statusFilter, search]
  );

  const stats = useMemo(
    () => ({
      total: lpos.length,
      pending: lpos.filter((l) => l.status === 'Pending Approval').length,
      approved: lpos.filter((l) => l.status === 'Approved').length,
      issued: lpos.filter((l) => l.status === 'Issued').length,
      lowStock: lowStockItems.length,
    }),
    [lpos, lowStockItems]
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lpos'] });
    qc.invalidateQueries({ queryKey: ['inventory-items'] });
  };

  const openNewPO = () => {
    setForm({
      ...EMPTY_LPO,
      title: `Purchase Order - ${format(new Date(), 'dd MMM yyyy')}`,
      items: [{ ...EMPTY_ITEM }],
    });
    setDialogOpen(true);
  };

  const openLowStockPO = () => {
    const suggestedItems = lowStockItems.slice(0, 20).map((item) => {
      const currentQty = Number(item.quantity_available || 0);
      const minQty = Number(item.minimum_stock_level || 2);
      const reorderQty = Math.max(minQty * 3 - currentQty, minQty * 2, 1);

      return {
        ...EMPTY_ITEM,
        description: getItemDescription(item),
        part_number: item.part_number || '',
        quantity_requested: reorderQty,
        unit_price_ngn: Number(item.unit_price_ngn || 0),
        unit_price_usd: Number(item.supplier_price_usd || 0),
        condition: 'New',
        total_ngn: reorderQty * Number(item.unit_price_ngn || 0),
        item_id: item.id,
      };
    });

    const items = suggestedItems.length ? suggestedItems : [{ ...EMPTY_ITEM }];

    setForm({
      ...EMPTY_LPO,
      title: `Low Stock Replenishment - ${format(new Date(), 'dd MMM yyyy')}`,
      items,
      linked_inventory_items: items.map((item) => item.item_id).filter(Boolean),
      total_amount_ngn: calculateSubtotal(items),
      trigger_type: 'low_stock',
    });

    setDialogOpen(true);
  };

  const addLowStockItemToForm = (stockItem) => {
    const currentQty = Number(stockItem.quantity_available || 0);
    const minQty = Number(stockItem.minimum_stock_level || 2);
    const reorderQty = Math.max(minQty * 3 - currentQty, minQty * 2, 1);

    const nextItem = {
      ...EMPTY_ITEM,
      description: getItemDescription(stockItem),
      part_number: stockItem.part_number || '',
      quantity_requested: reorderQty,
      unit_price_ngn: Number(stockItem.unit_price_ngn || 0),
      unit_price_usd: Number(stockItem.supplier_price_usd || 0),
      condition: 'New',
      total_ngn: reorderQty * Number(stockItem.unit_price_ngn || 0),
      item_id: stockItem.id,
    };

    setForm((prev) => {
      const currentItems =
        prev.items.length === 1 && !prev.items[0].description ? [] : prev.items;

      const items = [...currentItems, nextItem];
      const linked = [
        ...new Set([
          ...(prev.linked_inventory_items || []),
          stockItem.id,
        ].filter(Boolean)),
      ];

      return {
        ...prev,
        title: prev.title || `Low Stock Replenishment - ${format(new Date(), 'dd MMM yyyy')}`,
        items,
        linked_inventory_items: linked,
        total_amount_ngn: calculateSubtotal(items),
        trigger_type: 'low_stock',
      };
    });

    if (!dialogOpen) setDialogOpen(true);
    toast.success('Low stock item added to PO');
  };

  const updateFormField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateItem = (idx, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      const nextValue =
        field === 'quantity_requested' || field === 'unit_price_ngn' || field === 'unit_price_usd'
          ? safeNumber(value, 0)
          : value;

      items[idx] = {
        ...items[idx],
        [field]: nextValue,
      };

      items[idx].total_ngn = calculateItemTotal(items[idx]);

      return {
        ...prev,
        items,
        total_amount_ngn: calculateGrandTotal(items, prev.vat_rate).grandTotal,
      };
    });
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }],
    }));
  };

  const removeItem = (idx) => {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== idx);
      const nextItems = items.length ? items : [{ ...EMPTY_ITEM }];
      const linked = nextItems.map((item) => item.item_id).filter(Boolean);

      return {
        ...prev,
        items: nextItems,
        linked_inventory_items: linked,
        total_amount_ngn: calculateGrandTotal(nextItems, prev.vat_rate).grandTotal,
      };
    });
  };

  const handleSave = async (submitForApproval = false) => {
    if (!canCreate) {
      toast.error('You do not have permission to create purchase orders.');
      return;
    }

    if (!form.title?.trim()) {
      toast.error('PO title is required.');
      return;
    }

    const validItems = (form.items || []).filter(
      (item) => item.description?.trim() && Number(item.quantity_requested || 0) > 0
    );

    if (!validItems.length) {
      toast.error('At least one valid item is required.');
      return;
    }

    if (!form.supplier_name?.trim()) {
      toast.error('Supplier name is required.');
      return;
    }

    setSaving(true);

    try {
      const lpoNumber = `PO-${new Date().getFullYear()}-${Date.now()
        .toString()
        .slice(-6)}`;

      const totals = calculateGrandTotal(validItems, form.vat_rate);

      const payload = {
        ...form,
        items: validItems,
        linked_inventory_items: validItems.map((item) => item.item_id).filter(Boolean),
        lpo_number: lpoNumber,
        status: submitForApproval ? 'Pending Approval' : 'Draft',
        requested_by_email: user.email || user.user_email || '',
        requested_by_name: user.full_name || user.name || user.email || 'ARK User',
        total_amount_ngn: totals.grandTotal,
        trigger_type: form.trigger_type || 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('lpos').insert(payload);
      if (error) throw error;

      toast.success(
        submitForApproval
          ? 'Purchase Order submitted for approval.'
          : 'Purchase Order saved as draft.'
      );

      refresh();
      setDialogOpen(false);
      setForm(EMPTY_LPO);
    } catch (err) {
      toast.error('Error saving PO: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const updateLPOStatus = async (lpo, payload, successMessage) => {
    const { error } = await supabase
      .from('lpos')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
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
        ...payload,
      });
    }

    toast.success(successMessage);
  };

  const handleSubmit = (lpo) =>
    updateLPOStatus(lpo, { status: 'Pending Approval' }, 'PO submitted for approval');

  const handleApprove = (lpo) =>
    updateLPOStatus(
      lpo,
      {
        status: 'Approved',
        approved_by: user.full_name || user.name || user.email || 'Approver',
        approval_date: new Date().toISOString(),
      },
      'PO approved'
    );

  const openRejectDialog = (lpo) => {
    setRejectTarget(lpo);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;

    await updateLPOStatus(
      rejectTarget,
      {
        status: 'Rejected',
        rejection_reason: rejectionReason || 'Rejected',
        approved_by: user.full_name || user.name || user.email || 'Approver',
        approval_date: new Date().toISOString(),
      },
      'PO rejected'
    );

    setRejectDialogOpen(false);
    setRejectTarget(null);
    setRejectionReason('');
  };

  const handleIssue = (lpo) =>
    updateLPOStatus(lpo, { status: 'Issued' }, 'PO issued and ready to share');

  const handleComplete = (lpo) =>
    updateLPOStatus(lpo, { status: 'Completed' }, 'PO marked as completed');

  const printPO = () => {
    window.print();
  };

  const buildShareText = (lpo) => {
    const items = lpo.items || [];
    const totals = calculateGrandTotal(items, lpo.vat_rate || 0);

    return [
      `${COMPANY.name}`,
      `Purchase Order: ${lpo.lpo_number}`,
      `Supplier: ${lpo.supplier_name || 'N/A'}`,
      `Date: ${dateLabel(lpo.created_at)}`,
      '',
      'Items:',
      ...items.map(
        (item, index) =>
          `${index + 1}. ${item.part_number || ''} ${item.description} x ${item.quantity_requested} = ${money(item.total_ngn || calculateItemTotal(item), lpo.currency)}`
      ),
      '',
      `Grand Total: ${money(totals.grandTotal, lpo.currency)}`,
    ].join('\n');
  };

  const sharePO = async (lpo) => {
    const text = buildShareText(lpo);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Purchase Order ${lpo.lpo_number}`,
          text,
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      toast.success('PO summary copied. You can paste and share it.');
    } catch {
      toast.error('Share failed. Please use Print PO instead.');
    }
  };

  const copyPO = async (lpo) => {
    try {
      await navigator.clipboard.writeText(buildShareText(lpo));
      toast.success('PO summary copied to clipboard');
    } catch {
      toast.error('Could not copy PO summary');
    }
  };

  const statuses = ['all', 'Draft', 'Pending Approval', 'Approved', 'Rejected', 'Issued', 'Completed'];

  return (
    <div className="space-y-5 pb-20 text-slate-100">
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #po-print-area, #po-print-area * { visibility: visible; }
            #po-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white !important;
              color: #111827 !important;
              padding: 24px;
            }
            .no-print { display: none !important; }
          }
        `}
      </style>

      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <ShoppingCart className="w-7 h-7 text-[#ff5a00]" />
            Purchase Orders
          </h1>
          <p className="text-sm text-slate-300">
            Create, approve, print and share ARK purchase orders with supplier-ready formatting.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refresh} className="border-white/10 text-white hover:bg-white/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          {canCreate && (
            <>
              <Button
                variant="outline"
                onClick={openLowStockPO}
                className="border-[#ff5a00]/30 text-[#ff5a00] hover:bg-[#ff5a00]/10"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                PO From Low Stock
              </Button>

              <Button onClick={openNewPO} className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New PO
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="no-print grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-[#102969]/90 border-white/10">
          <CardContent className="p-4">
            <FileText className="w-5 h-5 text-[#ff5a00]" />
            <p className="text-2xl font-black text-white mt-2">{stats.total}</p>
            <p className="text-xs text-slate-300">Total POs</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969]/90 border-white/10">
          <CardContent className="p-4">
            <Clock className="w-5 h-5 text-[#ff5a00]" />
            <p className="text-2xl font-black text-white mt-2">{stats.pending}</p>
            <p className="text-xs text-slate-300">Pending Approval</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969]/90 border-white/10">
          <CardContent className="p-4">
            <CheckCircle2 className="w-5 h-5 text-[#ff5a00]" />
            <p className="text-2xl font-black text-white mt-2">{stats.approved}</p>
            <p className="text-xs text-slate-300">Approved</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969]/90 border-white/10">
          <CardContent className="p-4">
            <Send className="w-5 h-5 text-[#ff5a00]" />
            <p className="text-2xl font-black text-white mt-2">{stats.issued}</p>
            <p className="text-xs text-slate-300">Issued</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969]/90 border-white/10">
          <CardContent className="p-4">
            <AlertTriangle className="w-5 h-5 text-[#ff5a00]" />
            <p className="text-2xl font-black text-white mt-2">{stats.lowStock}</p>
            <p className="text-xs text-slate-300">Low Stock Items</p>
          </CardContent>
        </Card>
      </div>

      {canCreate && (
        <Card className="no-print bg-[#102969]/90 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ff5a00]" />
              Low Stock Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              <Input
                value={lowStockSearch}
                onChange={(e) => setLowStockSearch(e.target.value)}
                placeholder="Search low stock item..."
                className="bg-[#08153d] border-white/10 text-white max-w-md"
              />
              <Button variant="outline" onClick={openLowStockPO} className="border-white/10 text-white hover:bg-white/10">
                Auto Build PO
              </Button>
            </div>

            {inventoryLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#ff5a00]" />
              </div>
            ) : filteredLowStock.length === 0 ? (
              <p className="text-sm text-slate-300">No low stock item found.</p>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredLowStock.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-[#08153d]/80 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-semibold text-sm line-clamp-1">
                          {getItemDescription(item)}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {item.part_number || 'No part number'}
                        </p>
                        <p className="text-xs text-slate-300 mt-1">
                          Qty: <b>{item.quantity_available || 0}</b> · Min: <b>{item.minimum_stock_level || 2}</b> · {item.warehouse || 'Oshodi'}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => addLowStockItemToForm(item)} className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="no-print bg-[#102969]/90 border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search PO number, title, supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#08153d] border-white/10 text-white"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-[#08153d] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {lpoError && (
        <div className="no-print rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          Failed to load POs: {lpoError.message}
        </div>
      )}

      <div className="no-print grid gap-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff5a00]" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-[#102969]/90 border-white/10">
            <CardContent className="py-12 text-center text-slate-300">
              <FileText className="w-10 h-10 mx-auto opacity-40 mb-3" />
              <p>No purchase order found.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((lpo) => (
            <Card key={lpo.id} className="bg-[#102969]/90 border-white/10">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">
                        {lpo.lpo_number}
                      </span>
                      <Badge variant="outline" className={STATUS_COLORS[lpo.status] || STATUS_COLORS.Draft}>
                        {lpo.status || 'Draft'}
                      </Badge>
                    </div>

                    <h3 className="text-white font-bold mt-1">{lpo.title}</h3>
                    <p className="text-sm text-slate-300 flex items-center gap-1 mt-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {lpo.supplier_name || 'No supplier'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      By {lpo.requested_by_name || '—'} · {dateLabel(lpo.created_at)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-black text-white">
                      {money(lpo.total_amount_ngn || calculateGrandTotal(lpo.items || [], lpo.vat_rate || 0).grandTotal, lpo.currency)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(lpo.items || []).length} item(s)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/10">
                  <Button size="sm" variant="outline" onClick={() => setViewLPO(lpo)} className="border-white/10 text-white hover:bg-white/10">
                    <Eye className="w-4 h-4 mr-1" />
                    View PO
                  </Button>

                  {lpo.status === 'Draft' && canCreate && (
                    <Button size="sm" onClick={() => handleSubmit(lpo)} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Send className="w-4 h-4 mr-1" />
                      Submit
                    </Button>
                  )}

                  {lpo.status === 'Pending Approval' && canApprove && (
                    <>
                      <Button size="sm" onClick={() => handleApprove(lpo)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openRejectDialog(lpo)}>
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}

                  {lpo.status === 'Approved' && canCreate && (
                    <Button size="sm" onClick={() => handleIssue(lpo)} className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
                      <Send className="w-4 h-4 mr-1" />
                      Issue PO
                    </Button>
                  )}

                  {lpo.status === 'Issued' && canCreate && (
                    <Button size="sm" variant="outline" onClick={() => handleComplete(lpo)} className="border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto bg-[#102969] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>PO Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                className="bg-[#08153d] border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(value) => updateFormField('currency', value)}>
                <SelectTrigger className="bg-[#08153d] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Supplier Name *</Label>
              <Input
                value={form.supplier_name}
                onChange={(e) => updateFormField('supplier_name', e.target.value)}
                className="bg-[#08153d] border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Supplier Contact / Phone</Label>
              <Input
                value={form.supplier_contact}
                onChange={(e) => updateFormField('supplier_contact', e.target.value)}
                className="bg-[#08153d] border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Supplier Email</Label>
              <Input
                value={form.supplier_email}
                onChange={(e) => updateFormField('supplier_email', e.target.value)}
                className="bg-[#08153d] border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={form.delivery_expected_date}
                onChange={(e) => updateFormField('delivery_expected_date', e.target.value)}
                className="bg-[#08153d] border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Supplier Address</Label>
              <Textarea
                value={form.supplier_address}
                onChange={(e) => updateFormField('supplier_address', e.target.value)}
                className="bg-[#08153d] border-white/10 text-white min-h-[70px]"
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-[#08153d] p-3">
              <h3 className="font-bold">PO Items</h3>
              <Button size="sm" variant="outline" onClick={addItem} className="border-white/10 text-white hover:bg-white/10">
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#ff5a00] text-white">
                  <tr>
                    <th className="p-2 text-left">S/N</th>
                    <th className="p-2 text-left">Part Number</th>
                    <th className="p-2 text-left min-w-[260px]">Description</th>
                    <th className="p-2 text-left">Condition</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={`${item.item_id || 'manual'}-${index}`} className="border-b border-white/10">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2">
                        <Input
                          value={item.part_number || ''}
                          onChange={(e) => updateItem(index, 'part_number', e.target.value)}
                          className="bg-[#08153d] border-white/10 text-white"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.description || ''}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="bg-[#08153d] border-white/10 text-white"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.condition || ''}
                          placeholder="New / Refurbished"
                          onChange={(e) => updateItem(index, 'condition', e.target.value)}
                          className="bg-[#08153d] border-white/10 text-white"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity_requested || 0}
                          onChange={(e) => updateItem(index, 'quantity_requested', e.target.value)}
                          className="bg-[#08153d] border-white/10 text-white text-right"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          value={item.unit_price_ngn || 0}
                          onChange={(e) => updateItem(index, 'unit_price_ngn', e.target.value)}
                          className="bg-[#08153d] border-white/10 text-white text-right"
                        />
                      </td>
                      <td className="p-2 text-right font-bold">
                        {money(calculateItemTotal(item), form.currency)}
                      </td>
                      <td className="p-2 text-center">
                        <Button size="icon" variant="ghost" onClick={() => removeItem(index)} className="text-red-300 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => updateFormField('notes', e.target.value)}
                className="bg-[#08153d] border-white/10 text-white min-h-[90px]"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-[#08153d]/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <strong>{money(calculateSubtotal(form.items), form.currency)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>VAT %</span>
                <Input
                  type="number"
                  min="0"
                  value={form.vat_rate || 0}
                  onChange={(e) => updateFormField('vat_rate', safeNumber(e.target.value, 0))}
                  className="w-28 bg-[#102969] border-white/10 text-white text-right"
                />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-lg">
                <span className="font-bold">Grand Total</span>
                <strong className="text-[#ff5a00]">
                  {money(calculateGrandTotal(form.items, form.vat_rate).grandTotal, form.currency)}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-white/10 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => handleSave(false)} className="border-white/10 text-white hover:bg-white/10">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Draft
            </Button>
            <Button disabled={saving} onClick={() => handleSave(true)} className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit For Approval
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewLPO} onOpenChange={(open) => !open && setViewLPO(null)}>
        <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto bg-white text-slate-900">
          <DialogHeader className="no-print">
            <DialogTitle>Purchase Order Preview</DialogTitle>
          </DialogHeader>

          {viewLPO && (
            <>
              <div className="no-print flex flex-wrap justify-end gap-2 mb-3">
                <Button variant="outline" onClick={printPO}>
                  <Printer className="w-4 h-4 mr-1" />
                  Print PO
                </Button>
                <Button variant="outline" onClick={() => sharePO(viewLPO)}>
                  <Share2 className="w-4 h-4 mr-1" />
                  Share PO
                </Button>
                <Button variant="outline" onClick={() => copyPO(viewLPO)}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy Summary
                </Button>
              </div>

              <div id="po-print-area" className="bg-white text-slate-900 rounded-lg border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-6 border-b-4 border-[#102969] pb-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={COMPANY.logoUrl}
                      alt="ARK Technologies Group"
                      className="h-16 w-16 object-contain"
                    />
                    <div>
                      <h1 className="text-2xl font-black text-[#102969]">
                        {COMPANY.name}
                      </h1>
                      <p className="text-sm text-slate-600">{COMPANY.subtitle}</p>
                      <p className="text-xs text-slate-500">{COMPANY.address}</p>
                      <p className="text-xs text-slate-500">{COMPANY.email}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <h2 className="text-3xl font-black text-[#ff5a00]">
                      PURCHASE ORDER
                    </h2>
                    <p className="font-mono text-sm text-slate-600 mt-1">
                      {viewLPO.lpo_number}
                    </p>
                    <Badge variant="outline" className={STATUS_COLORS[viewLPO.status] || STATUS_COLORS.Draft}>
                      {viewLPO.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-5">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-black text-[#102969] mb-2">Supplier</h3>
                    <p className="font-bold">{viewLPO.supplier_name || '—'}</p>
                    <p className="text-sm text-slate-600">{viewLPO.supplier_contact || '—'}</p>
                    <p className="text-sm text-slate-600">{viewLPO.supplier_email || '—'}</p>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {viewLPO.supplier_address || '—'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-black text-[#102969] mb-2">PO Details</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-slate-500">PO Date</p>
                      <p className="font-semibold text-right">{dateLabel(viewLPO.created_at)}</p>
                      <p className="text-slate-500">Delivery Date</p>
                      <p className="font-semibold text-right">{dateLabel(viewLPO.delivery_expected_date)}</p>
                      <p className="text-slate-500">Prepared By</p>
                      <p className="font-semibold text-right">{viewLPO.requested_by_name || '—'}</p>
                      <p className="text-slate-500">Currency</p>
                      <p className="font-semibold text-right">{viewLPO.currency || 'NGN'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#102969] text-white">
                        <th className="border border-[#102969] p-2 text-left">S/N</th>
                        <th className="border border-[#102969] p-2 text-left">Part Number</th>
                        <th className="border border-[#102969] p-2 text-left">Description</th>
                        <th className="border border-[#102969] p-2 text-left">Condition</th>
                        <th className="border border-[#102969] p-2 text-right">Qty</th>
                        <th className="border border-[#102969] p-2 text-right">Unit Price</th>
                        <th className="border border-[#102969] p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewLPO.items || []).map((item, index) => (
                        <tr key={`${item.part_number || 'item'}-${index}`} className="even:bg-slate-50">
                          <td className="border border-slate-200 p-2">{index + 1}</td>
                          <td className="border border-slate-200 p-2 font-mono text-xs">{item.part_number || '—'}</td>
                          <td className="border border-slate-200 p-2">{item.description || '—'}</td>
                          <td className="border border-slate-200 p-2">{item.condition || '—'}</td>
                          <td className="border border-slate-200 p-2 text-right">{item.quantity_requested || 0}</td>
                          <td className="border border-slate-200 p-2 text-right">{money(item.unit_price_ngn || 0, viewLPO.currency)}</td>
                          <td className="border border-slate-200 p-2 text-right font-bold">
                            {money(item.total_ngn || calculateItemTotal(item), viewLPO.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const totals = calculateGrandTotal(viewLPO.items || [], viewLPO.vat_rate || 0);

                  return (
                    <div className="flex justify-end mt-5">
                      <div className="w-full max-w-sm rounded-lg border border-slate-200 overflow-hidden">
                        <div className="flex justify-between p-3 border-b border-slate-200">
                          <span>Subtotal</span>
                          <strong>{money(totals.subtotal, viewLPO.currency)}</strong>
                        </div>
                        <div className="flex justify-between p-3 border-b border-slate-200">
                          <span>VAT ({viewLPO.vat_rate || 0}%)</span>
                          <strong>{money(totals.vat, viewLPO.currency)}</strong>
                        </div>
                        <div className="flex justify-between p-3 bg-[#ff5a00] text-white text-lg">
                          <span className="font-black">Grand Total</span>
                          <strong>{money(totals.grandTotal, viewLPO.currency)}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {viewLPO.notes && (
                  <div className="mt-5 rounded-lg border border-slate-200 p-4">
                    <h3 className="font-black text-[#102969] mb-2">Notes</h3>
                    <p className="text-sm whitespace-pre-wrap">{viewLPO.notes}</p>
                  </div>
                )}

                {viewLPO.rejection_reason && (
                  <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
                    <h3 className="font-black text-red-700 mb-2">Rejection Reason</h3>
                    <p className="text-sm text-red-700 whitespace-pre-wrap">
                      {viewLPO.rejection_reason}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-8 mt-12 text-center text-sm">
                  <div>
                    <div className="border-t border-slate-400 pt-2">
                      Prepared By
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{viewLPO.requested_by_name || '—'}</p>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-2">
                      Approved By
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{viewLPO.approved_by || '—'}</p>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-2">
                      Supplier Acknowledgement
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Name / Signature / Date</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[#102969] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Label>Reason</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="bg-[#08153d] border-white/10 text-white min-h-[100px]"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="border-white/10 text-white hover:bg-white/10">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                Reject PO
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
