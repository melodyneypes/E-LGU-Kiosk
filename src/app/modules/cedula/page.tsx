/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import PrivacyConsentCard from "@/components/shared/PrivacyConsentCard";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";
import {
  CheckCircle2,
  Calculator,
  User,
  ChevronRight,
  ChevronLeft,
  FileText,
  AlertCircle,
  Printer,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  Check,
  Lock,
  Upload
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getCurrentUserResident,
  getExistingCedulaTransactions,
  submitCedulaTransaction,
  submitStudentCedulaTransaction,
  getTransactionTypes,
  cancelTransaction,
  getCedulaSettings
} from "./actions";
import { calculateCedula, CedulaResult, getCedulaPenaltyRate } from "@/lib/cedula";
import { useRouter } from "next/navigation";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const STEPS = [
  { id: "STATUS", label: "Status", icon: Sparkles },
  { id: "RESIDENT", label: "Identity", icon: User },
  { id: "DECLARATION", label: "Declaration", icon: Calculator },
  { id: "DOCUMENTS", label: "Upload", icon: Upload },
  { id: "SUBMIT", label: "Submit", icon: CheckCircle2 }
];

export default function CedulaPage() {
  const router = useRouter();
  const pageScrollRef = React.useRef<HTMLDivElement>(null);
  const incomeInputRef = useRef<HTMLInputElement>(null);
  const contactInputRef = useRef<HTMLInputElement>(null);
  const privacySectionRef = useRef<HTMLDivElement>(null);
  
  const [currentStep, setCurrentStep] = useState("STATUS");
  const [activeTab, setActiveTab] = useState<"history" | "apply">("apply");
  const [residentData, setResidentData] = useState<any>(null);
  const [existingApplications, setExistingApplications] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // QR Handoff states
  const [handoffToken, setHandoffToken] = useState("");
  const [handoffQrCode, setHandoffQrCode] = useState("");
  const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
  const [handoffSessionSlot, setHandoffSessionSlot] = useState<"idFile" | "proofFile">("idFile");
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);
  const [handoffDocuments, setHandoffDocuments] = useState<Record<string, { fileName: string; url: string }>>({});

  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");

  // Form states
  const [cedulaTypes, setCedulaTypes] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [applicantType, setApplicantType] = useState<"INDIVIDUAL" | "JURIDICAL">("INDIVIDUAL");
  const [incomeSource, setIncomeSource] = useState("PROFESSION");
  const [income, setIncome] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [isStudent, setIsStudent] = useState(false);
  const [purpose, setPurpose] = useState("");

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [cedulaSettings, setCedulaSettings] = useState<Record<string, string>>({});
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Voice assistant states
  const [isVoiceEnabled] = useState(false);
  const [lang] = useState<"en" | "fil">("en");

  // Custom Toast helper
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);
  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toast = {
    success: (msg: string) => showToast(msg, "success"),
    error: (msg: string) => showToast(msg, "error"),
    info: (msg: string) => showToast(msg, "info"),
    warning: (msg: string) => showToast(msg, "warning"),
    loading: (msg: string) => showToast(msg, "info")
  };

  useEffect(() => {
    async function init() {
      try {
        const savedResident = sessionStorage.getItem("active_resident");
        if (!savedResident) {
          router.push("/");
          return;
        }

        const resident = JSON.parse(savedResident);
        const userId = resident.userId || resident.id;

        // Fetch types, existing applications, and settings
        const [typesRes, existingRes, residentRes, settingsRes] = await Promise.all([
          getTransactionTypes(),
          getExistingCedulaTransactions(userId),
          getCurrentUserResident(userId),
          getCedulaSettings()
        ]);

        if (settingsRes && settingsRes.success && settingsRes.data) {
          setCedulaSettings(settingsRes.data);
        }

        if (residentRes.success && residentRes.data) {
          setResidentData(residentRes.data);
          const dbIdUrl = residentRes.data.idFrontUrl;
          if (dbIdUrl && typeof dbIdUrl === "string") {
            setHandoffDocuments(prev => ({
              ...prev,
              idFile: { fileName: "Existing ID Card", url: dbIdUrl }
            }));
          }
        } else {
          setResidentData(resident);
          const sessIdUrl = resident.idFrontUrl;
          if (sessIdUrl && typeof sessIdUrl === "string") {
            setHandoffDocuments(prev => ({
              ...prev,
              idFile: { fileName: "Existing ID Card", url: sessIdUrl }
            }));
          }
        }

        let hasActiveIndividualLocal = false;
        if (existingRes.success && existingRes.data) {
          setExistingApplications(existingRes.data);
          hasActiveIndividualLocal = existingRes.data.some((app: any) => 
            (app.type?.code === "CEDULA_IND" || app.isStudent) &&
            !["RELEASED", "REJECTED", "DELIVERED", "CANCELLED"].includes(app.status) && 
            !app.isCancelled
          );
          if (existingRes.data.length > 0) {
            setActiveTab("history");
          }
        }

        if (typesRes.success && typesRes.data) {
          setCedulaTypes(typesRes.data);
          if (hasActiveIndividualLocal) {
            const jurType = typesRes.data.find((t: any) => t.code === "CEDULA_JUR");
            if (jurType) {
              setSelectedTypeId(jurType.id);
              setApplicantType("JURIDICAL");
              setIncomeSource("BUSINESS");
            }
          } else {
            const defaultIndType = typesRes.data.find((t: any) => t.code === "CEDULA_IND");
            if (defaultIndType) {
              setSelectedTypeId(defaultIndType.id);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  // QR Handoff Polling
  useEffect(() => {
    if (!handoffToken) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/upload-handoff/${encodeURIComponent(handoffToken)}`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.status === "uploaded") {
          const files = result.files || [];
          if (files[0]) {
            setHandoffDocuments(prev => ({
              ...prev,
              [handoffSessionSlot]: { fileName: files[0].fileName, url: files[0].url }
            }));
            setIsHandoffOpen(false);
            setHandoffToken("");
            toast.success("Document uploaded successfully from mobile device!");
          }
        } else if (!response.ok) {
          setIsHandoffOpen(false);
          setHandoffToken("");
          toast.error("QR Code session expired.");
        }
      } catch (error) {
        console.error("Poller error:", error);
      }
    }, 2500);
    return () => window.clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffToken, handoffSessionSlot]);

  const startHandoff = async (slot: "idFile" | "proofFile") => {
    if (!residentData || isCreatingHandoff) return;
    setIsCreatingHandoff(true);
    try {
      const userId = residentData.userId || residentData.id;
      const response = await fetch("/api/upload-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slot }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create QR upload session.");
      
      const qrDataUrl = await QRCode.toDataURL(result.uploadUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#071c12", light: "#ffffff" },
      });
      
      setHandoffToken(result.token);
      setHandoffSessionSlot(slot);
      setHandoffQrCode(qrDataUrl);
      setHandoffExpiresAt(result.expiresAt);
      setIsHandoffOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to configure handoff.");
    } finally {
      setIsCreatingHandoff(false);
    }
  };

  // Speak voice prompt helper
  const speakText = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "en" ? "en-US" : "fil-PH";
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Voice guidance toggle comment (unused)
  /*
  const toggleVoice = () => {
    const nextState = !isVoiceEnabled;
    setIsVoiceEnabled(nextState);
    if (nextState) {
      speakText(lang === "en" ? "Voice guide activated. Follow the instructions to get your Cedula." : "Gabay sa boses aktibo na. Sundin ang mga panuto para kumuha ng Cedula.");
    } else {
      window.speechSynthesis?.cancel();
    }
  };
  */

  const getActiveTypeObj = () => {
    return cedulaTypes.find((t: any) => t.id === selectedTypeId);
  };

  // Dynamic calculations
  const calcParams = {
    type: applicantType,
    income: parseFloat(income.replace(/,/g, "")) || 0,
    propertyValue: parseFloat(propertyValue.replace(/,/g, "")) || 0,
    baseFee: getActiveTypeObj()?.baseFee,
    settings: cedulaSettings
  };

  const result: CedulaResult = isStudent 
    ? { basicTax: getActiveTypeObj()?.studentFee || 0, additionalTax: 0, penalty: 0, deliveryFee: 0, totalAmount: getActiveTypeObj()?.studentFee || 0 }
    : calculateCedula(calcParams);

  // Stepper validity
  const isStepValid = (stepId: string) => {
    switch (stepId) {
      case "STATUS":
        return !!selectedTypeId;
      case "RESIDENT":
        return !!residentData?.contactNumber;
      case "DECLARATION":
        if (isStudent) return !!purpose.trim();
        if (applicantType === "JURIDICAL") {
          return !!businessName.trim() && (parseFloat(income.replace(/,/g, "")) > 0 || parseFloat(propertyValue.replace(/,/g, "")) > 0);
        }
        return parseFloat(income.replace(/,/g, "")) > 0 || parseFloat(propertyValue.replace(/,/g, "")) > 0;
      case "DOCUMENTS":
        const hasId = isStudent || !!handoffDocuments.idFile;
        const hasProof = !!handoffDocuments.proofFile;
        return hasId && hasProof;
      default:
        return true;
    }
  };

  const getHandoffSlotLabel = () => {
    if (handoffSessionSlot === "idFile") return "Valid ID";
    return isStudent ? "Student ID / Enrollment Form" : "Proof of Income";
  };

  const triggerValidationErrors = (stepId: string) => {
    setShowValidationErrors(true);
    setTimeout(() => {
      let elementToFocus: HTMLElement | null = null;
      if (stepId === "RESIDENT") {
        if (!residentData?.contactNumber) {
          elementToFocus = document.getElementById("resident-contactNumber");
          toast.error("Contact number is required in your profile.");
        }
      } else if (stepId === "DECLARATION") {
        if (isStudent) {
          if (!purpose.trim()) {
            elementToFocus = document.getElementById("declaration-purpose");
            toast.error("Please state the purpose / reason of your Cedula request.");
          }
        } else {
          if (applicantType === "JURIDICAL" && !businessName.trim()) {
            elementToFocus = document.getElementById("declaration-businessName");
            toast.error("Business name is required for Juridical applicants.");
          } else {
            const incVal = parseFloat(income.replace(/,/g, "")) || 0;
            const propVal = parseFloat(propertyValue.replace(/,/g, "")) || 0;
            if (incVal <= 0 && propVal <= 0) {
              elementToFocus = document.getElementById("declaration-income");
              toast.error(
                incomeSource === "PROPERTY"
                  ? "Please declare the worth of real property owned."
                  : "Please declare your annual gross income."
              );
            }
          }
        }
      } else if (stepId === "DOCUMENTS") {
        const hasId = isStudent || !!handoffDocuments.idFile;
        const hasProof = !!handoffDocuments.proofFile;
        if (!hasId) {
          elementToFocus = document.getElementById("upload-card-idFile");
          toast.error("Please upload your Valid ID card.");
        } else if (!hasProof) {
          elementToFocus = document.getElementById("upload-card-proofFile");
          toast.error(isStudent ? "Please upload your Student ID / Enrollment Form." : "Please upload your Proof of Income.");
        }
      }

      if (elementToFocus) {
        elementToFocus.focus();
        elementToFocus.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const handleNext = () => {
    if (!isStepValid(currentStep)) {
      triggerValidationErrors(currentStep);
      return;
    }
    setShowValidationErrors(false);

    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx < STEPS.length - 1) {
      const nextStep = STEPS[idx + 1].id;
      setCurrentStep(nextStep);
      
      if (isVoiceEnabled) {
        if (nextStep === "RESIDENT") {
          speakText(lang === "en" ? "Verify your profile details. Make sure your contact details are updated." : "Beripikahin ang iyong mga detalye. Siguraduhing tama ang contact info.");
        } else if (nextStep === "DECLARATION") {
          speakText(lang === "en" ? "Please declare your annual income or property value." : "Ipahayag ang iyong taunang kita o halaga ng ari-arian.");
        } else if (nextStep === "DOCUMENTS") {
          speakText(lang === "en" ? "Scan the QR code with your phone to upload your documents." : "I-scan ang QR code gamit ang iyong cellphone para mag-upload ng dokumento.");
        } else if (nextStep === "SUBMIT") {
          speakText(lang === "en" ? "Review the summary and tap submit to finish." : "Suriin ang kabuuan at pindutin ang submit para matapos.");
        }
      }
    }
  };

  const handleBack = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].id);
    }
  };

  const handleCancelApplication = async () => {
    if (!selectedApplication || !residentData) return;
    const userId = residentData.userId || residentData.id;
    try {
      const res = await cancelTransaction(selectedApplication.id, userId);
      if (res.success) {
        toast.success("Transaction cancelled successfully.");
        setSelectedApplication(null);
        setCurrentStep("STATUS");
      } else {
        toast.error(res.error || "Unable to cancel application.");
      }
    } catch {
      toast.error("Error occurred while cancelling.");
    }
  };

  const handleSubmit = async () => {
    if (!privacyAccepted) {
      setShowValidationErrors(true);
      toast.error("Please accept the Data Privacy Terms.");
      setTimeout(() => {
        const element = document.getElementById("privacyConsentCard");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    setIsSubmitting(true);
    const userId = residentData.userId || residentData.id;
    try {
      const submitData = new FormData();
      submitData.append("typeId", selectedTypeId);
      submitData.append("residentSnapshot", JSON.stringify(residentData));

      if (handoffDocuments.idFile) submitData.append("existingIdUrl", handoffDocuments.idFile.url);
      if (handoffDocuments.proofFile) submitData.append("existingProofUrl", handoffDocuments.proofFile.url);

      let res;
      if (isStudent) {
        submitData.append("purpose", purpose);
        res = await submitStudentCedulaTransaction(submitData, userId);
      } else {
        submitData.append("applicantType", applicantType);
        submitData.append("incomeSource", incomeSource);
        submitData.append("income", String(parseFloat(income.replace(/,/g, "")) || 0));
        submitData.append("propertyValue", String(parseFloat(propertyValue.replace(/,/g, "")) || 0));
        submitData.append("businessName", businessName);
        res = await submitCedulaTransaction(submitData, userId);
      }

      if (res.success && res.transactionId) {
        toast.success("Cedula request submitted successfully!");
        const updatedApps = await getExistingCedulaTransactions(userId);
        if (updatedApps.success && updatedApps.data) {
          setExistingApplications(updatedApps.data);
        }
        setCurrentStep("STATUS");
        setActiveTab("history");
      } else {
        toast.error(res.error || "Submission failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };



  const handlePrintDocument = async (documentUrl: string, title: string) => {
    try {
      toast.loading(`Preparing ${title}...`);
      const response = await fetch(documentUrl);
      if (!response.ok) throw new Error("Could not download file.");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      printFrame.src = blobUrl;
      
      printFrame.onload = () => {
        setTimeout(() => {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          setTimeout(() => {
            printFrame.remove();
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        }, 350);
      };
      
      document.body.appendChild(printFrame);
    } catch {
      toast.error("Unable to load document for printing.");
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafc] gap-6">
        <div className="w-20 h-20 border-8 border-slate-100 border-t-theme-primary rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="text-theme-primary font-black text-xs uppercase tracking-[0.4em] animate-pulse">Initializing Portal</p>
          <p className="text-slate-400 text-[10px] font-bold uppercase mt-2">Connecting to municipal database</p>
        </div>
      </div>
    );
  }

  const hasActiveIndividual = existingApplications.some(app => 
    (app.type?.code === "CEDULA_IND" || app.isStudent) &&
    !["RELEASED", "REJECTED", "DELIVERED", "CANCELLED"].includes(app.status) && 
    !app.isCancelled
  );

  const hasActiveJuridical = existingApplications.some(app => 
    app.type?.code === "CEDULA_JUR" &&
    !["RELEASED", "REJECTED", "DELIVERED", "CANCELLED"].includes(app.status) && 
    !app.isCancelled
  );

  return (
    <div
      ref={pageScrollRef}
      className="h-full max-w-5xl mx-auto overflow-y-auto overscroll-y-contain touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4 sm:px-6 py-8 space-y-12 pb-32 font-sans relative select-none"
    >
      
      {/* Toast banner */}
      {toastMessage && (
        <div className={cn(
          "fixed bottom-8 right-8 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-xl animate-in slide-in-from-bottom-5 duration-300",
          toastMessage.type === "success" ? "bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" :
          toastMessage.type === "error" ? "bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900" :
          "bg-blue-50 dark:bg-blue-950/90 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900"
        )}>
          {toastMessage.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {toastMessage.type === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
          {toastMessage.type === "info" && <AlertCircle className="w-5 h-5 text-blue-500" />}
          <span className="text-sm font-bold">{toastMessage.message}</span>
        </div>
      )}

      {activeTab === "history" && currentStep !== "EVALUATION" ? (
        <div className="flex flex-col gap-6 px-1 md:px-0 text-left">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-4xl md:text-7xl font-black text-white uppercase italic tracking-tighter leading-none select-none">
              MY CEDULA <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">REQUESTS</span>
            </h1>
            <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">Track the status, pay, or print your Community Tax Certificate requests</p>
          </div>
          <div className="flex justify-end w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("apply");
                setCurrentStep("STATUS");
              }}
              className="h-14 px-8 rounded-2xl bg-theme-primary hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
            >
              New Request
            </button>
          </div>
        </div>
      ) : (
        currentStep !== "EVALUATION" && (
          <div className="space-y-4 md:space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 px-1 md:px-0">
              <div className="space-y-1 md:space-y-2 text-left">
                <h1 className="text-4xl md:text-7xl font-black text-white uppercase italic tracking-tighter leading-none select-none">
                  COMMUNITY <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">TAX</span>
                </h1>
                <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">Community Tax Certificate / Cedula Portal</p>
              </div>
            </div>
          </div>
        )
      )}



      {/* Progress Stepper */}
      {activeTab === "apply" && currentStep !== "EVALUATION" && (
        <div className="grid grid-cols-5 gap-1.5 md:gap-4 relative px-1 md:px-2">
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isCompleted = STEPS.findIndex(s => s.id === currentStep) > idx;
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                onClick={() => {
                  if (currentStep === "EVALUATION") return;
                  const targetIdx = STEPS.findIndex(s => s.id === step.id);
                  const currentIdx = STEPS.findIndex(s => s.id === currentStep);
                  if (currentIdx === -1) return;
                  if (targetIdx <= currentIdx) {
                    setCurrentStep(step.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    let firstInvalidStep = null;
                    for (let i = currentIdx; i < targetIdx; i++) {
                      if (!isStepValid(STEPS[i].id)) {
                        firstInvalidStep = STEPS[i].id;
                        break;
                      }
                    }
                    if (firstInvalidStep) {
                      setCurrentStep(firstInvalidStep);
                      triggerValidationErrors(firstInvalidStep);
                    } else {
                      setCurrentStep(step.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }
                }}
                className="flex flex-col items-center gap-2 md:gap-3 relative z-10 font-black cursor-pointer group"
              >
                <div className={cn(
                  "w-11 h-11 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                  isActive ? "bg-theme-primary text-white border-theme-primary shadow-[0_0_20px_rgba(26,107,58,0.3)] scale-105 md:scale-110" :
                    isCompleted ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                      "bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent group-hover:border-theme-primary/30"
                )}>
                  <Icon className="w-4 h-4 md:w-7 md:h-7" />
                </div>
                <span className={cn(
                  "text-[7px] md:text-[10px] uppercase tracking-widest text-center italic hidden sm:block",
                  isActive ? "text-theme-primary opacity-100 font-black" : "opacity-40 group-hover:opacity-100 transition-opacity"
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div className="mt-4 md:mt-8 md:bg-white md:dark:bg-[#11131a] md:rounded-[2.5rem] md:border md:border-slate-200 md:dark:border-white/10 p-10 md:shadow-2xl relative md:overflow-hidden group/container min-h-[400px] md:min-h-[500px] flex flex-col">
        <div className="flex-1 flex flex-col justify-between">
            
            {/* Tab 1: HISTORY */}
            {activeTab === "history" && currentStep !== "EVALUATION" && (
              <div className="space-y-8 text-left">

                <div className="max-w-5xl mx-auto space-y-4">
                  {existingApplications.length > 0 ? (
                    <div className="space-y-4">
                      {existingApplications.map((app: any) => {
                        let badgeColor = "bg-slate-100 text-slate-700";
                        if (app.isCancelled) {
                          badgeColor = "bg-rose-100 text-rose-700";
                        } else if (app.status === "FOR_REQUESTING") {
                          badgeColor = "bg-amber-100 text-amber-700 animate-pulse";
                        } else if (app.status === "PAID") {
                          badgeColor = "bg-emerald-100 text-emerald-700";
                        } else if (app.status === "FOR_CLAIM") {
                          badgeColor = "bg-blue-100 text-blue-700";
                        } else if (["RELEASED", "DELIVERED"].includes(app.status)) {
                          badgeColor = "bg-emerald-100 text-emerald-700";
                        }

                        return (
                          <div
                            key={app.id}
                            onClick={() => {
                              if (app.status === "EVALUATED" || app.status === "UNPAID") {
                                router.push(`/checkout/${app.id}`);
                              } else {
                                router.push(`/modules/cedula/${app.id}`);
                              }
                            }}
                            className="p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:border-theme-primary/30 transition-all flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer"
                          >
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                              <div className="w-12 h-12 rounded-2xl bg-theme-primary/10 text-theme-primary flex items-center justify-center shrink-0">
                                <FileText size={24} />
                              </div>
                              <div className="space-y-1 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                    {app.type?.name || "Cedula Certificate"}
                                  </h4>
                                  <span className={cn("text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full", badgeColor)}>
                                    {app.isCancelled ? "CANCELLED" : app.status.replace("_", " ")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                                  <span>ID: {app.id.slice(-8).toUpperCase()}</span>
                                  <span>•</span>
                                  <span>Filed: {new Date(app.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200/60 dark:border-white/5">
                              <div className="text-left sm:text-right">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Amount</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white italic">
                                  ₱{(app.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {app.status === "FOR_CLAIM" && app.eCopyUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintDocument(app.eCopyUrl, "Cedula Document");
                                    }}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                                  >
                                    <Printer size={12} />
                                    Print
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl bg-slate-50/50">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="font-black text-slate-400 text-sm uppercase">No Records Found</h4>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Tab 2: APPLY */}
            {activeTab === "apply" && currentStep === "STATUS" && (
              <div className="space-y-8 md:space-y-12">
                <div className="space-y-3 md:space-y-4 text-center">
                  <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight select-none">
                    Choose Application <span className="text-theme-primary italic">Pathway</span>
                  </h2>
                  <p className="text-slate-500 font-medium italic text-xs md:text-sm uppercase tracking-widest max-w-2xl mx-auto select-none">
                    Select your current community tax status to proceed.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
                  {[
                    {
                      id: "INDIVIDUAL",
                      icon: User,
                      code: "CEDULA_IND",
                      isStudent: false
                    },
                    {
                      id: "STUDENT",
                      icon: GraduationCap,
                      code: "CEDULA_IND",
                      isStudent: true
                    },
                    {
                      id: "JURIDICAL",
                      icon: Sparkles,
                      code: "CEDULA_JUR",
                      isStudent: false
                    }
                  ].map(opt => {
                    const matched = cedulaTypes.find((t: any) => t.code === opt.code);
                    let label = matched?.name || (opt.id === "INDIVIDUAL" ? "Individual Citizen" : "Juridical Entity");
                    let desc = matched?.description || (opt.id === "INDIVIDUAL" ? "For private citizens, professionals, and employees." : "For corporations, partnerships, and business firms.");

                    if (opt.isStudent) {
                      label = "Student Cedula";
                      desc = "For active students. Flat-rate standard community tax. Excludes income declarations.";
                    }

                    const isLocked = ((opt.id === "INDIVIDUAL" || opt.isStudent) && hasActiveIndividual) || (opt.id === "JURIDICAL" && hasActiveJuridical);
                    const isSelected = applicantType === (opt.id === "STUDENT" ? "INDIVIDUAL" : opt.id) && !!isStudent === opt.isStudent;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if ((opt.id === "INDIVIDUAL" || opt.isStudent) && hasActiveIndividual) {
                            toast.error("You already have an active/pending Individual or Student Cedula request.");
                            return;
                          }
                          if (opt.id === "JURIDICAL" && hasActiveJuridical) {
                            toast.error("You already have an active/pending Juridical Cedula request.");
                            return;
                          }
                          const t = cedulaTypes.find((x: any) => x.code === opt.code) || cedulaTypes[0];
                          if (t) {
                            setApplicantType((opt.id === "STUDENT" ? "INDIVIDUAL" : opt.id) as any);
                            setIsStudent(opt.isStudent);
                            setSelectedTypeId(t.id);
                            setIncomeSource(opt.id === "JURIDICAL" ? "BUSINESS" : "PROFESSION");
                          }
                        }}
                        className={cn(
                          "p-8 rounded-[2rem] border-2 text-left relative group select-none overflow-hidden transition-all duration-300 min-h-[260px] flex flex-col justify-between cursor-pointer",
                          isLocked
                            ? "opacity-50 border-slate-100 bg-slate-50/70 cursor-not-allowed"
                            : isSelected
                              ? "border-theme-primary bg-theme-primary text-white shadow-xl scale-[1.02]"
                              : "border-slate-200 bg-white/45 hover:border-theme-primary/30"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                            isSelected ? "bg-white/20 text-white" : "bg-theme-primary/10 text-theme-primary"
                          )}>
                            <Icon className="w-5 h-5 stroke-[2.5]" />
                          </div>
                          {isLocked ? (
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
                              <Lock className="w-3 h-3" />
                            </div>
                          ) : isSelected && (
                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md animate-in zoom-in-50 duration-300">
                              <Check className="w-3.5 h-3.5 text-theme-primary stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 mt-8">
                          <h4 className={cn(
                            "text-lg md:text-xl font-black uppercase italic tracking-wider leading-tight",
                            isSelected ? "text-white" : "text-slate-800"
                          )}>
                            {label.toUpperCase()}
                          </h4>
                          <p className={cn(
                            "text-[9px] md:text-[10px] font-bold uppercase tracking-wider leading-relaxed",
                            isSelected ? "text-white/80" : "text-slate-400"
                          )}>
                            {desc.toUpperCase()}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>


              </div>
            )}

            {/* Step 2: PROFILE/RESIDENT */}
            {activeTab === "apply" && currentStep === "RESIDENT" && residentData && (
              <div className="space-y-6 md:space-y-8 flex-1">
                <div className="space-y-1">
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight">Identity <span className="text-theme-primary italic">Confirmation</span></h2>
                  <p className="text-[10px] md:text-xs text-slate-500 font-medium italic">Verify your personal records. Only the contact number should be provided/updated.</p>
                </div>

                <div className="space-y-4 md:space-y-6">
                  {/* Row 1: Names */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name</Label>
                      <Input
                        value={residentData.firstName || ""}
                        readOnly={true}
                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Middle Name</Label>
                      <Input
                        value={residentData.middleName || ""}
                        readOnly={true}
                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Name</Label>
                      <Input
                        value={residentData.lastName || ""}
                        readOnly={true}
                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Suffix</Label>
                      <Input
                        value={residentData.suffix || ""}
                        readOnly={true}
                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                      />
                    </div>
                  </div>

                  <Separator className="opacity-50" />

                  {/* Row 2: Personal */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Birth Date</Label>
                      <Input
                        type="date"
                        value={residentData.dateOfBirth ? new Date(residentData.dateOfBirth).toISOString().split('T')[0] : ""}
                        readOnly={true}
                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Age</Label>
                      <Input
                        value={(() => {
                          if (!residentData.dateOfBirth) return "";
                          const today = new Date();
                          const birthDate = new Date(residentData.dateOfBirth);
                          let age = today.getFullYear() - birthDate.getFullYear();
                          const m = today.getMonth() - birthDate.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
                          return age;
                        })()}
                        readOnly
                        className="h-10 rounded-xl bg-slate-50 border-slate-200 text-slate-400 font-bold text-xs md:text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Civil Status</Label>
                      <Input
                        value={residentData.civilStatus || "N/A"}
                        readOnly
                        className="h-10 rounded-xl bg-slate-50 border-slate-200 text-slate-400 font-bold text-xs md:text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Citizenship</Label>
                      <Input
                        value={residentData.citizenship || "Filipino"}
                        readOnly={true}
                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Row 3: Contact & Occupation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Occupation</Label>
                      <Input
                        value={residentData.occupation || ""}
                        readOnly={true}
                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Number</Label>
                      <Input
                        id="resident-contactNumber"
                        ref={contactInputRef}
                        value={residentData.contactNumber || ""}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9+]/g, '');
                          if (val.includes('+')) {
                            const hasPlus = val.startsWith('+');
                            val = (hasPlus ? '+' : '') + val.replace(/\+/g, '');
                          }
                          setResidentData((p: any) => ({ ...p, contactNumber: val }));
                        }}
                        className={cn(
                          "h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm transition-all",
                          showValidationErrors && !residentData.contactNumber ? "border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20" : ""
                        )}
                        placeholder="09xx xxx xxxx"
                      />
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-wider ml-1 animate-pulse">
                        * Note: Please use your active contact number.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-theme-primary/5 border border-theme-primary/10 p-3 md:p-4 rounded-2xl flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-theme-primary shrink-0" />
                  <p className="text-[8px] md:text-[10px] text-theme-primary font-black italic leading-tight uppercase tracking-widest">
                    Note: Changes will update your Resident Profile upon submission.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: DECLARATION */}
            {activeTab === "apply" && currentStep === "DECLARATION" && (
              <div className="space-y-8 md:space-y-12 flex-1">
                <div className="space-y-2 md:space-y-4 text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-tight">
                    {isStudent ? "Request" : "Tax"} <span className="text-theme-primary italic">Declaration</span>
                  </h2>
                  <p className="text-slate-500 font-medium italic text-xs md:text-sm leading-relaxed uppercase tracking-wider">
                    {isStudent
                      ? "Provide the purpose / reason of your Cedula request."
                      : "Declare your annual financial status for the tax computation."}
                  </p>
                </div>

                <div className={cn("grid grid-cols-1 gap-6 md:gap-10", !isStudent && "md:grid-cols-2")}>
                  <div className="space-y-6 md:space-y-8">
                    {isStudent ? (
                      <div className="space-y-2 md:space-y-3">
                        <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 italic ml-1">
                          Purpose / Reason of Request <span className="text-rose-500 font-black not-italic">*</span>
                        </Label>
                        <textarea
                          id="declaration-purpose"
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value)}
                          placeholder="Enter the purpose of your Cedula request (e.g. Scholarship application, School Enrollment, Board Exam, Valid ID verification, etc.)"
                          className={cn(
                            "w-full min-h-[140px] p-4 rounded-xl border shadow-sm text-sm font-bold bg-white text-slate-800 focus:outline-none focus:ring-theme-primary focus:border-theme-primary transition-all leading-relaxed",
                            showValidationErrors && !purpose.trim() ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" : "border-slate-200"
                          )}
                        />
                      </div>
                    ) : (
                      <>
                        {applicantType === "JURIDICAL" && (
                          <div className="space-y-2 md:space-y-3">
                            <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 italic ml-1">Business Name</Label>
                            <Input
                              id="declaration-businessName"
                              value={businessName}
                              onChange={(e) => setBusinessName(e.target.value)}
                              placeholder="Enter Business Name"
                              className={cn(
                                "h-12 rounded-xl text-lg font-black italic bg-white transition-all",
                                showValidationErrors && !businessName.trim() ? "border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20" : "border-slate-200"
                              )}
                            />
                          </div>
                        )}

                        <div className="space-y-2 md:space-y-3">
                          <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 italic ml-1">
                            {applicantType === "JURIDICAL" && incomeSource === "PROPERTY"
                              ? "Worth of Real Property Owned"
                              : "Annual Gross Income"}
                          </Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300 italic">₱</span>
                            <Input
                              id="declaration-income"
                              ref={incomeInputRef}
                              type="text"
                              value={applicantType === "JURIDICAL" && incomeSource === "PROPERTY" ? propertyValue : income}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                if (val === '') {
                                  if (applicantType === "JURIDICAL" && incomeSource === "PROPERTY") {
                                    setPropertyValue('');
                                  } else {
                                    setIncome('');
                                  }
                                  return;
                                }
                                const parts = val.split('.');
                                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                const formatted = parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];

                                if (applicantType === "JURIDICAL" && incomeSource === "PROPERTY") {
                                  setPropertyValue(formatted);
                                } else {
                                  setIncome(formatted);
                                }
                              }}
                              placeholder="0.00"
                              className={cn(
                                "h-12 pl-10 rounded-xl text-lg font-black italic bg-white transition-all",
                                showValidationErrors && (applicantType === "JURIDICAL" && incomeSource === "PROPERTY" ? !propertyValue : !income) ? "border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20" : "border-slate-200"
                              )}
                            />
                          </div>
                        </div>

                        {/* Income Category Select */}
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic ml-1">
                            Income Source Category
                          </Label>
                          <div className="flex flex-col gap-2">
                            {(applicantType === "JURIDICAL"
                              ? [
                                  { id: "BUSINESS", label: "Business", desc: "Annual Gross Receipts / Income" },
                                  { id: "PROPERTY", label: "Real Property", desc: "Worth of Real Property Owned" }
                                ]
                              : [
                                  { id: "PROFESSION", label: "Profession", desc: "Employees, Freelancers, & Salary" },
                                  { id: "BUSINESS", label: "Business", desc: "Trade, Stores, & Services" },
                                  { id: "PROPERTY", label: "Property", desc: "Real Estate Rentals & Leases" }
                                ]
                            ).map(opt => {
                              const isSelected = incomeSource === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setIncomeSource(opt.id);
                                    if (opt.id === "PROPERTY") setIncome("");
                                    else setPropertyValue("");
                                  }}
                                  className={cn(
                                    "px-5 py-4 rounded-xl border-2 transition-all duration-300 text-left relative overflow-hidden flex flex-col items-stretch justify-between gap-2 lg:flex-row lg:items-center lg:gap-4 group select-none shadow-sm cursor-pointer",
                                    isSelected
                                      ? "border-theme-primary bg-theme-primary/5"
                                      : "border-slate-200 bg-white/40 hover:border-theme-primary/30"
                                  )}
                                >
                                  <h4 className={cn(
                                    "shrink-0 text-sm font-black uppercase italic tracking-wider whitespace-nowrap",
                                    isSelected ? "text-theme-primary" : "text-slate-800"
                                  )}>
                                    {opt.label}
                                  </h4>
                                  <p className={cn(
                                    "min-w-0 text-[10px] font-bold uppercase tracking-tighter text-left lg:flex-1 lg:text-right",
                                    isSelected ? "text-theme-primary/70" : "text-slate-500"
                                  )}>
                                    {opt.desc}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Estimated Assessment Card */}
                  {!isStudent && (
                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Calculator className="w-24 h-24 rotate-12" />
                      </div>
                      <div className="space-y-4 border-b border-white/10 pb-6 relative z-10 font-bold">
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest italic opacity-75">
                          <span>Basic Tax</span>
                          <span>₱{(result.basicTax).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest italic opacity-75">
                          <span>Additional Tax</span>
                          <span>₱{result.additionalTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest italic text-amber-500">
                          <span>Penalty ({Math.round(getCedulaPenaltyRate(cedulaSettings) * 100)}%)</span>
                          <span>₱{result.penalty.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-between items-end relative z-10">
                        <div className="space-y-1 mb-2 text-left">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-theme-primary italic">Estimated Total</span>
                          <p className="text-[7px] font-bold text-white/40 uppercase tracking-tighter italic leading-none">
                            * Subject to admin evaluation.
                          </p>
                        </div>
                        <span className="text-3xl md:text-4xl font-black italic tracking-tighter text-white">
                          ₱{result.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: DOCUMENTS/HANDOFF */}
            {activeTab === "apply" && currentStep === "DOCUMENTS" && (
              <div className="space-y-6 flex-1">
                <div className="space-y-1">
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight">Attach <span className="text-theme-primary italic">Documents</span></h2>
                  <p className="text-[10px] md:text-xs text-slate-500 font-medium italic uppercase tracking-wider">
                    Use your phone to scan the QR code and securely upload documents.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {!isStudent && (
                    <div 
                      id="upload-card-idFile"
                      className={cn(
                        "bg-[#f8fafc] border rounded-3xl p-8 flex flex-col justify-between items-center shadow-inner text-center transition-all min-h-[260px]",
                        showValidationErrors && !handoffDocuments.idFile ? "border-rose-500 bg-rose-50/10 ring-2 ring-rose-500/20" : "border-slate-200"
                      )}
                    >
                      {handoffDocuments.idFile ? (
                        <div className="flex flex-col items-center justify-between h-full w-full space-y-4">
                          <div className="w-14 h-14 bg-emerald-500/10 text-theme-primary rounded-2xl flex items-center justify-center">
                            <ShieldCheck size={28} className="stroke-[2.5]" />
                          </div>
                          <div className="space-y-1">
                            <span className="block text-xs font-black text-emerald-600 uppercase tracking-widest">Upload Complete</span>
                            <p className="text-slate-700 text-[10px] font-bold truncate max-w-[180px]">{handoffDocuments.idFile.fileName}</p>
                          </div>
                          <div className="flex items-center gap-3 w-full justify-center pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setViewerUrl(handoffDocuments.idFile.url);
                                setViewerTitle("Valid ID Card Preview");
                                setViewerOpen(true);
                              }}
                              className="px-5 py-2.5 rounded-full bg-theme-primary hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => startHandoff("idFile")}
                              className="px-5 py-2.5 rounded-full bg-[#334155] hover:bg-slate-700 text-white font-black text-[9px] uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                              Re-upload
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-between h-full w-full">
                          <div className="space-y-2">
                            <ShieldCheck className="text-slate-400 mx-auto" size={40} />
                            <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Valid ID Card <span className="text-rose-500 font-black not-italic">*</span></h4>
                            <p className="text-slate-400 text-[10px] leading-relaxed max-w-xs mx-auto">
                              Required: Any government-issued identification document.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startHandoff("idFile")}
                            className="mt-4 px-6 py-3 rounded-xl bg-theme-primary hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-theme-primary/20 active:scale-95 transition-all cursor-pointer"
                          >
                            Upload ID
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div 
                    id="upload-card-proofFile"
                    className={cn(
                      "bg-[#f8fafc] border rounded-3xl p-8 flex flex-col justify-between items-center shadow-inner text-center transition-all min-h-[260px]",
                      showValidationErrors && !handoffDocuments.proofFile ? "border-rose-500 bg-rose-50/10 ring-2 ring-rose-500/20" : "border-slate-200"
                    )}
                  >
                    {handoffDocuments.proofFile ? (
                      <div className="flex flex-col items-center justify-between h-full w-full space-y-4">
                        <div className="w-14 h-14 bg-emerald-500/10 text-theme-primary rounded-2xl flex items-center justify-center">
                          <FileText size={28} className="stroke-[2.5]" />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-xs font-black text-emerald-600 uppercase tracking-widest">Upload Complete</span>
                          <p className="text-slate-700 text-[10px] font-bold truncate max-w-[180px]">{handoffDocuments.proofFile.fileName}</p>
                        </div>
                        <div className="flex items-center gap-3 w-full justify-center pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setViewerUrl(handoffDocuments.proofFile.url);
                              setViewerTitle(isStudent ? "Student ID / Enrollment Form Preview" : "Proof of Income Preview");
                              setViewerOpen(true);
                            }}
                            className="px-5 py-2.5 rounded-full bg-theme-primary hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => startHandoff("proofFile")}
                            className="px-5 py-2.5 rounded-full bg-[#334155] hover:bg-slate-700 text-white font-black text-[9px] uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
                          >
                            Re-upload
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-between h-full w-full">
                        <div className="space-y-2">
                          <FileText className="text-slate-400 mx-auto" size={40} />
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                            {isStudent ? "Student ID / Enrollment Form" : "Proof of Income"} <span className="text-rose-500 font-black not-italic">*</span>
                          </h4>
                          <p className="text-slate-400 text-[10px] leading-relaxed max-w-xs mx-auto">
                            {isStudent ? "Required: Current registration paper or school ID." : "Required: Payslip, Certificate of Employment, or Tax Return."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startHandoff("proofFile")}
                          className="mt-4 px-6 py-3 rounded-xl bg-theme-primary hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-theme-primary/20 active:scale-95 transition-all cursor-pointer"
                        >
                          Upload Document
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: SUBMIT */}
            {activeTab === "apply" && currentStep === "SUBMIT" && (
              <div className="space-y-6 flex-1">
                <div className="space-y-1">
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight">Review <span className="text-theme-primary italic">Summary</span></h2>
                  <p className="text-slate-500 font-medium italic text-xs uppercase tracking-wider">Review your details and submit for approval.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-4">
                    <div className="bg-[#f8fafc] p-6 rounded-2xl border border-slate-200 shadow-inner space-y-3 font-bold text-slate-600 text-xs uppercase tracking-wider">
                      <div className="flex justify-between">
                        <span className="opacity-70">Resident Name:</span>
                        <span className="text-slate-800">{residentData?.firstName} {residentData?.lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Filing Pathway:</span>
                        <span className="text-slate-800">{isStudent ? "STUDENT" : applicantType}</span>
                      </div>
                      {applicantType === "JURIDICAL" && (
                        <div className="flex justify-between">
                          <span className="opacity-70">Business:</span>
                          <span className="text-slate-800">{businessName}</span>
                        </div>
                      )}
                      {!isStudent && (
                        <div className="flex justify-between">
                          <span className="opacity-70">Declared Income:</span>
                          <span className="text-slate-800">₱{parseFloat(income.replace(/,/g, "") || "0").toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <PrivacyConsentCard
                      ref={privacySectionRef}
                      privacyAccepted={privacyAccepted}
                      onToggle={() => {
                        if (privacyAccepted) {
                          setPrivacyAccepted(false);
                        } else {
                          setIsPrivacyModalOpen(true);
                        }
                      }}
                      showValidationErrors={showValidationErrors}
                      themeColor = "var(--primary-theme)"
                    />
                  </div>

                  <div className="bg-slate-900 rounded-[2rem] p-8 flex flex-col justify-between shadow-2xl text-white">
                    <div>
                      <h4 className="font-black text-[10px] uppercase text-theme-primary tracking-widest mb-4">Tax Assessment Summary</h4>
                      <div className="space-y-3 text-xs font-bold uppercase tracking-wider opacity-80">
                        <div className="flex justify-between">
                          <span>Basic Community Tax:</span>
                          <span>₱{result.basicTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Additional Gross Tax:</span>
                          <span>₱{result.additionalTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-amber-500">
                          <span>Penalty Charge:</span>
                          <span>₱{result.penalty.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 pt-4 border-t border-white/10 flex justify-between text-xl font-black text-emerald-400 items-baseline">
                      <span>TOTAL DUE</span>
                      <span>₱{result.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Evaluation/Pending Processing Screen */}
            {currentStep === "EVALUATION" && selectedApplication && (
              <div className="space-y-6 flex-1 text-center py-10">
                <div className="mx-auto w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-theme-primary mb-6 shadow-inner animate-pulse">
                  <CheckCircle2 size={56} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">CEDULA REQUEST FILED</h3>
                <p className="text-slate-400 font-semibold uppercase tracking-wider max-w-lg mx-auto">
                  Your request has been saved in the queue. Please proceed to the treasury counter to complete payment, or click pay below for online channels.
                </p>

                <div className="max-w-md mx-auto bg-[#f8fafc] border border-slate-200 rounded-2xl p-6 my-8 font-semibold text-slate-700 text-sm text-left shadow-inner space-y-3">
                  <div className="flex justify-between">
                    <span>Transaction ID:</span>
                    <span className="font-bold font-mono">{selectedApplication.id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Filing Status:</span>
                    <span className="font-bold text-amber-600 uppercase">{selectedApplication.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Calculated Total:</span>
                    <span className="font-bold text-theme-primary">₱{selectedApplication.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                 <div className="flex flex-col items-center gap-4">
                  <div className="flex justify-center gap-4 flex-wrap">
                    {selectedApplication.status === "FOR_REQUESTING" && (
                      <button
                        onClick={handleCancelApplication}
                        className="px-6 py-4 rounded-2xl border border-red-200 bg-red-50 font-bold uppercase tracking-wider text-red-600 transition-all hover:bg-red-100 cursor-pointer"
                      >
                        Cancel Request
                      </button>
                    )}

                    {selectedApplication.status === "FOR_CLAIM" && selectedApplication.eCopyUrl && (
                      <button
                        onClick={() => handlePrintDocument(selectedApplication.eCopyUrl, "Cedula document")}
                        className="px-8 py-4 bg-theme-primary hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-theme-primary/20 flex items-center gap-2 cursor-pointer"
                      >
                        <Printer size={18} />
                        Print Cedula
                      </button>
                    )}

                    {(selectedApplication.status === "UNPAID" || selectedApplication.status === "EVALUATED") && (
                      <button
                        onClick={() => router.push(`/checkout/${selectedApplication.id}`)}
                        className="px-8 py-4 bg-theme-primary hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-theme-primary/20 cursor-pointer"
                      >
                        Pay Online
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedApplication(null);
                        setCurrentStep("STATUS");
                      }}
                      className="px-6 py-4 rounded-2xl border border-slate-200 bg-white font-bold uppercase tracking-wider text-slate-700 transition-all hover:bg-slate-50 cursor-pointer"
                    >
                      File Another Request
                    </button>
                  </div>

                  {selectedApplication.status === "FOR_REQUESTING" && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 font-bold uppercase text-[10px] tracking-widest max-w-sm mx-auto text-center leading-relaxed">
                      ⏳ Pending Treasury Evaluation. Payment options will be enabled once evaluated by the staff.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stepper Navigation Buttons */}
            {activeTab === "apply" && currentStep !== "EVALUATION" && (
              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center shrink-0">
                <button
                  onClick={() => {
                    if (currentStep === "STATUS") {
                      setActiveTab("history");
                    } else {
                      handleBack();
                    }
                  }}
                  disabled={currentStep === "STATUS" && existingApplications.length === 0}
                  className={cn(
                    "px-6 py-4 rounded-xl border border-slate-200 font-bold uppercase tracking-wider text-slate-500 transition-all flex items-center gap-2 cursor-pointer",
                    (currentStep === "STATUS" && existingApplications.length === 0) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-50"
                  )}
                >
                  <ChevronLeft size={16} />
                  {currentStep === "STATUS" ? "Back to List" : "Prev"}
                </button>

                {currentStep === "SUBMIT" ? (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-4 bg-theme-primary hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-theme-primary/20 flex items-center gap-2"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                    <CheckCircle2 size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="px-8 py-4 bg-theme-primary hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-theme-primary/20 flex items-center gap-2"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

      {/* Reusable QR Handoff Modal */}
      <SecureQrUploadModal
        isOpen={isHandoffOpen}
        onClose={() => { setIsHandoffOpen(false); setHandoffToken(""); }}
        qrCode={handoffQrCode}
        expiresAt={handoffExpiresAt}
        slotLabel={getHandoffSlotLabel()}
      />

      {/* Privacy modal */}
      <PrivacyTermsModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} onAccept={() => setPrivacyAccepted(true)} themeColor = "var(--primary-theme)" />



      {/* Viewer Modal */}
      <DocumentViewerModal isOpen={viewerOpen} onClose={() => setViewerOpen(false)} file={null} fileUrl={viewerUrl} title={viewerTitle} />

    </div>
  );
}
