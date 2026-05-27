import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Radio } from "lucide-react";

const siteStatusConfig = {
  active: {
    label: "Active",
    dot: "bg-emerald-400",
    badge: "success",
    pulse: true,
  },
  down: {
    label: "Down",
    dot: "bg-red-400",
    badge: "destructive",
    pulse: true,
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-amber-400",
    badge: "warning",
    pulse: false,
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-400",
    badge: "secondary",
    pulse: false,
  },
};

export default function SiteStatusPanel() {
  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const downSites = sites.filter((s) => s.status === "down");
  const activeSites = sites.filter((s) => s.status === "active");
  const maintSites = sites.filter((s) => s.status === "maintenance");

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
          Live operational status across monitored sites · {sites.length} sites
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/20 p-3">
            <p className="text-2xl font-black text-emerald-300">
              {activeSites.length}
            </p>
            <p className="text-[10px] text-emerald-200 uppercase tracking-widest">
              Active
            </p>
          </div>

          <div className="rounded-2xl bg-red-500/10 border border-red-400/20 p-3">
            <p className="text-2xl font-black text-red-300">
              {downSites.length}
            </p>
            <p className="text-[10px] text-red-200 uppercase tracking-widest">
              Down
            </p>
          </div>

          <div className="rounded-2xl bg-amber-500/10 border border-amber-400/20 p-3">
            <p className="text-2xl font-black text-amber-300">
              {maintSites.length}
            </p>
            <p className="text-[10px] text-amber-200 uppercase tracking-widest">
              Maint.
            </p>
          </div>
        </div>

        {downSites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-red-300 flex items-center gap-2 uppercase tracking-widest">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Down Sites
            </p>

            {downSites.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 bg-red-500/10 rounded-2xl border border-red-400/20"
              >
                <MapPin className="w-4 h-4 text-red-300 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {s.name}
                  </p>
                  <p className="text-xs text-red-200 truncate">
                    {s.client_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {sites.slice(0, 10).map((s) => {
            const sc = siteStatusConfig[s.status] || siteStatusConfig.offline;

            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#0b1f5e]/70 px-3 py-2"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot} ${
                    sc.pulse ? "animate-pulse" : ""
                  }`}
                />

                <span className="text-sm text-slate-100 flex-1 truncate">
                  {s.name}
                </span>

                <Badge variant={sc.badge}>
                  {sc.label}
                </Badge>
              </div>
            );
          })}

          {sites.length === 0 && (
            <p className="text-sm text-slate-300 text-center py-4">
              No sites configured
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}