import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import {
  AlertTriangle,
  Clock,
  User,
  TrendingUp,
  CheckCircle,
  Zap,
  Activity,
} from 'lucide-react';

import {
  formatDistanceToNow,
  differenceInHours,
  parseISO,
  isValid,
} from 'date-fns';

const SLA_HOURS = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 72,
};

const safeParse = (value) => {
  if (!value) return null;

  const d = parseISO(value);

  return isValid(d) ? d : null;
};

function getRiskLevel(ticket, historicalAvg) {

  const now = new Date();

  const created =
    safeParse(ticket.created_at) ||
    safeParse(ticket.created_date);

  if (!created) {
    return {
      level: 'warning',
      pct: 0,
      hoursRemaining: 0,
      deadline: now,
    };
  }

  const hoursOpen =
    differenceInHours(now, created);

  const slaBudget =
    ticket.sla_deadline
      ? differenceInHours(
          safeParse(ticket.sla_deadline),
          created
        )
      : SLA_HOURS[ticket.priority] || 24;

  const deadline =
    ticket.sla_deadline
      ? safeParse(ticket.sla_deadline)
      : new Date(
          created.getTime() +
          slaBudget * 3600000
        );

  const pctElapsed =
    (hoursOpen / slaBudget) * 100;

  const hoursRemaining =
    differenceInHours(deadline, now);

  const avgHours =
    historicalAvg || slaBudget;

  const predictedBreachHours =
    avgHours - hoursOpen;

  if (hoursRemaining <= 0) {
    return {
      level: 'breached',
      pct: 100,
      hoursRemaining: 0,
      deadline,
    };
  }

  if (
    pctElapsed >= 80 ||
    hoursRemaining <= 2
  ) {
    return {
      level: 'critical',
      pct: pctElapsed,
      hoursRemaining,
      deadline,
    };
  }

  if (
    pctElapsed >= 60 ||
    (
      predictedBreachHours < 2 &&
      predictedBreachHours >= 0
    )
  ) {
    return {
      level: 'warning',
      pct: pctElapsed,
      hoursRemaining,
      deadline,
    };
  }

  return {
    level: 'safe',
    pct: pctElapsed,
    hoursRemaining,
    deadline,
  };
}

const RISK_CONFIG = {
  breached: {
    label: 'BREACHED',
    color: 'bg-red-600 text-white',
    bar: 'bg-red-600',
    ring: 'border-red-400',
  },

  critical: {
    label: 'CRITICAL',
    color: 'bg-orange-500 text-white',
    bar: 'bg-orange-500',
    ring: 'border-orange-400',
  },

  warning: {
    label: 'AT RISK',
    color: 'bg-yellow-500 text-black',
    bar: 'bg-yellow-400',
    ring: 'border-yellow-400',
  },

  safe: {
    label: 'ON TRACK',
    color: 'bg-green-600 text-white',
    bar: 'bg-green-500',
    ring: 'border-green-300',
  },
};

function SLABar({ pct, level }) {

  const cfg = RISK_CONFIG[level];

  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`${cfg.bar} h-2 rounded-full transition-all`}
        style={{
          width: `${Math.min(pct, 100)}%`,
        }}
      />
    </div>
  );
}

