import React, { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import {
  Send,
  Save,
  Loader2
} from 'lucide-react';

import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

export default function ComposeDialog({
  open,
  onClose,
  context,
  user,
  onRefresh
}) {

  const isReply =
    context?.type === 'reply';

  const isForward =
    context?.type === 'forward';

  const original =
    context?.email;

  const [to, setTo] = useState(
    isReply
      ? (original?.sender_email || '')
      : ''
  );

  const [subject, setSubject] =
    useState(
      isReply
        ? `Re: ${original?.subject || ''}`
        : isForward
          ? `Fwd: ${original?.subject || ''}`
          : ''
    );

  const [body, setBody] = useState(
    isForward && original
      ? `

---------- Forwarded Message ----------
From: ${original.sender_name || original.sender_email}
Subject: ${original.subject}

${original.message_body || ''}`
      : ''
  );

  const [category, setCategory] =
    useState('General Enquiry');

  const [saving, setSaving] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const reset = () => {

    setTo('');
    setSubject('');
    setBody('');
    setSaving(false);
    setSending(false);
  };

  const handleSend = async () => {

    if (!to || !subject) {

      toast.error(
        'To and Subject are required'
      );

      return;
    }

    try {

      setSending(true);

      const { error } = await supabase
        .from('email_messages')
        .insert({
          sender_email: user?.email,
          sender_name: user?.full_name,

          recipient_email: to,

          subject,

          message_body: body,

          email_category: category,

          email_status: 'Replied',

          is_sent: true,

          direction: 'outbound',

          replied_status: true,

          received_at:
            new Date().toISOString(),

          linked_ticket_id:
            original?.linked_ticket_id || null
        });

      if (error)
        throw error;

      if (isReply && original?.id) {

        await supabase
          .from('email_messages')
          .update({
            replied_status: true,
            email_status: 'Replied'
          })
          .eq('id', original.id);
      }

      toast.success('Email sent');

      reset();

      onClose?.();

      onRefresh?.();

    } catch (err) {

      toast.error(
        err.message || 'Failed to send'
      );

    } finally {

      setSending(false);
    }
  };

  const handleSaveDraft = async () => {

    try {

      setSaving(true);

      const { error } = await supabase
        .from('email_messages')
        .insert({
          sender_email: user?.email,

          sender_name: user?.full_name,

          recipient_email: to,

          subject:
            subject || '(No Subject)',

          message_body: body,

          email_category: category,

          email_status: 'Draft',

          is_draft: true,

          direction: 'outbound',

          received_at:
            new Date().toISOString()
        });

      if (error)
        throw error;

      toast.success('Draft saved');

      onClose?.();

      onRefresh?.();

    } catch (err) {

      toast.error(
        err.message
        || 'Failed to save draft'
      );

    } finally {

      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}

      onOpenChange={v => {

        if (!v) {

          reset();

          onClose?.();
        }
      }}
    >

      <DialogContent className="max-w-2xl">

        <DialogHeader>

          <DialogTitle className="text-sm font-semibold">

            {isReply
              ? `Reply to ${original?.sender_name || original?.sender_email}`
              : isForward
                ? 'Forward Email'
                : 'Compose New Email'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">

          <div className="grid grid-cols-2 gap-3">

            <div className="space-y-1">

              <Label className="text-xs">
                To *
              </Label>

              <Input
                value={to}

                onChange={e =>
                  setTo(e.target.value)
                }

                placeholder="recipient@email.com"

                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">

              <Label className="text-xs">
                Category
              </Label>

              <Select
                value={category}

                onValueChange={setCategory}
              >

                <SelectTrigger className="h-8 text-xs">

                  <SelectValue />
                </SelectTrigger>

                <SelectContent>

                  {[
                    'Bank Support',
                    'Client Request',
                    'Vendor / Supplier',
                    'Staff Internal',
                    'HR Matter',
                    'Finance Matter',
                    'Procurement Matter',
                    'General Enquiry',
                    'Complaint',
                    'Escalation',
                    'Other'
                  ].map(c => (

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
              Subject *
            </Label>

            <Input
              value={subject}

              onChange={e =>
                setSubject(e.target.value)
              }

              placeholder="Email subject"

              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">

            <Label className="text-xs">
              Message
            </Label>

            <Textarea
              value={body}

              onChange={e =>
                setBody(e.target.value)
              }

              placeholder="Write your message…"

              className="text-sm resize-none h-48"
            />
          </div>

          <div className="flex justify-end gap-2">

            <Button
              variant="outline"
              size="sm"

              onClick={handleSaveDraft}

              disabled={
                saving || sending
              }
            >

              {saving && (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              )}

              <Save className="w-3.5 h-3.5 mr-1" />

              Save Draft
            </Button>

            <Button
              size="sm"

              onClick={handleSend}

              disabled={
                sending || saving
              }
            >

              {sending && (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              )}

              <Send className="w-3.5 h-3.5 mr-1" />

              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}