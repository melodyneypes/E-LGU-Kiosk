"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import LGULogo from "./shared/LGULogo";
import FaceVerification from "./FaceVerification";
import OtpVerification from "./OtpVerification";
import { useRouter } from "next/navigation";

import { sanitizeRfid } from "@/lib/rfidSanitizer";

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
          fullName: "Development Tester",
          firstName: "Tester",
          lastName: "Tester",
          middleName: "",
          hasFaceAuth: false,
          barangay: "Poblacion",
          email: "tester@elgu.gov.ph"
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
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1b13]/90 p-8 shadow-2xl">
        {/* Close btn */}
        <button 
          onClick={close}
          className="absolute right-6 top-6 z-10 text-white/40 hover:text-white"
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-8 w-20 h-20 bg-white rounded-full flex items-center justify-center p-2 shadow-xl">
             <LGULogo size={64} className="object-contain" />
          </div>
          {step === "VERIFYING" && (
            <div className="flex flex-col items-center py-12">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-theme-secondary border-t-transparent" />
              <p className="mt-6 text-xl font-medium text-white/80">Identifying Resident...</p>
            </div>
          )}

          {step === "TAP" && !error && (
            <div className="w-full max-w-md py-6">
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">
                  Temporary RFID Login
                </p>
                <p className="mt-2 text-sm text-white/60">
                  Type the RFID card ID here and press Enter to log in.
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
                placeholder="Enter RFID card ID"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-lg font-semibold tracking-[0.14em] text-white outline-none ring-0 transition placeholder:text-white/25 focus:border-theme-secondary focus:bg-black/40"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
              <button
                type="button"
                onClick={handleManualLogin}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-theme-secondary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:scale-[1.01]"
              >
                Login with RFID
              </button>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button 
                  onClick={() => goToDashboard("municipal")}
                  className="group relative h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-left shadow-lg transition-transform hover:scale-[1.02]"
                >
                  <div className="absolute right-[-10px] top-[-10px] opacity-10 transition-transform group-hover:scale-110">
                    <svg className="h-32 w-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7v1h20V7L12 2zm0 18H2v-1h20v1h-10zM12 8c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2v-6c0-1.1.9-2 2-2z" /></svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Municipal<br/>Services</h3>
                  <p className="mt-2 text-sm text-white/70">Permits, taxes, and town hall records.</p>
                </button>

                <button 
                  onClick={() => goToDashboard("barangay")}
                  className="group relative h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-theme-secondary to-theme-primary p-6 text-left shadow-lg transition-transform hover:scale-[1.02]"
                >
                   <div className="absolute right-[-10px] top-[-10px] opacity-10 transition-transform group-hover:scale-110">
                    <svg className="h-32 w-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 11.5A2.5 2.5 0 0114.5 14a2.5 2.5 0 01-2.5 2.5A2.5 2.5 0 019.5 14a2.5 2.5 0 012.5-2.5M12 2L3 7v6h2v6h14v-6h2V7L12 2z" /></svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Barangay<br/>Services</h3>
                  <p className="mt-2 text-sm text-white/70">Clearances, indigent certs, and local news.</p>
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
