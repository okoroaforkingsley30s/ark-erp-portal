import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  Archive,
  BarChart3,
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  MailCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';

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
  const [syncing, setSyncing] = useState(false);

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

  const { data: gmailConnection } = useQuery({
    queryKey: ['gmail-connection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('email, provider, is_active, connected_at, expires_at')
        .eq('is_active', true)
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['official-mail'] });
    qc.invalidateQueries({ queryKey: ['gmail-connection'] });
  };

  const syncGmail = async () => {
    try {
      setSyncing(true);

      const { data, error } = await supabase.functions.invoke('gmail-sync');

      if (error) {
        console.error('Gmail sync failed:', error);
        alert('Gmail sync failed. Check console.');
        return;
      }

      await qc.invalidateQueries({ queryKey: ['official-mail'] });
      alert(`Gmail sync completed. Synced ${data?.synced ?? 0} email(s).`);
    } catch (err) {
      console.error(err);
      alert('Gmail sync failed. Check console.');
    } finally {
      setSyncing(false);
    }
  };

  const stats = useMemo(() => {
    const inbox = emails.filter((e) => !e.is_sent && !e.is_draft && !e.archived_status).length;
    const sent = emails.filter((e) => e.is_sent).length;
    const drafts = emails.filter((e) => e.is_draft).length;
    const archived = emails.filter((e) => e.archived_status).length;
    const unread = emails.filter((e) => e.is_read === false).length;
    const converted = emails.filter((e) => e.converted_to_ticket).length;

    return { inbox, sent, drafts, archived, unread, converted, total: emails.length };
  }, [emails]);

  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      const q = search.toLowerCase();

      const matchesSearch =
        !q ||
        (email.subject || '').toLowerCase().includes(q) ||
        (email.sender_email || '').toLowerCase().includes(q) ||
        (email.sender_name || '').toLowerCase().includes(q) ||
        (email.message_body || '').toLowerCase().includes(q) ||
        (email.snippet || '').toLowerCase().includes(q);

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
                : view === 'unread'
                  ? email.is_read === false
                  : !email.archived_status && !email.is_draft && !email.is_sent;

      return matchesSearch && matchesCategory && matchesView;
    });
  }, [emails, search, categoryFilter, view]);

  const openCompose = (context = null) => {
    setComposeContext(context);
    setComposeOpen(true);
  };

  const tabs = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, count: stats.inbox },
    { key: 'unread', label: 'Unread', icon: MailCheck, count: stats.unread },
    { key: 'sent', label: 'Sent', icon: Send, count: stats.sent },
    { key: 'drafts', label: 'Drafts', icon: Clock, count: stats.drafts },
    { key: 'archived', label: 'Archived', icon: Archive, count: stats.archived },
    { key: 'all', label: 'All Mail', icon: Mail, count: stats.total },
    { key: 'stats', label: 'Analytics', icon: BarChart3, count: null },
  ];

  if (isLoading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-orange-500" />
          <p className="text-sm text-muted-foreground">Loading ARK ONE Mail...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-110px)] flex flex-col gap-4 overflow-hidden">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-[#06133a] via-[#102969] to-[#ff5a00] p-5 shadow-xl">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-28 w-28 rounded-full bg-orange-400/20 blur-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  ARK ONE Mail Command Center
                </h1>
                <p className="text-sm text-white/75">
                  Gmail-powered official mail, tickets, CRM leads, complaints, and follow-ups.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-white border border-white/20">
                <Wifi className="w-3 h-3" />
                {gmailConnection?.email || 'No Gmail connected'}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-white border border-white/20">
                <ShieldCheck className="w-3 h-3" />
                {gmailConnection?.is_active ? 'Google OAuth Active' : 'Not Connected'}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-white border border-white/20">
                <Sparkles className="w-3 h-3" />
                {stats.converted} converted to tickets
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={syncGmail}
              disabled={syncing}
              className="bg-white text-[#102969] hover:bg-white/90"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Gmail'}
            </Button>

            <Button
              variant="outline"
              onClick={refresh}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button
              onClick={() => openCompose()}
              className="bg-[#ff5a00] hover:bg-[#e65100] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Compose
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Inbox" value={stats.inbox} icon={Inbox} />
        <StatCard title="Unread" value={stats.unread} icon={MailCheck} />
        <StatCard title="Synced Emails" value={stats.total} icon={CheckCircle2} />
        <StatCard title="Archived" value={stats.archived} icon={Archive} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={[
              'shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border transition',
              view === key
                ? 'bg-[#ff5a00] text-white border-[#ff5a00] shadow-lg shadow-orange-500/20'
                : 'bg-card hover:bg-muted border-border text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count !== null && (
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-xs',
                  view === key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === 'stats' ? (
        <div className="rounded-2xl border bg-card p-4 overflow-auto">
          <MailDashboardStats emails={emails} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] border rounded-2xl overflow-hidden flex-1 min-h-0 bg-card shadow-xl">
          <div className="border-r bg-gradient-to-b from-[#071133] to-[#0b1f5e] min-h-0 flex flex-col">
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-white/50" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search mail, sender, subject..."
                  className="w-full rounded-xl bg-white/10 border border-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/45 outline-none focus:border-orange-400"
                />
              </div>
            </div>

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

          <div className="min-h-0 bg-gradient-to-br from-[#f8fafc] via-white to-[#fff4ed] dark:from-[#08153d] dark:via-[#0b1f5e] dark:to-[#102969]">
            {filteredEmails.length === 0 ? (
              <div className="h-full flex items-center justify-center p-10 text-center">
                <div>
                  <Mail className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-bold text-lg">No email found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try syncing Gmail or changing your filter.
                  </p>
                  <Button className="mt-4" onClick={syncGmail} disabled={syncing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    Sync Gmail
                  </Button>
                </div>
              </div>
            ) : (
              <MailDetail
                email={selectedEmail}
                onClose={() => setSelectedEmail(null)}
                onRefresh={refresh}
                onCompose={openCompose}
                onConvert={(email) => setConvertEmail(email)}
              />
            )}
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

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-black mt-1">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-[#ff5a00]/10 text-[#ff5a00] flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}