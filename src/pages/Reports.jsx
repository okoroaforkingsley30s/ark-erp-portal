import React from 'react';

import { useOutletContext } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

import StatCard from '@/components/dashboard/StatCard';

import {
  Ticket,
  Clock,
  CheckCircle2,
  Star,
} from 'lucide-react';

import ExportButton from '@/components/ExportButton';

import {
  format,
  subDays,
  differenceInHours,
  isSameDay,
} from 'date-fns';

const COLORS = [
  'hsl(43, 85%, 45%)',
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#8b5cf6',
  '#f97316',
];

async function fetchTickets() {
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
}

async function fetchUsers() {
  const { data, error } =
    await supabase
      .from('users')
      .select('*');

  if (error) throw error;

  return data || [];
}

export default function Reports() {
  useOutletContext();

  const {
    data: tickets = [],
  } = useQuery({
    queryKey: [
      'tickets-reports',
    ],

    queryFn: fetchTickets,
  });

  const {
    data: users = [],
  } = useQuery({
    queryKey: [
      'users-reports',
    ],

    queryFn: fetchUsers,
  });

  const resolvedTickets =
    tickets.filter(
      (t) => t.resolved_date
    );

  const avgResolutionHours =
    resolvedTickets.length > 0
      ? Math.round(
          resolvedTickets.reduce(
            (sum, t) =>
              sum +
              differenceInHours(
                new Date(
                  t.resolved_date
                ),
                new Date(
                  t.created_at
                )
              ),
            0
          ) /
            resolvedTickets.length
        )
      : 0;

  const ratedTickets =
    tickets.filter(
      (t) => t.rating
    );

  const avgRating =
    ratedTickets.length > 0
      ? (
          ratedTickets.reduce(
            (s, t) =>
              s + t.rating,
            0
          ) /
          ratedTickets.length
        ).toFixed(1)
      : 'N/A';

  // Category distribution
  const categoryData =
    Object.entries(
      tickets.reduce(
        (acc, t) => {
          const cat =
            t.category ||
            'uncategorized';

          acc[cat] =
            (acc[cat] || 0) + 1;

          return acc;
        },
        {}
      )
    ).map(([name, value]) => ({
      name: name
        .replace('_', ' ')
        .replace(
          /\b\w/g,
          (l) =>
            l.toUpperCase()
        ),

      value,
    }));

  // Priority distribution
  const priorityData = [
    'low',
    'medium',
    'high',
    'critical',
  ]
    .map((p) => ({
      name:
        p.charAt(0).toUpperCase() +
        p.slice(1),

      value:
        tickets.filter(
          (t) =>
            t.priority === p
        ).length,
    }))
    .filter((d) => d.value > 0);

  // Engineer performance
  const engineers =
    users.filter(
      (u) =>
        u.role === 'engineer'
    );

  const engineerPerf =
    engineers
      .map((eng) => {
        const engTickets =
          tickets.filter(
            (t) =>
              t.assigned_to ===
              eng.email
          );

        const resolved =
          engTickets.filter(
            (t) =>
              t.status ===
                'resolved' ||
              t.status ===
                'closed'
          );

        return {
          name:
            eng.full_name
              ?.split(' ')[0] ||
            eng.email,

          assigned:
            engTickets.length,

          resolved:
            resolved.length,
        };
      })
      .filter(
        (e) => e.assigned > 0
      );

  // Daily trend
  const dailyTrend =
    Array.from(
      { length: 14 },
      (_, i) => {
        const date =
          subDays(
            new Date(),
            13 - i
          );

        return {
          day: format(
            date,
            'MMM d'
          ),

          created:
            tickets.filter(
              (t) =>
                t.created_at &&
                isSameDay(
                  new Date(
                    t.created_at
                  ),
                  date
                )
            ).length,

          resolved:
            tickets.filter(
              (t) =>
                t.resolved_date &&
                isSameDay(
                  new Date(
                    t.resolved_date
                  ),
                  date
                )
            ).length,
        };
      }
    );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Reports & Analytics
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            Performance metrics and
            insights
          </p>
        </div>

        <ExportButton
          filename="ark-one-reports"
          label="Export Report"
          data={{
            Tickets:
              tickets.map((t) => ({
                ID: t.id,

                Title:
                  t.title || '',

                Status:
                  t.status || '',

                Priority:
                  t.priority || '',

                Category:
                  t.category || '',

                'Assigned To':
                  t.assigned_to ||
                  '',

                'Client Email':
                  t.client_email ||
                  '',

                'Created Date':
                  t.created_at
                    ? new Date(
                        t.created_at
                      ).toLocaleDateString()
                    : '',

                'Resolved Date':
                  t.resolved_date
                    ? new Date(
                        t.resolved_date
                      ).toLocaleDateString()
                    : '',

                'Resolution (hrs)':
                  t.resolved_date
                    ? Math.round(
                        (new Date(
                          t.resolved_date
                        ) -
                          new Date(
                            t.created_at
                          )) /
                          3600000
                      )
                    : '',

                Rating:
                  t.rating || '',
              })),

            'Daily Trend':
              dailyTrend.map(
                (d) => ({
                  Date: d.day,

                  Created:
                    d.created,

                  Resolved:
                    d.resolved,
                })
              ),

            'By Category':
              categoryData.map(
                (c) => ({
                  Category:
                    c.name,

                  Count:
                    c.value,
                })
              ),

            'By Priority':
              priorityData.map(
                (p) => ({
                  Priority:
                    p.name,

                  Count:
                    p.value,
                })
              ),

            'Engineer Performance':
              engineerPerf.map(
                (e) => ({
                  Engineer:
                    e.name,

                  Assigned:
                    e.assigned,

                  Resolved:
                    e.resolved,
                })
              ),
          }}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tickets"
          value={tickets.length}
          icon={Ticket}
        />

        <StatCard
          title="Avg Resolution"
          value={`${avgResolutionHours}h`}
          icon={Clock}
        />

        <StatCard
          title="Resolved"
          value={
            resolvedTickets.length
          }
          icon={CheckCircle2}
        />

        <StatCard
          title="Avg Rating"
          value={avgRating}
          icon={Star}
        />
      </div>

      {/* Ticket trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Ticket Trend (14
            Days)
          </CardTitle>
        </CardHeader>

        <CardContent>
          <ResponsiveContainer
            width="100%"
            height={280}
          >
            <LineChart
              data={dailyTrend}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />

              <XAxis
                dataKey="day"
                tick={{
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
                allowDecimals={
                  false
                }
              />

              <Tooltip />

              <Legend />

              <Line
                type="monotone"
                dataKey="created"
                stroke="hsl(43, 85%, 45%)"
                strokeWidth={2}
                name="Created"
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="resolved"
                stroke="#22c55e"
                strokeWidth={2}
                name="Resolved"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              By Category
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={240}
            >
              <PieChart>
                <Pie
                  data={
                    categoryData
                  }
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map(
                    (_, i) => (
                      <Cell
                        key={i}
                        fill={
                          COLORS[
                            i %
                              COLORS.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip />

                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    fontSize:
                      '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              By Priority
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={240}
            >
              <BarChart
                data={
                  priorityData
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />

                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: 12,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{
                    fontSize: 12,
                  }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={
                    false
                  }
                />

                <Tooltip />

                <Bar
                  dataKey="value"
                  fill="hsl(43, 85%, 45%)"
                  radius={[
                    4, 4, 0, 0,
                  ]}
                  name="Tickets"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Engineer performance */}
      {engineerPerf.length >
        0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Engineer
              Performance
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={280}
            >
              <BarChart
                data={
                  engineerPerf
                }
                layout="vertical"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="hsl(var(--border))"
                />

                <XAxis
                  type="number"
                  tick={{
                    fontSize: 12,
                  }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={
                    false
                  }
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{
                    fontSize: 12,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />

                <Tooltip />

                <Legend />

                <Bar
                  dataKey="assigned"
                  fill="hsl(43, 85%, 45%)"
                  name="Assigned"
                  radius={[
                    0, 4, 4, 0,
                  ]}
                />

                <Bar
                  dataKey="resolved"
                  fill="#22c55e"
                  name="Resolved"
                  radius={[
                    0, 4, 4, 0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
