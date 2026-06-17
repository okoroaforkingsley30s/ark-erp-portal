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
  Banknote,
  MapPin,
  Activity,
  Calculator,
  ShieldAlert,
  BadgeDollarSign,
} from 'lucide-react';

import * as XLSX from 'xlsx';

const WAREHOUSES = ['Oshodi', 'Ipaja', 'Enugu'];

const DEFAULT_REVENUE_PER_JOB = 0;

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;

const normalize = (value) => String(value || '').toLowerCase().trim();

const safeNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

async function fetchUsageLogs() {
  const { data, error } = await supabase
    .from('inventory_usage_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3000);

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
    .limit(3000);

  if (error) throw error;
  return data || [];
}

async function fetchDispatchFunds() {
  const { data, error } = await supabase
    .from('inventory_dispatch_fund_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3000);

  if (error) {
    console.warn('Dispatch fund analytics unavailable:', error);
    return [];
  }

  return data || [];
}

async function fetchTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3000);

  if (error) {
    console.warn('Ticket profitability analytics unavailable:', error);
    return [];
  }

  return data || [];
}

function getEngineerKey(row) {
  return (
    row.engineer_email ||
    row.engineer_name ||
    row.engineer_id ||
    row.assigned_engineer_email ||
    row.assigned_engineer ||
    row.fe_email ||
    row.fe_name ||
    'Unknown Engineer'
  );
}

function getEngineerName(row) {
  return (
    row.engineer_name ||
    row.assigned_engineer ||
    row.fe_name ||
    row.engineer_email ||
    row.assigned_engineer_email ||
    row.fe_email ||
    'Unknown Engineer'
  );
}

function getTerminalKey(row) {
  return (
    row.terminal_id ||
    row.terminal ||
    row.atm_id ||
    row.machine_id ||
    row.device_id ||
    row.site_id ||
    row.ticket_number ||
    'Unknown Terminal'
  );
}

function getTerminalName(row) {
  return (
    row.terminal_id ||
    row.terminal ||
    row.atm_id ||
    row.machine_id ||
    row.device_id ||
    'Unknown Terminal'
  );
}

function getBankName(row) {
  return row.bank_name || row.bank || row.client_name || row.customer_name || '';
}

function getBranchName(row) {
  return row.branch_name || row.branch || row.location || row.site_name || '';
}

function getTicketRevenue(ticket) {
  return safeNumber(
    ticket.revenue_ngn ??
      ticket.service_charge_ngn ??
      ticket.billing_amount_ngn ??
      ticket.amount_ngn ??
      ticket.total_amount_ngn ??
      DEFAULT_REVENUE_PER_JOB,
    DEFAULT_REVENUE_PER_JOB
  );
}

function getDispatchCost(row) {
  return safeNumber(
    row.approved_amount ??
      row.requested_amount ??
      row.disbursed_amount ??
      row.amount ??
      row.amount_ngn ??
      0,
    0
  );
}

function isDisbursed(row) {
  const status = normalize(row.status);
  const financeStatus = normalize(row.finance_status);

  return (
    status.includes('disbursed') ||
    financeStatus.includes('disbursed') ||
    status.includes('approved') ||
    financeStatus.includes('approved')
  );
}

