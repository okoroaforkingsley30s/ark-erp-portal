import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';

import {
  Loader2,
  Upload,
  AlertTriangle
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';

const GROUPS = [
  'WINCOR',
  'NCR_S1',
  'NCR_S2',
  'HYOSUNG',
  'ENTRUST',
  'EVOLIS',
  'GENERAL_PRINTER_ACCESSORIES'
];

const GROUP_LABELS = {
  WINCOR: 'Wincor',
  NCR_S1: 'NCR S1',
  NCR_S2: 'NCR S2',
  HYOSUNG: 'Hyosung',
  ENTRUST: 'Entrust',
  EVOLIS: 'Evolis',
  GENERAL_PRINTER_ACCESSORIES:
    'General Printer'
};

export default function RequestPartDialog({
  open,
  onOpenChange,
  items = [],
  form,
  setForm,
  onSubmit,
  saving
}) {

  const [uploading, setUploading] =
    React.useState(false);

  const update = (k, v) =>
    setForm(f => ({
      ...f,
      [k]: v
    }));

  const categoryItems =
    form.category_filter
      ? items.filter(
          i =>
            i.category_group
            === form.category_filter
        )
      : items;

  const selectedItem =
    items.find(
      i => i.id === form.part_id
    );

  const maxQty =
    selectedItem?.quantity_available || 0;

  const qtyExceeds =
    (form.quantity_requested || 1)
    > maxQty;

  const uploadPhoto = async e => {

    const file = e.target.files[0];

    if (!file) return;

    try {

      setUploading(true);

      const fileName =
        `${Date.now()}_${file.name}`;

      const { error } = await supabase
        .storage
        .from('inventory')
        .upload(fileName, file);

      if (error) throw error;

      const {
        data: { publicUrl }
      } = supabase
        .storage
        .from('inventory')
        .getPublicUrl(fileName);

      update(
        'faulty_part_photo',
        publicUrl
      );

    } catch (err) {

      alert(
        err.message
        || 'Upload failed'
      );

    } finally {

      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">

        <DialogHeader>

          <DialogTitle>
            Request Spare Part
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">

          <div className="space-y-1.5">

            <Label>
              1. Choose Category
            </Label>

            <Select
              value={form.category_filter || ''}

              onValueChange={v => {

                update(
                  'category_filter',
                  v
                );

                update('part_id', '');
              }}
            >

              <SelectTrigger>
                <SelectValue placeholder="Select category group..." />
              </SelectTrigger>

              <SelectContent>

                {GROUPS.map(g => (

                  <SelectItem
                    key={g}
                    value={g}
                  >
                    {GROUP_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">

            <Label>
              2. Select Part
            </Label>

            <Select
              value={form.part_id || ''}

              onValueChange={v => {

                const p =
                  items.find(
                    x => x.id === v
                  );

                setForm(f => ({
                  ...f,
                  part_id: v,
                  part_name:
                    p?.description || '',
                  part_number:
                    p?.part_number || ''
                }));
              }}

              disabled={!form.category_filter}
            >

              <SelectTrigger>

                <SelectValue
                  placeholder={
                    form.category_filter
                      ? 'Choose part...'
                      : 'Select category first'
                  }
                />
              </SelectTrigger>

              <SelectContent>

                {categoryItems.map(p => (

                  <SelectItem
                    key={p.id}
                    value={p.id}

                    disabled={
                      (p.quantity_available || 0)
                      === 0
                    }
                  >
                    {p.description}
                    {' — '}
                    {p.part_number}
                    {' ('}
                    {p.quantity_available ?? 0}
                    {' in stock)'}

                    {(p.quantity_available || 0)
                      === 0
                        ? ' [OUT OF STOCK]'
                        : ''}
                  </SelectItem>
                ))}

                {categoryItems.length === 0 && (

                  <SelectItem
                    value="none"
                    disabled
                  >
                    No parts in this category
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (

            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">

              <p>
                <span className="font-medium">
                  Part:
                </span>
                {' '}
                {selectedItem.description}
              </p>

              <p>
                <span className="font-medium">
                  Part No:
                </span>
                {' '}
                {selectedItem.part_number}
              </p>

              <p>
                <span className="font-medium">
                  Available:
                </span>
                {' '}

                <span
                  className={
                    maxQty === 0
                      ? 'text-red-600 font-bold'
                      : maxQty <= 2
                        ? 'text-amber-600 font-bold'
                        : 'text-green-700 font-bold'
                  }
                >
                  {maxQty}
                </span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">

            <div className="space-y-1.5">

              <Label>
                Quantity Requested
              </Label>

              <Input
                type="number"
                min="1"
                max={maxQty || 9999}

                value={
                  form.quantity_requested
                }

                onChange={e =>
                  update(
                    'quantity_requested',
                    parseInt(
                      e.target.value
                    ) || 1
                  )
                }
              />

              {qtyExceeds
                && selectedItem && (

                <p className="text-xs text-red-600 flex items-center gap-1">

                  <AlertTriangle className="w-3 h-3" />

                  Cannot exceed
                  {' '}
                  {maxQty}
                  {' '}
                  available
                </p>
              )}
            </div>

            <div className="space-y-1.5">

              <Label>
                Urgency
              </Label>

              <Select
                value={form.urgency}

                onValueChange={v =>
                  update('urgency', v)
                }
              >

                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="low">
                    Low
                  </SelectItem>

                  <SelectItem value="medium">
                    Medium
                  </SelectItem>

                  <SelectItem value="high">
                    High
                  </SelectItem>

                  <SelectItem value="critical">
                    Critical
                  </SelectItem>

                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">

            <Label>
              Site Name
            </Label>

            <Input
              value={form.site_name || ''}

              onChange={e =>
                update(
                  'site_name',
                  e.target.value
                )
              }
            />
          </div>

          <div className="space-y-1.5">

            <Label>
              Reason / Description *
            </Label>

            <Textarea
              value={form.reason || ''}

              onChange={e =>
                update(
                  'reason',
                  e.target.value
                )
              }

              className="h-20"
            />
          </div>

          <div className="space-y-1.5">

            <Label>
              Photo of Faulty Part
              {' '}
              (optional)
            </Label>

            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-3 hover:bg-muted/50 transition-colors">

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadPhoto}
              />

              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 text-muted-foreground" />
              )}

              <span className="text-sm text-muted-foreground">

                {form.faulty_part_photo
                  ? 'Photo uploaded ✓'
                  : 'Upload photo'}
              </span>
            </label>

            {form.faulty_part_photo && (

              <img
                src={form.faulty_part_photo}
                alt="Faulty part"

                className="w-20 h-20 object-cover rounded-lg"
              />
            )}
          </div>

          <Button
            className="w-full"

            onClick={onSubmit}

            disabled={
              !form.part_id
              || !form.reason
              || qtyExceeds
              || saving
            }
          >

            {saving && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}

            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}