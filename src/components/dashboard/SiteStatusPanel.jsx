import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Radio } from "lucide-react";

const siteStatusConfig = {
  active: {
    label: "Active",
    dot: "bg-green-500",
    light: "bg-green-50 text-green-700 border-green-200",
    pulse: true,
  },
  down: {
    label: "Down",
    dot: "bg-red-500",
    light: "bg-red-50 text-red-700 border-red-200",
    pulse: false,
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-amber-400",
    light: "bg-amber-50 text-amber-700 border-amber-200",
    pulse: false,
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-400",
    light: "bg-slate-50 text-slate-500 border-slate-200",
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          Site Health Monitor
          <span className="ml-auto text-xs text-muted-foreground font-normal">
            {sites.length} sites
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-green-50 border border-green-200 p-2">
            <p className="text-lg font-bold text-green-700">
              {activeSites.length}
            </p>
            <p className="text-[10px] text-green-600">Active</p>
          </div>

          <div className="rounded-lg bg-red-50 border border-red-200 p-2">
            <p className="text-lg font-bold text-red-700">
              {downSites.length}
            </p>
            <p className="text-[10px] text-red-600">Down</p>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
            <p className="text-lg font-bold text-amber-700">
              {maintSites.length}
            </p>
            <p className="text-[10px] text-amber-600">Maint.</p>
          </div>
        </div>

        {downSites.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Down Sites
            </p>

            {downSites.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-200"
              >
                <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.name}</p>
                  <p className="text-[10px] text-red-600 truncate">
                    {s.client_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {sites.slice(0, 10).map((s) => {
            const sc = siteStatusConfig[s.status] || siteStatusConfig.offline;

            return (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot} ${
                    sc.pulse ? "animate-pulse" : ""
                  }`}
                />

                <span className="text-xs flex-1 truncate">{s.name}</span>

                <Badge
                  variant="outline"
                  className={`${sc.light} text-[9px] px-1.5 py-0`}
                >
                  {sc.label}
                </Badge>
              </div>
            );
          })}

          {sites.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No sites configured
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}