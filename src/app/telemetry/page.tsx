"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import lguConfig from "@/lgu.config.json";
import {
  KioskTelemetry,
  QueueWindowInfo,
  ServiceDemandItem,
  BarangayDemandItem,
  AuditLogEntry
} from "@/app/api/telemetry/route";
import KioskFleetMap from "@/components/telemetry/KioskFleetMap";
import KioskDetailModal from "@/components/telemetry/KioskDetailModal";
import {
  Activity,
  Server,
  Printer,
  Radio,
  Banknote,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  MapPin,
  Clock,
  Zap,
  TrendingUp,
  Terminal,
  ChevronRight,
  Shield,
  Layers,
  ArrowLeft,
  Users,
  Building2,
  FileText,
  CreditCard,
  RadioTower,
  BarChart3,
  PieChart,
  HardDrive
} from "lucide-react";
import { toast } from "sonner";

export default function TelemetryDashboardPage() {
  const [telemetryData, setTelemetryData] = useState<{
    timestamp: string;
    summary: {
      totalKiosks: number;
      municipalCount: number;
      barangayCount: number;
      onlineCount: number;
      warningCount: number;
      offlineCount: number;
      maintenanceCount: number;
      fleetUptimePercent: number;
      totalTransactionsToday: number;
      totalRevenueToday: number;
      totalActiveSessions: number;
      avgCpuPercent: number;
      avgPingMs: number;
    };
    queueWindows: QueueWindowInfo[];
    serviceDemand: ServiceDemandItem[];
    barangayDemand: BarangayDemandItem[];
    peakHoursTraffic: { hour: string; ticketVolume: number; avgWaitMin: number }[];
    kiosks: KioskTelemetry[];
    auditLogs: AuditLogEntry[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(3);
  const [isPaused, setIsPaused] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<"ALL" | "MUNICIPAL_HALL" | "BARANGAY">("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [auditFilter, setAuditFilter] = useState<string>("ALL");

  const [selectedKiosk, setSelectedKiosk] = useState<KioskTelemetry | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch("/api/telemetry", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load kiosk telemetry");
      const data = await res.json();
      setTelemetryData(data);

      if (selectedKiosk) {
        const updated = data.kiosks.find((k: KioskTelemetry) => k.id === selectedKiosk.id);
        if (updated) setSelectedKiosk(updated);
      }
    } catch (err: unknown) {
      console.error("Telemetry error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedKiosk]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  useEffect(() => {
    if (isPaused || refreshIntervalSec === 0) return;
    const timer = setInterval(() => {
      fetchTelemetry();
    }, refreshIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [fetchTelemetry, refreshIntervalSec, isPaused]);

  const filteredKiosks = (telemetryData?.kiosks || []).filter((kiosk) => {
    const matchesSearch =
      kiosk.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kiosk.barangay.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kiosk.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kiosk.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatusFilter === "ALL" || kiosk.status === selectedStatusFilter;

    const matchesZone =
      selectedZoneFilter === "ALL" || kiosk.zone === selectedZoneFilter;

    return matchesSearch && matchesStatus && matchesZone;
  });

  const filteredAuditLogs = (telemetryData?.auditLogs || []).filter((log) => {
    if (auditFilter === "ALL") return true;
    return log.eventType === auditFilter;
  });

  const summary = telemetryData?.summary;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 pb-20">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all border border-slate-700/60 flex items-center gap-1.5 text-xs font-mono"
              title="Return to Kiosk Main Portal"
            >
              <ArrowLeft className="w-4 h-4" /> Kiosk Portal
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  {lguConfig.identity.lguName}
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    Super Admin Fleet Telemetry (18 Kiosks)
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Centralized Operations: 15 Barangay Kiosks + 3 Municipal Hall Main Units
              </p>
            </div>
          </div>

          {/* Controls & Streaming Interval */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
              <button
                onClick={() => setRefreshIntervalSec(3)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  refreshIntervalSec === 3 && !isPaused ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400"
                }`}
              >
                3s
              </button>
              <button
                onClick={() => setRefreshIntervalSec(5)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  refreshIntervalSec === 5 && !isPaused ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400"
                }`}
              >
                5s
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  isPaused ? "bg-amber-500/20 text-amber-400 font-bold" : "text-slate-400"
                }`}
              >
                {isPaused ? "Paused" : "Live Feed"}
              </button>
            </div>

            <button
              onClick={() => {
                fetchTelemetry();
                toast.info("Telemetry metrics updated!");
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700/60"
              title="Manual Telemetry Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-8">
        {/* KPI Top Cards Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>Fleet Health Uptime</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold font-mono text-emerald-400">
                {summary ? `${summary.fleetUptimePercent}%` : "--"}
              </span>
              <span className="text-[11px] text-slate-400 block font-mono mt-1">
                {summary?.onlineCount || 0} / {summary?.totalKiosks || 0} Online Kiosks
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>Total Txns Today</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold font-mono text-white">
                {summary ? summary.totalTransactionsToday : "--"}
              </span>
              <span className="text-[11px] text-slate-400 block font-mono mt-1">
                {summary?.totalActiveSessions || 0} Active Sessions Now
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>Revenue Collection</span>
              <Banknote className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold font-mono text-emerald-400 truncate block">
                ₱{summary ? summary.totalRevenueToday.toLocaleString() : "--"}
              </span>
              <span className="text-[11px] text-slate-400 block font-mono mt-1">
                Automated Cash Acceptors
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>Avg Latency & CPU</span>
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold font-mono text-blue-400">
                {summary ? `${summary.avgPingMs}ms` : "--"}
              </span>
              <span className="text-[11px] text-slate-400 block font-mono mt-1">
                Avg CPU: {summary?.avgCpuPercent}%
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>Kiosk Status Grid</span>
              <Server className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-300 font-bold">{summary?.onlineCount || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-300 font-bold">{summary?.warningCount || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-300 font-bold">{summary?.maintenanceCount || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-300 font-bold">{summary?.offlineCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* INDICATOR 1 & 2: QUEUE TRAFFIC & BARANGAY SERVICE DEMAND (Leadership View) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QUEUE TRAFFIC WIDGET */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800/90 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" /> Municipal Hall Queue Traffic
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Live ticket volumes, average wait per service window, and peak hours
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                Live Windows
              </span>
            </div>

            {/* Service Windows Table */}
            <div className="space-y-2.5 pt-1">
              {telemetryData?.queueWindows.map((win) => (
                <div key={win.windowId} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-bold text-slate-200 block">{win.windowName}</span>
                    <span className="text-[11px] text-slate-400">Completed today: {win.completedTodayCount} residents</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-bold text-indigo-400 text-sm block">{win.activeTicketsCount} in queue</span>
                      <span className="text-[11px] text-slate-400">~{win.avgWaitTimeMinutes}m wait</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${win.status === "OPEN" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                      {win.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Peak Service Hours Traffic Chart */}
            <div className="pt-2">
              <span className="text-xs font-mono text-slate-400 block mb-2">Peak Service Hours Traffic (Today's Ticket Volume):</span>
              <div className="flex items-end gap-2 h-24 pt-4 border-b border-slate-800 pb-2">
                {telemetryData?.peakHoursTraffic.map((pt, i) => {
                  const heightPercent = Math.min(100, Math.max(15, (pt.ticketVolume / 85) * 100));
                  const isPeak = pt.ticketVolume > 70;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full bg-slate-800 rounded-t group-hover:bg-indigo-500 transition-all relative" style={{ height: `${heightPercent}%` }}>
                        {isPeak && <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />}
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 group-hover:text-slate-200 transition-colors">{pt.hour.split(" ")[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BARANGAY SERVICE DEMAND WIDGET */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800/90 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" /> Barangay Service Demand & Popular Services
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Highest volume barangay kiosks and most requested municipal services
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Analytics
              </span>
            </div>

            {/* Top Requested Services breakdown */}
            <div className="space-y-3">
              <span className="text-xs font-mono text-slate-400">Most Requested Municipal Services Today:</span>
              {telemetryData?.serviceDemand.map((sd) => (
                <div key={sd.serviceId} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-200 font-medium">{sd.serviceName}</span>
                    <span className="text-emerald-400 font-bold">{sd.requestCountToday} req ({sd.percentOfTotal}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${sd.percentOfTotal}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Barangay Traffic Ranking */}
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-xs font-mono text-slate-400 block mb-2.5">Barangay Kiosk Demand Ranking:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {telemetryData?.barangayDemand.map((bd, idx) => (
                  <div key={bd.barangay} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px]">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-white">{bd.barangay}</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">{bd.totalRequestsToday} txns</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* INDICATOR 3: HARDWARE HEALTH & FLEET GEOGRAPHICAL MAP */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" /> Kiosk Fleet Geographic Map & Status
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Click any kiosk pin to open real-time diagnostic controls
              </p>
            </div>
          </div>
          <KioskFleetMap
            kiosks={telemetryData?.kiosks || []}
            selectedKioskId={selectedKiosk?.id || null}
            onSelectKiosk={(k) => setSelectedKiosk(k)}
          />
        </div>

        {/* INDICATOR 3 & 4: HARDWARE HEALTH GRID & REMOTE CONTROL TRIGGERS */}
        <div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400" /> Kiosk Hardware Health & Remote Admin Control
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Inspect thermal paper levels, screen status, network latency, and trigger IT Admin actions
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name/barangay/ID..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-sans"
                />
              </div>

              {/* Zone Filter (All 18 / Municipal Hall 3 / Barangays 15) */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-mono">
                <button
                  onClick={() => setSelectedZoneFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                    selectedZoneFilter === "ALL"
                      ? "bg-slate-800 text-emerald-400 font-bold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All (18)
                </button>
                <button
                  onClick={() => setSelectedZoneFilter("MUNICIPAL_HALL")}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                    selectedZoneFilter === "MUNICIPAL_HALL"
                      ? "bg-slate-800 text-indigo-400 font-bold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Municipal Hall (3)
                </button>
                <button
                  onClick={() => setSelectedZoneFilter("BARANGAY")}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                    selectedZoneFilter === "BARANGAY"
                      ? "bg-slate-800 text-emerald-400 font-bold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Barangays (15)
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-mono">
                {["ALL", "ONLINE", "WARNING", "MAINTENANCE", "OFFLINE"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg transition-all capitalize whitespace-nowrap ${
                      selectedStatusFilter === st
                        ? "bg-slate-800 text-emerald-400 font-bold shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kiosks Hardware Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredKiosks.map((kiosk) => {
              const isOnline = kiosk.status === "ONLINE";
              const isWarning = kiosk.status === "WARNING";
              const isMaint = kiosk.status === "MAINTENANCE";

              const badgeColor = isOnline
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : isWarning
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : isMaint
                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30";

              return (
                <div
                  key={kiosk.id}
                  onClick={() => setSelectedKiosk(kiosk)}
                  className="group relative p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 transition-all shadow-xl hover:shadow-2xl cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono text-slate-400 block">{kiosk.id} &bull; {kiosk.barangay}</span>
                        <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors mt-0.5">
                          {kiosk.name}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeColor}`}>
                        {kiosk.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {kiosk.location}
                    </p>
                  </div>

                  {/* Hardware Telemetry Snapshot */}
                  <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span className="flex items-center gap-1"><Printer className="w-3 h-3 text-purple-400" /> Paper</span>
                        <span className="font-bold text-slate-200">{kiosk.hardware.thermalPrinter.paperLevelPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${kiosk.hardware.thermalPrinter.paperLevelPercent < 20 ? "bg-rose-500" : "bg-purple-500"}`}
                          style={{ width: `${kiosk.hardware.thermalPrinter.paperLevelPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span className="flex items-center gap-1"><RadioTower className="w-3 h-3 text-blue-400" /> RFID</span>
                        <span className="font-bold text-emerald-400">{kiosk.hardware.rfidReader.status === "CONNECTED" ? "Optimal" : "Check"}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        Success: {kiosk.hardware.rfidReader.diagnostics.successRatePercent}%
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-emerald-400" /> Temp/CPU</span>
                        <span className="font-bold text-slate-200">{kiosk.system.coreTemperatureC}°C</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        CPU Load: {kiosk.system.cpuUsagePercent}%
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Network</span>
                        <span className="font-bold text-slate-200">{kiosk.system.networkLatencyMs}ms</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        Signal: {kiosk.system.networkSignalDbm} dBm
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 flex items-center justify-between text-xs font-mono text-slate-400 group-hover:text-emerald-400 transition-colors">
                    <span>Open Remote Diagnostics</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* INDICATOR 5: AUDIT ACTIVITY LOG CONSOLE */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" /> Comprehensive Kiosk Audit Trail & Activity Console
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Log of every ticket print, card tap, fee check, and administrative action with session token
              </p>
            </div>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-mono">
              {["ALL", "TICKET_PRINT", "CARD_TAP", "FEE_CHECK", "ADMIN_ACTION"].map((ef) => (
                <button
                  key={ef}
                  onClick={() => setAuditFilter(ef)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    auditFilter === ef ? "bg-slate-800 text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {ef.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/70 border border-slate-800/90 shadow-xl overflow-x-auto">
            <table className="w-full text-left font-mono text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Kiosk ID & Location</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Session Token</th>
                  <th className="py-2.5 px-3">Audit Details & Action</th>
                  <th className="py-2.5 px-3">User / Performer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-950/60 transition-colors">
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                      {log.kioskId} &bull; {log.kioskName}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.eventType === "ADMIN_ACTION"
                          ? "bg-purple-500/20 text-purple-400"
                          : log.eventType === "TICKET_PRINT"
                          ? "bg-indigo-500/20 text-indigo-400"
                          : log.eventType === "CARD_TAP"
                          ? "bg-blue-500/20 text-blue-400"
                          : log.eventType === "FEE_CHECK"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-rose-500/20 text-rose-400"
                      }`}>
                        {log.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-blue-400 text-[11px] font-mono whitespace-nowrap">
                      {log.sessionToken}
                    </td>
                    <td className="py-3 px-3 text-slate-200">
                      {log.details}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {log.performedBy || "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Interactive Detail & Diagnostics Drawer Modal */}
      <KioskDetailModal
        kiosk={selectedKiosk}
        onClose={() => setSelectedKiosk(null)}
        onRefreshTelemetry={fetchTelemetry}
      />
    </div>
  );
}
