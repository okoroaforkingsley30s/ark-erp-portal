import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  RefreshCw,
  Search,
  User,
  Clock,
  Wifi,
  ShieldCheck,
  Send,
  Reply,
  ReplyAll,
  Forward,
  X,
  ChevronDown,
  Inbox,
  FileText,
  ArrowLeft,
  TicketPlus,
  Paperclip,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { reportError } from '@/lib/errorReporting';
import { Button } from '@/components/ui/button';
import { normalizeMailBody } from '@/lib/mailThread';

function cleanBody(text = '') {
  return normalizeMailBody(text);
}

async function functionErrorMessage(error, fallback) {
  try {
    const response = error?.context;
    if (response?.clone) {
      const payload = await response.clone().json();
      return payload?.details || payload?.error || fallback;
    }
  } catch {
    // Fall back to the stable UI message below.
  }
  return error?.message || fallback;
}

function stripEmailAddress(value = '') {
  const text = String(value || '').trim();
  const match = text.match(/<([^>]+)>/);
  return (match?.[1] || text).trim();
}

function splitEmails(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => stripEmailAddress(item))
    .filter(Boolean);
}

function uniqueEmails(values = []) {
  return [...new Set(values.map((item) => item.toLowerCase()))].join(', ');
}

function ensureReplySubject(subject = '') {
  const cleanSubject = String(subject || '').trim() || '(No subject)';
  return /^re:/i.test(cleanSubject) ? cleanSubject : `Re: ${cleanSubject}`;
}

function ensureForwardSubject(subject = '') {
  const cleanSubject = String(subject || '').trim() || '(No subject)';
  return /^fwd?:/i.test(cleanSubject) ? cleanSubject : `Fwd: ${cleanSubject}`;
}

function formatQuotedMail(email) {
  const sender = email?.sender_name || email?.sender_email || 'Unknown sender';
  const receivedAt = email?.received_at
    ? new Date(email.received_at).toLocaleString()
    : '';
  const body = cleanBody(email?.message_body || email?.snippet || '');

  return [
    '',
    '',
    '---------- Forwarded message ----------',
    `From: ${sender}${email?.sender_email ? ` <${stripEmailAddress(email.sender_email)}>` : ''}`,
    `Date: ${receivedAt}`,
    `Subject: ${email?.subject || '(No subject)'}`,
    `To: ${email?.recipient_email || ''}`,
    email?.cc ? `Cc: ${email.cc}` : '',
    '',
    body,
  ]
    .filter(Boolean)
    .join('\n');
}

function initialComposeState() {
  return {
    mode: 'compose',
    originalEmailId: '',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
  };
}

