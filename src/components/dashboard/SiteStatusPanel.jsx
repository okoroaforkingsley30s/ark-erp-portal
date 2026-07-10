import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Radio } from 'lucide-react';
import {
  buildSiteHealthSites,
  getSiteHealthLabel,
  getSiteHealthStyle,
  summarizeSiteHealth,
} from '@/lib/siteHealth';

async function fetchOptionalTable(table, options = {}) {
  let query = supabase.from(table).select('*');

  if (options.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  }

  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error(`Dashboard Site Health ${table} query failed:`, error);
    return { rows: [], warning: table };
  }

  return { rows: data || [], warning: null };
}

async function fetchSiteHealthPanelData() {
  const [devices, bankDevices, branches, sites, tickets] = await Promise.all([
    fetchOptionalTable('devices', { orderBy: 'created_at', limit: 3000 }),
    fetchOptionalTable('bank_devices', { orderBy: 'created_at', limit: 3000 }),
    fetchOptionalTable('branches', { limit: 3000 }),
    fetchOptionalTable('sites', { limit: 3000 }),
    fetchOptionalTable('tickets', { orderBy: 'updated_at', limit: 1000 }),
  ]);

  if (devices.warning && bankDevices.warning) {
    throw new Error('Site Health device sources could not be loaded.');
  }

  return {
    devices: [...devices.rows, ...bankDevices.rows],
    branches: branches.rows,
    sites: sites.rows,
    tickets: tickets.rows,
    warnings: [devices, bankDevices, branches, sites, tickets].map((result) => result.warning).filter(Boolean),
  };
}

export default function SiteStatusPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-site-health'],
    queryFn: fetchSiteHealthPanelData,
    refetchInterval: 30000,
  });

  const siteRows = useMemo(
    () =>
      buildSiteHealthSites({
        devices: data?.devices || [],
        branches: data?.branches || [],
        sites: data?.sites || [],
        tickets: data?.tickets || [],
      }),
    [data]
  );

  const summary = useMemo(() => summarizeSiteHealth(siteRows), [siteRows]);
  const warningSites = siteRows.filter((site) => ['warning', 'critical', 'offline'].includes(site.health));

  return (
    <Card className="border-white/10 bg-[#102969]/90">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 flex items-center justify-center">
            <Radio className="w-4 h-4 text-[#ff5a00]" />
          </span>
          Site Health Monitor
        </CardTitle>

        <CardDescription>
          Live operational status across monitored sites · {summary.total} sites
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-7 h-7 border-4 border-[#ff5a00]/20 border-t-[#ff5a00] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            Some Site Health data could not be loaded.
          </p>
        ) : (
          <>
            {data?.warnings?.length > 0 && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                Some Site Health data could not be loaded.
              </p>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { key: 'healthy', label: 'Healthy' },
                { key: 'critical', label: 'Critical' },
                { key: 'maintenance', label: 'Maint.' },
              ].map(({ key, label }) => {
                const style = getSiteHealthStyle(key);

                return (
                  <div key={key} className={`rounded-2xl border p-3 ${style.badge}`}>
                    <p className="text-2xl font-black">{summary[key]}</p>
                    <p className="text-[10px] uppercase tracking-widest">{label}</p>
                  </div>
                );
              })}
            </div>

            {warningSites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-red-300 flex items-center gap-2 uppercase tracking-widest">
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  Attention Needed
                </p>

                {warningSites.slice(0, 5).map((site) => {
                  const style = getSiteHealthStyle(site.health);

                  return (
                    <div
                      key={site.key}
                      className="flex items-center gap-3 p-3 bg-red-500/10 rounded-2xl border border-red-400/20"
                    >
                      <MapPin className="w-4 h-4 text-red-300 flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{site.branch_name}</p>
                        <p className="text-xs text-red-200 truncate">{site.bank_name}</p>
                      </div>

                      <Badge variant="outline" className={style.badge}>
                        {getSiteHealthLabel(site.health)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {siteRows.slice(0, 10).map((site) => {
                const style = getSiteHealthStyle(site.health);

                return (
                  <div
                    key={site.key}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#0b1f5e]/70 px-3 py-2"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />

                    <span className="text-sm text-slate-100 flex-1 truncate">{site.branch_name}</span>

                    <Badge variant="outline" className={style.badge}>
                      {getSiteHealthLabel(site.health)}
                    </Badge>
                  </div>
                );
              })}

              {siteRows.length === 0 && (
                <p className="text-sm text-slate-300 text-center py-4">No sites configured</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
