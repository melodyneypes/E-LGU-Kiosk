"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Home, LogOut, User, X, Ticket, ChevronDown, ChevronRight } from "lucide-react";

type Resident = {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  barangay?: string;
  municipality?: string;
  photoUrl?: string;
  livenessUrl?: string;
  imageUrl?: string;
  idFrontUrl?: string;
};

const SERVICE_NAMES: Record<string, string> = {
  "building-permit": "Building Permit",
};

function formatServiceName(segment: string) {
  return SERVICE_NAMES[segment] || segment.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export default function ServiceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [resident, setResident] = useState<Resident | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeFontSize, setActiveFontSize] = useState<string>("md");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kiosk_font_size");
      if (saved) {
        setActiveFontSize(saved);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const sizeMap: Record<string, string> = {
      sm: "16px",
      md: "19px",
      lg: "22px",
      xl: "25px"
    };
    try {
      document.documentElement.style.fontSize = sizeMap[activeFontSize] || "19px";
    } catch (e) {
      console.error(e);
    }
  }, [activeFontSize]);

  const applyFontSize = (size: string) => {
    try {
      localStorage.setItem("kiosk_font_size", size);
      setActiveFontSize(size);
    } catch (e) {
      console.error(e);
    }
  };

  const serviceName = useMemo(() => {
    const segment = pathname.split("/").filter(Boolean)[1] || "Service";
    return formatServiceName(segment);
  }, [pathname]);

  useEffect(() => {
    const saved = sessionStorage.getItem("active_resident");
    if (!saved) {
      router.replace("/");
      return;
    }
    try {
      setResident(JSON.parse(saved));
    } catch {
      sessionStorage.removeItem("active_resident");
      router.replace("/");
    }
  }, [router]);

  const displayName =
    resident?.fullName ||
    [resident?.firstName, resident?.middleName, resident?.lastName].filter(Boolean).join(" ") ||
    "Resident";
  const residentPhotoUrl =
    resident?.photoUrl ||
    resident?.livenessUrl ||
    resident?.imageUrl ||
    resident?.idFrontUrl;
  const isDarkMode = (resolvedTheme || theme) === "dark";

  const logout = () => {
    sessionStorage.removeItem("active_resident");
    router.replace("/");
  };

  return (
    <>
      <header className="z-50 flex min-h-[4.5rem] md:min-h-[5.5rem] py-3 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur-2xl transition-colors dark:border-slate-800/80 dark:bg-[#0b1020]/95 sm:px-6 md:px-8 gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link href="/dashboard" className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-emerald-50 hover:text-theme-primary dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-emerald-950/50 active:scale-95" aria-label="Dashboard">
            <Home className="h-5 w-5" />
          </Link>
          <span className="hidden h-10 w-1 rounded-full bg-theme-primary sm:block shrink-0" />
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Municipal Service</p>
            <h1 className="truncate text-base sm:text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight">
              {serviceName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-slate-800 sm:px-3 active:scale-[0.98] cursor-pointer"
              aria-expanded={profileMenuOpen}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-theme-primary/40 bg-emerald-100 text-theme-primary dark:bg-emerald-950/60 dark:text-emerald-300 shadow-sm ring-2 ring-theme-primary/10">
                {residentPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={residentPhotoUrl} alt="" className="h-full w-full object-cover" />
                ) : <User className="h-5 w-5" />}
              </span>
              <span className="hidden sm:block max-w-[140px] md:max-w-[200px] lg:max-w-xs">
                <span className="block text-[7px] font-black uppercase tracking-widest text-emerald-600">Verified Resident</span>
                <span className="block truncate text-xs font-black text-slate-800 dark:text-slate-100">{displayName}</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                  profileMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {profileMenuOpen && (
              <div className="absolute right-0 mt-3 w-72 origin-top-right rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1120] p-2.5 shadow-2xl ring-1 ring-black/5 dark:shadow-black/70 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">
                    Verified Resident
                  </p>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate mt-0.5">
                    {displayName}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                    {resident?.barangay ? `Brgy. ${resident.barangay}` : "LGU Resident"}
                  </p>
                </div>

                <div className="space-y-1">
                  {/* Option 1: My Tickets */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      router.push("/dashboard/appointment");
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-theme-primary dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white group-hover:text-theme-primary transition-colors">
                          My Tickets
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Appointments & Status
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-theme-primary group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Option 2: My Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setProfileOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white group-hover:text-theme-primary transition-colors">
                          My Profile
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Details & Settings
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-theme-primary group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Font Size Selector */}
                  <div className="pt-2 pb-1 border-t border-slate-100 dark:border-slate-800/80 px-1">
                    <span className="block text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 mb-2">
                      Font Size
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { value: "sm", label: "Small", preview: "14px" },
                        { value: "md", label: "Normal", preview: "18px" },
                        { value: "lg", label: "Large", preview: "22px" },
                        { value: "xl", label: "X-Large", preview: "26px" }
                      ].map((sz) => (
                        <button
                          key={sz.value}
                          type="button"
                          onClick={() => applyFontSize(sz.value)}
                          className={`flex flex-col items-center justify-center rounded-xl border py-2 transition-all cursor-pointer ${
                            activeFontSize === sz.value
                              ? "border-theme-primary bg-emerald-50 text-theme-primary dark:border-theme-primary dark:bg-emerald-950/40 dark:text-emerald-300 font-bold shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-700"
                          }`}
                        >
                          <span style={{ fontSize: sz.preview }} className="leading-none font-sans">A</span>
                          <span className="mt-1 text-[8px] font-black uppercase tracking-wider">{sz.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option 3: Logout */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/30 text-left transition-colors text-red-600 dark:text-red-400 group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center shrink-0">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider">
                        Logout
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {profileOpen && resident && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-2xl transition-colors dark:bg-slate-950 dark:shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-theme-primary">Resident Profile</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{displayName}</h2>
              </div>
              <button type="button" onClick={() => setProfileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-900/60">
              <ProfileRow label="Email" value={resident.email} />
              <ProfileRow label="Contact Number" value={resident.contactNumber} />
              <ProfileRow label="Barangay" value={resident.barangay} />
              <ProfileRow label="Municipality" value={resident.municipality || "Local Municipality"} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-slate-800"
              >
                <span>
                  <span className="block text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Theme</span>
                  <span className="mt-1 block text-sm font-black text-slate-900 dark:text-white">
                    {isDarkMode ? "Dark Mode" : "Light Mode"}
                  </span>
                </span>
                <span className={`relative flex h-8 w-14 items-center rounded-full p-1 transition-colors ${isDarkMode ? "bg-theme-primary" : "bg-slate-200"}`}>
                  <span className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform ${isDarkMode ? "translate-x-6" : "translate-x-0"}`} />
                </span>
              </button>
              <button type="button" onClick={logout} className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-600 transition hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string }) {
  return <div className="flex justify-between gap-4 border-b border-slate-200 pb-3 last:border-0 last:pb-0 dark:border-slate-800"><span className="font-bold text-slate-400 dark:text-slate-500">{label}</span><span className="text-right font-black text-slate-700 dark:text-slate-100">{value || "Not provided"}</span></div>;
}
