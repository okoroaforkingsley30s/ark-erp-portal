import React from 'react';
import { useOutletContext } from 'react-router-dom';
import LiveMapPanel from '@/components/dashboard/LiveMapPanel';
import { Navigation } from 'lucide-react';

export default function LiveMap() {
  const { user } = useOutletContext();

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="w-6 h-6 text-primary" />
            Live Operations Map
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            Engineer movement, machine/site health, open tickets and field activity.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live Command Center
        </div>
      </div>

      <LiveMapPanel compact={false} currentUser={user} />
    </div>
  );
}
