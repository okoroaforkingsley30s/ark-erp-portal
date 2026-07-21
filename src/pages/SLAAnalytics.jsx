import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle,
  Zap,
  Activity,
  BarChart3,
  Ticket,
  Gauge,
  Users,
  Search,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

import {
  differenceInHours,
  differenceInMinutes,
  formatDistanceToNow,
  format,
  parseISO,
  isValid,
  startOfMonth,
} from 'date-fns';

const SLA_HOURS = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 72,
  standard: 24,
  premium: 8,
};

const CLOSED_STATUSES = [
  'closed',
  'resolved',
  'completed',
  'approved',
  'done',
];

const OPEN_EXCLUDED_STATUSES = [
  ...CLOSED_STATUSES,
  'cancelled',
  'canceled',
];

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const safeParse = (value) => {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
};

const ticketCreatedAt = (ticket) =>
  safeParse(ticket.created_at) ||
  safeParse(ticket.created_date) ||
  safeParse(ticket.opened_at) ||
  safeParse(ticket.reported_at);

const ticketClosedAt = (ticket) =>
  safeParse(ticket.resolved_at) ||
  safeParse(ticket.resolved_date) ||
  safeParse(ticket.closed_at) ||
  safeParse(ticket.closed_date) ||
  safeParse(ticket.approved_at) ||
  safeParse(ticket.completed_at);

const isClosedTicket = (ticket) =>
  CLOSED_STATUSES.includes(normalize(ticket.status)) ||
  CLOSED_STATUSES.includes(normalize(ticket.completion_status)) ||
  Boolean(ticketClosedAt(ticket));

const getSlaBudget = (ticket, created) => {
  const priority = normalize(ticket.priority || ticket.sla_level || 'medium');

  if (ticket.sla_deadline) {
    const deadline = safeParse(ticket.sla_deadline);
    if (deadline && created) {
      return Math.max(1, differenceInHours(deadline, created));
    }
  }

  return SLA_HOURS[priority] || 24;
};

const getRiskLevel = (ticket, historicalAvg) => {
  const now = new Date();
  const created = ticketCreatedAt(ticket);

  if (!created) {
    return {
      level: 'warning',
      pct: 0,
      hoursRemaining: 0,
      deadline: now,
      hoursOpen: 0,
      slaBudget: 24,
    };
  }

  const hoursOpen = Math.max(0, differenceInHours(now, created));
  const slaBudget = getSlaBudget(ticket, created);
  const deadline = ticket.sla_deadline
    ? safeParse(ticket.sla_deadline) || new Date(created.getTime() + slaBudget * 3600000)
    : new Date(created.getTime() + slaBudget * 3600000);

  const pctElapsed = slaBudget > 0 ? (hoursOpen / slaBudget) * 100 : 100;
  const hoursRemaining = differenceInHours(deadline, now);
  const avgHours = historicalAvg || slaBudget;
  const predictedBreachHours = avgHours - hoursOpen;

  if (hoursRemaining <= 0 || pctElapsed >= 100) {
    return {
      level: 'breached',
      pct: 100,
      hoursRemaining: 0,
      deadline,
      hoursOpen,
      slaBudget,
    };
  }

  if (pctElapsed >= 80 || hoursRemaining <= 2) {
    return {
      level: 'critical',
      pct: pctElapsed,
      hoursRemaining,
      deadline,
      hoursOpen,
      slaBudget,
    };
  }

  if (pctElapsed >= 60 || (predictedBreachHours < 2 && predictedBreachHours >= 0)) {
    return {
      level: 'warning',
      pct: pctElapsed,
      hoursRemaining,
      deadline,
      hoursOpen,
      slaBudget,
    };
  }

  return {
    level: 'safe',
    pct: pctElapsed,
    hoursRemaining,
    deadline,
    hoursOpen,
    slaBudget,
  };
};

const RISK_CONFIG = {
  breached: {
    label: 'Breached',
    color: 'bg-red-600 text-white border-red-500',
    soft: 'bg-red-500/15 text-red-300 border-red-500/30',
    bar: 'bg-red-600',
  },
  critical: {
    label: 'Critical',
    color: 'bg-orange-500 text-white border-orange-500',
    soft: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    bar: 'bg-orange-500',
  },
  warning: {
    label: 'At Risk',
    color: 'bg-yellow-500 text-white border-yellow-500',
    soft: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    bar: 'bg-yellow-400',
  },
  safe: {
    label: 'On Track',
    color: 'bg-green-600 text-white border-green-500',
    soft: 'bg-green-500/15 text-green-300 border-green-500/30',
    bar: 'bg-green-500',
  },
};

