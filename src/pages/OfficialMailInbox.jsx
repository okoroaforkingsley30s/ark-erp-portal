import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Mail } from 'lucide-react';
import MailList from '@/components/mail/MailList';
import MailDetail from '@/components/mail/MailDetail';
import ComposeDialog from '@/components/mail/ComposeDialog';
import ConvertToTicketDialog from '@/components/mail/ConvertToTicketDialog';
import MailDashboardStats from '@/components/mail/MailDashboardStats';

export default function OfficialMailInbox({ user }) {
  const qc = useQueryClient();

  const [selectedEmail, setSelectedEmail] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContext, setComposeContext] = useState(null);
  const [convertEmail, setConvertEmail] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState('inbox');

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['official-mail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .order('received_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['official-mail'] });
  };

  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      const q = search.toLowerCase();

      const matchesSearch =
        !q ||
        (email.subject || '').toLowerCase().includes(q) ||
        (email.sender_email || '').toLowerCase().includes(q) ||
        (email.sender_name || '').toLowerCase().includes(q) ||
        (email.message_body || '').toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all' || email.email_category === categoryFilter;

      const matchesView =
        view === 'all'
          ? true
          : view === 'drafts'
            ? email.is_draft
            : view === 'sent'
              ? email.is_sent
              : view === 'archived'
                ? email.archived_status
                : !email.archived_status && !email.is_draft;

      return matchesSearch && matchesCategory && matchesView;
    });
  }, [emails, search, categoryFilter, view]);

  const openCompose = (context = null) => {
    setComposeContext(context);
    setComposeOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-[70vh] flex items-center justify-center text-muted-foreground">
        Loading official mail...
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Official Mail Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            View, reply, assign, archive, and convert official emails to tickets.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button onClick={() => openCompose()}>
            <Plus className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          ['inbox', 'Inbox'],
          ['all', 'All'],
          ['sent', 'Sent'],
          ['drafts', 'Drafts'],
          ['archived', 'Archived'],
          ['stats', 'Dashboard'],
        ].map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={view === key ? 'default' : 'outline'}
            onClick={() => setView(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {view === 'stats' ? (
        <MailDashboardStats emails={emails} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] border rounded-xl overflow-hidden flex-1 min-h-0">
          <div className="border-r bg-slate-900/50 min-h-0">
            <MailList
              emails={filteredEmails}
              selectedId={selectedEmail?.id}
              onSelect={setSelectedEmail}
              search={search}
              onSearch={setSearch}
              categoryFilter={categoryFilter}
              onCategoryFilter={setCategoryFilter}
            />
          </div>

          <div className="min-h-0 bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]">
            <MailDetail
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onRefresh={refresh}
              onCompose={openCompose}
              onConvert={(email) => setConvertEmail(email)}
            />
          </div>
        </div>
      )}

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        context={composeContext}
        user={user}
        onRefresh={refresh}
      />

      <ConvertToTicketDialog
        open={!!convertEmail}
        email={convertEmail}
        user={user}
        onClose={() => setConvertEmail(null)}
        onRefresh={refresh}
      />
    </div>
  );
}