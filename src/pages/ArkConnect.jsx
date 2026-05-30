import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  Send,
  MessageSquare,
  Lock,
  Bot,
  Hash,
  Search,
  Loader2,
  Menu,
  X,
} from 'lucide-react';

import { format } from 'date-fns';
import { toast } from 'sonner';

const ALL_CHANNELS = [
  'General',
  'Operations',
  'Helpdesk',
  'Engineers',
  'HR',
  'Finance',
  'Inventory',
  'Management',
  'Announcements',
];

const CHANNEL_ICONS = {
  General: '🌐',
  Operations: '⚙️',
  Helpdesk: '🎧',
  Engineers: '🔧',
  HR: '👥',
  Finance: '💰',
  Inventory: '📦',
  Management: '🏢',
  Announcements: '📢',
};

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  hr: 'HR',
  finance: 'Finance',
  inventory: 'Inventory',
  engineer: 'Engineer',
  helpdesk: 'Helpdesk',
  procurement: 'Procurement',
  ceo: 'CEO',
  agm: 'AGM',
  repair_head: 'Repair Head',
  repair_technician: 'Repair Technician',
  crm: 'CRM',
  user: 'Staff',
  staff: 'Staff',
};

const BOT_ANSWERS = [
  {
    kw: ['ticket', 'create ticket', 'raise ticket'],
    answer:
      'To create a ticket: go to Tickets → New Ticket → fill the details → submit.',
  },
  {
    kw: ['spare part', 'request part', 'parts'],
    answer:
      'To request spare parts: go to Inventory → Request Part → select the part and submit.',
  },
  {
    kw: ['leave', 'leave request'],
    answer: 'To submit leave: go to HR Portal → Leave → Request Leave.',
  },
  {
    kw: ['loan'],
    answer: 'To request loan: go to HR Portal → Loans → Request Loan.',
  },
  {
    kw: ['hello', 'hi', 'hey', 'help'],
    answer:
      'Hello! I am ARK Assistant. I can help with tickets, parts, leave, loans, devices, and SLA.',
  },
];

function getBotAnswer(msg) {
  const lower = msg.toLowerCase();

  for (const { kw, answer } of BOT_ANSWERS) {
    if (kw.some((k) => lower.includes(k))) return answer;
  }

  return 'I am not sure about that. Please contact the relevant department.';
}

