import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const GROUPS = ['WINCOR', 'NCR_S1', 'NCR_S2', 'HYOSUNG', 'ENTRUST', 'EVOLIS', 'GENERAL_PRINTER_ACCESSORIES'];
const GROUP_LABELS = { WINCOR: 'Wincor', NCR_S1: 'NCR S1', NCR_S2: 'NCR S2', HYOSUNG: 'Hyosung', ENTRUST: 'Entrust', EVOLIS: 'Evolis', GENERAL_PRINTER_ACCESSORIES: 'General Printer Accessories' };

const computeStockStatus = (qty, min) => {
  if (qty === 0) return 'OUT OF STOCK';
  if (qty <= (min || 2)) return 'LOW STOCK';
  return 'AVAILABLE';
};

export default function AddEditItemDialog({ open, onOpenChange, form, setForm, editingItem, onSave, saving }) {
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit' : 'Add'} Inventory Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Part Number *</Label>
              <Input value={form.part_number} onChange={e => update('part_number', e.target.value)} placeholder="e.g. 1750105988" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category Group</Label>
              <Select value={form.category_group} onValueChange={v => update('category_group', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GROUPS.map(g => <SelectItem key={g} value={g}>{GROUP_LABELS[g]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Device Brand</Label>
              <Input value={form.device_brand || ''} onChange={e => update('device_brand', e.target.value)} placeholder="e.g. Wincor, NCR" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Device Model</Label>
              <Input value={form.device_model || ''} onChange={e => update('device_model', e.target.value)} placeholder="e.g. CENIO, DS4" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input value={form.vendor || ''} onChange={e => update('vendor', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Qty Available</Label>
              <Input type="number" min="0" value={form.quantity_available} onChange={e => update('quantity_available', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stock Level</Label>
              <Input type="number" min="0" value={form.minimum_stock_level} onChange={e => update('minimum_stock_level', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit Price (₦)</Label>
              <Input type="number" min="0" value={form.unit_price_ngn || ''} onChange={e => update('unit_price_ngn', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier Price ($)</Label>
              <Input type="number" min="0" value={form.supplier_price_usd || ''} onChange={e => update('supplier_price_usd', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Storage Location</Label>
            <Input value={form.storage_location || ''} onChange={e => update('storage_location', e.target.value)} placeholder="e.g. Shelf A3, Bin 12" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)} className="h-16" />
          </div>
          <Button className="w-full" onClick={onSave} disabled={!form.description || !form.part_number || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingItem ? 'Update' : 'Add'} Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}