import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation } from "lucide-react";

const statusConfig = {
  online: { label: "Online", dot: "bg-green-500", text: "text-green-600", pulse: true },
  offline: { label: "Offline", dot: "bg-red-400", text: "text-red-600", pulse: false },
  busy: { label: "Busy", dot: "bg-amber-400", text: "text-amber-600", pulse: false },
  on_site: { label: "On Site", dot: "bg-blue-500", text: "text-blue-600", pulse: true },
  traveling: { label: "Traveling", dot: "bg-purple-400", text: "text-purple-600", pulse: true },
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live Engineer Activity
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {merged.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No engineers registered
          </p>
        )}

        {merged.map((eng) => {
          const sc = statusConfig[eng.status || "offline"] || statusConfig.offline;

          return (
            <div key={eng.email || eng.id} className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                {eng.profile_photo ? (
                  <img
                    src={eng.profile_photo}
                    className="w-9 h-9 rounded-full object-cover"
                    alt={eng.full_name || eng.email}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {(eng.full_name || eng.email || "E")?.[0]}
                    </span>
                  </div>
                )}

                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${sc.dot} ${
                    sc.pulse ? "animate-pulse" : ""
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  {eng.full_name || eng.email}
                </p>

                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {eng.current_site_name ? (
                    <>
                      <Navigation className="w-2.5 h-2.5" />
                      <span className="truncate">{eng.current_site_name}</span>
                    </>
                  ) : eng.location_label ? (
                    <>
                      <MapPin className="w-2.5 h-2.5" />
                      <span className="truncate">{eng.location_label}</span>
                    </>
                  ) : (
                    <span>No location</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                <span className={`text-[10px] font-medium ${sc.text}`}>
                  {sc.label}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}