export default function SLAAnalytics() {

  const {
    data: allTickets = [],
    isLoading,
  } = useQuery({

    queryKey: ['tickets-sla-analytics'],

    queryFn: async () => {

      const { data, error } =
        await supabase
          .from('tickets')
          .select('*')
          .order('created_at', {
            ascending: false,
          })
          .limit(500);

      if (error) throw error;

      return data || [];
    },

    refetchInterval: 60000,
  });

  const {
    data: engineerStatuses = [],
  } = useQuery({

    queryKey: ['engineer-statuses-sla'],

    queryFn: async () => {

      const { data, error } =
        await supabase
          .from('engineer_statuses')
          .select('*');

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const analytics = useMemo(() => {

    const resolved = allTickets.filter(
      t =>
        ['resolved', 'closed'].includes(t.status) &&
        (t.resolved_at || t.resolved_date)
    );

    const open = allTickets.filter(
      t =>
        !['resolved', 'closed'].includes(t.status)
    );

    const histMap = {};

    const engineerMap = {};

    resolved.forEach(t => {

      const key =
        `${t.category}-${t.priority}`;

      const created =
        safeParse(t.created_at) ||
        safeParse(t.created_date);

      const resolvedDate =
        safeParse(t.resolved_at) ||
        safeParse(t.resolved_date);

      if (!created || !resolvedDate)
        return;

      const hrs =
        differenceInHours(
          resolvedDate,
          created
        );

      if (!histMap[key])
        histMap[key] = [];

      histMap[key].push(hrs);

      if (t.assigned_to) {

        if (!engineerMap[t.assigned_to]) {

          engineerMap[t.assigned_to] = {
            times: [],
            name:
              t.assigned_to_name ||
              t.assigned_to,
          };
        }

        engineerMap[t.assigned_to]
          .times.push(hrs);
      }
    });

    const histAvg =
      Object.fromEntries(
        Object.entries(histMap)
          .map(([k, v]) => [
            k,
            v.reduce((a, b) => a + b, 0) / v.length
          ])
      );

    const engineerAvg =
      Object.fromEntries(
        Object.entries(engineerMap)
          .map(([email, d]) => [
            email,
            {
              name: d.name,
              avg:
                d.times.reduce((a, b) => a + b, 0) /
                d.times.length,
              count: d.times.length,
            }
          ])
      );

    const engineerLoad = {};

    open.forEach(t => {

      if (t.assigned_to) {

        engineerLoad[t.assigned_to] =
          (engineerLoad[t.assigned_to] || 0) + 1;
      }
    });

    const enriched = open
      .map(t => {

        const histKey =
          `${t.category}-${t.priority}`;

        const avgHrs =
          histAvg[histKey];

        const risk =
          getRiskLevel(t, avgHrs);

        const currentLoad =
          engineerLoad[t.assigned_to] || 0;

        const alternatives =
          Object.entries(engineerAvg)

            .filter(
              ([email]) =>
                email !== t.assigned_to
            )

            .map(([email, d]) => ({
              email,
              ...d,
              load:
                engineerLoad[email] || 0,
            }))

            .filter(
              e =>
                e.load < currentLoad ||
                e.avg <
                (engineerAvg[t.assigned_to]?.avg || 9999)
            )

            .sort(
              (a, b) =>
                (a.load * 10 + a.avg) -
                (b.load * 10 + b.avg)
            )

            .slice(0, 2);

        return {
          ...t,
          risk,
          avgHrs,
          currentLoad,
          alternatives,
        };
      })

      .sort((a, b) => {

        const order = {
          breached: 0,
          critical: 1,
          warning: 2,
          safe: 3,
        };

        return (
          order[a.risk.level] -
          order[b.risk.level]
        );
      });

    const summary = {
      breached:
        enriched.filter(
          t => t.risk.level === 'breached'
        ).length,

      critical:
        enriched.filter(
          t => t.risk.level === 'critical'
        ).length,

      warning:
        enriched.filter(
          t => t.risk.level === 'warning'
        ).length,

      safe:
        enriched.filter(
          t => t.risk.level === 'safe'
        ).length,

      total:
        enriched.length,
    };

    return {
      enriched,
      summary,
      engineerAvg,
      engineerLoad,
      histAvg,
    };

  }, [allTickets, engineerStatuses]);

  if (isLoading) {

    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const {
    enriched,
    summary,
    engineerAvg,
    engineerLoad,
    histAvg,
  } = analytics;

  const alertTickets =
    enriched.filter(
      t =>
        ['breached', 'critical', 'warning']
          .includes(t.risk.level)
    );

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between flex-wrap gap-2">

        <div>

          <h1 className="text-2xl font-bold flex items-center gap-2">

            <Activity className="w-6 h-6 text-primary" />

            Predictive SLA Analytics
          </h1>

          <p className="text-muted-foreground text-sm mt-1">

            Real-time breach risk prediction based on historical resolution data
          </p>
        </div>

        <Badge variant="outline" className="text-xs gap-1">

          <Clock className="w-3 h-3" />

          Auto-refreshes every 60s
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {[
          {
            label: 'Breached',
            value: summary.breached,
            icon: AlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-50 border-red-200',
          },

          {
            label: 'Critical Risk',
            value: summary.critical,
            icon: Zap,
            color: 'text-orange-600',
            bg: 'bg-orange-50 border-orange-200',
          },

          {
            label: 'At Risk',
            value: summary.warning,
            icon: Clock,
            color: 'text-yellow-700',
            bg: 'bg-yellow-50 border-yellow-200',
          },

          {
            label: 'On Track',
            value: summary.safe,
            icon: CheckCircle,
            color: 'text-green-700',
            bg: 'bg-green-50 border-green-200',
          },

        ].map(({
          label,
          value,
          icon: Icon,
          color,
          bg
        }) => (

          <Card
            key={label}
            className={`border ${bg}`}
          >

            <CardContent className="p-4 flex items-center gap-3">

              <Icon className={`w-8 h-8 ${color}`} />

              <div>

                <p className="text-2xl font-bold">
                  {value}
                </p>

                <p className="text-xs text-muted-foreground">
                  {label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}