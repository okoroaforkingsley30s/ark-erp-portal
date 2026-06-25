import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  Archive,
  BarChart3,
  Clock,
  Inbox,
  Mail,
  MailCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Wifi,
  Star,
  Trash2,
  ChevronDown,
} from 'lucide-react';

import MailList from '@/components/mail/MailList';
import MailDetail from '@/components/mail/MailDetail';
import ComposeDialog from '@/components/mail/ComposeDialog';
import ConvertToTicketDialog from '@/components/mail/ConvertToTicketDialog';
import MailDashboardStats from '@/components/mail/MailDashboardStats';

const GMAIL_OAUTH_URL =
  'https://fryidzyhqhdenghyxjfp.supabase.co/functions/v1/gmail-oauth';

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
  const [refreshing, setRefreshing] = useState(false);

  const { data: authUser, isLoading: userLoading } = useQuery({
    queryKey: ['official-mail-auth-user', user?.id],
    queryFn: async () => {
      if (user?.id) return user;

      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      return currentUser;
    },
  });

  const userId = authUser?.id;

  const { data: gmailConnection } = useQuery({
    queryKey: ['gmail-connection', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('email, provider, is_active, connected_at, expires_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['official-mail', userId],
    enabled: !!userId,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('created_by', userId)
        .order('received_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const refresh = async () => {
    if (!userId) return;

    try {
      setRefreshing(true);
      await qc.invalidateQueries({ queryKey: ['gmail-connection', userId] });
      await qc.invalidateQueries({ queryKey: ['official-mail', userId] });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const connectGmail = () => {
    if (!userId) {
      alert('User session not ready. Please refresh and try again.');
      return;
    }

    window.open(`${GMAIL_OAUTH_URL}?user_id=${userId}`, '_blank', 'noopener,noreferrer');
  };

  const syncGmail = async ({ silent = false } = {}) => {
    if (!gmailConnection?.email) {
      if (!silent) alert('Please connect your ARK Technologies Workspace Gmail first.');
      return;
    }

    try {
      setSyncing(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        if (!silent) alert('Session expired. Please log out and log in again.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('gmail-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Gmail sync failed:', error);
        if (!silent) alert(error.message || 'Failed to send request to the Edge Function.');
        return;
      }

      await refresh();

      if (!silent) {
        alert(`Gmail sync completed. Synced ${data?.synced ?? 0} email(s).`);
      }
    } catch (err) {
      console.error(err);
      if (!silent) alert('Failed to send request to the Edge Function.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!gmailConnection?.email) return;

    const timer = setInterval(() => {
      syncGmail({ silent: true });
    }, 120000);

    return () => clearInterval(timer);
  }, [gmailConnection?.email, userId]);

  useEffect(() => {
    if (!selectedEmail?.id) return;

    const updated = emails.find((email) => email.id === selectedEmail.id);
    if (updated) setSelectedEmail(updated);
  }, [emails, selectedEmail?.id]);

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

  useEffect(() => {
    if (!selectedEmail && filteredEmails.length > 0) {
      setSelectedEmail(filteredEmails[0]);
    }
  }, [filteredEmails, selectedEmail]);

  const openCompose = (context = null) => {
    setComposeContext(context);
    setComposeOpen(true);
  };

  const mailNav = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, count: stats.inbox },
    { key: 'unread', label: 'Unread', icon: MailCheck, count: stats.unread },
    { key: 'sent', label: 'Sent', icon: Send, count: stats.sent },
    { key: 'drafts', label: 'Drafts', icon: Clock, count: stats.drafts },
    { key: 'archived', label: 'Archived', icon: Archive, count: stats.archived },
    { key: 'all', label: 'All Mail', icon: Mail, count: stats.total },
    { key: 'stats', label: 'Analytics', icon: BarChart3, count: null },
  ];

  if (userLoading || isLoading) {
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
    <div className="h-[calc(100vh-78px)] overflow-hidden rounded-2xl border border-white/10 bg-[#071133] text-white shadow-xl">
      <div className="h-full grid grid-cols-1 xl:grid-cols-[230px_440px_1fr] bg-[#071133]">
        <aside className="hidden xl:flex flex-col border-r border-white/10 bg-[#08153d]">
          <div className="p-4 border-b border-white/10">
            <Button
              onClick={() => openCompose()}
              className="w-full h-11 justify-start gap-2 rounded-2xl bg-[#ff5a00] hover:bg-[#e65100] text-white font-semibold"
            >
              <Plus className="w-4 h-4" />
              Compose
            </Button>
          </div>

          <div className="p-3 space-y-1">
            {mailNav.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={[
                  'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  view === key
                    ? 'bg-[#ff5a00]/15 text-[#ffb38a]'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white',
                ].join(' ')}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </span>

                {count !== null && (
                  <span
                    className={[
                      'text-[11px] rounded-full px-2 py-0.5',
                      view === key ? 'bg-[#ff5a00]/25 text-white' : 'bg-white/10 text-slate-300',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-white/10 mt-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Labels</p>

            {[
              ['Important', Star],
              ['Trash', Trash2],
              ['Follow up', ChevronDown],
            ].map(([label, Icon]) => (
              <button
                key={label}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/8"
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-auto p-4 border-t border-white/10">
            <div className="rounded-2xl bg-white/8 border border-white/10 p-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Wifi className="w-3.5 h-3.5 text-green-400" />
                <span className="truncate">{gmailConnection?.email || 'No Gmail connected'}</span>
              </div>

              <div className="flex items-center gap-2 mt-2 text-xs text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                {gmailConnection?.is_active ? 'Google Account Active' : 'Not Connected'}
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 border-r border-white/10 bg-[#0a1744] flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h1 className="text-lg font-black tracking-tight">Official Mail</h1>
                <p className="text-xs text-slate-400">ARK ONE Mail Command Center</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={refresh}
                  disabled={refreshing}
                  className="h-9 w-9 text-slate-300 hover:text-white hover:bg-white/10"
                  title="Refresh local mail"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => syncGmail()}
                  disabled={syncing || !gmailConnection?.email}
                  className="h-9 w-9 text-slate-300 hover:text-white hover:bg-white/10"
                  title="Sync Gmail"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mail..."
                className="w-full h-10 rounded-xl bg-white/8 border border-white/10 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-orange-400"
              />
            </div>

            <div className="xl:hidden flex gap-2 overflow-x-auto mt-3 pb-1">
              {mailNav.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={[
                    'shrink-0 rounded-full px-3 py-1.5 text-xs border',
                    view === key
                      ? 'bg-[#ff5a00] border-[#ff5a00] text-white'
                      : 'bg-white/8 border-white/10 text-slate-300',
                  ].join(' ')}
                >
                  {label} {count !== null ? count : ''}
                </button>
              ))}
            </div>
          </div>

          {view === 'stats' ? (
            <div className="flex-1 overflow-auto p-4 bg-white text-slate-900">
              <MailDashboardStats emails={emails} />
            </div>
          ) : (
            <MailList
              emails={filteredEmails}
              selectedId={selectedEmail?.id}
              onSelect={setSelectedEmail}
              categoryFilter={categoryFilter}
              onCategoryFilter={setCategoryFilter}
            />
          )}
        </section>

        <main className="min-w-0 bg-white">
          {view === 'stats' ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Analytics opened in the mail list panel.
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="h-full flex items-center justify-center p-10 text-center text-slate-700">
              <div>
                <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h3 className="font-bold text-lg">
                  {gmailConnection?.email ? 'No email found' : 'Connect your Gmail'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {gmailConnection?.email
                    ? 'Try syncing Gmail or changing your filter.'
                    : 'Connect your own ARK Workspace Gmail to start using ARK ONE Mail.'}
                </p>

                <Button
                  className="mt-4 bg-[#ff5a00] hover:bg-[#e65100]"
                  onClick={gmailConnection?.email ? () => syncGmail() : connectGmail}
                  disabled={syncing}
                >
                  {gmailConnection?.email ? (
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  {gmailConnection?.email ? 'Sync Gmail' : 'Connect Gmail'}
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
        </main>
      </div>

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        context={composeContext}
        user={authUser}
        onRefresh={refresh}
      />

      <ConvertToTicketDialog
        open={!!convertEmail}
        email={convertEmail}
        user={authUser}
        onClose={() => setConvertEmail(null)}
        onRefresh={refresh}
      />
    </div>
  );
}