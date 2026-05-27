import { Package, AlertTriangle, TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react';

export default function InvStatsCards({ items }) {
  const total = items.length;
  const available = items.filter(i => (i.quantity_available || 0) > (i.minimum_stock_level || 2)).length;
  const low = items.filter(i => (i.quantity_available || 0) > 0 && (i.quantity_available || 0) <= (i.minimum_stock_level || 2)).length;
  const out = items.filter(i => (i.quantity_available || 0) === 0).length;
  const totalValue = items.reduce((s, i) => s + ((i.unit_price_ngn || 0) * (i.quantity_available || 0)), 0);
  const totalQty = items.reduce((s, i) => s + (i.quantity_available || 0), 0);

  const cards = [
    { label: 'Total Parts', value: total.toLocaleString(), icon: Package, color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    { label: 'Available', value: available.toLocaleString(), icon: TrendingUp, color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
    { label: 'Low Stock', value: low.toLocaleString(), icon: AlertTriangle, color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    { label: 'Out of Stock', value: out.toLocaleString(), icon: TrendingDown, color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
    { label: 'Total Units', value: totalQty.toLocaleString(), icon: BarChart3, color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
    { label: 'Stock Value (₦)', value: totalValue > 0 ? '₦' + (totalValue / 1_000_000).toFixed(1) + 'M' : '—', icon: DollarSign, color: 'bg-primary/10 text-primary' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-card border rounded-xl p-4 flex flex-col gap-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold leading-tight">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}