function RecipientInput({ value, onChange, placeholder, contacts }) {
  const token = value.split(',').at(-1)?.trim().toLowerCase() || '';
  const matches = token.length < 2 ? [] : contacts
    .filter((contact) => contact.email.includes(token) || contact.name.toLowerCase().includes(token))
    .slice(0, 8);

  const choose = (email) => {
    const parts = value.split(',');
    parts[parts.length - 1] = ` ${email}`;
    onChange(parts.map((part) => part.trim()).filter(Boolean).join(', '));
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#ff5a00]"
      />
      {matches.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {matches.map((contact) => (
            <button key={contact.email} type="button" onClick={() => choose(contact.email)} className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100">
              <span className="font-medium">{contact.name || contact.email}</span>
              {contact.name && <span className="ml-2 text-xs text-slate-500">{contact.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OfficialMailInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [gmailConnection, setGmailConnection] = useState(null);

  const [activeFolder, setActiveFolder] = useState('inbox');
  const [loading, setLoading] = useState(true);
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');

  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState(initialComposeState());
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [directoryContacts, setDirectoryContacts] = useState([]);
  const [openingAttachment, setOpeningAttachment] = useState('');

  const loadGmailConnection = async () => {
    if (!user?.id) {
      setGmailConnection(null);
      setLoadingConnection(false);
      return;
    }

    try {
      setLoadingConnection(true);

      const { data, error } = await supabase
        .from('gmail_connections')
        .select('email, provider, is_active, connected_at, expires_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        reportError(error, { context: 'gmail.connection.query', notify: false });
        setGmailConnection(null);
        return;
      }

      setGmailConnection(data || null);
    } catch (error) {
      reportError(error, { context: 'gmail.connection.load', notify: false });
      setGmailConnection(null);
    } finally {
      setLoadingConnection(false);
    }
  };

  const loadEmails = async (showRefresh = false) => {
    if (!user?.id) {
      setLoading(false);
      setEmails([]);
      setSelectedEmail(null);
      return;
    }

    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setErrorMessage('');

      const { data, error } = await supabase
        .from('email_messages')
        .select(`
          id,
          subject,
          sender_name,
          sender_email,
          recipient_email,
          recipient_name,
          cc,
          bcc,
          message_body,
          snippet,
          email_status,
          is_read,
          is_sent,
          is_draft,
          archived_status,
          received_at,
          created_at,
          updated_at,
          synced_at,
          gmail_thread_id,
          gmail_message_id,
          attachments,
          converted_to_ticket,
          linked_ticket_id,
          direction,
          folder
        `)
        .eq('created_by', user.id)
        .order('received_at', { ascending: false })
        .limit(80);

      if (error) {
        reportError(error, { context: 'gmail.messages.query', notify: false });
        setErrorMessage(error.message || 'Unable to load emails.');
        setEmails([]);
        setSelectedEmail(null);
        return;
      }

      const rows = data || [];
      setEmails(rows);

      setSelectedEmail((current) => {
        if (!current?.id) return null;
        return rows.find((email) => email.id === current.id) || null;
      });
    } catch (error) {
      reportError(error, { context: 'gmail.messages.load', notify: false });
      setErrorMessage('Unable to load emails. Please try again.');
      setEmails([]);
      setSelectedEmail(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const connectGmail = async () => {
    if (!user?.id) {
      alert('User session not ready. Please refresh and try again.');
      return;
    }

    const { data, error } = await supabase.functions.invoke('gmail-oauth', {
      body: {},
    });

    if (error || !data?.authorization_url) {
      reportError(error || new Error('OAuth authorization URL was not returned.'), {
        context: 'gmail.oauth.start',
        userMessage: 'Unable to start Gmail connection. Please try again.',
      });
      return;
    }

    window.open(data.authorization_url, '_blank', 'noopener,noreferrer');
  };

  const syncGmail = async ({ silent = false } = {}) => {
    if (!gmailConnection?.email) {
      if (!silent) alert('Please connect Gmail first.');
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
        const message = await functionErrorMessage(error, 'Failed to sync Gmail.');
        reportError(error, { context: 'gmail.sync.invoke', notify: false });
        if (!silent) setErrorMessage(message);
        return;
      }

      await loadEmails(true);
      if (!silent) alert(`Gmail sync completed. Synced ${data?.synced ?? 0} email(s).`);
    } catch (error) {
      reportError(error, { context: 'gmail.sync.unexpected', notify: false });
      if (!silent) setErrorMessage('Failed to sync Gmail. Please reconnect the mailbox and retry.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadGmailConnection();
    loadEmails();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('users')
      .select('full_name,email')
      .eq('is_approved', true)
      .not('email', 'is', null)
      .limit(500)
      .then(({ data }) => setDirectoryContacts(data || []));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !gmailConnection?.email) return undefined;

    const refreshMailbox = () => {
      if (document.visibilityState === 'visible') syncGmail({ silent: true });
    };

    refreshMailbox();
    const interval = window.setInterval(refreshMailbox, 60_000);
    document.addEventListener('visibilitychange', refreshMailbox);

    const channel = supabase
      .channel(`official-mail-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_messages', filter: `created_by=eq.${user.id}` },
        () => loadEmails(true),
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshMailbox);
      supabase.removeChannel(channel);
    };
  }, [user?.id, gmailConnection?.email]);

  const stats = useMemo(() => {
    return {
      inbox: emails.filter((e) => !e.is_sent && !e.is_draft && !e.archived_status).length,
      sent: emails.filter((e) => e.is_sent || e.folder === 'sent' || e.direction === 'sent').length,
      drafts: emails.filter((e) => e.is_draft || e.folder === 'drafts').length,
      all: emails.length,
    };
  }, [emails]);

  const folderEmails = useMemo(() => {
    return emails.filter((email) => {
      if (activeFolder === 'sent') {
        return email.is_sent || email.folder === 'sent' || email.direction === 'sent';
      }

      if (activeFolder === 'drafts') {
        return email.is_draft || email.folder === 'drafts';
      }

      if (activeFolder === 'all') {
        return true;
      }

      return !email.is_sent && !email.is_draft && !email.archived_status;
    });
  }, [emails, activeFolder]);

  const filteredEmails = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return folderEmails;

    return folderEmails.filter((email) => {
      return (
        (email.subject || '').toLowerCase().includes(query) ||
        (email.sender_name || '').toLowerCase().includes(query) ||
        (email.sender_email || '').toLowerCase().includes(query) ||
        (email.recipient_email || '').toLowerCase().includes(query) ||
        (email.snippet || '').toLowerCase().includes(query)
      );
    });
  }, [folderEmails, search]);

  const selectedConversation = useMemo(() => {
    if (!selectedEmail) return [];
    const rows = selectedEmail.gmail_thread_id
      ? emails.filter((email) => email.gmail_thread_id === selectedEmail.gmail_thread_id)
      : [selectedEmail];
    return [...rows].sort(
      (a, b) => new Date(a.received_at || a.created_at) - new Date(b.received_at || b.created_at),
    );
  }, [emails, selectedEmail]);

  const contactSuggestions = useMemo(() => {
    const contacts = new Map();
    for (const item of directoryContacts) {
      const email = stripEmailAddress(item.email).toLowerCase();
      if (email) contacts.set(email, { email, name: item.full_name || '' });
    }
    for (const email of emails) {
      for (const address of [email.sender_email, email.recipient_email, email.cc, email.bcc].flatMap(splitEmails)) {
        const normalized = address.toLowerCase();
        if (normalized && !contacts.has(normalized)) contacts.set(normalized, { email: normalized, name: '' });
      }
    }
    return [...contacts.values()];
  }, [directoryContacts, emails]);

  const changeFolder = (folder) => {
    setActiveFolder(folder);
    setSelectedEmail(null);
    setSearch('');
  };

  const openComposer = (mode = 'compose') => {
    if (!gmailConnection?.email) {
      alert('Please connect Gmail first.');
      return;
    }

    setComposerError('');
    setShowCcBcc(false);

    if (mode === 'compose' || !selectedEmail) {
      setComposer(initialComposeState());
      setComposerOpen(true);
      return;
    }

    const ownEmail = stripEmailAddress(gmailConnection.email).toLowerCase();
    const senderEmail = stripEmailAddress(selectedEmail.sender_email);
    const recipientEmails = splitEmails(selectedEmail.recipient_email);
    const ccEmails = splitEmails(selectedEmail.cc);

    let to = senderEmail;
    let cc = '';

    if (mode === 'replyAll') {
      const everyone = [
        senderEmail,
        ...recipientEmails,
        ...ccEmails,
      ].filter((email) => email && email.toLowerCase() !== ownEmail);

      to = uniqueEmails(everyone);
      setShowCcBcc(true);
    }

    if (selectedEmail.is_sent || selectedEmail.direction === 'sent') {
      to = recipientEmails.join(', ');
    }

    if (mode === 'forward') {
      setComposer({
        mode: 'forward',
        originalEmailId: selectedEmail.id,
        to: '',
        cc: '',
        bcc: '',
        subject: ensureForwardSubject(selectedEmail.subject),
        body: formatQuotedMail(selectedEmail),
      });
      setShowCcBcc(true);
      setComposerOpen(true);
      return;
    }

    setComposer({
      mode,
      originalEmailId: selectedEmail.id,
      to,
      cc,
      bcc: '',
      subject: ensureReplySubject(selectedEmail.subject),
      body: '',
    });

    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (sending) return;

    setComposerOpen(false);
    setComposer(initialComposeState());
    setComposerError('');
    setShowCcBcc(false);
  };

  const updateComposer = (field, value) => {
    setComposer((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const sendEmail = async () => {
    const to = composer.to.trim();
    const subject = composer.subject.trim();
    const body = composer.body.trim();

    if (!to) return setComposerError('Please enter at least one recipient.');
    if (!subject) return setComposerError('Please enter an email subject.');
    if (!body) return setComposerError('Please write your message before sending.');

    try {
      setSending(true);
      setComposerError('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setComposerError('Your session has expired. Please log in again.');
        return;
      }

      const isReply = composer.mode === 'reply' || composer.mode === 'replyAll';
      const functionName = isReply ? 'gmail-reply' : 'gmail-send';

      const payload = isReply
        ? {
            originalEmailId: composer.originalEmailId,
            to,
            cc: composer.cc.trim(),
            subject,
            body: composer.body.replace(/\n/g, '<br/>'),
          }
        : {
            to,
            cc: composer.cc.trim(),
            bcc: composer.bcc.trim(),
            subject,
            body: composer.body.replace(/\n/g, '<br/>'),
          };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        reportError(error, { context: `gmail.message.${isReply ? 'reply' : 'send'}`, notify: false });
        setComposerError(await functionErrorMessage(error, 'Unable to send email.'));
        return;
      }

      if (data?.error) {
        reportError(new Error(data.error), {
          context: `gmail.message.${isReply ? 'reply' : 'send'}.response`,
          metadata: { functionName },
          notify: false,
        });
        setComposerError(data.error || 'Unable to send email.');
        return;
      }

      closeComposer();
      await loadEmails(true);
      alert(
        isReply
          ? 'Reply accepted by Google and saved in Sent Mail.'
          : 'Email accepted by Google and saved in Sent Mail.',
      );
    } catch (error) {
      reportError(error, { context: 'gmail.message.send.unexpected', notify: false });
      setComposerError('Unable to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const composerTitle =
    {
      compose: 'New Message',
      reply: 'Reply',
      replyAll: 'Reply All',
      forward: 'Forward',
    }[composer.mode] || 'New Message';

  const navItems = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, count: stats.inbox },
    { key: 'sent', label: 'Sent', icon: Send, count: stats.sent },
    { key: 'drafts', label: 'Drafts', icon: FileText, count: stats.drafts },
    { key: 'all', label: 'All Mail', icon: Mail, count: stats.all },
  ];

  const convertToTicket = () => {
    if (!selectedEmail || selectedEmail.converted_to_ticket) return;
    const body = cleanBody(selectedEmail.message_body || selectedEmail.snippet || '');
    const combined = `${selectedEmail.subject || ''}\n${body}`;
    const priority = /critical|urgent|down|offline|cannot transact/i.test(combined)
      ? 'high'
      : /minor|low priority/i.test(combined) ? 'low' : 'medium';
    const category = /network|connectivity|internet|link/i.test(combined)
      ? 'network'
      : /software|application|error|login/i.test(combined) ? 'software' : 'hardware';

    navigate('/tickets', {
      state: {
        createTicketFromEmail: {
          emailId: selectedEmail.id,
          attachments: selectedEmail.attachments || [],
          form: {
            title: selectedEmail.subject || 'Support request received by email',
            description: `Reported by: ${selectedEmail.sender_email || 'Unknown'}\n\n${body}`,
            category,
            priority,
          },
        },
      },
    });
  };

  const openAttachment = async (message, attachment) => {
    try {
      setOpeningAttachment(attachment.attachment_id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session has expired.');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-attachment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailId: message.id, attachmentId: attachment.attachment_id }),
      });
      if (!response.ok) throw new Error((await response.json())?.error || 'Attachment could not be opened.');
      const url = URL.createObjectURL(await response.blob());
      const previewable = /^(image|video|audio)\//.test(attachment.mime_type || '') || attachment.mime_type === 'application/pdf';
      if (previewable) window.open(url, '_blank', 'noopener,noreferrer');
      else {
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.filename || 'attachment';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      alert(error.message || 'Attachment could not be opened.');
    } finally {
      setOpeningAttachment('');
    }
  };

  return (
    <div className="h-[calc(100dvh-8rem)] min-h-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#071133] text-white shadow-xl">
      <div className="grid h-full min-h-0 w-full grid-cols-1 xl:grid-cols-[230px_minmax(360px,470px)_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#08153d] p-4 xl:flex xl:flex-col">
          <button
            onClick={() => openComposer('compose')}
            className="w-full rounded-xl bg-[#ff5a00] px-4 py-3 text-left text-sm font-semibold text-white hover:bg-[#e65100]"
          >
            Compose
          </button>

          <div className="mt-6 space-y-1 text-sm">
            {navItems.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => changeFolder(key)}
                className={[
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition',
                  activeFolder === key
                    ? 'bg-[#ff5a00]/15 text-[#ffb38a]'
                    : 'text-slate-300 hover:bg-white/10',
                ].join(' ')}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/10 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Wifi className="h-3.5 w-3.5 text-green-400" />
              <span className="truncate">
                {loadingConnection
                  ? 'Checking Gmail...'
                  : gmailConnection?.email || 'No Gmail connected'}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
              {gmailConnection?.is_active ? 'Google Active' : 'Not Connected'}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={connectGmail}
              className="mt-3 h-8 w-full border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
            >
              {gmailConnection?.email ? 'Reconnect Gmail' : 'Connect Gmail'}
            </Button>
          </div>
        </aside>

        <section className={`${selectedEmail ? 'hidden xl:flex' : 'flex'} min-h-0 min-w-0 flex-col overflow-hidden border-r border-white/10 bg-[#0a1744]`}>
          <div className="shrink-0 border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold">Official Mail</h1>
                <p className="text-xs text-slate-400">
                  {loading
                    ? 'Loading mailbox...'
                    : `${filteredEmails.length} shown / ${emails.length} total`}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openComposer('compose')}
                  className="text-slate-300 hover:bg-white/10 hover:text-white xl:hidden"
                  title="Compose email"
                >
                  <Send className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => loadEmails(true)}
                  disabled={loading || refreshing}
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                  title="Refresh mail list"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`}
                  />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={syncGmail}
                  disabled={syncing || !gmailConnection?.email}
                  className="text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  title="Sync Gmail"
                >
                  <Mail className={`h-4 w-4 ${syncing ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#ff5a00]"
                placeholder="Search mail..."
              />
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto xl:hidden">
              {navItems.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => changeFolder(key)}
                  className={[
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs',
                    activeFolder === key
                      ? 'border-[#ff5a00] bg-[#ff5a00] text-white'
                      : 'border-white/10 bg-white/10 text-slate-300',
                  ].join(' ')}
                >
                  {label} {count}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain">
            {loading && (
              <div className="p-6 text-center text-sm text-slate-400">
                Loading your email list...
              </div>
            )}

            {!loading && errorMessage && (
              <div className="p-6 text-center text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            {!loading && !errorMessage && filteredEmails.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">
                No emails found in this folder.
              </div>
            )}

            {!loading &&
              !errorMessage &&
              filteredEmails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;

                return (
                  <button
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={[
                      'w-full border-b border-white/10 px-4 py-3 text-left transition',
                      isSelected
                        ? 'border-l-2 border-l-[#ff5a00] bg-[#ff5a00]/15'
                        : 'hover:bg-white/5',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-white">
                        {email.sender_name || email.sender_email || 'Unknown sender'}
                      </p>

                      <span className="shrink-0 text-[11px] text-slate-500">
                        {email.received_at
                          ? new Date(email.received_at).toLocaleDateString()
                          : ''}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-slate-200">
                      {email.subject || '(No subject)'}
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {email.snippet || 'No preview available'}
                    </p>
                  </button>
                );
              })}
          </div>
        </section>

        <main className={`${selectedEmail ? 'flex' : 'hidden xl:flex'} min-h-0 min-w-0 flex-col bg-white text-slate-800`}>
          {!selectedEmail ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <Mail className="mx-auto h-14 w-14 text-slate-300" />
                <h2 className="mt-4 text-xl font-bold">Select an email</h2>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  Click any mail in the list to read the full message.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="shrink-0 border-b bg-white px-4 py-4 sm:px-6 sm:py-5">
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  className="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-[#102969] hover:bg-slate-100 xl:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to mail list
                </button>
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                  <h2 className="max-w-4xl text-2xl font-bold leading-tight text-slate-950">
                    {selectedEmail.subject || '(No subject)'}
                  </h2>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openComposer('reply')}
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <Reply className="mr-1.5 h-3.5 w-3.5" />
                      Reply
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openComposer('replyAll')}
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <ReplyAll className="mr-1.5 h-3.5 w-3.5" />
                      Reply all
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openComposer('forward')}
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <Forward className="mr-1.5 h-3.5 w-3.5" />
                      Forward
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={convertToTicket}
                      disabled={selectedEmail.converted_to_ticket}
                      className="border-[#ff5a00] text-[#c44600] hover:bg-orange-50"
                    >
                      <TicketPlus className="mr-1.5 h-3.5 w-3.5" />
                      {selectedEmail.converted_to_ticket ? 'Ticket created' : 'Convert to ticket'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 touch-pan-y overflow-y-scroll overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
                <div className="mx-auto max-w-5xl space-y-5">
                  {selectedConversation.map((message) => {
                    const messageThread = normalizeMailBody(message.message_body || message.snippet || '');
                    return <section key={message.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex items-start gap-4 border-b pb-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#102969] text-sm font-bold text-white">
                      {(message.sender_name ||
                        message.sender_email ||
                        'M')
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-semibold text-slate-900">
                        <User className="h-4 w-4 text-slate-400" />
                        {message.sender_name ||
                          message.sender_email ||
                          'Unknown sender'}
                      </p>

                      {message.sender_email && (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          From: {message.sender_email}
                        </p>
                      )}

                      {message.recipient_email && (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          To: {message.recipient_email}
                        </p>
                      )}

                      {message.cc && (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          CC: {message.cc}
                        </p>
                      )}

                      {message.bcc && (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          BCC: {message.bcc}
                        </p>
                      )}
                    </div>

                    {message.received_at && (
                      <p className="hidden shrink-0 items-center gap-1 text-xs text-slate-500 lg:flex">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(message.received_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <article className="mt-6">
                    <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-900">
                    {messageThread || (
                      <span className="italic text-slate-500">
                        No message body available.
                      </span>
                    )}
                    </div>
                  </article>
                  {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                    <div className="mt-5 border-t pt-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Paperclip className="h-4 w-4" /> Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <button type="button" onClick={() => openAttachment(message, attachment)} disabled={openingAttachment === attachment.attachment_id} key={attachment.attachment_id} className="rounded-lg border bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100 disabled:opacity-50">
                            {openingAttachment === attachment.attachment_id ? 'Opening…' : attachment.filename} · {Math.max(1, Math.ceil((attachment.size || 0) / 1024))} KB
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </section>})}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between bg-[#102969] px-5 py-4 text-white">
              <h3 className="font-semibold">{composerTitle}</h3>

              <button
                onClick={closeComposer}
                disabled={sending}
                className="rounded-lg p-1 hover:bg-white/10 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {composerError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {composerError}
                </div>
              )}

              <div className="space-y-3">
                <RecipientInput value={composer.to} onChange={(value) => updateComposer('to', value)} placeholder="To" contacts={contactSuggestions} />

                <button
                  type="button"
                  onClick={() => setShowCcBcc((current) => !current)}
                  className="flex items-center gap-1 text-xs font-medium text-[#102969] hover:text-[#ff5a00]"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${showCcBcc ? 'rotate-180' : ''}`}
                  />
                  {showCcBcc ? 'Hide CC / BCC' : 'Add CC / BCC'}
                </button>

                {showCcBcc && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <RecipientInput value={composer.cc} onChange={(value) => updateComposer('cc', value)} placeholder="CC" contacts={contactSuggestions} />

                    <RecipientInput value={composer.bcc} onChange={(value) => updateComposer('bcc', value)} placeholder="BCC" contacts={contactSuggestions} />
                  </div>
                )}

                <input
                  value={composer.subject}
                  onChange={(event) => updateComposer('subject', event.target.value)}
                  placeholder="Subject"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#ff5a00]"
                />

                <textarea
                  value={composer.body}
                  onChange={(event) => updateComposer('body', event.target.value)}
                  placeholder="Write your message..."
                  className="min-h-[280px] w-full resize-y rounded-xl border border-slate-200 p-3 text-sm leading-6 text-slate-900 outline-none focus:border-[#ff5a00]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs text-slate-500">
                Sending from {gmailConnection?.email || 'connected Gmail'}
              </p>

              <Button
                onClick={sendEmail}
                disabled={sending}
                className="bg-[#ff5a00] text-white hover:bg-[#e65100]"
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