function Avatar({ name, size = 'sm' }) {
  const s =
    size === 'sm'
      ? 'w-9 h-9 text-sm'
      : 'w-12 h-12 text-base';

  return (
    <div
      className={`${s} rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 text-[#ff5a00] flex items-center justify-center font-black flex-shrink-0 shadow-[0_0_16px_rgba(255,90,0,0.12)]`}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function MessageBubble({ msg, isMine }) {
  return (
    <div
      className={`flex gap-3 ${
        isMine ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      <Avatar name={msg.sender_name} />

      <div
        className={`max-w-[78%] flex flex-col gap-1 ${
          isMine ? 'items-end' : 'items-start'
        }`}
      >
        {!isMine && (
          <span className="text-[11px] text-slate-300 px-1">
            {msg.sender_name}
            {msg.sender_role
              ? ` · ${ROLE_LABELS[msg.sender_role] || msg.sender_role}`
              : ''}
          </span>
        )}

        <div
          className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-lg ${
            isMine
              ? 'bg-[#ff5a00] text-white rounded-tr-sm shadow-[0_0_24px_rgba(255,90,0,0.18)]'
              : 'bg-[#102969] text-slate-100 rounded-tl-sm border border-white/10'
          }`}
        >
          {msg.message_body}
        </div>

        <span className="text-[10px] text-slate-400 px-1">
          {msg.created_at
            ? format(new Date(msg.created_at), 'HH:mm')
            : ''}
        </span>
      </div>
    </div>
  );
}

function BotBubble({ text }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-[#ff5a00]" />
      </div>

      <div className="max-w-[80%]">
        <span className="text-[11px] text-[#ff5a00] px-1 font-semibold">
          ARK Assistant
        </span>

        <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-[#ff5a00]/10 border border-[#ff5a00]/20 text-slate-100 whitespace-pre-wrap">
          {text}
        </div>
      </div>
    </div>
  );
}

export default function ArkConnect() {
  const { user } = useOutletContext();
  const qc = useQueryClient();

  const [view, setView] = useState('channel');
  const [activeChannel, setActiveChannel] = useState('General');
  const [dmRecipient, setDmRecipient] = useState(null);
  const [botMessages, setBotMessages] = useState([
    {
      type: 'bot',
      text: 'Hello! I am ARK Assistant. How can I help you today?',
    },
  ]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const createArkNotification = async ({
    userEmail,
    title,
    message,
    type,
    link = '/ark-connect',
    sound = 'click',
  }) => {
    if (!userEmail) return false;

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_email: userEmail,
        title,
        message,
        type,
        link,
        sound,
        read: false,
      });

    if (error) {
      console.error('ARK Connect notification error:', error);
      return false;
    }

    return true;
  };

  const { data: employees = [] } = useQuery({
    queryKey: ['ark-connect-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Employees fetch error:', error);
        return [];
      }

      return data || [];
    },
    staleTime: 60000,
  });

  const allContacts = useMemo(() => {
    return employees
      .filter((e) => {
        const empEmail =
          e.email_address || e.email || e.user_account_email || '';

        return (
          empEmail &&
          empEmail !== user?.email &&
          e.employment_status !== 'Terminated' &&
          e.employment_status !== 'Resigned'
        );
      })
      .map((e) => ({
        id: e.id,
        email: e.email_address || e.email || e.user_account_email || '',
        full_name: e.full_name,
        role: e.access_role || e.role || e.job_title || 'staff',
        department: e.department,
        profile_photo: e.profile_photo,
      }));
  }, [employees, user]);

  const filteredContacts = allContacts.filter(
    (c) =>
      !staffSearch ||
      (c.full_name || '')
        .toLowerCase()
        .includes(staffSearch.toLowerCase()) ||
      (c.email || '')
        .toLowerCase()
        .includes(staffSearch.toLowerCase()) ||
      (c.role || '')
        .toLowerCase()
        .includes(staffSearch.toLowerCase()) ||
      (c.department || '')
        .toLowerCase()
        .includes(staffSearch.toLowerCase())
  );

  const { data: channelMessages = [] } = useQuery({
    queryKey: ['chat-channel', activeChannel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('message_type', 'channel')
        .eq('channel_name', activeChannel)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Channel messages error:', error);
        return [];
      }

      return data || [];
    },
    enabled: view === 'channel',
    refetchInterval: 4000,
  });

  const { data: dmMessages = [] } = useQuery({
    queryKey: ['chat-dm', user?.email, dmRecipient?.email],
    queryFn: async () => {
      if (!dmRecipient || !user?.email) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('message_type', 'dm')
        .or(
          `and(sender_id.eq.${user.email},recipient_id.eq.${dmRecipient.email}),and(sender_id.eq.${dmRecipient.email},recipient_id.eq.${user.email})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('DM messages error:', error);
        return [];
      }

      return data || [];
    },
    enabled: view === 'dm' && !!dmRecipient && !!user?.email,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [channelMessages, dmMessages, botMessages, view, dmRecipient]);

  const sendChannelMsg = async () => {
    if (!msgInput.trim() || sending || !user?.email) return;

    setSending(true);

    try {
      const messageText = msgInput.trim();

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: user.email,
          sender_name: user.full_name || user.email,
          sender_role: user.role,

          recipient_id: null,
          recipient_name: null,

          message_type: 'channel',
          channel_name: activeChannel,

          message_body: messageText,
        });

      if (error) throw error;

      const recipients = allContacts.filter(
        (contact) =>
          contact.email &&
          contact.email.toLowerCase() !== user.email.toLowerCase()
      );

      await Promise.allSettled(
        recipients.map((contact) =>
          createArkNotification({
            userEmail: contact.email,
            title: `New message in ${activeChannel}`,
            message: `${
              user.full_name || user.email
            } posted in ${activeChannel}.`,
            type: 'ark_connect_channel',
            link: '/ark-connect',
            sound: 'click',
          })
        )
      );

      setMsgInput('');

      qc.invalidateQueries({
        queryKey: ['chat-channel', activeChannel],
      });

      qc.invalidateQueries({
        queryKey: ['notifications'],
      });
    } catch (err) {
      toast.error(
        'Failed to send: ' + (err?.message || 'Unknown error')
      );
    } finally {
      setSending(false);
    }
  };

  const sendDM = async () => {
    if (!msgInput.trim() || !dmRecipient || sending || !user?.email) {
      return;
    }

    setSending(true);

    try {
      const messageText = msgInput.trim();

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: user.email,
          sender_name: user.full_name || user.email,
          sender_role: user.role,

          recipient_id: dmRecipient.email,
          recipient_name: dmRecipient.full_name,

          message_type: 'dm',
          channel_name: null,

          message_body: messageText,
        });

      if (error) throw error;

      await createArkNotification({
        userEmail: dmRecipient.email,
        title: 'New ARK Connect Message',
        message: `${
          user.full_name || user.email
        } sent you a private message.`,
        type: 'ark_connect_dm',
        link: '/ark-connect',
        sound: 'click',
      });

      setMsgInput('');

      qc.invalidateQueries({
        queryKey: ['chat-dm', user.email, dmRecipient.email],
      });

      qc.invalidateQueries({
        queryKey: ['notifications'],
      });
    } catch (err) {
      toast.error(
        'Failed to send: ' + (err?.message || 'Unknown error')
      );
    } finally {
      setSending(false);
    }
  };

  const sendBot = () => {
    if (!msgInput.trim()) return;

    const q = msgInput.trim();

    setBotMessages((prev) => [
      ...prev,
      {
        type: 'user',
        text: q,
      },
    ]);

    setMsgInput('');

    setTimeout(() => {
      setBotMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: getBotAnswer(q),
        },
      ]);
    }, 400);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (view === 'channel') sendChannelMsg();
      else if (view === 'dm') sendDM();
      else sendBot();
    }
  };

  const navTo = (newView, channel = null) => {
    setView(newView);

    if (channel) setActiveChannel(channel);

    setSidebarOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#ff5a00]/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#ff5a00]" />
          </div>

          <div>
            <p className="text-sm font-bold text-white">
              ARK Connect
            </p>

            <p className="text-[10px] text-slate-300">
              Internal Communication
            </p>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-2 rounded-xl hover:bg-white/5 text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 pt-2 pb-1">
          Public Channels
        </p>

        {ALL_CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => navTo('channel', ch)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium transition-all text-left border ${
              view === 'channel' && activeChannel === ch
                ? 'bg-[#ff5a00]/15 text-[#ff5a00] border-[#ff5a00]/20'
                : 'text-slate-200 border-transparent hover:bg-[#ff5a00]/10 hover:text-[#ff5a00]'
            }`}
          >
            <span>{CHANNEL_ICONS[ch] || '#'}</span>
            <span>{ch}</span>
          </button>
        ))}

        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 pt-4 pb-1">
          Direct Messages
        </p>

        <button
          onClick={() => navTo('dm')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium transition-all text-left border ${
            view === 'dm'
              ? 'bg-[#ff5a00]/15 text-[#ff5a00] border-[#ff5a00]/20'
              : 'text-slate-200 border-transparent hover:bg-[#ff5a00]/10 hover:text-[#ff5a00]'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Private Messages</span>
        </button>

        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 pt-4 pb-1">
          Assistant
        </p>

        <button
          onClick={() => navTo('bot')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium transition-all text-left border ${
            view === 'bot'
              ? 'bg-[#ff5a00]/15 text-[#ff5a00] border-[#ff5a00]/20'
              : 'text-slate-200 border-transparent hover:bg-[#ff5a00]/10 hover:text-[#ff5a00]'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>ARK Assistant</span>
        </button>
      </div>

      <div className="p-4 border-t border-[#ff5a00]/20">
        <div className="flex items-center gap-2">
          <Avatar name={user?.full_name || user?.email} />

          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user?.full_name || user?.email}
            </p>

            <p className="text-[10px] text-slate-300 truncate">
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="flex overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.35)] relative bg-[#08153d]"
      style={{ height: 'calc(100dvh - 6rem)' }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0" />
        </div>
      )}

      <aside
        className={`absolute lg:relative top-0 left-0 h-full z-50 w-64 flex-shrink-0 border-r border-[#ff5a00]/20 flex flex-col bg-gradient-to-b from-[#08153d] via-[#0b1f5e] to-[#102969] transform transition-transform duration-300 ${
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <SidebarContent />
      </aside>

      <div className="flex flex-1 overflow-hidden">
        {view === 'dm' && (
          <div className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col bg-[#0b1f5e]/80">
            <div className="p-3 border-b border-white/10">
              <p className="text-xs font-bold text-white mb-2 px-1">
                All Staff ({filteredContacts.length})
              </p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />

                <Input
                  placeholder="Search…"
                  className="pl-9 h-9 text-xs"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {filteredContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDmRecipient(c)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-left text-xs transition-all border ${
                    dmRecipient?.id === c.id
                      ? 'bg-[#ff5a00]/15 text-[#ff5a00] border-[#ff5a00]/20'
                      : 'border-transparent text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <div className="w-9 h-9 rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 text-[#ff5a00] flex items-center justify-center text-xs font-black flex-shrink-0 overflow-hidden">
                    {c.profile_photo ? (
                      <img
                        src={c.profile_photo}
                        alt={c.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      c.full_name?.[0]?.toUpperCase() || '?'
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {c.full_name || c.email}
                    </p>

                    <p className="text-[10px] text-slate-400 truncate">
                      {ROLE_LABELS[c.role] ||
                        c.role ||
                        c.department ||
                        'Staff'}
                    </p>
                  </div>
                </button>
              ))}

              {filteredContacts.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  No staff found
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 bg-[#102969]/90">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0 lg:hidden"
            >
              <Menu className="w-4 h-4 text-slate-300" />
            </button>

            {view === 'channel' && (
              <>
                <Hash className="w-5 h-5 text-[#ff5a00]" />
                <span className="font-bold text-white">
                  {activeChannel}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Public Channel
                </Badge>
              </>
            )}

            {view === 'dm' && (
              <>
                <Lock className="w-5 h-5 text-[#ff5a00]" />
                <span className="font-bold text-white">
                  {dmRecipient
                    ? dmRecipient.full_name
                    : 'Direct Messages'}
                </span>

                {dmRecipient && (
                  <Badge variant="outline" className="text-[9px]">
                    {ROLE_LABELS[dmRecipient.role] ||
                      dmRecipient.role ||
                      'Staff'}
                  </Badge>
                )}
              </>
            )}

            {view === 'bot' && (
              <>
                <Bot className="w-5 h-5 text-[#ff5a00]" />
                <span className="font-bold text-white">
                  ARK Assistant
                </span>
                <Badge className="text-[10px]">AI Bot</Badge>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#08153d] via-[#0b1f5e] to-[#08153d]">
            {view === 'channel' && (
              <>
                {channelMessages.length === 0 && (
                  <div className="text-center py-16 text-slate-300 text-sm">
                    <span className="text-3xl mb-3 block">
                      {CHANNEL_ICONS[activeChannel] || '#'}
                    </span>
                    No messages yet in #{activeChannel}. Be the first to say
                    something!
                  </div>
                )}

                {channelMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.sender_id === user?.email}
                  />
                ))}
              </>
            )}

            {view === 'dm' && (
              <>
                {!dmRecipient && (
                  <div className="text-center py-16 text-slate-300 text-sm">
                    <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      Select a staff member
                    </p>
                    <p className="text-xs mt-1">
                      Choose anyone from the list to start a private
                      conversation
                    </p>
                  </div>
                )}

                {dmRecipient && dmMessages.length === 0 && (
                  <div className="text-center py-16 text-slate-300 text-sm">
                    <Avatar name={dmRecipient.full_name} size="lg" />
                    <p className="font-medium mt-3">
                      {dmRecipient.full_name}
                    </p>
                    <p className="text-xs mt-1">
                      Start your private conversation
                    </p>
                  </div>
                )}

                {dmMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.sender_id === user?.email}
                  />
                ))}
              </>
            )}

            {view === 'bot' && (
              <div className="space-y-3">
                {botMessages.map((msg, i) =>
                  msg.type === 'bot' ? (
                    <BotBubble key={i} text={msg.text} />
                  ) : (
                    <MessageBubble
                      key={i}
                      msg={{
                        sender_name: user?.full_name || user?.email,
                        message_body: msg.text,
                        sender_id: user?.email,
                      }}
                      isMine={true}
                    />
                  )
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {(view === 'channel' ||
            view === 'bot' ||
            (view === 'dm' && dmRecipient)) && (
            <div className="p-4 border-t border-white/10 bg-[#102969]/95">
              <div className="flex gap-3 items-center">
                <Input
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={
                    view === 'bot'
                      ? 'Ask ARK Assistant anything…'
                      : view === 'dm'
                      ? `Message ${dmRecipient?.full_name}…`
                      : `Message #${activeChannel}…`
                  }
                  className="flex-1"
                />

                <Button
                  size="icon"
                  onClick={
                    view === 'channel'
                      ? sendChannelMsg
                      : view === 'dm'
                      ? sendDM
                      : sendBot
                  }
                  disabled={!msgInput.trim() || sending}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}