"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ELGUResidentSmartCard from "@/components/shared/ELGUResidentSmartCard";
import lguConfig from "@/lgu.config.json";
import {
  CreditCard,
  Printer,
  Sparkles,
  Download,
  RotateCw,
  ShieldCheck,
  Cpu,
  Radio,
  QrCode,
  ArrowLeft,
  Sliders,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";

export default function ResidentCardStudioPage() {
  const [fullName, setFullName] = useState(lguConfig.defaults.residentCard.residentName);
  const [role, setRole] = useState(lguConfig.defaults.residentCard.residentRole);
  const [barangay, setBarangay] = useState(lguConfig.defaults.residentCard.barangayName);
  const [cityProvince, setCityProvince] = useState(
    `${lguConfig.identity.municipalityName}, ${lguConfig.identity.provinceName}`
  );
  const [joinDate, setJoinDate] = useState(lguConfig.defaults.residentCard.issueDate);
  const [expireDate, setExpireDate] = useState(lguConfig.defaults.residentCard.expiryDate);
  const [idNumber, setIdNumber] = useState(lguConfig.defaults.residentCard.idNumber);
  const [rfidUid, setRfidUid] = useState(lguConfig.defaults.residentCard.rfidUid);
  const [mayorName, setMayorName] = useState(lguConfig.identity.mayorName);
  const [mayorTitle, setMayorTitle] = useState(lguConfig.identity.mayorTitle);
  const [activeTab, setActiveTab] = useState<"interactive" | "renders">("interactive");
  const [cardFlipKey, setCardFlipKey] = useState(0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#060c18] text-white selection:bg-cyan-500 selection:text-black">
      {/* Background Tech Grids & Radial Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0038a80a_1px,transparent_1px),linear-gradient(to_bottom,#0038a80a_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Navigation Header */}
      <header className="relative z-20 border-b border-sky-500/20 bg-[#081225]/80 backdrop-blur-xl px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-sky-400 hover:bg-sky-500/10 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 text-sky-400" />
              <span>Back to Kiosk</span>
            </Link>
            <div className="h-6 w-[1px] bg-white/10" />
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-400">
                  Government Smart ID System
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                e-LGU Resident Smart Card <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono border border-sky-500/30">NextGen</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_25px_rgba(2,132,199,0.35)] transition hover:brightness-110 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Card (ISO CR80)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Tab Switcher: 3D Interactive vs High-Res 4K Renders */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex rounded-2xl border border-sky-500/20 bg-[#0a1833]/90 p-1.5 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveTab("interactive")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider transition ${
                activeTab === "interactive"
                  ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>Interactive 3D Card</span>
            </button>
            <button
              onClick={() => setActiveTab("renders")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider transition ${
                activeTab === "renders"
                  ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CreditCard className="w-4 h-4 text-amber-300" />
              <span>High-Res Concept Renders</span>
            </button>
          </div>
        </div>

        {/* ─── TAB 1: INTERACTIVE 3D CARD & LIVE STUDIO ─── */}
        {activeTab === "interactive" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Card Display Stage */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center p-8 rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0a1833]/80 to-[#071124]/90 shadow-2xl backdrop-blur-xl">
              <div className="w-full flex items-center justify-between mb-6 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live 3D Preview (Click Card to Flip)
                  </span>
                </div>
                <button
                  onClick={() => setCardFlipKey((k) => k + 1)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Flip Front / Back</span>
                </button>
              </div>

              {/* Card Container with Specular Sheen */}
              <div className="py-6 flex items-center justify-center print:py-0">
                <ELGUResidentSmartCard
                  key={cardFlipKey}
                  fullName={fullName}
                  role={role}
                  barangay={barangay}
                  cityProvince={cityProvince}
                  joinDate={joinDate}
                  expireDate={expireDate}
                  idNumber={idNumber}
                  rfidUid={rfidUid}
                  mayorName={mayorName}
                  mayorTitle={mayorTitle}
                  scale={1.05}
                />
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-400" /> EMV Microchip (Contact)
                </span>
                <span className="flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-cyan-400" /> RFID / NFC 13.56MHz
                </span>
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-sky-400" /> Cryptographic QR
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> ISO/IEC 7810 ID-1
                </span>
              </div>
            </div>

            {/* Customization & Specs Panel */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Card Customizer Form */}
              <div className="p-6 rounded-3xl border border-sky-500/20 bg-[#09152b]/80 shadow-xl backdrop-blur-xl">
                <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-white/10">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Customize Resident Metadata
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Resident Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Role / Status
                      </label>
                      <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Barangay
                      </label>
                      <input
                        type="text"
                        value={barangay}
                        onChange={(e) => setBarangay(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                      LGU City / Province
                    </label>
                    <input
                      type="text"
                      value={cityProvince}
                      onChange={(e) => setCityProvince(e.target.value)}
                      className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Issue Date
                      </label>
                      <input
                        type="text"
                        value={joinDate}
                        onChange={(e) => setJoinDate(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-mono text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Expire Date
                      </label>
                      <input
                        type="text"
                        value={expireDate}
                        onChange={(e) => setExpireDate(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-mono text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Resident ID Number
                      </label>
                      <input
                        type="text"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        RFID UID Number
                      </label>
                      <input
                        type="text"
                        value={rfidUid}
                        onChange={(e) => setRfidUid(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Mayor Name
                      </label>
                      <input
                        type="text"
                        value={mayorName}
                        onChange={(e) => setMayorName(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Mayor Title
                      </label>
                      <input
                        type="text"
                        value={mayorTitle}
                        onChange={(e) => setMayorTitle(e.target.value)}
                        className="w-full rounded-xl border border-sky-400/25 bg-black/40 px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Design Specifications & Innovation Highlights */}
              <div className="p-6 rounded-3xl border border-sky-500/20 bg-[#09152b]/80 shadow-xl backdrop-blur-xl">
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/10">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    e-LGU Tech Palette & Architecture
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-slate-300 font-semibold">Primary Gov Tech Blue</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sky-400">#0038A8 / #0B2545</span>
                      <span className="w-4 h-4 rounded-full bg-[#0038a8] border border-white/20" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-slate-300 font-semibold">Cyber Cyan Circuit Glow</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400">#00D2FF / #38BDF8</span>
                      <span className="w-4 h-4 rounded-full bg-[#00d2ff] border border-white/20" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-slate-300 font-semibold">Republic Gold Accent</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-400">#F59E0B / #D97706</span>
                      <span className="w-4 h-4 rounded-full bg-[#f59e0b] border border-white/20" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-slate-300 font-semibold">Security Standard</span>
                    <span className="font-mono text-emerald-400">ISO 7810 ID-1 • 85.6 × 53.98mm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: PHOTOREALISTIC CONCEPT RENDERS ─── */}
        {activeTab === "renders" && (
          <div className="space-y-10">
            {/* Front View Render */}
            <div className="p-8 rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0a1833]/90 to-[#071124]/90 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400">
                    Design Option 1 • Front Face Render
                  </span>
                  <h3 className="text-xl font-black tracking-tight text-white">
                    e-LGU Resident Smart Card — Front View
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Featuring holographic rainbow biometric window, 3D gold-rimmed e-LGU seal, and cybernetic circuit traces.
                  </p>
                </div>
                <a
                  href={lguConfig.assets.residentCardFront}
                  download="resident-card-front-placeholder.svg"
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-500/20 hover:text-white"
                >
                  <Download className="w-4 h-4" />
                  <span>Download High-Res</span>
                </a>
              </div>

              <div className="relative aspect-[16/9] w-full max-w-4xl mx-auto overflow-hidden rounded-2xl border border-sky-400/30 shadow-[0_15px_40px_rgba(0,56,168,0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lguConfig.assets.residentCardFront}
                  alt="Generic resident card placeholder front"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Back View Render */}
            <div className="p-8 rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0a1833]/90 to-[#071124]/90 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400">
                    Design Option 1 • Reverse Side Render
                  </span>
                  <h3 className="text-xl font-black tracking-tight text-white">
                    e-LGU Resident Smart Card — Reverse Side View
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Featuring high-coercivity magnetic stripe, frosted glassmorphic pill badge, digital mayor signature, and MRZ code.
                  </p>
                </div>
                <a
                  href={lguConfig.assets.residentCardBack}
                  download="resident-card-back-placeholder.svg"
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-500/20 hover:text-white"
                >
                  <Download className="w-4 h-4" />
                  <span>Download High-Res</span>
                </a>
              </div>

              <div className="relative aspect-[16/9] w-full max-w-4xl mx-auto overflow-hidden rounded-2xl border border-sky-400/30 shadow-[0_15px_40px_rgba(0,56,168,0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lguConfig.assets.residentCardBack}
                  alt="Generic resident card placeholder back"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Hidden Print Container for High-Resolution ISO 7810 Card Printing */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-8">
        <style jsx global>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            header,
            button,
            nav {
              display: none !important;
            }
            .print\\:block {
              display: block !important;
            }
          }
        `}</style>
        <div className="flex flex-col items-center gap-12 justify-center h-full">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest text-center">
              FRONT SIDE (ISO 7810 ID-1 • 85.60 × 53.98mm)
            </p>
            <ELGUResidentSmartCard
              fullName={fullName}
              role={role}
              barangay={barangay}
              cityProvince={cityProvince}
              joinDate={joinDate}
              expireDate={expireDate}
              idNumber={idNumber}
              rfidUid={rfidUid}
              interactive={false}
              initialSide="front"
              scale={1}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest text-center">
              BACK SIDE (ISO 7810 ID-1 • 85.60 × 53.98mm)
            </p>
            <ELGUResidentSmartCard
              fullName={fullName}
              role={role}
              barangay={barangay}
              cityProvince={cityProvince}
              joinDate={joinDate}
              expireDate={expireDate}
              idNumber={idNumber}
              rfidUid={rfidUid}
              mayorName={mayorName}
              mayorTitle={mayorTitle}
              interactive={false}
              initialSide="back"
              scale={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
