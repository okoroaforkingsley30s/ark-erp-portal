import React from 'react';
import { Card } from '@/components/ui/card';
import { Package, AlertTriangle, XCircle, TrendingDown } from 'lucide-react';

const GROUPS = ['WINCOR', 'NCR_S1', 'NCR_S2', 'HYOSUNG', 'ENTRUST', 'EVOLIS', 'GENERAL_PRINTER_ACCESSORIES'];
const GROUP_LABELS = { WINCOR: 'Wincor', NCR_S1: 'NCR S1', NCR_S2: 'NCR S2', HYOSUNG: 'Hyosung', ENTRUST: 'Entrust', EVOLIS: 'Evolis', GENERAL_PRINTER_ACCESSORIES: 'General' };

export default function InventoryStatsBar({ items = [] }) {
  const totalValue = items.reduce((s, i) => s + (i.total_stock_value || 0), 0);
  const lowStock = items.filter(i => i.stock_status === 'LOW STOCK').length;
  const outOfStock = items.filter(i => i.stock_status === 'OUT OF STOCK').length;

  const groupCounts = GROUPS.reduce((acc, g) => {
    acc[g] = items.filter(i => i.category_group === g).length;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Stock Value</p>
          <p className="text-lg font-bold text-primary">₦{totalValue.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground mb-1">Total SKUs</p>
          <p className="text-lg font-bold">{items.length}</p>
        </Card>
        <Card className="p-3 border-amber-200">
          <p className="text-xs text-amber-700 mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Low Stock</p>
          <p className="text-lg font-bold text-amber-700">{lowStock}</p>
        </Card>
        <Card className="p-3 border-red-200">
          <p className="text-xs text-red-700 mb-1 flex items-center gap-1"><XCircle className="w-3 h-3" />Out of Stock</p>
          <p className="text-lg font-bold text-red-700">{outOfStock}</p>
        </Card>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {GROUPS.map(g => (
          <Card key={g} className="p-2 text-center">
            <p className="text-[10px] text-muted-foreground">{GROUP_LABELS[g]}</p>
            <p className="text-base font-bold">{groupCounts[g]}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}