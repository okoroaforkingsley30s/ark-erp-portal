import React from 'react';
import { useOutletContext } from 'react-router-dom';
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
} from 'lucide-react';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const typeIcons = {
  ticket_created: Ticket,
  ticket_assigned: Wrench,
  ticket_updated: Settings,
  ticket_resolved: CheckCircle2,
  ticket_closed: CheckCircle2,
  workflow: ClipboardList,
  system: Bell,
  escalation: AlertTriangle,
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

export default function Notifications() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => fetchNotifications(user.email),
    enabled: !!user?.email,
  });

  const handleMarkRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      alert(`Failed to mark notification as read: ${error.message}`);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
          <h1 className="text-2xl font-bold">
            Notifications
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount} unread
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
          >
            <BellOff className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">
              No notifications yet
            </p>
          </div>
        )}

        {notifications.map((n) => {
          const Icon = typeIcons[n.type] || Bell;

          return (
            <Card
              key={n.id}
              className={cn(
                'p-4 transition-all cursor-pointer hover:shadow-sm',
                !n.read && 'border-l-4 border-l-primary bg-primary/[0.02]'
              )}
              onClick={() => !n.read && handleMarkRead(n.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    !n.read ? 'bg-primary/10' : 'bg-muted'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      !n.read ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm',
                      !n.read && 'font-semibold'
                    )}
                  >
                    {n.title}
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {n.message}
                  </p>

                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {n.created_at
                      ? format(new Date(n.created_at), 'MMM d, yyyy h:mm a')
                      : ''}
                  </p>
                </div>

                {!n.read && (
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