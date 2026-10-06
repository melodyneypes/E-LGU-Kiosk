"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUserResident,
  getTransactionTypes,
  getAppointmentConfig,
  getBookedSlots,
  getSystemThemeColor,
  checkActiveCedulaRequests
} from "./actions";
import { CedulaAppointmentClient } from "./CedulaAppointmentClient";

import { getCedulaSettings } from "../cedula/actions";

function CedulaAppointmentWrapper() {
  const router = useRouter();
  const [residentData, setResidentData] = useState<any>(null);
  const [cedulaTypes, setCedulaTypes] = useState<any[]>([]);
  const [appointmentConfig, setAppointmentConfig] = useState<any>({
    department: "TREASURY",
    maxSlots: 50,
    maxSlotsAM: 25,
    maxSlotsPM: 25,
    blockedDates: [],
    activeDays: [1, 2, 3, 4, 5]
  });
  const [bookedSlots, setBookedSlots] = useState<any[]>([]);
  const [hasActiveIndividual, setHasActiveIndividual] = useState(false);
  const [hasActiveJuridical, setHasActiveJuridical] = useState(false);
  const [themeColor, setThemeColor] = useState<string>("#059669");
  const [cedulaSettings, setCedulaSettings] = useState<Record<string, string>>({});

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

        const [typesRes, configRes, bookedRes, residentRes, themeRes, settingsRes, activeRes] = await Promise.all([
          getTransactionTypes(),
          getAppointmentConfig(),
          getBookedSlots(),
          getCurrentUserResident(userId),
          getSystemThemeColor(),
          getCedulaSettings(),
          checkActiveCedulaRequests(userId)
        ]);

        if (typesRes.success && typesRes.data) {
          setCedulaTypes(typesRes.data);
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
        if (activeRes.success && activeRes) {
          setHasActiveIndividual(activeRes.hasActiveIndividual || false);
          setHasActiveJuridical(activeRes.hasActiveJuridical || false);
        }
        if (themeRes && themeRes.success && themeRes.data) {
          setThemeColor(themeRes.data);
        }
        if (settingsRes && settingsRes.success && settingsRes.data) {
          setCedulaSettings(settingsRes.data);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }

    init();
  }, [router]);

  return (
    <CedulaAppointmentClient
      resident={residentData}
      cedulaTypes={cedulaTypes}
      config={appointmentConfig}
      bookedSlots={bookedSlots}
      hasActiveIndividual={hasActiveIndividual}
      hasActiveJuridical={hasActiveJuridical}
      themeColor={themeColor}
      cedulaSettings={cedulaSettings}
    />
  );
}

export default function CedulaAppointmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#070b14]" />}>
      <CedulaAppointmentWrapper />
    </Suspense>
  );
}
