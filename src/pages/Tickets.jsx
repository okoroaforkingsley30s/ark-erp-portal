import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

import TicketFilters from '@/components/tickets/TicketFilters';
import TicketCard from '@/components/tickets/TicketCard';
import CreateTicketDialog from '@/components/tickets/CreateTicketDialog';

export default function Tickets() {
  const { user } = useOutletContext();

  const role = user?.role || 'client';

  const [createOpen, setCreateOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all',
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', role, user?.email],

    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', {
          ascending: false,
        })
        .limit(200);

      if (role === 'client') {
        query = query.eq('client_email', user.email);
      }

      if (role === 'engineer') {
        query = query.eq('assigned_to', user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error('SUPABASE TICKETS ERROR:', error);
        throw error;
      }

      return data || [];
    },

    enabled: !!user?.email,
  });

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filters.status !== 'all' && t.status !== filters.status) {
        return false;
      }

      if (filters.priority !== 'all' && t.priority !== filters.priority) {
        return false;
      }

      if (filters.category !== 'all' && t.category !== filters.category) {
        return false;
      }

      if (filters.search) {
        const s = filters.search.toLowerCase();

        return (
          t.title?.toLowerCase().includes(s) ||
          t.ticket_id?.toLowerCase().includes(s) ||
          t.ticket_number?.toLowerCase().includes(s) ||
          t.description?.toLowerCase().includes(s) ||
          t.client_name?.toLowerCase().includes(s) ||
          t.client_email?.toLowerCase().includes(s) ||
          t.assigned_to_name?.toLowerCase().includes(s)
        );
      }

      return true;
    });
  }, [tickets, filters]);

  const title =
    role === 'engineer'
      ? 'My Jobs'
      : role === 'client'
        ? 'My Tickets'
        : role === 'helpdesk'
          ? 'Ticket Queue'
          : 'All Tickets';

  const canCreateTicket = [
    'client',
    'helpdesk',
    'admin',
    'ceo',
    'agm',
  ].includes(role);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {title}
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} ticket
            {filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {canCreateTicket && (
          <Button
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        )}
      </div>

      <TicketFilters
        filters={filters}
        onChange={setFilters}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
            />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">
                No tickets found
              </p>

              <p className="text-sm mt-1">
                Try adjusting your filters or create a new ticket
              </p>
            </div>
          )}
        </div>
      )}

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        user={user}
      />
    </div>
  );
}