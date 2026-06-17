import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { normalizeRole, isExecutiveRole } from "@/lib/roleAccess";
import { toast } from "sonner";

const pageBg = "min-h-screen bg-gradient-to-br from-[#06102f] via-[#08153d] to-[#102969] p-4 md:p-6 space-y-6 text-white";
const cardClass = "bg-[#102969]/85 border border-white/10 text-white shadow-xl rounded-2xl";
const inputClass = "bg-[#08153d]/80 border-white/10 text-white placeholder:text-blue-100/60 focus-visible:ring-[#ff5a00]";

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function eventText(event) {
  return [
    event.title,
    event.description,
    event.message,
    event.event_type,
    event.source_module,
    event.module,
    event.department,
    event.entity_type,
    JSON.stringify(event.metadata || {}),
  ]
    .filter(Boolean)
    .join(" ");
}

function eventModule(event) {
  return normalize(event.source_module || event.module || event.department || event.event_type || "general");
}

function canSeeEvent(role, event) {
  const r = normalizeRole(role);
  const module = eventModule(event);
  const type = normalize(event.event_type);
  const text = normalize(eventText(event));

  if (["admin", "ceo", "agm", "manager"].includes(r) || isExecutiveRole(r)) return true;

  if (["operations", "helpdesk"].includes(r)) {
    return module.includes("operation") || module.includes("helpdesk") || type.includes("ticket") || type.includes("part_request") || text.includes("operations");
  }

  if (r === "inventory") {
    return module.includes("inventory") || text.includes("inventory") || type.includes("inventory") || type.includes("stock") || type.includes("dispatch");
  }

  if (["repair_head", "repair_technician"].includes(r)) {
    return module.includes("repair") || module.includes("rr") || text.includes("repair") || text.includes("rr") || type.includes("rr_");
  }

  if (r === "finance") {
    return module.includes("finance") || module.includes("account") || text.includes("finance") || text.includes("fund") || text.includes("payment") || text.includes("lpo");
  }

  if (r === "procurement") {
    return module.includes("procurement") || text.includes("procurement") || text.includes("vendor") || text.includes("lpo");
  }

  if (r === "hr") {
    return module.includes("hr") || text.includes("hr") || text.includes("employee") || text.includes("staff");
  }

  if (r === "crm") {
    return module.includes("crm") || text.includes("crm") || text.includes("client") || text.includes("bank");
  }

  return false;
}

function severityClass(severity) {
  const level = normalize(severity);
  if (level.includes("error") || level.includes("critical")) return "border-red-400/30 bg-red-500/10 text-red-200";
  if (level.includes("warning")) return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  if (level.includes("success")) return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  return "border-blue-400/20 bg-blue-500/10 text-blue-100";
}

export default function OperationsFeed() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || null;
  const role = user?.role || user?.user_role || user?.position || "";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("operations_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Operations feed fetch failed:", error);
      toast.error("Failed to load Operations Feed");
      setEvents([]);
    } else {
      setEvents(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel("operations-feed-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operations_events" },
        () => fetchEvents()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const visibleEvents = useMemo(() => {
    const q = normalize(search);
    return events
      .filter((event) => canSeeEvent(role, event))
      .filter((event) => !q || normalize(eventText(event)).includes(q));
  }, [events, role, search]);

  const counts = {
    all: visibleEvents.length,
    warning: visibleEvents.filter((e) => normalize(e.severity).includes("warning")).length,
    critical: visibleEvents.filter((e) => normalize(e.severity).includes("critical") || normalize(e.severity).includes("error")).length,
  };

  return (
    <div className={pageBg}>
      <div className="rounded-3xl border border-white/10 bg-[#102969]/80 p-5 md:p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#ff5a00]/15 border border-[#ff5a00]/30 p-3 shadow-lg">
              <Activity className="h-8 w-8 text-[#ff5a00]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-orange-300 font-semibold">
                ARK ONE ERP / OIN
              </p>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                Operations Feed
              </h1>
              <p className="text-sm text-blue-100 mt-1 max-w-3xl">
                Live audit trail for workflow actions. Events are filtered by your role so users only see relevant operational history.
              </p>
            </div>
          </div>

          <Button onClick={fetchEvents} disabled={loading} className="bg-[#ff5a00] hover:bg-[#e24f00] text-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cardClass}><CardContent className="p-4"><p className="text-xs text-blue-100">Visible Events</p><h2 className="text-3xl font-black text-white">{counts.all}</h2></CardContent></Card>
        <Card className={cardClass}><CardContent className="p-4"><p className="text-xs text-blue-100">Warnings</p><h2 className="text-3xl font-black text-orange-300">{counts.warning}</h2></CardContent></Card>
        <Card className={cardClass}><CardContent className="p-4"><p className="text-xs text-blue-100">Critical</p><h2 className="text-3xl font-black text-red-300">{counts.critical}</h2></CardContent></Card>
      </div>

      <Card className={cardClass}>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-blue-100/60" />
            <Input className={`pl-9 ${inputClass}`} placeholder="Search module, ticket, part, user, action..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="border-b border-white/10 bg-[#08153d]/70">
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#ff5a00]" />
            Role-filtered OIN Events
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <p className="text-blue-100">Loading events...</p>
          ) : visibleEvents.length === 0 ? (
            <div className="rounded-xl border border-orange-400/20 bg-orange-500/10 p-4 text-orange-100 flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>No events found for your role/search yet. If this remains empty, confirm that pages are writing to operations_events.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleEvents.map((event) => (
                <div key={event.id || `${event.event_type}-${event.created_at}`} className={`rounded-xl border p-4 ${severityClass(event.severity)}`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-80">
                        {event.source_module || event.module || event.department || "ARK ONE"} · {event.event_type || "EVENT"}
                      </p>
                      <h3 className="text-white font-bold mt-1">{event.title || event.message || "Operations Event"}</h3>
                      <p className="text-sm mt-1 opacity-90">{event.description || event.message || "No description captured."}</p>
                    </div>
                    <p className="text-xs opacity-80 whitespace-nowrap">
                      {event.created_at ? new Date(event.created_at).toLocaleString() : "No time"}
                    </p>
                  </div>

                  {event.metadata && Object.keys(event.metadata || {}).length > 0 && (
                    <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/20 p-3 text-xs text-blue-100 whitespace-pre-wrap">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
