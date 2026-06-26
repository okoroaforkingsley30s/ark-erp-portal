import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  logOperationEvent,
  upsertOperationStatus,
} from '@/lib/operationsIntelligence';
import { logPartLifecycle } from '@/lib/partLifecycle';
import {
  Home,
  ClipboardList,
  Ticket,
  Package,
  MessageCircle,
  User,
  Bell,
  AlertTriangle,
  XCircle,
  MapPin,
  RefreshCw,
  PlayCircle,
  CheckCircle,
  Navigation,
  Bot,
  X,
  Send,
  History,
    Calendar,
  Clock,
  UserCheck,
  LogOut,
  Radio,
  Upload,
  Image,
  Video,
  FileText,
  Wallet,
  CalendarDays,
  Landmark,
  HandCoins,
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';

const EVIDENCE_BUCKET = 'ticket-evidence';
const FIELD_DEPARTMENT = 'Field Engineering';
const MOBILE_TICKET_PAGE_SIZE = 50;
const MOBILE_DEVICE_LIMIT = 50;
const MOBILE_REFRESH_INTERVAL_MS = 60000;
const MOBILE_REALTIME_DEBOUNCE_MS = 2500;
const MOBILE_PART_SEARCH_LIMIT = 12;

const safeLogOperationEvent = async (payload) => {
  try {
    await logOperationEvent(payload);
  } catch (error) {
    console.warn('OIN event log skipped:', error);
  }
};

const safeLogPartLifecycle = async (payload) => {
  try {
    await logPartLifecycle(payload);
  } catch (error) {
    console.warn('Part lifecycle log skipped:', error);
  }
};

const safeUpsertOperationStatus = async (payload) => {
  try {
    await upsertOperationStatus(payload);
  } catch (error) {
    console.warn('OIN status update skipped:', error);
  }
};

const getActorName = (user) =>
  user?.full_name || user?.name || user?.email || 'Field Engineer';

const getTicketDisplayName = (ticket) =>
  ticket?.ticket_number || ticket?.ticket_id || ticket?.id || 'Ticket';

const getTicketSiteName = (ticket) =>
  [
    ticket?.bank_name || ticket?.client_name,
    ticket?.branch_name || ticket?.branch || ticket?.site_name,
    ticket?.terminal_id,
  ]
    .filter(Boolean)
    .join(' • ');

const getTicketLatitude = (ticket) =>
  Number(
    ticket?.current_latitude ||
      ticket?.latitude ||
      ticket?.site_latitude ||
      ticket?.branch_latitude
  ) || null;

const getTicketLongitude = (ticket) =>
  Number(
    ticket?.current_longitude ||
      ticket?.longitude ||
      ticket?.site_longitude ||
      ticket?.branch_longitude
  ) || null;

const getCurrentPosition = () =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });

const ticketStatusToEngineerStatus = (status) => {
  const clean = String(status || '').toLowerCase();

  if (['traveling', 'in_transit', 'en_route'].includes(clean)) return 'traveling';
  if (['arrived_on_site', 'arrived', 'on_site'].includes(clean)) return 'on_site';
  if (['in_progress', 'working', 'pending_review'].includes(clean)) return 'working';
  if (['accepted', 'assigned'].includes(clean)) return 'busy';

  return 'online';
};

const MOBILE_REQUEST_CATEGORIES = {
  fund: {
    label: 'Fund',
    title: 'Fund Request',
    icon: Wallet,
    needsAmount: true,
    needsFinance: true,
    types: [
      'Salary Advance',
      'Travel Allowance',
      'Emergency Support',
      'Welfare',
      'Project Advance',
      'Other Fund Request',
    ],
  },
  loan: {
    label: 'Loan',
    title: 'Loan Request',
    icon: Landmark,
    needsAmount: true,
    needsFinance: true,
    types: [
      'Salary Loan',
      'Emergency Loan',
      'Staff Loan',
      'Asset Loan',
      'Other Loan',
    ],
  },
  float: {
    label: 'Float',
    title: 'Float Request',
    icon: HandCoins,
    needsAmount: true,
    needsFinance: true,
    types: [
      'Field Float',
      'Travel Float',
      'Project Float',
      'Logistics Float',
      'Operational Float',
      'Other Float',
    ],
  },
  leave: {
    label: 'Leave',
    title: 'Leave Request',
    icon: CalendarDays,
    needsAmount: false,
    needsFinance: false,
    types: [
      'Annual Leave',
      'Sick Leave',
      'Casual Leave',
      'Maternity Leave',
      'Paternity Leave',
      'Compassionate Leave',
      'Study Leave',
      'Unpaid Leave',
    ],
  },
  other: {
    label: 'Other',
    title: 'Other Request',
    icon: FileText,
    needsAmount: false,
    needsFinance: false,
    types: [
      'Work Tools Request',
      'Document Request',
      'Permission Request',
      'Schedule Request',
      'General Request',
    ],
  },
};

const MOBILE_REQUEST_DEFAULT_CATEGORY = 'fund';

const createMobileRequestForm = () => ({
  request_category: MOBILE_REQUEST_DEFAULT_CATEGORY,
  request_type: MOBILE_REQUEST_CATEGORIES[MOBILE_REQUEST_DEFAULT_CATEGORY].types[0],
  amount: '',
  purpose: '',
  start_date: '',
  end_date: '',
  return_date: '',
  repayment_amount: '',
  repayment_frequency: 'Monthly',
  attachment_url: '',
  notes: '',
});