function groupByEngineer(logs) {
  const map = new Map();

  logs.forEach((log) => {
    const key = getEngineerKey(log);

    if (!map.has(key)) {
      map.set(key, {
        engineer: getEngineerName(log),
        email: log.engineer_email || log.assigned_engineer_email || log.fe_email || '',
        totalQty: 0,
        totalCost: 0,
        requests: 0,
      });
    }

    const row = map.get(key);
    row.totalQty += safeNumber(log.quantity_used, 0);
    row.totalCost += safeNumber(log.total_cost_ngn, 0);
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
    row.totalQty += safeNumber(log.quantity_used, 0);
    row.totalCost += safeNumber(log.total_cost_ngn, 0);
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
      quantity: rows.reduce((sum, item) => sum + safeNumber(item.quantity_available, 0), 0),
      value: rows.reduce(
        (sum, item) =>
          sum + safeNumber(item.quantity_available, 0) * safeNumber(item.unit_price_ngn, 0),
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

function groupEngineerProfitability(logs, dispatchFunds, tickets) {
  const map = new Map();

  const ensure = (row) => {
    const key = getEngineerKey(row);

    if (!map.has(key)) {
      map.set(key, {
        engineer: getEngineerName(row),
        email: row.engineer_email || row.assigned_engineer_email || row.fe_email || '',
        jobs: 0,
        partsQty: 0,
        partsCost: 0,
        dispatchCost: 0,
        revenue: 0,
        totalCost: 0,
        profit: 0,
        margin: 0,
      });
    }

    return map.get(key);
  };

  logs.forEach((log) => {
    const row = ensure(log);
    row.partsQty += safeNumber(log.quantity_used, 0);
    row.partsCost += safeNumber(log.total_cost_ngn, 0);
  });

  dispatchFunds.filter(isDisbursed).forEach((fund) => {
    const row = ensure(fund);
    row.dispatchCost += getDispatchCost(fund);
  });

  tickets.forEach((ticket) => {
    const row = ensure(ticket);
    row.jobs += 1;
    row.revenue += getTicketRevenue(ticket);
  });

  return [...map.values()]
    .map((row) => {
      const totalCost = row.partsCost + row.dispatchCost;
      const profit = row.revenue - totalCost;
      const margin = row.revenue > 0 ? (profit / row.revenue) * 100 : 0;

      return {
        ...row,
        totalCost,
        profit,
        margin,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

function groupTerminalProfitability(logs, dispatchFunds, tickets) {
  const map = new Map();

  const ensure = (row) => {
    const key = getTerminalKey(row);

    if (!map.has(key)) {
      map.set(key, {
        terminal: getTerminalName(row),
        bank: getBankName(row),
        branch: getBranchName(row),
        visits: 0,
        partsQty: 0,
        partsCost: 0,
        dispatchCost: 0,
        revenue: 0,
        totalCost: 0,
        profit: 0,
        margin: 0,
      });
    }

    const existing = map.get(key);
    existing.bank = existing.bank || getBankName(row);
    existing.branch = existing.branch || getBranchName(row);
    return existing;
  };

  logs.forEach((log) => {
    const row = ensure(log);
    row.partsQty += safeNumber(log.quantity_used, 0);
    row.partsCost += safeNumber(log.total_cost_ngn, 0);
  });

  dispatchFunds.filter(isDisbursed).forEach((fund) => {
    const row = ensure(fund);
    row.dispatchCost += getDispatchCost(fund);
  });

  tickets.forEach((ticket) => {
    const row = ensure(ticket);
    row.visits += 1;
    row.revenue += getTicketRevenue(ticket);
  });

  return [...map.values()]
    .map((row) => {
      const totalCost = row.partsCost + row.dispatchCost;
      const profit = row.revenue - totalCost;
      const margin = row.revenue > 0 ? (profit / row.revenue) * 100 : 0;

      return {
        ...row,
        totalCost,
        profit,
        margin,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

function buildRiskAnalytics(engineerProfitRows, terminalProfitRows, partRows, serialRows) {
  const mostExpensiveEngineer = engineerProfitRows[0];
  const mostExpensiveTerminal = terminalProfitRows[0];
  const highestPartConsumer = partRows[0];
  const lossTerminal = terminalProfitRows
    .filter((row) => row.profit < 0)
    .sort((a, b) => a.profit - b.profit)[0];
  const rrSerials = serialRows.find((row) => normalize(row.status) === 'under_rr');
  const scrappedSerials = serialRows.find((row) => normalize(row.status) === 'scrapped');

  return [
    {
      title: 'Most Expensive Engineer',
      value: mostExpensiveEngineer?.engineer || 'No data yet',
      amount: mostExpensiveEngineer?.totalCost || 0,
      note: 'Parts + dispatch cost',
    },
    {
      title: 'Most Expensive Terminal',
      value: mostExpensiveTerminal?.terminal || 'No data yet',
      amount: mostExpensiveTerminal?.totalCost || 0,
      note: 'Parts + dispatch cost',
    },
    {
      title: 'Highest Parts Consumer',
      value: highestPartConsumer?.partName || 'No data yet',
      amount: highestPartConsumer?.totalCost || 0,
      note: `${highestPartConsumer?.totalQty || 0} qty used`,
    },
    {
      title: 'Loss-Making Terminal',
      value: lossTerminal?.terminal || 'No loss detected',
      amount: lossTerminal?.profit || 0,
      note: 'Negative profit after cost',
    },
    {
      title: 'Serials Under RR',
      value: `${rrSerials?.count || 0} unit(s)`,
      amount: 0,
      note: 'Physical parts currently in repair',
    },
    {
      title: 'Scrapped Serials',
      value: `${scrappedSerials?.count || 0} unit(s)`,
      amount: 0,
      note: 'Potential inventory loss',
    },
  ];
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

  const {
    data: dispatchFunds = [],
    isLoading: dispatchLoading,
    refetch: refetchDispatchFunds,
  } = useQuery({
    queryKey: ['inventory-dispatch-fund-analytics'],
    queryFn: fetchDispatchFunds,
  });

  const {
    data: tickets = [],
    isLoading: ticketsLoading,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ['ticket-profitability-analytics'],
    queryFn: fetchTickets,
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
          log.terminal_id,
          log.bank_name,
          log.branch_name,
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

  const filteredDispatchFunds = useMemo(() => {
    const q = normalize(search);

    return dispatchFunds.filter((fund) => {
      const matchSearch =
        !q ||
        [
          fund.engineer_name,
          fund.engineer_email,
          fund.ticket_number,
          fund.terminal_id,
          fund.bank_name,
          fund.branch_name,
          fund.destination,
          fund.reason,
        ]
          .filter(Boolean)
          .some((value) => normalize(value).includes(q));

      return matchSearch;
    });
  }, [dispatchFunds, search]);

  const filteredTickets = useMemo(() => {
    const q = normalize(search);

    return tickets.filter((ticket) => {
      const matchSearch =
        !q ||
        [
          ticket.ticket_number,
          ticket.terminal_id,
          ticket.bank_name,
          ticket.branch_name,
          ticket.location,
          ticket.engineer_name,
          ticket.engineer_email,
          ticket.assigned_engineer,
        ]
          .filter(Boolean)
          .some((value) => normalize(value).includes(q));

      return matchSearch;
    });
  }, [tickets, search]);

  const engineerRows = useMemo(() => groupByEngineer(filteredLogs), [filteredLogs]);
  const partRows = useMemo(() => groupByPart(filteredLogs), [filteredLogs]);
  const warehouseRows = useMemo(() => groupByWarehouse(filteredParts), [filteredParts]);
  const serialRows = useMemo(() => serialStatusSummary(serials), [serials]);

  const engineerProfitRows = useMemo(
    () => groupEngineerProfitability(filteredLogs, filteredDispatchFunds, filteredTickets),
    [filteredLogs, filteredDispatchFunds, filteredTickets]
  );

  const terminalProfitRows = useMemo(
    () => groupTerminalProfitability(filteredLogs, filteredDispatchFunds, filteredTickets),
    [filteredLogs, filteredDispatchFunds, filteredTickets]
  );

  const riskRows = useMemo(
    () => buildRiskAnalytics(engineerProfitRows, terminalProfitRows, partRows, serialRows),
    [engineerProfitRows, terminalProfitRows, partRows, serialRows]
  );

  const totalInventoryValue = filteredParts.reduce(
    (sum, item) =>
      sum + safeNumber(item.quantity_available, 0) * safeNumber(item.unit_price_ngn, 0),
    0
  );

  const lowStockCount = filteredParts.filter(
    (item) =>
      safeNumber(item.quantity_available, 0) > 0 &&
      safeNumber(item.quantity_available, 0) <= safeNumber(item.minimum_stock_level, 2)
  ).length;

  const outStockCount = filteredParts.filter(
    (item) => safeNumber(item.quantity_available, 0) === 0
  ).length;

  const totalUsedQty = filteredLogs.reduce((sum, log) => sum + safeNumber(log.quantity_used, 0), 0);
  const totalUsageCost = filteredLogs.reduce((sum, log) => sum + safeNumber(log.total_cost_ngn, 0), 0);
  const totalDispatchCost = filteredDispatchFunds
    .filter(isDisbursed)
    .reduce((sum, fund) => sum + getDispatchCost(fund), 0);
  const totalRevenue = filteredTickets.reduce((sum, ticket) => sum + getTicketRevenue(ticket), 0);
  const totalOperationalCost = totalUsageCost + totalDispatchCost;
  const estimatedProfit = totalRevenue - totalOperationalCost;
  const profitMargin = totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0;

  const refreshAll = () => {
    refetchUsage();
    refetchParts();
    refetchSerials();
    refetchDispatchFunds();
    refetchTickets();
  };

  const exportAnalytics = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(engineerRows), 'Engineer Usage');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partRows), 'Part Demand');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warehouseRows), 'Warehouse Value');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(serialRows), 'Serial Status');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(engineerProfitRows), 'Engineer Profitability');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(terminalProfitRows), 'Terminal Profitability');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riskRows), 'Loss Risk');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredDispatchFunds), 'Dispatch Funds');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredTickets), 'Tickets');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredLogs), 'Raw Usage Logs');

    XLSX.writeFile(wb, `ARK_Inventory_Profitability_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const loading = usageLoading || partsLoading || serialsLoading || dispatchLoading || ticketsLoading;

  return (
    <div className="space-y-5 pb-20 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <BarChart3 className="w-6 h-6 text-primary" />
            ARK ONE Inventory Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Stock value, engineer cost, terminal profitability, dispatch funds, fast moving parts and loss risk.
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

      <div className="rounded-xl border border-[#ff5a00]/20 bg-[#102969] p-4">
        <p className="text-sm text-[#ff5a00] font-semibold">
          Profitability note
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Profit cards become accurate when tickets, dispatch funds and inventory usage logs are created by the workflow.
          If revenue per ticket is not captured, profit will show cost analysis and estimated profit as ₦0 minus cost.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search engineer, terminal, bank, part, serial, ticket..."
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
            <p className="text-2xl font-bold text-[#ff5a00]">
              {lowStockCount} / {outStockCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Dispatch Cost</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{money(totalDispatchCost)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ticket Revenue</p>
            <p className="text-2xl font-bold text-[#ff5a00]">{money(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Est. Profit/Loss</p>
            <p className={`text-2xl font-bold ${estimatedProfit < 0 ? 'text-red-300' : 'text-[#ff5a00]'}`}>
              {money(estimatedProfit)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Profit Margin</p>
            <p className={`text-2xl font-bold ${profitMargin < 0 ? 'text-red-300' : 'text-[#ff5a00]'}`}>
              {profitMargin.toFixed(1)}%
            </p>
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
              Engineer Cost / Profitability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#ff5a00] uppercase border-b border-[#ff5a00]/20">
                  <tr>
                    <th className="text-left py-2">Engineer</th>
                    <th className="text-center py-2">Jobs</th>
                    <th className="text-right py-2">Parts</th>
                    <th className="text-right py-2">Dispatch</th>
                    <th className="text-right py-2">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engineerProfitRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No engineer profitability data yet
                      </td>
                    </tr>
                  )}
                  {engineerProfitRows.slice(0, 15).map((row) => (
                    <tr key={row.email || row.engineer}>
                      <td className="py-2">
                        <p className="font-medium">{row.engineer}</p>
                        {row.email && <p className="text-xs text-muted-foreground">{row.email}</p>}
                      </td>
                      <td className="py-2 text-center font-bold">{row.jobs}</td>
                      <td className="py-2 text-right">{money(row.partsCost)}</td>
                      <td className="py-2 text-right">{money(row.dispatchCost)}</td>
                      <td className={`py-2 text-right font-bold ${row.profit < 0 ? 'text-red-300' : 'text-green-300'}`}>
                        {money(row.profit)}
                      </td>
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
              <MapPin className="w-4 h-4 text-[#ff5a00]" />
              Terminal Cost / Profitability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#ff5a00] uppercase border-b border-[#ff5a00]/20">
                  <tr>
                    <th className="text-left py-2">Terminal</th>
                    <th className="text-center py-2">Visits</th>
                    <th className="text-right py-2">Parts</th>
                    <th className="text-right py-2">Dispatch</th>
                    <th className="text-right py-2">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {terminalProfitRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No terminal profitability data yet
                      </td>
                    </tr>
                  )}
                  {terminalProfitRows.slice(0, 15).map((row) => (
                    <tr key={`${row.terminal}-${row.bank}-${row.branch}`}>
                      <td className="py-2">
                        <p className="font-medium">{row.terminal}</p>
                        <p className="text-xs text-muted-foreground">
                          {[row.bank, row.branch].filter(Boolean).join(' · ') || 'No bank/branch'}
                        </p>
                      </td>
                      <td className="py-2 text-center font-bold">{row.visits}</td>
                      <td className="py-2 text-right">{money(row.partsCost)}</td>
                      <td className="py-2 text-right">{money(row.dispatchCost)}</td>
                      <td className={`py-2 text-right font-bold ${row.profit < 0 ? 'text-red-300' : 'text-green-300'}`}>
                        {money(row.profit)}
                      </td>
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
              <ShieldAlert className="w-4 h-4 text-[#ff5a00]" />
              Loss & Risk Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {riskRows.map((row) => (
                <div key={row.title} className="rounded-lg border border-[#ff5a00]/20 bg-[#08153d] p-3">
                  <p className="text-xs text-muted-foreground">{row.title}</p>
                  <p className="font-bold text-white mt-1 line-clamp-1">{row.value}</p>
                  {row.amount !== 0 && (
                    <p className={`text-lg font-black mt-1 ${row.amount < 0 ? 'text-red-300' : 'text-[#ff5a00]'}`}>
                      {money(row.amount)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{row.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#102969] border border-[#ff5a00]/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Banknote className="w-4 h-4 text-[#ff5a00]" />
              Dispatch Fund Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredDispatchFunds.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4" />
                  No dispatch fund records yet
                </div>
              )}
              {filteredDispatchFunds.slice(0, 12).map((fund) => (
                <div key={fund.id} className="flex items-center justify-between gap-3 border-b border-slate-800 py-2">
                  <div>
                    <p className="font-medium">
                      {fund.engineer_name || fund.engineer_email || 'Unknown Engineer'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fund.ticket_number || fund.terminal_id || fund.destination || 'No destination'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#ff5a00]">{money(getDispatchCost(fund))}</p>
                    <Badge variant="outline" className="border-[#ff5a00]/30 text-[#ff5a00]">
                      {fund.finance_status || fund.status || 'pending'}
                    </Badge>
                  </div>
                </div>
              ))}
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
