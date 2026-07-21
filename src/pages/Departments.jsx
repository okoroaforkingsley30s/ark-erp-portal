import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useFormDraft } from '@/hooks/useFormDraft';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import {
  Plus,
  Building2,
  Loader2,
  Pencil,
  Trash2
} from 'lucide-react';

export default function Departments() {
  useOutletContext();

  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    head_email: '',
    status: 'active'
  });

  useFormDraft({ key: editing?.id ? `admin-department-edit:${editing.id}` : 'admin-department-new', form, setForm, enabled: dialogOpen, storage: 'session', maxAgeMs: 8 * 60 * 60 * 1000 });

  const [saving, setSaving] = useState(false);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      head_email: '',
      status: 'active'
    });

    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name) {
      alert('Department name is required');
      return;
    }

    setSaving(true);

    try {

      if (editing) {

        const { error } = await supabase
          .from('departments')
          .update(form)
          .eq('id', editing.id);

        if (error) throw error;

      } else {

        const { error } = await supabase
          .from('departments')
          .insert(form);

        if (error) throw error;
      }

      queryClient.invalidateQueries({
        queryKey: ['departments']
      });

      resetForm();
      setDialogOpen(false);

    } catch (err) {
      console.error(err);
      alert(err.message);

    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dept) => {
    setEditing(dept);

    setForm({
      name: dept.name || '',
      description: dept.description || '',
      head_email: dept.head_email || '',
      status: dept.status || 'active'
    });

    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    const ok = confirm(
      'Delete this department?'
    );

    if (!ok) return;

    try {

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      queryClient.invalidateQueries({
        queryKey: ['departments']
      });

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-bold">
            Departments
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {departments.length} departments
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>

      </div>

      {isLoading ? (

        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>

      ) : (

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {departments.map(dept => (

            <Card
              key={dept.id}
              className="p-5 hover:shadow-md transition-shadow"
            >

              <div className="flex items-start justify-between">

                <div className="flex items-center gap-3">

                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>

                  <div>
                    <p className="font-semibold text-sm">
                      {dept.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {dept.head_email || 'No head assigned'}
                    </p>
                  </div>

                </div>

                <Badge
                  variant="outline"
                  className={
                    dept.status === 'active'
                      ? 'bg-green-50 text-green-600'
                      : 'bg-slate-50 text-slate-500'
                  }
                >
                  {dept.status}
                </Badge>

              </div>

              {dept.description && (
                <p className="text-xs text-muted-foreground mt-3">
                  {dept.description}
                </p>
              )}

              <div className="flex gap-2 mt-4">

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(dept)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(dept.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>

              </div>

            </Card>
          ))}

          {departments.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No departments found</p>
            </div>
          )}

        </div>

      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >

        <DialogContent className="sm:max-w-md">

          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit' : 'Add'} Department
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <div className="space-y-2">

              <Label>Name</Label>

              <Input
                required
                value={form.name}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    name: e.target.value
                  }))
                }
              />

            </div>

            <div className="space-y-2">

              <Label>Description</Label>

              <Textarea
                value={form.description}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    description: e.target.value
                  }))
                }
              />

            </div>

            <div className="space-y-2">

              <Label>Head Email</Label>

              <Input
                type="email"
                value={form.head_email}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    head_email: e.target.value
                  }))
                }
              />

            </div>

            <div className="space-y-2">

              <Label>Status</Label>

              <select
                className="w-full border rounded-md h-10 px-3 bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]"
                value={form.status}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    status: e.target.value
                  }))
                }
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>

            </div>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!form.name || saving}
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              {editing
                ? 'Update'
                : 'Create'} Department

            </Button>

          </div>

        </DialogContent>

      </Dialog>

    </div>
  );
}
