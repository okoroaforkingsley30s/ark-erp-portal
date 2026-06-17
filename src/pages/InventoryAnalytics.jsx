import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

import {
  BarChart3,
  Package,
  Search,
  TrendingUp,
  Users,
  Warehouse,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCcw,
} from 'lucide-react';

import * as XLSX from 'xlsx';

const WAREHOUSES = ['Oshodi', 'Ipaja', 'Enugu'];

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;

const normalize = (value) => String(value || '').toLowerCase().trim();

async function fetchUsageLogs() {
  const { data, error } = await supabase
    .from('inventory_usage_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) throw error;
  return data || [];
}

async function fetchSpareParts() {
  const { data, error } = await supabase
    .from('spare_parts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchSerials() {
  const { data, error } = await supabase
    .from('spare_part_serials')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) throw error;
  return data || [];
}

function groupByEngineer(logs) {
  const map = new Map();

  logs.forEach((log) => {
    const key = log.engineer_email || log.engineer_name || log.engineer_id || 'Unknown Engineer';

    if (!map.has(key)) {
      map.set(key, {
        engineer: log.engineer_name || log.engineer_email || log.engineer_id || 'Unknown Engineer',
        email: log.engineer_email || '',
        totalQty: 0,
        totalCost: 0,
        requests: 0,
      });
    }

    const row = map.get(key);
    row.totalQty += Number(log.quantity_used || 0);
    row.totalCost += Number(log.total_cost_ngn || 0);
    row.requests += 1;
  });

  return [...map.values()].sort((a, b) => b.totalCost - a.totalCost);
}

function groupByPart(logs) {
  const map = new Map();

  logs.forEach((log) => {
    const key = log.part_number || log.part_name || 'Unknown Part';

    if (!map.has(key)) {
      map.set(key, {
        partNumber: log.part_number || '',
        partName: log.part_name || 'Unknown Part',
        totalQty: 0,
        totalCost: 0,
        usageCount: 0,
      });
    }

    const row = map.get(key);
    row.totalQty += Number(log.quantity_used || 0);
    row.totalCost += Number(log.total_cost_ngn || 0);
    row.usageCount += 1;
  });

  return [...map.values()].sort((a, b) => b.totalQty - a.totalQty);
}

function groupByWarehouse(items) {
  return WAREHOUSES.map((warehouse) => {
    const rows = items.filter((item) => (item.warehouse || 'Oshodi') === warehouse);

    return {
      warehouse,
      itemCount: rows.length,
      quantity: rows.reduce((sum, item) => sum + Number(item.quantity_available || 0), 0),
      value: rows.reduce(
        (sum, item) =>
          sum + Number(item.quantity_available || 0) * Number(item.unit_price_ngn || 0),
        0
      ),
    };
  });
}

function serialStatusSummary(serials) {
  const map = new Map();

  serials.forEach((serial) => {
    const status = serial.status || 'in_stock';
    map.set(status, (map.get(status) || 0) + 1);
  });

  return [...map.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

export default function InventoryAnalytics() {
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  const {
    data: usageLogs = [],
    isLoading: usageLoading,
    refetch: refetchUsage,
  } = useQuery({
    queryKey: ['inventory-usage-logs'],
    queryFn: fetchUsageLogs,
  });

  const {
    data: parts = [],
    isLoading: partsLoading,
    refetch: refetchParts,
  } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchSpareParts,
  });

  const {
    data: serials = [],
    isLoading: serialsLoading,
    refetch: refetchSerials,
  } = useQuery({
    queryKey: ['spare-part-serials'],
    queryFn: fetchSerials,
  });

  const filteredLogs = useMemo(() => {
    const q = normalize(search);

    return usageLogs.filter((log) => {
      const matchSearch =
        !q ||
        [
          log.part_name,
          log.part_number,
          log.serial_number,
          log.engineer_name,
          log.engineer_email,
          log.ticket_number,
          log.warehouse,
        ]
          .filter(Boolean)
          .some((value) => normalize(value).includes(q));

      const matchWarehouse =
        warehouseFilter === 'all' || (log.warehouse || 'Oshodi') === warehouseFilter;

      return matchSearch && matchWarehouse;
    });
  }, [usageLogs, search, warehouseFilter]);

  const filteredParts = useMemo(() => {
    return parts.filter(
      (item) => warehouseFilter === 'all' || (item.warehouse || 'Oshodi') === warehouseFilter
    );
  }, [parts, warehouseFilter]);

  const engineerRows = useMemo(() => groupByEngineer(filteredLogs), [filteredLogs]);
  const partRows = useMemo(() => groupByPart(filteredLogs), [filteredLogs]);
  const warehouseRows = useMemo(() => groupByWarehouse(filteredParts), [filteredParts]);
  const serialRows = useMemo(() => serialStatusSummary(serials), [serials]);

  const totalInventoryValue = filteredParts.reduce(
    (sum, item) =>
      sum + Number(item.quantity_available || 0) * Number(item.unit_price_ngn || 0),
    0
  );

  const lowStockCount = filteredParts.filter(
    (item) =>
      Number(item.quantity_available || 0) > 0 &&
      Number(item.quantity_available || 0) <= Number(item.minimum_stock_level || 2)
  ).length;

  const outStockCount = filteredParts.filter(
    (item) => Number(item.quantity_available || 0) === 0
  ).length;

  const totalUsedQty = filteredLogs.reduce((sum, log) => sum + Number(log.quantity_used || 0), 0);
  const totalUsageCost = filteredLogs.reduce((sum, log) => sum + Number(log.total_cost_ngn || 0), 0);

  const refreshAll = () => {
    refetchUsage();
    refetchParts();
    refetchSerials();
  };

  const exportAnalytics = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(engineerRows), 'Engineer Usage');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partRows), 'Part Demand');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warehouseRows), 'Warehouse Value');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(serialRows), 'Serial Status');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredLogs), 'Raw Usage Logs');

    XLSX.writeFile(wb, `ARK_Inventory_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const loading = usageLoading || partsLoading || serialsLoading;

  return (
    <div className="space-y-5 pb-20 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <BarChart3 className="w-6 h-6 text-primary" />
            ARK ONE Inventory Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Engineer usage, cost per engineer, high demand parts, fast moving parts and warehouse value.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCcw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportAnalytics}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search engineer, part, serial, ticket..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {WAREHOUSES.map((warehouse) => (
              <SelectItem key={warehouse} value={warehouse}>
                {warehouse}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inventory Value</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{money(totalInventoryValue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Parts Used</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{totalUsedQty}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Usage Cost</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{money(totalUsageCost)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Low / Out Stock</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{lowStockCount} / {outStockCount}</p>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCcw className="w-4 h-4 animate-spin" />
          Loading analytics...
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Users className="w-4 h-4 text-[#ff5a00]" />
              Parts Used By Engineer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#ff5a00] uppercase border-b border-[#ff5a00]/20">
                  <tr>
                    <th className="text-left py-2">Engineer</th>
                    <th className="text-center py-2">Qty</th>
                    <th className="text-right py-2">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engineerRows.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No usage logs yet</td></tr>
                  )}
                  {engineerRows.slice(0, 15).map((row) => (
                    <tr key={row.email || row.engineer}>
                      <td className="py-2">
                        <p className="font-medium">{row.engineer}</p>
                        {row.email && <p className="text-xs text-muted-foreground">{row.email}</p>}
                      </td>
                      <td className="py-2 text-center font-bold">{row.totalQty}</td>
                      <td className="py-2 text-right">{money(row.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <TrendingUp className="w-4 h-4 text-[#ff5a00]" />
              High Demand / Fast Moving Parts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#ff5a00] uppercase border-b border-[#ff5a00]/20">
                  <tr>
                    <th className="text-left py-2">Part</th>
                    <th className="text-center py-2">Qty Used</th>
                    <th className="text-right py-2">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {partRows.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No part usage yet</td></tr>
                  )}
                  {partRows.slice(0, 15).map((row) => (
                    <tr key={row.partNumber || row.partName}>
                      <td className="py-2">
                        <p className="font-medium">{row.partName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.partNumber || '—'}</p>
                      </td>
                      <td className="py-2 text-center font-bold">{row.totalQty}</td>
                      <td className="py-2 text-right">{money(row.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Warehouse className="w-4 h-4 text-[#ff5a00]" />
              Warehouse Stock Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warehouseRows.map((row) => (
                <div key={row.warehouse} className="rounded-lg border border-[#ff5a00]/20 bg-[#08153d] p-3 hover:border-[#ff5a00]/40 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{row.warehouse}</p>
                    <Badge variant="outline" className="border-[#ff5a00]/30 text-[#ff5a00]">
                      {row.quantity} qty
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {row.itemCount} item type(s) · {money(row.value)} value
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Package className="w-4 h-4 text-[#ff5a00]" />
              Serial Lifecycle Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {serialRows.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4" />
                  No serial records yet
                </div>
              )}
              {serialRows.map((row) => (
                <div key={row.status} className="flex items-center justify-between border-b border-slate-800 py-2">
                  <span className="capitalize">{String(row.status).replaceAll('_', ' ')}</span>
                  <Badge variant="outline" className="border-[#ff5a00]/30 text-[#ff5a00]">{row.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
