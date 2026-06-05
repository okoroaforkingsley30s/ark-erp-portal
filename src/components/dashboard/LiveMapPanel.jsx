import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

import {
  Navigation,
  MapPin,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  User,
  X,
  Truck,
  Radio,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const STATUS_CONFIG = {
  active: { label: "Active", color: "#22c55e", icon: "✓" },
  operational: { label: "Operational", color: "#22c55e", icon: "✓" },
  faulty: { label: "Faulty", color: "#ef4444", icon: "!" },
  down: { label: "Down", color: "#ef4444", icon: "!" },
  maintenance: { label: "Maintenance", color: "#f59e0b", icon: "⛏" },
  under_maintenance: { label: "Maintenance", color: "#f59e0b", icon: "⛏" },
  offline: { label: "Offline", color: "#64748b", icon: "×" },
  inactive: { label: "Inactive", color: "#64748b", icon: "×" },
  unknown: { label: "Unknown", color: "#94a3b8", icon: "?" },
};

const ENG_COLORS = {
  online: "#22c55e",
  available: "#22c55e",
  active: "#22c55e",
  busy: "#f59e0b",
  on_site: "#f59e0b",
  arrived_on_site: "#f59e0b",
  working: "#8b5cf6",
  in_progress: "#8b5cf6",
  traveling: "#3b82f6",
  in_transit: "#3b82f6",
  en_route: "#3b82f6",
  start_trip: "#3b82f6",
  offline: "#94a3b8",
};

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getEngineerStatus = (engineer) => {
  const raw =
    engineer.status ||
    engineer.current_status ||
    engineer.field_status ||
    engineer.availability_status ||
    engineer.ticket_status ||
    "";

  const s = normalize(raw);

  if (["online", "available", "active"].includes(s)) return "online";

  if (
    [
      "on_site",
      "arrived_on_site",
      "arrived",
      "working",
      "start_work",
      "in_progress",
      "at_site",
    ].includes(s)
  ) {
    return "on_site";
  }

  if (
    [
      "traveling",
      "in_transit",
      "start_trip",
      "en_route",
      "on_the_way",
      "on_route",
    ].includes(s)
  ) {
    return "traveling";
  }

  if (["busy", "assigned", "accepted"].includes(s)) return "busy";
  if (["offline", "inactive", "logged_out"].includes(s)) return "offline";

  return s || "offline";
};

const getEngineerName = (engineer) =>
  engineer.engineer_name ||
  engineer.full_name ||
  engineer.name ||
  engineer.staff_name ||
  engineer.email ||
  "Engineer";

const getEngineerEmail = (engineer) =>
  engineer.engineer_email ||
  engineer.email ||
  engineer.user_email ||
  engineer.staff_email ||
  "";

const engineerHasCoords = (engineer) =>
  (toNumber(engineer.current_latitude) ?? toNumber(engineer.latitude)) !== null &&
  (toNumber(engineer.current_longitude) ??
    toNumber(engineer.longitude) ??
    toNumber(engineer.lng)) !== null;

const getEngineerLat = (engineer) =>
  toNumber(engineer.current_latitude) ?? toNumber(engineer.latitude);

const getEngineerLng = (engineer) =>
  toNumber(engineer.current_longitude) ??
  toNumber(engineer.longitude) ??
  toNumber(engineer.lng);

const isEngineerActive = (engineer) => getEngineerStatus(engineer) !== "offline";
const isEngineerOnline = (engineer) => getEngineerStatus(engineer) === "online";
const isEngineerOnSite = (engineer) => getEngineerStatus(engineer) === "on_site";
const isEngineerTraveling = (engineer) =>
  getEngineerStatus(engineer) === "traveling";

const getDeviceStatus = (device) => {
  const raw =
    device.device_status ||
    device.status ||
    device.state ||
    device.operational_status ||
    "";

  const s = normalize(raw);

  if (["active", "operational", "working", "available", "online"].includes(s)) {
    return "active";
  }

  if (["faulty", "failed", "down", "out_of_service", "not_working"].includes(s)) {
    return "faulty";
  }

  if (
    [
      "maintenance",
      "under_maintenance",
      "repair",
      "in_repair",
      "wip",
      "pending_parts",
      "pending_bank",
    ].includes(s)
  ) {
    return "maintenance";
  }

  if (["offline", "inactive", "decommissioned"].includes(s)) {
    return "offline";
  }

  return "unknown";
};

const getDeviceLat = (device, branch) =>
  toNumber(device.latitude) ||
  toNumber(device.lat) ||
  toNumber(device.current_latitude) ||
  toNumber(branch?.latitude) ||
  toNumber(branch?.lat);

const getDeviceLng = (device, branch) =>
  toNumber(device.longitude) ||
  toNumber(device.lng) ||
  toNumber(device.long) ||
  toNumber(device.current_longitude) ||
  toNumber(branch?.longitude) ||
  toNumber(branch?.lng) ||
  toNumber(branch?.long);

const getBranchKey = (bank, branch) =>
  `${String(bank || "").trim().toLowerCase()}__${String(branch || "")
    .trim()
    .toLowerCase()}`;

const getTicketEngineerKey = (ticket) =>
  String(
    ticket.assigned_engineer_email ||
      ticket.engineer_email ||
      ticket.assigned_to_email ||
      ticket.assigned_engineer_id ||
      ticket.engineer_id ||
      ticket.staff_id ||
      ""
  ).toLowerCase();

const getEngineerMergeKeys = (engineer) =>
  [
    engineer.engineer_email,
    engineer.email,
    engineer.user_email,
    engineer.staff_email,
    engineer.id,
    engineer.engineer_id,
    engineer.staff_id,
    engineer.user_id,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

function siteIcon(color, count = 1) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        min-width:32px;
        height:32px;
        padding:0 6px;
        border-radius:999px;
        background:${color};
        border:3px solid white;
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:800;
        font-size:12px;
        box-shadow:0 6px 18px rgba(0,0,0,0.35), 0 0 0 5px ${color}33;
      ">
        ${count}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function engIcon(color, initials) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:34px;
        height:34px;
        border-radius:50%;
        background:${color};
        border:3px solid white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:bold;
        font-size:10px;
        color:white;
        box-shadow:0 6px 18px rgba(0,0,0,0.35);
      ">
        ${initials}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

async function fetchCurrentMapData() {
  const [
    engineerResult,
    engineerStatusResult,
    deviceResult,
    bankDeviceResult,
    branchResult,
    siteResult,
    ticketResult,
  ] = await Promise.all([
    supabase.from("engineers").select("*").limit(2000),

    supabase
      .from("engineer_statuses")
      .select("*")
      .order("last_active", { ascending: false })
      .limit(2000),

    supabase
      .from("devices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000),

    supabase
      .from("bank_devices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000),

    supabase.from("branches").select("*").limit(5000),

    supabase.from("sites").select("*").limit(5000),

    supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500),
  ]);

  if (engineerResult.error) throw engineerResult.error;
  if (engineerStatusResult.error) throw engineerStatusResult.error;
  if (deviceResult.error) throw deviceResult.error;
  if (bankDeviceResult.error) throw bankDeviceResult.error;
  if (branchResult.error) throw branchResult.error;
  if (siteResult.error) throw siteResult.error;
  if (ticketResult.error) throw ticketResult.error;

  return {
    engineers: engineerResult.data || [],
    engineerStatuses: engineerStatusResult.data || [],
    devices: [...(deviceResult.data || []), ...(bankDeviceResult.data || [])],
    branches: [...(branchResult.data || []), ...(siteResult.data || [])],
    tickets: ticketResult.data || [],
  };
}

export default function LiveMapPanel({ compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [filter, setFilter] = useState("all");
  const [detailPanel, setDetailPanel] = useState(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["live-operations-map-current"],
    queryFn: fetchCurrentMapData,
    refetchInterval: 15000,
  });

  const baseEngineers = data?.engineers || [];
  const engineerStatuses = data?.engineerStatuses || [];
  const devices = data?.devices || [];
  const branches = data?.branches || [];
  const tickets = data?.tickets || [];

  const engineers = useMemo(() => {
    const statusMap = new Map();

    engineerStatuses.forEach((status) => {
      getEngineerMergeKeys(status).forEach((key) => {
        if (key && !statusMap.has(key)) statusMap.set(key, status);
      });
    });

    return baseEngineers.map((engineer) => {
      const keys = getEngineerMergeKeys(engineer);
      const liveStatus = keys.map((key) => statusMap.get(key)).find(Boolean);

      const assignedTicket = tickets.find((ticket) => {
        const ticketKey = getTicketEngineerKey(ticket);
        return ticketKey && keys.includes(ticketKey);
      });

      const ticketStatus = assignedTicket?.status || assignedTicket?.completion_status;
      const mergedStatus =
        liveStatus?.status ||
        engineer.status ||
        engineer.current_status ||
        ticketStatus ||
        "offline";

      return {
        ...engineer,
        ...liveStatus,
        engineer_name:
          liveStatus?.engineer_name ||
          engineer.engineer_name ||
          engineer.full_name ||
          engineer.name ||
          engineer.staff_name,
        engineer_email:
          liveStatus?.engineer_email ||
          engineer.engineer_email ||
          engineer.email ||
          engineer.user_email ||
          engineer.staff_email,
        status: mergedStatus,
        current_ticket_id:
          liveStatus?.current_ticket_id ||
          engineer.current_ticket_id ||
          assignedTicket?.id,
        current_site_name:
          liveStatus?.current_site_name ||
          engineer.current_site_name ||
          assignedTicket?.branch_name ||
          assignedTicket?.branch ||
          assignedTicket?.device_location ||
          assignedTicket?.location,
        current_latitude:
          liveStatus?.current_latitude ??
          engineer.current_latitude ??
          engineer.latitude,
        current_longitude:
          liveStatus?.current_longitude ??
          engineer.current_longitude ??
          engineer.longitude ??
          engineer.lng,
        last_active:
          liveStatus?.last_active || engineer.last_active || engineer.updated_at,
      };
    });
  }, [baseEngineers, engineerStatuses, tickets]);

  const branchMap = useMemo(() => {
    const map = new Map();

    branches.forEach((branch) => {
      map.set(
        getBranchKey(
          branch.bank_name || branch.client_name,
          branch.branch_name || branch.name || branch.location
        ),
        branch
      );
    });

    return map;
  }, [branches]);

  const siteGroups = useMemo(() => {
    const map = new Map();

    devices.forEach((device) => {
      const bank = device.bank_name || device.client_name || "Unknown Bank";
      const branchName =
        device.branch_name ||
        device.branch ||
        device.location ||
        device.device_location ||
        "Unknown Branch";

      const key = getBranchKey(bank, branchName);
      const branch = branchMap.get(key);

      const lat = getDeviceLat(device, branch);
      const lng = getDeviceLng(device, branch);

      if (!lat || !lng) return;

      if (!map.has(key)) {
        map.set(key, {
          key,
          bank_name: bank,
          branch_name: branchName,
          region: branch?.region || device.region || "",
          latitude: lat,
          longitude: lng,
          devices: [],
          openTickets: 0,
        });
      }

      map.get(key).devices.push(device);
    });

    const openStatuses = [
      "new",
      "open",
      "assigned",
      "accepted",
      "traveling",
      "in_transit",
      "en_route",
      "arrived_on_site",
      "on_site",
      "in_progress",
      "working",
      "pending_review",
      "pending_parts",
      "pending_bank",
    ];

    tickets.forEach((ticket) => {
      const key = getBranchKey(
        ticket.bank_name || ticket.client_name,
        ticket.branch_name || ticket.branch || ticket.device_location || ticket.location
      );

      const site = map.get(key);
      if (!site) return;

      if (openStatuses.includes(normalize(ticket.status))) {
        site.openTickets += 1;
      }
    });

    return Array.from(map.values()).map((site) => {
      const counts = {
        active: 0,
        faulty: 0,
        maintenance: 0,
        offline: 0,
        unknown: 0,
      };

      site.devices.forEach((device) => {
        counts[getDeviceStatus(device)] += 1;
      });

      let status = "active";

      if (counts.faulty > 0) status = "faulty";
      else if (counts.maintenance > 0) status = "maintenance";
      else if (counts.active === 0 && (counts.offline > 0 || counts.unknown > 0)) {
        status = "offline";
      }

      return {
        ...site,
        status,
        counts,
        total: site.devices.length,
      };
    });
  }, [devices, branchMap, tickets]);

  const filteredSites = useMemo(() => {
    if (filter === "all") return siteGroups;
    return siteGroups.filter((site) => site.status === filter);
  }, [siteGroups, filter]);

  const mappedEngineers = useMemo(
    () =>
      engineers.filter(
        (engineer) => engineerHasCoords(engineer) && isEngineerActive(engineer)
      ),
    [engineers]
  );

  const engineerGroups = useMemo(() => {
    const active = engineers.filter(isEngineerActive);
    const online = engineers.filter(isEngineerOnline);
    const onSite = engineers.filter(isEngineerOnSite);
    const inTransit = engineers.filter(isEngineerTraveling);

    return {
      active,
      online,
      onSite,
      inTransit,
      mapped: mappedEngineers,
    };
  }, [engineers, mappedEngineers]);

  const activeSites = useMemo(
    () => siteGroups.filter((s) => s.status === "active"),
    [siteGroups]
  );

  const downSites = useMemo(
    () => siteGroups.filter((s) => s.status === "faulty"),
    [siteGroups]
  );

  const maintenanceSites = useMemo(
    () => siteGroups.filter((s) => s.status === "maintenance"),
    [siteGroups]
  );

  const stats = useMemo(() => {
    return {
      engineersActive: engineerGroups.active.length,
      engineersOnline: engineerGroups.online.length,
      engineersOnSite: engineerGroups.onSite.length,
      engineersInTransit: engineerGroups.inTransit.length,
      engineersMapped: mappedEngineers.length,
      activeSites: activeSites.length,
      faultySites: downSites.length,
      maintenanceSites: maintenanceSites.length,
      totalSites: siteGroups.length,
      totalDevices: devices.length,
    };
  }, [
    engineerGroups,
    mappedEngineers.length,
    activeSites.length,
    downSites.length,
    maintenanceSites.length,
    siteGroups.length,
    devices.length,
  ]);

  const center = [9.082, 8.675];
  const mapHeight = minimized ? "h-[120px]" : compact ? "h-[340px]" : "h-[460px]";

  const openDetailPanel = (type) => {
    setDetailPanel(type);
  };

  const MapView = ({ zoom = 6 }) => (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl
      scrollWheelZoom
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {filteredSites.map((site) => {
        const cfg = STATUS_CONFIG[site.status] || STATUS_CONFIG.unknown;

        return (
          <Marker
            key={site.key}
            position={[site.latitude, site.longitude]}
            icon={siteIcon(cfg.color, site.total)}
          >
            <Popup>
              <div className="min-w-[220px] space-y-2">
                <div>
                  <p className="font-bold text-sm">{site.branch_name}</p>
                  <p className="text-xs text-gray-500">{site.bank_name}</p>
                </div>

                <div className="text-xs">
                  <span style={{ color: cfg.color, fontWeight: 700 }}>
                    ● {cfg.label}
                  </span>
                  {site.region && (
                    <span className="text-gray-500"> · {site.region}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>
                    Devices: <b>{site.total}</b>
                  </div>
                  <div>
                    Open tickets: <b>{site.openTickets}</b>
                  </div>
                  <div>
                    Active: <b>{site.counts.active}</b>
                  </div>
                  <div>
                    Faulty: <b>{site.counts.faulty}</b>
                  </div>
                  <div>
                    Maintenance: <b>{site.counts.maintenance}</b>
                  </div>
                  <div>
                    Offline: <b>{site.counts.offline}</b>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  <Link
                    to={`/bank-devices?bank=${encodeURIComponent(
                      site.bank_name
                    )}&branch=${encodeURIComponent(site.branch_name)}`}
                    className="text-xs rounded-md bg-blue-600 px-2 py-1 text-white"
                  >
                    View devices
                  </Link>

                  <Link
                    to={`/tickets?bank=${encodeURIComponent(
                      site.bank_name
                    )}&branch=${encodeURIComponent(site.branch_name)}`}
                    className="text-xs rounded-md bg-slate-700 px-2 py-1 text-white"
                  >
                    View tickets
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {mappedEngineers.map((eng) => {
        const status = getEngineerStatus(eng);
        const color = ENG_COLORS[status] || "#94a3b8";

        const initials = getEngineerName(eng)
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        return (
          <Marker
            key={eng.id || getEngineerEmail(eng) || getEngineerName(eng)}
            position={[getEngineerLat(eng), getEngineerLng(eng)]}
            icon={engIcon(color, initials)}
          >
            <Popup>
              <div className="min-w-[190px] space-y-1">
                <p className="font-bold text-sm">{getEngineerName(eng)}</p>

                <p className="text-xs capitalize" style={{ color }}>
                  ● {status.replace("_", " ")}
                </p>

                {eng.current_site_name && (
                  <p className="text-xs">📍 {eng.current_site_name}</p>
                )}

                {eng.current_ticket_id && (
                  <Link
                    to={`/tickets/${eng.current_ticket_id}`}
                    className="text-xs text-blue-600 underline"
                  >
                    🎫 Open current ticket
                  </Link>
                )}

                {eng.location_label && (
                  <p className="text-xs text-gray-500">{eng.location_label}</p>
                )}

                {eng.last_active && (
                  <p className="text-xs text-gray-400">
                    Last active: {new Date(eng.last_active).toLocaleString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );

  const content = (
    <Card className="overflow-hidden border-white/10 bg-[#102969]/90 text-white shadow-2xl">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#ff5a00]" />
              Live Operations Map
            </CardTitle>
            <p className="text-xs text-slate-300 mt-1">
              Synced with engineers, devices, branches and open tickets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => refetch()}>
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1 ${
                  isFetching ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMinimized((v) => !v)}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
          <button
            type="button"
            onClick={() => openDetailPanel("online_engineers")}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:border-green-400 hover:bg-green-500/20 transition-all"
          >
            <Radio className="w-4 h-4 mb-1 text-green-400" />
            <p className="font-bold">{stats.engineersOnline}</p>
            <p className="text-slate-300">Online Engrs</p>
          </button>

          <button
            type="button"
            onClick={() => openDetailPanel("on_site")}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:border-amber-400 hover:bg-amber-500/20 transition-all"
          >
            <User className="w-4 h-4 mb-1 text-amber-400" />
            <p className="font-bold">{stats.engineersOnSite}</p>
            <p className="text-slate-300">On Site</p>
          </button>

          <button
            type="button"
            onClick={() => openDetailPanel("in_transit")}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:border-blue-400 hover:bg-blue-500/20 transition-all"
          >
            <Truck className="w-4 h-4 mb-1 text-blue-400" />
            <p className="font-bold">{stats.engineersInTransit}</p>
            <p className="text-slate-300">In Transit</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilter("active");
              openDetailPanel("active_sites");
            }}
            className={`rounded-xl border p-2 text-left transition-all ${
              filter === "active"
                ? "border-green-400 bg-green-500/20"
                : "border-white/10 bg-white/5 hover:border-green-400 hover:bg-green-500/20"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mb-1 text-green-400" />
            <p className="font-bold">{stats.activeSites}</p>
            <p className="text-slate-300">Active Sites</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilter("faulty");
              openDetailPanel("down_sites");
            }}
            className={`rounded-xl border p-2 text-left transition-all ${
              filter === "faulty"
                ? "border-red-400 bg-red-500/20"
                : "border-white/10 bg-white/5 hover:border-red-400 hover:bg-red-500/20"
            }`}
          >
            <AlertTriangle className="w-4 h-4 mb-1 text-red-400" />
            <p className="font-bold">{stats.faultySites}</p>
            <p className="text-slate-300">Down Sites</p>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl border p-2 text-left ${
              filter === "all"
                ? "border-[#ff5a00] bg-[#ff5a00]/20"
                : "border-white/10 bg-white/5"
            }`}
          >
            <MapPin className="w-4 h-4 mb-1 text-slate-300" />
            <p className="font-bold">{stats.totalSites}</p>
            <p className="text-slate-300">Sites</p>
          </button>

          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-xl border p-2 text-left ${
              filter === "active"
                ? "border-green-400 bg-green-500/20"
                : "border-white/10 bg-white/5"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mb-1 text-green-400" />
            <p className="font-bold">{stats.activeSites}</p>
            <p className="text-slate-300">Active</p>
          </button>

          <button
            type="button"
            onClick={() => setFilter("faulty")}
            className={`rounded-xl border p-2 text-left ${
              filter === "faulty"
                ? "border-red-400 bg-red-500/20"
                : "border-white/10 bg-white/5"
            }`}
          >
            <AlertTriangle className="w-4 h-4 mb-1 text-red-400" />
            <p className="font-bold">{stats.faultySites}</p>
            <p className="text-slate-300">Faulty</p>
          </button>

          <button
            type="button"
            onClick={() => setFilter("maintenance")}
            className={`rounded-xl border p-2 text-left ${
              filter === "maintenance"
                ? "border-amber-400 bg-amber-500/20"
                : "border-white/10 bg-white/5"
            }`}
          >
            <Wrench className="w-4 h-4 mb-1 text-amber-400" />
            <p className="font-bold">{stats.maintenanceSites}</p>
            <p className="text-slate-300">WIP</p>
          </button>

          <button
            type="button"
            onClick={() => openDetailPanel("active_engineers")}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:border-blue-400 hover:bg-blue-500/20 transition-all"
          >
            <User className="w-4 h-4 mb-1 text-blue-300" />
            <p className="font-bold">{stats.engineersActive}</p>
            <p className="text-slate-300">Engineers</p>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className={`${mapHeight} flex items-center justify-center bg-[#08153d]`}>
            <div className="w-8 h-8 border-4 border-[#ff5a00]/20 border-t-[#ff5a00] rounded-full animate-spin" />
          </div>
        ) : (
          <div
            className={mapHeight}
            style={{
              borderRadius: "0 0 0.75rem 0.75rem",
              overflow: "hidden",
              position: "relative",
              zIndex: 0,
            }}
          >
            <MapView zoom={compact ? 5 : 6} />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      {content}

      {expanded && (
        <div className="fixed inset-0 z-[9999] bg-black/80 p-4">
          <div className="h-full rounded-2xl overflow-hidden border border-white/10 bg-[#08153d]">
            <div className="flex items-center justify-between p-3 bg-[#102969] text-white border-b border-white/10">
              <div>
                <p className="font-bold">Live Operations Map</p>
                <p className="text-xs text-slate-300">
                  Fullscreen view · {stats.totalDevices} devices ·{" "}
                  {stats.engineersActive} active engineers · {stats.engineersMapped} mapped
                </p>
              </div>

              <Button variant="ghost" onClick={() => setExpanded(false)}>
                Close
              </Button>
            </div>

            <div className="h-[calc(100%-61px)]">
              <MapView zoom={6} />
            </div>
          </div>
        </div>
      )}

      {detailPanel && (
        <LiveMapDetailPanel
          type={detailPanel}
          onClose={() => setDetailPanel(null)}
          engineers={engineerGroups}
          activeSites={activeSites}
          downSites={downSites}
          maintenanceSites={maintenanceSites}
        />
      )}
    </>
  );
}

function LiveMapDetailPanel({
  type,
  onClose,
  engineers,
  activeSites,
  downSites,
  maintenanceSites,
}) {
  const config = {
    online_engineers: {
      title: "Online Engineers",
      empty: "No online engineers found.",
      kind: "engineer",
      rows: engineers.online,
    },
    active_engineers: {
      title: "Active Engineers",
      empty: "No active engineers found.",
      kind: "engineer",
      rows: engineers.active,
    },
    on_site: {
      title: "Engineers On Site",
      empty: "No engineers currently on site.",
      kind: "engineer",
      rows: engineers.onSite,
    },
    in_transit: {
      title: "Engineers In Transit",
      empty: "No engineers currently in transit.",
      kind: "engineer",
      rows: engineers.inTransit,
    },
    active_sites: {
      title: "Active Sites",
      empty: "No active sites found.",
      kind: "site",
      rows: activeSites,
    },
    down_sites: {
      title: "Down / Faulty Sites",
      empty: "No down sites found.",
      kind: "site",
      rows: downSites,
    },
    maintenance_sites: {
      title: "Maintenance Sites",
      empty: "No maintenance sites found.",
      kind: "site",
      rows: maintenanceSites,
    },
  }[type];

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#08153d] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#102969] p-4">
          <div>
            <p className="text-lg font-bold">{config.title}</p>
            <p className="text-xs text-slate-300">{config.rows.length} record(s)</p>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-3 space-y-2">
          {config.rows.length === 0 ? (
            <p className="text-sm text-slate-300 p-4">{config.empty}</p>
          ) : config.kind === "engineer" ? (
            config.rows.map((engineer) => (
              <EngineerListItem
                key={engineer.id || getEngineerEmail(engineer) || getEngineerName(engineer)}
                engineer={engineer}
              />
            ))
          ) : (
            config.rows.map((site) => <SiteListItem key={site.key} site={site} />)
          )}
        </div>
      </div>
    </div>
  );
}

function EngineerListItem({ engineer }) {
  const status = getEngineerStatus(engineer);
  const color = ENG_COLORS[status] || "#94a3b8";
  const email = getEngineerEmail(engineer);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{getEngineerName(engineer)}</p>
          <p className="text-xs text-slate-300">{email || "No email"}</p>
          <p className="text-xs capitalize mt-1" style={{ color }}>
            ● {status.replace("_", " ")}
          </p>
        </div>

        <div className="text-right text-xs text-slate-300">
          {engineerHasCoords(engineer) ? "Mapped" : "No GPS"}
          {engineer.last_active && <p>{new Date(engineer.last_active).toLocaleString()}</p>}
        </div>
      </div>

      <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs text-slate-300">
        <p>Site: {engineer.current_site_name || engineer.location_label || "Not set"}</p>
        <p>Ticket: {engineer.current_ticket_id || "Not set"}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {engineer.current_ticket_id && (
          <Link
            to={`/tickets/${engineer.current_ticket_id}`}
            className="rounded-lg bg-[#ff5a00] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Open ticket
          </Link>
        )}

        {email && (
          <Link
            to={`/engineers-ops?search=${encodeURIComponent(email)}`}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
          >
            View engineer
          </Link>
        )}
      </div>
    </div>
  );
}

function SiteListItem({ site }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{site.branch_name}</p>
          <p className="text-xs text-slate-300">{site.bank_name}</p>
          {site.region && <p className="text-xs text-slate-400">{site.region}</p>}
        </div>

        <div className="text-right text-xs text-slate-300">
          <p>{site.total} device(s)</p>
          <p>{site.openTickets} open ticket(s)</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg bg-green-500/15 p-2">
          <p className="font-bold text-green-300">{site.counts.active}</p>
          <p className="text-slate-300">Active</p>
        </div>

        <div className="rounded-lg bg-red-500/15 p-2">
          <p className="font-bold text-red-300">{site.counts.faulty}</p>
          <p className="text-slate-300">Faulty</p>
        </div>

        <div className="rounded-lg bg-amber-500/15 p-2">
          <p className="font-bold text-amber-300">{site.counts.maintenance}</p>
          <p className="text-slate-300">WIP</p>
        </div>

        <div className="rounded-lg bg-slate-500/15 p-2">
          <p className="font-bold text-slate-300">{site.counts.offline}</p>
          <p className="text-slate-300">Offline</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/bank-devices?bank=${encodeURIComponent(
            site.bank_name
          )}&branch=${encodeURIComponent(site.branch_name)}`}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          View devices
        </Link>

        <Link
          to={`/tickets?bank=${encodeURIComponent(
            site.bank_name
          )}&branch=${encodeURIComponent(site.branch_name)}`}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        >
          View tickets
        </Link>
      </div>
    </div>
  );
}