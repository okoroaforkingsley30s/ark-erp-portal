import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

const COLORS = {
  new: '#38bdf8',
  assigned: '#a78bfa',
  in_progress: '#ff5a00',
  pending: '#f59e0b',
  resolved: '#22c55e',
  closed: '#94a3b8',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const item = payload[0];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#08153d]/95 px-4 py-3 shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-sm font-semibold text-white">
        {item.name}
      </p>
      <p className="text-xs text-slate-300">
        Tickets: <span className="text-[#ff5a00] font-bold">{item.value}</span>
      </p>
    </div>
  );
};

export default function TicketStatusChart({ tickets }) {
  const statusCounts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value,
    color: COLORS[name] || '#94a3b8',
  }));

  if (data.length === 0) return null;

  return (
    <Card className="border-white/10 bg-[#102969]/90">
      <CardHeader className="pb-2">
        <CardTitle>Ticket Status Distribution</CardTitle>
        <CardDescription>
          Live overview of ticket movement by current status.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              stroke="#102969"
              strokeWidth={3}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>

            <Tooltip content={<CustomTooltip />} />

            <Legend
              iconType="circle"
              wrapperStyle={{
                fontSize: '12px',
                color: '#cbd5e1',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}