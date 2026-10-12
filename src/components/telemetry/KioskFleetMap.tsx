"use client";

import React, { useEffect, useState } from "react";
import { KioskTelemetry } from "@/app/api/telemetry/route";
import lguConfig from "@/lgu.config.json";

interface KioskFleetMapProps {
  kiosks: KioskTelemetry[];
  selectedKioskId: string | null;
  onSelectKiosk: (kiosk: KioskTelemetry) => void;
}

export default function KioskFleetMap({ kiosks, selectedKioskId, onSelectKiosk }: KioskFleetMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-80 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Loading Kiosk Telemetry Fleet Map...</span>
      </div>
    );
  }

  // Dynamic Leaflet map client component wrapper
  return <LeafletMapContainer kiosks={kiosks} selectedKioskId={selectedKioskId} onSelectKiosk={onSelectKiosk} />;
}

function LeafletMapContainer({ kiosks, selectedKioskId, onSelectKiosk }: KioskFleetMapProps) {
  useEffect(() => {
    // Dynamic load leaflet CSS
    const linkId = "leaflet-css-cdn";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  const [LInstance, setLInstance] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    import("leaflet").then((L) => {
      setLInstance(L.default || L);
    });
  }, []);

  useEffect(() => {
    if (!LInstance) return;

    const mapElement = document.getElementById("kiosk-telemetry-map");
    if (!mapElement) return;

    // Check if map already initialized on window
    const win = window as unknown as { _kioskMapInstance?: import("leaflet").Map };
    if (win._kioskMapInstance) {
      win._kioskMapInstance.remove();
    }

    const centerLat = kiosks.length > 0 ? kiosks[0].coordinates.lat : 14.5995;
    const centerLng = kiosks.length > 0 ? kiosks[0].coordinates.lng : 120.9842;

    const map = LInstance.map("kiosk-telemetry-map", {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: true
    });

    win._kioskMapInstance = map;

    // Dark sleek map tiles
    LInstance.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> & &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    // Render kiosks pins with pulse animation
    kiosks.forEach((kiosk) => {
      const color =
        kiosk.status === "ONLINE"
          ? "#10b981"
          : kiosk.status === "WARNING"
          ? "#f59e0b"
          : kiosk.status === "MAINTENANCE"
          ? "#3b82f6"
          : "#ef4444";

      const pulseClass = kiosk.status === "ONLINE" ? "pulse-emerald" : kiosk.status === "WARNING" ? "pulse-amber" : "";

      const customIcon = LInstance.divIcon({
        className: "custom-kiosk-marker-wrapper",
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            background: #0f172a;
            border: 2px solid ${color};
            border-radius: 50%;
            box-shadow: 0 0 16px ${color}88;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <div class="${pulseClass}" style="
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: ${color};
            "></div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const marker = LInstance.marker([kiosk.coordinates.lat, kiosk.coordinates.lng], { icon: customIcon }).addTo(map);

      const popupContent = document.createElement("div");
      popupContent.className = "p-2 min-w-[200px] font-sans text-slate-900";
      popupContent.innerHTML = `
        <div style="font-weight:700; font-size:13px; margin-bottom:2px; color:#0f172a;">${kiosk.name}</div>
        <div style="font-size:11px; color:#64748b; margin-bottom:6px;">${kiosk.location}</div>
        <div style="display:flex; justify-between; font-size:11px; gap:8px;">
          <span>Status: <strong style="color:${color}">${kiosk.status}</strong></span>
          <span>Paper: <strong>${kiosk.hardware.thermalPrinter.paperLevelPercent}%</strong></span>
        </div>
        <div style="margin-top:6px; text-align:right;">
          <button id="map-btn-${kiosk.id}" style="
            background: #0f172a;
            color: #fff;
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            border: none;
          ">View Telemetry</button>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on("click", () => {
        onSelectKiosk(kiosk);
      });

      // Attach click listener for inside popup button
      map.on("popupopen", (e) => {
        const btn = document.getElementById(`map-btn-${kiosk.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectKiosk(kiosk);
          };
        }
      });
    });

    return () => {
      if (win._kioskMapInstance) {
        win._kioskMapInstance.remove();
        delete win._kioskMapInstance;
      }
    };
  }, [LInstance, kiosks, onSelectKiosk]);

  return (
    <div className="relative w-full h-80 rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
      <div id="kiosk-telemetry-map" className="w-full h-full" />
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-2 rounded-xl shadow-lg z-[1000] text-xs font-mono flex items-center gap-3">
        <span className="text-slate-300 font-semibold">{lguConfig.identity.lguName} Fleet</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Online</span>
          <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Warning</span>
          <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Offline</span>
        </div>
      </div>
    </div>
  );
}
