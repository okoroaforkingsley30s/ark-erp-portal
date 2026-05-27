import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import {
  Plus,
  Calendar,
  Loader2
} from 'lucide-react';

import {
  format,
  isFuture
} from 'date-fns';

const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Cameroon",
  "Benin Republic",
  "Sierra Leone",
  "Liberia",
  "Ivory Coast",
  "Senegal",
  "Gambia",
  "Guinea",
  "Congo Brazzaville",
  "All Countries"
];

const TYPE_COLOR = {
  'Public Holiday': 'bg-blue-50 text-blue-700',
  'Company Holiday': 'bg-purple-50 text-purple-700',
  'Religious Holiday': 'bg-amber-50 text-amber-700',
  'Regional Holiday': 'bg-green-50 text-green-700'
};

const EMPTY = {
  holiday_name: '',
  holiday_date: '',
  country: 'Nigeria',
  holiday_type: 'Public Holiday',
  description: ''
};

export default function HolidayModule({
  holidays,
  canManage
}) {

  const qc = useQueryClient();

  const [open, setOpen] = useState(false);

  const [form, setForm] = useState(EMPTY);

  const [saving, setSaving] = useState(false);

  const [filterCountry, setFilterCountry] =
    useState('all');

  const set = (k, v) =>
    setForm(f => ({
      ...f,
      [k]: v
    }));

  const upcoming = holidays
    .filter(h =>
      h.holiday_date
      && isFuture(new Date(h.holiday_date))
    )
    .sort(
      (a, b) =>
        new Date(a.holiday_date)
        - new Date(b.holiday_date)
    );

  const filtered = upcoming.filter(
    h =>
      filterCountry === 'all'
      || h.country === filterCountry
      || h.country === 'All Countries'
  );

  const save = async () => {

    try {

      setSaving(true);

      const payload = {
        holiday_name: form.holiday_name,
        holiday_date:
          form.holiday_date || null,
        country:
          form.country || 'Nigeria',
        holiday_type:
          form.holiday_type || 'Public Holiday',
        description:
          form.description || null
      };

      const { error } = await supabase
        .from('hr_holidays')
        .insert([payload]);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-holidays']
      });

      setForm(EMPTY);

      setOpen(false);

      alert('Holiday saved');

    } catch (err) {

      alert(
        'Error saving holiday: '
        + (err?.message || 'Unknown error')
      );

    } finally {

      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap gap-2 items-center justify-between">

        <Select
          value={filterCountry}
          onValueChange={setFilterCountry}
        >

          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>

          <SelectContent>

            <SelectItem value="all">
              All Countries
            </SelectItem>

            {COUNTRIES.map(c => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}

          </SelectContent>
        </Select>

        {canManage && (

          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Holiday
          </Button>
        )}
      </div>

      <div className="space-y-3">

        {filtered.length === 0 && (

          <div className="text-center py-12 text-muted-foreground text-sm">

            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />

            No upcoming holidays.
          </div>
        )}

        {filtered.map(h => (

          <Card key={h.id} className="p-4">

            <div className="flex items-start justify-between gap-3">

              <div>

                <div className="flex items-center gap-2 mb-1">

                  <span className="font-semibold">
                    {h.holiday_name}
                  </span>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      TYPE_COLOR[
                        h.holiday_type
                      ] || ''
                    }`}
                  >
                    {h.holiday_type}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">

                  {format(
                    new Date(h.holiday_date),
                    'EEEE, MMMM d, yyyy'
                  )}

                  {' · '}

                  {h.country}
                </p>

                {h.description && (

                  <p className="text-xs text-muted-foreground mt-1">

                    {h.description}
                  </p>
                )}
              </div>

              <div className="text-right">

                <p className="text-2xl font-bold text-primary">

                  {format(
                    new Date(h.holiday_date),
                    'd'
                  )}
                </p>

                <p className="text-xs text-muted-foreground">

                  {format(
                    new Date(h.holiday_date),
                    'MMM'
                  )}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >

        <DialogContent className="sm:max-w-md">

          <DialogHeader>
            <DialogTitle>
              Add Holiday
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1 col-span-2">

                <Label className="text-xs">
                  Holiday Name *
                </Label>

                <Input
                  value={form.holiday_name}

                  onChange={e =>
                    set(
                      'holiday_name',
                      e.target.value
                    )
                  }

                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Date *
                </Label>

                <Input
                  type="date"
                  value={form.holiday_date}

                  onChange={e =>
                    set(
                      'holiday_date',
                      e.target.value
                    )
                  }

                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Country
                </Label>

                <Select
                  value={form.country}
                  onValueChange={v =>
                    set('country', v)
                  }
                >

                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>

                    {COUNTRIES.map(c => (
                      <SelectItem
                        key={c}
                        value={c}
                      >
                        {c}
                      </SelectItem>
                    ))}

                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">

                <Label className="text-xs">
                  Holiday Type
                </Label>

                <Select
                  value={form.holiday_type}
                  onValueChange={v =>
                    set('holiday_type', v)
                  }
                >

                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>

                    {[
                      'Public Holiday',
                      'Company Holiday',
                      'Religious Holiday',
                      'Regional Holiday'
                    ].map(t => (
                      <SelectItem
                        key={t}
                        value={t}
                      >
                        {t}
                      </SelectItem>
                    ))}

                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">

              <Label className="text-xs">
                Description
              </Label>

              <Textarea
                value={form.description}

                onChange={e =>
                  set(
                    'description',
                    e.target.value
                  )
                }

                className="h-16 text-sm"
              />
            </div>

            <Button
              className="w-full"
              onClick={save}

              disabled={
                !form.holiday_name
                || !form.holiday_date
                || saving
              }
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              Save Holiday
            </Button>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}