"use client";

import React, { useState } from "react";
import { KioskTelemetry } from "@/app/api/telemetry/route";
import {
  Printer,
  Radio,
  Camera,
  Banknote,
  Cpu,
  HardDrive,
  Zap,
  Activity,
  RotateCw,
  Wrench,
  Wifi,
  Clock,
  X,
  Play,
  Layers,
  Thermometer,
  Lock,
  Flame,
  RadioTower
} from "lucide-react";
import { toast } from "sonner";

interface KioskDetailModalProps {
  kiosk: KioskTelemetry | null;
  onClose: () => void;
  onRefreshTelemetry: () => void;
}

export default function KioskDetailModal({ kiosk, onClose, onRefreshTelemetry }: KioskDetailModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!kiosk) return null;

  const handleExecuteAction = async (action: string, actionLabel: string) => {
    setLoadingAction(action);
    try {
      const res = await fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskId: kiosk.id, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(`${actionLabel}: ${data.message || "Command executed successfully!"}`);
      onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error executing command";
      toast.error(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const statusColor =
    kiosk.status === "ONLINE"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : kiosk.status === "WARNING"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : kiosk.status === "MAINTENANCE"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
      : "bg-rose-500/10 text-rose-400 border-rose-500/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-inner">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-white">{kiosk.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                  {kiosk.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ID: {kiosk.id} &bull; {kiosk.location} ({kiosk.barangay})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> System Uptime
              </span>
              <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                {Math.floor(kiosk.system.uptimeSeconds / 3600)}h {Math.floor((kiosk.system.uptimeSeconds % 3600) / 60)}m
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-blue-400" /> Ping & Connectivity
              </span>
              <span className="text-lg font-bold font-mono text-slate-200 mt-1 block">
                {kiosk.system.networkLatencyMs}ms <span className="text-xs text-slate-400 font-normal">({kiosk.system.networkType})</span>
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Today's Txns
              </span>
              <span className="text-lg font-bold font-mono text-white mt-1 block">
                {kiosk.transactionsToday} <span className="text-xs text-slate-400 font-normal">items</span>
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Revenue (PHP)
              </span>
              <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                ₱{kiosk.revenueToday.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Subsystems Hardware Telemetry Grid */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider font-mono flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" /> Hardware Health & Subsystem Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Thermal Printer */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-200">Thermal Receipt Printer</span>
                      <p className="text-xs text-slate-400 font-mono">Seiko POS-80 Heavy Duty Roll</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${kiosk.hardware.thermalPrinter.status === "OK" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                    {kiosk.hardware.thermalPrinter.status}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Paper Level</span>
                    <span className="font-bold text-slate-200">{kiosk.hardware.thermalPrinter.paperLevelPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${kiosk.hardware.thermalPrinter.paperLevelPercent < 20 ? "bg-rose-500" : kiosk.hardware.thermalPrinter.paperLevelPercent < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${kiosk.hardware.thermalPrinter.paperLevelPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span>Temp: {kiosk.hardware.thermalPrinter.temperatureC}°C</span>
                    <span>Printed: {kiosk.hardware.thermalPrinter.totalReceiptsPrinted} receipts</span>
                  </div>
                </div>
              </div>

              {/* RFID Diagnostics */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <RadioTower className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-200">RFID & NFC Reader Diagnostics</span>
                      <p className="text-xs text-slate-400 font-mono">Frequency: {kiosk.hardware.rfidReader.diagnostics.frequencyMhz} MHz</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400">
                    {kiosk.hardware.rfidReader.status}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-xs font-mono text-slate-400 border-t border-slate-800/60 pt-3">
                  <div className="flex justify-between">
                    <span>RF Power: <strong className="text-white">{kiosk.hardware.rfidReader.diagnostics.antennaPowerDbm} dBm</strong></span>
                    <span>Success Rate: <strong className="text-emerald-400">{kiosk.hardware.rfidReader.diagnostics.successRatePercent}%</strong></span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reads Today: <strong className="text-white">{kiosk.hardware.rfidReader.readsCountToday}</strong></span>
                    <span>Last UID: <strong className="text-blue-400">{kiosk.hardware.rfidReader.diagnostics.lastUidTapped || "N/A"}</strong></span>
                  </div>
                </div>
              </div>

              {/* Touchscreen Status */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-200">Touch Screen & Kiosk Lock</span>
                      <p className="text-xs text-slate-400 font-mono">{kiosk.hardware.touchScreen.screenResolution}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400">
                    {kiosk.hardware.touchScreen.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/60 pt-3">
                  <span>Touch Latency: <strong className="text-white">{kiosk.hardware.touchScreen.touchLatencyMs} ms</strong></span>
                  <span>Kiosk Lockdown: <strong className="text-emerald-400">{kiosk.hardware.touchScreen.kioskModeLocked ? "LOCKED" : "UNLOCKED"}</strong></span>
                </div>
              </div>

              {/* Cash Stacker */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-200">Bill Acceptor Stacker</span>
                      <p className="text-xs text-slate-400 font-mono">NV10 USB Stacker</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${kiosk.hardware.cashAcceptor.status === "ONLINE" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                    {kiosk.hardware.cashAcceptor.status}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Stacker Capacity</span>
                    <span className="font-bold text-slate-200">{kiosk.hardware.cashAcceptor.stackerCapacityPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${kiosk.hardware.cashAcceptor.stackerCapacityPercent > 90 ? "bg-rose-500" : kiosk.hardware.cashAcceptor.stackerCapacityPercent > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${kiosk.hardware.cashAcceptor.stackerCapacityPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Performance Gauges */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Computing System Metrics
            </h3>
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> CPU Load</span>
                    <span className="font-bold text-emerald-400">{kiosk.system.cpuUsagePercent}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${kiosk.system.cpuUsagePercent}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1"><HardDrive className="w-3.5 h-3.5 text-blue-400" /> RAM Memory</span>
                    <span className="font-bold text-blue-400">{kiosk.system.ramUsagePercent}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${kiosk.system.ramUsagePercent}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-amber-400" /> Core Temp</span>
                    <span className="font-bold text-amber-400">{kiosk.system.coreTemperatureC}°C</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(kiosk.system.coreTemperatureC / 90) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Municipal IT Admin Remote Operations */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider font-mono flex items-center gap-2">
              <Wrench className="w-4 h-4 text-purple-400" /> Municipal IT Administrator Remote Controls
            </h3>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center gap-3">
              <button
                disabled={loadingAction !== null}
                onClick={() => handleExecuteAction("RESTART", "Remote Restart")}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 text-emerald-400 ${loadingAction === "RESTART" ? "animate-spin" : ""}`} />
                Remote Restart
              </button>

              <button
                disabled={loadingAction !== null}
                onClick={() => handleExecuteAction("RFID_DIAGNOSTICS", "RFID Diagnostics")}
                className="px-4 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-xs font-semibold text-blue-300 border border-blue-500/30 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <RadioTower className="w-4 h-4 text-blue-400" />
                Run RFID Reader Sweep
              </button>

              <button
                disabled={loadingAction !== null}
                onClick={() => handleExecuteAction("FLUSH_PRINTER", "Printer Paper Reset")}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-purple-400" />
                Reset Paper Roll
              </button>

              <button
                disabled={loadingAction !== null}
                onClick={() => handleExecuteAction("EMPTY_CASH_STACKER", "Empty Stacker")}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Banknote className="w-4 h-4 text-emerald-400" />
                Empty Cash Stacker
              </button>

              <button
                disabled={loadingAction !== null}
                onClick={() => handleExecuteAction("TOGGLE_MAINTENANCE", "Toggle Maintenance")}
                className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 border border-amber-500/30 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                {kiosk.status === "MAINTENANCE" ? "Exit Maintenance" : "Enter Maintenance Mode"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-all"
          >
            Close Telemetry Window
          </button>
        </div>
      </div>
    </div>
  );
}
