import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useFormDraft } from '@/hooks/useFormDraft';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Star,
  Loader2,
  AlertTriangle
} from 'lucide-react';

import { addDays } from 'date-fns';

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
  "Congo Brazzaville"
];

const EMPTY = {
  employee_name: '',
  staff_id: '',
  department: '',
  country: 'Nigeria',
  review_date: '',
  reviewer_name: '',
  review_score: '',
  performance_notes: '',
  next_review_date: ''
};

export default function PerformanceModule({
  reviews,
  canManage
}) {

  const qc = useQueryClient();

  const [open, setOpen] = useState(false);

  const [form, setForm] = useState(EMPTY);

  const [saving, setSaving] = useState(false);

  const [filterCountry, setFilterCountry] =
    useState('all');

  useFormDraft({ key: 'hr-performance-new', form, setForm, enabled: open, storage: 'session', maxAgeMs: 30 * 60 * 1000 });

  const set = (k, v) =>
    setForm(f => ({
      ...f,
      [k]: v
    }));

  const today = new Date();

  const upcoming = reviews.filter(r => {

    if (!r.next_review_date)
      return false;

    const rd =
      new Date(r.next_review_date);

    return rd >= today
      && rd <= addDays(today, 30);
  });

  const filtered = reviews.filter(
    r =>
      filterCountry === 'all'
      || r.country === filterCountry
  );

  const save = async () => {

    try {

      setSaving(true);

      const payload = {
        employee_name: form.employee_name,
        staff_id: form.staff_id || null,
        department: form.department || null,
        country: form.country || 'Nigeria',

        review_date:
          form.review_date || null,

        reviewer_name:
          form.reviewer_name || null,

        review_score:
          parseFloat(form.review_score) || 0,

        performance_notes:
          form.performance_notes || null,

        next_review_date:
          form.next_review_date || null
      };

      const { error } = await supabase
        .from('hr_performance')
        .insert([payload]);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-reviews']
      });

      setForm(EMPTY);

      setOpen(false);

      alert('Performance review saved');

    } catch (err) {

      alert(
        'Error saving review: '
        + (err?.message || 'Unknown error')
      );

    } finally {

      setSaving(false);
    }
  };

  const scoreColor = score => {

    if (score >= 80)
      return 'text-green-700';

    if (score >= 60)
      return 'text-amber-700';

    return 'text-red-700';
  };

  return (
    <div className="space-y-4">

      {upcoming.length > 0 && (

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">

          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />

          <div>

            <p className="text-xs font-semibold text-amber-800">

              {upcoming.length}
              {' '}
              review(s) due in the next 30 days
            </p>

            <p className="text-xs text-amber-700">

              {upcoming
                .map(r => r.employee_name)
                .join(', ')
              }
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">

        <Select
          value={filterCountry}
          onValueChange={setFilterCountry}
        >

          <SelectTrigger className="w-36 h-8 text-sm">
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
            Add Review
          </Button>
        )}
      </div>

      <div className="space-y-3">

        {filtered.length === 0 && (

          <div className="text-center py-12 text-muted-foreground text-sm">

            <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />

            No performance reviews.
          </div>
        )}

        {filtered.map(r => (

          <Card key={r.id} className="p-4">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div>

                <div className="flex items-center gap-2 mb-1">

                  <span className="font-semibold">
                    {r.employee_name}
                  </span>

                  {r.staff_id && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.staff_id}
                    </span>
                  )}

                  {r.review_score != null && (
                    <span
                      className={`font-bold text-sm ${scoreColor(r.review_score)}`}
                    >
                      {r.review_score}/100
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">

                  Review Date:
                  {' '}
                  {r.review_date}

                  {' · '}

                  Reviewer:
                  {' '}
                  {r.reviewer_name}
                </p>

                {r.department && (

                  <p className="text-xs text-muted-foreground">

                    {r.department}
                    {' · '}
                    {r.country}
                  </p>
                )}

                {r.performance_notes && (

                  <p className="text-xs text-muted-foreground mt-1">

                    {r.performance_notes}
                  </p>
                )}

                {r.next_review_date && (

                  <p
                    className={`text-xs mt-1 ${
                      new Date(r.next_review_date)
                      <= addDays(today, 30)
                        ? 'text-amber-700 font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Next Review:
                    {' '}
                    {r.next_review_date}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-center">

                <div
                  className="w-12 h-12 rounded-full border-4 flex items-center justify-center"

                  style={{
                    borderColor:
                      r.review_score >= 80
                        ? '#16a34a'
                        : r.review_score >= 60
                          ? '#d97706'
                          : '#dc2626'
                  }}
                >
                  <span
                    className={`text-xs font-bold ${scoreColor(r.review_score)}`}
                  >
                    {r.review_score || 0}
                  </span>
                </div>
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
              Add Performance Review
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1">

                <Label className="text-xs">
                  Employee Name *
                </Label>

                <Input
                  value={form.employee_name}
                  onChange={e =>
                    set(
                      'employee_name',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Staff ID
                </Label>

                <Input
                  value={form.staff_id}
                  onChange={e =>
                    set(
                      'staff_id',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Department
                </Label>

                <Input
                  value={form.department}
                  onChange={e =>
                    set(
                      'department',
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

              <div className="space-y-1">

                <Label className="text-xs">
                  Review Date *
                </Label>

                <Input
                  type="date"
                  value={form.review_date}
                  onChange={e =>
                    set(
                      'review_date',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Reviewer Name *
                </Label>

                <Input
                  value={form.reviewer_name}
                  onChange={e =>
                    set(
                      'reviewer_name',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Score (0-100)
                </Label>

                <Input
                  type="number"
                  min="0"
                  max="100"

                  value={form.review_score}

                  onChange={e =>
                    set(
                      'review_score',
                      e.target.value
                    )
                  }

                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Next Review Date
                </Label>

                <Input
                  type="date"
                  value={form.next_review_date}

                  onChange={e =>
                    set(
                      'next_review_date',
                      e.target.value
                    )
                  }

                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">

              <Label className="text-xs">
                Performance Notes
              </Label>

              <Textarea
                value={form.performance_notes}

                onChange={e =>
                  set(
                    'performance_notes',
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
                !form.employee_name
                || !form.review_date
                || !form.reviewer_name
                || saving
              }
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              Save Review
            </Button>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
