"use client";

import React, { useState, useRef, useId } from "react";
import Image from "next/image";
import lguConfig from "@/lgu.config.json";

export interface ResidentSmartCardProps {
  fullName?: string;
  role?: string;
  barangay?: string;
  cityProvince?: string;
  joinDate?: string;
  expireDate?: string;
  idNumber?: string;
  rfidUid?: string;
  photoUrl?: string | null;
  mayorName?: string;
  mayorTitle?: string;
  interactive?: boolean;
  initialSide?: "front" | "back";
  scale?: number;
  className?: string;
}

export default function ELGUResidentSmartCard({
  fullName = lguConfig.defaults.residentCard.residentName,
  role = lguConfig.defaults.residentCard.residentRole,
  barangay = lguConfig.defaults.residentCard.barangayName,
  cityProvince = `${lguConfig.identity.municipalityName}, ${lguConfig.identity.provinceName}`,
  joinDate = lguConfig.defaults.residentCard.issueDate,
  expireDate = lguConfig.defaults.residentCard.expiryDate,
  idNumber = lguConfig.defaults.residentCard.idNumber,
  rfidUid = lguConfig.defaults.residentCard.rfidUid,
  photoUrl = null,
  mayorName = lguConfig.identity.mayorName,
  mayorTitle = lguConfig.identity.mayorTitle,
  interactive = true,
  initialSide = "front",
  scale = 1,
  className = "",
}: ResidentSmartCardProps) {
  const [side, setSide] = useState<"front" | "back">(initialSide);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const filterId = `guilloche-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // 3D Parallax & Holographic Sheen on Mouse Movement
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -12;
    const rY = ((x - centerX) / centerX) * 12;

    setRotateX(rX);
    setRotateY(rY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.25,
    });
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  const toggleSide = () => {
    if (!interactive) return;
    setSide((prev) => (prev === "front" ? "back" : "front"));
  };

  // Standard ISO/IEC 7810 ID-1 card dimensions ratio: 85.6mm / 53.98mm = 1.586
  // Native width: 500px, height: 315px
  return (
    <div
      className={`relative inline-block select-none perspective-[1200px] ${className}`}
      style={{
        width: 500 * scale,
        height: 315 * scale,
      }}
    >
      <div
        ref={cardRef}
        onClick={toggleSide}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative w-[500px] h-[315px] origin-top-left transition-transform duration-500 ease-out cursor-pointer ${
          side === "back" ? "[transform:rotateY(180deg)]" : ""
        }`}
        style={{
          transform: `scale(${scale}) rotateX(${rotateX}deg) rotateY(${
            (side === "back" ? 180 : 0) + rotateY
          }deg)`,
          transformStyle: "preserve-3d",
        }}
        title="Click to flip card"
      >
        {/* ======================================================== */}
        {/* ─────────── CARD FRONT (ISO 7810 ID-1 Standard) ────────── */}
        {/* ======================================================== */}
        <div
          className="absolute inset-0 w-full h-full rounded-[22px] overflow-hidden bg-slate-50 text-slate-800 shadow-[0_20px_50px_rgba(0,56,168,0.28),0_4px_15px_rgba(0,0,0,0.12)] border border-white/60 backface-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Base High-Tech Background & Gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#f0f4f9] to-[#e2e8f0]" />

          {/* Top-Right & Upper Cybernetic Tech Wave (Gov Blue) */}
          <div className="absolute -top-12 -right-8 w-80 h-72 rounded-full bg-gradient-to-br from-[#0038a8] via-[#0b2545] to-[#041226] opacity-95 [clip-path:polygon(0_0,100%_0,100%_100%,35%_90%,10%_45%)]" />

          {/* Cyan Glow Circuit Wave Contour */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 500 315"
            fill="none"
          >
            {/* Guilloche Anti-Counterfeit Curves */}
            <g opacity="0.12" stroke="#0038a8" strokeWidth="0.75">
              <path d="M 0,160 C 120,110 220,240 340,180 C 420,140 480,220 500,190" />
              <path d="M 0,170 C 130,120 230,250 350,190 C 430,150 490,230 500,200" />
              <path d="M 0,180 C 140,130 240,260 360,200 C 440,160 500,240 500,210" />
              <circle cx="280" cy="180" r="65" stroke="#0038a8" strokeDasharray="3 3" />
              <circle cx="280" cy="180" r="95" stroke="#d97706" />
            </g>

            {/* Glowing Cybernetic Circuit Traces (Cyan & Gold) */}
            <path
              d="M 120 40 L 260 40 L 285 65 L 360 65"
              stroke="#00d2ff"
              strokeWidth="2"
              strokeLinecap="round"
              filter="drop-shadow(0 0 4px #00d2ff)"
              opacity="0.85"
            />
            <circle cx="360" cy="65" r="3" fill="#00d2ff" />
            <path
              d="M 120 25 L 290 25 L 320 55"
              stroke="#00a3ff"
              strokeWidth="1.5"
              opacity="0.6"
            />
            <circle cx="120" cy="40" r="2.5" fill="#f59e0b" />

            <path
              d="M 180 195 L 240 195 L 265 210 L 330 210"
              stroke="#38bdf8"
              strokeWidth="1.5"
              opacity="0.5"
            />
            <circle cx="330" cy="210" r="2.5" fill="#38bdf8" />
            <path
              d="M 180 210 L 230 210 L 245 225 L 310 225"
              stroke="#0284c7"
              strokeWidth="1.2"
              opacity="0.4"
            />
            <circle cx="310" cy="225" r="2" fill="#0284c7" />

            {/* Subtle Gold Ribbon Divider */}
            <path
              d="M 130 315 L 180 270 L 360 270 L 500 315"
              fill="none"
              stroke="url(#goldGradient)"
              strokeWidth="2.5"
              opacity="0.7"
            />

            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
          </svg>

          {/* Micro-Security Border Lines */}
          <div className="absolute inset-[6px] rounded-[18px] border border-slate-300/40 pointer-events-none" />

          {/* Front Content Header & Grid */}
          <div className="relative z-10 p-5 h-full flex flex-col justify-between">
            {/* Top Row: Photo, Identity Details, & 3D e-LGU Seal */}
            <div className="flex items-start justify-between gap-4">
              {/* Left Column: Biometric Photo & Chip */}
              <div className="flex flex-col items-center">
                {/* Biometric Photo Frame with Holographic Rim */}
                <div className="relative w-[115px] h-[135px] rounded-2xl p-[3px] bg-gradient-to-tr from-sky-400 via-indigo-500 to-amber-300 shadow-[0_8px_20px_rgba(0,0,0,0.15)] overflow-hidden">
                  <div className="relative w-full h-full rounded-[14px] bg-slate-200 overflow-hidden flex items-center justify-center">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt={fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 to-slate-200 text-sky-800">
                        <svg
                          className="w-16 h-16 opacity-70"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                        <span className="text-[9px] font-bold tracking-wider text-sky-900/60 uppercase">
                          Biometric
                        </span>
                      </div>
                    )}
                    {/* Security Watermark Reticle */}
                    <div className="absolute inset-0 pointer-events-none border border-sky-400/30 rounded-[14px] flex items-center justify-center">
                      <div className="w-4 h-4 border-t border-l border-sky-400/40 absolute top-1 left-1" />
                      <div className="w-4 h-4 border-t border-r border-sky-400/40 absolute top-1 right-1" />
                      <div className="w-4 h-4 border-b border-l border-sky-400/40 absolute bottom-1 left-1" />
                      <div className="w-4 h-4 border-b border-r border-sky-400/40 absolute bottom-1 right-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Column: Official Resident Name & Demographics */}
              <div className="flex-1 pt-1 pl-1">
                {/* Republic / e-LGU Header Bar */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#0038a8]">
                    Republic of the Philippines
                  </span>
                </div>

                {/* Resident Full Name */}
                <h2 className="text-[21px] font-black uppercase tracking-tight text-[#0a192f] leading-none drop-shadow-sm font-sans">
                  {fullName}
                </h2>

                {/* Role Badge */}
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-900/10 border border-blue-600/20 text-[#0038a8]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0038a8]" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest">
                    {role}
                  </span>
                </div>

                {/* Resident Address & Municipality */}
                <p className="mt-2 text-[11px] font-semibold text-slate-600 leading-tight">
                  {barangay}
                </p>
                <p className="text-[11px] font-medium text-slate-500 leading-tight">
                  {cityProvince}
                </p>

                {/* Smart Card UID / PhilSys Reference */}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    ID NO:
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded">
                    {idNumber}
                  </span>
                </div>
              </div>

              {/* Right Column: 3D Holographic e-LGU Seal */}
              <div className="flex flex-col items-center">
                <div className="relative w-[78px] h-[78px] rounded-full p-[2.5px] bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 shadow-[0_6px_20px_rgba(245,158,11,0.45)] flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-slate-950 border border-amber-300/60 overflow-hidden flex items-center justify-center shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/generic-lgu-logo.png"
                      alt="Generic LGU logo placeholder"
                      className="w-full h-full object-contain rounded-full drop-shadow-md scale-105"
                    />
                  </div>
                  {/* Outer Hologram Gold Ring Accent */}
                  <div className="absolute inset-0 rounded-full border border-white/50 pointer-events-none" />
                </div>
                <span className="mt-1 text-[8px] font-black uppercase tracking-wider text-white text-center leading-tight drop-shadow-sm">
                  Local Govt Unit
                </span>
              </div>
            </div>

            {/* Bottom Row: Microchip, Contactless Wave, Dates & QR Code */}
            <div className="flex items-end justify-between pt-2">
              {/* Microchip & Contactless RFID Wave */}
              <div className="flex items-center gap-3">
                {/* Photorealistic 3D Smart Card EMV Chip */}
                <div className="relative w-12 h-10 rounded-lg p-[1.5px] bg-gradient-to-br from-amber-200 via-amber-400 to-amber-700 shadow-md">
                  <div className="relative w-full h-full rounded-[6px] bg-gradient-to-br from-[#e6b142] via-[#cf9527] to-[#996a14] overflow-hidden border border-amber-200/80">
                    {/* Chip Contact Segments */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-[1px] p-[1.5px] opacity-75">
                      <div className="border border-amber-900/60 rounded-[2px]" />
                      <div className="border border-amber-900/60 rounded-[2px]" />
                      <div className="border border-amber-900/60 rounded-[2px]" />
                      <div className="border border-amber-900/60 rounded-[2px]" />
                      <div className="border border-amber-900/60 rounded-[2px]" />
                      <div className="border border-amber-900/60 rounded-[2px]" />
                    </div>
                    {/* Specular Highlight */}
                    <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-white/40 blur-[2px]" />
                  </div>
                </div>

                {/* Contactless Waves Icon with Cyan Luminous Glow */}
                <div className="flex items-center text-[#0038a8] drop-shadow-sm">
                  <svg
                    className="w-7 h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                    <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                    <path d="M15.5 21.5a12 12 0 0 0 0-19" />
                  </svg>
                </div>
              </div>

              {/* Join & Expiry Dates */}
              <div className="flex flex-col gap-0.5 text-left pl-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    JOIN
                  </span>
                  <span className="text-[12px] font-extrabold text-[#0038a8] font-mono">
                    {joinDate}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    EXPIRE
                  </span>
                  <span className="text-[12px] font-extrabold text-[#0a192f] font-mono">
                    {expireDate}
                  </span>
                </div>
              </div>

              {/* High-Security Matrix QR Code with Frame */}
              <div className="relative p-1.5 bg-white rounded-xl shadow-md border border-slate-200">
                {/* Security Target Reticles */}
                <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#0038a8] rounded-tl" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#0038a8] rounded-tr" />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#0038a8] rounded-bl" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#0038a8] rounded-br" />

                {/* QR Matrix Representation */}
                <div className="w-[66px] h-[66px] flex items-center justify-center p-0.5">
                  <svg className="w-full h-full" viewBox="0 0 100 100" fill="#0a192f">
                    {/* Top-left locator */}
                    <rect x="5" y="5" width="28" height="28" fill="#0038a8" rx="3" />
                    <rect x="11" y="11" width="16" height="16" fill="white" rx="1.5" />
                    <rect x="15" y="15" width="8" height="8" fill="#0038a8" />
                    {/* Top-right locator */}
                    <rect x="67" y="5" width="28" height="28" fill="#0038a8" rx="3" />
                    <rect x="73" y="11" width="16" height="16" fill="white" rx="1.5" />
                    <rect x="77" y="15" width="8" height="8" fill="#0038a8" />
                    {/* Bottom-left locator */}
                    <rect x="5" y="67" width="28" height="28" fill="#0038a8" rx="3" />
                    <rect x="11" y="73" width="16" height="16" fill="white" rx="1.5" />
                    <rect x="15" y="77" width="8" height="8" fill="#0038a8" />
                    {/* Data matrix dots */}
                    <rect x="38" y="8" width="8" height="8" />
                    <rect x="50" y="8" width="8" height="8" />
                    <rect x="38" y="20" width="8" height="8" />
                    <rect x="50" y="25" width="8" height="8" />
                    <rect x="8" y="38" width="8" height="8" />
                    <rect x="20" y="38" width="8" height="8" />
                    <rect x="8" y="50" width="8" height="8" />
                    <rect x="38" y="38" width="24" height="24" fill="#0038a8" rx="2" />
                    <circle cx="50" cy="50" r="5" fill="#f59e0b" />
                    <rect x="68" y="38" width="8" height="8" />
                    <rect x="80" y="44" width="8" height="8" />
                    <rect x="68" y="56" width="8" height="8" />
                    <rect x="80" y="68" width="8" height="8" />
                    <rect x="38" y="68" width="8" height="8" />
                    <rect x="50" y="75" width="8" height="8" />
                    <rect x="42" y="86" width="14" height="8" />
                    <rect x="68" y="82" width="10" height="8" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Interactive Holographic Glare Overlay */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 280px at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity * 2}), rgba(0,210,255,${glarePos.opacity}), transparent 70%)`,
            }}
          />
        </div>

        {/* ======================================================== */}
        {/* ─────────── CARD BACK (ISO 7810 ID-1 Standard) ─────────── */}
        {/* ======================================================== */}
        <div
          className="absolute inset-0 w-full h-full rounded-[22px] overflow-hidden bg-gradient-to-br from-[#0c2a5c] via-[#091f42] to-[#040e22] text-white shadow-[0_20px_50px_rgba(0,56,168,0.28)] border border-sky-400/30 backface-hidden [transform:rotateY(180deg)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Cybernetic Micro-circuit Background Watermark */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
            viewBox="0 0 500 315"
            fill="none"
          >
            <path
              d="M 50 120 L 150 120 L 180 150 L 320 150 L 350 120 L 450 120"
              stroke="#00d2ff"
              strokeWidth="2"
            />
            <path
              d="M 80 180 L 140 180 L 170 210 L 330 210 L 360 180 L 420 180"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            <circle cx="250" cy="160" r="85" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" />
          </svg>

          {/* 1. High-Coercivity (HiCo) Magnetic Stripe */}
          <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-r from-[#12161f] via-[#1a212e] to-[#0d1117] border-b border-white/10 flex items-center justify-end px-6 shadow-md">
            <span className="text-[8px] font-mono tracking-[0.3em] text-white/30 uppercase">
              HICO MAGNETIC DATA TRACK • ISO 7811
            </span>
          </div>

          {/* Back Content Container */}
          <div className="relative z-10 pt-16 px-6 pb-4 h-full flex flex-col justify-between">
            {/* 2. Glassmorphic Capsule Header Badge */}
            <div className="flex justify-center">
              <div className="px-6 py-1.5 rounded-full border border-sky-400/40 bg-gradient-to-r from-sky-500/20 via-blue-500/30 to-indigo-500/20 backdrop-blur-md shadow-[0_0_20px_rgba(56,189,248,0.25)]">
                <span className="text-sm font-black uppercase tracking-[0.2em] text-white drop-shadow">
                  e-LGU RESIDENT SMART CARD
                </span>
              </div>
            </div>

            {/* 3. Official Terms & Authority Disclaimer */}
            <p className="text-center text-[10.5px] leading-relaxed text-slate-200/95 font-medium px-4">
              The e-LGU Identification Card is issued by the Local Government Unit to give
              residents an official and convenient form of identification. This ID helps
              residents access local government services, programs, and transactions within
              the municipality.
            </p>

            {/* 4. Mayor Digital Signature Block */}
            <div className="flex flex-col items-center">
              {/* Digital Signature in Gold Script */}
              <div className="relative -mb-1">
                <span className="font-serif italic text-lg text-amber-300 font-semibold tracking-wide drop-shadow">
                  Signature
                </span>
              </div>

              {/* Official Horizontal Separation Rule */}
              <div className="w-56 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

              {/* Mayor Name & Official Title */}
              <h3 className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                {mayorName}
              </h3>
              <p className="text-[9px] uppercase tracking-wider text-sky-300 font-medium">
                {mayorTitle}
              </p>
            </div>

            {/* 5. Machine Readable Zone (MRZ) & Contactless Tap Footer */}
            <div className="pt-1 border-t border-white/10 flex items-center justify-between">
              {/* RFID Contactless Tap Indicator */}
              <div className="flex items-center gap-2">
                <div className="flex items-center text-cyan-400 animate-pulse">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                    <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                  </svg>
                </div>
                <span className="text-[9.5px] font-semibold tracking-wide text-sky-200">
                  Tap on an RFID reader to verify
                </span>
              </div>

              {/* Card UID & Security Serial */}
              <div className="font-mono text-[9px] text-slate-400">
                UID: <span className="text-white font-bold">{rfidUid}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Interactive Holographic Glare Overlay for Back */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 280px at ${100 - glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity * 1.5}), rgba(0,210,255,${glarePos.opacity}), transparent 70%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