const normalizeRequestValue = (value) =>
  String(value || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

const getMobileRequestCategory = (request) => {
  const raw = normalizeRequestValue(request?.request_category);

  if (raw && MOBILE_REQUEST_CATEGORIES[raw]) return raw;

  const type = normalizeRequestValue(request?.request_type);

  if (type.includes('leave')) return 'leave';
  if (type.includes('loan')) return 'loan';
  if (type.includes('float')) return 'float';

  return 'fund';
};

const mobileRequestNeedsFinance = (request) => {
  const category = getMobileRequestCategory(request);
  return Boolean(MOBILE_REQUEST_CATEGORIES[category]?.needsFinance);
};

const mobileRequestApproved = (value) => normalizeRequestValue(value) === 'approved';

const getMobileRequestStage = (request) => {
  const financeStatus = normalizeRequestValue(request?.finance_status);
  const status = normalizeRequestValue(request?.status);

  if (financeStatus === 'disbursed' || status === 'disbursed') return 'Disbursed';
  if (status === 'completed') return 'Completed';
  if (request?.ceo_override && mobileRequestNeedsFinance(request)) return 'CEO Approved - Ready for Account';
  if (request?.ceo_override && !mobileRequestNeedsFinance(request)) return 'CEO Approved - Completed';
  if (!mobileRequestApproved(request?.hr_status)) return 'Pending HR';
  if (!mobileRequestApproved(request?.agm_status)) return 'Pending AGM';
  if (!mobileRequestApproved(request?.operations_status)) return 'Pending Operations';
  if (mobileRequestNeedsFinance(request)) return 'Ready for Account';

  return 'Approved / Completed';
};

const getMobileRequestStatusClass = (request) => {
  const stage = getMobileRequestStage(request);

  if (['Disbursed', 'Completed', 'Approved / Completed', 'CEO Approved - Completed'].includes(stage)) {
    return 'bg-green-500/15 border-green-500/40 text-green-300';
  }

  if (['Ready for Account', 'CEO Approved - Ready for Account'].includes(stage)) {
    return 'bg-blue-500/15 border-blue-500/40 text-blue-300';
  }

  return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
};

const mobileMoney = (value) => `₦${Number(value || 0).toLocaleString()}`;

const calculateMobileLeaveDays = (start, end) => {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  return days > 0 ? days : null;
};

export default function FieldEngineerMobileApp({
  user,
  notifCount = 0,
  dmCount = 0,
}) {
  const FEMOBI_ACTIVE_TAB_KEY = 'femobi_active_tab';
const FEMOBI_SELECTED_TICKET_KEY = 'femobi_selected_ticket_id';

const [activeTab, setActiveTab] = useState(
  () => localStorage.getItem(FEMOBI_ACTIVE_TAB_KEY) || 'home'
);
  const [tickets, setTickets] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(() => {
  const saved = localStorage.getItem(FEMOBI_SELECTED_TICKET_KEY);

  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
});
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mails, setMails] = useState([]);
  const [loadingMails, setLoadingMails] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState('');
  useEffect(() => {
  localStorage.setItem(FEMOBI_ACTIVE_TAB_KEY, activeTab);
}, [activeTab]);
useEffect(() => {
  if (selectedTicket) {
    localStorage.setItem(
      FEMOBI_SELECTED_TICKET_KEY,
      JSON.stringify(selectedTicket)
    );
  } else {
    localStorage.removeItem(FEMOBI_SELECTED_TICKET_KEY);
  }
}, [selectedTicket]);
  const [assistantReplies, setAssistantReplies] = useState([
    {
      from: 'assistant',
      text:
        'Hello, I am ARK Assistant. Tell me the ATM issue you are facing on site. Example: card reader error, dispenser fault, cash jam, receipt printer, communication down, power issue, or supervisor mode error.',
    },
  ]);
  const refreshTimerRef = useRef({});

  const queueRefresh = useCallback((key, refreshFn) => {
    if (refreshTimerRef.current[key]) {
      window.clearTimeout(refreshTimerRef.current[key]);
    }

    refreshTimerRef.current[key] = window.setTimeout(() => {
      delete refreshTimerRef.current[key];
      refreshFn();
    }, MOBILE_REALTIME_DEBOUNCE_MS);
  }, []);

  const fetchMails = useCallback(async () => {
    if (!user?.email) return;

    setLoadingMails(true);

    const { data, error } = await supabase
      .from('email_messages')
      .select('*')
      .or(
        `recipient_email.eq.${user.email},assigned_staff.eq.${user.email},assigned_to.eq.${user.email}`
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Mobile mail fetch error:', error);
      setMails([]);
    } else {
      setMails(data || []);
    }

    setLoadingMails(false);
  }, [user?.email]);

  const fetchChatMessages = useCallback(async () => {
    if (!user?.email) return;

    setLoadingChat(true);

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(
        `recipient_id.eq.${user.email},sender_id.eq.${user.email},channel_name.in.(General,Engineers,Helpdesk,Operations)`
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Mobile chat fetch error:', error);
      setChatMessages([]);
    } else {
      setChatMessages(data || []);
    }

    setLoadingChat(false);
  }, [user?.email]);

  const fetchAssignedTickets = useCallback(async () => {
    if (!user?.email) return;

    setLoadingTickets(true);

    const engineerName = user?.full_name || user?.name || '';
    let assignedFilter = `assigned_engineer_email.eq.${user.email},assigned_to.eq.${user.email}`;

    if (engineerName) {
      assignedFilter += `,assigned_to_name.eq.${engineerName}`;
    }

    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .or(assignedFilter)
      .order('created_at', { ascending: false })
      .range(0, MOBILE_TICKET_PAGE_SIZE - 1);

    if (error) {
      console.error('Mobile assigned tickets error:', error);
      setTickets([]);
      setLoadingTickets(false);
      return;
    }

    setTickets(data || []);

    const savedTicket = localStorage.getItem(FEMOBI_SELECTED_TICKET_KEY);

    if (savedTicket && data?.length) {
      try {
        const parsed = JSON.parse(savedTicket);
        const found = data.find((t) => t.id === parsed.id);

        if (found) {
          setSelectedTicket(found);
        }
      } catch (err) {
        console.error(err);
      }
    }

    setLoadingTickets(false);
  }, [user?.email, user?.full_name, user?.name]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.email) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Mobile notifications error:', error);
      return;
    }

    setNotifications(data || []);
  }, [user?.email]);

  useEffect(() => {
    fetchAssignedTickets();
    fetchNotifications();
    fetchMails();
    fetchChatMessages();
  }, [fetchAssignedTickets, fetchNotifications, fetchMails, fetchChatMessages]);

  // Production-safe auto refresh for FEMobi.
  // Avoid refreshing every dataset for every realtime event. Each table refreshes only its own data.
  useEffect(() => {
    if (!user?.email) return;

    const refreshAll = () => {
      fetchAssignedTickets();
      fetchNotifications();
      fetchMails();
      fetchChatMessages();
    };

    const interval = window.setInterval(refreshAll, MOBILE_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const channel = supabase
      .channel(`femobi-live-${user.email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => queueRefresh('tickets', fetchAssignedTickets)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => queueRefresh('notifications', fetchNotifications)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => queueRefresh('chat', fetchChatMessages)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_messages' },
        () => queueRefresh('mail', fetchMails)
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      Object.values(refreshTimerRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
      refreshTimerRef.current = {};

      supabase.removeChannel(channel);
    };
  }, [
    user?.email,
    fetchAssignedTickets,
    fetchNotifications,
    fetchMails,
    fetchChatMessages,
    queueRefresh,
  ]);

  useEffect(() => {
    if (!user?.email) return;

    let cancelled = false;

    const heartbeat = async () => {
      const now = new Date().toISOString();
      const gps = await getCurrentPosition();

      if (cancelled) return;

      await safeUpsertOperationStatus({
        entity_type: 'engineer',
        entity_id: user?.id || user.email,
        entity_name: getActorName(user),
        status: 'online',
        latitude: gps.latitude,
        longitude: gps.longitude,
        last_seen: now,
        source_module: 'FEMobiHeartbeat',
        metadata: {
          email: user.email,
          role: user.role,
          department: user.department || FIELD_DEPARTMENT,
          active_tab: activeTab,
        },
      });
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id, user?.email, user?.full_name, user?.name, user?.role, user?.department, activeTab]);

  useEffect(() => {
    const handleMobileTab = (event) => {
      const tab = event?.detail?.tab;

      if (tab) {
        setActiveTab(tab);
      }
    };

    window.addEventListener('field-mobile-tab', handleMobileTab);

    return () => {
      window.removeEventListener('field-mobile-tab', handleMobileTab);
    };
  }, []);

  useEffect(() => {
  fetchAssignedDevices();
}, [user?.email]);

  const fetchAssignedDevices = async () => {
  if (!user?.email) return;

  setLoadingDevices(true);

  const engineerName = user?.full_name || user?.name || '';

  let query = supabase
    .from('devices')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(MOBILE_DEVICE_LIMIT);

  if (engineerName) {
    query = query.or(
      `assigned_engineer_email.eq.${user.email},assigned_engineer.eq.${user.email},assigned_engineer_name.eq.${engineerName}`
    );
  } else {
    query = query.or(
      `assigned_engineer_email.eq.${user.email},assigned_engineer.eq.${user.email}`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Assigned devices error:', error);
    setDevices([]);
  } else {
    setDevices(data || []);
  }

  setLoadingDevices(false);
};

  const updateTicketStatus = async (ticketId, status) => {
    const now = new Date().toISOString();
    const ticket = tickets.find((t) => t.id === ticketId);
    const actorName = getActorName(user);
    const engineerStatus = ticketStatusToEngineerStatus(status);
    const gps = await getCurrentPosition();

    const statusTimeMap = {
      accepted: {
        accepted_at: now,
      },
      traveling: {
        trip_started_at: now,
      },
      arrived_on_site: {
        arrived_at: now,
      },
      in_progress: {
        started_at: now,
        work_started_at: now,
      },
      pending_review: {
        submitted_review_at: now,
        submitted_at: now,
      },
    };

    const { error } = await supabase
      .from('tickets')
      .update({
        status,
        updated_at: now,
        ...(statusTimeMap[status] || {}),
      })
      .eq('id', ticketId);

    if (error) {
      console.error('Ticket status update error:', error);
      alert('Could not update ticket status.');
      return;
    }

    await safeLogOperationEvent({
      event_type: 'ticket_status_changed',
      entity_type: 'ticket',
      entity_id: ticketId,
      title: `${getTicketDisplayName(ticket)} moved to ${status.replaceAll('_', ' ')}`,
      description: `${actorName} changed ${getTicketDisplayName(ticket)} to ${status.replaceAll('_', ' ')}`,
      actor_name: actorName,
      actor_id: user?.id || user?.email,
      department: FIELD_DEPARTMENT,
      severity: 'info',
      metadata: {
        ticket_number: getTicketDisplayName(ticket),
        status,
        site: getTicketSiteName(ticket),
        engineer_email: user?.email,
      },
    });

    await safeUpsertOperationStatus({
      entity_type: 'ticket',
      entity_id: ticketId,
      entity_name: getTicketDisplayName(ticket),
      status,
      latitude: getTicketLatitude(ticket) || gps.latitude,
      longitude: getTicketLongitude(ticket) || gps.longitude,
      last_seen: now,
      source_module: 'FieldEngineerMobile',
      metadata: {
        engineer: actorName,
        engineer_email: user?.email,
        site: getTicketSiteName(ticket),
        terminal_id: ticket?.terminal_id,
      },
    });

    await safeUpsertOperationStatus({
      entity_type: 'engineer',
      entity_id: user?.id || user?.email,
      entity_name: actorName,
      status: engineerStatus,
      latitude: gps.latitude || getTicketLatitude(ticket),
      longitude: gps.longitude || getTicketLongitude(ticket),
      last_seen: now,
      source_module: 'FEMobi',
      metadata: {
        email: user?.email,
        role: user?.role,
        department: user?.department || FIELD_DEPARTMENT,
        current_ticket_id: ticketId,
        current_ticket_number: getTicketDisplayName(ticket),
        current_site_name: getTicketSiteName(ticket),
      },
    });

    fetchAssignedTickets();
  };

  const openGoogleMaps = (ticket) => {
    const location =
      ticket?.branch_name ||
      ticket?.branch ||
      ticket?.site_name ||
      ticket?.bank_name ||
      '';

    if (!location) {
      alert('No branch/location found for this ticket.');
      return;
    }

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
      '_blank'
    );
  };

  const sendSupportRequest = async (team, note = '') => {
    const teamEmailMap = {
      Helpdesk: 'helpdesk@arktechnologiesgroup.com',
      Operations: 'operations@arktechnologiesgroup.com',
      Inventory: 'inventory@arktechnologiesgroup.com',
    };

    const { error } = await supabase.from('notifications').insert({
      user_email: teamEmailMap[team],
      title: `Mobile Support Request - ${team}`,
      message: `${user?.full_name || user?.email} needs ${team} support. ${note}`,
      read: false,
      type: 'mobile_support',
      sound: 'bell',
      link: '/ark-connect',
    });

    if (error) {
      console.error('Support request error:', error);
      alert('Could not send support request. Check notification policy.');
      return;
    }

    await safeLogOperationEvent({
      event_type: 'support_request_sent',
      entity_type: 'support_request',
      entity_id: `${user?.email || 'engineer'}-${team}-${Date.now()}`,
      title: `${team} support requested`,
      description: `${getActorName(user)} requested ${team} support. ${note || ''}`,
      actor_name: getActorName(user),
      actor_id: user?.id || user?.email,
      department: FIELD_DEPARTMENT,
      severity: 'info',
      metadata: {
        team,
        note,
        engineer_email: user?.email,
      },
    });

    alert(`${team} support request sent.`);
  };

  const sendAssistantMessage = () => {
    const cleanMessage = assistantMessage.trim();
    if (!cleanMessage) return;

    const reply = getAssistantReply(cleanMessage, tickets);

    setAssistantReplies((prev) => [
      ...prev,
      { from: 'user', text: cleanMessage },
      { from: 'assistant', text: reply },
    ]);

    setAssistantMessage('');
  };

  const logout = async () => {
    const now = new Date().toISOString();

    await safeUpsertOperationStatus({
      entity_type: 'engineer',
      entity_id: user?.id || user?.email,
      entity_name: getActorName(user),
      status: 'offline',
      last_seen: now,
      source_module: 'FEMobiLogout',
      metadata: {
        email: user?.email,
        reason: 'Engineer signed out from FEMobi',
      },
    });

    await safeLogOperationEvent({
      event_type: 'engineer_logout',
      entity_type: 'engineer',
      entity_id: user?.id || user?.email,
      title: 'Engineer signed out',
      description: `${getActorName(user)} signed out from FEMobi`,
      actor_name: getActorName(user),
      actor_id: user?.id || user?.email,
      department: FIELD_DEPARTMENT,
      severity: 'info',
      metadata: {
        email: user?.email,
      },
    });

    await supabase.auth.signOut();
    window.location.href = '/welcome';
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950 text-white overflow-hidden"
      style={{
        height: '100svh',
        maxHeight: '100svh',
      }}
    >
      {activeTab === 'profile' ? (
        <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-slate-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="h-10 w-10 rounded-xl text-3xl leading-none text-white flex items-center justify-center"
              aria-label="Menu"
            >
              ☰
            </button>

            <h1 className="text-xl font-bold text-white">Profile</h1>

            <button
              type="button"
              onClick={() => {
                fetchNotifications();
                setNotificationsOpen(true);
              }}
              className="relative h-10 w-10 rounded-xl text-white flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell size={26} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] min-w-5 h-5 rounded-full flex items-center justify-center px-1">
                  {notifCount}
                </span>
              )}
            </button>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">ARK ONE Field</h1>
              <p className="text-xs text-slate-400">
                Welcome {user?.full_name || user?.name || user?.email || 'Engineer'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                fetchNotifications();
                setNotificationsOpen(true);
              }}
              className="relative rounded-full bg-slate-800 p-2"
            >
              <Bell size={22} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] min-w-5 h-5 rounded-full flex items-center justify-center px-1">
                  {notifCount}
                </span>
              )}
            </button>
          </div>
        </header>
      )}

      <main
        className={
          activeTab === 'profile'
            ? 'h-[calc(100svh-112px)] overflow-y-auto overflow-x-hidden px-3 pt-3 pb-24'
            : 'h-[calc(100svh-124px)] overflow-y-auto overflow-x-hidden p-4 pb-28'
        }
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        {activeTab === 'home' && (
          <HomeScreen
            notifCount={notifCount}
            dmCount={dmCount}
            tickets={tickets}
            loadingTickets={loadingTickets}
            onRefresh={fetchAssignedTickets}
            onTabChange={setActiveTab}
            onSelectTicket={setSelectedTicket}
            onNavigate={openGoogleMaps}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsScreen
            tickets={tickets}
            loadingTickets={loadingTickets}
            onRefresh={fetchAssignedTickets}
            onUpdateStatus={updateTicketStatus}
            onNavigate={openGoogleMaps}
            onSelectTicket={setSelectedTicket}
          />
        )}

        {activeTab === 'tickets' && (
          <TicketsScreen
            tickets={tickets}
            loadingTickets={loadingTickets}
            onRefresh={fetchAssignedTickets}
            onSelectTicket={setSelectedTicket}
          />
        )}

        {activeTab === 'parts' && <PartsScreen tickets={tickets} user={user} />}

        {activeTab === 'requests' && <RequestScreen user={user} />}

        {activeTab === 'connect' && (
          <ConnectScreen
            user={user}
            dmCount={dmCount}
            mails={mails}
            loadingMails={loadingMails}
            chatMessages={chatMessages}
            loadingChat={loadingChat}
            onRefreshMails={fetchMails}
            onRefreshChat={fetchChatMessages}
            onSupportRequest={sendSupportRequest}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            user={user}
            tickets={tickets}
            devices={devices}
            loadingDevices={loadingDevices}
            onLogout={logout}
            onTabChange={setActiveTab}
          />
        )}
      </main>

      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        className="fixed right-4 z-50 h-14 w-14 rounded-full bg-orange-500 shadow-xl flex items-center justify-center"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        }}
      >
        <Bot size={26} />
      </button>

      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          user={user}
          onClose={() => {
  localStorage.removeItem(FEMOBI_SELECTED_TICKET_KEY);
  setSelectedTicket(null);
}}
          onNavigate={openGoogleMaps}
          onUpdateStatus={updateTicketStatus}
          onCompleted={() => {
            setSelectedTicket(null);
            fetchAssignedTickets();
          }}
        />
      )}

      {notificationsOpen && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setNotificationsOpen(false)}
          onRefresh={fetchNotifications}
        />
      )}

      {assistantOpen && (
        <AssistantModal
          replies={assistantReplies}
          message={assistantMessage}
          setMessage={setAssistantMessage}
          onSend={sendAssistantMessage}
          onClose={() => setAssistantOpen(false)}
        />
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 grid grid-cols-7 pt-2"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        }}
      >
        <BottomItem icon={<Home size={20} />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <BottomItem icon={<ClipboardList size={20} />} label="Jobs" active={activeTab === 'jobs'} badge={tickets.length} onClick={() => setActiveTab('jobs')} />
        <BottomItem icon={<Ticket size={20} />} label="Tickets" active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />
        <BottomItem icon={<Package size={20} />} label="Parts" active={activeTab === 'parts'} onClick={() => setActiveTab('parts')} />
        <BottomItem icon={<FileText size={20} />} label="Request" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
        <BottomItem icon={<MessageCircle size={20} />} label="Connect" active={activeTab === 'connect'} badge={dmCount} onClick={() => setActiveTab('connect')} />
        <BottomItem icon={<User size={20} />} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
      </nav>
    </div>
  );
}

function HomeScreen({
  notifCount,
  dmCount,
  tickets,
  loadingTickets,
  onRefresh,
  onTabChange,
  onSelectTicket,
  onNavigate,
}) {
  const urgentTickets = tickets.filter(
    (ticket) =>
      ticket?.priority?.toLowerCase() === 'high' ||
      ticket?.priority?.toLowerCase() === 'critical' ||
      ticket?.sla_status?.toLowerCase() === 'breached'
  );

  const pendingReview = tickets.filter(
    (ticket) =>
      ticket.status === 'pending_review' ||
      ticket.completion_status === 'pending'
  );

  const completed = tickets.filter((ticket) =>
    ['approved', 'closed', 'completed'].includes(ticket.status)
  );

  const firstTicket = tickets[0];

  const HomeStat = ({ title, value, icon, tone = 'orange', onClick }) => {
    const tones = {
      orange: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
      blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      green: 'text-green-400 border-green-500/30 bg-green-500/10',
      red: 'text-red-400 border-red-500/30 bg-red-500/10',
    };

    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-left active:scale-[0.98]"
      >
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center mb-3 ${tones[tone]}`}>
          {icon}
        </div>

        <p className="text-2xl font-bold text-white leading-none">
          {value}
        </p>

        <p className="text-xs text-slate-400 mt-1">
          {title}
        </p>
      </button>
    );
  };

  const QuickAction = ({ icon, label, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-slate-900 border border-slate-800 p-3 min-h-[76px] flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
    >
      <span className="text-orange-400">{icon}</span>
      <span className="text-[11px] text-slate-200 font-medium text-center">
        {label}
      </span>
    </button>
  );

  return (
    <div className="space-y-3 pb-2">
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <p className="text-xs text-orange-400 font-semibold">
          Today&apos;s Field Summary
        </p>

        <h2 className="text-2xl font-bold text-white mt-1">
          Your work dashboard
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Jobs, SLA alerts, navigation and support in one place.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
            <p className="text-2xl font-bold text-white">{tickets.length}</p>
            <p className="text-[11px] text-slate-400">Jobs</p>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{urgentTickets.length}</p>
            <p className="text-[11px] text-slate-400">SLA Alerts</p>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{completed.length}</p>
            <p className="text-[11px] text-slate-400">Done</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <HomeStat
          title="Assigned Jobs"
          value={tickets.length}
          icon={<ClipboardList size={21} />}
          tone="blue"
          onClick={() => onTabChange('jobs')}
        />

        <HomeStat
          title="Tickets"
          value={tickets.length}
          icon={<Ticket size={21} />}
          tone="orange"
          onClick={() => onTabChange('tickets')}
        />

        <HomeStat
          title="Pending Review"
          value={pendingReview.length}
          icon={<Upload size={21} />}
          tone="green"
          onClick={() => onTabChange('jobs')}
        />

        <HomeStat
          title="Alerts"
          value={notifCount + urgentTickets.length}
          icon={<AlertTriangle size={21} />}
          tone="red"
          onClick={() => onTabChange('tickets')}
        />
      </div>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base text-white">Next Job</h3>

          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-orange-400 font-semibold flex items-center gap-1"
          >
            <RefreshCw size={13} />
            {loadingTickets ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {firstTicket ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectTicket(firstTicket)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSelectTicket(firstTicket);
              }
            }}
            className="w-full text-left rounded-2xl bg-slate-950 border border-slate-800 p-4 active:scale-[0.99] cursor-pointer"
          >
            <p className="text-xs text-orange-400">
              {firstTicket.ticket_number || firstTicket.ticket_id || 'Ticket'}
            </p>

            <h3 className="font-semibold text-white mt-1">
              {firstTicket.title || firstTicket.category || 'Assigned Job'}
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              {firstTicket.bank_name || firstTicket.client_name || 'Bank'} •{' '}
              {firstTicket.branch_name || firstTicket.branch || 'Branch'}
            </p>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(firstTicket);
                }}
                className="rounded-xl bg-orange-500 py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Navigation size={16} />
                Direction
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabChange('jobs');
                }}
                className="rounded-xl bg-slate-800 border border-slate-700 py-3 text-sm font-semibold"
              >
                Open Jobs
              </button>
            </div>
          </div>
        ) : (
          <EmptyText text="No assigned job yet." />
        )}
      </section>

      <section>
        <h3 className="font-bold text-base mb-2">Quick Actions</h3>

        <div className="grid grid-cols-5 gap-2">
          <QuickAction
            icon={<ClipboardList size={25} />}
            label="Jobs"
            onClick={() => onTabChange('jobs')}
          />

          <QuickAction
            icon={<Ticket size={25} />}
            label="Tickets"
            onClick={() => onTabChange('tickets')}
          />

          <QuickAction
            icon={<MessageCircle size={25} />}
            label="Connect"
            onClick={() => onTabChange('connect')}
          />

          <QuickAction
            icon={<Package size={25} />}
            label="Parts"
            onClick={() => onTabChange('parts')}
          />

          <QuickAction
            icon={<FileText size={25} />}
            label="Request"
            onClick={() => onTabChange('requests')}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <h3 className="font-bold text-base mb-3 text-white">SLA Alerts</h3>

        {urgentTickets.length === 0 ? (
          <EmptyText text="No urgent SLA alert yet." />
        ) : (
          <div className="space-y-2">
            {urgentTickets.slice(0, 3).map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onSelectTicket(ticket)}
                className="w-full text-left rounded-xl bg-red-950/30 border border-red-900 p-3"
              >
                <p className="text-sm font-semibold text-red-200">
                  {ticket.ticket_number || ticket.ticket_id || 'Ticket'}
                </p>

                <p className="text-xs text-red-300 mt-1">
                  {ticket.sla_status || ticket.priority || 'Urgent'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function JobsScreen({
  tickets,
  loadingTickets,
  onRefresh,
  onUpdateStatus,
  onNavigate,
  onSelectTicket,
}) {
  const [selectedGroup, setSelectedGroup] = useState(null);

  const closedCalls = tickets.filter((t) =>
    ['closed', 'completed', 'approved'].includes(
      String(t.status || '').toLowerCase()
    )
  );

  const pendingReview = tickets.filter((t) =>
    String(t.status || '').toLowerCase() === 'pending_review' ||
    String(t.completion_status || '').toLowerCase() === 'pending'
  );

  const pendingParts = tickets.filter((t) => {
    const status = String(t.status || '').toLowerCase();
    const completionStatus = String(t.completion_status || '').toLowerCase();
    const requestType = String(t.part_request_type || '').toLowerCase();

    return (
      status === 'pending_parts' ||
      completionStatus === 'pending_parts' ||
      requestType === 'consumable'
    );
  });

  const pendingBank = tickets.filter((t) => {
    const status = String(t.status || '').toLowerCase();
    const completionStatus = String(t.completion_status || '').toLowerCase();
    const requestType = String(t.part_request_type || '').toLowerCase();

    return (
      status === 'pending_bank' ||
      completionStatus === 'pending_bank' ||
      requestType === 'bank'
    );
  });

  const rejectedCalls = tickets.filter((t) => {
    const status = String(t.status || '').toLowerCase();
    const completionStatus = String(t.completion_status || '').toLowerCase();
    const reviewStatus = String(t.review_status || '').toLowerCase();

    return (
      status === 'rejected' ||
      completionStatus === 'rejected' ||
      reviewStatus === 'rejected'
    );
  });

  const openCalls = tickets.filter((t) => {
    const status = String(t.status || '').toLowerCase();

    return ![
      'closed',
      'completed',
      'approved',
      'rejected',
    ].includes(status);
  });

  const groups = [
    {
      key: 'open',
      title: 'Open Calls',
      subtitle: 'Jobs requiring field action',
      count: openCalls.length,
      color: 'text-blue-400',
      border: 'border-blue-500/40',
      bg: 'bg-blue-500/10',
      icon: <ClipboardList size={28} />,
      items: openCalls,
    },
    {
      key: 'review',
      title: 'Pending Review',
      subtitle: 'Completed jobs awaiting approval',
      count: pendingReview.length,
      color: 'text-orange-400',
      border: 'border-orange-500/40',
      bg: 'bg-orange-500/10',
      icon: <Upload size={28} />,
      items: pendingReview,
    },
    {
  key: 'rejected',
  title: 'Rejected Calls',
  subtitle: 'Jobs returned for correction',
  count: rejectedCalls.length,
  color: 'text-red-400',
  border: 'border-red-500/40',
  bg: 'bg-red-500/10',
  icon: <XCircle size={28} />,
  items: rejectedCalls,
},
    {
      key: 'parts',
      title: 'Pending on Parts',
      subtitle: 'Consumables / company-supplied items',
      count: pendingParts.length,
      color: 'text-yellow-400',
      border: 'border-yellow-500/40',
      bg: 'bg-yellow-500/10',
      icon: <Package size={28} />,
      items: pendingParts,
    },
    {
      key: 'bank',
      title: 'Pending on Bank',
      subtitle: 'Bank damage or bank payment required',
      count: pendingBank.length,
      color: 'text-cyan-400',
      border: 'border-cyan-500/40',
      bg: 'bg-cyan-500/10',
      icon: <Package size={28} />,
      items: pendingBank,
    },
    {
      key: 'closed',
      title: 'Closed Calls',
      subtitle: 'Completed and approved jobs',
      count: closedCalls.length,
      color: 'text-green-400',
      border: 'border-green-500/40',
      bg: 'bg-green-500/10',
      icon: <CheckCircle size={28} />,
      items: closedCalls,
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-400 font-semibold">
              Field Operations
            </p>

            <h2 className="text-2xl font-bold text-white mt-1">
              Jobs
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Calls grouped by current job status.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs flex items-center gap-2"
          >
            <RefreshCw size={14} />
            {loadingTickets ? 'Loading' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2 mt-4">
          {groups.map((group) => (
            <div
              key={group.key}
              className="rounded-xl bg-slate-950 border border-slate-800 p-2 text-center"
            >
              <p className={`text-xl font-bold ${group.color}`}>
                {group.count}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {group.title}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setSelectedGroup(group)}
            className={`rounded-2xl bg-slate-900 border ${group.border} p-4 text-left active:scale-[0.98]`}
          >
            <div
              className={`w-12 h-12 rounded-full ${group.bg} ${group.color} border ${group.border} flex items-center justify-center mb-4`}
            >
              {group.icon}
            </div>

            <p className={`text-3xl font-bold ${group.color}`}>
              {group.count}
            </p>

            <h3 className="font-bold text-white mt-1">
              {group.title}
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              {group.subtitle}
            </p>

            <p className="text-xs text-orange-400 font-semibold mt-3">
              Tap to view list
            </p>
          </button>
        ))}
      </div>

      {selectedGroup && (
        <JobGroupModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onUpdateStatus={onUpdateStatus}
          onNavigate={onNavigate}
          onSelectTicket={onSelectTicket}
        />
      )}
    </div>
  );
}

function JobGroupModal({
  group,
  onClose,
  onUpdateStatus,
  onNavigate,
  onSelectTicket,
}) {
  const openTicketDetails = (ticket) => {
    onClose();
    setTimeout(() => {
      onSelectTicket(ticket);
    }, 150);
  };

  return (
    <div
      className="fixed inset-0 z-[85] bg-slate-950 text-white overflow-hidden"
      style={{ height: '100svh', maxHeight: '100svh' }}
    >
      <div className="h-[72px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{group.title}</h2>
          <p className="text-xs text-slate-400">
            {group.count} job{group.count !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-slate-800 p-2 active:bg-red-500 active:scale-95 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      <div
        className="h-[calc(100svh-72px)] overflow-y-auto overflow-x-hidden p-4 space-y-3 pb-28"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        {group.items.length === 0 ? (
          <EmptyText text={`No ${group.title.toLowerCase()} found.`} />
        ) : (
          group.items.map((ticket) => (
            <section
              key={ticket.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-4"
            >
              <button
                type="button"
                onClick={() => openTicketDetails(ticket)}
                className="w-full text-left active:scale-[0.99] transition-all"
              >
                <p className="text-xs text-orange-400">
                  {ticket.ticket_number || ticket.ticket_id || 'Ticket'}
                </p>

                <h3 className="font-semibold text-white mt-1">
                  {ticket.title || ticket.category || 'Assigned Job'}
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  {ticket.bank_name || ticket.client_name || 'Bank'} •{' '}
                  {ticket.branch_name || ticket.branch || 'Branch'}
                </p>

                <p className="text-xs text-slate-500 mt-2">
                  Status: {ticket.status || 'open'}
                </p>
              </button>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(ticket.id, 'accepted')}
                  className="rounded-xl bg-blue-500/10 border border-blue-500/20 py-3 text-xs font-semibold text-blue-300 active:bg-blue-500 active:text-white active:scale-95 transition-all"
                >
                  Accept
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateStatus(ticket.id, 'traveling')}
                  className="rounded-xl bg-purple-500/10 border border-purple-500/20 py-3 text-xs font-semibold text-purple-300 active:bg-purple-500 active:text-white active:scale-95 transition-all"
                >
                  Start Trip
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateStatus(ticket.id, 'arrived_on_site')}
                  className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 py-3 text-xs font-semibold text-yellow-300 active:bg-yellow-500 active:text-white active:scale-95 transition-all"
                >
                  Arrived
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate(ticket)}
                  className="rounded-xl bg-orange-500 py-3 text-xs font-semibold text-white active:bg-green-500 active:scale-95 transition-all"
                >
                  Navigate
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateStatus(ticket.id, 'in_progress')}
                  className="rounded-xl bg-green-500/10 border border-green-500/20 py-3 text-xs font-semibold text-green-300 active:bg-green-500 active:text-white active:scale-95 transition-all"
                >
                  Start Work
                </button>

                <button
                  type="button"
                  onClick={() => openTicketDetails(ticket)}
                  className="rounded-xl bg-slate-800 border border-slate-700 py-3 text-xs font-semibold text-white active:bg-orange-500 active:border-orange-500 active:scale-95 transition-all"
                >
                  Complete Report
                </button>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function TicketsScreen({ tickets, loadingTickets, onRefresh, onSelectTicket }) {
  return (
    <div className="space-y-4">
      <PageTitle title="Tickets" subtitle="Ticket information, fault details and work history." />

      <button type="button" onClick={onRefresh} className="w-full rounded-xl bg-slate-800 border border-slate-700 py-3 text-sm flex items-center justify-center gap-2">
        <RefreshCw size={16} />
        {loadingTickets ? 'Loading tickets...' : 'Refresh Tickets'}
      </button>

      {tickets.length === 0 ? (
        <SectionCard title="Open Tickets">
          <EmptyText text="No open ticket found." />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <TicketInfoCard key={ticket.id} ticket={ticket} onSelectTicket={onSelectTicket} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketInfoCard({ ticket, onSelectTicket }) {
  return (
    <button type="button" onClick={() => onSelectTicket(ticket)} className="w-full text-left bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{ticket.ticket_number || ticket.ticket_id || 'Ticket'}</p>
          <h3 className="font-semibold text-base mt-1">{ticket.title || ticket.category || 'Ticket Details'}</h3>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 text-orange-300 border border-slate-700">
          {ticket.priority || 'normal'}
        </span>
      </div>

      <p className="text-sm text-slate-400 line-clamp-3">
        {ticket.description || 'No fault description provided.'}
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        <Info label="Terminal" value={ticket.terminal_id} />
        <Info label="Device" value={ticket.device_name} />
        <Info label="SLA" value={ticket.sla_status || ticket.sla_level} />
        <Info label="Updated" value={formatDate(ticket.updated_at)} />
      </div>
    </button>
  );
}

function TicketDetailsModal({
  ticket,
  user,
  onClose,
  onNavigate,
  onUpdateStatus,
  onCompleted,
}) {
  const [completionNote, setCompletionNote] = useState(ticket?.completion_note || '');
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showPartRequest, setShowPartRequest] = useState(false);
  const [partType, setPartType] = useState('consumable');
  const [partName, setPartName] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partReason, setPartReason] = useState('');
  const [partEvidence, setPartEvidence] = useState([]);
  const [redirectingPart, setRedirectingPart] = useState(false);
  const [selectedInventoryPart, setSelectedInventoryPart] = useState(null);
  const [inventoryParts, setInventoryParts] = useState([]);
  const [loadingInventoryParts, setLoadingInventoryParts] = useState(false);

  const handleBeforePhotoChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length > 0) {
      setBeforeFiles((prev) => [...prev, ...files]);
    }

    e.target.value = '';
  };

  const handleAfterPhotoChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length > 0) {
      setAfterFiles((prev) => [...prev, ...files]);
    }

    e.target.value = '';
  };

  const handleVideoChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length > 0) {
      setVideoFiles((prev) => [...prev, ...files]);
    }

    e.target.value = '';
  };

  useEffect(() => {
    let active = true;
    const query = partName.trim();

    if (query.length < 2 || selectedInventoryPart) {
      setInventoryParts([]);
      setLoadingInventoryParts(false);
      return () => {
        active = false;
      };
    }

    const timer = window.setTimeout(async () => {
      setLoadingInventoryParts(true);

      const likeQuery = `%${query}%`;
      const { data, error } = await supabase
        .from('spare_parts')
        .select('id, part_name, description, part_number, serial_number, device_brand, device_model, quantity_available')
        .or(`part_name.ilike.${likeQuery},description.ilike.${likeQuery},part_number.ilike.${likeQuery},device_brand.ilike.${likeQuery},device_model.ilike.${likeQuery}`)
        .order('description', { ascending: true })
        .limit(MOBILE_PART_SEARCH_LIMIT);

      if (!active) return;

      if (error) {
        console.error('Mobile inventory parts search error:', error);
        setInventoryParts([]);
      } else {
        setInventoryParts(data || []);
      }

      setLoadingInventoryParts(false);
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [partName, selectedInventoryPart]);

  const matchingInventoryParts = inventoryParts;

  const existingBeforePhotos = Array.isArray(ticket?.before_photos)
    ? ticket.before_photos
    : [];

  const existingAfterPhotos = Array.isArray(ticket?.after_photos)
    ? ticket.after_photos
    : [];

  const existingVideos = Array.isArray(ticket?.evidence_videos)
    ? ticket.evidence_videos
    : [];

  const rejectionLog =
    ticket?.attachments?.rejection_log &&
    Array.isArray(ticket.attachments.rejection_log)
      ? ticket.attachments.rejection_log
      : [];

  const currentPartRequestStatus = String(
    ticket?.part_request_status || ticket?.dispatch_status || ''
  ).toLowerCase();

  const hasLinkedPartRequest = Boolean(
    ticket?.linked_part_request_id ||
      ticket?.part_request_type ||
      ['pending_parts', 'pending_bank'].includes(
        String(ticket?.status || '').toLowerCase()
      )
  );

  const partReadyToReceive =
    hasLinkedPartRequest &&
    [
      'dispatched_to_engineer',
      'dispatched',
      'ready_for_engineer_receive',
    ].includes(currentPartRequestStatus);

  const partAlreadyReceived =
    hasLinkedPartRequest &&
    ['received_by_engineer', 'received'].includes(currentPartRequestStatus);

  const partLocked =
    hasLinkedPartRequest &&
    !partReadyToReceive &&
    !partAlreadyReceived &&
    !['closed', 'completed', 'cancelled', 'rejected'].includes(
      currentPartRequestStatus
    );

  const uploadEvidenceFiles = async (files, type) => {
    const uploaded = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${ticket.id}/${type}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(EVIDENCE_BUCKET)
        .getPublicUrl(filePath);

      uploaded.push({
        name: file.name,
        path: filePath,
        url: publicUrlData?.publicUrl,
        type,
        uploaded_at: new Date().toISOString(),
      });
    }

    return uploaded;
  };

  const redirectToPartRequest = async () => {
    if (!partName.trim()) {
      alert('Enter the part or consumable needed.');
      return;
    }

    if (!partReason.trim()) {
      alert('Enter reason for redirecting this call to parts/bank.');
      return;
    }

    setRedirectingPart(true);

    try {
      const now = new Date().toISOString();
      const ticketStatus = partType === 'bank' ? 'pending_bank' : 'pending_parts';
      const uploadedPartEvidence = await uploadEvidenceFiles(partEvidence, 'part-issue-evidence');

      const { data: partRequest, error: requestError } = await supabase
        .from('part_requests')
        .insert({
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number || ticket.ticket_id || ticket.id,
          engineer_email: user?.email,
          engineer_name: user?.full_name || user?.name || user?.email,
          part_name: (selectedInventoryPart?.part_name || selectedInventoryPart?.description || partName).trim(),
          quantity: Number(partQty || 1),
          request_type: partType,
          reason_category: partType === 'bank' ? 'damaged_by_bank' : 'consumable_required',
          reason_note: selectedInventoryPart
            ? `${partReason.trim()}\n\nSelected inventory item: ${selectedInventoryPart.part_name || selectedInventoryPart.description || 'N/A'} | Part No: ${selectedInventoryPart.part_number || 'N/A'} | Available Stock: ${selectedInventoryPart.quantity_available || 0}`
            : partReason.trim(),
          evidence_photos: uploadedPartEvidence,
          approval_status: 'pending_operations',
          operations_status: 'pending_review',
          inventory_status: 'pending_review',
          finance_status: partType === 'bank' ? 'pending_payment_review' : 'pending_dispatch_cost_review',
          dispatch_status: 'pending',
          current_department: 'operations',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (requestError) {
        throw requestError;
      }

      await safeLogPartLifecycle({
  part_request_id: partRequest.id,
  ticket_id: ticket.id,

  part_name: (
    selectedInventoryPart?.part_name ||
    selectedInventoryPart?.description ||
    partName
  ).trim(),

  part_number: selectedInventoryPart?.part_number || null,
  serial_number: selectedInventoryPart?.serial_number || null,

  movement_type:
    partType === 'bank'
      ? 'field_bank_damage_part_requested'
      : 'field_consumable_part_requested',

  from_location:
    ticket.branch_name ||
    ticket.branch ||
    ticket.site_name ||
    ticket.bank_name ||
    null,

  to_location: 'Operations Queue',

  from_department: 'Field Engineering',
  to_department: 'Operations',

  issued_to_name: user?.full_name || user?.name || user?.email,
  issued_to_email: user?.email,

  quantity: Number(partQty || 1),

  status_before: 'field_issue_identified',
  status_after:
    partType === 'bank'
      ? 'pending_bank_operations_review'
      : 'pending_operations_review',

  notes: partReason.trim(),
  evidence: uploadedPartEvidence,

  actor_name: user?.full_name || user?.name || user?.email,
  actor_email: user?.email,
  actor_department: 'Field Engineering',
});

      const { error: ticketError } = await supabase
        .from('tickets')
        .update({
          status: ticketStatus,
          completion_status: ticketStatus,
          linked_part_request_id: partRequest.id,
          part_request_type: partType,
          part_request_reason: partType === 'bank' ? 'damaged_by_bank' : 'consumable_required',
          part_request_note: partReason.trim(),
          part_request_status: 'pending_operations',
          updated_at: now,
        })
        .eq('id', ticket.id);

      if (ticketError) {
        throw ticketError;
      }

      await supabase.from('notifications').insert({
        user_email: 'operations@arktechnologiesgroup.com',
        title: partType === 'bank'
          ? 'Bank-Related Part Request'
          : 'Consumable / Parts Request',
        message: `${user?.full_name || user?.email} redirected ${ticket.ticket_number || ticket.ticket_id || ticket.id} to ${partType === 'bank' ? 'Pending on Bank' : 'Pending on Parts'} for ${partQty} x ${partName}. ${partReason}`,
        read: false,
        type: 'part_request_pending_operations',
        sound: 'bell',
        link: '/spare-parts',
        created_at: now,
      });

      await safeLogOperationEvent({
        event_type: 'part_redirect_created',
        entity_type: 'part_request',
        entity_id: partRequest.id,
        title: `${getTicketDisplayName(ticket)} redirected to ${partType === 'bank' ? 'Pending on Bank' : 'Pending on Parts'}`,
        description: `${getActorName(user)} requested ${partQty} x ${(selectedInventoryPart?.part_name || selectedInventoryPart?.description || partName).trim()} for ${getTicketDisplayName(ticket)}`,
        actor_name: getActorName(user),
        actor_id: user?.id || user?.email,
        department: FIELD_DEPARTMENT,
        severity: partType === 'bank' ? 'warning' : 'info',
        metadata: {
          ticket_id: ticket.id,
          ticket_number: getTicketDisplayName(ticket),
          request_type: partType,
          part_name: (selectedInventoryPart?.part_name || selectedInventoryPart?.description || partName).trim(),
          quantity: Number(partQty || 1),
          reason: partReason.trim(),
          engineer_email: user?.email,
        },
      });

      await safeUpsertOperationStatus({
        entity_type: 'ticket',
        entity_id: ticket.id,
        entity_name: getTicketDisplayName(ticket),
        status: ticketStatus,
        latitude: getTicketLatitude(ticket),
        longitude: getTicketLongitude(ticket),
        last_seen: now,
        source_module: 'FEMobiPartRedirect',
        metadata: {
          linked_part_request_id: partRequest.id,
          part_request_type: partType,
          part_name: (selectedInventoryPart?.part_name || selectedInventoryPart?.description || partName).trim(),
          quantity: Number(partQty || 1),
          engineer: getActorName(user),
          engineer_email: user?.email,
          site: getTicketSiteName(ticket),
        },
      });

      await safeUpsertOperationStatus({
        entity_type: 'part_request',
        entity_id: partRequest.id,
        entity_name: (selectedInventoryPart?.part_name || selectedInventoryPart?.description || partName).trim(),
        status: 'pending_operations',
        last_seen: now,
        source_module: 'FEMobiPartRedirect',
        metadata: {
          ticket_id: ticket.id,
          ticket_number: getTicketDisplayName(ticket),
          request_type: partType,
          quantity: Number(partQty || 1),
          current_department: 'operations',
        },
      });

      alert(
        partType === 'bank'
          ? 'Call redirected to Pending on Bank for Operations review.'
          : 'Call redirected to Pending on Parts for Operations review.'
      );

      setShowPartRequest(false);
      setPartType('consumable');
      setPartName('');
      setPartQty('1');
      setPartReason('');
      setPartEvidence([]);
      setSelectedInventoryPart(null);
      onCompleted();
    } catch (err) {
      console.error('Part redirect error:', err);
      alert(`Could not redirect part issue: ${err.message || 'Unknown error'}`);
    } finally {
      setRedirectingPart(false);
    }
  };

  const receivePartFromInventory = async () => {
    if (!ticket?.linked_part_request_id) {
      alert('No linked part request found for this ticket.');
      return;
    }

    const now = new Date().toISOString();

    try {
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({
          status: 'in_progress',
          completion_status: 'part_received',
          part_request_status: 'received_by_engineer',
          received_part_at: now,
          updated_at: now,
        })
        .eq('id', ticket.id);

      if (ticketError) {
        throw ticketError;
      }

      await supabase
        .from('part_requests')
        .update({
          dispatch_status: 'received_by_engineer',
          part_request_status: 'received_by_engineer',
          received_by_engineer_at: now,
          updated_at: now,
        })
        .eq('id', ticket.linked_part_request_id);

      await safeLogOperationEvent({
        event_type: 'part_received_by_engineer',
        entity_type: 'ticket',
        entity_id: ticket.id,
        title: `${getTicketDisplayName(ticket)} part received by engineer`,
        description: `${getActorName(user)} received dispatched part for ${getTicketDisplayName(ticket)}`,
        actor_name: getActorName(user),
        actor_id: user?.id || user?.email,
        department: FIELD_DEPARTMENT,
        severity: 'info',
        metadata: {
          ticket_id: ticket.id,
          ticket_number: getTicketDisplayName(ticket),
          linked_part_request_id: ticket.linked_part_request_id,
          engineer_email: user?.email,
        },
      });

      await safeUpsertOperationStatus({
        entity_type: 'ticket',
        entity_id: ticket.id,
        entity_name: getTicketDisplayName(ticket),
        status: 'in_progress',
        latitude: getTicketLatitude(ticket),
        longitude: getTicketLongitude(ticket),
        last_seen: now,
        source_module: 'FEMobiReceivePart',
        metadata: {
          linked_part_request_id: ticket.linked_part_request_id,
          part_request_status: 'received_by_engineer',
          engineer: getActorName(user),
          engineer_email: user?.email,
          site: getTicketSiteName(ticket),
        },
      });

      alert('Part received. You can now continue the job and submit review when completed.');
      onCompleted();
    } catch (err) {
      console.error('Receive part error:', err);
      alert(`Could not receive part: ${err.message || 'Unknown error'}`);
    }
  };

  const submitForReview = async () => {
    if (partLocked || partReadyToReceive) {
      alert(
        partReadyToReceive
          ? 'Inventory has dispatched this part. Please click Receive Part before submitting review.'
          : 'This job has a pending part request. You cannot submit review until Operations and Inventory finish the part workflow.'
      );
      return;
    }

    if (!completionNote.trim()) {
      alert('Please enter completion report before submitting.');
      return;
    }

    if (existingBeforePhotos.length === 0 && beforeFiles.length === 0) {
      alert('Please upload at least one BEFORE repair photo.');
      return;
    }

    if (existingAfterPhotos.length === 0 && afterFiles.length === 0) {
      alert('Please upload at least one AFTER repair photo.');
      return;
    }

    setUploading(true);

    try {
      const now = new Date().toISOString();

      const uploadedBeforePhotos = await uploadEvidenceFiles(
        beforeFiles,
        'before-photos'
      );

      const uploadedAfterPhotos = await uploadEvidenceFiles(
        afterFiles,
        'after-photos'
      );

      const uploadedVideos = await uploadEvidenceFiles(
        videoFiles,
        'videos'
      );

      const allBeforePhotos = [
        ...existingBeforePhotos,
        ...uploadedBeforePhotos,
      ];

      const allAfterPhotos = [
        ...existingAfterPhotos,
        ...uploadedAfterPhotos,
      ];

      const allVideos = [
        ...existingVideos,
        ...uploadedVideos,
      ];

      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'pending_review',
          completion_status: 'pending',
          completion_note: completionNote.trim(),
          completed_by: user?.full_name || user?.email,
          before_photos: allBeforePhotos,
          after_photos: allAfterPhotos,
          evidence_photos: [...allBeforePhotos, ...allAfterPhotos],
          evidence_videos: allVideos,
          submitted_review_at: now,
          submitted_at: now,
          updated_at: now,
          resolved_date: now,
        })
        .eq('id', ticket.id);

      if (error) {
        throw error;
      }

      await safeLogOperationEvent({
        event_type: 'ticket_submitted_for_review',
        entity_type: 'ticket',
        entity_id: ticket.id,
        title: `${getTicketDisplayName(ticket)} submitted for review`,
        description: `${getActorName(user)} submitted completion report for ${getTicketDisplayName(ticket)}`,
        actor_name: getActorName(user),
        actor_id: user?.id || user?.email,
        department: FIELD_DEPARTMENT,
        severity: 'info',
        metadata: {
          ticket_number: getTicketDisplayName(ticket),
          before_photos: allBeforePhotos.length,
          after_photos: allAfterPhotos.length,
          videos: allVideos.length,
          engineer_email: user?.email,
          site: getTicketSiteName(ticket),
        },
      });

      await safeUpsertOperationStatus({
        entity_type: 'ticket',
        entity_id: ticket.id,
        entity_name: getTicketDisplayName(ticket),
        status: 'pending_review',
        latitude: getTicketLatitude(ticket),
        longitude: getTicketLongitude(ticket),
        last_seen: now,
        source_module: 'FEMobiCompletionReview',
        metadata: {
          completion_status: 'pending',
          engineer: getActorName(user),
          engineer_email: user?.email,
          site: getTicketSiteName(ticket),
          evidence_photos: allBeforePhotos.length + allAfterPhotos.length,
          evidence_videos: allVideos.length,
        },
      });

      await safeUpsertOperationStatus({
        entity_type: 'engineer',
        entity_id: user?.id || user?.email,
        entity_name: getActorName(user),
        status: 'working',
        last_seen: now,
        source_module: 'FEMobiCompletionReview',
        metadata: {
          email: user?.email,
          current_ticket_id: ticket.id,
          current_ticket_number: getTicketDisplayName(ticket),
          current_site_name: getTicketSiteName(ticket),
        },
      });

      alert('Job submitted for Helpdesk/Operations review.');
      onCompleted();
    } catch (err) {
      console.error('Evidence submission error:', err);
      alert(`Could not submit job: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950 text-white overflow-y-auto overflow-x-hidden"
      style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
    >
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Ticket Details</h2>
          <p className="text-xs text-slate-400">
            {ticket.ticket_number || ticket.ticket_id || ticket.id}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-slate-800 p-2"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4 pb-36">
        <SectionCard title="Fault Description">
          <h3 className="font-semibold">
            {ticket.title || ticket.category || 'Assigned Job'}
          </h3>

          <p className="text-sm text-slate-400 mt-2">
            {ticket.description || 'No fault description provided.'}
          </p>
        </SectionCard>

        <SectionCard title="Branch & Device">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Bank" value={ticket.bank_name || ticket.client_name} />
            <Info label="Branch" value={ticket.branch_name || ticket.branch} />
            <Info label="Site" value={ticket.site_name} />
            <Info label="Terminal" value={ticket.terminal_id} />
            <Info label="Device" value={ticket.device_name} />
            <Info label="Department" value={ticket.department} />
          </div>
        </SectionCard>

        {ticket?.completion_status === 'rejected' && rejectionLog.length > 0 && (
          <SectionCard title="Rejected Completion">
            <div className="space-y-3">
              {rejectionLog.map((item, index) => (
                <div
                  key={`${item.rejected_at}-${index}`}
                  className="rounded-xl bg-red-950/40 border border-red-800 p-3"
                >
                  <p className="text-sm text-red-300 font-semibold">
                    Rejected by {item.rejected_by || 'Reviewer'}
                  </p>

                  <p className="text-xs text-red-400 mt-1">
                    {formatDate(item.rejected_at)}
                  </p>

                  <p className="text-sm text-slate-200 mt-2">
                    {item.reason}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Work History">
          <TimelineItem
            icon={<Calendar size={15} />}
            label="Created"
            value={formatDate(ticket.created_at)}
          />

          <TimelineItem
            icon={<UserCheck size={15} />}
            label="Assigned To"
            value={
              ticket.assigned_to_name ||
              ticket.assigned_engineer_email ||
              ticket.assigned_to
            }
          />

          <TimelineItem
            icon={<Clock size={15} />}
            label="Assigned At"
            value={formatDate(ticket.assigned_at)}
          />

          <TimelineItem
            icon={<CheckCircle size={15} />}
            label="Accepted"
            value={formatDate(ticket.accepted_at)}
          />

          <TimelineItem
            icon={<Navigation size={15} />}
            label="Trip Started"
            value={formatDate(ticket.trip_started_at)}
          />

          <TimelineItem
            icon={<MapPin size={15} />}
            label="Arrived On Site"
            value={formatDate(ticket.arrived_at)}
          />

          <TimelineItem
            icon={<PlayCircle size={15} />}
            label="Work Started"
            value={formatDate(ticket.work_started_at || ticket.started_at)}
          />

          <TimelineItem
            icon={<History size={15} />}
            label="Current Status"
            value={ticket.status}
          />

          <TimelineItem
            icon={<AlertTriangle size={15} />}
            label="Completion Status"
            value={ticket.completion_status || 'pending'}
          />

          <TimelineItem
            icon={<AlertTriangle size={15} />}
            label="SLA"
            value={ticket.sla_status || ticket.sla_level}
          />

          <TimelineItem
            icon={<Calendar size={15} />}
            label="SLA Deadline"
            value={formatDate(ticket.sla_deadline)}
          />

          <TimelineItem
            icon={<Upload size={15} />}
            label="Submitted Review"
            value={formatDate(ticket.submitted_at || ticket.submitted_review_at)}
          />

          <TimelineItem
            icon={<Calendar size={15} />}
            label="Updated"
            value={formatDate(ticket.updated_at)}
          />
        </SectionCard>

        <SectionCard title="Redirect Part Issue">
  <div className="space-y-3">
    <p className="text-sm text-slate-400">
      Use this when the machine cannot be completed because a part, consumable, or bank-damaged item is required.
    </p>

    {!showPartRequest ? (
      <button
        type="button"
        onClick={() => setShowPartRequest(true)}
        className="w-full rounded-xl bg-yellow-500/10 border border-yellow-500/30 py-3 text-sm font-semibold text-yellow-300 active:bg-yellow-500 active:text-white active:scale-95 transition-all"
      >
        Open Part / Bank Redirect Form
      </button>
    ) : (
      <div className="space-y-3 rounded-2xl bg-slate-950 border border-slate-800 p-3">
        <select
          value={partType}
          onChange={(e) => setPartType(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
        >
          <option value="consumable">
            Pending on Parts - Consumable / Company Supplied
          </option>
          <option value="bank">
            Pending on Bank - Damaged by Bank / Bank to Pay
          </option>
        </select>

        <div className="space-y-2">
          <input
            value={partName}
            onChange={(e) => {
              setPartName(e.target.value);
              setSelectedInventoryPart(null);
            }}
            placeholder="Search or type part name e.g Card Reader, Receipt Roll"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
          />

          {partName.trim().length > 1 && !selectedInventoryPart && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900">
              {loadingInventoryParts && (
                <p className="px-3 py-3 text-xs text-slate-400">
                  Checking inventory stock...
                </p>
              )}

              {!loadingInventoryParts && matchingInventoryParts.map((part) => (
                <div
                  key={part.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedInventoryPart(part);
                    setPartName(part.part_name || part.description || '');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSelectedInventoryPart(part);
                      setPartName(part.part_name || part.description || '');
                    }
                  }}
                  className="w-full text-left px-3 py-2 border-b border-slate-800 active:bg-green-600 transition-all cursor-pointer"
                >
                  <p className="text-sm font-semibold text-slate-100">
                    {part.part_name || part.description}
                  </p>
                  <p className="text-xs text-slate-400">
                    Part No: {part.part_number || 'N/A'} · Stock:{' '}
                    <span
                      className={
                        Number(part.quantity_available || 0) > 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }
                    >
                      {part.quantity_available || 0} available
                    </span>
                  </p>
                </div>
              ))}

              {!loadingInventoryParts && matchingInventoryParts.length === 0 && (
                <p className="px-3 py-3 text-xs text-slate-400">
                  No matching inventory item found. You can still submit this as a manual part request.
                </p>
              )}
            </div>
          )}

          {selectedInventoryPart && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
              <p className="text-xs text-green-300 font-semibold">
                Selected from inventory
              </p>
              <p className="text-sm text-white">
                {selectedInventoryPart.part_name || selectedInventoryPart.description}
              </p>
              <p className="text-xs text-slate-300">
                Part No: {selectedInventoryPart.part_number || 'N/A'} · Available:{' '}
                {selectedInventoryPart.quantity_available || 0}
              </p>
              <button
                type="button"
                onClick={() => setSelectedInventoryPart(null)}
                className="mt-2 text-xs text-red-300 underline"
              >
                Remove selection / use manual entry
              </button>
            </div>
          )}
        </div>

        <input
          value={partQty}
          onChange={(e) => setPartQty(e.target.value)}
          placeholder="Quantity"
          type="number"
          min="1"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
        />

        <textarea
          value={partReason}
          onChange={(e) => setPartReason(e.target.value)}
          placeholder="Explain the issue. Example: card reader damaged by bank user, receipt roll exhausted, cassette part worn out..."
          rows={4}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
        />

        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Picture Evidence optional but recommended
          </p>

          <input
  type="file"
  accept="image/*"
  multiple
  onChange={handleBeforePhotoChange}
/>

          {partEvidence.length > 0 && (
            <p className="text-xs text-green-400">
              {partEvidence.length} evidence photo(s) selected.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setShowPartRequest(false);
              setSelectedInventoryPart(null);
            }}
            className="rounded-xl bg-slate-800 border border-slate-700 py-3 text-sm font-semibold text-slate-200 active:bg-red-500 active:text-white active:scale-95 transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={redirectToPartRequest}
            disabled={redirectingPart || !partName.trim()}
            className="rounded-xl bg-orange-500 border border-orange-500 py-3 text-sm font-semibold text-white active:bg-green-500 active:scale-95 transition-all disabled:opacity-60"
          >
            {redirectingPart ? 'Redirecting...' : 'Submit Redirect'}
          </button>
        </div>
      </div>
    )}
  </div>
</SectionCard>

        {hasLinkedPartRequest && (
          <SectionCard title="Part Request Status">
            <div className="space-y-3">
              {partLocked && (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="text-sm font-semibold text-yellow-300">
                    Waiting for Operations / Inventory
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    This job is pending on parts and cannot be submitted as completed until the part workflow is finished.
                  </p>
                </div>
              )}

              {partReadyToReceive && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                  <p className="text-sm font-semibold text-green-300">
                    Part dispatched to engineer
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Click Receive Part to reopen this job for completion.
                  </p>
                  <button
                    type="button"
                    onClick={receivePartFromInventory}
                    className="mt-3 w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white active:bg-green-600 active:scale-95 transition-all"
                  >
                    Receive Part
                  </button>
                </div>
              )}

              {partAlreadyReceived && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                  <p className="text-sm font-semibold text-blue-300">
                    Part received by engineer
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    You can now continue the repair and submit review after completion.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Before Repair Photos">
          <div className="space-y-3">
            <input
  type="file"
  accept="image/*"
  multiple
  onChange={handleBeforePhotoChange}
/>

            {beforeFiles.length > 0 && (
              <p className="text-xs text-green-400">
                {beforeFiles.length} before photo(s) selected.
              </p>
            )}

            {existingBeforePhotos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Existing Before Photos:
                </p>

                {existingBeforePhotos.map((item, index) => (
                  <a
                    key={`${item.url}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-blue-400 underline"
                  >
                    View before photo {index + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="After Repair Photos">
          <div className="space-y-3">
            <input
  type="file"
  accept="image/*"
  multiple
  onChange={handleBeforePhotoChange}
/>

            {afterFiles.length > 0 && (
              <p className="text-xs text-green-400">
                {afterFiles.length} after photo(s) selected.
              </p>
            )}

            {existingAfterPhotos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Existing After Photos:
                </p>

                {existingAfterPhotos.map((item, index) => (
                  <a
                    key={`${item.url}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-blue-400 underline"
                  >
                    View after photo {index + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Video Evidence Optional">
  <div className="space-y-3">
    <input
      type="file"
      accept="video/*"
      onChange={handleVideoChange}
      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
    />

    {videoFiles.length > 0 && (
      <p className="text-xs text-green-400">
        {videoFiles.length} video(s) selected.
      </p>
    )}

    {existingVideos.length > 0 && (
      <div className="space-y-2">
        <p className="text-xs text-slate-400">Existing Videos:</p>

        {existingVideos.map((item, index) => (
          <a
            key={`${item.url}-${index}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-blue-400 underline"
          >
            View video {index + 1}
          </a>
        ))}
      </div>
    )}
  </div>
</SectionCard>

        <SectionCard title="Completion Report">
          <textarea
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            placeholder="Describe what you did on site, parts changed, test result, customer confirmation, and final ATM status."
            rows={6}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
          />

          <p className="text-xs text-slate-500 mt-2">
            Before photo, after photo, and completion report are required before submission.
          </p>
        </SectionCard>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            label="Start Trip"
            icon={<PlayCircle size={16} />}
            onClick={() => onUpdateStatus(ticket.id, 'traveling')}
          />

          <ActionButton
            label="Arrived"
            icon={<MapPin size={16} />}
            onClick={() => onUpdateStatus(ticket.id, 'arrived_on_site')}
          />

          <ActionButton
            label="Navigate"
            icon={<Navigation size={16} />}
            onClick={() => onNavigate(ticket)}
          />

          <ActionButton
            label="Redirect Part Issue"
            icon={<Package size={16} />}
            onClick={() => setShowPartRequest(true)}
          />

          {partReadyToReceive && (
            <ActionButton
              label="Receive Part"
              icon={<Package size={16} />}
              onClick={receivePartFromInventory}
              primary
            />
          )}

          <ActionButton
            label={
              partLocked
                ? 'Waiting for Part Workflow'
                : partReadyToReceive
                  ? 'Receive Part First'
                  : uploading
                    ? 'Submitting...'
                    : ticket?.completion_status === 'rejected'
                      ? 'Resubmit Review'
                      : 'Submit Review'
            }
            icon={<Upload size={16} />}
            onClick={submitForReview}
            primary
          />

          <ActionButton
            label="Close"
            icon={<X size={16} />}
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
}

function NotificationsModal({ notifications, onClose, onRefresh }) {
  const openNotification = (item) => {
    if (!item?.link) return;

    const link = item.link;

    onClose();

    setTimeout(() => {
      if (link.includes('/ark-connect')) {
        window.dispatchEvent(
          new CustomEvent('field-mobile-tab', {
            detail: { tab: 'connect' },
          })
        );
        return;
      }

      if (link.includes('/tickets')) {
        window.dispatchEvent(
          new CustomEvent('field-mobile-tab', {
            detail: { tab: 'tickets' },
          })
        );
        return;
      }

      if (link.includes('/parts') || link.includes('/inventory')) {
        window.dispatchEvent(
          new CustomEvent('field-mobile-tab', {
            detail: { tab: 'parts' },
          })
        );
        return;
      }

      window.dispatchEvent(
        new CustomEvent('field-mobile-tab', {
          detail: { tab: 'home' },
        })
      );
    }, 100);
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950 text-white overflow-y-auto overflow-x-hidden"
      style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
    >
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Notifications</h2>
          <p className="text-xs text-slate-400">Recent alerts and updates</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-slate-800 p-2">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-3 pb-28">
        <button type="button" onClick={onRefresh} className="w-full rounded-xl bg-slate-800 border border-slate-700 py-3 text-sm">
          Refresh Notifications
        </button>

        {notifications.length === 0 ? (
          <EmptyText text="No notification found." />
        ) : (
          notifications.map((item) => {
            const hasLink = Boolean(item?.link);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
                disabled={!hasLink}
                className={`w-full text-left rounded-2xl bg-slate-900 border border-slate-800 p-4 ${hasLink ? 'active:scale-[0.99]' : 'opacity-90'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {item.title || item.type || 'Notification'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {item.message || item.body || 'No message'}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  {hasLink && <span className="text-orange-400 text-xl">›</span>}
                </div>
                {hasLink && <p className="text-xs text-orange-400 mt-2">Tap to open</p>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function PartsScreen({ tickets, user }) {
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [selectedInventoryPart, setSelectedInventoryPart] = useState(null);
  const [inventoryParts, setInventoryParts] = useState([]);
  const [loadingInventoryParts, setLoadingInventoryParts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myPartRequests, setMyPartRequests] = useState([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedRequestId, setExpandedRequestId] = useState(null);

  const clean = (value) => String(value || '').toLowerCase();

  const fetchMyPartRequests = useCallback(async () => {
    if (!user?.email) return;

    setLoadingMyRequests(true);

    const { data, error } = await supabase
      .from('part_requests')
      .select('*')
      .eq('engineer_email', user.email)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('My part requests fetch error:', error);
      setMyPartRequests([]);
    } else {
      setMyPartRequests(data || []);
    }

    setLoadingMyRequests(false);
  }, [user?.email]);

  useEffect(() => {
    let active = true;
    const query = partName.trim();

    if (query.length < 2 || selectedInventoryPart) {
      setInventoryParts([]);
      setLoadingInventoryParts(false);
      return () => {
        active = false;
      };
    }

    const timer = window.setTimeout(async () => {
      setLoadingInventoryParts(true);

      const likeQuery = `%${query}%`;
      const { data, error } = await supabase
        .from('spare_parts')
        .select('id, part_name, description, part_number, serial_number, device_brand, device_model, quantity_available')
        .or(`part_name.ilike.${likeQuery},description.ilike.${likeQuery},part_number.ilike.${likeQuery},device_brand.ilike.${likeQuery},device_model.ilike.${likeQuery}`)
        .order('description', { ascending: true })
        .limit(MOBILE_PART_SEARCH_LIMIT);

      if (!active) return;

      if (error) {
        console.error('Parts inventory search error:', error);
        setInventoryParts([]);
      } else {
        setInventoryParts(data || []);
      }

      setLoadingInventoryParts(false);
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [partName, selectedInventoryPart]);

  useEffect(() => {
    fetchMyPartRequests();
  }, [fetchMyPartRequests]);

  const matchingInventoryParts = inventoryParts;

  const getRequestStage = (request) => {
    const operations = clean(request.operations_status || request.approval_status);
    const inventory = clean(request.inventory_status);
    const finance = clean(request.finance_status);
    const dispatch = clean(request.dispatch_status);
    const currentDepartment = clean(request.current_department);
    const requestType = clean(request.request_type);
    const reasonCategory = clean(request.reason_category);
    const status = clean(request.status || request.part_status);

    if (dispatch.includes('returned') || status.includes('returned') || currentDepartment.includes('returned')) {
      return 'returned';
    }

    if (requestType === 'bank' || reasonCategory.includes('damaged') || status.includes('failed') || status.includes('faulty')) {
      return 'failed';
    }

    if (dispatch.includes('used') || status.includes('used') || status.includes('installed') || status.includes('consumed')) {
      return 'used';
    }

    if (dispatch.includes('dispatched') || dispatch.includes('delivered') || dispatch.includes('issued') || currentDepartment.includes('field')) {
      return 'dispatched';
    }

    if (
      operations.includes('pending') ||
      inventory.includes('pending') ||
      finance.includes('pending') ||
      currentDepartment.includes('operations') ||
      currentDepartment.includes('inventory') ||
      currentDepartment.includes('finance')
    ) {
      return 'waiting';
    }

    return 'all';
  };

  const partSummary = [
    {
      key: 'all',
      title: 'All Requests',
      count: myPartRequests.length,
      desc: 'Every part request',
      tone: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
    },
    {
      key: 'waiting',
      title: 'Waiting Approval',
      count: myPartRequests.filter((r) => getRequestStage(r) === 'waiting').length,
      desc: 'Operations / Inventory / Accounts',
      tone: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
    },
    {
      key: 'dispatched',
      title: 'Dispatched',
      count: myPartRequests.filter((r) => getRequestStage(r) === 'dispatched').length,
      desc: 'Issued to field',
      tone: 'text-green-400 border-green-500/40 bg-green-500/10',
    },
    {
      key: 'failed',
      title: 'Failed Parts',
      count: myPartRequests.filter((r) => getRequestStage(r) === 'failed').length,
      desc: 'Bank damage / field failure',
      tone: 'text-red-400 border-red-500/40 bg-red-500/10',
    },
    {
      key: 'returned',
      title: 'Returned Parts',
      count: myPartRequests.filter((r) => getRequestStage(r) === 'returned').length,
      desc: 'Returned to inventory/RR',
      tone: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
    },
    {
      key: 'used',
      title: 'Used Parts',
      count: myPartRequests.filter((r) => getRequestStage(r) === 'used').length,
      desc: 'Installed / consumed',
      tone: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
    },
  ];

  const filteredRequests =
    activeFilter === 'all'
      ? myPartRequests
      : myPartRequests.filter((request) => getRequestStage(request) === activeFilter);

  const statusPillClass = (value) => {
    const v = clean(value);
    if (v.includes('approved') || v.includes('complete') || v.includes('dispatched')) {
      return 'bg-green-500/10 text-green-300 border-green-500/30';
    }
    if (v.includes('reject') || v.includes('failed') || v.includes('damage')) {
      return 'bg-red-500/10 text-red-300 border-red-500/30';
    }
    if (v.includes('pending') || v.includes('review') || v.includes('waiting')) {
      return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const StatusPill = ({ value, fallback = 'pending' }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${statusPillClass(value || fallback)}`}>
      {String(value || fallback).replaceAll('_', ' ')}
    </span>
  );

  const FlowStep = ({ title, value }) => (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2">
        <StatusPill value={value} />
      </div>
    </div>
  );

  const submitPartRequest = async () => {
    if (!partName.trim()) {
      alert('Enter the part needed.');
      return;
    }

    if (!reason.trim()) {
      alert('Enter reason for this part request.');
      return;
    }

    setSubmitting(true);

    try {
      const now = new Date().toISOString();
      const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
      const finalPartName = (
        selectedInventoryPart?.part_name ||
        selectedInventoryPart?.description ||
        partName
      ).trim();

      const { data: partRequest, error } = await supabase
        .from('part_requests')
        .insert({
          ticket_id: selectedTicket?.id || null,
          ticket_number: selectedTicket
            ? selectedTicket.ticket_number || selectedTicket.ticket_id || selectedTicket.id
            : null,
          engineer_email: user?.email,
          engineer_name: user?.full_name || user?.name || user?.email,
          part_name: finalPartName,
          quantity: Number(quantity || 1),
          request_type: 'consumable',
          reason_category: selectedTicket ? 'permanent_resolution' : 'engineer_part_request',
          reason_note: selectedInventoryPart
            ? `${reason.trim()}\n\nSelected inventory item: ${finalPartName} | Part No: ${selectedInventoryPart.part_number || 'N/A'} | Available Stock: ${selectedInventoryPart.quantity_available || 0}`
            : reason.trim(),
          approval_status: 'pending_operations',
          operations_status: 'pending_review',
          inventory_status: 'pending_review',
          finance_status: 'pending_dispatch_cost_review',
          dispatch_status: 'pending',
          current_department: 'operations',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      await safeLogPartLifecycle({
        part_request_id: partRequest?.id || null,
        ticket_id: selectedTicket?.id || null,
        part_id: selectedInventoryPart?.id || null,
        part_name: finalPartName,
        part_number: selectedInventoryPart?.part_number || null,
        serial_number: selectedInventoryPart?.serial_number || null,
        movement_type: 'engineer_part_requested',
        from_location: selectedTicket ? getTicketSiteName(selectedTicket) : 'Field Engineer',
        to_location: 'Operations Queue',
        from_department: FIELD_DEPARTMENT,
        to_department: 'Operations',
        issued_to_name: getActorName(user),
        issued_to_email: user?.email,
        quantity: Number(quantity || 1),
        status_before: null,
        status_after: 'pending_operations_review',
        notes: reason.trim(),
        evidence: [],
        actor_name: getActorName(user),
        actor_email: user?.email,
        actor_department: FIELD_DEPARTMENT,
      });

      await safeLogOperationEvent({
        event_type: 'part_request_created',
        entity_type: 'part_request',
        entity_id: partRequest?.id || `${user?.email || 'engineer'}-${Date.now()}`,
        title: `Part request created: ${finalPartName}`,
        description: `${getActorName(user)} requested ${quantity || 1} x ${finalPartName}${selectedTicket ? ` for ${getTicketDisplayName(selectedTicket)}` : ''}`,
        actor_name: getActorName(user),
        actor_id: user?.id || user?.email,
        department: FIELD_DEPARTMENT,
        severity: 'info',
        metadata: {
          ticket_id: selectedTicket?.id || null,
          ticket_number: selectedTicket ? getTicketDisplayName(selectedTicket) : null,
          part_name: finalPartName,
          quantity: Number(quantity || 1),
          reason: reason.trim(),
          engineer_email: user?.email,
        },
      });

      await safeUpsertOperationStatus({
        entity_type: 'part_request',
        entity_id: partRequest?.id || `${user?.email || 'engineer'}-${Date.now()}`,
        entity_name: finalPartName,
        status: 'pending_operations',
        last_seen: now,
        source_module: 'FEMobiPartsRequest',
        metadata: {
          ticket_id: selectedTicket?.id || null,
          ticket_number: selectedTicket ? getTicketDisplayName(selectedTicket) : null,
          quantity: Number(quantity || 1),
          current_department: 'operations',
          engineer_email: user?.email,
        },
      });

      if (selectedTicket?.id) {
        await safeUpsertOperationStatus({
          entity_type: 'ticket',
          entity_id: selectedTicket.id,
          entity_name: getTicketDisplayName(selectedTicket),
          status: selectedTicket.status || 'part_requested',
          latitude: getTicketLatitude(selectedTicket),
          longitude: getTicketLongitude(selectedTicket),
          last_seen: now,
          source_module: 'FEMobiPartsRequest',
          metadata: {
            linked_part_request_id: partRequest?.id,
            part_name: finalPartName,
            quantity: Number(quantity || 1),
            engineer: getActorName(user),
            engineer_email: user?.email,
          },
        });
      }

      alert('Part request sent to Operations, Inventory, and Accounts workflow.');

      setSelectedTicketId('');
      setPartName('');
      setQuantity('1');
      setReason('');
      setSelectedInventoryPart(null);
      fetchMyPartRequests();
    } catch (err) {
      console.error('Parts request error:', err);
      alert(`Could not submit parts request: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Parts" subtitle="Request parts and track approval, dispatch, usage, failed parts, and returns." />

      <div className="grid grid-cols-2 gap-3">
        {partSummary.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setActiveFilter(card.key)}
            className={`rounded-2xl border p-4 text-left active:scale-[0.98] ${
              activeFilter === card.key
                ? `${card.tone} ring-1 ring-orange-400/40`
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <p className="text-2xl font-bold text-white">{card.count}</p>
            <h3 className="text-sm font-bold text-white mt-1">{card.title}</h3>
            <p className="text-[11px] text-slate-400 mt-1">{card.desc}</p>
          </button>
        ))}
      </div>

      <SectionCard title="My Part Requests">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              Showing {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
            </p>

            <button
              type="button"
              onClick={fetchMyPartRequests}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-200 active:bg-orange-500 active:text-white"
            >
              {loadingMyRequests ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loadingMyRequests ? (
            <EmptyText text="Loading your part requests..." />
          ) : filteredRequests.length === 0 ? (
            <EmptyText text="No part request found for this category." />
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => {
                const isExpanded = expandedRequestId === request.id;
                const stage = getRequestStage(request);

                return (
                  <div key={request.id} className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                      className="w-full p-4 text-left active:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-orange-400">
                            {request.ticket_number || 'General Part Request'}
                          </p>
                          <h3 className="font-bold text-white mt-1 truncate">
                            {request.part_name || 'Requested Part'}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Qty: {request.quantity || 1} · {formatDate(request.created_at)}
                          </p>
                        </div>

                        <StatusPill
                          value={stage === 'waiting' ? request.current_department || request.operations_status : stage}
                        />
                      </div>

                      <p className="text-xs text-slate-500 mt-3 line-clamp-2">
                        {request.reason_note || 'No request note supplied.'}
                      </p>

                      <p className="text-[11px] text-orange-400 mt-3 font-semibold">
                        Tap to {isExpanded ? 'hide' : 'show'} part flow
                      </p>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-800 p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <FlowStep title="Operations" value={request.operations_status || request.approval_status} />
                          <FlowStep title="Inventory" value={request.inventory_status} />
                          <FlowStep title="Accounts" value={request.finance_status} />
                          <FlowStep title="Dispatch" value={request.dispatch_status} />
                        </div>

                        <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                          <p className="text-xs text-slate-500 mb-1">Current Department</p>
                          <p className="text-sm text-white capitalize">
                            {(request.current_department || 'operations').replaceAll('_', ' ')}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                          <p className="text-xs text-slate-500 mb-1">Request Note</p>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">
                            {request.reason_note || 'No note supplied.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="New Parts Request">
        <div className="space-y-3">
          <select
            value={selectedTicketId}
            onChange={(e) => setSelectedTicketId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
          >
            <option value="">Select related ticket optional</option>
            {tickets.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                {ticket.ticket_number || ticket.ticket_id || ticket.title}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            <input
              value={partName}
              onChange={(e) => {
                setPartName(e.target.value);
                setSelectedInventoryPart(null);
              }}
              placeholder="Search or type part name e.g Card Reader"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
            />

            {partName.trim().length > 1 && !selectedInventoryPart && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900">
                {loadingInventoryParts && (
                  <p className="px-3 py-3 text-xs text-slate-400">
                    Checking inventory stock...
                  </p>
                )}

                {!loadingInventoryParts && matchingInventoryParts.map((part) => (
                  <div
                    key={part.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedInventoryPart(part);
                      setPartName(part.part_name || part.description || '');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSelectedInventoryPart(part);
                        setPartName(part.part_name || part.description || '');
                      }
                    }}
                    className="w-full text-left px-3 py-2 border-b border-slate-800 active:bg-green-600 transition-all cursor-pointer"
                  >
                    <p className="text-sm font-semibold text-slate-100">
                      {part.part_name || part.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      Part No: {part.part_number || 'N/A'} · Stock:{' '}
                      <span className={Number(part.quantity_available || 0) > 0 ? 'text-green-400' : 'text-red-400'}>
                        {part.quantity_available || 0} available
                      </span>
                    </p>
                  </div>
                ))}

                {!loadingInventoryParts && matchingInventoryParts.length === 0 && (
                  <p className="px-3 py-3 text-xs text-slate-400">
                    No matching inventory item found. You can still submit this as a manual part request.
                  </p>
                )}
              </div>
            )}

            {selectedInventoryPart && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                <p className="text-xs text-green-300 font-semibold">Selected from inventory</p>
                <p className="text-sm text-white">
                  {selectedInventoryPart.part_name || selectedInventoryPart.description}
                </p>
                <p className="text-xs text-slate-300">
                  Part No: {selectedInventoryPart.part_number || 'N/A'} · Available: {selectedInventoryPart.quantity_available || 0}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedInventoryPart(null)}
                  className="mt-2 text-xs text-red-300 underline"
                >
                  Remove selection / use manual entry
                </button>
              </div>
            )}
          </div>

          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity"
            type="number"
            min="1"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
          />

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason / fault note. Example: temporary repair completed, part needed for permanent resolution."
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
          />

          <button
            type="button"
            onClick={submitPartRequest}
            disabled={submitting || !partName.trim()}
            className="w-full rounded-xl bg-orange-500 py-3 font-semibold disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Send Parts Request'}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}



function RequestScreen({ user }) {
  const [form, setForm] = useState(createMobileRequestForm);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');

  const categoryConfig =
    MOBILE_REQUEST_CATEGORIES[form.request_category] ||
    MOBILE_REQUEST_CATEGORIES[MOBILE_REQUEST_DEFAULT_CATEGORY];
  const CategoryIcon = categoryConfig.icon;

  const fetchRequests = useCallback(async () => {
    if (!user?.email) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('fund_requests')
      .select('*')
      .eq('requested_by_email', user.email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Mobile request fetch error:', error);
      setRequests([]);
    } else {
      setRequests(data || []);
    }

    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel(`femobi-requests-${user.email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fund_requests' },
        (payload) => {
          const row = payload.new || payload.old || {};

          if (row.requested_by_email === user.email) {
            fetchRequests();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email, fetchRequests]);

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const changeCategory = (category) => {
    const next = MOBILE_REQUEST_CATEGORIES[category]
      ? category
      : MOBILE_REQUEST_DEFAULT_CATEGORY;

    setForm((current) => ({
      ...current,
      request_category: next,
      request_type: MOBILE_REQUEST_CATEGORIES[next].types[0],
      amount: MOBILE_REQUEST_CATEGORIES[next].needsAmount ? current.amount : '',
      start_date: next === 'leave' ? current.start_date : '',
      end_date: next === 'leave' ? current.end_date : '',
      return_date: next === 'leave' ? current.return_date : '',
      repayment_amount: next === 'loan' ? current.repayment_amount : '',
      repayment_frequency: next === 'loan' ? current.repayment_frequency : 'Monthly',
    }));
  };

  const submitRequest = async () => {
    if (!user?.email) {
      alert('User profile is not ready. Please sign in again.');
      return;
    }

    if (!form.request_type) {
      alert('Select a request type.');
      return;
    }

    if (categoryConfig.needsAmount && (!form.amount || Number(form.amount) <= 0)) {
      alert('Enter a valid amount.');
      return;
    }

    if (!form.purpose.trim()) {
      alert('Enter the purpose or reason for this request.');
      return;
    }

    const leaveDays = calculateMobileLeaveDays(form.start_date, form.end_date);

    if (form.request_category === 'leave') {
      if (!form.start_date || !form.end_date) {
        alert('Select leave start date and end date.');
        return;
      }

      if (!leaveDays) {
        alert('Leave end date must be after or same as start date.');
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      request_category: form.request_category,
      request_type: form.request_type,
      request_subtype: form.request_type,
      amount: categoryConfig.needsAmount ? Number(form.amount || 0) : 0,
      purpose: form.purpose.trim(),
      notes: form.notes || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      return_date: form.return_date || null,
      days_count: leaveDays,
      attachment_url: form.attachment_url || null,
      repayment_amount:
        form.request_category === 'loan' && form.repayment_amount
          ? Number(form.repayment_amount)
          : null,
      repayment_frequency:
        form.request_category === 'loan'
          ? form.repayment_frequency || 'Monthly'
          : null,
      requested_by: user?.id || null,
      requested_by_email: user?.email || null,
      requested_by_name: user?.full_name || user?.name || user?.email || 'Field Engineer',
      department: user?.department || FIELD_DEPARTMENT,
      role: user?.role || 'field_engineer',
      source_module: 'FEMobi',
      status: 'pending',
      finance_status: categoryConfig.needsFinance ? 'pending_approval' : 'not_required',
      hr_status: 'pending',
      agm_status: 'pending',
      operations_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('fund_requests').insert(payload);

    setSubmitting(false);

    if (error) {
      console.error('Mobile request submit error:', error);
      alert(`Could not submit request: ${error.message}`);
      return;
    }

    setForm(createMobileRequestForm());
    fetchRequests();
    alert('Request submitted. You can track approval status below.');
  };

  const filteredRequests = requests.filter((request) => {
    if (filter === 'all') return true;

    if (filter === 'pending') {
      return getMobileRequestStage(request).toLowerCase().includes('pending');
    }

    if (filter === 'complete') {
      return ['Disbursed', 'Completed', 'Approved / Completed', 'CEO Approved - Completed'].includes(
        getMobileRequestStage(request)
      );
    }

    return getMobileRequestCategory(request) === filter;
  });

  return (
    <div className="space-y-4 pb-2">
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <p className="text-xs text-orange-400 font-semibold">Staff Self-Service</p>
        <h2 className="text-2xl font-bold text-white mt-1">Requests</h2>
        <p className="text-sm text-slate-400 mt-2">
          Submit fund, loan, float, leave and general requests from the field.
        </p>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <CategoryIcon size={21} />
          </div>
          <div>
            <h3 className="font-bold text-white">New Request</h3>
            <p className="text-xs text-slate-400">Choose request category and fill details.</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400">Category</label>
          <select
            value={form.request_category}
            onChange={(event) => changeCategory(event.target.value)}
            className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
          >
            {Object.entries(MOBILE_REQUEST_CATEGORIES).map(([key, item]) => (
              <option key={key} value={key}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400">Type</label>
          <select
            value={form.request_type}
            onChange={(event) => updateForm('request_type', event.target.value)}
            className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
          >
            {categoryConfig.types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {categoryConfig.needsAmount && (
          <div>
            <label className="text-xs text-slate-400">Amount</label>
            <input
              type="number"
              value={form.amount}
              onChange={(event) => updateForm('amount', event.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
            />
          </div>
        )}

        {form.request_category === 'leave' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-400">Start</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => updateForm('start_date', event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-2 py-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">End</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(event) => updateForm('end_date', event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-2 py-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Return</label>
              <input
                type="date"
                value={form.return_date}
                onChange={(event) => updateForm('return_date', event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-2 py-3 text-xs text-white"
              />
            </div>
          </div>
        )}

        {form.request_category === 'loan' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">Repayment</label>
              <input
                type="number"
                value={form.repayment_amount}
                onChange={(event) => updateForm('repayment_amount', event.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Frequency</label>
              <select
                value={form.repayment_frequency}
                onChange={(event) => updateForm('repayment_frequency', event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
              >
                <option value="Monthly">Monthly</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Weekly">Weekly</option>
                <option value="One-off">One-off</option>
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-400">Purpose / Reason</label>
          <textarea
            value={form.purpose}
            onChange={(event) => updateForm('purpose', event.target.value)}
            placeholder="Explain why this request is needed"
            className="mt-1 w-full min-h-[90px] rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400">Attachment URL</label>
          <input
            value={form.attachment_url}
            onChange={(event) => updateForm('attachment_url', event.target.value)}
            placeholder="Optional document link"
            className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400">Notes</label>
          <textarea
            value={form.notes}
            onChange={(event) => updateForm('notes', event.target.value)}
            placeholder="Optional note"
            className="mt-1 w-full min-h-[70px] rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white"
          />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={submitRequest}
          className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-white">My Requests</h3>
            <p className="text-xs text-slate-400">Track approval and finance status.</p>
          </div>

          <button
            type="button"
            onClick={fetchRequests}
            className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs"
          >
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            ['all', 'All'],
            ['pending', 'Pending'],
            ['complete', 'Done'],
            ['leave', 'Leave'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-xl py-2 text-[11px] font-semibold border ${
                filter === key
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <EmptyText text="Loading requests..." />
        ) : filteredRequests.length === 0 ? (
          <EmptyText text="No request found." />
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const category = getMobileRequestCategory(request);
              const currentConfig = MOBILE_REQUEST_CATEGORIES[category] || MOBILE_REQUEST_CATEGORIES.fund;
              const CurrentIcon = currentConfig.icon;
              const needsFinance = mobileRequestNeedsFinance(request);

              return (
                <div key={request.id} className="rounded-2xl bg-slate-800 border border-slate-700 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-[10px] text-slate-300">
                          <CurrentIcon size={12} />
                          {currentConfig.label}
                        </span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] ${getMobileRequestStatusClass(request)}`}>
                          {getMobileRequestStage(request)}
                        </span>
                      </div>

                      <h4 className="font-semibold text-white mt-2 truncate">
                        {request.request_type || 'Request'}
                      </h4>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {request.purpose || 'No purpose provided.'}
                      </p>

                      {category === 'leave' && (
                        <p className="text-xs text-purple-300 mt-1">
                          {request.start_date || 'Start'} - {request.end_date || 'End'}
                          {request.days_count ? ` • ${request.days_count} day(s)` : ''}
                        </p>
                      )}

                      <p className="text-[10px] text-slate-500 mt-2">
                        {formatDate(request.created_at)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-orange-400">
                        {needsFinance ? mobileMoney(request.amount) : 'No ₦'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {request.finance_status || (needsFinance ? 'pending' : 'not_required')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 mt-3 text-[10px]">
                    <span className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-slate-300">
                      HR: {request.hr_status || 'pending'}
                    </span>
                    <span className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-slate-300">
                      AGM: {request.agm_status || 'pending'}
                    </span>
                    <span className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-slate-300">
                      OPS: {request.operations_status || 'pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ConnectScreen({
  user,
  dmCount,
  mails = [],
  loadingMails = false,
  chatMessages = [],
  loadingChat = false,
  onRefreshMails,
  onRefreshChat,
  onSupportRequest,
}) {
  const [activeSection, setActiveSection] = useState('chats');
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedMail, setSelectedMail] = useState(null);

  const channels = ['General', 'Engineers', 'Helpdesk', 'Operations'];

  const directChats = Object.values(
    chatMessages
      .filter((msg) => !msg.channel_name)
      .reduce((acc, msg) => {
        const otherEmail =
          msg.sender_id === user?.email ? msg.recipient_id : msg.sender_id;

        const otherName =
          msg.sender_id === user?.email ? msg.recipient_name : msg.sender_name;

        if (!otherEmail) return acc;

        if (!acc[otherEmail]) {
          acc[otherEmail] = {
            type: 'direct',
            id: otherEmail,
            name: otherName || otherEmail,
            email: otherEmail,
            messages: [],
          };
        }

        acc[otherEmail].messages.push(msg);
        return acc;
      }, {})
  ).map((chat) => ({
    ...chat,
    lastMessage: chat.messages.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )[0],
  }));

  const channelChats = channels.map((channel) => {
    const messages = chatMessages.filter((msg) => msg.channel_name === channel);

    return {
      type: 'channel',
      id: channel,
      name: `# ${channel}`,
      channel_name: channel,
      messages,
      lastMessage: messages.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )[0],
    };
  });

  const inboxMails = mails.filter(
    (mail) => mail.direction !== 'outbound' && mail.is_sent !== true
  );

  const sentMails = mails.filter(
    (mail) => mail.direction === 'outbound' || mail.is_sent === true
  );

  const unreadMails = inboxMails.filter((mail) =>
    ['new', 'unread', 'assigned'].includes(
      String(mail.email_status || '').toLowerCase()
    )
  ).length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <h2 className="text-xl font-bold text-white">Connect</h2>
        <p className="text-sm text-slate-400 mt-1">
          WhatsApp-style chat, Gmail-style mail and support.
        </p>
      </section>

      <div className="grid grid-cols-4 gap-2">
        {[
          ['chats', 'Chats'],
          ['channels', 'Channels'],
          ['mail', `Mail ${unreadMails ? `(${unreadMails})` : ''}`],
          ['support', 'Support'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`rounded-xl py-3 text-[11px] font-semibold border ${
              activeSection === key
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'chats' && (
        <SectionCard title="Direct Chats">
          <button
            type="button"
            onClick={onRefreshChat}
            className="w-full rounded-xl bg-slate-800 border border-slate-700 py-3 text-sm mb-3"
          >
            {loadingChat ? 'Refreshing...' : 'Refresh Chats'}
          </button>

          {directChats.length === 0 ? (
            <EmptyText text="No direct chat found yet." />
          ) : (
            <div className="space-y-2">
              {directChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  title={chat.name}
                  subtitle={chat.lastMessage?.message_body}
                  time={chat.lastMessage?.created_at}
                  onClick={() => setSelectedChat(chat)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {activeSection === 'channels' && (
        <SectionCard title="Channels">
          <div className="space-y-2">
            {channelChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                title={chat.name}
                subtitle={chat.lastMessage?.message_body || 'No message yet'}
                time={chat.lastMessage?.created_at}
                onClick={() => setSelectedChat(chat)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {activeSection === 'mail' && (
        <SectionCard title="Mail">
          <button
            type="button"
            onClick={onRefreshMails}
            className="w-full rounded-xl bg-slate-800 border border-slate-700 py-3 text-sm mb-3"
          >
            {loadingMails ? 'Refreshing...' : 'Refresh Mail'}
          </button>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-orange-400">Inbox</h3>

            {inboxMails.length === 0 ? (
              <EmptyText text="No inbox mail found." />
            ) : (
              inboxMails.slice(0, 20).map((mail) => (
                <MailListItem
                  key={mail.id}
                  mail={mail}
                  onClick={() => setSelectedMail(mail)}
                />
              ))
            )}

            <h3 className="text-sm font-semibold text-orange-400 pt-3">Sent</h3>

            {sentMails.length === 0 ? (
              <EmptyText text="No sent mail found." />
            ) : (
              sentMails.slice(0, 10).map((mail) => (
                <MailListItem
                  key={mail.id}
                  mail={mail}
                  onClick={() => setSelectedMail(mail)}
                />
              ))
            )}
          </div>
        </SectionCard>
      )}

      {activeSection === 'support' && (
        <SectionCard title="Quick Support">
          <div className="space-y-3">
            <ConnectCard
              title="Helpdesk"
              text="Need remote troubleshooting or ticket support."
              onClick={() =>
                onSupportRequest(
                  'Helpdesk',
                  'Engineer requested Helpdesk support from mobile.'
                )
              }
            />

            <ConnectCard
              title="Operations"
              text="Escalate site access, SLA risk or customer delay."
              onClick={() =>
                onSupportRequest(
                  'Operations',
                  'Engineer requested Operations support from mobile.'
                )
              }
            />

            <ConnectCard
              title="Inventory"
              text="Follow up on urgent parts or replacement items."
              onClick={() =>
                onSupportRequest(
                  'Inventory',
                  'Engineer requested Inventory support from mobile.'
                )
              }
            />
          </div>
        </SectionCard>
      )}

      {selectedChat && (
        <WhatsAppChatModal
          chat={selectedChat}
          user={user}
          onClose={() => setSelectedChat(null)}
          onSent={onRefreshChat}
        />
      )}

      {selectedMail && (
  <GmailMailModal
    mail={selectedMail}
    user={user}
    onClose={() => setSelectedMail(null)}
    onSent={onRefreshMails}
  />
)}
    </div>
  );
}

function ChatListItem({ title, subtitle, time, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-slate-800 border border-slate-700 p-3 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-orange-500/15 border border-orange-500 flex items-center justify-center">
          <MessageCircle size={22} className="text-orange-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-white truncate">{title}</h3>
            <span className="text-[10px] text-slate-500 shrink-0">
              {time ? formatDate(time) : ''}
            </span>
          </div>

          <p className="text-xs text-slate-400 truncate mt-1">
            {subtitle || 'Tap to start conversation'}
          </p>
        </div>
      </div>
    </button>
  );
}

function MailListItem({ mail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-slate-800 border border-slate-700 p-3 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">
            {mail.subject || 'No Subject'}
          </p>

          <p className="text-xs text-slate-400 mt-1 truncate">
            {mail.sender_name || mail.sender_email || 'ARK Mail'} •{' '}
            {formatDate(mail.created_at || mail.received_at)}
          </p>

          <p className="text-sm text-slate-300 mt-2 line-clamp-2">
            {mail.message_body || 'No message body'}
          </p>
        </div>

        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-orange-300">
          {mail.email_status || 'New'}
        </span>
      </div>
    </button>
  );
}

function WhatsAppChatModal({ chat, user, onClose, onSent }) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState(chat.messages || []);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const isDirectChat = chat.type === 'direct';
  const isChannelChat = chat.type === 'channel';

  const upsertLocalMessages = useCallback((incomingMessages = []) => {
    setLocalMessages((prev) => {
      const map = new Map();

      [...prev, ...incomingMessages].forEach((msg) => {
        const key = msg.id || `${msg.sender_id}-${msg.created_at}-${msg.message_body}`;
        map.set(key, msg);
      });

      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    });
  }, []);

  const fetchLatestMessages = useCallback(async () => {
    if (!user?.email) return;

    setLoadingMessages(true);

    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);

    if (isChannelChat) {
      query = query
        .eq('message_type', 'channel')
        .eq('channel_name', chat.channel_name);
    } else if (isDirectChat && chat.email) {
      query = query
        .eq('message_type', 'dm')
        .or(
          `and(sender_id.eq.${user.email},recipient_id.eq.${chat.email}),and(sender_id.eq.${chat.email},recipient_id.eq.${user.email})`
        );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Mobile chat modal refresh error:', error);
    } else {
      setLocalMessages(data || []);
    }

    setLoadingMessages(false);
  }, [user?.email, chat.email, chat.channel_name, isDirectChat, isChannelChat]);

  useEffect(() => {
    setLocalMessages(chat.messages || []);
    fetchLatestMessages();
  }, [chat.id, chat.messages, fetchLatestMessages]);

  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel(`femobi-chat-${chat.id}-${user.email}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new;

          const belongsToChannel =
            isChannelChat &&
            msg.message_type === 'channel' &&
            msg.channel_name === chat.channel_name;

          const belongsToDirect =
            isDirectChat &&
            msg.message_type === 'dm' &&
            ((msg.sender_id === user.email && msg.recipient_id === chat.email) ||
              (msg.sender_id === chat.email && msg.recipient_id === user.email));

          if (belongsToChannel || belongsToDirect) {
            upsertLocalMessages([msg]);
            onSent?.(msg);
          }
        }
      )
      .subscribe();

    const interval = window.setInterval(fetchLatestMessages, 5000);

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [
    user?.email,
    chat.id,
    chat.email,
    chat.channel_name,
    isDirectChat,
    isChannelChat,
    fetchLatestMessages,
    upsertLocalMessages,
    onSent,
  ]);

  const messages = [...localMessages].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const sendMessage = async () => {
    const clean = replyText.trim();
    if (!clean || sending || !user?.email) return;

    setSending(true);

    const now = new Date().toISOString();

    const payload = {
      sender_id: user.email,
      sender_name: user?.full_name || user?.name || user.email,
      sender_role: user?.role || 'engineer',
      recipient_id: isDirectChat ? chat.email : null,
      recipient_name: isDirectChat ? chat.name : null,
      message_type: isChannelChat ? 'channel' : 'dm',
      channel_name: isChannelChat ? chat.channel_name : null,
      message_body: clean,
      created_at: now,
    };

    const tempMessage = {
      ...payload,
      id: `temp-${now}`,
      pending: true,
    };

    // Show message instantly in the chatbox before database refresh returns.
    upsertLocalMessages([tempMessage]);
    setReplyText('');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(payload)
      .select()
      .single();

    setSending(false);

    if (error) {
      console.error('Mobile chat send error:', {
        error,
        payload,
        chat,
        userEmail: user?.email,
      });

      // Remove temporary message if Supabase rejects the send.
      setLocalMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setReplyText(clean);
      alert(`Could not send message: ${error.message}`);
      return;
    }

    setLocalMessages((prev) =>
      prev
        .filter((msg) => msg.id !== tempMessage.id)
        .concat(data ? [data] : [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    );

    onSent?.(data);
    fetchLatestMessages();
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-slate-950 text-white overflow-hidden"
      style={{ height: '100svh', maxHeight: '100svh' }}
    >
      <div className="h-[72px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 p-2"
          >
            <X size={18} />
          </button>

          <div className="min-w-0">
            <h2 className="font-bold truncate">{chat.name}</h2>
            <p className="text-xs text-slate-400">
              {loadingMessages
                ? 'Refreshing...'
                : chat.type === 'channel'
                  ? 'Channel'
                  : 'Direct message'}
            </p>
          </div>
        </div>
      </div>

      <div
        className="h-[calc(100svh-142px)] overflow-y-auto overflow-x-hidden p-4 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        {messages.length === 0 ? (
          <EmptyText text="No message yet. Start conversation below." />
        ) : (
          messages.map((msg) => {
            const mine = msg.sender_id === user?.email;

            return (
              <div
                key={msg.id || `${msg.sender_id}-${msg.created_at}-${msg.message_body}`}
                className={`max-w-[82%] rounded-2xl p-3 text-sm ${
                  mine
                    ? 'ml-auto bg-orange-500 text-white rounded-br-sm'
                    : 'mr-auto bg-slate-800 text-slate-200 rounded-bl-sm'
                } ${msg.pending ? 'opacity-70' : ''}`}
              >
                {!mine && (
                  <p className="text-[10px] text-slate-400 mb-1">
                    {msg.sender_name || msg.sender_id}
                  </p>
                )}

                <p className="whitespace-pre-wrap">{msg.message_body}</p>

                <p className={`text-[10px] mt-1 ${mine ? 'text-orange-100' : 'text-slate-500'}`}>
                  {msg.pending ? 'Sending...' : formatDate(msg.created_at)}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div
        className="fixed left-0 right-0 bottom-0 bg-slate-900 border-t border-slate-800 p-3 flex gap-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Message..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 text-sm"
        />

        <button
          type="button"
          onClick={sendMessage}
          disabled={sending || !replyText.trim()}
          className="h-11 w-11 rounded-full bg-orange-500 flex items-center justify-center disabled:opacity-60"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function GmailMailModal({ mail, user, onClose, onSent }) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    const clean = replyText.trim();
    if (!clean) return;

    const recipientEmail = mail.sender_email || mail.recipient_email;

    if (!recipientEmail) {
      alert('No recipient found.');
      return;
    }

    setSending(true);

    const now = new Date().toISOString();

    const { error } = await supabase.from('email_messages').insert({
      subject: mail.subject?.startsWith('Re:')
        ? mail.subject
        : `Re: ${mail.subject || 'No Subject'}`,
      sender_name: user?.full_name || user?.name || user?.email,
      sender_email: user?.email,
      recipient_email: recipientEmail,
      message_body: clean,
      email_status: 'Sent',
      is_sent: true,
      is_draft: false,
      archived_status: false,
      direction: 'outbound',
      replied_status: true,
      linked_ticket_id: mail.linked_ticket_id || null,
      related_bank: mail.related_bank || null,
      related_branch: mail.related_branch || null,
      received_at: now,
      created_at: now,
      updated_at: now,
    });

    setSending(false);

    if (error) {
      console.error('Mail reply error:', error);
      alert(`Could not send mail: ${error.message}`);
      return;
    }

    setReplyText('');
    alert('Mail sent.');
    onSent?.();
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-slate-950 text-white overflow-hidden"
      style={{ height: '100svh', maxHeight: '100svh' }}
    >
      <div className="h-[72px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="font-bold truncate">Mail</h2>
          <p className="text-xs text-slate-400 truncate">
            {mail.sender_name || mail.sender_email || 'ARK Mail'}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-slate-800 p-2"
        >
          <X size={18} />
        </button>
      </div>

      <div
        className="h-[calc(100svh-142px)] overflow-y-auto overflow-x-hidden p-4 space-y-4"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h2 className="text-xl font-bold text-white">
            {mail.subject || 'No Subject'}
          </h2>

          <p className="text-xs text-slate-500 mt-2">
            From: {mail.sender_name || mail.sender_email || 'Unknown'}
          </p>

          <p className="text-xs text-slate-500">
            Date: {formatDate(mail.created_at || mail.received_at)}
          </p>

          <p className="text-sm text-slate-300 whitespace-pre-wrap mt-4">
            {mail.message_body || 'No message body.'}
          </p>
        </div>
      </div>

      <div
        className="fixed left-0 right-0 bottom-0 bg-slate-900 border-t border-slate-800 p-3 flex gap-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendReply()}
          placeholder="Reply..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 text-sm"
        />

        <button
          type="button"
          onClick={sendReply}
          disabled={sending}
          className="h-11 w-11 rounded-full bg-orange-500 flex items-center justify-center disabled:opacity-60"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function ConnectCard({ title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl bg-slate-800 border border-slate-700 p-3 active:scale-[0.99]"
    >
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="text-xs text-slate-400 mt-1">{text}</p>
    </button>
  );
}

function ProfileScreen({
  user,
  tickets,
  devices = [],
  loadingDevices = false,
  onLogout,
  onTabChange,
}) {
  const [fieldStatus, setFieldStatus] = useState(user?.field_status || 'available');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [mobileEngineerStatus, setMobileEngineerStatus] = useState(null);

  useEffect(() => {
    const fetchMobileEngineerStatus = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('engineer_statuses')
        .select('profile_photo, status, phone, department, staff_id, skills, regions')
        .eq('engineer_email', user.email)
        .maybeSingle();

      if (error) {
        console.error('Mobile engineer status fetch error:', error);
        return;
      }

      if (data) {
        setMobileEngineerStatus(data);

        if (data.status) {
          setFieldStatus(data.status);
        }
      }
    };

    fetchMobileEngineerStatus();
  }, [user?.email]);

  const profilePhoto = mobileEngineerStatus?.profile_photo || '';

  const completed = tickets.filter((ticket) =>
    ['approved', 'closed', 'completed'].includes(ticket.status)
  ).length;

  const pendingReview = tickets.filter((ticket) =>
    ticket.status === 'pending_review' || ticket.completion_status === 'pending'
  ).length;

  const rejectedTickets = tickets.filter((ticket) =>
    ticket.completion_status === 'rejected'
  );

  const activeMachines = devices.filter((device) =>
    ['active', 'Active'].includes(device.device_status || device.status || device.state)
  ).length;

  const faultyMachines = devices.filter((device) =>
    ['faulty', 'Faulty'].includes(device.device_status || device.status || device.state)
  ).length;

  const slaRisk = devices.filter((device) =>
    ['Warning', 'Breached', 'Critical', 'warning', 'breached', 'critical'].includes(device.sla_status)
  ).length;

  const currentStatusLabel = {
    available: 'Available',
    traveling: 'Traveling',
    on_site: 'On Site',
    busy: 'Busy',
    offline: 'Offline',
  }[fieldStatus] || 'Available';

  const updateFieldStatus = async (value) => {
    setFieldStatus(value);

    const { error } = await supabase
      .from('users')
      .update({
        field_status: value,
        updated_at: new Date().toISOString(),
      })
      .eq('email', user.email);

    if (error) {
      console.error('Field status update error:', error);
      alert('Could not update field status.');
    }
  };

  const FieldStatusButton = ({ value, label, icon, dotClass }) => (
    <button
      type="button"
      onClick={() => updateFieldStatus(value)}
      className={`rounded-xl border px-2 py-2 text-[11px] font-semibold flex items-center justify-center gap-1.5 min-h-[42px] ${
        fieldStatus === value
          ? 'border-orange-500 bg-orange-500/10 text-white shadow-[0_0_12px_rgba(249,115,22,0.20)]'
          : 'border-slate-700 bg-slate-900/70 text-slate-400'
      }`}
    >
      {icon ? (
        <span className="text-base leading-none">{icon}</span>
      ) : (
        <span className={`w-3 h-3 rounded-full ${dotClass}`} />
      )}
      <span className="truncate">{label}</span>
    </button>
  );

  const MiniStat = ({ title, value, icon, tone }) => {
    const tones = {
      blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      green: 'text-green-400 border-green-500/30 bg-green-500/10',
      amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      red: 'text-red-400 border-red-500/30 bg-red-500/10',
    };

    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 px-3 py-3 min-h-[86px] flex flex-col items-center justify-center text-center">
        <div className={`w-9 h-9 rounded-full border flex items-center justify-center mb-1.5 ${tones[tone]}`}>
          {icon}
        </div>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-[11px] text-slate-400 mt-1 leading-tight">{title}</p>
      </div>
    );
  };

  const QuickAction = ({ icon, label, onClick, accent = 'text-orange-400' }) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-slate-900 border border-slate-800 p-3 min-h-[76px] flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
    >
      <span className={accent}>{icon}</span>
      <span className="text-[11px] text-slate-200 font-medium text-center leading-tight">{label}</span>
    </button>
  );

  return (
    <div className="space-y-3 pb-2">
      <section className="rounded-2xl bg-slate-900/95 border border-slate-800 p-4">
        <div className="flex items-center gap-4">
          <div className="w-[76px] h-[76px] rounded-full border-2 border-orange-500 bg-slate-950 flex items-center justify-center shrink-0 overflow-hidden">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt={user?.full_name || user?.name || 'Engineer'}
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={40} className="text-orange-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">
              {user?.full_name || user?.name || 'Engineer'}
            </h2>

            <span className="inline-block mt-1 text-xs border border-orange-500 text-orange-400 rounded-full px-3 py-0.5 font-semibold">
              Engineer
            </span>

            <p className="text-sm text-slate-400 mt-2 truncate">
              {user?.email}
            </p>

            <p className="text-sm text-green-400 mt-1 font-semibold">
              ● {currentStatusLabel}
            </p>
          </div>

          <span className="text-orange-500 text-4xl leading-none">›</span>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <h3 className="font-bold text-base mb-3">Field Status</h3>

        <div className="grid grid-cols-5 gap-2">
          <FieldStatusButton value="available" label="Available" dotClass="bg-green-500" />
          <FieldStatusButton value="traveling" label="Traveling" icon="🚚" />
          <FieldStatusButton value="on_site" label="On Site" icon="📍" />
          <FieldStatusButton value="busy" label="Busy" dotClass="bg-red-500" />
          <FieldStatusButton value="offline" label="Offline" dotClass="bg-slate-400" />
        </div>
      </section>

      <div className="grid grid-cols-4 gap-2">
        <MiniStat title="All Jobs" value={tickets.length} icon={<ClipboardList size={19} />} tone="blue" />
        <MiniStat title="Completed" value={completed} icon={<CheckCircle size={20} />} tone="green" />
        <MiniStat title="Pending Review" value={pendingReview} icon={<History size={20} />} tone="amber" />
        <MiniStat title="Rejected" value={rejectedTickets.length} icon={<X size={20} />} tone="red" />
      </div>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">Engineer Details</h3>
          <span className="text-orange-500 text-3xl leading-none">›</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Department</p>
            <p className="text-slate-100 truncate">{user?.department || 'General'}</p>
          </div>

          <div>
            <p className="text-slate-500 text-xs">Email</p>
            <p className="text-slate-100 truncate">{user?.email}</p>
          </div>

          <div>
            <p className="text-slate-500 text-xs">Phone</p>
            <p className="text-slate-100 truncate">{user?.phone || user?.phone_number || 'Not set'}</p>
          </div>

          <div>
            <p className="text-slate-500 text-xs">Member Since</p>
            <p className="text-slate-100 truncate">{formatDate(user?.created_at)}</p>
          </div>

          <div>
            <p className="text-slate-500 text-xs">Role</p>
            <p className="text-slate-100 capitalize truncate">{user?.role || 'Engineer'}</p>
          </div>

          <div>
            <p className="text-slate-500 text-xs">Status</p>
            <span className="inline-block text-green-400 border border-green-500/40 bg-green-500/10 rounded-full px-2 py-0.5 text-xs font-semibold capitalize">
              {user?.status || user?.approval_status || 'Active'}
            </span>
          </div>
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setSelectedDevice({ view: 'list' })}
          className="w-full text-left rounded-2xl bg-slate-900 border border-orange-500 p-4 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-full border-2 border-orange-500 bg-orange-500/10 flex items-center justify-center shrink-0">
                <Package size={29} className="text-orange-500" />
              </div>

              <div className="min-w-0">
                <h3 className="font-bold text-lg text-white truncate">
                  My Assigned Machines
                </h3>
                <p className="text-sm text-slate-400 truncate">
                  All machines assigned to you
                </p>
              </div>
            </div>

            <span className="text-orange-500 text-4xl leading-none">›</span>
          </div>

          <div className="mt-3 ml-[68px]">
            <p className="text-4xl font-bold text-white leading-none">
              {loadingDevices ? '...' : devices.length}
            </p>
            <p className="text-sm text-slate-400 mt-1">Total Machines</p>
          </div>

          <div className="border-t border-slate-800 mt-4 pt-3 grid grid-cols-4 gap-2 text-center items-center">
            <div>
              <p className="text-green-400 font-bold text-lg">● {activeMachines}</p>
              <p className="text-xs text-slate-400">Active</p>
            </div>

            <div>
              <p className="text-yellow-400 font-bold text-lg">⚠ {slaRisk}</p>
              <p className="text-xs text-slate-400">SLA Risk</p>
            </div>

            <div>
              <p className="text-red-400 font-bold text-lg">✖ {faultyMachines}</p>
              <p className="text-xs text-slate-400">Faulty</p>
            </div>

            <p className="text-orange-400 text-xs font-semibold leading-tight text-right">
              Tap to view<br />machine list
            </p>
          </div>
        </button>
      </section>

      <section>
        <h3 className="font-bold text-base mb-2">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={<FileText size={26} />} label="New Ticket" onClick={() => onTabChange?.('tickets')} />
          <QuickAction icon={<ClipboardList size={26} />} label="My Tickets" onClick={() => onTabChange?.('tickets')} accent="text-blue-400" />
          <QuickAction icon={<Upload size={26} />} label="Submit Completion" onClick={() => onTabChange?.('jobs')} accent="text-green-400" />
          <QuickAction icon={<History size={26} />} label="History" onClick={() => onTabChange?.('tickets')} accent="text-purple-400" />
        </div>
      </section>

      <button
        type="button"
        onClick={onLogout}
        className="w-full rounded-xl bg-red-600 py-3.5 font-semibold flex items-center justify-center gap-2"
      >
        <LogOut size={20} />
        Log Out
      </button>

      {selectedDevice?.view === 'list' && (
        <AssignedMachinesModal
          devices={devices}
          onClose={() => setSelectedDevice(null)}
          onSelectDevice={(device) => setSelectedDevice(device)}
        />
      )}

      {selectedDevice && !selectedDevice.view && (
        <DeviceDetailsModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onBack={() => setSelectedDevice({ view: 'list' })}
        />
      )}
    </div>
  );
}

function AssignedMachinesModal({ devices, onClose, onSelectDevice }) {
  const [search, setSearch] = useState('');

  const filteredDevices = devices.filter((device) => {
    const q = search.toLowerCase();

    return (
      !q ||
      device.terminal_id?.toLowerCase().includes(q) ||
      device.atm_terminal_id?.toLowerCase().includes(q) ||
      device.bank_name?.toLowerCase().includes(q) ||
      device.client_name?.toLowerCase().includes(q) ||
      device.branch_name?.toLowerCase().includes(q) ||
      device.branch?.toLowerCase().includes(q) ||
      device.site_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-[84] bg-slate-950 text-white overflow-y-auto overflow-x-hidden"
      style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
    >
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Assigned Machines</h2>
            <p className="text-xs text-slate-400">
              {filteredDevices.length} of {devices.length} machines
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 p-2"
          >
            <X size={20} />
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search terminal, bank, branch..."
          className="w-full mt-4 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm"
        />
      </div>

      <div className="p-4 space-y-3 pb-28">
        {filteredDevices.length === 0 ? (
          <EmptyText text="No machine found." />
        ) : (
          filteredDevices.map((device) => (
            <button
              key={device.id}
              type="button"
              onClick={() => onSelectDevice(device)}
              className="w-full text-left rounded-xl bg-slate-900 border border-slate-800 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">
                    {device.terminal_id ||
                      device.atm_terminal_id ||
                      device.machine_name ||
                      device.device_name ||
                      device.name ||
                      'Unnamed Machine'}
                  </p>

                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {device.bank_name || device.client_name || 'Bank'} •{' '}
                    {device.branch_name || device.branch || device.site_name || 'Branch'}
                  </p>
                </div>

                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-orange-300">
                  {device.device_status || device.status || device.state || 'Active'}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
                <span>
                  Health:{' '}
                  <b className="text-slate-200">
                    {device.health_score !== null && device.health_score !== undefined
                      ? `${device.health_score}%`
                      : 'N/A'}
                  </b>
                </span>

                <span>
                  SLA:{' '}
                  <b className="text-slate-200">
                    {device.sla_status || 'Normal'}
                  </b>
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function DeviceDetailsModal({ device, onClose, onBack }) {
  return (
    <div
      className="fixed inset-0 z-[85] bg-slate-950 text-white overflow-y-auto overflow-x-hidden"
      style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
    >
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Machine Details</h2>
          <p className="text-xs text-slate-400">
            {device.terminal_id || device.atm_terminal_id || device.id}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-slate-800 p-2"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4 pb-28">
        <SectionCard title="Machine Identity">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Terminal ID" value={device.terminal_id || device.atm_terminal_id} />
            <Info label="Serial No." value={device.serial_number} />
            <Info label="Name" value={device.device_name || device.machine_name || device.name} />
            <Info label="Type" value={device.device_type || device.machine_type || device.category} />
            <Info label="Model" value={device.device_model || device.model} />
            <Info label="Firmware" value={device.firmware_version} />
          </div>
        </SectionCard>

        <SectionCard title="Bank & Location">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Bank" value={device.bank_name || device.client_name} />
            <Info label="Branch" value={device.branch_name || device.branch} />
            <Info label="Site" value={device.site_name} />
            <Info label="Location" value={device.location || device.branch_location} />
            <Info label="State" value={device.state} />
            <Info label="IP Address" value={device.ip_address} />
          </div>
        </SectionCard>

        <SectionCard title="Operational Status">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Device Status" value={device.device_status || device.status} />
            <Info label="SLA Status" value={device.sla_status} />
            <Info
              label="Health Score"
              value={
                device.health_score !== null && device.health_score !== undefined
                  ? `${device.health_score}%`
                  : 'N/A'
              }
            />
            <Info label="Assigned Engineer" value={device.assigned_engineer_name || device.assigned_engineer_email} />
          </div>
        </SectionCard>

        <SectionCard title="Maintenance">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Installed" value={device.installation_date} />
            <Info label="Warranty Expiry" value={device.warranty_expiry} />
            <Info label="Last PM" value={device.last_maintenance_date} />
            <Info label="Next PM" value={device.next_maintenance_date} />
          </div>
        </SectionCard>

        <SectionCard title="Notes">
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {device.notes || 'No note available.'}
          </p>
        </SectionCard>

        <button
          type="button"
          onClick={onBack || onClose}
          className="w-full rounded-xl bg-orange-500 py-3 font-semibold"
        >
          Back to List
        </button>
      </div>
    </div>
  );
}

function AssistantModal({ replies, message, setMessage, onSend, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950 text-white flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="text-orange-400" />
          <div>
            <h2 className="font-bold">ARK Assistant</h2>
            <p className="text-xs text-slate-400">ATM remote support assistant</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-slate-800 p-2">
          <X size={20} />
        </button>
      </div>

      <div className="bg-slate-900/50 border-b border-slate-800 p-3 grid grid-cols-2 gap-2">
        {['Cash jam', 'Card reader', 'Dispenser', 'Comms down'].map((item) => (
          <button key={item} type="button" onClick={() => setMessage(item)} className="rounded-xl bg-slate-800 border border-slate-700 p-2 text-xs">
            {item}
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        {replies.map((item, index) => (
          <div key={`${item.from}-${index}`} className={`max-w-[85%] rounded-2xl p-3 text-sm whitespace-pre-line ${item.from === 'user' ? 'ml-auto bg-orange-500 text-white' : 'mr-auto bg-slate-800 text-slate-200'}`}>
            {item.text}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
        <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSend()} placeholder="Describe ATM fault..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm" />
        <button type="button" onClick={onSend} className="bg-orange-500 rounded-xl px-4">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function getAssistantReply(message, tickets) {
  const lower = message.toLowerCase();

  if (lower.includes('cash') || lower.includes('jam')) {
    return `ATM cash jam support:
1. Confirm machine state and note error code.
2. Put ATM in supervisor/maintenance mode if available.
3. Check presenter, transport path and reject bin.
4. Remove jammed note carefully without forcing belts.
5. Inspect cassette seating and note quality.
6. Run dispense test.
7. If jam repeats, check pick module, sensors and transport belts.
8. Update ticket with findings before completion.`;
  }

  if (lower.includes('card')) {
    return `Card reader support:
1. Check if card is stuck or reader shutter is blocked.
2. Clean card reader path using approved cleaning card.
3. Check reader cable and USB/serial connection.
4. Restart ATM application service if required.
5. Test card insert/eject.
6. If card is retained repeatedly, check reader motor, sensor and shutter.
7. Request replacement card reader if fault persists.`;
  }

  if (lower.includes('dispenser')) {
    return `Dispenser support:
1. Check dispenser error code.
2. Confirm cassette lock, note level and cassette seating.
3. Inspect pick rollers and presenter path.
4. Check reject bin and purge notes.
5. Run dispenser test from supervisor mode.
6. If one cassette fails, swap/test cassette position.
7. If all cassettes fail, check dispenser controller/power/cable.`;
  }

  if (lower.includes('printer') || lower.includes('receipt')) {
    return `Receipt printer support:
1. Check paper roll direction and paper level.
2. Clear paper jam.
3. Clean printer sensor area.
4. Check printer cable and power.
5. Run receipt printer test.
6. If printing is faint, check thermal paper quality.
7. If no feed, inspect feed motor and sensor.`;
  }

  if (lower.includes('network') || lower.includes('comms') || lower.includes('communication')) {
    return `Communication down support:
1. Confirm router/modem power.
2. Check LAN cable from ATM to router/switch.
3. Verify link light on ATM LAN port.
4. Restart router if approved.
5. Check IP configuration if accessible.
6. Confirm site network availability with bank/contact.
7. Escalate to Operations/Helpdesk if network is external.`;
  }

  if (lower.includes('power')) {
    return `Power issue support:
1. Confirm site power source and UPS status.
2. Check ATM power cable and breaker.
3. Inspect PSU indicators if available.
4. Confirm monitor/PC/dispenser power separately.
5. Avoid bypassing safety protection.
6. If PSU is suspected, request replacement and escalate.`;
  }

  if (lower.includes('job') || lower.includes('ticket')) {
    return `You currently have ${tickets.length} active assigned job(s). Use Jobs for field actions and Tickets for fault details/work history.`;
  }

  return `I can help with ATM faults such as:
- Cash jam
- Card reader error
- Dispenser fault
- Receipt printer issue
- Communication down
- Power issue
- Supervisor mode error

Describe the fault or error code you are seeing on site.`;
}

function MiniTicketCard({ ticket, onClick }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-xl bg-slate-800 border border-slate-700 p-3">
      <p className="text-xs text-slate-500">{ticket.ticket_number || ticket.ticket_id || 'Ticket'}</p>
      <p className="font-medium text-sm mt-1">{ticket.title || ticket.category || 'Assigned Job'}</p>
      <p className="text-xs text-slate-400 mt-1">{ticket.bank_name || ticket.client_name || 'Bank'} • {ticket.branch_name || ticket.branch || 'Branch'}</p>
    </button>
  );
}

function TimelineItem({ icon, label, value }) {
  return (
    <div className="flex gap-3 border-l border-slate-700 pl-3 pb-3">
      <div className="text-orange-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-300">{value || 'Not set'}</p>
      </div>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-3">{value}</p>
    </div>
  );
}

function EmptyText({ text }) {
  return <p className="text-sm text-slate-500 py-3">{text}</p>;
}

function Info({ label, value }) {
  return (
    <p>
      <span className="text-slate-500">{label}:</span>{' '}
      <span className="text-slate-300">{value || 'Not set'}</span>
    </p>
  );
}

function ActionButton({ label, icon, onClick, primary, disabled }) {
  const [pressed, setPressed] = useState(false);

  const handleClick = async () => {
    if (disabled) return;

    setPressed(true);

    try {
      await onClick?.();
    } finally {
      setTimeout(() => setPressed(false), 650);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setTimeout(() => setPressed(false), 350)}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setTimeout(() => setPressed(false), 350)}
      onMouseLeave={() => setTimeout(() => setPressed(false), 350)}
      className={`rounded-xl py-3 text-sm flex items-center justify-center gap-2 border transition-all duration-200 active:scale-95 ${
        disabled
          ? 'bg-slate-700 border-slate-700 text-slate-400 opacity-60'
          : pressed
            ? 'bg-green-500 border-green-400 text-white shadow-lg shadow-green-500/30'
            : primary
              ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'bg-slate-800 border-slate-700 text-slate-200'
      }`}
    >
      {icon}
      {pressed ? 'Processing...' : label}
    </button>
  );
}

function BottomItem({ icon, label, active, onClick, badge = 0 }) {
  return (
    <button type="button" onClick={onClick} className={`relative flex flex-col items-center justify-center gap-1 text-[11px] ${active ? 'text-orange-400' : 'text-slate-400'}`}>
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-2 -right-3 bg-orange-500 text-white text-[9px] min-w-4 h-4 rounded-full flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}

function formatDate(value) {
  if (!value) return 'Not set';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}