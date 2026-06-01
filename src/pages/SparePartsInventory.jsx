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

const computeStatus = (qty, min) =>
  qty === 0 ? 'OUT OF STOCK' : qty <= (min || 2) ? 'LOW STOCK' : 'AVAILABLE';

const stockClass = (item) => {
  const q = item.quantity_available || 0;
  const m = item.minimum_stock_level || 2;

  if (q === 0) {
    return 'bg-red-500/15 text-red-300 border-red-200 dark:bg-red-950 dark:text-red-300';
  }

  if (q <= m) {
    return 'bg-amber-500/15 text-amber-300 border-amber-200 dark:bg-amber-950 dark:text-amber-300';
  }

  return 'bg-green-500/15 text-green-300 border-green-200 dark:bg-green-950 dark:text-green-300';
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
    .from('spare_part_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (isEngineer) {
    query = query.eq('engineer_email', user.email);
  }

  const { data, error } = await query.limit(isEngineer ? 100 : 300);

  if (error) throw error;
  return data || [];
}

async function fetchInventoryMovements() {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

export default function SparePartsInventory() {
  const { user } = useOutletContext();
  const role = user?.role || 'engineer';

  const canManage = ['admin', 'inventory', 'procurement'].includes(role);
  const canViewPrices = [
    'admin',
    'inventory',
    'procurement',
    'finance',
    'ceo',
    'agm',
    'manager',
  ].includes(role);

  const isEngineer = role === 'engineer';
  const qc = useQueryClient();

  const [tab, setTab] = useState(isEngineer ? 'requests' : 'inventory');
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterFamily, setFilterFamily] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [itemOpen, setItemOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pf, setPf] = useState(EMPTY);
  const [rf, setRf] = useState(EMPTY_REQ);
  const [saving, setSaving] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [qrItem, setQrItem] = useState(null);

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

  const pending = requests.filter((r) => r.status === 'pending').length;

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        const q = search.toLowerCase();

        const matchSearch =
          !search ||
          [
            p.description,
            p.part_number,
            p.device_model,
            p.device_brand,
            p.vendor,
            p.notes,
          ].some((f) => (f || '').toLowerCase().includes(q));

        const matchBrand = filterBrand === 'all' || p.device_brand === filterBrand;
        const matchCat = filterCat === 'all' || p.category_group === filterCat;
        const matchFamily = filterFamily === 'all' || p.device_model === filterFamily;

        const matchStock =
          filterStock === 'all' ||
          (filterStock === 'available' &&
            (p.quantity_available || 0) > (p.minimum_stock_level || 2)) ||
          (filterStock === 'low' &&
            (p.quantity_available || 0) > 0 &&
            (p.quantity_available || 0) <= (p.minimum_stock_level || 2)) ||
          (filterStock === 'out' && (p.quantity_available || 0) === 0);

        return matchSearch && matchBrand && matchCat && matchFamily && matchStock;
      }),
    [items, search, filterBrand, filterCat, filterFamily, filterStock]
  );

  const saveItem = async () => {
    if (!pf.description?.trim() || !pf.part_number?.trim()) {
      alert('Description and Part Number are required.');
      return;
    }

    setSaving(true);

    try {
      const qty = parseInt(pf.quantity_available, 10) || 0;
      const min = parseInt(pf.minimum_stock_level, 10) || 2;
      const unitPrice = parseFloat(pf.unit_price_ngn) || 0;

      const payload = {
        ...pf,
        part_name: pf.description,
        quantity_available: qty,
        minimum_stock_level: min,
        supplier_price_usd: parseFloat(pf.supplier_price_usd) || null,
        unit_price_ngn: unitPrice || null,
        total_stock_value: unitPrice * qty,
        stock_status: computeStatus(qty, min),
        vendor: pf.vendor || 'Not specified',
        updated_at: new Date().toISOString(),
      };

      if (editingItem) {
        const { error } = await supabase
          .from('spare_parts')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('spare_parts').insert(payload);

        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['inventory-items'] });

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

      const { error } = await supabase.from('spare_part_requests').insert({
        ...rf,
        part_name: item?.description || rf.part_name,
        part_number: item?.part_number || rf.part_number,
        engineer_email: user.email,
        engineer_name: user.full_name || user.name || user.email,
        request_number: 'REQ-' + Date.now(),
        status: 'pending',
        created_at: new Date().toISOString(),
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

  const reqAction = async (req, status) => {
    try {
      const { error } = await supabase
        .from('spare_part_requests')
        .update({
          status,
          approver_email: user.email,
          approved_date: new Date().toISOString(),
        })
        .eq('id', req.id);

      if (error) throw error;

      if (status === 'dispatched') {
        const item = items.find(
          (p) => p.id === req.part_id || p.part_number === req.part_number
        );

        if (item) {
          const previousQty = item.quantity_available || 0;
          const requestQty = req.quantity_requested || 1;
          const newQty = Math.max(0, previousQty - requestQty);

          const { error: stockError } = await supabase
            .from('spare_parts')
            .update({
              quantity_available: newQty,
              stock_status: computeStatus(newQty, item.minimum_stock_level),
              total_stock_value: (item.unit_price_ngn || 0) * newQty,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          if (stockError) throw stockError;

          const { error: movementError } = await supabase
            .from('inventory_movements')
            .insert({
              item_id: item.id,
              part_number: item.part_number,
              item_description: item.description,
              movement_type: 'request_dispatch',
              quantity_changed: -requestQty,
              previous_quantity: previousQty,
              new_quantity: newQty,
              reason: `Dispatched for request ${req.request_number}`,
              performed_by_email: user.email,
              performed_by_name: user.full_name || user.name || user.email,
              created_at: new Date().toISOString(),
            });

          if (movementError) throw movementError;

          qc.invalidateQueries({ queryKey: ['inventory-items'] });
          qc.invalidateQueries({ queryKey: ['inventory-movements'] });
        }
      }

      if (status === 'received') {
        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert({
            item_id: req.part_id || null,
            part_number: req.part_number,
            item_description: req.part_name,
            movement_type: 'request_received',
            quantity_changed: 0,
            previous_quantity: 0,
            new_quantity: 0,
            reason: `Engineer confirmed receipt for request ${req.request_number}`,
            performed_by_email: user.email,
            performed_by_name: user.full_name || user.name || user.email,
            created_at: new Date().toISOString(),
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

        let count = 0;
        const BATCH = 10;

        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);

          const payload = batch.map((row) => {
            const brand = row.Brand || row.brand || '';
            const family = row['Machine Family'] || row.machine_family || '';
            const partNum = row['Part Number'] || row.part_number || '';
            const desc = row.Description || row.description || '';
            const cat = row.Category || row.category || '';
            const srcGroup = row['Source Group'] || row.source_group || '';
            const usdStr = String(row['Supplier Unit Price ($)'] || '0').replace(/,/g, '');
            const ngnStr = String(
              row['Unit Price (₦)'] || row['Unit Price (NGN)'] || '0'
            ).replace(/,/g, '');
            const notes = row.Notes || '';
            const rfStatus = row['RF Status'] || '';

            let catGroup = 'WINCOR';
            const sg = String(srcGroup).toUpperCase();

            if (sg.includes('NCR')) catGroup = 'NCR_S1';
            else if (sg.includes('HYO')) catGroup = 'HYOSUNG';
            else if (sg.includes('ENTRUST')) catGroup = 'ENTRUST';
            else if (sg.includes('EVOLIS')) catGroup = 'EVOLIS';
            else if (sg.includes('GENERAL') || sg.includes('PRINTER')) {
              catGroup = 'GENERAL_PRINTER_ACCESSORIES';
            }

            return {
              part_number: partNum || 'NIL',
              part_name: desc || 'Unnamed Part',
              description: desc || 'Unnamed Part',
              category_group: catGroup,
              device_brand: brand,
              device_model: family,
              supplier_price_usd: parseFloat(usdStr) || null,
              unit_price_ngn: parseFloat(ngnStr) || null,
              quantity_available: 0,
              minimum_stock_level: 2,
              stock_status: 'OUT OF STOCK',
              vendor: 'Not specified',
              notes: [cat, rfStatus === 'YES' ? 'RF Part' : '', notes]
                .filter(Boolean)
                .join(' | '),
              total_stock_value: 0,
              created_at: new Date().toISOString(),
            };
          });

          const { error } = await supabase.from('spare_parts').insert(payload);

          if (error) throw error;

          count += payload.length;
        }

        qc.invalidateQueries({ queryKey: ['inventory-items'] });
        alert(`Successfully imported ${count} items!`);
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
    const data = filtered.map((i) => ({
      'Part Number': i.part_number,
      Description: i.description,
      Brand: i.device_brand,
      'Machine Family': i.device_model,
      Category: i.category_group,
      'Qty Available': i.quantity_available || 0,
      'Min Stock': i.minimum_stock_level || 2,
      'Stock Status': i.stock_status,
      'Unit Price (₦)': i.unit_price_ngn || '',
      'Supplier Price ($)': i.supplier_price_usd || '',
      Location: i.storage_location || '',
      Vendor: i.vendor || '',
      Notes: i.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `ARK_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
    const headers = ['Part No.', 'Description', 'Brand', 'Model', 'Category', 'Qty', 'Status'];
    const widths = [28, 70, 25, 25, 28, 12, 22];

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

  const REQ_STATUS = {
    pending: { label: 'Pending', color: 'bg-amber-500/15 text-amber-300' },
    approved: { label: 'Approved', color: 'bg-green-500/15 text-green-300' },
    rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-300' },
    dispatched: { label: 'Dispatched', color: 'bg-blue-50 text-blue-700' },
    received: { label: 'Received', color: 'bg-purple-50 text-purple-700' },
  };

  const URGENCY = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-50 text-blue-700',
    high: 'bg-amber-500/15 text-amber-300',
    critical: 'bg-red-500/15 text-red-300',
  };

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Inventory Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} parts · {lowStock.length} low · {outStock.length} out ·{' '}
            {pending} pending
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage && (
            <>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <span className="inline-flex items-center gap-1.5 text-sm font-medium h-9 px-3 rounded-md border border-input bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] hover:bg-accent hover:text-accent-foreground transition-colors">
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

      {outStock.length > 0 && canManage && (
        <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              OUT OF STOCK — {outStock.length} item(s)
            </p>
            <p className="text-xs text-red-700 dark:text-red-400">
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
        <div className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              LOW STOCK — {lowStock.length} item(s)
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
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
          <TabsList>
            {!isEngineer && <TabsTrigger value="inventory">Inventory</TabsTrigger>}
            <TabsTrigger value="requests">
              Requests{' '}
              {pending > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 inline-flex items-center justify-center">
                  {pending}
                </span>
              )}
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="history">
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
            filterStock !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setFilterBrand('all');
                  setFilterCat('all');
                  setFilterFamily('all');
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
            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b text-xs text-muted-foreground uppercase">
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

                  <tbody className="divide-y">
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
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
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
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {item.category_group}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {item.quantity_available ?? 0}
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

        <TabsContent value="requests" className="space-y-3 mt-4">
          {requests.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No requests yet</p>
            </div>
          )}

          {requests.map((req) => {
            const sc = REQ_STATUS[req.status] || REQ_STATUS.pending;

            return (
              <Card key={req.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {req.request_number}
                      </span>
                      <Badge variant="outline" className={sc.color + ' text-[10px]'}>
                        {sc.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={(URGENCY[req.urgency] || '') + ' text-[10px] capitalize'}
                      >
                        {req.urgency}
                      </Badge>
                    </div>

                    <p className="font-semibold text-sm">
                      {req.part_name}{' '}
                      <span className="font-normal text-muted-foreground">
                        ×{req.quantity_requested}
                      </span>
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      By: {req.engineer_name}
                      {req.site_name ? ' · ' + req.site_name : ''}
                    </p>

                    {req.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{req.reason}</p>
                    )}
                  </div>

                  {req.faulty_part_photo && (
                    <img
                      src={req.faulty_part_photo}
                      alt="Faulty part"
                      className="w-16 h-16 object-cover rounded-lg border"
                    />
                  )}
                </div>

                {canManage && req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => reqAction(req, 'approved')}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-destructive"
                      onClick={() => reqAction(req, 'rejected')}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}

                {canManage && req.status === 'approved' && (
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

                {isEngineer && req.status === 'dispatched' && (
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
            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-3 py-2.5">Date</th>
                      <th className="text-left px-3 py-2.5">Part</th>
                      <th className="text-left px-3 py-2.5">Type</th>
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

                  <tbody className="divide-y">
                    {movements.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-12 text-muted-foreground"
                        >
                          <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>No movement history yet</p>
                        </td>
                      </tr>
                    )}

                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/20">
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
              disabled={!pf.description || !pf.part_number || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem ? 'Update' : 'Add'} Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                      {p.description} ({p.quantity_available ?? 0} in stock)
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