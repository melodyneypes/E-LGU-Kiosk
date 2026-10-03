"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, X } from "lucide-react";

interface SecureQrUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode?: string;
  qrCodeUrl?: string;
  expiresAt: number;
  slotLabel?: string;
  documentName?: string;
  themeColor?: string;
}

export default function SecureQrUploadModal({
  isOpen,
  onClose,
  qrCode,
  qrCodeUrl,
  expiresAt,
  slotLabel,
  documentName,
  themeColor
}: SecureQrUploadModalProps) {
  const actualQrCode = qrCode || qrCodeUrl || "";
  const actualSlotLabel = slotLabel || documentName || "Document";
  
  // Prevent background scrolling when modal is active
  useEffect(() => {
    if (isOpen && actualQrCode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, actualQrCode]);

  if (!isOpen || !actualQrCode) return null;

  const formattedTime = expiresAt 
    ? new Date(expiresAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="w-full max-w-[420px] bg-white rounded-[2.5rem] border border-slate-200/80 p-8 shadow-2xl relative z-10 flex flex-col items-center select-none"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-6 top-6 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header Title with Badge */}
            <div className="flex items-center gap-3 self-start mb-6">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-theme-primary">
                <QrCode className="w-5 h-5 text-indigo-600" style={{ color: themeColor || "currentColor" }} />
              </div>
              <h3 className="text-lg font-black tracking-tighter text-[#0F172A] uppercase italic leading-none">
                Secure QR Upload
              </h3>
            </div>

            {/* QR Card Container */}
            {actualQrCode && (
              <div className="bg-white p-5 rounded-3xl w-full max-w-[280px] shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center justify-center mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={actualQrCode} alt="Upload Handoff QR Code" className="w-full h-auto object-contain" />
              </div>
            )}

            {/* Instruction Details */}
            <div className="text-center space-y-3 px-2 mb-8">
              <p className="text-sm font-black text-slate-800 leading-snug">
                Scan using your phone, then choose the <span className="text-theme-primary underline decoration-2 underline-offset-4">{actualSlotLabel}</span> document.
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                The link expires in 30 minutes. You may close this QR window while uploading; the kiosk will continue receiving files in the background.
              </p>
            </div>

            {/* Expiration Status Badge */}
            <div className="w-full py-3 px-5 rounded-2xl bg-sky-500/10 flex items-center justify-center gap-2 text-theme-primary font-bold text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              <span className="font-black uppercase tracking-wider text-[10px]">
                Waiting for secure upload • Expires {formattedTime}
              </span>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
