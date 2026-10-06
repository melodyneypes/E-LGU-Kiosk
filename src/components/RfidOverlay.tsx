"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import LGULogo from "./shared/LGULogo";
import FaceVerification from "./FaceVerification";
import OtpVerification from "./OtpVerification";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { sanitizeRfid } from "@/lib/rfidSanitizer";
import lguConfig from "@/lgu.config.json";

type Resident = {
  id: string;
  fullName: string;
  firstName: string;
  lastName?: string;
  middleName?: string;
  photoUrl?: string;
  faceReferenceUrl?: string | null;
  faceAuthSource?: string | null;
  facialRecognition?: unknown;
  barangay?: string;
  email?: string;
  hasFaceAuth: boolean;
};

type AuthStep = "TAP" | "VERIFYING" | "METHOD_SELECT" | "FACE_VERIFY" | "OTP_VERIFY" | "SERVICES" | "SUCCESS";

export default function RfidOverlay() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<AuthStep>("TAP");
  const [resident, setResident] = useState<Resident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCardId, setManualCardId] = useState("");
  const [copied, setCopied] = useState(false);
  const inputBuffer = useRef<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  async function sendOtp(email: string, name: string) {
    try {
      await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
    } catch (err) {
      console.error("Failed to send OTP:", err);
    }
  }

  const handleCardTap = useCallback(async (rawCardId: string) => {
    const cardId = sanitizeRfid(rawCardId);
    if (!cardId) return;

    setActive(true);
    setStep("VERIFYING");
    setError(null);
    setResident(null);

    try {
      const res = await fetch(`/api/rfid?card=${encodeURIComponent(cardId)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Card not recognized");
        setStep("TAP");
      } else {
        setResident(data.resident);
        // Priority: face recognition first, then email OTP as fallback
        if (data.resident.hasFaceAuth) {
          setStep("FACE_VERIFY");
        } else if (data.resident.email) {
          sendOtp(data.resident.email, data.resident.fullName);
          setStep("OTP_VERIFY");
        } else {
          setError("No verification method associated with this account.");
          setStep("TAP");
        }
      }
    } catch {
      setError("System unavailable. Please try again later.");
      setStep("TAP");
    }
  }, []);

  const handleManualLogin = useCallback(() => {
    const cardId = manualCardId.trim();
    if (!cardId) return;
    void handleCardTap(cardId);
  }, [handleCardTap, manualCardId]);

  useEffect(() => {
    const openOverlay = () => setActive(true);
    window.addEventListener("open-rfid-overlay", openOverlay);

    const handleKeyDown = (e: KeyboardEvent) => {
      // DEV BYPASS: Ctrl + Shift + S
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setActive(true);
        setResident({
          id: "dev-01",
          fullName: lguConfig.defaults.residentCard.residentName,
          firstName: lguConfig.defaults.residentCard.residentFirstName,
          lastName: lguConfig.defaults.residentCard.residentLastName,
          middleName: "",
          hasFaceAuth: false,
          barangay: lguConfig.barangays[0],
          email: lguConfig.defaults.residentCard.email
        });
        setStep("SERVICES");
        return;
      }

      // RFID readers typically act like keyboards and end with "Enter"
      if (e.key === "Enter") {
        if (inputBuffer.current.length > 3 && step === "TAP") {
          handleCardTap(inputBuffer.current);
        }
        inputBuffer.current = "";
      } else if (e.key.length === 1) {
        inputBuffer.current += e.key;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          inputBuffer.current = "";
        }, 150);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-rfid-overlay", openOverlay);
    };
  }, [step, handleCardTap]);

  const onVerified = () => {
    setStep("SERVICES");
  };

  const close = () => {
    setActive(false);
    setStep("TAP");
    setResident(null);
    setError(null);
    setManualCardId("");
  };

  const goToDashboard = (type: "municipal" | "barangay") => {
    if (resident) {
      sessionStorage.setItem("active_resident", JSON.stringify(resident));
    }
    setStep("SUCCESS");
    setTimeout(() => {
      router.push(`/dashboard?type=${type}`);
      close();
    }, 1500);
  };

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-b from-[#0a192f]/95 via-[#081225]/95 to-[#040915]/95 p-8 shadow-[0_0_60px_rgba(0,163,255,0.2)] backdrop-blur-xl">
        {/* Futuristic accent glow lines */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl" />

        {/* Close btn */}
        <button 
          onClick={close}
          className="absolute right-6 top-6 z-10 rounded-full border border-white/10 bg-white/5 p-2 text-white/50 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-sky-400/30 bg-gradient-to-br from-blue-900/60 to-slate-900/80 p-3 shadow-[0_0_25px_rgba(56,189,248,0.25)]">
             <LGULogo size={56} className="object-contain drop-shadow" />
          </div>

          {step === "VERIFYING" && (
            <div className="flex flex-col items-center py-12">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-sky-400/20" />
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-sky-400 border-t-transparent shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
              </div>
              <p className="mt-6 text-xl font-bold tracking-wide text-white">Verifying e-LGU Smart Card...</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-sky-400/80">Reading biometric security credential</p>
            </div>
          )}

          {step === "TAP" && !error && (
            <div className="w-full max-w-md py-4">
              {/* Modern Smart Card visual preview */}
              <div className="relative mx-auto mb-6 w-full max-w-[340px] overflow-hidden rounded-2xl border border-sky-400/40 bg-gradient-to-br from-[#0c2a5c] via-[#081e42] to-[#040e22] p-4 text-left shadow-[0_10px_35px_rgba(0,56,168,0.35)]">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-300">e-LGU Resident Smart Card</span>
                  </div>
                  {/* NFC Wave */}
                  <div className="flex items-center text-cyan-300 animate-pulse">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M8.5 16.5a5 5 0 0 1 0-9M12 19a8.5 8.5 0 0 0 0-14M15.5 21.5a12 12 0 0 0 0-19" />
                    </svg>
                  </div>
                </div>

                <div className="my-4 flex items-center gap-3">
                  {/* Microchip */}
                  <div className="relative h-9 w-11 rounded-md border border-amber-300/60 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-inner flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[1px] opacity-40">
                      <div className="border-r border-b border-amber-900/60" />
                      <div className="border-b border-amber-900/60" />
                      <div className="border-r border-amber-900/60" />
                      <div />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contactless RFID / NFC</p>
                    <p className="text-sm font-bold text-white tracking-wide">Hold Card Near Reader</p>
                  </div>
                </div>

                <div className="flex items-end justify-between border-t border-white/10 pt-2 text-[10px] text-slate-300">
                  <span>ISO/IEC 7810 ID-1 Standard</span>
                  <span className="text-sky-400 font-mono">13.56 MHz / 125 kHz</span>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-sky-500/20 bg-sky-950/20 p-4 text-left backdrop-blur-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-400">
                  Manual RFID Input
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Tap physical card on scanner, or type your card RFID number below and press Enter.
                </p>
              </div>

              <input
                value={manualCardId}
                onChange={(e) => setManualCardId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleManualLogin();
                  }
                }}
                placeholder="RFID UID (e.g. 0008472910)"
                className="w-full rounded-2xl border border-sky-400/30 bg-black/40 px-4 py-4 text-lg font-mono font-semibold tracking-[0.14em] text-white outline-none ring-0 transition placeholder:text-white/30 focus:border-sky-400 focus:bg-black/60 focus:shadow-[0_0_20px_rgba(56,189,248,0.25)]"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
              <button
                type="button"
                onClick={handleManualLogin}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 py-3.5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_0_25px_rgba(37,99,235,0.4)] transition hover:brightness-110 active:scale-[0.99]"
              >
                Scan / Authenticate Card
              </button>

              <div className="mt-3 flex items-center justify-center">
                <Link
                  href="/resident-card"
                  onClick={close}
                  className="text-xs font-bold text-sky-400/80 hover:text-cyan-300 underline underline-offset-4 transition"
                >
                  Preview & Print e-LGU Resident Smart Card Studio →
                </Link>
              </div>
            </div>
          )}

          {error && step === "TAP" && (
            <div className="py-12">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white">Access Denied</h2>
              <p className="mt-4 text-lg text-white/60">{error}</p>
              <button onClick={close} className="mt-8 rounded-xl bg-white/10 px-8 py-3 font-semibold text-white">Dismiss</button>
            </div>
          )}

          {step === "FACE_VERIFY" && resident && (
            <FaceVerification
              residentName={resident.fullName}
              referenceImageUrl={resident.faceReferenceUrl || resident.photoUrl || null}
              authSource={resident.faceAuthSource || null}
              facialRecognition={resident.facialRecognition}
              onSuccess={onVerified}
              onCancel={close}
            />
          )}

          {step === "OTP_VERIFY" && resident?.email && (
            <OtpVerification email={resident.email} onSuccess={onVerified} onCancel={close} />
          )}

          {step === "SERVICES" && resident && (
            <div className="w-full py-4">
              <div className="mb-6 flex justify-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-theme-secondary">
                  {resident.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resident.photoUrl} alt={resident.fullName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-theme-primary text-2xl text-white">
                      {resident.fullName.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <h2 className="text-3xl font-black text-white mb-2">Welcome Back, {resident.firstName}!</h2>
              <p className="text-white/40 mb-10">Select the service you wish to access today.</p>

              <div className="w-full max-w-md mx-auto">
                <button 
                  onClick={() => goToDashboard("municipal")}
                  className="group relative w-full h-44 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-sky-600 to-blue-800 p-6 text-left shadow-2xl transition-transform hover:scale-[1.02] active:scale-[0.98] border border-sky-400/30"
                >
                  <div className="absolute right-[-10px] top-[-10px] opacity-10 transition-transform group-hover:scale-110">
                    <svg className="h-36 w-36" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7v1h20V7L12 2zm0 18H2v-1h20v1h-10zM12 8c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2v-6c0-1.1.9-2 2-2z" /></svg>
                  </div>
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-200 bg-sky-900/60 px-3 py-1 rounded-full border border-sky-300/20">
                        Citizen Services Portal
                      </span>
                      <h3 className="text-2xl font-black text-white mt-2">Municipal Services</h3>
                      <p className="mt-1 text-xs text-sky-100/80">Permits, taxes, civil registry, and municipal requests.</p>
                    </div>
                    <div className="flex items-center text-xs font-bold text-white uppercase tracking-wider gap-2">
                      <span>Proceed to Services</span>
                      <span>→</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="py-20">
              <div className="mx-auto mb-8 flex h-24 w-24 animate-bounce items-center justify-center rounded-full bg-theme-secondary text-white">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold text-white">Authorized!</h2>
              <p className="mt-4 text-xl text-white/60">Redirecting to your dashboard...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
