import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, UserCheck } from "lucide-react";

const statusConfig = {
  online: {
    label: "Online",
    dot: "bg-emerald-400",
    badge: "success",
    pulse: true,
  },
  offline: {
    label: "Offline",
    dot: "bg-red-400",
    badge: "destructive",
    pulse: false,
  },
  busy: {
    label: "Busy",
    dot: "bg-amber-400",
    badge: "warning",
    pulse: false,
  },
  on_site: {
    label: "On Site",
    dot: "bg-cyan-400",
    badge: "info",
    pulse: true,
  },
  traveling: {
    label: "Traveling",
    dot: "bg-purple-400",
    badge: "secondary",
    pulse: true,
  },
};

export default function EngineerActivityFeed() {
  const { data: engineers = [] } = useQuery({
    queryKey: ["users-engineers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("role", "engineer")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ["engineer-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_statuses")
        .select("*")
        .order("updated_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const merged = engineers.map((eng) => ({
    ...eng,
    ...(statuses.find((s) => s.engineer_email === eng.email) || {}),
  }));

  return (
    <Card className="border-white/10 bg-[#102969]/90">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-emerald-300" />
          </span>
          Live Engineer Activity
        </CardTitle>

        <CardDescription>
          Real-time status and field location visibility.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {merged.length === 0 && (
          <p className="text-sm text-slate-300 text-center py-4">
            No engineers registered
          </p>
        )}

        {merged.map((eng) => {
          const sc =
            statusConfig[eng.status || "offline"] ||
            statusConfig.offline;

          return (
            <div
              key={eng.email || eng.id}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#0b1f5e]/70 p-3 hover:border-[#ff5a00]/20 hover:bg-[#0b1f5e] transition-all"
            >
              <div className="relative flex-shrink-0">
                {eng.profile_photo ? (
                  <img
                    src={eng.profile_photo}
                    className="w-11 h-11 rounded-2xl object-cover border border-white/10"
                    alt={eng.full_name || eng.email}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/20 flex items-center justify-center">
                    <span className="text-sm font-black text-[#ff5a00]">
                      {(eng.full_name || eng.email || "E")?.[0]}
                    </span>
                  </div>
                )}

                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#102969] ${sc.dot} ${
                    sc.pulse ? "animate-pulse" : ""
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {eng.full_name || eng.email}
                </p>

                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  {eng.current_site_name ? (
                    <>
                      <Navigation className="w-3 h-3 text-[#ff5a00]" />
                      <span className="truncate">
                        {eng.current_site_name}
                      </span>
                    </>
                  ) : eng.location_label ? (
                    <>
                      <MapPin className="w-3 h-3 text-[#ff5a00]" />
                      <span className="truncate">
                        {eng.location_label}
                      </span>
                    </>
                  ) : (
                    <span>No location</span>
                  )}
                </div>
              </div>

              <Badge variant={sc.badge}>
                {sc.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}