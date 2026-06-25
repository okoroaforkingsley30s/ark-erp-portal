import React, { useEffect, useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  SelectValue,
} from '@/components/ui/select';

import { Send, Save, Loader2 } from 'lucide-react';

import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { createNotification } from '@/lib/createNotification';

function addPrefix(prefix, subject = '') {
  if (!subject) return prefix;
  return subject.toLowerCase().startsWith(prefix.toLowerCase())
    ? subject
    : `${prefix} ${subject}`;
}

function cleanEmail(value = '') {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

export default function ComposeDialog({
  open,
  onClose,
  context,
  user,
  onRefresh,
}) {
  const isReply = context?.type === 'reply';
  const isForward = context?.type === 'forward';
  const original = context?.email;

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('General Enquiry');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!open) return;

    if (isReply && original) {
      setTo(cleanEmail(original.sender_email));
      setCc('');
      setSubject(addPrefix('Re:', original.subject || ''));
      setBody('');
    } else if (isForward && original) {
      setTo('');
      setCc('');
      setSubject(addPrefix('Fwd:', original.subject || ''));
      setBody(`

---------- Forwarded Message ----------
From: ${original.sender_name || original.sender_email || ''}
To: ${original.recipient_email || ''}
CC: ${original.cc || ''}
Date: ${original.received_at || ''}
Subject: ${original.subject || ''}

${original.message_body || original.snippet || ''}`);
    } else {
      setTo('');
      setCc('');
      setSubject('');
      setBody('');
    }
  }, [open, isReply, isForward, original]);

  useEffect(() => {
    if (!open) return;

    const loadSuggestions = async () => {
      const { data, error } = await supabase
        .from('email_messages')
        .select('sender_email, recipient_email, cc')
        .limit(500);

      if (error) return;

      const contacts = new Set();

      (data || []).forEach((mail) => {
        [
          mail.sender_email,
          mail.recipient_email,
          mail.cc,
        ].forEach((value) => {
          String(value || '')
            .split(',')
            .map(cleanEmail)
            .filter(Boolean)
            .forEach((email) => contacts.add(email));
        });
      });

      setSuggestions([...contacts].filter(Boolean).sort());
    };

    loadSuggestions();
  }, [open]);

  const reset = () => {
    setTo('');
    setCc('');
    setSubject('');
    setBody('');
    setSaving(false);
    setSending(false);
  };

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error('To and Subject are required');
      return;
    }

    try {
      setSending(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        toast.error('Session expired. Please log out and log in again.');
        return;
      }

      const cleanTo = to
        .split(',')
        .map(cleanEmail)
        .filter(Boolean)
        .join(',');

      const functionName = isReply ? 'gmail-reply' : 'gmail-send';

      const payload = isReply
        ? {
            originalEmailId: original?.id,
            to: cleanTo,
            cc,
            subject,
            body,
          }
        : {
            to: cleanTo,
            cc,
            subject,
            body,
          };

      const { data, error } = await supabase.functions.invoke(functionName, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: payload,
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const savedMail = data?.saved;

      await createNotification({
        userEmail: cleanTo,
        title: 'New Mail Received',
        message: `${user?.full_name || user?.email || 'ARK ONE'} sent you a mail.`,
        type: 'mail',
        target_url: `/official-mail?mail=${savedMail?.id || ''}`,
        link: `/official-mail?mail=${savedMail?.id || ''}`,
        sound: 'click',
        data: {
          mail_id: savedMail?.id,
          sender_email: user?.email,
          sender_name: user?.full_name,
          subject,
        },
      });

      toast.success(isReply ? 'Reply sent through Gmail' : 'Email sent through Gmail');

      reset();
      onClose?.();
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to send email through Gmail');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);

      const { error } = await supabase.from('email_messages').insert({
        sender_email: user?.email,
        sender_name: user?.full_name,
        recipient_email: to,
        cc,
        subject: subject || '(No Subject)',
        message_body: body,
        email_category: category,
        email_status: 'Draft',
        is_draft: true,
        direction: 'outbound',
        folder: 'drafts',
        received_at: new Date().toISOString(),
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Draft saved');

      onClose?.();
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
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
              <Label className="text-xs">To *</Label>
              <Input
                list="ark-mail-contact-suggestions"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@email.com"
                className="h-8 text-sm"
              />

              <datalist id="ark-mail-contact-suggestions">
                {suggestions.map((email) => (
                  <option key={email} value={email} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
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
                    'Other',
                  ].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">CC</Label>
            <Input
              list="ark-mail-contact-suggestions"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="optional copied emails"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              className="text-sm resize-none h-48"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={saving || sending}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              <Save className="w-3.5 h-3.5 mr-1" />
              Save Draft
            </Button>

            <Button size="sm" onClick={handleSend} disabled={sending || saving}>
              {sending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              <Send className="w-3.5 h-3.5 mr-1" />
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}