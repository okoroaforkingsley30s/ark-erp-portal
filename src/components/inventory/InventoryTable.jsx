import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Pencil,
  Trash2,
  Plus
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_STYLE = {
  'AVAILABLE':
    'bg-green-50 text-green-700 border-green-200',

  'LOW STOCK':
    'bg-amber-50 text-amber-700 border-amber-200',

  'OUT OF STOCK':
    'bg-red-50 text-red-700 border-red-200',
};

export default function InventoryTable({
  items = [],
  canManage,
  isEngineer,
  onEdit,
  onRequestPart
}) {

  const qc = useQueryClient();

  const deleteItem = async item => {

    const confirmed = window.confirm(
      `Delete "${item.description}" ?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', item.id);

    if (error) {
      alert(error.message);
      return;
    }

    qc.invalidateQueries({
      queryKey: ['inventory-items']
    });
  };

  if (!items.length) {

    return (
      <div className="text-center py-12 text-muted-foreground">

        <p className="text-sm">
          No items in this category.
        </p>

        {canManage && (
          <p className="text-xs mt-1">
            Click "Add Part" to add inventory.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">

      <table className="w-full text-sm">

        <thead>

          <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">

            <th className="text-left px-3 py-2.5 font-medium">
              Part Number
            </th>

            <th className="text-left px-3 py-2.5 font-medium">
              Description
            </th>

            <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">
              Model
            </th>

            <th className="text-right px-3 py-2.5 font-medium">
              Qty
            </th>

            <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">
              USD $
            </th>

            <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">
              NGN ₦
            </th>

            <th className="text-right px-3 py-2.5 font-medium hidden lg:table-cell">
              Stock Value
            </th>

            <th className="text-center px-3 py-2.5 font-medium">
              Status
            </th>

            <th className="text-center px-3 py-2.5 font-medium hidden md:table-cell">
              Vendor
            </th>

            <th className="px-3 py-2.5"></th>
          </tr>
        </thead>

        <tbody className="divide-y">

          {items.map(item => (

            <tr
              key={item.id}
              className="hover:bg-muted/20 transition-colors"
            >

              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">

                {item.part_number || '—'}
              </td>

              <td className="px-3 py-2.5 font-medium max-w-xs">

                <div className="flex items-center gap-1.5">

                  {item.stock_status === 'LOW STOCK' && (

                    <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  )}

                  <span className="leading-tight">
                    {item.description}
                  </span>
                </div>
              </td>

              <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">

                {item.device_model || '—'}
              </td>

              <td className="px-3 py-2.5 text-right font-bold">

                {item.quantity_available ?? 0}
              </td>

              <td className="px-3 py-2.5 text-right text-xs hidden sm:table-cell">

                {item.supplier_price_usd
                  ? `$${Number(item.supplier_price_usd).toLocaleString()}`
                  : '—'}
              </td>

              <td className="px-3 py-2.5 text-right text-xs hidden sm:table-cell">

                {item.unit_price_ngn
                  ? `₦${Number(item.unit_price_ngn).toLocaleString()}`
                  : '—'}
              </td>

              <td className="px-3 py-2.5 text-right text-xs hidden lg:table-cell">

                {item.total_stock_value
                  ? `₦${Number(item.total_stock_value).toLocaleString()}`
                  : '—'}
              </td>

              <td className="px-3 py-2.5 text-center">

                <Badge
                  variant="outline"

                  className={`text-[10px] whitespace-nowrap ${
                    STATUS_STYLE[item.stock_status]
                    || 'bg-slate-50 text-slate-600'
                  }`}
                >
                  {item.stock_status || 'UNKNOWN'}
                </Badge>
              </td>

              <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">

                {item.vendor || '—'}
              </td>

              <td className="px-3 py-2.5">

                <div className="flex items-center gap-1 justify-end">

                  {isEngineer
                    && (item.quantity_available || 0) > 0 && (

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"

                      onClick={() =>
                        onRequestPart(item)
                      }
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Request
                    </Button>
                  )}

                  {canManage && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"

                        onClick={() =>
                          onEdit(item)
                        }
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"

                        className="h-7 w-7 text-destructive hover:text-destructive"

                        onClick={() =>
                          deleteItem(item)
                        }
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}