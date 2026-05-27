import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import LiveMapPanel from '@/components/dashboard/LiveMapPanel';

import { Card, CardContent } from '@/components/ui/card';

import {
  Navigation,
  Users,
  MapPin,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

async function fetchEngineerStatuses() {
  const { data, error } = await supabase
    .from('engineer_statuses')
    .select('*')
    .order('last_active', { ascending: false })
    .limit(100);

  if (error) throw error;

  return data || [];
}

async function fetchSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return data || [];
}

export default function LiveMap() {
  const { user } = useOutletContext();

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineer-status-live'],
    queryFn: fetchEngineerStatuses,
    refetchInterval: 10000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites-live'],
    queryFn: fetchSites,
    refetchInterval: 15000,
  });

  const onlineEngineers = engineers.filter(
    (e) => e.status !== 'offline'
  );

  const onSiteEngineers = engineers.filter(
    (e) => e.status === 'on_site'
  );

  const travelingEngineers = engineers.filter(
    (e) => e.status === 'traveling'
  );

  const activeSites = sites.filter(
    (s) => s.status === 'active'
  );

  const downSites = sites.filter(
    (s) => s.status === 'down'
  );

  const wip = sites.filter(
    (s) => s.status === 'maintenance'
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="w-6 h-6 text-primary" />
            Live Operations Map
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time engineer positions, site health and field activity
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live — auto-refreshing every 15s
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            label: 'Online Engineers',
            value: onlineEngineers.length,
            icon: Users,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: 'On Site',
            value: onSiteEngineers.length,
            icon: MapPin,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'In Transit',
            value: travelingEngineers.length,
            icon: Navigation,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Active Sites',
            value: activeSites.length,
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: 'Down Sites',
            value: downSites.length,
            icon: AlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}
              >
                <Icon className={`w-4 h-4 ${color}`} />
              </div>

              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">
                  {label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Map */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ height: 'clamp(300px, 55vh, 700px)' }}
      >
        <LiveMapPanel compact={false} />
      </div>

      {/* Engineer List */}
      {onlineEngineers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">
            Active Engineers ({onlineEngineers.length})
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlineEngineers.map((eng) => {
              const statusColors = {
                online: 'bg-green-500',
                busy: 'bg-amber-500',
                on_site: 'bg-amber-500',
                traveling: 'bg-blue-500',
              };

              const color =
                statusColors[eng.status] || 'bg-slate-400';

              return (
                <Card key={eng.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(eng.engineer_name || 'E')
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {eng.engineer_name || 'Unknown'}
                      </p>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-2 h-2 rounded-full ${color}`}
                        />

                        <span className="text-xs text-muted-foreground capitalize">
                          {eng.status?.replace('_', ' ')}
                        </span>

                        {eng.current_site_name && (
                          <span className="text-xs text-muted-foreground">
                            · {eng.current_site_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {eng.current_ticket_id && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                        #
                        {String(eng.current_ticket_id).slice(-6)}
                      </span>
                    )}
                  </div>

                  {eng.current_latitude &&
                    eng.current_longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${eng.current_latitude},${eng.current_longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <MapPin className="w-3 h-3" />
                        {eng.current_latitude.toFixed(4)},
                        {' '}
                        {eng.current_longitude.toFixed(4)}
                        {' '}
                        — View on Google Maps
                      </a>
                    )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}