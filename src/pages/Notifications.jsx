import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  Bell,
  BellOff,
  Ticket,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Settings,
  UserPlus,
  Mail,
  MessageCircle,
  Cpu,
  DollarSign,
} from 'lucide-react';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { resolveNotificationTarget } from '@/lib/notificationRouting';
import MobileNotificationPreferences from '@/components/mobile/MobileNotificationPreferences';

const typeIcons = {
  ticket_created: Ticket,
  ticket_assigned: Wrench,
  ticket_updated: Settings,
  ticket_resolved: CheckCircle2,
  ticket_closed: CheckCircle2,

  workflow: ClipboardList,
  workflow_notification: ClipboardList,

  operations_feed: ClipboardList,
  log_mention: MessageCircle,
  log_action: ClipboardList,
  mention: MessageCircle,

  system: Bell,
  system_alert: AlertTriangle,

  escalation: AlertTriangle,

  user_approval: UserPlus,
  user_registration: UserPlus,

  leave_approved: CheckCircle2,
  loan_approved: CheckCircle2,
  fund_request: DollarSign,
  fund_request_approval: DollarSign,
  dispatch_fund: DollarSign,

  purchase_approved: ClipboardList,
  purchase_order: ClipboardList,
  procurement: ClipboardList,

  asset_assigned: Cpu,

  finance: DollarSign,

  mail: Mail,
  official_mail: Mail,

  ark_connect: MessageCircle,
  ark_connect_dm: MessageCircle,
  ark_connect_channel: MessageCircle,
};

async function fetchNotifications(userEmail) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return data || [];
}

function getNotificationData(notification) {
  if (!notification) return {};

  if (notification.data && typeof notification.data === 'object') {
    return notification.data;
  }

  if (notification.metadata && typeof notification.metadata === 'object') {
    return notification.metadata;
  }

  return {};
}

export default function Notifications() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => fetchNotifications(user.email),
    enabled: !!user?.email,
  });

  const markNotificationRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      alert(`Failed to mark notification as read: ${error.message}`);
      return false;
    }

    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    return true;
  };

  const getNotificationTarget = (notification) => {
    if (!notification) return '/notifications';

    const data = getNotificationData(notification);

    const directTarget =
      notification.target_url ||
      notification.action_url ||
      notification.link ||
      data.target_url ||
      data.action_url ||
      data.link;

    if (directTarget) return directTarget;

    if (
      notification.type === 'user_approval' ||
      notification.type === 'user_registration'
    ) {
      return '/users';
    }

    if (
      notification.type === 'ticket_created' ||
      notification.type === 'ticket_assigned' ||
      notification.type === 'ticket_updated' ||
      notification.type === 'ticket_resolved' ||
      notification.type === 'ticket_closed'
    ) {
      const ticketId =
        notification.ticket_id ||
        notification.related_ticket_id ||
        data.ticket_id ||
        data.related_ticket_id;

      return ticketId ? `/tickets/${ticketId}` : '/tickets';
    }

    if (
      notification.type === 'operations_feed' ||
      notification.type === 'log_mention' ||
      notification.type === 'log_action' ||
      notification.type === 'mention'
    ) {
      const logId =
        notification.log_id ||
        notification.operation_event_id ||
        data.log_id ||
        data.operation_event_id ||
        data.event_id;

      return logId
        ? `/operations-feed?event=${logId}`
        : '/operations-feed';
    }

    if (
      notification.type === 'fund_request' ||
      notification.type === 'fund_request_approval' ||
      notification.type === 'dispatch_fund'
    ) {
      const requestId =
        notification.fund_request_id ||
        data.fund_request_id ||
        data.request_id;

      return requestId
        ? `/fund-requests?id=${requestId}`
        : '/fund-requests';
    }

    if (
      notification.type === 'ark_connect' ||
      notification.type === 'ark_connect_dm' ||
      notification.type === 'ark_connect_channel'
    ) {
      return '/ark-connect';
    }

    if (
      notification.type === 'mail' ||
      notification.type === 'official_mail'
    ) {
      return '/official-mail';
    }

    if (
      notification.type === 'workflow' ||
      notification.type === 'workflow_notification'
    ) {
      return '/workflows';
    }

    if (
      notification.type === 'leave_approved' ||
      notification.type === 'loan_approved' ||
      notification.type === 'hr'
    ) {
      return '/hr';
    }

    if (
      notification.type === 'purchase_approved' ||
      notification.type === 'purchase_order' ||
      notification.type === 'procurement'
    ) {
      const poId =
        notification.purchase_order_id ||
        notification.po_id ||
        data.purchase_order_id ||
        data.po_id ||
        data.request_id;

      return poId
        ? `/procurement-lpo?id=${poId}`
        : '/procurement-lpo';
    }

    if (notification.type === 'asset_assigned') {
      return '/assets';
    }

    if (notification.type === 'finance') {
      return '/finance';
    }

    return '/notifications';
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;

    if (!notification.read) {
      const ok = await markNotificationRead(notification.id);
      if (!ok) return;
    }

    navigate(resolveNotificationTarget(user, getNotificationTarget(notification)));
  };

  const handleMarkAllRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_email', user.email)
      .eq('read', false);

    if (error) {
      console.error('Failed to mark all notifications as read:', error);
      alert(`Failed to mark all notifications as read: ${error.message}`);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount} unread
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <BellOff className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <MobileNotificationPreferences />

      <div className="space-y-2">
        {notifications.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No notifications yet</p>
          </div>
        )}

        {notifications.map((n) => {
          const Icon = typeIcons[n.type] || Bell;
          const isUnread = !n.read;

          return (
            <Card
              key={n.id}
              className={cn(
                'p-4 transition-all cursor-pointer hover:shadow-sm hover:border-primary/50',
                isUnread && 'border-l-4 border-l-primary bg-primary/[0.02]'
              )}
              onClick={() => handleNotificationClick(n)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    isUnread ? 'bg-primary/10' : 'bg-muted'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isUnread ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', isUnread && 'font-semibold')}>
                    {n.title}
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {n.message || n.message_body}
                  </p>

                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {n.created_at
                      ? format(new Date(n.created_at), 'MMM d, yyyy h:mm a')
                      : ''}
                  </p>
                </div>

                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
