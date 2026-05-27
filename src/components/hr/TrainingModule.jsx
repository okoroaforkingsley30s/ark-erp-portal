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
  BookOpen,
  Loader2
} from 'lucide-react';

const STATUS_COLOR = {
  Scheduled: 'bg-blue-50 text-blue-700',
  Completed: 'bg-green-50 text-green-700',
  Cancelled: 'bg-red-50 text-red-700',
  Postponed: 'bg-amber-50 text-amber-700'
};

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
  training_topic: '',
  training_date: '',
  trainer_name: '',
  training_location: '',
  participants: [],
  department: '',
  country: 'Nigeria',
  training_status: 'Scheduled',
  follow_up_notes: ''
};

export default function TrainingModule({
  trainings,
  canManage
}) {

  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [participantInput, setParticipantInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [filterStatus, setFilterStatus] =
    useState('all');

  const [filterCountry, setFilterCountry] =
    useState('all');

  const set = (k, v) =>
    setForm(f => ({
      ...f,
      [k]: v
    }));

  const filtered = trainings.filter(t => {

    const matchStatus =
      filterStatus === 'all'
      || t.training_status === filterStatus;

    const matchCountry =
      filterCountry === 'all'
      || t.country === filterCountry;

    return matchStatus && matchCountry;
  });

  const save = async () => {

    try {

      setSaving(true);

      const payload = {
        training_topic: form.training_topic,
        training_date: form.training_date || null,
        trainer_name: form.trainer_name || null,
        training_location: form.training_location || null,
        participants: form.participants || [],
        department: form.department || null,
        country: form.country || 'Nigeria',
        training_status: form.training_status || 'Scheduled',
        follow_up_notes: form.follow_up_notes || null
      };

      const { error } = await supabase
        .from('hr_training')
        .insert([payload]);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-trainings']
      });

      setForm(EMPTY);
      setOpen(false);

      alert('Training record saved');

    } catch (err) {

      alert(
        'Error saving training: '
        + (err?.message || 'Unknown error')
      );

    } finally {

      setSaving(false);
    }
  };

  const updateStatus = async (
    training,
    status
  ) => {

    try {

      const { error } = await supabase
        .from('hr_training')
        .update({
          training_status: status
        })
        .eq('id', training.id);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['hr-trainings']
      });

    } catch (err) {

      alert(
        'Error updating training: '
        + (err?.message || 'Unknown error')
      );
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap gap-2 items-center justify-between">

        <div className="flex gap-2">

          {[
            'all',
            'Scheduled',
            'Completed',
            'Cancelled'
          ].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}

          <Select
            value={filterCountry}
            onValueChange={setFilterCountry}
          >

            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Country" />
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
        </div>

        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Training
          </Button>
        )}
      </div>

      <div className="space-y-3">

        {filtered.length === 0 && (

          <div className="text-center py-12 text-muted-foreground text-sm">

            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />

            No training records.
          </div>
        )}

        {filtered.map(t => (

          <Card key={t.id} className="p-4">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div>

                <div className="flex items-center gap-2 mb-1">

                  <span className="font-semibold">
                    {t.training_topic}
                  </span>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      STATUS_COLOR[
                        t.training_status
                      ] || ''
                    }`}
                  >
                    {t.training_status}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  Date: {t.training_date}
                  {' · '}
                  Trainer: {t.trainer_name || '—'}
                  {' · '}
                  Location: {t.training_location || '—'}
                </p>

                {t.department && (
                  <p className="text-xs text-muted-foreground">
                    Dept: {t.department}
                    {' · '}
                    {t.country}
                  </p>
                )}

                {t.participants?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Participants: {t.participants.join(', ')}
                  </p>
                )}

                {t.follow_up_notes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Notes: {t.follow_up_notes}
                  </p>
                )}
              </div>

              {canManage
                && t.training_status === 'Scheduled' && (

                <div className="flex gap-1">

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs bg-green-50 text-green-700"
                    onClick={() =>
                      updateStatus(
                        t,
                        'Completed'
                      )
                    }
                  >
                    Mark Completed
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-muted-foreground"
                    onClick={() =>
                      updateStatus(
                        t,
                        'Cancelled'
                      )
                    }
                  >
                    Cancel
                  </Button>
                </div>
              )}
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
              Add Training Record
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1 col-span-2">

                <Label className="text-xs">
                  Training Topic *
                </Label>

                <Input
                  value={form.training_topic}
                  onChange={e =>
                    set(
                      'training_topic',
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
                  value={form.training_date}
                  onChange={e =>
                    set(
                      'training_date',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Trainer Name
                </Label>

                <Input
                  value={form.trainer_name}
                  onChange={e =>
                    set(
                      'trainer_name',
                      e.target.value
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Location
                </Label>

                <Input
                  value={form.training_location}
                  onChange={e =>
                    set(
                      'training_location',
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

              <div className="space-y-1 col-span-2">

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
            </div>

            <div className="space-y-1">

              <Label className="text-xs">
                Participants
                {' '}
                (press Enter to add)
              </Label>

              <Input
                value={participantInput}
                onChange={e =>
                  setParticipantInput(
                    e.target.value
                  )
                }
                className="h-8 text-sm"
                placeholder="Type name and press Enter"

                onKeyDown={e => {

                  if (
                    e.key === 'Enter'
                    && participantInput.trim()
                  ) {

                    set(
                      'participants',
                      [
                        ...(form.participants || []),
                        participantInput.trim()
                      ]
                    );

                    setParticipantInput('');
                  }
                }}
              />

              {form.participants?.length > 0 && (

                <div className="flex flex-wrap gap-1 mt-1">

                  {form.participants.map((p, i) => (

                    <span
                      key={i}
                      className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1"
                    >
                      {p}

                      <button
                        onClick={() =>
                          set(
                            'participants',
                            form.participants.filter(
                              (_, j) => j !== i
                            )
                          )
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">

              <Label className="text-xs">
                Follow-up Notes
              </Label>

              <Textarea
                value={form.follow_up_notes}
                onChange={e =>
                  set(
                    'follow_up_notes',
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
                !form.training_topic
                || !form.training_date
                || saving
              }
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              Save Training
            </Button>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}