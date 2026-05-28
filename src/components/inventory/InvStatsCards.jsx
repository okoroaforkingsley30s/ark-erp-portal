import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
} from 'lucide-react';

export default function InvStatsCards({ items }) {
  const total = items.length;

  const available = items.filter(
    (i) => (i.quantity_available || 0) > (i.minimum_stock_level || 2)
  ).length;

  const low = items.filter(
    (i) =>
      (i.quantity_available || 0) > 0 &&
      (i.quantity_available || 0) <= (i.minimum_stock_level || 2)
  ).length;

  const out = items.filter((i) => (i.quantity_available || 0) === 0).length;

  const totalValue = items.reduce(
    (s, i) => s + (i.unit_price_ngn || 0) * (i.quantity_available || 0),
    0
  );

  const totalQty = items.reduce(
    (s, i) => s + (i.quantity_available || 0),
    0
  );

  const cards = [
    { label: 'Total Parts', value: total.toLocaleString(), icon: Package },
    { label: 'Available', value: available.toLocaleString(), icon: TrendingUp },
    { label: 'Low Stock', value: low.toLocaleString(), icon: AlertTriangle },
    { label: 'Out of Stock', value: out.toLocaleString(), icon: TrendingDown },
    { label: 'Total Units', value: totalQty.toLocaleString(), icon: BarChart3 },
    {
      label: 'Stock Value (₦)',
      value: totalValue > 0 ? '₦' + (totalValue / 1_000_000).toFixed(1) + 'M' : '—',
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;

        return (
          <div
            key={c.label}
            className="rounded-2xl border border-white/10 bg-[#102969]/80 p-4 shadow-[0_0_25px_rgba(0,0,0,0.22)]"
          >
            <div className="w-10 h-10 rounded-xl bg-[#ff5a00]/15 border border-[#ff5a00]/25 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-[#ff5a00]" />
            </div>

            <p className="text-2xl font-black text-white leading-tight">
              {c.value}
            </p>

            <p className="text-xs text-slate-300 mt-1">
              {c.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}