import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

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
  X,
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

const SITE_COLORS = {
  active: { color: "#22c55e", label: "Active" },
  down: { color: "#ef4444", label: "Down" },
  maintenance: { color: "#f59e0b", label: "WIP" },
  offline: { color: "#64748b", label: "Offline" },
};

const ENG_COLORS = {
  online: "#22c55e",
  busy: "#f59e0b",
  on_site: "#f59e0b",
  traveling: "#3b82f6",
  offline: "#94a3b8",
};

function siteIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 2px ${color}55;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function engIcon(color, initials) {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${initials}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function LiveMapPanel({ compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const { data: engineers = [] } = useQuery({
    queryKey: ["engineer-status-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_statuses")
        .select("*")
        .order("last_active", { ascending: false })
        .limit(100);

      if (error) throw error;

      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      return data || [];
    },
    refetchInterval: 30000,
  });

  const validEng = engineers.filter(
    (e) =>
      e.current_latitude &&
      e.current_longitude &&
      e.status !== "offline"
  );

  const validSites = sites.filter(
    (s) => s.latitude && s.longitude
  );

  const onlineEng = engineers.filter(
    (e) => e.status !== "offline"
  ).length;

  const downSites = sites.filter(
    (s) => s.status === "down"
  ).length;

  const activeSites = sites.filter(
    (s) => s.status === "active"
  ).length;

  const wipSites = sites.filter(
    (s) => s.status === "maintenance"
  ).length;

  const center = [9.082, 8.675];

  const mapHeight = compact ? "h-[300px]" : "h-[380px]";

  const MapView = ({ zoom = 6 }) => (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {validSites.map((s) => {
        const cfg = SITE_COLORS[s.status] || SITE_COLORS.offline;

        return (
          <Marker
            key={s.id}
            position={[s.latitude, s.longitude]}
            icon={siteIcon(cfg.color)}
          >
            <Popup>
              <p className="font-bold text-sm">{s.name}</p>

              <p className="text-xs text-gray-500">
                {s.client_name}
              </p>

              <span
                className="text-xs font-medium"
                style={{ color: cfg.color }}
              >
                ● {cfg.label}
              </span>

              {s.assigned_engineer_name && (
                <p className="text-xs mt-1">
                  Engineer: {s.assigned_engineer_name}
                </p>
              )}
            </Popup>
          </Marker>
        );
      })}

      {validEng.map((eng) => {
        const color = ENG_COLORS[eng.status] || "#94a3b8";

        const initials = (eng.engineer_name || "E")
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        return (
          <Marker
            key={eng.id}
            position={[
              eng.current_latitude,
              eng.current_longitude,
            ]}
            icon={engIcon(color, initials)}
          >
            <Popup>
              <div className="min-w-[180px]">
                <p className="font-bold text-sm">
                  {eng.engineer_name}
                </p>

                <p
                  className="text-xs capitalize"
                  style={{ color }}
                >
                  ● {eng.status?.replace("_", " ")}
                </p>

                {eng.current_site_name && (
                  <p className="text-xs mt-1">
                    📍 {eng.current_site_name}
                  </p>
                )}

                {eng.current_ticket_id && (
                  <p className="text-xs">
                    🎫 {eng.current_ticket_id}
                  </p>
                )}

                {eng.location_label && (
                  <p className="text-xs text-gray-500">
                    {eng.location_label}
                  </p>
                )}

                {eng.last_active && (
                  <p className="text-xs text-gray-400">
                    Last:{" "}
                    {new Date(
                      eng.last_active
                    ).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" />
            Live Operations Map
          </CardTitle>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {onlineEng} Engineers
              </span>

              <span className="flex items-center gap-1 text-green-600">
                <MapPin className="w-3 h-3" />
                {activeSites} Active
              </span>

              {downSites > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <MapPin className="w-3 h-3" />
                  {downSites} Down
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(true)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMinimized(true)}
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
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
      </CardContent>
    </Card>
  );
}