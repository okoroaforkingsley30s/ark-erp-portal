import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#08153d]/95 px-4 py-3 shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="text-xs text-slate-300">
        Tickets: <span className="text-[#ff5a00] font-bold">{payload[0].value}</span>
      </p>
    </div>
  );
};

export default function TicketTrendChart({ tickets }) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);

    const count = tickets.filter((t) =>
      isSameDay(new Date(t.created_date || t.created_at), date)
    ).length;

    return {
      day: format(date, 'EEE'),
      count,
    };
  });

  return (
    <Card className="border-white/10 bg-[#102969]/90">
      <CardHeader className="pb-2">
        <CardTitle>Tickets This Week</CardTitle>
        <CardDescription>
          Daily ticket activity for the last seven days.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={last7Days}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.08)"
            />

            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: '#cbd5e1' }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tick={{ fontSize: 12, fill: '#cbd5e1' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Bar
              dataKey="count"
              fill="#ff5a00"
              radius={[10, 10, 0, 0]}
              name="Tickets"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}