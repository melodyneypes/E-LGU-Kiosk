"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  Home,
  FileText,
  Activity,
  DollarSign,
  Search,
  UserCheck,
  X,
  AlertCircle,
  QrCode,
  Printer,
  ChevronLeft,
  CalendarDays
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import lguConfig from "@/lgu.config.json";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getTransactionById,
  getSystemSettingAction,
  cancelTransaction
} from "../actions";
import { supabase } from "@/lib/supabase";
import PrintQueueTicket from "@/components/shared/PrintQueueTicket";
import CedulaView from "./views/CedulaView";
import BusinessPermitView from "./views/BusinessPermitView";
import ServiceHeader from "@/components/shared/ServiceHeader";
import SecureIdleTimer from "@/components/shared/SecureIdleTimer";

// Display dates/times in Philippine Standard Time (Asia/Manila)
function formatPHDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function KioskAppointmentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [printTriggered, setPrintTriggered] = useState(false);
  const [themeColor, setThemeColor] = useState("#10B981"); // Default Emerald
  const [branding, setBranding] = useState({
    logo: "",
    word1: "MUNICIPALITY",
    word2: "PORTAL"
  });

  useEffect(() => {
    const savedResident = sessionStorage.getItem("active_resident");
    if (!savedResident) {
      router.push("/");
      return;
    }
    try {
      const parsed = JSON.parse(savedResident);
      const uid = parsed.userId || parsed.id;
      setUserId(uid);
    } catch (e) {
      console.error(e);
      router.push("/");
    }
  }, [router]);

  const fetchAppointment = useCallback(async () => {
    if (!id || !userId) return;
    try {
      const res = await getTransactionById(id, userId);
      if (res.success && res.data) {
        setRequest(res.data);
      } else {
        toast.error("Failed to load appointment details.");
        router.push("/dashboard/appointment");
      }
    } catch (err) {
      console.error("Fetch appointment error:", err);
    }
  }, [id, userId, router]);

  const fetchSettings = useCallback(async () => {
    try {
      const [themeRes, logoRes, word1Res, word2Res] = await Promise.all([
        getSystemSettingAction("theme_color", "#10B981"),
        getSystemSettingAction("logo", lguConfig.assets.logo),
        getSystemSettingAction("brand_word_1", "MUNICIPALITY"),
        getSystemSettingAction("brand_word_2", "PORTAL")
      ]);
      setThemeColor(themeRes.data);
      setBranding({
        logo: logoRes.data || lguConfig.assets.logo,
        word1: word1Res.data || "MUNICIPALITY",
        word2: word2Res.data || "PORTAL"
      });
    } catch (err) {
      console.error("Fetch settings error:", err);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      if (!userId) return;
      setLoading(true);
      await Promise.all([fetchAppointment(), fetchSettings()]);
      setLoading(false);
    }
    initialize();
  }, [userId, fetchAppointment, fetchSettings]);

  // Realtime Supabase updates
  useEffect(() => {
    if (!supabase || !id) return;

    const channel = supabase
      .channel(`realtime-kiosk-appointment-details-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Transaction",
          filter: `id=eq.${id}`,
        },
        async (payload: any) => {
          console.log("Realtime appointment update detected:", payload);
          if (payload.new) {
            await fetchAppointment();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchAppointment]);

  const handleCancel = async () => {
    if (!userId) return;
    setIsCancelling(true);
    try {
      const res = await cancelTransaction(id, userId);
      if (res.success) {
        toast.success("Appointment successfully cancelled.");
        await fetchAppointment();
        setCancelConfirmOpen(false);
      } else {
        toast.error(res.error || "Failed to cancel appointment.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while cancelling your appointment.");
    } finally {
      setIsCancelling(false);
    }
  };

  const residentData = useMemo(() => {
    if (!request) return null;
    return request.residentSnapshot || request.user?.residentProfile || {};
  }, [request]);

  const additionalData = useMemo(() => {
    if (!request) return {};
    return (typeof request.additionalData === "string" 
      ? JSON.parse(request.additionalData || "{}") 
      : request.additionalData) || {};
  }, [request]);

  const statusConfig = useMemo(() => {
    if (!request) return null;
    if (request.isCancelled) {
      return { color: "text-red-500 bg-red-500/10 border-red-500/20", label: "CANCELLED", icon: X };
    }
    const status = request.status;
    switch (status) {
      case "FOR_REVISION": return { color: "text-amber-500 bg-amber-500/10 border-amber-500/20", label: "REVISION REQUIRED", icon: AlertCircle };
      case "FOR_REQUESTING": return { color: "text-white bg-theme-primary border-transparent", label: "AWAITING EVALUATION", icon: Clock };
      case "FOR_INSPECTION": return { color: "text-white bg-blue-600 border-transparent", label: "UNDER INSPECTION", icon: Search };
      case "EVALUATED": return { color: "text-white bg-theme-primary border-transparent", label: "EVALUATED / PENDING PAYMENT", icon: DollarSign };
      case "PAID": return { color: "text-white bg-emerald-500 border-transparent", label: "PAID / AWAITING CLAIM", icon: CheckCircle2 };
      case "FOR_PROCESSING": return { color: "text-white bg-blue-500 border-transparent", label: "IN PROCESSING", icon: Activity };
      case "FOR_CLAIM": return { color: "text-white bg-amber-500 border-transparent", label: "READY FOR CLAIMING", icon: UserCheck };
      case "RELEASED": return { color: "text-white bg-emerald-600 border-transparent", label: "COMPLETED & RELEASED", icon: CheckCircle2 };
      case "UNPAID": return { color: "text-white bg-amber-500 border-transparent", label: "FOR PAYMENT", icon: DollarSign };
      case "REJECTED": return { color: "text-red-500 bg-red-500/10 border-red-500/20", label: "DECLINED", icon: X };
      default: return { color: "text-white bg-theme-primary border-transparent", label: status.replace("_", " "), icon: Clock };
    }
  }, [request]);

  if (loading || !request || !residentData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#050816] flex flex-col font-sans select-none">
        <SecureIdleTimer />
        <ServiceHeader />
        <div className="max-w-4xl mx-auto px-6 py-12 w-full animate-pulse space-y-8">
          <div className="h-10 w-48 bg-slate-200 dark:bg-white/5 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="h-[400px] bg-slate-200 dark:bg-white/5 rounded-3xl" />
            <div className="md:col-span-2 space-y-6">
              <div className="h-32 bg-slate-200 dark:bg-white/5 rounded-3xl" />
              <div className="h-64 bg-slate-200 dark:bg-white/5 rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCedula = request.type?.code?.startsWith("CEDULA");
  const isBusinessPermit = request.type?.code?.startsWith("BUSINESS_PERMIT");

  // Get scheduled dates/times from transaction payload
  const appointmentDate = request.createdAt;
  const appointmentSlot = "Standard Office Hours";

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-[#050816] transition-colors duration-300 font-sans select-none overflow-y-auto overscroll-contain scroll-smooth">
      <SecureIdleTimer />
      <ServiceHeader />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 pb-24 w-full space-y-8 relative">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard/appointment")}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-theme-primary transition-all active:scale-95 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 rounded-xl shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to List
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Left Column - Kiosk Ticket Card */}
          <div className="md:col-span-1 space-y-6">
            <Card className="bg-white dark:bg-[#0c1120] border-slate-200/60 dark:border-white/5 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-theme-primary" />
              
              <div className="w-14 h-14 rounded-2xl bg-theme-primary/10 text-theme-primary flex items-center justify-center mb-4 mt-2">
                <QrCode className="w-8 h-8" />
              </div>

              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                Queue Ticket Number
              </span>
              <h2 className="text-xs md:text-sm font-black font-mono text-slate-900 dark:text-white tracking-tight border-2 border-dashed border-slate-200 dark:border-white/10 px-4 py-2 rounded-2xl bg-slate-50 dark:bg-white/5 w-full uppercase break-all">
                {request.queueNumber || request.id.substring(0, 8)}
              </h2>

              <Separator className="my-5 bg-slate-100 dark:bg-white/5" />

              <div className="w-full text-left space-y-4 text-xs font-bold leading-none text-slate-500 dark:text-slate-400">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Service Type</span>
                  <span className="text-slate-800 dark:text-white text-sm font-black uppercase">{request.type?.name}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date Created</span>
                  <span className="text-slate-800 dark:text-white text-sm font-black">{formatPHDate(request.createdAt)}</span>
                </div>
              </div>
            </Card>

            {/* Print Ticket Button */}
            <Button
              disabled={printTriggered}
              onClick={() => {
                toast.info("Sending ticket to thermal printer...");
                setPrintTriggered(true);
              }}
              className="w-full bg-theme-primary hover:bg-theme-primary/95 text-white rounded-2xl shadow-lg flex items-center justify-center gap-2 py-5 text-xs font-black uppercase tracking-wider select-none disabled:opacity-75"
            >
              <Printer className={`w-4 h-4 ${printTriggered ? "animate-bounce" : ""}`} />
              {printTriggered ? "Printing Ticket..." : "Print Ticket"}
            </Button>

            {/* Cancel Button */}
            {!request.isCancelled && !["RELEASED", "REJECTED", "PAID", "DELIVERED"].includes(request.status) && (
              <Button
                variant="outline"
                onClick={() => setCancelConfirmOpen(true)}
                className="w-full border-red-200 hover:bg-red-50 text-red-600 font-black uppercase tracking-wider text-xs py-5 rounded-2xl border bg-white dark:border-red-950/20 dark:bg-red-950/10 dark:hover:bg-red-950/20"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Application
              </Button>
            )}
          </div>

          {/* Right Column - Status and Specific View */}
          <div className="md:col-span-2 space-y-6">
            {/* Status Panel */}
            <Card className="bg-white dark:bg-[#0c1120] border-slate-200/60 dark:border-white/5 p-6 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Ticket Status</span>
                <Badge className={`border px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg ${statusConfig?.color}`}>
                  <div className="flex items-center gap-1">
                    {statusConfig && <statusConfig.icon className="w-3.5 h-3.5" />}
                    <span>{statusConfig?.label}</span>
                  </div>
                </Badge>
              </div>

              {request.rejectReason && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 block">Feedback / Reason</span>
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">{request.rejectReason}</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Assessment Details Panel */}
            <Card className="bg-white dark:bg-[#0c1120] border-slate-200/60 dark:border-white/5 p-8 rounded-3xl shadow-xl">
              {isCedula && (
                <CedulaView request={request} additionalData={additionalData} />
              )}
              {isBusinessPermit && (
                <BusinessPermitView request={request} additionalData={additionalData} />
              )}
              {!isCedula && !isBusinessPermit && (
                <div className="text-center py-6 space-y-3">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Assessment Info Under Evaluation</p>
                  <p className="text-xs font-bold text-slate-500 max-w-xs mx-auto">
                    This transaction doesn't have an active assessment snapshot yet. Please wait for municipal review.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Printer Portal portal integration */}
      {printTriggered && (
        <>
          {/* Visual Kiosk Print Mask: Masks any 100ms browser canvas repaints gracefully */}
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div className="flex flex-col items-center gap-4 rounded-3xl bg-slate-900/90 border border-white/10 p-8 shadow-2xl text-center max-w-xs animate-in fade-in zoom-in-95 duration-200">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Printer className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-white tracking-wider">Printing Ticket</h3>
                <p className="text-xs text-slate-400 mt-1">Please collect your queue receipt below.</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Thermal Dispenser Active
              </div>
            </div>
          </div>

          <PrintQueueTicket
            queueNumber={request.queueNumber || request.id.substring(0, 8).toUpperCase()}
            serviceName={request.type?.name}
            appointmentDate={appointmentDate}
            appointmentSlot={appointmentSlot}
            triggerPrint={printTriggered}
            branding={branding}
            themeColor={themeColor}
            onPrintCompleted={() => {
              setTimeout(() => {
                setPrintTriggered(false);
                toast.success("Ticket printed successfully!");
              }, 600);
            }}
          />
        </>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="rounded-[2rem] p-7 max-w-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1120] text-left">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Cancel Application?</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 pt-2 leading-relaxed">
              Are you sure you want to cancel this application ticket? This action cannot be undone, and you will have to resubmit all details if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isCancelling}
              onClick={() => setCancelConfirmOpen(false)}
              className="flex-1 rounded-xl font-black uppercase tracking-wider text-xs py-4"
            >
              No, Keep It
            </Button>
            <Button
              type="button"
              disabled={isCancelling}
              onClick={handleCancel}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wider text-xs py-4 shadow-lg shadow-red-600/20"
            >
              {isCancelling ? "Cancelling..." : "Yes, Cancel It"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
