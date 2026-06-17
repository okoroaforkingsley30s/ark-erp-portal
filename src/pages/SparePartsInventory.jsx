import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Card } from '@/components/ui/card';

import InvStatsCards from '@/components/inventory/InvStatsCards';
import StockMoveDialog from '@/components/inventory/StockMoveDialog';
import QRBarcodeModal from '@/components/inventory/QRBarcodeModal';
import AIInventoryChat from '@/components/inventory/AIInventoryChat';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  QrCode,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Loader2,
  Upload,
  History,
  XCircle,
  CheckCircle2,
} from 'lucide-react';

const CATEGORIES = [
  'WINCOR',
  'NCR_S1',
  'NCR_S2',
  'HYOSUNG',
  'ENTRUST',
  'EVOLIS',
  'GENERAL_PRINTER_ACCESSORIES',
];

const WAREHOUSES = ['Oshodi', 'Ipaja', 'Enugu'];

const EMPTY = {
  part_number: '',
  description: '',
  category_group: 'WINCOR',
  device_brand: '',
  device_model: '',
  quantity_available: 0,
  minimum_stock_level: 2,
  supplier_price_usd: '',
  unit_price_ngn: '',
  stock_status: 'OUT OF STOCK',
  vendor: 'Not specified',
  storage_location: '',
  warehouse: 'Oshodi',
  tracking_type: 'quantity',
  serial_number: '',
  manufacturer_serial: '',
  serial_condition: 'good',
  serial_status: 'in_stock',
  serial_supplier: '',
  serial_purchase_date: '',
  serial_current_engineer: '',
  serial_current_engineer_email: '',
  serial_sold_to: '',
  serial_scrapped_reason: '',
  notes: '',
};

const EMPTY_REQ = {
  part_id: '',
  part_name: '',
  part_number: '',
  quantity_requested: 1,
  site_name: '',
  ticket_id: '',
  urgency: 'medium',
  reason: '',
  faulty_part_photo: '',
};

const EMPTY_SERIAL = {
  spare_part_id: '',
  part_number: '',
  serial_number: '',
  manufacturer_serial: '',
  warehouse: 'Oshodi',
  condition: 'good',
  status: 'in_stock',
  supplier: '',
  purchase_date: '',
  current_engineer: '',
  current_engineer_email: '',
  sold_to: '',
  scrapped_reason: '',
  notes: '',
};

const TRACKING_TYPES = [
  { value: 'quantity', label: 'Quantity / Consumable' },
  { value: 'serial', label: 'Serial / Physical Part' },
];

const SERIAL_CONDITIONS = ['good', 'faulty', 'repaired', 'scrap', 'untested'];

const SERIAL_STATUSES = [
  'in_stock',
  'reserved',
  'dispatched',
  'received_by_engineer',
  'returned_faulty',
  'under_rr',
  'qa_passed',
  'ready_for_dispatch',
  'scrapped',
  'sold',
];

const normalizeTrackingType = (value) =>
  String(value || 'quantity').toLowerCase().includes('serial') ? 'serial' : 'quantity';

const cleanWarehouse = (value) => {
  const raw = String(value || 'Oshodi').trim();
  return WAREHOUSES.includes(raw) ? raw : 'Oshodi';
};

const safeNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const computeStatus = (qty, min) =>
  qty === 0 ? 'OUT OF STOCK' : qty <= (min || 2) ? 'LOW STOCK' : 'AVAILABLE';

const stockClass = (item) => {
  const q = item.quantity_available || 0;
  const m = item.minimum_stock_level || 2;

  if (q === 0) {
    return 'bg-red-500/15 text-red-300 border-red-500/30';
  }

  if (q <= m) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }

  return 'bg-green-500/15 text-green-300 border-green-500/30';
};

const mvtClass = (t) =>
  ({
    stock_in: 'text-green-600',
    stock_out: 'text-red-600',
    adjustment: 'text-blue-600',
    request_dispatch: 'text-amber-600',
    request_received: 'text-purple-600',
  }[t] || '');

const mvtLabel = (t) =>
  ({
    stock_in: '↑ Stock In',
    stock_out: '↓ Stock Out',
    adjustment: '⚙ Adjustment',
    request_dispatch: '→ Dispatched',
    request_received: '✓ Received',
  }[t] || t);