function SLABar({ pct, level }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.warning;

  return (
    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
      <div
        className={`${cfg.bar} h-2 rounded-full transition-all`}
        style={{ width: `${Math.min(Math.max(pct || 0, 0), 100)}%` }}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, className = '' }) {
  return (
    <Card className={`border-white/10 bg-[#102969]/90 text-white ${className}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#ff5a00]" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-slate-300">{title}</p>
          {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ title, description, data, labelKey, valueKey, suffix = '' }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey] || 0)));

  return (
    <Card className="border-white/10 bg-[#102969]/90 text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <BarChart3 className="w-4 h-4 text-[#ff5a00]" />
          {title}
        </CardTitle>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No data yet</p>
        ) : (
          data.map((item) => {
            const value = Number(item[valueKey] || 0);
            const width = `${Math.max(4, (value / max) * 100)}%`;

            return (
              <div key={item[labelKey]} className="space-y-1">
                <div className="flex justify-between gap-3 text-xs">
                  <span className="truncate text-slate-200">{item[labelKey] || 'Unknown'}</span>
                  <span className="font-semibold text-white">{value}{suffix}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-[#ff5a00]" style={{ width }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function DonutLikeSummary({ summary }) {
  const total = Math.max(1, summary.totalOpen);
  const items = [
    ['breached', summary.breached],
    ['critical', summary.critical],
    ['warning', summary.warning],
    ['safe', summary.safe],
  ];

  return (
    <Card className="border-white/10 bg-[#102969]/90 text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <Gauge className="w-4 h-4 text-[#ff5a00]" />
          SLA risk distribution
        </CardTitle>
        <p className="text-xs text-slate-400">Live risk classification for currently open tickets.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(([key, value]) => {
          const cfg = RISK_CONFIG[key];
          const pct = Math.round((value / total) * 100);

          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-200">{cfg.label}</span>
                <span className="font-semibold">{value} · {pct}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`${cfg.bar} h-full rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function SLAAnalytics() {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [bankFilter, setBankFilter] = useState('all');

  const {
    data: allTickets = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['tickets-sla-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: engineerStatuses = [] } = useQuery({
    queryKey: ['engineer-statuses-sla'],
    queryFn: async () => {
      const { data, error } = await supabase.from('engineer_statuses').select('*');
      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    },
  });

  const analytics = useMemo(() => {
    const closed = allTickets.filter(isClosedTicket);
    const open = allTickets.filter((ticket) => !OPEN_EXCLUDED_STATUSES.includes(normalize(ticket.status)) && !isClosedTicket(ticket));

    const historicalBuckets = {};
    const engineerMap = {};
    const bankMap = {};
    const branchMap = {};
    const monthlyMap = {};
    const priorityMap = {};

    allTickets.forEach((ticket) => {
      const created = ticketCreatedAt(ticket);
      if (created) {
        const month = format(startOfMonth(created), 'MMM yyyy');
        monthlyMap[month] = (monthlyMap[month] || 0) + 1;
      }

      const priority = normalize(ticket.priority || 'medium');
      priorityMap[priority] = (priorityMap[priority] || 0) + 1;
    });

    closed.forEach((ticket) => {
      const created = ticketCreatedAt(ticket);
      const closedAt = ticketClosedAt(ticket);
      if (!created || !closedAt) return;

      const hours = Math.max(0, differenceInMinutes(closedAt, created) / 60);
      const histKey = `${normalize(ticket.category || 'general')}-${normalize(ticket.priority || 'medium')}`;
      if (!historicalBuckets[histKey]) historicalBuckets[histKey] = [];
      historicalBuckets[histKey].push(hours);

      const engineerEmail = ticket.assigned_to || ticket.assigned_engineer_email || ticket.completed_by;
      if (engineerEmail) {
        if (!engineerMap[engineerEmail]) {
          engineerMap[engineerEmail] = {
            email: engineerEmail,
            name: ticket.assigned_to_name || ticket.completed_by || engineerEmail,
            resolved: 0,
            totalHours: 0,
            breaches: 0,
          };
        }
        engineerMap[engineerEmail].resolved += 1;
        engineerMap[engineerEmail].totalHours += hours;

        const budget = getSlaBudget(ticket, created);
        if (hours > budget) engineerMap[engineerEmail].breaches += 1;
      }
    });

    const historicalAvg = Object.fromEntries(
      Object.entries(historicalBuckets).map(([key, values]) => [
        key,
        values.reduce((sum, value) => sum + value, 0) / values.length,
      ])
    );

    const engineerLoad = {};
    open.forEach((ticket) => {
      const engineerEmail = ticket.assigned_to || ticket.assigned_engineer_email;
      if (engineerEmail) engineerLoad[engineerEmail] = (engineerLoad[engineerEmail] || 0) + 1;
    });

    const enriched = open
      .map((ticket) => {
        const histKey = `${normalize(ticket.category || 'general')}-${normalize(ticket.priority || 'medium')}`;
        const risk = getRiskLevel(ticket, historicalAvg[histKey]);
        const engineerEmail = ticket.assigned_to || ticket.assigned_engineer_email;
        const currentLoad = engineerLoad[engineerEmail] || 0;

        return {
          ...ticket,
          risk,
          engineerEmail,
          currentLoad,
        };
      })
      .sort((a, b) => {
        const order = { breached: 0, critical: 1, warning: 2, safe: 3 };
        return order[a.risk.level] - order[b.risk.level];
      });

    enriched.forEach((ticket) => {
      const riskBad = ['breached', 'critical', 'warning'].includes(ticket.risk.level);
      const bank = ticket.bank_name || ticket.client_name || 'Unknown bank';
      const branch = ticket.branch_name || ticket.branch || ticket.device_location || 'Unknown branch';

      if (!bankMap[bank]) bankMap[bank] = { name: bank, total: 0, atRisk: 0, breached: 0 };
      bankMap[bank].total += 1;
      if (riskBad) bankMap[bank].atRisk += 1;
      if (ticket.risk.level === 'breached') bankMap[bank].breached += 1;

      const branchKey = `${bank} · ${branch}`;
      if (!branchMap[branchKey]) branchMap[branchKey] = { name: branchKey, total: 0, atRisk: 0, breached: 0 };
      branchMap[branchKey].total += 1;
      if (riskBad) branchMap[branchKey].atRisk += 1;
      if (ticket.risk.level === 'breached') branchMap[branchKey].breached += 1;
    });

    const summary = {
      totalTickets: allTickets.length,
      totalOpen: enriched.length,
      totalClosed: closed.length,
      breached: enriched.filter((ticket) => ticket.risk.level === 'breached').length,
      critical: enriched.filter((ticket) => ticket.risk.level === 'critical').length,
      warning: enriched.filter((ticket) => ticket.risk.level === 'warning').length,
      safe: enriched.filter((ticket) => ticket.risk.level === 'safe').length,
    };

    const complianceBase = summary.totalOpen || 1;
    summary.compliancePct = Math.round((summary.safe / complianceBase) * 100);

    const closedWithTimes = closed
      .map((ticket) => {
        const created = ticketCreatedAt(ticket);
        const closedAt = ticketClosedAt(ticket);
        if (!created || !closedAt) return null;
        return differenceInMinutes(closedAt, created) / 60;
      })
      .filter((value) => Number.isFinite(value));

    summary.avgResolutionHours = closedWithTimes.length
      ? closedWithTimes.reduce((sum, value) => sum + value, 0) / closedWithTimes.length
      : 0;

    const engineerRankings = Object.values(engineerMap)
      .map((engineer) => ({
        ...engineer,
        avgHours: engineer.resolved ? engineer.totalHours / engineer.resolved : 0,
        compliance: engineer.resolved ? Math.round(((engineer.resolved - engineer.breaches) / engineer.resolved) * 100) : 0,
        currentLoad: engineerLoad[engineer.email] || 0,
        online: engineerStatuses.some((s) => s.engineer_email === engineer.email && ['online', 'available', 'active'].includes(normalize(s.status))),
      }))
      .sort((a, b) => b.compliance - a.compliance || a.avgHours - b.avgHours)
      .slice(0, 8);

    const bankRankings = Object.values(bankMap)
      .map((item) => ({ ...item, riskRate: item.total ? Math.round((item.atRisk / item.total) * 100) : 0 }))
      .sort((a, b) => b.atRisk - a.atRisk || b.riskRate - a.riskRate)
      .slice(0, 8);

    const branchRankings = Object.values(branchMap)
      .map((item) => ({ ...item, riskRate: item.total ? Math.round((item.atRisk / item.total) * 100) : 0 }))
      .sort((a, b) => b.atRisk - a.atRisk || b.riskRate - a.riskRate)
      .slice(0, 8);

    const monthlyTrend = Object.entries(monthlyMap)
      .map(([month, count]) => ({ month, count }))
      .slice(-8);

    const priorityDistribution = Object.entries(priorityMap)
      .map(([priority, count]) => ({ priority, count }))
      .sort((a, b) => b.count - a.count);

    return {
      enriched,
      summary,
      engineerRankings,
      bankRankings,
      branchRankings,
      monthlyTrend,
      priorityDistribution,
    };
  }, [allTickets, engineerStatuses]);

  const banks = useMemo(
    () => [...new Set(allTickets.map((ticket) => ticket.bank_name || ticket.client_name).filter(Boolean))].sort(),
    [allTickets]
  );

  const filteredRiskTickets = useMemo(() => {
    const q = search.toLowerCase();

    return analytics.enriched.filter((ticket) => {
      if (riskFilter !== 'all' && ticket.risk.level !== riskFilter) return false;
      if (priorityFilter !== 'all' && normalize(ticket.priority) !== priorityFilter) return false;
      if (bankFilter !== 'all' && (ticket.bank_name || ticket.client_name) !== bankFilter) return false;

      if (!q) return true;

      return [
        ticket.ticket_number,
        ticket.ticket_id,
        ticket.title,
        ticket.bank_name,
        ticket.branch_name,
        ticket.terminal_id,
        ticket.assigned_to_name,
        ticket.assigned_to,
        ticket.assigned_engineer_email,
      ]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [analytics.enriched, riskFilter, priorityFilter, bankFilter, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const { summary } = analytics;
  const worstBank = analytics.bankRankings[0];
  const worstBranch = analytics.branchRankings[0];
  const bestEngineer = analytics.engineerRankings[0];

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Activity className="w-6 h-6 text-[#ff5a00]" />
            Predictive SLA Analytics
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Real-time breach risk, engineer performance, bank/branch trends and resolution intelligence.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard title="Total Tickets" value={summary.totalTickets} icon={Ticket} />
        <StatCard title="Open Tickets" value={summary.totalOpen} icon={Clock} />
        <StatCard title="Resolved" value={summary.totalClosed} icon={CheckCircle} />
        <StatCard title="SLA Compliance" value={`${summary.compliancePct}%`} icon={Gauge} />
        <StatCard title="Breached" value={summary.breached} icon={AlertTriangle} />
        <StatCard title="Avg Resolution" value={`${summary.avgResolutionHours.toFixed(1)}h`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'breached', value: summary.breached, icon: AlertTriangle },
          { key: 'critical', value: summary.critical, icon: Zap },
          { key: 'warning', value: summary.warning, icon: Clock },
          { key: 'safe', value: summary.safe, icon: CheckCircle },
        ].map(({ key, value, icon: Icon }) => {
          const cfg = RISK_CONFIG[key];
          return (
            <Card key={key} className={`border ${cfg.soft} bg-[#102969]/90`}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="w-8 h-8" />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-slate-300">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <DonutLikeSummary summary={summary} />
        <SimpleBarChart
          title="Tickets by priority"
          description="Current ticket mix by priority level."
          data={analytics.priorityDistribution}
          labelKey="priority"
          valueKey="count"
        />
        <SimpleBarChart
          title="Monthly ticket trend"
          description="Ticket creation trend across recent months."
          data={analytics.monthlyTrend}
          labelKey="month"
          valueKey="count"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <SimpleBarChart
          title="Bank SLA risk ranking"
          description="Banks ranked by active SLA risk."
          data={analytics.bankRankings}
          labelKey="name"
          valueKey="atRisk"
        />
        <SimpleBarChart
          title="Branch SLA risk ranking"
          description="Branches/sites with highest current risk."
          data={analytics.branchRankings}
          labelKey="name"
          valueKey="atRisk"
        />

        <Card className="border-white/10 bg-[#102969]/90 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Zap className="w-4 h-4 text-[#ff5a00]" />
              Smart recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>
              {worstBank
                ? `${worstBank.name} currently has the highest SLA risk with ${worstBank.atRisk} at-risk ticket(s).`
                : 'No bank-level SLA risk detected yet.'}
            </p>
            <p>
              {worstBranch
                ? `${worstBranch.name} should be prioritized because it has ${worstBranch.atRisk} active risk ticket(s).`
                : 'No branch-level SLA risk detected yet.'}
            </p>
            <p>
              {bestEngineer
                ? `${bestEngineer.name} is currently leading engineer performance with ${bestEngineer.compliance}% SLA compliance.`
                : 'Engineer SLA ranking will appear when resolved ticket history is available.'}
            </p>
            <p>
              Average historical resolution time is {summary.avgResolutionHours.toFixed(1)} hours across closed tickets.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-white/10 bg-[#102969]/90 text-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Users className="w-4 h-4 text-[#ff5a00]" />
              Engineer SLA performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.engineerRankings.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No resolved engineer history yet.</p>
            ) : (
              analytics.engineerRankings.map((engineer, index) => (
                <div key={engineer.email} className="rounded-2xl border border-white/10 bg-[#0b1f5e] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        #{index + 1} {engineer.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{engineer.email}</p>
                    </div>
                    <Badge variant="outline" className="bg-green-500/15 text-green-300 border-green-500/30">
                      {engineer.compliance}% SLA
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
                    <div className="rounded-lg bg-slate-900 p-2">
                      <p className="font-bold">{engineer.resolved}</p>
                      <p className="text-slate-400">Resolved</p>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-2">
                      <p className="font-bold">{engineer.avgHours.toFixed(1)}h</p>
                      <p className="text-slate-400">Avg time</p>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-2">
                      <p className="font-bold">{engineer.currentLoad}</p>
                      <p className="text-slate-400">Open load</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#102969]/90 text-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <AlertTriangle className="w-4 h-4 text-[#ff5a00]" />
              Top risky tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-4 gap-2">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 bg-[#0b1f5e] border-white/10"
                  placeholder="Search ticket, bank, branch, engineer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="bg-[#0b1f5e] border-white/10">
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risks</SelectItem>
                  <SelectItem value="breached">Breached</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">At risk</SelectItem>
                  <SelectItem value="safe">On track</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="bg-[#0b1f5e] border-white/10">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={bankFilter} onValueChange={setBankFilter}>
              <SelectTrigger className="bg-[#0b1f5e] border-white/10">
                <SelectValue placeholder="Bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All banks</SelectItem>
                {banks.map((bank) => (
                  <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredRiskTickets.slice(0, 30).map((ticket) => {
                const cfg = RISK_CONFIG[ticket.risk.level] || RISK_CONFIG.warning;
                const created = ticketCreatedAt(ticket);

                return (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    className="block rounded-2xl border border-white/10 bg-[#0b1f5e] p-3 hover:border-[#ff5a00]/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                          {ticket.ticket_number || ticket.ticket_id || ticket.id}
                        </p>
                        <p className="font-semibold truncate">
                          {ticket.title || ticket.category || 'Ticket'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {ticket.bank_name || ticket.client_name || 'Bank'} · {ticket.branch_name || ticket.branch || 'Branch'}
                        </p>
                      </div>
                      <Badge variant="outline" className={cfg.soft}>
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{created ? `Opened ${formatDistanceToNow(created)} ago` : 'No created date'}</span>
                        <span>{Math.round(ticket.risk.pct)}%</span>
                      </div>
                      <SLABar pct={ticket.risk.pct} level={ticket.risk.level} />
                    </div>

                    <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                      <span>{ticket.assigned_to_name || ticket.assigned_to || ticket.assigned_engineer_email || 'Unassigned'}</span>
                      <span className="inline-flex items-center gap-1 text-[#ff5a00]">
                        Open <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}

              {filteredRiskTickets.length === 0 && (
                <p className="text-sm text-slate-400 py-8 text-center">No matching SLA tickets.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
