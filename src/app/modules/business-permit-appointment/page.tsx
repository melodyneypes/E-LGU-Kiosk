"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUserResident,
  getTransactionTypes,
  getAppointmentConfig,
  getBookedSlots,
  getPreviousPermits,
  getSystemThemeColor,
  getBploSettings,
  checkActivePermits
} from "./actions";
import { BusinessPermitAppointmentClient } from "./BusinessPermitAppointmentClient";

function BusinessPermitAppointmentWrapper() {
  const router = useRouter();
  const [residentData, setResidentData] = useState<any>(null);
  const [permitTypes, setPermitTypes] = useState<any[]>([]);
  const [appointmentConfig, setAppointmentConfig] = useState<any>({
    department: "BPLO",
    maxSlots: 50,
    maxSlotsAM: 25,
    maxSlotsPM: 25,
    blockedDates: [],
    activeDays: [1, 2, 3, 4, 5]
  });
  const [bookedSlots, setBookedSlots] = useState<any[]>([]);
  const [hasActiveNew, setHasActiveNew] = useState(false);
  const [hasActiveRenew, setHasActiveRenew] = useState(false);
  const [previousPermits, setPreviousPermits] = useState<any[]>([]);
  const [themeColor, setThemeColor] = useState<string>("#059669");
  const [bploSettings, setBploSettings] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const savedResident = sessionStorage.getItem("active_resident");
    if (!savedResident) {
      router.push("/");
      return;
    }

    try {
      const resident = JSON.parse(savedResident);
      setResidentData(resident);
    } catch (e) {
      console.error(e);
    }

    async function init() {
      try {
        const saved = sessionStorage.getItem("active_resident");
        if (!saved) return;
        const resident = JSON.parse(saved);
        const userId = resident.userId || resident.id;

        const [typesRes, configRes, bookedRes, residentRes, permitsRes, themeRes, settingsRes, activeRes] = await Promise.all([
          getTransactionTypes(),
          getAppointmentConfig(),
          getBookedSlots(),
          getCurrentUserResident(userId),
          getPreviousPermits(userId),
          getSystemThemeColor(),
          getBploSettings(),
          checkActivePermits(userId)
        ]);

        if (typesRes.success && typesRes.data) {
          setPermitTypes(typesRes.data);
        }
        if (configRes.success && configRes.data) {
          setAppointmentConfig(configRes.data);
        }
        if (bookedRes.success && bookedRes.data) {
          setBookedSlots(bookedRes.data);
        }
        if (residentRes.success && residentRes.data) {
          setResidentData(residentRes.data);
        }
        if (permitsRes.success && permitsRes.data) {
          setPreviousPermits(permitsRes.data);
        }
        if (themeRes && themeRes.success && themeRes.data) {
          setThemeColor(themeRes.data);
        }
        if (settingsRes && settingsRes.success) {
          setBploSettings(settingsRes.data || null);
        }
        if (activeRes && activeRes.success && activeRes.data) {
          setHasActiveNew(activeRes.data.hasActiveNew);
          setHasActiveRenew(activeRes.data.hasActiveRenew);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }

    init();
  }, [router]);

  return (
    <BusinessPermitAppointmentClient
      resident={residentData}
      permitTypes={permitTypes}
      config={appointmentConfig}
      bookedSlots={bookedSlots}
      hasActiveNew={hasActiveNew}
      hasActiveRenew={hasActiveRenew}
      previousPermits={previousPermits}
      themeColor={themeColor}
      bploSettings={bploSettings}
    />
  );
}

export default function BusinessPermitAppointmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#070b14]" />}>
      <BusinessPermitAppointmentWrapper />
    </Suspense>
  );
}