async function fetchSpareParts() {
  const { data, error } = await supabase
    .from('spare_parts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchSpareRequests(user, isEngineer) {
  let query = supabase
    .from('part_requests')
    .select(`
      *,
      tickets:ticket_id (
        id,
        ticket_number,
        status,
        bank_name,
        branch_name,
        terminal_id,
        location
      )
    `)
    .order('created_at', { ascending: false });

  if (isEngineer) {
    if (user?.id && user?.email) {
      query = query.or(`engineer_id.eq.${user.id},engineer_email.eq.${user.email}`);
    } else if (user?.email) {
      query = query.eq('engineer_email', user.email);
    }
  }

  const { data, error } = await query.limit(isEngineer ? 100 : 500);

  if (error) throw error;
  return data || [];
}

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const requestQty = (req) => Number(req.quantity || req.quantity_requested || 1);

const getPhotoUrl = (photo) => {
  if (!photo) return '';

  if (typeof photo === 'string') return photo;

  if (typeof photo === 'object') {
    return photo.url || photo.publicUrl || photo.path || '';
  }

  return '';
};

const requestPhoto = (req) => {
  if (Array.isArray(req.photo_evidence) && req.photo_evidence.length > 0) {
    return getPhotoUrl(req.photo_evidence[0]);
  }

  if (Array.isArray(req.evidence_photos) && req.evidence_photos.length > 0) {
    return getPhotoUrl(req.evidence_photos[0]);
  }

  return req.faulty_part_photo || req.photo_url || '';
};

const workflowStatus = (req) => {
  if (
    req.approval_status === 'rejected' ||
    req.operations_status === 'rejected' ||
    req.inventory_status === 'rejected'
  ) {
    return 'rejected';
  }

  if (req.dispatch_status === 'received') return 'received';
  if (req.dispatch_status === 'dispatched') return 'dispatched';

  if (
    req.operations_status === 'approved' &&
    req.inventory_status === 'approved_for_dispatch' &&
    ['approved', 'not_required'].includes(req.finance_status || 'not_required')
  ) {
    return 'ready_dispatch';
  }

  if (
    req.finance_status === 'pending_payment_review' ||
    req.finance_status === 'pending_dispatch_cost_review'
  ) {
    return 'finance_pending';
  }

  if (req.operations_status === 'approved' && req.inventory_status === 'pending_review') {
    return 'inventory_pending';
  }

  if (
    req.operations_status === 'pending_review' ||
    req.approval_status === 'pending_operations' ||
    req.inventory_status === 'waiting_operations_approval'
  ) {
    return 'operations_pending';
  }

  return 'pending';
};
async function fetchInventoryMovements() {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

async function fetchSparePartSerials() {
  const { data, error } = await supabase
    .from('spare_part_serials')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data || [];
}

export default function SparePartsInventory() {
  const { user } = useOutletContext();
  const role = user?.role || 'engineer';
  const normalizedRole = normalizeRole(role);

  const isAdmin = normalizedRole === 'admin';
  const isOperations = ['operations', 'operational_manager', 'operation_manager', 'manager'].includes(normalizedRole);
  const isInventory = normalizedRole === 'inventory';
  const isFinance = ['finance', 'accounts', 'account', 'account_department'].includes(normalizedRole);
  const canManage = isAdmin || isOperations || isInventory || isFinance || ['procurement'].includes(normalizedRole);
  const canViewPrices = [
    'admin',
    'inventory',
    'procurement',
    'finance',
    'ceo',
    'agm',
    'manager',
  ].includes(role);

  const isEngineer = ['engineer', 'field_engineer'].includes(normalizedRole);
  const qc = useQueryClient();

  const [tab, setTab] = useState(isEngineer ? 'requests' : 'inventory');
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterFamily, setFilterFamily] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [itemOpen, setItemOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pf, setPf] = useState(EMPTY);
  const [rf, setRf] = useState(EMPTY_REQ);
  const [saving, setSaving] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [qrItem, setQrItem] = useState(null);
  const [serialOpen, setSerialOpen] = useState(false);
  const [serialForm, setSerialForm] = useState(EMPTY_SERIAL);
  const [filterTracking, setFilterTracking] = useState('all');
  const [importMode, setImportMode] = useState('merge');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchSpareParts,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['spare-requests', user?.email, role],
    queryFn: () => fetchSpareRequests(user, isEngineer),
    enabled: !!user?.email,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: fetchInventoryMovements,
    enabled: canManage,
  });


  const { data: serials = [], isLoading: serialsLoading } = useQuery({
    queryKey: ['spare-part-serials'],
    queryFn: fetchSparePartSerials,
    enabled: canManage,
  });

  const brands = useMemo(
    () => [...new Set(items.map((i) => i.device_brand).filter(Boolean))].sort(),
    [items]
  );

  const families = useMemo(
    () => [...new Set(items.map((i) => i.device_model).filter(Boolean))].sort(),
    [items]
  );

  const lowStock = items.filter(
    (i) =>
      (i.quantity_available || 0) > 0 &&
      (i.quantity_available || 0) <= (i.minimum_stock_level || 2)
  );

  const outStock = items.filter((i) => (i.quantity_available || 0) === 0);
  const serialTrackedCount = items.filter((i) => normalizeTrackingType(i.tracking_type) === 'serial').length;
  const quantityTrackedCount = items.filter((i) => normalizeTrackingType(i.tracking_type) === 'quantity').length;
  const inStockSerialCount = serials.filter((s) => s.status === 'in_stock').length;

  const getSerialsForItem = (item) =>
    serials.filter(
      (serial) =>
        String(serial.spare_part_id || '') === String(item.id || '') ||
        (serial.part_number && item.part_number &&
          String(serial.part_number).trim().toLowerCase() ===
            String(item.part_number).trim().toLowerCase())
    );

  const getSerialCountForItem = (item) => getSerialsForItem(item).length;
  const getInStockSerialCountForItem = (item) =>
    getSerialsForItem(item).filter((serial) => serial.status === 'in_stock').length;

  const serialPartMap = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [items]);

  const filteredSerials = useMemo(() => {
    const q = search.toLowerCase().trim();

    return serials.filter((serial) => {
      const parent = serialPartMap[serial.spare_part_id] || {};
      const matchSearch =
        !q ||
        [
          serial.serial_number,
          serial.manufacturer_serial,
          serial.part_number,
          parent.description,
          parent.part_name,
          serial.warehouse,
          serial.condition,
          serial.status,
          serial.supplier,
          serial.current_engineer,
          serial.current_engineer_email,
          serial.sold_to,
          serial.scrapped_reason,
          serial.notes,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const matchWarehouse =
        filterWarehouse === 'all' || (serial.warehouse || parent.warehouse || 'Oshodi') === filterWarehouse;

      return matchSearch && matchWarehouse;
    });
  }, [serials, serialPartMap, search, filterWarehouse]);

  const warehouseStock = useMemo(() => {
    return WAREHOUSES.map((warehouse) => {
      const warehouseItems = items.filter(
        (item) => (item.warehouse || 'Oshodi') === warehouse
      );

      return {
        warehouse,
        items: warehouseItems.length,
        quantity: warehouseItems.reduce(
          (sum, item) => sum + Number(item.quantity_available || 0),
          0
        ),
        value: warehouseItems.reduce(
          (sum, item) =>
            sum +
            Number(item.quantity_available || 0) *
              Number(item.unit_price_ngn || 0),
          0
        ),
      };
    });
  }, [items]);

  const pending = requests.filter((r) =>
    ['operations_pending', 'inventory_pending', 'finance_pending', 'ready_dispatch'].includes(workflowStatus(r))
  ).length;
  const operationsPending = requests.filter((r) =>
    r.operations_status === 'pending_review' ||
    r.approval_status === 'pending_operations' ||
    r.inventory_status === 'waiting_operations_approval'
  ).length;
  const inventoryPending = requests.filter((r) =>
    r.operations_status === 'approved' &&
    r.inventory_status === 'pending_review'
  ).length;
  const financePending = requests.filter((r) =>
    ['pending_payment_review', 'pending_dispatch_cost_review'].includes(r.finance_status)
  ).length;
  const dispatchPending = requests.filter((r) =>
    r.inventory_status === 'approved_for_dispatch' &&
    ['approved', 'not_required'].includes(r.finance_status || 'not_required') &&
    !['dispatched', 'received'].includes(r.dispatch_status)
  ).length;

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        const q = search.toLowerCase();

        const matchSearch =
          !search ||
          [
            p.description,
            p.part_name,
            p.part_number,
            p.device_model,
            p.device_brand,
            p.vendor,
            p.storage_location,
            p.warehouse,
            p.tracking_type,
            p.notes,
          ].some((f) => (f || '').toLowerCase().includes(q));

        const matchBrand = filterBrand === 'all' || p.device_brand === filterBrand;
        const matchCat = filterCat === 'all' || p.category_group === filterCat;
        const matchFamily = filterFamily === 'all' || p.device_model === filterFamily;
        const matchWarehouse =
          filterWarehouse === 'all' || (p.warehouse || 'Oshodi') === filterWarehouse;
        const matchTracking =
          filterTracking === 'all' || normalizeTrackingType(p.tracking_type) === filterTracking;

        const matchStock =
          filterStock === 'all' ||
          (filterStock === 'available' &&
            (p.quantity_available || 0) > (p.minimum_stock_level || 2)) ||
          (filterStock === 'low' &&
            (p.quantity_available || 0) > 0 &&
            (p.quantity_available || 0) <= (p.minimum_stock_level || 2)) ||
          (filterStock === 'out' && (p.quantity_available || 0) === 0);

        return matchSearch && matchBrand && matchCat && matchFamily && matchWarehouse && matchTracking && matchStock;
      }),
    [items, search, filterBrand, filterCat, filterFamily, filterWarehouse, filterTracking, filterStock]
  );

  const saveItem = async () => {
    if (!pf.description?.trim() || !pf.part_number?.trim()) {
      alert('Description and Part Number are required.');
      return;
    }

    const trackingType = normalizeTrackingType(pf.tracking_type);

    if (trackingType === 'serial' && !editingItem && !pf.serial_number?.trim()) {
      alert('Serial Number is required when adding a Serial / Physical Part.');
      return;
    }

    setSaving(true);

    try {
      const qty = parseInt(pf.quantity_available, 10) || 0;
      const min = parseInt(pf.minimum_stock_level, 10) || 2;
      const unitPrice = parseFloat(pf.unit_price_ngn) || 0;
      const existingSerialCount = editingItem ? getSerialCountForItem(editingItem) : 0;
      const addingInlineSerial = trackingType === 'serial' && !!pf.serial_number?.trim();
      const serialQuantity = trackingType === 'serial'
        ? existingSerialCount + (addingInlineSerial ? 1 : 0)
        : qty;

      const payload = {
        part_number: pf.part_number?.trim(),
        part_name: pf.description?.trim(),
        description: pf.description?.trim(),
        category_group: pf.category_group || 'WINCOR',
        device_brand: pf.device_brand || '',
        device_model: pf.device_model || '',
        quantity_available: trackingType === 'serial' ? serialQuantity : qty,
        minimum_stock_level: min,
        supplier_price_usd: parseFloat(pf.supplier_price_usd) || null,
        unit_price_ngn: unitPrice || null,
        total_stock_value: unitPrice * (trackingType === 'serial' ? serialQuantity : qty),
        stock_status: computeStatus(trackingType === 'serial' ? serialQuantity : qty, min),
        vendor: pf.vendor || 'Not specified',
        storage_location: pf.storage_location || '',
        warehouse: pf.warehouse || 'Oshodi',
        tracking_type: trackingType,
        notes: pf.notes || '',
        updated_at: new Date().toISOString(),
      };

      let savedItem = editingItem;

      if (editingItem) {
        const { data, error } = await supabase
          .from('spare_parts')
          .update(payload)
          .eq('id', editingItem.id)
          .select()
          .single();

        if (error) throw error;
        savedItem = data || editingItem;
      } else {
        const { data, error } = await supabase
          .from('spare_parts')
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        savedItem = data;
      }

      if (trackingType === 'serial' && pf.serial_number?.trim()) {
        const serialPayload = {
          spare_part_id: savedItem?.id || editingItem?.id || null,
          part_number: savedItem?.part_number || pf.part_number?.trim(),
          serial_number: pf.serial_number.trim(),
          manufacturer_serial: pf.manufacturer_serial || '',
          warehouse: pf.warehouse || savedItem?.warehouse || 'Oshodi',
          condition: pf.serial_condition || 'good',
          status: pf.serial_status || 'in_stock',
          supplier: pf.serial_supplier || pf.vendor || 'Not specified',
          purchase_date: pf.serial_purchase_date || null,
          current_engineer: pf.serial_current_engineer || '',
          current_engineer_email: pf.serial_current_engineer_email || '',
          sold_to: pf.serial_sold_to || '',
          scrapped_reason: pf.serial_scrapped_reason || '',
          sold_at: pf.serial_status === 'sold' ? new Date().toISOString() : null,
          scrapped_at: pf.serial_status === 'scrapped' ? new Date().toISOString() : null,
          notes: pf.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: serialError } = await supabase
          .from('spare_part_serials')
          .insert(serialPayload);

        if (serialError) throw serialError;
      }

      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['spare-part-serials'] });

      setPf(EMPTY);
      setEditingItem(null);
      setItemOpen(false);
    } catch (err) {
      alert('Error saving item: ' + (err?.message || 'Unknown error.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item) => {
    if (!confirm(`Delete "${item.description}"?`)) return;

    try {
      const { error } = await supabase.from('spare_parts').delete().eq('id', item.id);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['inventory-items'] });
    } catch (err) {
      alert('Error deleting item: ' + (err?.message || 'Unknown error.'));
    }
  };

  const submitReq = async () => {
    if (!rf.part_id && !rf.part_name?.trim()) {
      alert('Please select a part or enter a part name.');
      return;
    }

    setSaving(true);

    try {
      const item = items.find((p) => p.id === rf.part_id);
      const partName = item?.description || rf.part_name;

      const { error } = await supabase.from('part_requests').insert({
        ticket_id: rf.ticket_id || null,
        ticket_number: rf.ticket_id || null,
        engineer_email: user.email,
        engineer_name: user.full_name || user.name || user.email,
        part_name: partName,
        quantity: requestQty(rf),
        request_type: 'consumable',
        reason_category: 'consumable_required',
        reason_note: rf.reason,
        evidence_photos: [],
        approval_status: 'pending_operations',
        operations_status: 'pending_review',
        inventory_status: 'waiting_operations_approval',
        finance_status: 'not_required',
        dispatch_status: 'pending',
        current_department: 'operations',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['spare-requests'] });

      setRf(EMPTY_REQ);
      setReqOpen(false);
    } catch (err) {
      alert('Error submitting request: ' + (err?.message || 'Unknown error.'));
    } finally {
      setSaving(false);
    }
  };

  const reqAction = async (req, action) => {
    try {
      const now = new Date().toISOString();
      const updatePayload = {};

      if (action === 'operations_approved') {
        Object.assign(updatePayload, {
          approval_status: 'operations_approved',
          operations_status: 'approved',
          inventory_status: 'pending_review',
          finance_status:
            req.request_type === 'bank'
              ? 'pending_payment_review'
              : 'pending_dispatch_cost_review',
          current_department: 'inventory_accounts',
          operations_note: 'Approved by Operations and pushed to Inventory and Accounts',
          updated_at: now,
        });
      }

      if (action === 'operations_rejected') {
        Object.assign(updatePayload, {
          approval_status: 'rejected',
          operations_status: 'rejected',
          current_department: 'operations',
          operations_note: 'Rejected by Operations',
          updated_at: now,
        });
      }

      if (action === 'inventory_approved') {
        Object.assign(updatePayload, {
          inventory_status: 'approved_for_dispatch',
          current_department:
            ['approved', 'not_required'].includes(req.finance_status || 'not_required')
              ? 'inventory'
              : 'accounts',
          inventory_note: 'Stock confirmed / approved for dispatch',
          updated_at: now,
        });
      }

      if (action === 'inventory_rejected') {
        Object.assign(updatePayload, {
          approval_status: 'rejected',
          inventory_status: 'rejected',
          current_department: 'inventory',
          inventory_note: 'Rejected by Inventory',
          updated_at: now,
        });
      }

      if (action === 'finance_approved') {
        Object.assign(updatePayload, {
          finance_status: 'approved',
          current_department:
            req.inventory_status === 'approved_for_dispatch'
              ? 'inventory'
              : 'inventory_accounts',
          finance_note: 'Payment / waybill cost approved by Accounts',
          updated_at: now,
        });
      }

      if (action === 'dispatched') {
        Object.assign(updatePayload, {
          dispatch_status: 'dispatched',
          current_department: 'engineer',
          dispatch_note: 'Part dispatched to engineer/site',
          updated_at: now,
        });
      }

      if (action === 'received') {
        Object.assign(updatePayload, {
          dispatch_status: 'received',
          current_department: 'engineer',
          updated_at: now,
        });
      }

      const { error } = await supabase
        .from('part_requests')
        .update(updatePayload)
        .eq('id', req.id);

      if (error) throw error;

      if (req.ticket_id) {
        const ticketPayload = {
          part_request_status:
            updatePayload.current_department ||
            updatePayload.approval_status ||
            req.current_department ||
            req.approval_status,
          updated_at: now,
        };

        if (action === 'operations_rejected' || action === 'inventory_rejected') {
          ticketPayload.status = 'rejected_parts';
        }

        const { error: ticketError } = await supabase
          .from('tickets')
          .update(ticketPayload)
          .eq('id', req.ticket_id);

        if (ticketError) throw ticketError;
      }

      if (action === 'dispatched') {
        const item = items.find(
          (p) =>
            p.id === req.part_id ||
            p.part_number === req.part_number ||
            p.description === req.part_name ||
            p.part_name === req.part_name
        );

        if (item) {
          const previousQty = item.quantity_available || 0;
          const qty = requestQty(req);
          const newQty = Math.max(0, previousQty - qty);

          const { error: stockError } = await supabase
            .from('spare_parts')
            .update({
              quantity_available: newQty,
              stock_status: computeStatus(newQty, item.minimum_stock_level),
              total_stock_value: (item.unit_price_ngn || 0) * newQty,
              updated_at: now,
            })
            .eq('id', item.id);

          if (stockError) throw stockError;

          const { error: movementError } = await supabase
            .from('inventory_movements')
            .insert({
              item_id: item.id,
              part_number: item.part_number,
              item_description: item.description,
              warehouse: item.warehouse || 'Oshodi',
              movement_type: 'request_dispatch',
              quantity_changed: -qty,
              previous_quantity: previousQty,
              new_quantity: newQty,
              reason: `Dispatched for request ${req.request_number || req.id}`,
              performed_by_email: user.email,
              performed_by_name: user.full_name || user.name || user.email,
              created_at: now,
            });

          if (movementError) throw movementError;

          qc.invalidateQueries({ queryKey: ['inventory-items'] });
          qc.invalidateQueries({ queryKey: ['inventory-movements'] });
        }
      }

      if (action === 'received') {
        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert({
            item_id: req.part_id || null,
            part_number: req.part_number || '',
            item_description: req.part_name,
            warehouse: req.warehouse || 'Oshodi',
            movement_type: 'request_received',
            quantity_changed: 0,
            previous_quantity: 0,
            new_quantity: 0,
            reason: `Engineer confirmed receipt for request ${req.request_number || req.id}`,
            performed_by_email: user.email,
            performed_by_name: user.full_name || user.name || user.email,
            created_at: now,
          });

        if (movementError) throw movementError;

        qc.invalidateQueries({ queryKey: ['inventory-movements'] });
      }

      qc.invalidateQueries({ queryKey: ['spare-requests'] });
    } catch (err) {
      alert('Action failed: ' + (err?.message || 'Please try again.'));
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportLoading(true);

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        let createdParts = 0;
        let updatedParts = 0;
        let skippedParts = 0;
        let createdSerials = 0;
        let skippedSerials = 0;

        for (const row of rows) {
          const partNum = String(row['Part Number'] || row.part_number || '').trim();
          const desc = String(row.Description || row.description || row['Part Name'] || '').trim();
          const warehouse = cleanWarehouse(row.Warehouse || row.warehouse || 'Oshodi');
          const trackingType = normalizeTrackingType(row['Tracking Type'] || row.tracking_type || row.Tracking || 'quantity');
          const qtyFromFile = safeNumber(row['Qty Available'] ?? row.Quantity ?? row.quantity ?? row.Qty, 0);

          if (!partNum || !desc) {
            skippedParts += 1;
            continue;
          }

          const existing = items.find(
            (item) =>
              String(item.part_number || '').trim().toLowerCase() === partNum.toLowerCase() &&
              cleanWarehouse(item.warehouse) === warehouse
          );

          const brand = row.Brand || row.brand || '';
          const family = row['Machine Family'] || row.machine_family || row.Model || row.model || '';
          const category = row.Category || row.category || 'WINCOR';
          const unitPrice = safeNumber(row['Unit Price (₦)'] ?? row['Unit Price (NGN)'] ?? row.unit_price_ngn, 0);
          const supplierUsd = safeNumber(row['Supplier Price ($)'] ?? row['Supplier Unit Price ($)'] ?? row.supplier_price_usd, 0);
          const minStock = safeNumber(row['Min Stock'] ?? row.minimum_stock_level, 2);
          const notes = row.Notes || row.notes || '';
          const location = row.Location || row.storage_location || '';
          const vendor = row.Vendor || row.vendor || 'Not specified';

          let finalQty = qtyFromFile;

          if (existing) {
            if (importMode === 'skip') {
              skippedParts += 1;
            } else {
              finalQty =
                importMode === 'merge'
                  ? Number(existing.quantity_available || 0) + qtyFromFile
                  : qtyFromFile;

              const { error } = await supabase
                .from('spare_parts')
                .update({
                  description: desc,
                  part_name: desc,
                  category_group: category,
                  device_brand: brand,
                  device_model: family,
                  tracking_type: trackingType,
                  quantity_available: trackingType === 'serial' ? Number(existing.quantity_available || 0) : finalQty,
                  minimum_stock_level: minStock,
                  supplier_price_usd: supplierUsd || null,
                  unit_price_ngn: unitPrice || null,
                  stock_status: computeStatus(trackingType === 'serial' ? Number(existing.quantity_available || 0) : finalQty, minStock),
                  vendor,
                  storage_location: location,
                  warehouse,
                  notes,
                  total_stock_value: unitPrice * (trackingType === 'serial' ? Number(existing.quantity_available || 0) : finalQty),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              if (error) throw error;
              updatedParts += 1;
            }
          } else {
            const { error } = await supabase.from('spare_parts').insert({
              part_number: partNum,
              part_name: desc,
              description: desc,
              category_group: category,
              device_brand: brand,
              device_model: family,
              tracking_type: trackingType,
              quantity_available: trackingType === 'serial' ? 0 : qtyFromFile,
              minimum_stock_level: minStock,
              supplier_price_usd: supplierUsd || null,
              unit_price_ngn: unitPrice || null,
              stock_status: computeStatus(trackingType === 'serial' ? 0 : qtyFromFile, minStock),
              vendor,
              storage_location: location,
              warehouse,
              notes,
              total_stock_value: unitPrice * (trackingType === 'serial' ? 0 : qtyFromFile),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            if (error) throw error;
            createdParts += 1;
          }

          const serialNumber = String(row['Serial Number'] || row.serial_number || '').trim();
          if (trackingType === 'serial' && serialNumber) {
            const latestParts = existing
              ? [existing]
              : (await supabase
                  .from('spare_parts')
                  .select('*')
                  .eq('part_number', partNum)
                  .eq('warehouse', warehouse)
                  .limit(1)).data || [];

            const parent = latestParts[0];
            const serialExists = serials.some(
              (s) => String(s.serial_number || '').toLowerCase() === serialNumber.toLowerCase()
            );

            if (serialExists) {
              skippedSerials += 1;
            } else {
              const { error: serialError } = await supabase.from('spare_part_serials').insert({
                spare_part_id: parent?.id || null,
                part_number: partNum,
                serial_number: serialNumber,
                manufacturer_serial: row['Manufacturer Serial'] || row.manufacturer_serial || '',
                warehouse,
                condition: String(row.Condition || row.condition || 'good').toLowerCase(),
                status: String(row.Status || row.status || 'in_stock').toLowerCase().replace(/\s+/g, '_'),
                supplier: row.Supplier || row.supplier || vendor || '',
                purchase_date: row['Purchase Date'] || row.purchase_date || null,
                current_engineer: row['Current Engineer'] || row.current_engineer || '',
                current_engineer_email: row['Engineer Email'] || row.current_engineer_email || '',
                sold_to: row['Sold To'] || row.sold_to || '',
                scrapped_reason: row['Scrapped Reason'] || row.scrapped_reason || '',
                notes,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

              if (serialError) throw serialError;
              createdSerials += 1;
            }
          }
        }

        qc.invalidateQueries({ queryKey: ['inventory-items'] });
        qc.invalidateQueries({ queryKey: ['spare-part-serials'] });

        alert(
          `Import complete. Created: ${createdParts}, Updated: ${updatedParts}, Skipped: ${skippedParts}, Serials Added: ${createdSerials}, Serials Skipped: ${skippedSerials}`
        );
      } catch (err) {
        alert(
          'Import failed: ' +
            (err?.message || 'Please check the file format and try again.')
        );
      } finally {
        setImportLoading(false);
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const exportExcel = () => {
    const quantityRows = filtered.map((i) => ({
      'Part Number': i.part_number,
      'Serial Number': '',
      'Manufacturer Serial': '',
      Description: i.description,
      'Tracking Type': normalizeTrackingType(i.tracking_type),
      Brand: i.device_brand,
      'Machine Family': i.device_model,
      Category: i.category_group,
      Quantity: normalizeTrackingType(i.tracking_type) === 'serial' ? '' : i.quantity_available || 0,
      Warehouse: i.warehouse || 'Oshodi',
      Condition: '',
      Status: i.stock_status,
      'Min Stock': i.minimum_stock_level || 2,
      'Unit Price (₦)': i.unit_price_ngn || '',
      'Supplier Price ($)': i.supplier_price_usd || '',
      Location: i.storage_location || '',
      Vendor: i.vendor || '',
      Notes: i.notes || '',
    }));

    const serialRows = serials.map((serial) => {
      const parent = items.find((item) => item.id === serial.spare_part_id);
      return {
        'Part Number': serial.part_number || parent?.part_number || '',
        'Serial Number': serial.serial_number || '',
        'Manufacturer Serial': serial.manufacturer_serial || '',
        Description: parent?.description || '',
        'Tracking Type': 'serial',
        Brand: parent?.device_brand || '',
        'Machine Family': parent?.device_model || '',
        Category: parent?.category_group || '',
        Quantity: '',
        Warehouse: serial.warehouse || parent?.warehouse || 'Oshodi',
        Condition: serial.condition || '',
        Status: serial.status || '',
        Supplier: serial.supplier || parent?.vendor || '',
        'Purchase Date': serial.purchase_date || '',
        'Current Engineer': serial.current_engineer || '',
        'Engineer Email': serial.current_engineer_email || '',
        'Sold To': serial.sold_to || '',
        'Scrapped Reason': serial.scrapped_reason || '',
        'Min Stock': parent?.minimum_stock_level || '',
        'Unit Price (₦)': parent?.unit_price_ngn || '',
        'Supplier Price ($)': parent?.supplier_price_usd || '',
        Location: parent?.storage_location || '',
        Vendor: parent?.vendor || '',
        Notes: serial.notes || parent?.notes || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet([...quantityRows, ...serialRows]);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory_Template');
    XLSX.writeFile(wb, `ARK_Inventory_Template_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.text('ARK ONE Inventory Report', 14, 15);
    doc.setFontSize(9);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Total: ${filtered.length} parts`,
      14,
      22
    );

    let y = 30;
    const headers = ['Part No.', 'Description', 'Brand', 'Model', 'Category', 'Qty', 'Warehouse', 'Status'];
    const widths = [28, 62, 22, 22, 26, 12, 22, 22];

    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');

    let x = 14;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += widths[i];
    });

    doc.setFont(undefined, 'normal');
    y += 6;

    filtered.slice(0, 120).forEach((item) => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }

      x = 14;

      const row = [
        item.part_number || '—',
        (item.description || '').slice(0, 40),
        item.device_brand || '',
        item.device_model || '',
        item.category_group || '',
        String(item.quantity_available || 0),
        item.warehouse || 'Oshodi',
        item.stock_status || '',
      ];

      row.forEach((v, i) => {
        doc.text(String(v), x, y);
        x += widths[i];
      });

      y += 5.5;
    });

    doc.save(`ARK_Inventory_${new Date().toISOString().slice(0, 10)}.pdf`);
  };


  const updateSerialRecord = async (serial, payload, successMessage) => {
    try {
      const { error } = await supabase
        .from('spare_part_serials')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', serial.id);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['spare-part-serials'] });
      alert(successMessage || 'Serial record updated.');
    } catch (err) {
      alert('Serial update failed: ' + (err?.message || 'Please try again.'));
    }
  };

  const assignSerialToEngineer = async (serial) => {
    const currentName = serial.current_engineer || '';
    const engineerName = window.prompt('Engineer name receiving this physical unit:', currentName);

    if (engineerName === null) return;

    const currentEmail = serial.current_engineer_email || '';
    const engineerEmail = window.prompt('Engineer email optional:', currentEmail);

    await updateSerialRecord(
      serial,
      {
        status: 'dispatched',
        current_engineer: engineerName.trim(),
        current_engineer_email: String(engineerEmail || '').trim(),
      },
      'Serial assigned/dispatched to engineer.'
    );
  };

  const markSerialSold = async (serial) => {
    const soldTo = window.prompt('Sold to:', serial.sold_to || '');
    if (soldTo === null || !soldTo.trim()) return;

    await updateSerialRecord(
      serial,
      {
        status: 'sold',
        sold_to: soldTo.trim(),
        sold_at: new Date().toISOString(),
      },
      'Serial marked as sold.'
    );
  };

  const markSerialScrapped = async (serial) => {
    const reason = window.prompt('Scrap reason:', serial.scrapped_reason || '');
    if (reason === null || !reason.trim()) return;

    await updateSerialRecord(
      serial,
      {
        status: 'scrapped',
        condition: 'scrap',
        scrapped_reason: reason.trim(),
        scrapped_at: new Date().toISOString(),
      },
      'Serial marked as scrapped.'
    );
  };

  const markSerialReturnedFaulty = (serial) =>
    updateSerialRecord(
      serial,
      {
        status: 'returned_faulty',
        condition: 'faulty',
      },
      'Serial marked as returned faulty.'
    );

  const sendSerialToRR = (serial) =>
    updateSerialRecord(
      serial,
      {
        status: 'under_rr',
        condition: 'faulty',
      },
      'Serial sent to RR.'
    );

  const markSerialQAPassed = (serial) =>
    updateSerialRecord(
      serial,
      {
        status: 'qa_passed',
        condition: 'repaired',
      },
      'Serial marked QA passed.'
    );

  const returnSerialToInventory = (serial) =>
    updateSerialRecord(
      serial,
      {
        status: 'in_stock',
        condition: serial.condition === 'faulty' ? 'repaired' : serial.condition || 'good',
        current_engineer: '',
        current_engineer_email: '',
      },
      'Serial returned to inventory stock.'
    );

  const REQ_STATUS = {
    operations_pending: {
      label: 'Operations Review',
      color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    inventory_pending: {
      label: 'Inventory Review',
      color: 'bg-primary/15 text-primary border-primary/30',
    },
    finance_pending: {
      label: 'Accounts Review',
      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    },
    ready_dispatch: {
      label: 'Ready to Dispatch',
      color: 'bg-green-500/15 text-green-300 border-green-500/30',
    },
    rejected: {
      label: 'Rejected',
      color: 'bg-red-500/15 text-red-300 border-red-500/30',
    },
    dispatched: {
      label: 'Dispatched',
      color: 'bg-primary/15 text-primary border-primary/30',
    },
    received: {
      label: 'Received',
      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    },
    pending: {
      label: 'Pending',
      color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
  };

  const URGENCY = {
    low: 'bg-slate-800/80 text-slate-300 border-slate-700',
    medium: 'bg-primary/15 text-primary border-primary/30',
    high: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  };

  return (
    <div className="space-y-5 pb-20 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Package className="w-6 h-6 text-primary" />
            Inventory Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} parts · {lowStock.length} low · {outStock.length} out ·{' '}
            {pending} pending · {serialTrackedCount} serial types · {inStockSerialCount} serials in stock · {filterWarehouse === 'all' ? 'All warehouses' : filterWarehouse}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage && (
            <>
              <Select value={importMode} onValueChange={setImportMode}>
                <SelectTrigger className="w-40 h-9 bg-[#071225] border-slate-700 text-slate-100">
                  <SelectValue placeholder="Import Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Merge Qty</SelectItem>
                  <SelectItem value="replace">Replace Qty</SelectItem>
                  <SelectItem value="skip">Skip Existing</SelectItem>
                </SelectContent>
              </Select>

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <span className="inline-flex items-center gap-1.5 text-sm font-medium h-9 px-3 rounded-md border border-slate-700 bg-[#071225] text-slate-100 hover:bg-[#0b1f3a] hover:text-white transition-colors">
                  {importLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Import Excel
                </span>
              </label>

              <Button
                variant="outline"
                onClick={() => {
                  setEditingItem(null);
                  setPf(EMPTY);
                  setItemOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Add Part
              </Button>
            </>
          )}

          <Button onClick={() => setReqOpen(true)}>
            <Plus className="w-4 h-4" />
            Request Part
          </Button>
        </div>
      </div>

      <InvStatsCards items={items} />

      {canManage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {warehouseStock.map((w) => (
            <Card
              key={w.warehouse}
              className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100 shadow-sm"
            >
              <p className="text-xs text-muted-foreground">Warehouse</p>
              <div className="flex items-center justify-between gap-3 mt-1">
                <p className="text-lg font-bold">{w.warehouse}</p>
                <Badge variant="outline" className="border-[#ff5a00]/30 text-[#ff5a00]">
                  {w.quantity} qty
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {w.items} item(s) · ₦{Number(w.value || 0).toLocaleString()} value
              </p>
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100 shadow-sm">
            <p className="text-xs text-muted-foreground">Operations Approval</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{operationsPending}</p>
          </Card>
          <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100 shadow-sm">
            <p className="text-xs text-muted-foreground">Inventory Approval</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{inventoryPending}</p>
          </Card>
          <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100 shadow-sm">
            <p className="text-xs text-muted-foreground">Accounts / Waybill</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{financePending}</p>
          </Card>
          <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100 shadow-sm">
            <p className="text-xs text-muted-foreground">Dispatch Pending</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{dispatchPending}</p>
          </Card>
        </div>
      )}

      {outStock.length > 0 && canManage && (
        <div className="flex gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">
              OUT OF STOCK — {outStock.length} item(s)
            </p>
            <p className="text-xs text-red-300/80">
              {outStock
                .slice(0, 6)
                .map((p) => p.description)
                .join(', ')}
              {outStock.length > 6 ? '…' : ''}
            </p>
          </div>
        </div>
      )}

      {lowStock.length > 0 && canManage && (
        <div className="flex gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              LOW STOCK — {lowStock.length} item(s)
            </p>
            <p className="text-xs text-amber-300/80">
              {lowStock
                .slice(0, 6)
                .map((p) => p.description)
                .join(', ')}
              {lowStock.length > 6 ? '…' : ''}
            </p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="bg-[#071225]/90 border border-slate-700/70 text-slate-200">
            {!isEngineer && <TabsTrigger value="inventory" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Inventory</TabsTrigger>}
            {canManage && (
              <TabsTrigger value="serials" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Serials ({serials.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="requests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Requests{' '}
              {pending > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 inline-flex items-center justify-center">
                  {pending}
                </span>
              )}
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <History className="w-3.5 h-3.5 mr-1" />
                Movement History
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search part, description, model…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterFamily} onValueChange={setFilterFamily}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Machine Family" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Families</SelectItem>
                {families.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {WAREHOUSES.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTracking} onValueChange={setFilterTracking}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tracking" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tracking</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
                <SelectItem value="serial">Serial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStock} onValueChange={setFilterStock}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            {search ||
            filterBrand !== 'all' ||
            filterCat !== 'all' ||
            filterFamily !== 'all' ||
            filterWarehouse !== 'all' ||
            filterTracking !== 'all' ||
            filterStock !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setFilterBrand('all');
                  setFilterCat('all');
                  setFilterFamily('all');
                  setFilterWarehouse('all');
                  setFilterTracking('all');
                  setFilterStock('all');
                }}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Clear
              </Button>
            ) : null}

            <div className="flex gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {filtered.length} of {items.length} parts shown
          </p>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="border border-slate-700/70 bg-[#071225]/90 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0b1b34]/90 border-b border-slate-700 text-xs text-slate-300 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2.5">Part No.</th>
                      <th className="text-left px-3 py-2.5">Description</th>
                      <th className="text-left px-3 py-2.5 hidden sm:table-cell">
                        Brand / Model
                      </th>
                      <th className="text-left px-3 py-2.5 hidden lg:table-cell">
                        Category
                      </th>
                      <th className="text-center px-3 py-2.5">Qty</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">Warehouse</th>
                      <th className="text-left px-3 py-2.5 hidden lg:table-cell">Tracking</th>
                      <th className="text-center px-3 py-2.5 hidden lg:table-cell">Serials</th>
                      {canViewPrices && (
                        <th className="text-right px-3 py-2.5 hidden xl:table-cell">
                          USD
                        </th>
                      )}
                      {canViewPrices && (
                        <th className="text-right px-3 py-2.5 hidden xl:table-cell">
                          ₦ Price
                        </th>
                      )}
                      <th className="text-center px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center py-16 text-muted-foreground"
                        >
                          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p>No parts found</p>
                        </td>
                      </tr>
                    )}

                    {filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {item.part_number || '—'}
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <p className="font-medium text-sm leading-tight line-clamp-2">
                            {item.description}
                          </p>
                          {item.notes && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1">
                              {item.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell text-xs">
                          <p className="font-medium">{item.device_brand || '—'}</p>
                          <p className="text-muted-foreground">{item.device_model || ''}</p>
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          <span className="text-xs bg-slate-800/80 text-slate-200 px-2 py-0.5 rounded-full border border-slate-700/70">
                            {item.category_group}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {item.quantity_available ?? 0}
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                            {item.warehouse || 'Oshodi'}
                          </Badge>
                          {item.storage_location && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {item.storage_location}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          <Badge variant="outline" className="text-[10px] capitalize border-slate-700 text-slate-200">
                            {normalizeTrackingType(item.tracking_type)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-center">
                          {normalizeTrackingType(item.tracking_type) === 'serial' ? (
                            <div className="text-xs">
                              <p className="font-bold text-primary">{getSerialCountForItem(item)}</p>
                              <p className="text-[10px] text-muted-foreground">{getInStockSerialCountForItem(item)} in stock</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        {canViewPrices && (
                          <td className="px-3 py-2.5 text-right text-xs hidden xl:table-cell">
                            {item.supplier_price_usd
                              ? `$${Number(item.supplier_price_usd).toLocaleString()}`
                              : '—'}
                          </td>
                        )}

                        {canViewPrices && (
                          <td className="px-3 py-2.5 text-right text-xs hidden xl:table-cell">
                            {item.unit_price_ngn
                              ? `₦${Number(item.unit_price_ngn).toLocaleString()}`
                              : '—'}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="outline" className={`text-[10px] ${stockClass(item)}`}>
                            {computeStatus(
                              item.quantity_available || 0,
                              item.minimum_stock_level || 2
                            )}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="QR/Barcode"
                              onClick={() => setQrItem(item)}
                            >
                              <QrCode className="w-3 h-3" />
                            </Button>

                            {canManage && normalizeTrackingType(item.tracking_type) === 'serial' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Add Serial"
                                onClick={() => {
                                  setSerialForm({
                                    ...EMPTY_SERIAL,
                                    spare_part_id: item.id,
                                    part_number: item.part_number || '',
                                    warehouse: item.warehouse || 'Oshodi',
                                  });
                                  setSerialOpen(true);
                                }}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            )}

                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Stock In/Out"
                                onClick={() => setMoveItem(item)}
                              >
                                <ArrowUpDown className="w-3 h-3" />
                              </Button>
                            )}

                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Edit"
                                onClick={() => {
                                  setEditingItem(item);
                                  setPf({ ...item });
                                  setItemOpen(true);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}

                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                title="Delete"
                                onClick={() => deleteItem(item)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="serials" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Physical Serial Numbers</h2>
                <p className="text-xs text-muted-foreground">
                  Part Number is the general part code, while Serial Number identifies one physical unit.
                </p>
              </div>

              <Button
                onClick={() => {
                  setSerialForm(EMPTY_SERIAL);
                  setSerialOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Serial Unit
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100">
                <p className="text-xs text-muted-foreground">Serial Units</p>
                <p className="text-2xl font-bold text-[#ff5a00]">{serials.length}</p>
              </Card>
              <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100">
                <p className="text-xs text-muted-foreground">In Stock</p>
                <p className="text-2xl font-bold text-[#ff5a00]">{serials.filter((s) => s.status === 'in_stock').length}</p>
              </Card>
              <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100">
                <p className="text-xs text-muted-foreground">With Engineer</p>
                <p className="text-2xl font-bold text-[#ff5a00]">{serials.filter((s) => ['dispatched', 'received_by_engineer'].includes(s.status)).length}</p>
              </Card>
              <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100">
                <p className="text-xs text-muted-foreground">Under RR</p>
                <p className="text-2xl font-bold text-[#ff5a00]">{serials.filter((s) => s.status === 'under_rr').length}</p>
              </Card>
              <Card className="p-3 border border-slate-700/70 bg-[#071225]/90 text-slate-100">
                <p className="text-xs text-muted-foreground">Sold/Scrapped</p>
                <p className="text-2xl font-bold text-[#ff5a00]">{serials.filter((s) => ['sold', 'scrapped'].includes(s.status)).length}</p>
              </Card>
            </div>

            <div className="border border-slate-700/70 bg-[#071225]/90 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0b1b34]/90 border-b border-slate-700 text-xs text-slate-300 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2.5">Part Number</th>
                      <th className="text-left px-3 py-2.5">Part Description</th>
                      <th className="text-left px-3 py-2.5">Serial Number</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">Supplier</th>
                      <th className="text-left px-3 py-2.5">Warehouse</th>
                      <th className="text-left px-3 py-2.5">Condition</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5 hidden lg:table-cell">Engineer / Buyer</th>
                      <th className="text-left px-3 py-2.5 hidden xl:table-cell">Notes</th>
                      <th className="text-left px-3 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {serialsLoading && (
                      <tr>
                        <td colSpan={10} className="text-center py-10 text-muted-foreground">
                          Loading serial units...
                        </td>
                      </tr>
                    )}

                    {!serialsLoading && filteredSerials.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-10 text-muted-foreground">
                          No serial number records found.
                        </td>
                      </tr>
                    )}

                    {!serialsLoading && filteredSerials.map((serial) => {
                      const parent = serialPartMap[serial.spare_part_id] || {};
                      const owner =
                        serial.status === 'sold'
                          ? serial.sold_to
                          : serial.current_engineer || serial.current_engineer_email || '—';

                      return (
                        <tr key={serial.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            {serial.part_number || parent.part_number || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-xs line-clamp-1">
                              {parent.description || parent.part_name || 'Unknown Part'}
                            </p>
                            {serial.manufacturer_serial && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                MFG: {serial.manufacturer_serial}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary">
                            {serial.serial_number}
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell text-xs">
                            {serial.supplier || parent.vendor || '—'}
                            {serial.purchase_date && (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(serial.purchase_date).toLocaleDateString()}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                              {serial.warehouse || parent.warehouse || 'Oshodi'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 capitalize text-xs">{serial.condition || 'good'}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className="text-[10px] capitalize border-primary/30 text-primary">
                              {String(serial.status || 'in_stock').replaceAll('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground max-w-[160px] truncate">
                            {owner || '—'}
                          </td>
                          <td className="px-3 py-2.5 hidden xl:table-cell text-xs text-muted-foreground max-w-[180px] truncate">
                            {serial.status === 'scrapped'
                              ? serial.scrapped_reason || serial.notes || '—'
                              : serial.notes || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => assignSerialToEngineer(serial)}
                              >
                                Engineer
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => markSerialReturnedFaulty(serial)}
                              >
                                Faulty
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => sendSerialToRR(serial)}
                              >
                                RR
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => markSerialQAPassed(serial)}
                              >
                                QA Pass
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => returnSerialToInventory(serial)}
                              >
                                Stock
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => markSerialSold(serial)}
                              >
                                Sold
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px] text-destructive"
                                onClick={() => markSerialScrapped(serial)}
                              >
                                Scrap
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="requests" className="space-y-3 mt-4">
          {requests.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No requests yet</p>
            </div>
          )}

          {requests.map((req) => {
            const currentStatus = workflowStatus(req);
            const sc = REQ_STATUS[currentStatus] || REQ_STATUS.pending;
            const photo = requestPhoto(req);
            const canOperationsAction =
              (isAdmin || isOperations) &&
              (
                req.operations_status === 'pending_review' ||
                req.approval_status === 'pending_operations' ||
                req.inventory_status === 'waiting_operations_approval'
              );
            const canInventoryAction =
              (isAdmin || isInventory) &&
              req.operations_status === 'approved' &&
              req.inventory_status === 'pending_review';
            const canFinanceAction =
              (isAdmin || isFinance) &&
              ['pending_payment_review', 'pending_dispatch_cost_review'].includes(req.finance_status);
            const canDispatchAction =
              (isAdmin || isInventory) &&
              req.inventory_status === 'approved_for_dispatch' &&
              ['approved', 'not_required'].includes(req.finance_status || 'not_required') &&
              !['dispatched', 'received'].includes(req.dispatch_status);

            return (
              <Card key={req.id} className="p-4 border border-slate-700/70 bg-[#071225]/90 text-slate-100 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {req.request_number || req.id}
                      </span>
                      <Badge variant="outline" className={sc.color + ' text-[10px]'}>
                        {sc.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={(URGENCY[req.urgency] || '') + ' text-[10px] capitalize'}
                      >
                        {req.urgency || 'medium'}
                      </Badge>
                      {req.request_type === 'bank' && (
                        <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-300">
                          Bank To Pay
                        </Badge>
                      )}
                    </div>

                    <p className="font-semibold text-sm">
                      {req.part_name || req.part_number || 'Requested Part'}{' '}
                      <span className="font-normal text-muted-foreground">
                        ×{requestQty(req)}
                      </span>
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      By: {req.engineer_name || req.engineer_email || 'Engineer'}
                      {req.site_name ? ' · ' + req.site_name : ''}
                      {req.tickets?.terminal_id ? ' · Terminal: ' + req.tickets.terminal_id : ''}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
                      <div className="rounded-lg border border-slate-700/70 bg-[#08162d]/70 p-2">
                        <p className="text-muted-foreground">Operations</p>
                        <p className="font-semibold capitalize">{req.operations_status || 'pending_review'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-[#08162d]/70 p-2">
                        <p className="text-muted-foreground">Inventory</p>
                        <p className="font-semibold capitalize">{req.inventory_status || 'pending_review'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-[#08162d]/70 p-2">
                        <p className="text-muted-foreground">Accounts</p>
                        <p className="font-semibold capitalize">{req.finance_status || 'not_required'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-[#08162d]/70 p-2">
                        <p className="text-muted-foreground">Dispatch</p>
                        <p className="font-semibold capitalize">{req.dispatch_status || 'pending'}</p>
                      </div>
                    </div>

                    {(req.reason_note || req.reason) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {req.reason_note || req.reason}
                      </p>
                    )}
                  </div>

                  {photo && (
                    <img
                      src={photo}
                      alt="Faulty part"
                      className="w-16 h-16 object-cover rounded-lg border"
                    />
                  )}
                </div>

                {canOperationsAction && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => reqAction(req, 'operations_approved')}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Operations Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-destructive"
                      onClick={() => reqAction(req, 'operations_rejected')}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}

                {canInventoryAction && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => reqAction(req, 'inventory_approved')}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Inventory Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-destructive"
                      onClick={() => reqAction(req, 'inventory_rejected')}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}

                {canFinanceAction && (
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    variant="outline"
                    onClick={() => reqAction(req, 'finance_approved')}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Accounts Approve Payment / Waybill
                  </Button>
                )}

                {canDispatchAction && (
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    variant="outline"
                    onClick={() => reqAction(req, 'dispatched')}
                  >
                    <Package className="w-3 h-3 mr-1" />
                    Mark Dispatched
                  </Button>
                )}

                {isEngineer && req.dispatch_status === 'dispatched' && (
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => reqAction(req, 'received')}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Confirm Received
                  </Button>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {canManage && (
          <TabsContent value="history" className="mt-4">
            <div className="border border-slate-700/70 bg-[#071225]/90 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0b1b34]/90 border-b border-slate-700 text-xs text-slate-300 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2.5">Date</th>
                      <th className="text-left px-3 py-2.5">Part</th>
                      <th className="text-left px-3 py-2.5">Type</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">Warehouse</th>
                      <th className="text-left px-3 py-2.5 hidden lg:table-cell">Tracking</th>
                      <th className="text-center px-3 py-2.5">Δ Qty</th>
                      <th className="text-center px-3 py-2.5 hidden sm:table-cell">
                        Before → After
                      </th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">
                        Reason
                      </th>
                      <th className="text-left px-3 py-2.5 hidden lg:table-cell">
                        By
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {movements.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-12 text-muted-foreground"
                        >
                          <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>No movement history yet</p>
                        </td>
                      </tr>
                    )}

                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {m.created_at
                            ? new Date(m.created_at).toLocaleDateString()
                            : ''}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-medium line-clamp-1">
                            {m.item_description}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {m.part_number}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-semibold ${mvtClass(m.movement_type)}`}>
                            {mvtLabel(m.movement_type)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                          {m.warehouse || 'Oshodi'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`text-sm font-bold ${
                              m.quantity_changed >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {m.quantity_changed >= 0 ? '+' : ''}
                            {m.quantity_changed}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center hidden sm:table-cell text-xs text-muted-foreground">
                          {m.previous_quantity} → {m.new_quantity}
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground max-w-[160px] truncate">
                          {m.reason || '—'}
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                          {m.performed_by_name || m.performed_by_email || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border border-slate-700 bg-[#071225] text-slate-100">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} Inventory Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Description *</Label>
                <Input
                  value={pf.description}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Part Number *</Label>
                <Input
                  value={pf.part_number}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      part_number: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Category Group</Label>
                <Select
                  value={pf.category_group}
                  onValueChange={(v) =>
                    setPf((f) => ({
                      ...f,
                      category_group: v,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tracking Type</Label>
                <Select
                  value={pf.tracking_type || 'quantity'}
                  onValueChange={(v) =>
                    setPf((f) => ({
                      ...f,
                      tracking_type: v,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Brand</Label>
                <Input
                  value={pf.device_brand}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      device_brand: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Machine Family / Model</Label>
                <Input
                  value={pf.device_model}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      device_model: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Qty Available</Label>
                <Input
                  type="number"
                  value={pf.quantity_available}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      quantity_available: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Min Stock Level</Label>
                <Input
                  type="number"
                  value={pf.minimum_stock_level}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      minimum_stock_level: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Unit Price (₦)</Label>
                <Input
                  type="number"
                  value={pf.unit_price_ngn}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      unit_price_ngn: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Supplier Price ($)</Label>
                <Input
                  type="number"
                  value={pf.supplier_price_usd}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      supplier_price_usd: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vendor</Label>
                <Input
                  value={pf.vendor}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      vendor: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Storage Location</Label>
                <Input
                  value={pf.storage_location}
                  onChange={(e) =>
                    setPf((f) => ({
                      ...f,
                      storage_location: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                  placeholder="e.g. Shelf A3"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Warehouse</Label>
                <Select
                  value={pf.warehouse || 'Oshodi'}
                  onValueChange={(v) =>
                    setPf((f) => ({
                      ...f,
                      warehouse: v,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSES.map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Physical Unit Serial Details</p>
                  <p className="text-xs text-muted-foreground">
                    Part Number identifies the part type, for example 75557 = NCR Card Reader. Serial Number identifies one exact physical unit under that part number. Fill it when this item is Serial / Physical Part.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Serial Number / S/N</Label>
                    <Input
                      value={pf.serial_number || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          serial_number: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      placeholder="Unique S/N for this unit"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Manufacturer Serial</Label>
                    <Input
                      value={pf.manufacturer_serial || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          manufacturer_serial: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      placeholder="OEM serial optional"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Supplier</Label>
                    <Input
                      value={pf.serial_supplier || pf.vendor || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          serial_supplier: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      placeholder="Who supplied this unit?"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Purchase Date</Label>
                    <Input
                      type="date"
                      value={pf.serial_purchase_date || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          serial_purchase_date: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Condition</Label>
                    <Select
                      value={pf.serial_condition || 'good'}
                      onValueChange={(v) =>
                        setPf((f) => ({
                          ...f,
                          serial_condition: v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERIAL_CONDITIONS.map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {condition}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={pf.serial_status || 'in_stock'}
                      onValueChange={(v) =>
                        setPf((f) => ({
                          ...f,
                          serial_status: v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERIAL_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replaceAll('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Engineer Given To</Label>
                    <Input
                      value={pf.serial_current_engineer || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          serial_current_engineer: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      placeholder="Engineer name if dispatched"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Engineer Email</Label>
                    <Input
                      value={pf.serial_current_engineer_email || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          serial_current_engineer_email: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      placeholder="Engineer email optional"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Sold To</Label>
                    <Input
                      value={pf.serial_sold_to || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          serial_sold_to: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      placeholder="Buyer if sold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Scrapped Reason</Label>
                    <Input
                      value={pf.serial_scrapped_reason || ''}
                      onChange={(e) =>
                        setPf((f) => ({
                          ...f,
                          serial_scrapped_reason: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      placeholder="Reason if scrapped"
                    />
                  </div>
                </div>
              </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={pf.notes}
                onChange={(e) =>
                  setPf((f) => ({
                    ...f,
                    notes: e.target.value,
                  }))
                }
                className="h-16 text-sm"
              />
            </div>

            <Button
              className="w-full"
              onClick={saveItem}
              disabled={
                !pf.description ||
                !pf.part_number ||
                (normalizeTrackingType(pf.tracking_type) === 'serial' && !editingItem && !pf.serial_number) ||
                saving
              }
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem
                ? 'Update Item'
                : normalizeTrackingType(pf.tracking_type) === 'serial'
                ? 'Add Part Type + Serial Unit'
                : 'Add Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border border-slate-700 bg-[#071225] text-slate-100">
          <DialogHeader>
            <DialogTitle>Request Spare Part</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Select Part from Inventory</Label>
              <Select
                value={rf.part_id}
                onValueChange={(v) => {
                  const p = items.find((x) => x.id === v);
                  setRf((f) => ({
                    ...f,
                    part_id: v,
                    part_name: p?.description || '',
                    part_number: p?.part_number || '',
                  }));
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Choose from inventory…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.description} ({p.quantity_available ?? 0} in stock · {p.warehouse || 'Oshodi'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!rf.part_id && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Part Name</Label>
                  <Input
                    value={rf.part_name}
                    onChange={(e) =>
                      setRf((f) => ({
                        ...f,
                        part_name: e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Part Number</Label>
                  <Input
                    value={rf.part_number}
                    onChange={(e) =>
                      setRf((f) => ({
                        ...f,
                        part_number: e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={rf.quantity_requested}
                  onChange={(e) =>
                    setRf((f) => ({
                      ...f,
                      quantity_requested: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Urgency</Label>
                <Select
                  value={rf.urgency}
                  onValueChange={(v) =>
                    setRf((f) => ({
                      ...f,
                      urgency: v,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Site Name</Label>
              <Input
                value={rf.site_name}
                onChange={(e) =>
                  setRf((f) => ({
                    ...f,
                    site_name: e.target.value,
                  }))
                }
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={rf.reason}
                onChange={(e) =>
                  setRf((f) => ({
                    ...f,
                    reason: e.target.value,
                  }))
                }
                className="h-20 text-sm"
              />
            </div>

            <Button
              className="w-full"
              onClick={submitReq}
              disabled={(!rf.part_id && !rf.part_name) || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={serialOpen} onOpenChange={setSerialOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700 bg-[#071225] text-slate-100">
          <DialogHeader>
            <DialogTitle>Add Physical Serial Unit</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-700/70 bg-[#08162d]/70 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-slate-200">Part Number</span> identifies the part type, for example 75557 = NCR Card Reader.
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-200">Serial Number</span> identifies one physical unit under that part number.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Parent Part / Part Number</Label>
              <Select
                value={serialForm.spare_part_id}
                onValueChange={(v) => {
                  const selected = items.find((item) => item.id === v);
                  setSerialForm((f) => ({
                    ...f,
                    spare_part_id: v,
                    part_number: selected?.part_number || f.part_number,
                    warehouse: selected?.warehouse || f.warehouse || 'Oshodi',
                    supplier: selected?.vendor || f.supplier || '',
                  }));
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select serial-tracked part e.g. 75557 NCR Card Reader" />
                </SelectTrigger>
                <SelectContent>
                  {items
                    .filter((item) => normalizeTrackingType(item.tracking_type) === 'serial')
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.part_number} · {item.description} · {item.warehouse || 'Oshodi'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Serial Number / S/N</Label>
                <Input
                  value={serialForm.serial_number}
                  onChange={(e) => setSerialForm((f) => ({ ...f, serial_number: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Unique unit serial number"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Manufacturer Serial</Label>
                <Input
                  value={serialForm.manufacturer_serial}
                  onChange={(e) => setSerialForm((f) => ({ ...f, manufacturer_serial: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="OEM serial optional"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Supplier</Label>
                <Input
                  value={serialForm.supplier}
                  onChange={(e) => setSerialForm((f) => ({ ...f, supplier: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Who supplied this unit?"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Purchase Date</Label>
                <Input
                  type="date"
                  value={serialForm.purchase_date || ''}
                  onChange={(e) => setSerialForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Warehouse</Label>
                <Select
                  value={serialForm.warehouse || 'Oshodi'}
                  onValueChange={(v) => setSerialForm((f) => ({ ...f, warehouse: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSES.map((w) => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Condition</Label>
                <Select
                  value={serialForm.condition || 'good'}
                  onValueChange={(v) => setSerialForm((f) => ({ ...f, condition: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERIAL_CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={serialForm.status || 'in_stock'}
                  onValueChange={(v) => setSerialForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERIAL_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replaceAll('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Current Engineer</Label>
                <Input
                  value={serialForm.current_engineer}
                  onChange={(e) => setSerialForm((f) => ({ ...f, current_engineer: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Engineer name if dispatched"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Engineer Email</Label>
                <Input
                  value={serialForm.current_engineer_email}
                  onChange={(e) => setSerialForm((f) => ({ ...f, current_engineer_email: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Engineer email optional"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Sold To</Label>
                <Input
                  value={serialForm.sold_to}
                  onChange={(e) => setSerialForm((f) => ({ ...f, sold_to: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Buyer if sold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Scrapped Reason</Label>
                <Input
                  value={serialForm.scrapped_reason}
                  onChange={(e) => setSerialForm((f) => ({ ...f, scrapped_reason: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Reason if scrapped"
                />
              </div>
            </div>

            <Textarea
              value={serialForm.notes}
              onChange={(e) => setSerialForm((f) => ({ ...f, notes: e.target.value }))}
              className="h-20 text-sm"
              placeholder="Serial notes"
            />

            <Button
              className="w-full"
              disabled={!serialForm.spare_part_id || !serialForm.serial_number || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const parent = items.find((item) => item.id === serialForm.spare_part_id);

                  const payload = {
                    ...serialForm,
                    part_number: serialForm.part_number || parent?.part_number || '',
                    warehouse: serialForm.warehouse || parent?.warehouse || 'Oshodi',
                    supplier: serialForm.supplier || parent?.vendor || '',
                    purchase_date: serialForm.purchase_date || null,
                    current_engineer: serialForm.current_engineer || '',
                    current_engineer_email: serialForm.current_engineer_email || '',
                    sold_to: serialForm.sold_to || '',
                    scrapped_reason: serialForm.scrapped_reason || '',
                    sold_at: serialForm.status === 'sold' ? new Date().toISOString() : null,
                    scrapped_at: serialForm.status === 'scrapped' ? new Date().toISOString() : null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };

                  const { error } = await supabase.from('spare_part_serials').insert(payload);

                  if (error) throw error;

                  await supabase
                    .from('spare_parts')
                    .update({
                      tracking_type: 'serial',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', serialForm.spare_part_id);

                  qc.invalidateQueries({ queryKey: ['spare-part-serials'] });
                  qc.invalidateQueries({ queryKey: ['inventory-items'] });
                  setSerialForm(EMPTY_SERIAL);
                  setSerialOpen(false);
                } catch (err) {
                  alert('Serial save failed: ' + (err?.message || 'Unknown error'));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Physical Serial Unit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StockMoveDialog
        item={moveItem}
        user={user}
        open={!!moveItem}
        onClose={() => setMoveItem(null)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['inventory-items'] });
          qc.invalidateQueries({ queryKey: ['inventory-movements'] });
        }}
      />

      <QRBarcodeModal item={qrItem} open={!!qrItem} onClose={() => setQrItem(null)} />

      <AIInventoryChat items={items} />
    </div>
  );
}