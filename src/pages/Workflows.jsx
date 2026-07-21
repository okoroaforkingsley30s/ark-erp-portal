import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useFormDraft } from '@/hooks/useFormDraft';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import {
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';

import { format } from 'date-fns';

const typeLabels = {
  leave: 'Leave Request',
  procurement: 'Procurement',
  maintenance: 'Maintenance',
  approval: 'Approval',
  task_assignment: 'Task Assignment',
};

const statusColors = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function Workflows() {
  const { user } = useOutletContext();

  const queryClient = useQueryClient();

  const role = user?.role || 'client';

  const [createOpen, setCreateOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState('all');

  const [form, setForm] = useState({
    request_type: 'leave',
    title: '',
    description: '',
    priority: 'medium',
  });

  const [saving, setSaving] = useState(false);

  useFormDraft({ key: 'workflow-request-new', form, setForm, userId: user?.id || user?.email, enabled: createOpen, storage: 'session', maxAgeMs: 8 * 60 * 60 * 1000 });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['workflow-requests', role, user?.email],

    queryFn: async () => {
      let query = supabase
        .from('workflow_requests')
        .select('*')
        .order('created_at', {
          ascending: false,
        })
        .limit(200);

      if (
        role !== 'admin' &&
        role !== 'helpdesk'
      ) {
        query = query.eq(
          'requester_email',
          user.email
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          'SUPABASE WORKFLOW ERROR:',
          error
        );

        return [];
      }

      return data || [];
    },

    enabled: !!user?.email,
  });

  const filtered =
    typeFilter === 'all'
      ? requests
      : requests.filter(
          (r) =>
            r.request_type === typeFilter
        );

  const handleCreate = async () => {
    if (
      !form.title ||
      !form.description
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('workflow_requests')
        .insert({
          request_type:
            form.request_type,
          title: form.title,
          description:
            form.description,
          priority: form.priority,

          requester_email:
            user.email,

          requester_name:
            user.full_name ||
            user.name ||
            user.email,

          status: 'pending',

          created_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        });

      if (error) {
        alert(
          'Error creating request: ' +
            error.message
        );

        return;
      }

      queryClient.invalidateQueries({
        queryKey: [
          'workflow-requests',
        ],
      });

      setForm({
        request_type: 'leave',
        title: '',
        description: '',
        priority: 'medium',
      });

      setCreateOpen(false);
    } catch (err) {
      console.error(err);

      alert(
        'Unexpected error creating workflow request'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (
    id,
    newStatus
  ) => {
    const { error } = await supabase
      .from('workflow_requests')
      .update({
        status: newStatus,

        approver_email:
          user.email,

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      alert(
        'Status update failed: ' +
          error.message
      );

      return;
    }

    queryClient.invalidateQueries({
      queryKey: [
        'workflow-requests',
      ],
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Workflow Requests
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} requests
          </p>
        </div>

        <Button
          onClick={() =>
            setCreateOpen(true)
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      <div className="flex gap-3">
        <Select
          value={typeFilter}
          onValueChange={
            setTypeFilter
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All Types
            </SelectItem>

            <SelectItem value="leave">
              Leave
            </SelectItem>

            <SelectItem value="procurement">
              Procurement
            </SelectItem>

            <SelectItem value="maintenance">
              Maintenance
            </SelectItem>

            <SelectItem value="approval">
              Approval
            </SelectItem>

            <SelectItem value="task_assignment">
              Task Assignment
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((req) => (
            <Card
              key={req.id}
              className="p-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {req.status ===
                  'pending' ? (
                    <Clock className="w-4 h-4 text-[#ff5a00]" />
                  ) : req.status ===
                    'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : req.status ===
                    'rejected' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-blue-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                    >
                      {
                        typeLabels[
                          req.request_type
                        ]
                      }
                    </Badge>

                    <Badge
                      variant="outline"
                      className={`${
                        statusColors[
                          req.status
                        ]
                      } text-[10px]`}
                    >
                      {req.status}
                    </Badge>
                  </div>

                  <p className="font-semibold text-sm">
                    {req.title}
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {req.description}
                  </p>

                  <p className="text-[10px] text-muted-foreground mt-2">
                    By{' '}
                    {req.requester_name}{' '}
                    •{' '}
                    {req.created_at
                      ? format(
                          new Date(
                            req.created_at
                          ),
                          'MMM d, yyyy'
                        )
                      : ''}
                  </p>
                </div>

                {(role === 'admin' ||
                  role ===
                    'helpdesk') &&
                  req.status ===
                    'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600"
                        onClick={() =>
                          handleStatusUpdate(
                            req.id,
                            'approved'
                          )
                        }
                      >
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500"
                        onClick={() =>
                          handleStatusUpdate(
                            req.id,
                            'rejected'
                          )
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  )}
              </div>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">
                No workflow requests
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={
          setCreateOpen
        }
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              New Workflow Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>

              <Select
                value={
                  form.request_type
                }
                onValueChange={(
                  v
                ) =>
                  setForm(
                    (
                      f
                    ) => ({
                      ...f,
                      request_type:
                        v,
                    })
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="leave">
                    Leave Request
                  </SelectItem>

                  <SelectItem value="procurement">
                    Procurement
                  </SelectItem>

                  <SelectItem value="maintenance">
                    Maintenance
                  </SelectItem>

                  <SelectItem value="approval">
                    Approval
                  </SelectItem>

                  <SelectItem value="task_assignment">
                    Task Assignment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>

              <Input
                value={form.title}
                onChange={(e) =>
                  setForm(
                    (
                      f
                    ) => ({
                      ...f,
                      title:
                        e.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Description
              </Label>

              <Textarea
                value={
                  form.description
                }
                onChange={(e) =>
                  setForm(
                    (
                      f
                    ) => ({
                      ...f,
                      description:
                        e.target
                          .value,
                    })
                  )
                }
                className="h-24"
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>

              <Select
                value={
                  form.priority
                }
                onValueChange={(
                  v
                ) =>
                  setForm(
                    (
                      f
                    ) => ({
                      ...f,
                      priority:
                        v,
                    })
                  )
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
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={
                handleCreate
              }
              disabled={
                !form.title ||
                !form.description ||
                saving
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
    </div>
  );
}
