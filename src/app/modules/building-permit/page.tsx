/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element, @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import PaymentModal, { CheckoutDetails } from "@/components/shared/PaymentModal";
import { compressImage } from "@/lib/image-compression";
import lguConfig from "@/lgu.config.json";
import {
  Book,
  CheckCircle,
  ClipboardList,
  FileSignature,
  FileText,
  Home,
  CreditCard,
  Landmark,
  MapPin,
  PenTool,
  Ruler,
  Scroll,
  ShieldCheck,
  UploadCloud,
  User,
  Users,
  Wallet,
  Zap,
  AlertCircle,
  CalendarDays,
  Clock,
  FileWarning,
  Building2,
  CheckCircle2,
  Upload,
  Hourglass,
  Receipt,
  Check,
  UserCheck,
  Handshake,
  QrCode
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  submitBuildingPermit,
  saveTransactionSignature,
  getExistingBuildingPermits,
  resubmitBuildingPermit,
  saveBuildingPermitCheckoutDetails,
  reconcileBuildingPermitPayment,
  submitClearancesForReviewAction,
  cancelTransaction,
  saveBfpClearanceProofAction,
  saveZoningClearanceProofAction,
  getCurrentUserResident,
  getBarangayNames,
  getSecureUploadUrlAction
} from "./actions";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";


const STEPS = [
  { id: "GUIDE", label: "Guide", icon: ClipboardList },
  { id: "PROFILE", label: "Profile", icon: User },
  { id: "DOCUMENTS", label: "Upload", icon: Upload },
  { id: "EVALUATION", label: "Evaluation", icon: Building2 },
  { id: "TREASURY", label: "Treasury & Zoning", icon: Landmark },
  { id: "SUBMIT", label: "Submit", icon: CheckCircle2 },
];

const OCCUPANCY_CATEGORIES = [
  "Residential",
  "Commercial",
  "Industrial",
  "Institutional",
  "Agricultural",
  "Street Furniture, Landscaping & Signboards",
  "Other Construction"
] as const;

const OCCUPANCY_OPTIONS: Record<string, { label: string; code: string }[]> = {
  "Residential": [
    { label: "Single", code: "11" },
    { label: "Duplex", code: "12" },
    { label: "Rowhouse / Accessoria", code: "13" },
    { label: "Others (Specify)", code: "10" }
  ],
  "Commercial": [
    { label: "Bank", code: "21" },
    { label: "Store", code: "22" },
    { label: "Hotel/Motel, etc.", code: "23" },
    { label: "Office Condominium/Business Office Building", code: "24" },
    { label: "Restaurant etc.", code: "25" },
    { label: "Shop (e.g. Dress Shop, Tailoring Shop, Barber Shop etc.)", code: "26" },
    { label: "Gasoline Station", code: "27" },
    { label: "Market", code: "28" },
    { label: "Dormitory or Other Lodging House", code: "29" },
    { label: "Others (Specify)", code: "20" }
  ],
  "Industrial": [
    { label: "Factory/Plant", code: "31" },
    { label: "Repair Shop, Machine Shop", code: "32" },
    { label: "Refinery", code: "33" },
    { label: "Printing Press", code: "34" },
    { label: "Warehouse", code: "35" },
    { label: "Others (Specify)", code: "30" }
  ],
  "Institutional": [
    { label: "School", code: "41" },
    { label: "Church and other religious structures", code: "42" },
    { label: "Hospital or similar structures", code: "43" },
    { label: "Welfare and charitable structures", code: "44" },
    { label: "Theater, Auditorium, Gymnasium, Court", code: "45" },
    { label: "Others (Specify)", code: "40" }
  ],
  "Agricultural": [
    { label: "Barn(s), Poultry House(s), etc.", code: "51" },
    { label: "Grain Mill", code: "52" },
    { label: "Others (Specify)", code: "50" }
  ],
  "Street Furniture, Landscaping & Signboards": [
    { label: "Parks, Plazas, Monuments, Pools, Plant Boxes etc.", code: "71" },
    { label: "Sidewalks, Promenades, Terraces, Lamposts, Electric Poles, Telephone Poles, etc.", code: "72" },
    { label: "Outdoor Ads, Signboard, etc.", code: "73" },
    { label: "Fence Enclosure", code: "74" }
  ],
  "Other Construction": [
    { label: "Specify", code: "60" }
  ]
};

function parseDescriptionOfWork(desc: string) {
  const result = {
    newConstruction: false,
    addition: false,
    additionText: "",
    repair: false,
    repairText: "",
    renovation: false,
    renovationText: "",
    demolition: false,
    demolitionText: "",
    others1: false,
    others1Text1: "",
    others1Text2: "",
    others2: false,
    others2Text1: "",
    others2Text2: "",
    legacyText: "",
  };

  if (!desc) return result;

  if (!desc.includes("NEW CONSTRUCTION") && !desc.includes("ADDITION:") && !desc.includes("REPAIR:") && !desc.includes("RENOVATION:") && !desc.includes("DEMOLITION:") && !desc.includes("OTHERS:")) {
    result.legacyText = desc;
    return result;
  }

  if (desc.includes("NEW CONSTRUCTION")) result.newConstruction = true;

  const addMatch = desc.match(/ADDITION:\s*([^;]+)/);
  if (addMatch) {
    result.addition = true;
    result.additionText = addMatch[1].trim();
  }

  const repairMatch = desc.match(/REPAIR:\s*([^;]+)/);
  if (repairMatch) {
    result.repair = true;
    result.repairText = repairMatch[1].trim();
  }

  const renoMatch = desc.match(/RENOVATION:\s*([^;]+)/);
  if (renoMatch) {
    result.renovation = true;
    result.renovationText = renoMatch[1].trim();
  }

  const demoMatch = desc.match(/DEMOLITION:\s*([^;]+)/);
  if (demoMatch) {
    result.demolition = true;
    result.demolitionText = demoMatch[1].trim();
  }

  const othersMatches = [...desc.matchAll(/OTHERS:\s*([^;]+)/g)];
  if (othersMatches.length > 0) {
    const processOthers = (matchStr: string) => {
      const parts = matchStr.split(" OF ");
      return {
        text1: parts[0]?.trim() || "",
        text2: parts[1]?.trim() || ""
      };
    };

    if (othersMatches[0]) {
      result.others1 = true;
      const res = processOthers(othersMatches[0][1]);
      result.others1Text1 = res.text1;
      result.others1Text2 = res.text2;
    }
    if (othersMatches[1]) {
      result.others2 = true;
      const res = processOthers(othersMatches[1][1]);
      result.others2Text1 = res.text1;
      result.others2Text2 = res.text2;
    }
  }

  return result;
}

function parseOccupancyUse(occupancyUse: string) {
  let category = "Residential";
  let subs: string[] = [];
  let specify = "";

  if (!occupancyUse) {
    return { category, subs, specify };
  }

  if (occupancyUse.startsWith("Other Construction - ")) {
    return {
      category: "Other Construction",
      subs: ["Specify"],
      specify: occupancyUse.replace("Other Construction - ", ""),
    };
  } else if (occupancyUse === "Other Construction") {
    return { category: "Other Construction", subs: ["Specify"], specify: "" };
  }

  const parts = occupancyUse.split(": ");
  if (parts.length >= 2) {
    category = parts[0];
    let rest = parts.slice(1).join(": ");

    const openParenIndex = rest.lastIndexOf(" (");
    const closeParenIndex = rest.lastIndexOf(")");
    if (openParenIndex !== -1 && closeParenIndex === rest.length - 1 && openParenIndex < closeParenIndex) {
      specify = rest.substring(openParenIndex + 2, closeParenIndex);
      rest = rest.substring(0, openParenIndex);
    }

    subs = rest.split(", ").map(s => s.trim()).filter(Boolean);
  } else {
    const matchedCategory = OCCUPANCY_CATEGORIES.find(c => c.toLowerCase() === occupancyUse.toLowerCase());
    if (matchedCategory) {
      category = matchedCategory;
    } else {
      if (occupancyUse.includes("Residential (Single Family)")) {
        category = "Residential";
        subs = ["Single"];
      } else if (occupancyUse.includes("Residential (Multi-Family)")) {
        category = "Residential";
        subs = ["Duplex"];
      } else if (occupancyUse.includes("Commercial - Retail")) {
        category = "Commercial";
        subs = ["Store"];
      } else if (occupancyUse.includes("Commercial - Office")) {
        category = "Commercial";
        subs = ["Office Condominium/Business Office Building"];
      } else if (occupancyUse.includes("Commercial - Hotel/Hospitality")) {
        category = "Commercial";
        subs = ["Hotel/Motel, etc."];
      } else if (occupancyUse.includes("Industrial")) {
        category = "Industrial";
        subs = ["Factory/Plant"];
      } else if (occupancyUse.includes("Agricultural")) {
        category = "Agricultural";
        subs = ["Barn(s), Poultry House(s), etc."];
      } else if (occupancyUse.includes("Institutional")) {
        category = "Institutional";
        subs = ["School"];
      } else {
        category = "Other Construction";
        subs = ["Specify"];
        specify = occupancyUse;
      }
    }
  }

  return { category, subs, specify };
}

function formatInspectionDate(value?: string) {
  if (!value) return "To be announced";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const EVALUATION_PHASE_STATUSES = [
  "FOR_REQUESTING",
  "FOR_INSPECTION",
  "FOR_REINSPECTION",
  "FOR_REVISION",
  "EVALUATED",
  "REJECTED",
  "CANCELLED",
];
const TREASURY_PHASE_STATUSES = ["UNPAID", "PAID", "TREASURY_REVISION", "FOR_PROCESSING"];
const RELEASE_PHASE_STATUSES = ["FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"];
const hasTreasuryClearances = (app: any) =>
  Boolean(app?.additionalData?.bfpClearanceUrl) &&
  Boolean(app?.additionalData?.zoningClearanceUrl);

function getApplicationPhase(status?: string) {
  if (status && RELEASE_PHASE_STATUSES.includes(status)) return { step: "SUBMIT", maxStep: 5 };
  if (status && TREASURY_PHASE_STATUSES.includes(status)) return { step: "TREASURY", maxStep: 4 };
  if (status && EVALUATION_PHASE_STATUSES.includes(status)) return { step: "EVALUATION", maxStep: 3 };
  return { step: "EVALUATION", maxStep: 3 };
}

export default function BuildingPermitPage() {
  const router = useRouter();
  const pageScrollRef = React.useRef<HTMLDivElement>(null);
  const handoffStorageKey = (slot: string) => `lgu_kiosk_building_permit_handoff_${slot}`;
  const [currentStep, setCurrentStep] = useState("GUIDE");
  const [hasReadGuide, setHasReadGuide] = useState(true);
  const [existingApplications, setExistingApplications] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [residentData, setResidentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevision, setIsRevision] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tctHandoffUrl, setTctHandoffUrl] = useState<string | null>(null);
  const [tctHandoffFileName, setTctHandoffFileName] = useState("");
  const [handoffToken, setHandoffToken] = useState("");
  const [handoffQrCode, setHandoffQrCode] = useState("");
  const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
  const [handoffSessionSlot, setHandoffSessionSlot] = useState<"tct" | "documents" | "bfp" | "zoning">("tct");
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerFile, setViewerFile] = useState<File | null>(null);

  // Barangay list fetched from BarangayInfo table
  const [barangayNames, setBarangayNames] = useState<string[]>([]);
  useEffect(() => {
    getBarangayNames().then((res) => {
      if (res.success && res.data.length > 0) {
        setBarangayNames(res.data);
      }
    });
  }, []);

  // Kiosk-compatible client toast banner state
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);
  
  // Custom toast dispatcher matching standard toast interface
  const showToast = (message: string, options?: { type?: "success" | "error" | "info" | "warning"; id?: string }) => {
    setToastMessage({
      type: options?.type || "info",
      message: message
    });
    // Auto clear after 4 seconds
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return options?.id || Math.random().toString();
  };

  const toast = {
    success: (msg: string, opts?: any) => showToast(msg, { ...opts, type: "success" }),
    error: (msg: string, opts?: any) => showToast(msg, { ...opts, type: "error" }),
    info: (msg: string, opts?: any) => showToast(msg, { ...opts, type: "info" }),
    warning: (msg: string, opts?: any) => showToast(msg, { ...opts, type: "warning" }),
    loading: (msg: string, opts?: any) => showToast(msg, { ...opts, type: "info" })
  };

  const isEditable = !selectedApplication || isRevision;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(handoffStorageKey("documents"));
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { token: string; qrCode: string; expiresAt: number; slot: string };
      if (!parsed.token || !parsed.expiresAt || parsed.expiresAt <= Date.now() || parsed.slot !== "documents") {
        window.sessionStorage.removeItem(handoffStorageKey("documents"));
        return;
      }
      setHandoffToken(parsed.token);
      setHandoffQrCode(parsed.qrCode || "");
      setHandoffExpiresAt(parsed.expiresAt);
      setHandoffSessionSlot("documents");
    } catch {
      window.sessionStorage.removeItem(handoffStorageKey("documents"));
    }
  }, []);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [idChoice, setIdChoice] = useState<"PROFILE" | "UPLOAD">("PROFILE");
  const [activeDocTab, setActiveDocTab] = useState<"REQUIREMENTS" | "PERMITS">("REQUIREMENTS");
  const [uploadedRequirements, setUploadedRequirements] = useState<Record<number, File>>({});
  const [uploadedPermits, setUploadedPermits] = useState<Record<number, File>>({});
  const [handoffDocuments, setHandoffDocuments] = useState<Record<string, { fileName: string; url: string }>>({});
  const [formData, setFormData] = useState({
    descriptionOfWork: "",
    scopeNewConstruction: false,
    scopeAddition: false,
    scopeAdditionText: "",
    scopeRepair: false,
    scopeRepairText: "",
    scopeRenovation: false,
    scopeRenovationText: "",
    scopeDemolition: false,
    scopeDemolitionText: "",
    scopeOthers1: false,
    scopeOthers1Text1: "",
    scopeOthers1Text2: "",
    scopeOthers2: false,
    scopeOthers2Text1: "",
    scopeOthers2Text2: "",
    descriptionOfWorkLegacyText: "",
    occupancyCategory: "",
    selectedSubOccupancies: [] as string[],
    subOccupancyOthersSpecify: "",
    estimatedCost: "",
    locationOfConstruction: "",
    locHouseNo: "",
    locStreet: "",
    locBarangay: "",
    totalFloors: "",
    isLotOwner: "",
    newIdFile: null as File | null,
    tctFile: null as File | null,
    occupancyUse: "",
    otherOccupancyUse: "",
  });
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const hasTctFile = !!(
    formData.tctFile ||
    tctHandoffUrl ||
    selectedApplication?.additionalData?.documents?.tctFile ||
    (uploadedRequirements && uploadedRequirements[2]) ||
    selectedApplication?.additionalData?.documents?.req_2
  );

  const [maxStepIdx, setMaxStepIdx] = useState(0);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  useEffect(() => {
    if (selectedApplication && !isRevision) return;
    const currentStepIdx = STEPS.findIndex(s => s.id === currentStep);
    if (currentStepIdx > maxStepIdx) {
      setMaxStepIdx(currentStepIdx);
    }
  }, [currentStep, isRevision, maxStepIdx, selectedApplication]);

  useEffect(() => {
    if (!selectedApplication || isRevision) return;
    const phase = getApplicationPhase(selectedApplication.status);
    setMaxStepIdx(phase.maxStep);
    setCurrentStep(phase.step);
  }, [isRevision, selectedApplication]);

  useEffect(() => {
    pageScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

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
          if (result.sessionSlot === "tct" && files[0]) {
            setTctHandoffUrl(files[0].url);
            setTctHandoffFileName(files[0].fileName || "TCT document");
            setIsHandoffOpen(false);
            setHandoffToken("");
            toast.success("TCT passed malware scanning and was received from your phone.");
          } else if (result.sessionSlot === "documents") {
            setHandoffDocuments(previous => ({
              ...previous,
              ...Object.fromEntries(
                files.map((file: { slot: string; fileName: string; url: string }) => [
                  file.slot,
                  { fileName: file.fileName, url: file.url }
                ])
              )
            }));

            const isAffidavitOfConsentRequired = formData.isLotOwner === "No";
            const hasMultipleFloors = parseInt(formData.totalFloors || "0", 10) > 1;
            const requiredRequirementSlots = Array.from({ length: 25 }, (_, index) => index)
              .filter(index => {
                if ([2, 5, 8, 13, 14].includes(index)) return false;
                if (!isAffidavitOfConsentRequired && [7, 10, 11, 12, 13, 14].includes(index)) return false;
                if (isAffidavitOfConsentRequired && [21, 22].includes(index)) return false;
                if (!hasMultipleFloors && [23, 24].includes(index)) return false;
                return true;
              })
              .map(index => `req_${index}`);
            const requiredPermitSlots = Array.from({ length: 12 }, (_, index) => index)
              .map(index => `permit_${index}`);
            const uploadedSlots = new Set([
              ...Object.keys(selectedApplication?.additionalData?.documents || {}),
              ...Object.keys(uploadedRequirements).map(index => `req_${index}`),
              ...Object.keys(uploadedPermits).map(index => `permit_${index}`),
              ...files.map((file: { slot: string }) => file.slot),
            ]);
            const allRequiredFilesUploaded = [
              ...requiredRequirementSlots,
              ...requiredPermitSlots,
            ].every(slot => uploadedSlots.has(slot));

            if (allRequiredFilesUploaded) {
              setIsHandoffOpen(false);
              setHandoffToken("");
              setHandoffQrCode("");
              setHandoffExpiresAt(0);
              toast.success("All required documents and permits were received. QR upload closed automatically.");
            }
          } else if ((result.sessionSlot === "bfp" || result.sessionSlot === "zoning") && files[0] && selectedApplication && residentData) {
            const userId = residentData.userId || residentData.id;
            const saveResult = result.sessionSlot === "bfp"
              ? await saveBfpClearanceProofAction(selectedApplication.id, files[0].url, userId)
              : await saveZoningClearanceProofAction(selectedApplication.id, files[0].url, userId);
            if (!saveResult.success) {
              toast.error(saveResult.error || "Failed to save clearance proof.");
              return;
            }
            const applications = await getExistingBuildingPermits(userId);
            if (applications.success && applications.data) {
              setExistingApplications(applications.data);
              const updated = applications.data.find((application: any) => application.id === selectedApplication.id);
              if (updated) setSelectedApplication(updated);
            }
            setIsHandoffOpen(false);
            setHandoffToken("");
            toast.success(`${result.sessionSlot === "bfp" ? "BFP" : "Zoning"} clearance passed malware scanning and was received.`);
          }
        } else if (!response.ok) {
          setIsHandoffOpen(false);
          setHandoffToken("");
          toast.error(result.error || "The QR upload session expired.");
        }
      } catch (error) {
        console.error("Upload handoff polling error:", error);
      }
    }, 800);
    return () => window.clearInterval(poll);
  // toast is intentionally omitted because it is recreated by the legacy page on each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffToken]);

  const startHandoff = async (slot: "tct" | "documents" | "bfp" | "zoning") => {
    if (isCreatingHandoff) return;
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(handoffStorageKey(slot));
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { token: string; qrCode: string; expiresAt: number; slot: string };
          if (parsed.token && parsed.expiresAt > Date.now() && parsed.slot === slot) {
            setHandoffToken(parsed.token);
            setHandoffSessionSlot(slot);
            setHandoffQrCode(parsed.qrCode || "");
            setHandoffExpiresAt(parsed.expiresAt);
            setIsHandoffOpen(true);
            return;
          }
          window.sessionStorage.removeItem(handoffStorageKey(slot));
        } catch {
          window.sessionStorage.removeItem(handoffStorageKey(slot));
        }
      }
    }
    setIsCreatingHandoff(true);
    try {
      const savedResident = typeof window !== "undefined" ? sessionStorage.getItem("active_resident") : null;
      const activeResident = residentData || (savedResident ? JSON.parse(savedResident) : null);
      const userId = activeResident?.userId || activeResident?.id;
      if (!userId) throw new Error("Unable to determine resident for QR upload.");
      const response = await fetch("/api/upload-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          slot,
          context: slot === "documents" ? {
            isLotOwner: formData.isLotOwner === "Yes",
            totalFloors: Number(formData.totalFloors || 0),
          } : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create QR upload.");
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
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          handoffStorageKey(slot),
          JSON.stringify({ token: result.token, qrCode: qrDataUrl, expiresAt: result.expiresAt, slot })
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create QR upload.");
    } finally {
      setIsCreatingHandoff(false);
    }
  };

  const startTctHandoff = () => startHandoff("tct");
  const startDocumentsHandoff = () => startHandoff("documents");
  const startBfpHandoff = () => startHandoff("bfp");
  const startZoningHandoff = () => startHandoff("zoning");

  const isAffidavitOfConsentRequired = formData.isLotOwner === "No";
  const hasMultipleFloors = parseInt(formData.totalFloors || "0", 10) > 1;
  const missingBuildingPermitFields = showValidationErrors ? [
    ...((!formData.scopeNewConstruction &&
      !formData.scopeAddition &&
      !formData.scopeRepair &&
      !formData.scopeRenovation &&
      !formData.scopeOthers1 &&
      !formData.descriptionOfWorkLegacyText) ? ["Scope of Work"] : []),
    ...(formData.scopeAddition && !formData.scopeAdditionText ? ["Addition of"] : []),
    ...(formData.scopeRepair && !formData.scopeRepairText ? ["Repair of"] : []),
    ...(formData.scopeRenovation && !formData.scopeRenovationText ? ["Renovation of"] : []),
    ...(formData.scopeOthers1 && (!formData.scopeOthers1Text1 || !formData.scopeOthers1Text2) ? ["Others (Specify)"] : []),
    ...((!formData.estimatedCost || Number(formData.estimatedCost) <= 0) ? ["Estimated cost of the proposal"] : []),
    ...((!formData.locHouseNo || !formData.locStreet || !formData.locBarangay) ? ["Location of Construction"] : []),
    ...((!formData.totalFloors || Number(formData.totalFloors) <= 0) ? ["Total Floor(s)"] : []),
    ...((!formData.isLotOwner) ? ["Is the applicant the owner of the lot?"] : []),
    ...((!formData.occupancyCategory) ? ["Occupancy category"] : []),
    ...((formData.occupancyCategory && formData.occupancyCategory !== "Other Construction" && formData.selectedSubOccupancies.length === 0) ? ["Occupancy sub-type"] : []),
    ...((formData.occupancyCategory === "Other Construction" && !formData.subOccupancyOthersSpecify) ? ["Occupancy details"] : []),
    ...((idChoice === "UPLOAD" && !formData.newIdFile && !selectedApplication?.additionalData?.documents?.newIdFile) ? ["Valid ID upload"] : []),
    ...((!hasTctFile) ? ["Certified true copy of the TCT"] : []),
  ] : [];
  const requiredRequirementIndexes = Array.from({ length: 25 }, (_, index) => index)
    .filter(index => {
      if ([2, 5, 8, 13, 14].includes(index)) return false;
      if (!isAffidavitOfConsentRequired && [7, 10, 11, 12, 13, 14].includes(index)) return false;
      if (isAffidavitOfConsentRequired && [21, 22].includes(index)) return false;
      if (!hasMultipleFloors && [23, 24].includes(index)) return false;
      return true;
    });
  const requiredRequirementsCount = requiredRequirementIndexes.length;
  const uploadedRequirementKeys = new Set([
    ...Object.keys(selectedApplication?.additionalData?.documents || {}).filter(k => k.startsWith("req_")),
    ...Object.keys(uploadedRequirements).map(k => `req_${k}`),
    ...Object.keys(handoffDocuments).filter(k => k.startsWith("req_"))
  ]);
  const requirementsProgress = requiredRequirementIndexes
    .filter(index => uploadedRequirementKeys.has(`req_${index}`)).length;

  const requiredPermitIndexes: number[] = [];
  const requiredPermitsCount = 4;
  const uploadedPermitKeys = new Set([
    ...Object.keys(selectedApplication?.additionalData?.documents || {}).filter(k => k.startsWith("permit_")),
    ...Object.keys(uploadedPermits).map(k => `permit_${k}`),
    ...Object.keys(handoffDocuments).filter(k => k.startsWith("permit_"))
  ]);
  const permitsProgress = uploadedPermitKeys.size;



  const documentRequirementsList = [
    "Barangay Clearance/Certification",
    "Tax Declaration",
    "Land Title",
    "Community Tax Certificate",
    "Latest Tax Receipts",
    "Adjoining Owners Confirmation",
    "Locational Clearance",
    "Affidavit of Consent",
    "Affidavit of Adjoining Owners",
    "Signed & Sealed Plans",
    "Notarized Deed of Sale/Lot Locational Plan/ Contract of Lease",
    "Cedula of Lot Owner",
    "ID of Lot Owner",
    "Death Certificate of Lot Owner (Optional)",
    "Birth Certificate of Heirs of Deceased Owner (Optional)",
    "Valid Licenses (PRC I.D.) of Involved Professionals",
    "Duly Notarized Estimated Value of Building/Structure",
    "Duly Notarized Technical Specification",
    "Construction Safety and Health Program From DOLE",
    "Construction Logbook duly signed by Civil Engineer/Architect in-charge of Construction",
    "Affidavit of Undertaking",
    "Cedula of Applicant",
    "ID of applicant with 3 signatures",
    "Structural Analysis and Design",
    "Soil Boring Test"
  ];

  const permitTypesList = [
    "Electrical Documents",
    "Plumbing Documents",
    "Sanitary Documents",
    "Excavation & Ground Preparation Documents",
    "Fencing Documents",
    "Scaffolding Documents",
    "Mechanical Documents",
    "Architectural Documents",
    "Civil/Structural Documents",
    "Electronics Documents",
    "Geodetic Documents",
    "Fire Protection Plan"
  ];

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
        const query = new URLSearchParams(window.location.search);
        const paymentResult = query.get("payment");
        const returnedTransactionId = query.get("transactionId");

        if (paymentResult === "success" && returnedTransactionId) {
          const verification = await reconcileBuildingPermitPayment(returnedTransactionId, userId);
          if (verification.paid) {
            toast.success("Payment verified successfully.");
          } else if (verification.success) {
            toast.loading("Payment is still being confirmed. Please wait a moment.");
          } else {
            toast.error(verification.error || "Payment verification failed.");
          }
          window.history.replaceState({}, "", "/modules/building-permit");
        } else if (paymentResult === "cancelled") {
          toast.error("Payment checkout was cancelled.");
          window.history.replaceState({}, "", "/modules/building-permit");
        }

        const [res, permitsRes] = await Promise.all([
          getCurrentUserResident(userId),
          getExistingBuildingPermits(userId)
        ]);

        if (res.success && res.data) {
          setResidentData(res.data);
        } else {
          setResidentData(resident);
        }
        if (permitsRes.success && permitsRes.data.length > 0) {
          setExistingApplications(permitsRes.data);
          const returnedApplication = returnedTransactionId
            ? permitsRes.data.find((app: any) => app.id === returnedTransactionId)
            : null;
          if (returnedApplication) {
            setSelectedApplication(returnedApplication);
            const phase = getApplicationPhase(returnedApplication.status);
            setMaxStepIdx(phase.maxStep);
            setCurrentStep(phase.step);
            return;
          }
          const hasActive = permitsRes.data.some((app: any) =>
            !["RELEASED", "REJECTED", "DELIVERED", "CANCELLED"].includes(app.status) && !app.isCancelled
          );
          if (hasActive) {
            setCurrentStep("EXISTING");
          } else {
            setCurrentStep("EXISTING");
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
    // toast is a local UI helper and is intentionally not an effect dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (selectedApplication) {
      const addData = selectedApplication.additionalData as any || {};
      const parsedOccupancy = parseOccupancyUse(addData.occupancyUse || "");
      const parsedDesc = parseDescriptionOfWork(addData.descriptionOfWork || "");
      setFormData({
        descriptionOfWork: addData.descriptionOfWork || "",
        scopeNewConstruction: parsedDesc.newConstruction,
        scopeAddition: parsedDesc.addition,
        scopeAdditionText: parsedDesc.additionText,
        scopeRepair: parsedDesc.repair,
        scopeRepairText: parsedDesc.repairText,
        scopeRenovation: parsedDesc.renovation,
        scopeRenovationText: parsedDesc.renovationText,
        scopeDemolition: parsedDesc.demolition,
        scopeDemolitionText: parsedDesc.demolitionText,
        scopeOthers1: parsedDesc.others1,
        scopeOthers1Text1: parsedDesc.others1Text1,
        scopeOthers1Text2: parsedDesc.others1Text2,
        scopeOthers2: parsedDesc.others2,
        scopeOthers2Text1: parsedDesc.others2Text1,
        scopeOthers2Text2: parsedDesc.others2Text2,
        descriptionOfWorkLegacyText: parsedDesc.legacyText,
        occupancyCategory: parsedOccupancy.category,
        selectedSubOccupancies: parsedOccupancy.subs,
        subOccupancyOthersSpecify: parsedOccupancy.specify,
        estimatedCost: addData.estimatedCost || "",
        locationOfConstruction: addData.locationOfConstruction || "",
        locHouseNo: addData.houseNumber || "",
        locStreet: addData.street || "",
        locBarangay: addData.barangay || "",
        totalFloors: addData.totalFloors ? String(addData.totalFloors) : "",
        isLotOwner: addData.isLotOwner || "",
        newIdFile: null,
        tctFile: null,
        occupancyUse: addData.occupancyUse || "",
        otherOccupancyUse: parsedOccupancy.specify,
      });
      if (addData.signature) {
        setSignatureData(addData.signature);
      }
      if (addData.documents?.newIdFile) {
        setIdChoice("UPLOAD");
      } else {
        setIdChoice("PROFILE");
      }
    }
  }, [selectedApplication]);

  const handleSaveCheckoutDetails = async (details: CheckoutDetails) => {
    if (!selectedApplication || !residentData) return false;
    const userId = residentData.userId || residentData.id;
    setIsSubmitting(true);
    try {
      const res = await saveBuildingPermitCheckoutDetails(selectedApplication.id, userId, details);
      if (res.success) {
        return true;
      }
      toast.error(res.error || "Failed to save payment details.");
      return false;
    } catch {
      toast.error("An error occurred while preparing secure checkout.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintDocument = async (documentUrl: string, title: string) => {
    try {
      toast.loading(`Preparing ${title} for printing...`);
      const response = await fetch(documentUrl);
      if (!response.ok) throw new Error("Unable to load document");
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
        window.setTimeout(() => {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          window.setTimeout(() => {
            printFrame.remove();
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        }, 350);
      };
      document.body.appendChild(printFrame);
      toast.success(`${title} is ready to print.`);
    } catch (error) {
      console.error("Print document error:", error);
      toast.error(`Unable to print ${title}.`);
    }
  };

  const requirements = [
    {
      id: 1,
      title: "Plans duly signed & sealed by licensed professional",
      office: "Licensed Professionals",
      icon: <Ruler className="w-5 h-5 text-slate-500" />,
      steps: [
        "Hire a licensed Architect for architectural plans and licensed Civil/Structural Engineer for structural plans.",
        "Provide them with your lot survey, dimensions, and design preferences.",
        "The professional will prepare the plans based on the National Building Code standards.",
        "Ensure the plans are signed and have the official PRC seal (dry seal or digital).",
        "Request multiple copies (usually 3 sets) for submission to different offices."
      ],
      infoType: "tip",
      infoLabel: "Professional Fee",
      infoText: "Varies based on floor area and complexity. Typically 3-5% of project cost."
    },
    {
      id: 2,
      title: "Certified true copy of Tax Declaration",
      office: "Assessor's Office",
      icon: <FileText className="w-5 h-5 text-slate-400" />,
      steps: [
        "Go to the Municipal Assessor's Office at the Municipal Hall.",
        "Request for a \"Certified True Copy of Tax Declaration\" for your property.",
        "Provide the Tax Declaration number or the lot owner's name and location.",
        "Pay the certification fee at the Treasury Office (usually ₱50-₱100).",
        "Return to Assessor's Office with official receipt to claim the certified document."
      ],
      infoType: "time",
      infoLabel: "Processing time",
      infoText: "1-2 hours to 1 day. Bring a valid ID."
    },
    {
      id: 3,
      title: "Xerox copy of Land Title",
      office: "Register of Deeds",
      icon: <Home className="w-5 h-5 text-orange-400" />,
      steps: [
        "Go to the Registry of Deeds (usually located at the Provincial Capitol or nearby city).",
        "Fill out a request form for a certified true copy of your Transfer Certificate of Title (TCT).",
        "Provide the TCT number and lot details.",
        "Pay the reproduction and certification fee (₱100-₱200 depending on pages).",
        "Claim the certified true copy (processing may take 1-3 days)."
      ],
      infoType: "note",
      infoLabel: "Note",
      infoText: "If you only have the owner's copy, you can have it photocopied and notarized as a substitute."
    },
    {
      id: 4,
      title: "Community Tax Certificate (Cedula)",
      office: "Treasury Office",
      icon: <ClipboardList className="w-5 h-5 text-red-400" />,
      steps: [
        "Go to the Municipal Treasury Office at the Municipal Hall.",
        "Request for a Community Tax Certificate (Cedula).",
        "Provide your name, address, and declare your annual income (for tax classification).",
        "Pay the community tax (₱5.00 basic + ₱1.00 for every ₱1,000 income, minimum ₱10-₱20).",
        "Receive your Cedula immediately."
      ],
      infoType: "time",
      infoLabel: "Processing time",
      infoText: "5-10 minutes. Valid for one calendar year."
    },
    {
      id: 5,
      title: "Latest Tax receipts (Real Property Tax)",
      office: "Treasury Office",
      icon: <Wallet className="w-5 h-5 text-amber-500" />,
      steps: [
        "Go to the Municipal Treasury Office, Tax Payment Section.",
        "Request for your real property tax account details using your Tax Declaration number.",
        "Pay any outstanding real property tax for the current year.",
        "Secure the Official Receipt as proof of payment.",
        "Request for a Certified True Copy of Tax Clearance if needed (additional fee)."
      ],
      infoType: "important",
      infoLabel: "Important",
      infoText: "Taxes must be fully paid for the current year before permit issuance."
    },
    {
      id: 6,
      title: "Electrical & Sanitary permit",
      office: "Municipal Health Office",
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      steps: [
        "Go to the Municipal Health Office (MHO) at the Municipal Hall.",
        "Submit your Electrical and Sanitary/Plumbing plans (already signed by licensed professionals).",
        "Fill out the application forms for Electrical and Sanitary permits.",
        "The Health Officer/Sanitary Inspector will review the plans (checking for proper sewage, water lines).",
        "Pay the corresponding fees at the Treasury Office and return the receipt to MHO.",
        "Claim the approved Electrical and Sanitary permits."
      ],
      infoType: "note",
      infoLabel: "Sanitary Fee",
      infoText: "Based on number of plumbing fixtures. Electrical fee based on load/computation."
    },
    {
      id: 7,
      title: "Confirmation of adjoining lot owners",
      office: "Adjoining Lot Owners",
      icon: <Users className="w-5 h-5 text-blue-500" />,
      steps: [
        "Identify all adjacent property owners (left, right, rear, and front if applicable).",
        "Prepare a document (Confirmation/Affidavit of Adjoining Owners) stating they have no objection to your construction.",
        "Visit each adjoining owner personally to explain your planned construction.",
        "Have them sign the document in the presence of a notary public or barangay official.",
        "If any owner is unavailable or refuses, you may need to secure a barangay certification of posting instead."
      ],
    },
    {
      id: 8,
      title: "Certification from Barangay Captain",
      office: "Barangay Hall",
      icon: <Scroll className="w-5 h-5 text-stone-500" />,
      steps: [
        `Go to the Barangay Hall where your property is located (e.g., Brgy. ${lguConfig.barangays[0]}).`,
        "Request for a \"Barangay Clearance for Building Construction\" or \"Certification\".",
        "Fill out the application form and provide details of your construction project.",
        "Pay the barangay clearance fee (usually ₱50-₱100 depending on barangay ordinance).",
        "The Barangay Captain or Secretary will issue the certification after verification."
      ],
      infoType: "time",
      infoLabel: "Validity",
      infoText: "Usually valid for 30-60 days. Process within 1 day."
    },
    {
      id: 9,
      title: "Application for locational clearance",
      office: "Zoning Office / MPDC",
      icon: <MapPin className="w-5 h-5 text-red-500" />,
      steps: [
        "Go to the Municipal Planning & Development Coordinator (MPDC) / Zoning Office.",
        "Secure and fill out the Locational Clearance application form.",
        "Submit the following: lot plan, vicinity map, and proof of ownership.",
        "The Zoning Officer will check if your project is compliant with the Comprehensive Land Use Plan (CLUP) and zoning ordinance.",
        "Pay the zoning fee (varies based on floor area and classification).",
        "Claim the Locational Clearance (processing may take 2-5 days)."
      ],
      infoType: "note",
      infoLabel: "Note",
      infoText: "Commercial and industrial projects have stricter zoning requirements."
    },
    {
      id: 10,
      title: "2 Affidavits",
      office: "Notary Public",
      icon: <FileSignature className="w-5 h-5 text-slate-500" />,
      steps: [
        "Prepare the draft affidavits (usually Affidavit of Non-Tenancy and Affidavit of Undertaking).",
        "Look for a Notary Public near the Municipal Hall or in the town proper.",
        "Bring your valid ID and the draft affidavits.",
        "Sign the affidavits in the presence of the notary public.",
        "Pay the notarization fee (₱100-₱200 per affidavit)."
      ],
      infoType: "important",
      infoLabel: "Purpose",
      infoText: "Affidavit of Non-Tenancy declares no tenants will be displaced; Affidavit of Undertaking promises to comply with building rules."
    },
    {
      id: 11,
      title: "Affidavit of consent (if applicant is not the owner)",
      office: "Notary Public",
      icon: <PenTool className="w-5 h-5 text-slate-500" />,
      steps: [
        "The lot owner must prepare a document authorizing you (the applicant) to apply for a building permit.",
        "Go together with the owner to a Notary Public (or the owner can go alone with your name/details).",
        "The owner signs the Affidavit of Consent/Authority to Apply for Building Permit.",
        "The notary public notarizes the document after verifying the owner's identity.",
        "Pay the notarization fee (₱100-₱200). Secure the original notarized copy."
      ],
      infoType: "important",
      infoLabel: "Required if",
      infoText: "You are a tenant, lessee, or developer building on someone else's land."
    },
    {
      id: 12,
      title: "Affidavit of adjoining lot owners",
      office: "Adjoining Lot Owners / Notary",
      icon: <Handshake className="w-5 h-5 text-blue-500" />,
      steps: [
        "Similar to #7, but this is a formal sworn affidavit.",
        "Prepare an \"Affidavit of Adjoining Lot Owners\" stating they have no objection.",
        "Visit each adjoining owner and have them sign the affidavit.",
        "Bring the signed document to a Notary Public for notarization.",
        "The notary will administer oath and affix notarial seal."
      ],
      infoType: "note",
      infoLabel: "Legal weight",
      infoText: "A notarized affidavit is stronger evidence than a simple confirmation."
    },
    {
      id: 13,
      title: "BFP Clearance",
      office: "Bureau of Fire Protection",
      icon: <FileWarning className="w-5 h-5 text-red-600" />,
      steps: [
        "Go to the local Bureau of Fire Protection (BFP) office.",
        "Submit your building plans for fire safety evaluation.",
        "Pay the prescribed fire code fees.",
        "Wait for the issuance of the Fire Safety Evaluation Clearance (FSEC)."
      ],
      infoType: "important",
      infoLabel: "Mandatory",
      infoText: "Ensure building designs comply with the Fire Code of the Philippines."
    },
    {
      id: 14,
      title: "Zoning Clearance",
      office: "Zoning Office / MPDC",
      icon: <MapPin className="w-5 h-5 text-indigo-500" />,
      steps: [
        "Go to the Zoning Office or Municipal Planning & Development Coordinator (MPDC).",
        "Submit your lot plan, title, and building design.",
        "Pay the appropriate zoning fees.",
        "Secure the official Zoning Clearance confirming land use compliance."
      ],
      infoType: "time",
      infoLabel: "Processing time",
      infoText: "Takes 2-5 days depending on the classification of the project."
    }
  ];

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const confirmCancel = async () => {
    if (!selectedApplication || !residentData) return;
    const userId = residentData.userId || residentData.id;
    setIsCancelling(true);
    try {
      const res = await cancelTransaction(selectedApplication.id, userId);
      if (res.success) {
        toast.success("Application successfully cancelled.");

        const permitsRes = await getExistingBuildingPermits(userId);
        if (permitsRes.success) {
          setExistingApplications(permitsRes.data);
          const updatedApp = permitsRes.data.find((a: any) => a.id === selectedApplication.id);
          if (updatedApp) {
            setSelectedApplication(updatedApp);
          }
        }
      } else {
        toast.error(res.error || "Failed to cancel application.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while cancelling the application.");
    } finally {
      setIsCancelling(false);
    }
  };

  const dataURLtoFile = async (dataurl: string, filenameWithoutExt: string): Promise<File | null> => {
    try {
      const response = await fetch(dataurl);
      const blob = await response.blob();
      const ext = blob.type.split("/")[1] || "png";
      return new File([blob], `${filenameWithoutExt}.${ext}`, { type: blob.type || "image/png" });
    } catch (e) {
      console.error("Failed to convert dataURL to File:", e);
      return null;
    }
  };

  const uploadFileClientSide = async (file: File | null, folder: string, keyName: string) => {
    if (!file) return null;
    try {
      const uploadFile = file.type.startsWith("image/") ? await compressImage(file) : file;
      const userId = (selectedApplication?.residentSnapshot || residentData)?.userId || (selectedApplication?.residentSnapshot || residentData)?.id || "anonymous";
      const fileExt = file.name.split('.').pop() || 'bin';
      const cleanKeyName = keyName.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Get signed upload URL via server action
      const res = await getSecureUploadUrlAction(cleanKeyName, `building-permits/${folder}`, fileExt, userId);
      if (!res.success || !res.signedUrl || !res.publicUrl) {
        throw new Error(res.error || "Failed to generate secure upload destination");
      }

      // Upload file directly using the signed URL
      const uploadRes = await fetch(res.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": uploadFile.type
        },
        body: uploadFile
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload file to storage: ${uploadRes.statusText}`);
      }

      return res.publicUrl;
    } catch (err) {
      console.error(`Failed uploading ${keyName}:`, err);
      throw new Error(`Failed to upload ${file.name}`);
    }
  };

  const handleSubmit = async () => {
    if (!residentData) return;
    const userId = residentData.userId || residentData.id;

    if (requirementsProgress < requiredRequirementsCount || permitsProgress < 4 || !signatureData || !privacyAccepted) {
      setShowValidationErrors(true);
      if (requirementsProgress < requiredRequirementsCount) {
        toast.warning(`Please ensure ALL ${requiredRequirementsCount} required documents are provided.`);
        setActiveDocTab("REQUIREMENTS");
      } else if (permitsProgress < 4) {
        toast.warning("Please upload 4 or more permits to proceed.");
        setActiveDocTab("PERMITS");
      } else if (!signatureData) {
        toast.warning("Please provide your digital signature before submitting.");
      } else {
        toast.warning("Please accept the Data Privacy and Terms Agreement.");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      toast.loading("Uploading documents to secure storage...");

      const displayResident = selectedApplication?.residentSnapshot || residentData;

      let idFileUrl: string | null = null;
      if (idChoice === "UPLOAD" && formData.newIdFile) {
        idFileUrl = await uploadFileClientSide(formData.newIdFile, "ids", "newIdFile");
      } else if (idChoice === "PROFILE") {
        const profileIdUrl = displayResident?.idFrontUrl || displayResident?.idBackUrl;
        if (profileIdUrl) {
          if (profileIdUrl.startsWith("data:")) {
            const file = await dataURLtoFile(profileIdUrl, "profile_id");
            if (file) {
              idFileUrl = await uploadFileClientSide(file, "ids", "newIdFile");
            }
          } else if (profileIdUrl.startsWith("http")) {
            idFileUrl = profileIdUrl;
          }
        }
      }

      let tctFileUrl: string | null = null;
      if (formData.tctFile) {
        tctFileUrl = await uploadFileClientSide(formData.tctFile, "tct", "tctFile");
      } else if (tctHandoffUrl) {
        tctFileUrl = tctHandoffUrl;
      } else if (selectedApplication?.additionalData?.documents?.tctFile) {
        tctFileUrl = selectedApplication.additionalData.documents.tctFile;
      }

      const finalReqUrls: Record<string, string> = {};
      for (let i = 0; i < 25; i++) {
        if ([2, 5, 8, 13, 14].includes(i)) continue;
        if (!isAffidavitOfConsentRequired && [7, 10, 11, 12, 13, 14].includes(i)) continue;
        if (isAffidavitOfConsentRequired && [21, 22].includes(i)) continue;
        if (!hasMultipleFloors && [23, 24].includes(i)) continue;
        const file = uploadedRequirements[i];
        if (file) {
          const url = await uploadFileClientSide(file, "requirements", `req_${i}`);
          if (url) finalReqUrls[`req_${i}`] = url;
        } else if (handoffDocuments[`req_${i}`]) {
          finalReqUrls[`req_${i}`] = handoffDocuments[`req_${i}`].url;
        } else {
          const existingUrl = selectedApplication?.additionalData?.documents?.[`req_${i}`];
          if (existingUrl) finalReqUrls[`req_${i}`] = existingUrl;
        }
      }

      const finalPermitUrls: Record<string, string> = {};
      for (let i = 0; i < 12; i++) {
        const file = uploadedPermits[i];
        if (file) {
          const url = await uploadFileClientSide(file, "permits", `permit_${i}`);
          if (url) finalPermitUrls[`permit_${i}`] = url;
        } else if (handoffDocuments[`permit_${i}`]) {
          finalPermitUrls[`permit_${i}`] = handoffDocuments[`permit_${i}`].url;
        } else {
          const existingUrl = selectedApplication?.additionalData?.documents?.[`permit_${i}`];
          if (existingUrl) finalPermitUrls[`permit_${i}`] = existingUrl;
        }
      }

      toast.success("All files uploaded successfully! Submitting application...");

      const data = new FormData();
      const parts: string[] = [];
      if (formData.scopeNewConstruction) parts.push("NEW CONSTRUCTION");
      if (formData.scopeAddition) parts.push(`ADDITION: ${formData.scopeAdditionText}`);
      if (formData.scopeRepair) parts.push(`REPAIR: ${formData.scopeRepairText}`);
      if (formData.scopeRenovation) parts.push(`RENOVATION: ${formData.scopeRenovationText}`);
      if (formData.scopeOthers1) parts.push(`OTHERS: ${formData.scopeOthers1Text1} OF ${formData.scopeOthers1Text2}`);
      if (formData.scopeOthers2) parts.push(`OTHERS: ${formData.scopeOthers2Text1} OF ${formData.scopeOthers2Text2}`);
      if (formData.descriptionOfWorkLegacyText) parts.push(formData.descriptionOfWorkLegacyText);
      const finalDescription = parts.join("; ");
      data.append("descriptionOfWork", finalDescription);

      const finalOccupancy = formData.occupancyCategory === "Other Construction"
        ? `Other Construction - ${formData.subOccupancyOthersSpecify}`
        : `${formData.occupancyCategory}: ${formData.selectedSubOccupancies.join(", ")}${formData.selectedSubOccupancies.includes("Others (Specify)") ? ` (${formData.subOccupancyOthersSpecify})` : ""}`;
      data.append("occupancyUse", finalOccupancy);

      data.append("estimatedCost", formData.estimatedCost);
      const finalLocation = formData.locHouseNo ? `#${formData.locHouseNo} ${formData.locStreet}, Brgy. ${formData.locBarangay}${residentData?.municipality ? `, ${residentData.municipality}` : ""}` : formData.locationOfConstruction;
      data.append("locationOfConstruction", finalLocation);
      data.append("totalFloors", formData.totalFloors);
      data.append("isLotOwner", formData.isLotOwner);
      data.append("privacyConsentAccepted", String(privacyAccepted));

      if (idFileUrl) {
        data.append("newIdFile", idFileUrl);
      }
      if (tctFileUrl) {
        data.append("tctFile", tctFileUrl);
      }

      let signatureUrl: string | null = null;
      if (signatureData) {
        if (signatureData.startsWith("http")) {
          signatureUrl = signatureData;
        } else if (signatureData.startsWith("data:")) {
          const signatureFile = await dataURLtoFile(signatureData, "building-permit-signature");
          if (signatureFile) {
            signatureUrl = await uploadFileClientSide(signatureFile, "signatures", "signature");
          }
        }
      }

      if (!signatureUrl) {
        throw new Error("Failed to prepare signature image.");
      }

      Object.entries(finalReqUrls).forEach(([key, url]) => {
        data.append(key, url);
      });
      Object.entries(finalPermitUrls).forEach(([key, url]) => {
        data.append(key, url);
      });

      let result;
      if (isRevision && selectedApplication) {
        result = await resubmitBuildingPermit(selectedApplication.id, data, userId);
      } else {
        result = await submitBuildingPermit(data, userId);
      }

      if (result.success) {
        if (!isRevision && signatureData) {
          await saveTransactionSignature(result.transactionId!, signatureUrl!, userId);
        }
        
        let permitsRes = await getExistingBuildingPermits(userId);
        let newApp = null;
        if (permitsRes.success) {
          newApp = permitsRes.data.find((a: any) => a.id === result.transactionId);
        }
        
        if (!newApp) {
          await new Promise(resolve => setTimeout(resolve, 800));
          permitsRes = await getExistingBuildingPermits(userId);
          if (permitsRes.success) {
            newApp = permitsRes.data.find((a: any) => a.id === result.transactionId);
          }
        }
        
        if (permitsRes.success) {
          setExistingApplications(permitsRes.data);
          setSelectedApplication(newApp || permitsRes.data[0] || null);
        }
        setCurrentStep("EVALUATION");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error(result.error || "Failed to submit.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={pageScrollRef}
      className="h-full max-w-5xl mx-auto overflow-y-auto overscroll-y-contain touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4 sm:px-6 py-8 space-y-12 pb-32 font-sans relative bg-[var(--page-bg)]"
    >
      <DocumentViewerModal
        isOpen={viewerOpen}
        onClose={() => { setViewerOpen(false); setViewerFile(null); setViewerUrl(null); }}
        file={viewerFile}
        fileUrl={viewerUrl}
        title={viewerTitle}
        themeColor = "var(--primary-theme)"
      />
      <SecureQrUploadModal
        isOpen={isHandoffOpen}
        onClose={() => { setIsHandoffOpen(false); }}
        qrCode={handoffQrCode}
        expiresAt={handoffExpiresAt}
        slotLabel={
          handoffSessionSlot === "tct"
            ? "Certified True Copy of TCT"
            : handoffSessionSlot === "documents"
              ? "Required Document"
              : handoffSessionSlot === "bfp"
                ? "BFP Fire Safety Clearance"
                : "Zoning / Locational Clearance"
        }
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className={cn(
          "fixed bottom-8 right-8 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-xl animate-in slide-in-from-bottom-5 duration-300",
          toastMessage.type === "success" ? "bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" :
          toastMessage.type === "error" ? "bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900" :
          toastMessage.type === "warning" ? "bg-amber-50 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900" :
          "bg-blue-50 dark:bg-blue-950/90 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900"
        )}>
          {toastMessage.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          {toastMessage.type === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
          {toastMessage.type === "warning" && <FileWarning className="w-5 h-5 text-amber-500" />}
          {toastMessage.type === "info" && <AlertCircle className="w-5 h-5 text-blue-500" />}
          <span className="text-sm font-bold">{toastMessage.message}</span>
        </div>
      )}

      <div className="space-y-4 md:space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 px-1 md:px-0">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none select-none transition-colors duration-300 ease-out">
              BUILDING <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">PERMIT</span>
            </h1>
            <p className="text-[9px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic transition-colors duration-300 ease-out">Construction & Building Compliance Portal</p>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      {currentStep !== "EXISTING" && (() => {
        const isViewingSubmittedApplication = !!selectedApplication && !isRevision;
        const allowedMaxIdx = isViewingSubmittedApplication
          ? getApplicationPhase(selectedApplication.status).maxStep
          : maxStepIdx;
        return (
          <div className="grid grid-cols-6 gap-1.5 md:gap-4 relative px-1 md:px-2">
            {STEPS.map((step, idx) => {
              const effectiveStep = selectedApplication && !isRevision
                ? getApplicationPhase(selectedApplication.status).step
                : currentStep;
              const isActive = effectiveStep === step.id;
              const isCompleted = idx <= allowedMaxIdx;
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isCompleted) {
                      setCurrentStep(step.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 md:gap-3 relative z-10 font-black cursor-pointer group",
                    !isCompleted && "cursor-not-allowed opacity-50"
                  )}
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
                    "text-[7px] md:text-[10px] uppercase tracking-widest text-center italic font-bold",
                    isActive ? "text-white font-black" :
                    isCompleted ? "text-slate-300" :
                    "text-slate-500"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Main Content Area */}
      <div className="mt-4 md:mt-8 md:bg-white md:dark:bg-[#11131a] md:rounded-[2.5rem] md:border md:border-slate-200 md:dark:border-white/10 p-0 md:p-12 md:shadow-2xl relative md:overflow-hidden group/container min-h-[400px] md:min-h-[500px] flex flex-col transition-colors duration-300 ease-out">

        {currentStep === "EXISTING" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Existing <span className="text-theme-primary italic">Applications</span>
              </h2>
              <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                We found existing Building Permit records under your name.
              </p>
            </div>

            <div className="grid gap-4">
              {existingApplications.map((app, idx) => (
                <div
                  key={app.id || idx}
                  onClick={() => {
                    setSelectedApplication(app);
                    setFormData(prev => ({
                      ...prev,
                      descriptionOfWork: app.additionalData?.descriptionOfWork || "",
                      occupancyUse: app.additionalData?.occupancyUse?.startsWith("Other") ? "Other" : (app.additionalData?.occupancyUse || "Residential (Single Family)"),
                      otherOccupancyUse: app.additionalData?.occupancyUse?.startsWith("Other") ? app.additionalData.occupancyUse.replace("Other - ", "") : "",
                      estimatedCost: app.additionalData?.estimatedCost || "",
                      newIdFile: null,
                      tctFile: null
                    }));
                    setIsRevision(false);
                    const phase = getApplicationPhase(app.status);
                    setMaxStepIdx(phase.maxStep);
                    setCurrentStep(phase.step);
                  }}
                  className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between cursor-pointer hover:border-theme-primary/50 hover:bg-slate-50 dark:hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-theme-primary/10 text-theme-primary flex items-center justify-center">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm md:text-base">
                        Application {app.id?.substring(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Submitted: {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full",
                      app.isCancelled || app.status === "CANCELLED"
                        ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                    )}>
                      {app.isCancelled || app.status === "CANCELLED" ? "CANCELLED" : (app.status ? app.status.replace(/_/g, ' ') : "PENDING")}
                    </span>
                    <span className="text-theme-primary group-hover:translate-x-1 transition-transform font-bold">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 flex justify-center border-t border-slate-200 dark:border-white/10 pt-8">
              <button
                onClick={() => {
                  setSelectedApplication(null);
                  setIsRevision(false);
                  setMaxStepIdx(0);
                  setSignatureData(null);
                  setPrivacyAccepted(false);
                  setShowValidationErrors(false);
                  setHandoffDocuments({});
                  setTctHandoffUrl(null);
                  setTctHandoffFileName("");
                  setFormData({
                    descriptionOfWork: "",
                    scopeNewConstruction: false,
                    scopeAddition: false,
                    scopeAdditionText: "",
                    scopeRepair: false,
                    scopeRepairText: "",
                    scopeRenovation: false,
                    scopeRenovationText: "",
                    scopeDemolition: false,
                    scopeDemolitionText: "",
                    scopeOthers1: false,
                    scopeOthers1Text1: "",
                    scopeOthers1Text2: "",
                    scopeOthers2: false,
                    scopeOthers2Text1: "",
                    scopeOthers2Text2: "",
                    descriptionOfWorkLegacyText: "",
                    occupancyCategory: "",
                    selectedSubOccupancies: [],
                    subOccupancyOthersSpecify: "",
                    estimatedCost: "",
                    locationOfConstruction: "",
                    locHouseNo: "",
                    locStreet: "",
                    locBarangay: "",
                    totalFloors: "",
                    isLotOwner: "",
                    newIdFile: null,
                    tctFile: null,
                    occupancyUse: "Residential (Single Family)",
                    otherOccupancyUse: "",
                  });
                  setUploadedRequirements({});
                  setUploadedPermits({});
                  setCurrentStep("GUIDE");
                }}
                className="bg-theme-primary text-white hover:bg-theme-primary/90 px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all shadow-xl shadow-theme-primary/20"
              >
                Start a New Application
                <span className="text-xl leading-none">+</span>
              </button>
            </div>
          </div>
        )}

        {currentStep === "GUIDE" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Citizen's Charter Reference */}
            <div className="bg-theme-primary/5 border border-theme-primary/20 p-6 rounded-[2rem] flex flex-col md:flex-row gap-4 md:items-center justify-between shadow-sm mb-12">
              <div className="space-y-1.5 text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-primary/10 text-theme-primary text-[8px] font-black uppercase tracking-widest font-sans">
                  <Book className="w-3 h-3" /> Citizen's Charter
                </span>
                <h4 className="text-sm font-black tracking-widest text-slate-700 dark:text-white italic">
                  Based on Municipal Building Permit Process
                </h4>
                <div className="text-xs text-theme-primary dark:text-theme-primary/90 font-bold bg-theme-primary/[0.02] border border-theme-primary/10 p-4 rounded-xl mt-2 italic font-sans leading-relaxed">
                  &quot;Compliant with PD 1096 (National Building Code), RA 11032 (EODB Act), and RA 10173 (Data Privacy Act). Ensure all requirements are duly signed and notarized where applicable.&quot;
                </div>
              </div>
            </div>

            {/* Requirements Guide Content */}
            <div className="space-y-3 md:space-y-4 text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">Requirements <span className="text-theme-primary italic">Guide</span></h2>
              <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto">Review each requirement to see detailed step-by-step instructions.</p>
            </div>

            <div
              className="space-y-6 max-h-[600px] overflow-y-auto pr-2 md:pr-4 custom-scrollbar"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 5) {
                  setHasReadGuide(true);
                }
              }}
            >
              {requirements.map((req) => (
                <div
                  key={req.id}
                  className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-sm relative group hover:border-theme-primary/30 transition-all duration-300"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity"></div>

                  <div className="p-6 md:p-8 pl-8 md:pl-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-theme-primary/5 text-theme-primary flex items-center justify-center">
                          {req.icon}
                        </div>
                        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter italic text-lg md:text-xl">{req.title}</h3>
                      </div>
                      <div className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest px-4 py-2 rounded-full w-fit">
                        {req.office}
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      {req.steps.map((step, idx) => (
                        <div key={idx} className="flex gap-4 items-start border-b border-dashed border-slate-200 dark:border-white/10 pb-4 last:border-0 last:pb-0">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-theme-primary/10 text-theme-primary flex items-center justify-center text-xs font-black mt-0.5">
                            {idx + 1}
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm leading-relaxed pt-0.5">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-theme-primary/[0.03] rounded-xl p-4 flex items-start gap-3 border border-theme-primary/10">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-theme-primary uppercase tracking-wider text-[10px] mr-2">{req.infoLabel}:</span>
                        <span className="italic">{req.infoText}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] p-6 md:p-8">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">
                  <Book className="w-5 h-5 text-theme-primary" />
                  Document Catalog Summary
                </h3>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Total requirements: 13 documents from various issuing authorities
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Licensed Professionals (1)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Assessor's Office (1)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Register of Deeds (1)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Treasury Office (2)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Municipal Health Office (1)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Adjoining Owners (2)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Barangay Hall (1)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Zoning/MPDC (1)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Notary Public (2)</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> BFP (1)</div>
              </div>
            </div>

            {/* Acceptable Valid IDs Section */}
            <div className="mt-8 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] p-6 md:p-8">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">
                  <CreditCard className="w-5 h-5 text-theme-primary" />
                  Acceptable Valid IDs
                </h3>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Primary & Secondary Identification Documents
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/10 pb-2 mb-2">Primary IDs</h4>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Philippine Identification (PhilID) / ePhilID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Passport</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Driver's License</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> PRC ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> UMID / SSS ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Voter's ID</div>
                </div>
                <div className="flex flex-col gap-2 mt-4 md:mt-0">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/10 pb-2 mb-2">Secondary IDs</h4>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Senior Citizen ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> PWD ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> PhilHealth ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Postal ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> TIN ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Police Clearance / NBI Clearance</div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6">
              {existingApplications.length > 0 && (
                <button
                  onClick={() => {
                    setCurrentStep("EXISTING");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-white font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-full transition-colors w-full md:w-auto justify-center"
                >
                  ← Back to Existing Applications
                </button>
              )}
              <button
                disabled={!hasReadGuide}
                onClick={() => {
                  setCurrentStep("PROFILE");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={cn(
                  "px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all w-full md:w-auto ml-auto",
                  hasReadGuide
                    ? "bg-theme-primary text-white hover:bg-theme-primary/90 shadow-xl shadow-theme-primary/20"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-white/10 dark:text-slate-400"
                )}
              >
                Proceed to Profile & Purpose
                <span className="text-xl leading-none">→</span>
              </button>
            </div>
          </div>
        )}

        {currentStep === "PROFILE" && (() => {
          const displayResident = selectedApplication?.residentSnapshot || residentData;
          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-3 md:space-y-4 text-center mb-8">
                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight flex items-center justify-center gap-4">
                  <UserCheck className="w-10 h-10 md:w-12 md:h-12 text-slate-800 dark:text-white" />
                  <span className="text-slate-800 dark:text-white">Profile <span className="text-theme-primary italic">Evaluation</span></span>
                </h2>
                <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto">Verify your identity and provide the necessary details. Fields marked with <span className="text-red-500 font-bold text-lg">*</span> are required.</p>
                {showValidationErrors && missingBuildingPermitFields.length > 0 && (
                  <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-left">
                    <p className="text-sm font-black uppercase tracking-widest text-red-400">Required fields missing</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {missingBuildingPermitFields.map((field) => (
                        <span key={field} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-red-300">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin"></div></div>
              ) : (
                <>
                  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-[2rem] overflow-hidden p-6 md:p-8 relative group hover:border-theme-primary/30 transition-all duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-2 mb-6">
                      <Book className="w-5 h-5 text-theme-primary" />
                      <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">Your Profile (from Digital Data Gathering)</h3>
                    </div>

                    <div className="bg-theme-primary/10 text-theme-primary text-xs py-3 px-4 rounded-xl flex items-start gap-2 border border-theme-primary/20 mb-6">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p><b>Data Import Notice:</b> Your information was imported from the Digital Data Gathering module. Updates to your profile must be made through the separate Digital Data Gathering system.</p>
                    </div>

                    <div className="bg-white dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 p-6 relative overflow-hidden shadow-sm">
                      <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-600 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified Resident Profile
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-md italic">Personal Information</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase text-sm">
                            {displayResident?.fullName ||
                              [displayResident?.firstName, displayResident?.middleName, displayResident?.lastName].filter(Boolean).join(" ") ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Age / Date of Birth</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase text-sm">
                            {displayResident?.dateOfBirth
                              ? `${new Date().getFullYear() - new Date(displayResident.dateOfBirth).getFullYear()} years old / ${new Date(displayResident.dateOfBirth).toLocaleDateString()}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 text-sm">{displayResident?.contactNumber || displayResident?.phoneNumber || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 text-sm">{displayResident?.user?.email || displayResident?.email || "N/A"}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Complete Address</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase text-sm">
                            {displayResident?.houseNumber
                              ? `#${displayResident.houseNumber} ${displayResident.street || ""}, Brgy. ${displayResident.barangay || ""}, ${displayResident.municipality || "Local Municipality"}`
                              : displayResident?.address || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Purpose / Additional Info */}
                  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-[2rem] overflow-hidden p-6 md:p-8 mt-6 relative group hover:border-theme-primary/30 transition-all duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-2 mb-6">
                      <Book className="w-5 h-5 text-theme-primary" />
                      <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">Additional Information</h3>
                    </div>

                    <div className="space-y-8">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          a. Scope of Work <span className="text-red-500 text-lg">*</span>
                        </label>

                        <div className={cn("rounded-xl p-4 border bg-white/40 dark:bg-black/20 space-y-4", (showValidationErrors && (
                          !formData.scopeNewConstruction &&
                          !formData.scopeAddition &&
                          !formData.scopeRepair &&
                          !formData.scopeRenovation &&
                          !formData.scopeOthers1 &&
                          !formData.descriptionOfWorkLegacyText
                        )) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}>

                          {/* New Construction */}
                          <div className="flex items-center space-x-3 py-1">
                            <Checkbox
                              id="scope-new-con"
                              checked={formData.scopeNewConstruction}
                              disabled={!isEditable}
                              onCheckedChange={checked => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    scopeNewConstruction: true,
                                    scopeAddition: false,
                                    scopeAdditionText: "",
                                    scopeRepair: false,
                                    scopeRepairText: "",
                                    scopeRenovation: false,
                                    scopeRenovationText: "",
                                    scopeDemolition: false,
                                    scopeDemolitionText: "",
                                    scopeOthers1: false,
                                    scopeOthers1Text1: "",
                                    scopeOthers1Text2: ""
                                  });
                                } else {
                                  setFormData({ ...formData, scopeNewConstruction: false });
                                }
                              }}
                            />
                            <label htmlFor="scope-new-con" className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                              New Construction
                            </label>
                          </div>

                          {/* Addition Of */}
                          <div className="flex flex-col md:flex-row md:items-center gap-2 py-1">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id="scope-addition"
                                checked={formData.scopeAddition}
                                disabled={!isEditable}
                                onCheckedChange={checked => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      scopeNewConstruction: false,
                                      scopeAddition: true,
                                      scopeRepair: false,
                                      scopeRepairText: "",
                                      scopeRenovation: false,
                                      scopeRenovationText: "",
                                      scopeDemolition: false,
                                      scopeDemolitionText: "",
                                      scopeOthers1: false,
                                      scopeOthers1Text1: "",
                                      scopeOthers1Text2: ""
                                    });
                                  } else {
                                    setFormData({ ...formData, scopeAddition: false });
                                  }
                                }}
                              />
                              <label htmlFor="scope-addition" className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none shrink-0">
                                Addition of
                              </label>
                            </div>
                            {formData.scopeAddition && (
                              <input
                                type="text"
                                placeholder="Specify details"
                                className={cn("flex-1 bg-white dark:bg-black/20 border rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-primary", (showValidationErrors && !formData.scopeAdditionText) ? "border-red-500" : "border-slate-200 dark:border-white/10")}
                                value={formData.scopeAdditionText}
                                onChange={e => setFormData({ ...formData, scopeAdditionText: e.target.value })}
                                disabled={!isEditable}
                              />
                            )}
                          </div>

                          {/* Repair Of */}
                          <div className="flex flex-col md:flex-row md:items-center gap-2 py-1">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id="scope-repair"
                                checked={formData.scopeRepair}
                                disabled={!isEditable}
                                onCheckedChange={checked => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      scopeNewConstruction: false,
                                      scopeAddition: false,
                                      scopeAdditionText: "",
                                      scopeRepair: true,
                                      scopeRenovation: false,
                                      scopeRenovationText: "",
                                      scopeDemolition: false,
                                      scopeDemolitionText: "",
                                      scopeOthers1: false,
                                      scopeOthers1Text1: "",
                                      scopeOthers1Text2: ""
                                    });
                                  } else {
                                    setFormData({ ...formData, scopeRepair: false });
                                  }
                                }}
                              />
                              <label htmlFor="scope-repair" className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none shrink-0">
                                Repair of
                              </label>
                            </div>
                            {formData.scopeRepair && (
                              <input
                                type="text"
                                placeholder="Specify details"
                                className={cn("flex-1 bg-white dark:bg-black/20 border rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-primary", (showValidationErrors && !formData.scopeRepairText) ? "border-red-500" : "border-slate-200 dark:border-white/10")}
                                value={formData.scopeRepairText}
                                onChange={e => setFormData({ ...formData, scopeRepairText: e.target.value })}
                                disabled={!isEditable}
                              />
                            )}
                          </div>

                          {/* Renovation Of */}
                          <div className="flex flex-col md:flex-row md:items-center gap-2 py-1">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id="scope-renovation"
                                checked={formData.scopeRenovation}
                                disabled={!isEditable}
                                onCheckedChange={checked => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      scopeNewConstruction: false,
                                      scopeAddition: false,
                                      scopeAdditionText: "",
                                      scopeRepair: false,
                                      scopeRepairText: "",
                                      scopeRenovation: true,
                                      scopeDemolition: false,
                                      scopeDemolitionText: "",
                                      scopeOthers1: false,
                                      scopeOthers1Text1: "",
                                      scopeOthers1Text2: ""
                                    });
                                  } else {
                                    setFormData({ ...formData, scopeRenovation: false });
                                  }
                                }}
                              />
                              <label htmlFor="scope-renovation" className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none shrink-0">
                                Renovation of
                              </label>
                            </div>
                            {formData.scopeRenovation && (
                              <input
                                type="text"
                                placeholder="Specify details"
                                className={cn("flex-1 bg-white dark:bg-black/20 border rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-primary", (showValidationErrors && !formData.scopeRenovationText) ? "border-red-500" : "border-slate-200 dark:border-white/10")}
                                value={formData.scopeRenovationText}
                                onChange={e => setFormData({ ...formData, scopeRenovationText: e.target.value })}
                                disabled={!isEditable}
                              />
                            )}
                          </div>

                          {/* Others Specify */}
                          <div className="flex flex-col gap-2 py-1 border-t border-slate-100 dark:border-white/5 pt-2">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id="scope-others-1"
                                checked={formData.scopeOthers1}
                                disabled={!isEditable}
                                onCheckedChange={checked => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      scopeNewConstruction: false,
                                      scopeAddition: false,
                                      scopeAdditionText: "",
                                      scopeRepair: false,
                                      scopeRepairText: "",
                                      scopeRenovation: false,
                                      scopeRenovationText: "",
                                      scopeDemolition: false,
                                      scopeDemolitionText: "",
                                      scopeOthers1: true
                                    });
                                  } else {
                                    setFormData({ ...formData, scopeOthers1: false });
                                  }
                                }}
                              />
                              <label htmlFor="scope-others-1" className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none shrink-0 font-bold text-slate-500">
                                Others (Specify)
                              </label>
                            </div>
                            {formData.scopeOthers1 && (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-6">
                                <input
                                  type="text"
                                  placeholder="Specify item"
                                  className={cn("flex-1 bg-white dark:bg-black/20 border rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-primary", (showValidationErrors && !formData.scopeOthers1Text1) ? "border-red-500" : "border-slate-200 dark:border-white/10")}
                                  value={formData.scopeOthers1Text1}
                                  onChange={e => setFormData({ ...formData, scopeOthers1Text1: e.target.value })}
                                  disabled={!isEditable}
                                />
                                <span className="text-xs text-slate-400 self-center">OF</span>
                                <input
                                  type="text"
                                  placeholder="Specify category/structure"
                                  className={cn("flex-1 bg-white dark:bg-black/20 border rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-primary", (showValidationErrors && !formData.scopeOthers1Text2) ? "border-red-500" : "border-slate-200 dark:border-white/10")}
                                  value={formData.scopeOthers1Text2}
                                  onChange={e => setFormData({ ...formData, scopeOthers1Text2: e.target.value })}
                                  disabled={!isEditable}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Land Title (TCT File Upload) */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          b. Certified true copy of the TCT covering a lot on which the proposed work is to be done <span className="text-red-500 text-lg">*</span>
                        </label>
                        {!isEditable ? (
                          <div className="bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm">
                            {(() => {
                              const url = selectedApplication.additionalData?.documents?.tctFile;
                              if (!url) {
                                return <p className="text-sm font-medium text-slate-500 italic">No TCT Document uploaded.</p>;
                              }
                              const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url);
                              return (
                                <div className="space-y-4 w-full flex flex-col items-center">
                                  {isImage ? (
                                    <img src={url} alt="TCT Document" className="max-h-48 object-contain rounded-lg border border-slate-200 dark:border-white/10" />
                                  ) : (
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                      <FileText className="w-8 h-8" />
                                    </div>
                                  )}
                                  <p className="text-xs font-semibold text-slate-500">TCT Document is uploaded and verified</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewerUrl(url);
                                      setViewerTitle("TCT Document");
                                      setViewerOpen(true);
                                    }}
                                    className="inline-flex items-center gap-2 text-xs font-bold text-theme-primary hover:underline"
                                  >
                                    View Full Document ↗
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className={cn("min-h-[180px] bg-white dark:bg-black/20 rounded-xl border border-dashed p-8 flex flex-col items-center justify-center text-center relative isolate hover:bg-slate-50 dark:hover:bg-white/5 transition-colors overflow-hidden", (showValidationErrors && !hasTctFile) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-300 dark:border-white/20")}>
                            {(() => {
                              if (formData.tctFile && formData.tctFile.type.startsWith("image/")) {
                                return (
                                  <div className="w-full h-full absolute inset-0 z-0 bg-slate-900 group/preview">
                                    <img src={URL.createObjectURL(formData.tctFile)} alt="Preview" className="w-full h-full object-contain" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 transition-opacity flex flex-col justify-center items-center z-10 gap-3">
                                      <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewerFile(formData.tctFile); setViewerTitle("TCT Document"); setViewerOpen(true); }}
                                        className="px-4 py-1.5 bg-theme-primary text-white text-[10px] uppercase font-bold rounded-full shadow-lg hover:bg-theme-primary/90"
                                      >
                                        Preview Image
                                      </button>
                                      <label htmlFor="upload-tctFile" className="px-4 py-1.5 bg-slate-700 text-white text-[10px] uppercase font-bold rounded-full shadow-lg hover:bg-slate-600 cursor-pointer">
                                        Replace Image
                                      </label>
                                    </div>
                                  </div>
                                );
                              } else if (formData.tctFile || tctHandoffUrl) {
                                return (
                                  <div className="w-full flex flex-col justify-center items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-theme-primary flex items-center justify-center">
                                      <FileText className="w-7 h-7" />
                                    </div>
                                    <div className="max-w-full">
                                      <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Upload complete</p>
                                      <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{formData.tctFile?.name || tctHandoffFileName}</p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-3">
                                      <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setViewerFile(formData.tctFile);
                                            setViewerUrl(tctHandoffUrl);
                                            setViewerTitle("TCT Document");
                                            setViewerOpen(true);
                                          }}
                                          className="px-5 py-2 bg-theme-primary text-white text-[10px] uppercase font-black tracking-widest rounded-full shadow-lg hover:bg-theme-primary/90"
                                        >
                                          Preview
                                        </button>
                                      <button
                                        type="button"
                                        onClick={startTctHandoff}
                                        disabled={isCreatingHandoff}
                                        className="px-5 py-2 bg-slate-700 text-white text-[10px] uppercase font-black tracking-widest rounded-full shadow-lg hover:bg-slate-600 disabled:opacity-50"
                                      >
                                        {isCreatingHandoff ? "Creating QR..." : "Re-upload"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="w-full flex flex-col items-center justify-center gap-4">
                                  <QrCode className="w-8 h-8 text-theme-primary" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 px-2">
                                      Certified true copy of TCT
                                    </p>
                                    <p className="text-[10px] mt-1 text-slate-400">PDF/JPG/PNG • 5MB • Antivirus scanned</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={startTctHandoff}
                                    disabled={isCreatingHandoff}
                                    className="px-6 py-3 rounded-xl bg-theme-primary hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-theme-primary/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    {isCreatingHandoff ? "Creating secure QR..." : "Upload via QR"}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Occupancy Category */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          c. The use of the occupancy for which the proposed work is intended <span className="text-red-500 text-lg">*</span>
                        </label>
                        <div className={cn("rounded-xl transition-all p-4 border bg-white/40 dark:bg-black/20", (showValidationErrors && (!formData.occupancyCategory || (formData.occupancyCategory !== "Other Construction" && formData.selectedSubOccupancies.length === 0) || (formData.occupancyCategory === "Other Construction" && !formData.subOccupancyOthersSpecify) || (formData.selectedSubOccupancies.includes("Others (Specify)") && !formData.subOccupancyOthersSpecify))) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}>
                          <Select
                            value={formData.occupancyCategory}
                            onValueChange={value => {
                              setFormData({
                                ...formData,
                                occupancyCategory: value,
                                selectedSubOccupancies: [],
                                subOccupancyOthersSpecify: ""
                              });
                            }}
                            disabled={!isEditable}
                          >
                            <SelectTrigger className="w-full h-auto bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none cursor-pointer">
                              <SelectValue placeholder="Select occupancy category" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#11131a] border-slate-200 dark:border-white/10 rounded-xl">
                              {OCCUPANCY_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {formData.occupancyCategory && (
                            <div className="mt-4 space-y-3 pl-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Specific Options:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {OCCUPANCY_OPTIONS[formData.occupancyCategory]?.map((opt) => {
                                  const isChecked = formData.selectedSubOccupancies.includes(opt.label) || (formData.occupancyCategory === "Other Construction" && opt.label === "Specify");
                                  return (
                                    <div key={opt.code} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                      {formData.occupancyCategory !== "Other Construction" ? (
                                        <Checkbox
                                          id={`sub-occ-${opt.code}`}
                                          checked={isChecked}
                                          disabled={!isEditable}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setFormData({
                                                ...formData,
                                                selectedSubOccupancies: [opt.label],
                                                ...(opt.label !== "Others (Specify)" && { subOccupancyOthersSpecify: "" })
                                              });
                                            } else {
                                              setFormData({ ...formData, selectedSubOccupancies: [] });
                                            }
                                          }}
                                        />
                                      ) : (
                                        <div className="w-2.5 h-2.5 rounded bg-theme-primary shrink-0" />
                                      )}
                                      <label htmlFor={`sub-occ-${opt.code}`} className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                        {opt.label}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>

                              {(formData.selectedSubOccupancies.includes("Others (Specify)") || formData.occupancyCategory === "Other Construction") && (
                                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                                  <input
                                    type="text"
                                    placeholder="Please specify occupancy use details"
                                    className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && !formData.subOccupancyOthersSpecify) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                                    value={formData.subOccupancyOthersSpecify}
                                    onChange={e => setFormData({ ...formData, subOccupancyOthersSpecify: e.target.value })}
                                    disabled={!isEditable}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Total Floors */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Total Floor(s) <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="e.g. 2"
                          className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && (!formData.totalFloors || Number(formData.totalFloors) <= 0)) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                          value={formData.totalFloors}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === "" || Number(val) > 0) {
                              setFormData({ ...formData, totalFloors: val });
                            }
                          }}
                          disabled={!isEditable}
                        />
                      </div>

                      {/* Estimated Cost */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          d. Estimated cost of the proposal <span className="text-red-500 text-lg">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">₱</span>
                          <input
                            type="number"
                            min="0"
                            className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 pl-10 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && (!formData.estimatedCost || Number(formData.estimatedCost) <= 0)) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                            value={formData.estimatedCost}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === "" || Number(val) >= 0) {
                                setFormData({ ...formData, estimatedCost: val });
                              }
                            }}
                            disabled={!isEditable}
                          />
                        </div>
                      </div>

                      {/* Location of Construction */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          e. Location of Construction <span className="text-red-500 text-lg">*</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">HOUSE/LOT NO.</span>
                            <input
                              type="text"
                              placeholder="e.g. 123"
                              className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none"
                              value={formData.locHouseNo}
                              onChange={e => setFormData({ ...formData, locHouseNo: e.target.value })}
                              disabled={!isEditable}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">STREET</span>
                            <input
                              type="text"
                              placeholder="e.g. Bonifacio St."
                              className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none"
                              value={formData.locStreet}
                              onChange={e => setFormData({ ...formData, locStreet: e.target.value })}
                              disabled={!isEditable}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">BARANGAY</span>
                            <Select
                              value={formData.locBarangay}
                              onValueChange={value => setFormData({ ...formData, locBarangay: value })}
                              disabled={!isEditable}
                            >
                              <SelectTrigger className="w-full h-auto bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none cursor-pointer">
                                <SelectValue placeholder="Select Barangay" />
                              </SelectTrigger>
                              <SelectContent>
                                {barangayNames.map((brgy) => (
                                  <SelectItem key={brgy} value={brgy}>{brgy}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          f. Is the applicant the owner of the lot? <span className="text-red-500 text-lg">*</span>
                        </label>
                        <Select
                          value={formData.isLotOwner}
                          onValueChange={value => {
                            setFormData({ ...formData, isLotOwner: value });
                            if (value === "Yes") {
                              setUploadedRequirements(previous => {
                                const next = { ...previous };
                                delete next[7];
                                return next;
                              });
                              setHandoffDocuments(previous => {
                                const next = { ...previous };
                                delete next.req_7;
                                return next;
                              });
                            }
                          }}
                          disabled={!isEditable}
                        >
                          <SelectTrigger className={cn("w-full h-auto bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none cursor-pointer", (showValidationErrors && !formData.isLotOwner) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}>
                            <SelectValue placeholder="Select Yes or No" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6">
                    <button
                      onClick={() => {
                        setCurrentStep("GUIDE");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 dark:border-white/20 rounded-full transition-colors shadow-sm"
                    >
                      ← Back to Requirements
                    </button>
                    <button
                      onClick={() => {
                        const hasNoScopeSelected = !formData.scopeNewConstruction &&
                          !formData.scopeAddition &&
                          !formData.scopeRepair &&
                          !formData.scopeRenovation &&
                          !formData.scopeOthers1 &&
                          !formData.scopeOthers2 &&
                          !formData.descriptionOfWorkLegacyText;

                        const hasMissingScopeTexts = (formData.scopeAddition && !formData.scopeAdditionText) ||
                          (formData.scopeRepair && !formData.scopeRepairText) ||
                          (formData.scopeRenovation && !formData.scopeRenovationText) ||
                          (formData.scopeOthers1 && (!formData.scopeOthers1Text1 || !formData.scopeOthers1Text2));

                        const hasMissingFields = hasNoScopeSelected ||
                          hasMissingScopeTexts ||
                          !formData.estimatedCost ||
                          Number(formData.estimatedCost) <= 0 ||
                          !formData.locHouseNo ||
                          !formData.locStreet ||
                          !formData.locBarangay ||
                          !formData.isLotOwner ||
                          !formData.occupancyCategory ||
                          (formData.occupancyCategory !== "Other Construction" && formData.selectedSubOccupancies.length === 0) ||
                          (formData.occupancyCategory === "Other Construction" && !formData.subOccupancyOthersSpecify) ||
                          (formData.selectedSubOccupancies.includes("Others (Specify)") && !formData.subOccupancyOthersSpecify) ||
                          (idChoice === "UPLOAD" && !formData.newIdFile && !selectedApplication?.additionalData?.documents?.newIdFile) ||
                          !hasTctFile;

                        if (hasMissingFields) {
                          setShowValidationErrors(true);
                          toast.error("Please fill in all required fields marked with *.");
                          return;
                        }

                        setCurrentStep("DOCUMENTS");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="bg-theme-primary text-white hover:bg-theme-primary/90 px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all shadow-xl shadow-theme-primary/20 w-full md:w-auto ml-auto"
                    >
                      Proceed to Document Uploads
                      <span className="text-xl leading-none">→</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {currentStep === "DOCUMENTS" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-3 md:space-y-4 text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">Document <span className="text-theme-primary italic">Uploads</span></h2>
              <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto">Upload the required documents and permits. Optional files may also be included. Each file must be under 5MB.</p>
            </div>

            <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-xl w-full md:w-fit mb-6 shadow-inner border border-slate-200 dark:border-white/5">
              <button
                type="button"
                onClick={() => setActiveDocTab("REQUIREMENTS")}
                className={cn(
                  "flex items-center justify-center gap-2 flex-1 md:px-6 py-2.5 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all",
                  activeDocTab === "REQUIREMENTS"
                    ? "bg-white dark:bg-white/10 text-theme-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5"
                )}
              >
                Requirements ({requirementsProgress}/{requiredRequirementsCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab("PERMITS")}
                className={cn(
                  "flex items-center justify-center gap-2 flex-1 md:px-6 py-2.5 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all",
                  activeDocTab === "PERMITS"
                    ? "bg-white dark:bg-white/10 text-theme-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5"
                )}
              >
                Permits ({permitsProgress}/4)
              </button>
            </div>

            {isEditable && (
              <button
                type="button"
                onClick={startDocumentsHandoff}
                disabled={isCreatingHandoff}
                className="mb-6 inline-flex items-center gap-2 rounded-full bg-theme-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-theme-primary/90 disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                {isCreatingHandoff ? "Creating secure QR..." : "Upload all documents via QR"}
              </button>
            )}

            <div className="grid gap-6">
              {activeDocTab === "REQUIREMENTS" ? (
                documentRequirementsList
                  .map((reqName, idx) => ({ reqName, idx }))
                  .map(({ reqName, idx }) => {
                  const file = uploadedRequirements[idx];
                  const existingUrl = selectedApplication?.additionalData?.documents?.[`req_${idx}`];
                  const handoffFile = handoffDocuments[`req_${idx}`];
                  const hasFile = !!file || !!existingUrl || !!handoffFile;
                  const isRequired = ![2, 5, 8, 13, 14].includes(idx)
                    && (isAffidavitOfConsentRequired || ![7, 10, 11, 12, 13, 14].includes(idx))
                    && (!isAffidavitOfConsentRequired || ![21, 22].includes(idx))
                    && (hasMultipleFloors || ![23, 24].includes(idx));

                  return (
                    <div key={idx} className={cn("bg-white/40 dark:bg-white/5 border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm", (showValidationErrors && requiredRequirementIndexes.includes(idx) && !hasFile) ? "border-red-500" : "border-slate-200 dark:border-white/10")}>
                      <div className="flex items-center gap-4 flex-1">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white text-sm">
                            {reqName}
                            {!isRequired && (
                              <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Optional</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{file?.name || handoffFile?.fileName || (existingUrl ? "Existing Document" : isRequired ? "Required File" : "Optional File")}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {existingUrl && (
                          <button
                            type="button"
                            onClick={() => { setViewerUrl(existingUrl); setViewerTitle(reqName); setViewerOpen(true); }}
                            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-full hover:bg-slate-100"
                          >
                            View
                          </button>
                        )}
                        {file && (
                          <button
                            type="button"
                            onClick={() => { setViewerFile(file); setViewerTitle(reqName); setViewerOpen(true); }}
                            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-full hover:bg-slate-100"
                          >
                            Preview
                          </button>
                        )}
                        {handoffFile && (
                          <button
                            type="button"
                            onClick={() => { setViewerUrl(handoffFile.url); setViewerTitle(reqName); setViewerOpen(true); }}
                            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-full hover:bg-slate-100"
                          >
                            Preview
                          </button>
                        )}
                        {isEditable && (
                          <button type="button" onClick={startDocumentsHandoff} className="px-4 py-2 text-xs font-black uppercase bg-theme-primary text-white rounded-full hover:bg-theme-primary/90 flex items-center gap-1 shadow-sm">
                            <QrCode className="w-3.5 h-3.5" />
                            {hasFile ? "Re-upload" : "Upload"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                permitTypesList.map((permitName, idx) => {
                  const file = uploadedPermits[idx];
                  const existingUrl = selectedApplication?.additionalData?.documents?.[`permit_${idx}`];
                  const handoffFile = handoffDocuments[`permit_${idx}`];
                  const hasFile = !!file || !!existingUrl || !!handoffFile;

                  return (
                    <div key={idx} className={cn("bg-white/40 dark:bg-white/5 border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm", (showValidationErrors && requiredPermitIndexes.includes(idx) && !hasFile) ? "border-red-500" : "border-slate-200 dark:border-white/10")}>
                      <div className="flex items-center gap-4 flex-1">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white text-sm">
                            {permitName}
                          </p>
                          <p className="text-xs text-slate-400">{file?.name || handoffFile?.fileName || (existingUrl ? "Existing Document" : "Upload at least 4 permits to proceed")}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {existingUrl && (
                          <button
                            type="button"
                            onClick={() => { setViewerUrl(existingUrl); setViewerTitle(permitName); setViewerOpen(true); }}
                            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-full hover:bg-slate-100"
                          >
                            View
                          </button>
                        )}
                        {file && (
                          <button
                            type="button"
                            onClick={() => { setViewerFile(file); setViewerTitle(permitName); setViewerOpen(true); }}
                            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-full hover:bg-slate-100"
                          >
                            Preview
                          </button>
                        )}
                        {handoffFile && (
                          <button
                            type="button"
                            onClick={() => { setViewerUrl(handoffFile.url); setViewerTitle(permitName); setViewerOpen(true); }}
                            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-full hover:bg-slate-100"
                          >
                            Preview
                          </button>
                        )}
                        {isEditable && (
                          <button type="button" onClick={startDocumentsHandoff} className="px-4 py-2 text-xs font-black uppercase bg-theme-primary text-white rounded-full hover:bg-theme-primary/90 flex items-center gap-1 shadow-sm">
                            <QrCode className="w-3.5 h-3.5" />
                            {hasFile ? "Re-upload" : "Upload"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedApplication && !isRevision && (
              <div className="mt-10 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 dark:border-white/10 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/50 p-6 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-4 flex items-center gap-3">
                    <FileSignature className="h-5 w-5 text-theme-primary" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Submitted Digital Signature
                    </h3>
                  </div>
                  {selectedApplication.additionalData?.signature ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <img
                        src={selectedApplication.additionalData.signature}
                        alt="Submitted digital signature"
                        className="mx-auto max-h-36 object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-xs font-medium italic text-slate-400">No saved signature is available.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                  <div className="mb-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Data Privacy Consent
                    </h3>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    Accepted during application submission
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    The applicant consented to the collection and processing of the submitted information and documents under the Data Privacy Act of 2012.
                  </p>
                  {selectedApplication.additionalData?.privacyConsentAcceptedAt && (
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">
                      Recorded: {new Date(selectedApplication.additionalData.privacyConsentAcceptedAt).toLocaleString("en-PH")}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6">
              <button
                onClick={() => {
                  setCurrentStep("PROFILE");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 dark:border-white/20 rounded-full transition-colors shadow-sm"
              >
                ← Back to Profile
              </button>
              <button
                onClick={() => {
                  if (selectedApplication && !isRevision) {
                    setCurrentStep("EVALUATION");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                  }

                  const missingReqs = requirementsProgress < requiredRequirementsCount;
                  const missingPermits = permitsProgress < requiredPermitsCount;

                  if (missingReqs || missingPermits) {
                    setShowValidationErrors(true);
                    if (missingReqs) {
                      setActiveDocTab("REQUIREMENTS");
                      toast.error(`Please upload all required documents before continuing.`);
                    } else {
                      setActiveDocTab("PERMITS");
                      toast.error(`Please upload at least ${requiredPermitsCount} permits before continuing.`);
                    }
                    return;
                  }

                  setCurrentStep("SUBMIT");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-theme-primary text-white hover:bg-theme-primary/90 px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all shadow-xl shadow-theme-primary/20 w-full md:w-auto ml-auto"
              >
                {selectedApplication && !isRevision ? "Next: Evaluation" : "Proceed to Verification & Submit"}
                <span className="text-xl leading-none">→</span>
              </button>
            </div>
          </div>
        )}

        {currentStep === "EVALUATION" && selectedApplication && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Evaluation <span className="text-theme-primary italic">Status</span>
              </h2>
              <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                Your application is currently being evaluated by the Engineering Office.
              </p>
            </div>

            <div className="mx-auto max-w-4xl space-y-6 rounded-[2.5rem] border border-slate-200 bg-white/40 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-white/5 md:p-10">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-theme-primary dark:bg-emerald-500/10">
                  <Landmark className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Treasury & Zoning/BFP Status</h3>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-theme-primary/10 text-theme-primary flex items-center justify-center">
                    <Hourglass className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Application Reference</p>
                    <p className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-lg">{selectedApplication.id?.substring(0, 8).toUpperCase()}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="bg-theme-primary/10 text-theme-primary text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-theme-primary/20 shadow-inner dark:bg-theme-primary/15">
                    {selectedApplication.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {selectedApplication.status === "FOR_REVISION" && selectedApplication.rejectionRemarks && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 p-6 rounded-2xl space-y-2">
                  <h4 className="font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                    <FileWarning className="w-4 h-4" /> Revision Required by Engineer
                  </h4>
                  <p className="text-sm italic font-medium">{selectedApplication.rejectionRemarks}</p>
                </div>
              )}

              {["FOR_INSPECTION", "FOR_REINSPECTION"].includes(selectedApplication.status) && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 dark:border-purple-500/20 dark:bg-purple-500/5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md shadow-purple-500/20">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">
                        {selectedApplication.status === "FOR_REINSPECTION" ? "Re-Inspection Schedule" : "Inspection Schedule"}
                      </p>

                      {selectedApplication.additionalData?.inspectionSchedule ? (
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400">Date</p>
                            <p className="mt-1 font-black text-purple-950 dark:text-purple-100">
                              {formatInspectionDate(selectedApplication.additionalData.inspectionSchedule.date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400">Time</p>
                            <p className="mt-1 flex items-center gap-2 font-black text-purple-950 dark:text-purple-100">
                              <Clock className="h-4 w-4 text-purple-500" />
                              {selectedApplication.additionalData.inspectionSchedule.time || "To be announced"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400">Inspection Type</p>
                            <p className="mt-1 font-bold text-purple-800 dark:text-purple-200">
                              {selectedApplication.additionalData.inspectionSchedule.type ||
                                (selectedApplication.status === "FOR_REINSPECTION" ? "Site Re-inspection" : "Site Inspection")}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400">Assigned Inspector</p>
                            <p className="mt-1 font-bold text-purple-800 dark:text-purple-200">
                              {selectedApplication.additionalData.inspectionSchedule.inspectorName || "To be assigned"}
                            </p>
                          </div>
                          {selectedApplication.additionalData.inspectionSchedule.notes && (
                            <div className="sm:col-span-2 border-t border-purple-200 pt-4 dark:border-purple-500/20">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400">Notes</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm font-medium italic text-purple-800 dark:text-purple-200">
                                {selectedApplication.additionalData.inspectionSchedule.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                          The Engineering Office is preparing your schedule. Please check this application again for the confirmed date and time.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">MPDC Zoning Review</h3>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        !["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status)
                          ? "bg-amber-100 dark:bg-amber-500/20 text-amber-500"
                          : selectedApplication.additionalData?.feeAssessment?.zoningEndorsed
                            ? "bg-emerald-100 text-emerald-500 dark:bg-emerald-500/20"
                            : "bg-blue-100 text-blue-500 dark:bg-blue-500/20"
                      )}>
                        {!["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status) ? (
                          <Clock className="w-5 h-5" />
                        ) : selectedApplication.additionalData?.feeAssessment?.zoningEndorsed ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <MapPin className="w-5 h-5" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 dark:text-white text-sm leading-snug">
                          {!["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status)
                            ? "Awaiting Engineering Approval"
                            : selectedApplication.additionalData?.zoningStatus === "FOR_INSPECTION"
                              ? "Scheduled for Zoning Site Inspection"
                              : selectedApplication.additionalData?.zoningStatus === "FOR_REINSPECTION"
                                ? "Scheduled for Zoning Site Re-inspection"
                                : selectedApplication.additionalData?.feeAssessment?.zoningEndorsed
                                  ? "Zoning Assessment Endorsed"
                                  : "Zoning Clearance Under Review"}
                        </p>
                        <p className="text-xs text-slate-500 leading-normal">
                          {!["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status)
                            ? "Zoning review will commence once the Engineering Department approves your documents."
                            : selectedApplication.additionalData?.zoningStatus === "FOR_INSPECTION"
                              ? "Your application is scheduled for an upcoming zoning site inspection."
                              : selectedApplication.additionalData?.zoningStatus === "FOR_REINSPECTION"
                                ? "Your application requires a zoning site re-inspection. Please check for updates."
                                : selectedApplication.additionalData?.feeAssessment?.zoningEndorsed
                                  ? "Your zoning requirements have been evaluated and endorsed by MPDC."
                                  : "Your documents are currently being reviewed by the MPDC Zoning Office."}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 w-fit sm:self-center self-start sm:ml-0 ml-14",
                      selectedApplication.isCancelled
                        ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                        : !["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status)
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                          : selectedApplication.additionalData?.zoningStatus === "REJECTED"
                            ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                            : selectedApplication.additionalData?.zoningStatus === "FOR_REVISION"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                              : selectedApplication.additionalData?.feeAssessment?.zoningEndorsed
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                    )}>
                      {selectedApplication.isCancelled
                        ? "Cancelled"
                        : !["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status)
                          ? "Pending"
                          : selectedApplication.additionalData?.feeAssessment?.zoningEndorsed
                            ? "Approved"
                            : selectedApplication.additionalData?.zoningStatus === "FOR_INSPECTION" || selectedApplication.additionalData?.zoningStatus === "FOR_REINSPECTION"
                              ? "For Inspection"
                              : selectedApplication.additionalData?.zoningStatus === "FOR_REVISION"
                                ? "For Revision"
                                : selectedApplication.additionalData?.zoningStatus === "REJECTED"
                                  ? "Rejected"
                                  : "Under Review"}
                    </span>
                  </div>

                  {selectedApplication.additionalData?.zoningStatus && (selectedApplication.additionalData.zoningStatus === "REJECTED" || selectedApplication.additionalData.zoningStatus === "FOR_REVISION") && selectedApplication.additionalData.zoningRejectionRemarks && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl text-red-800 dark:text-red-400 text-sm">
                      <p className="font-bold uppercase tracking-widest text-[10px] mb-1">
                        {selectedApplication.additionalData.zoningStatus === "REJECTED" ? "Zoning Rejection Reason" : "Zoning Revision Remarks"}
                      </p>
                      <p className="whitespace-pre-wrap font-medium">{selectedApplication.additionalData.zoningRejectionRemarks}</p>
                    </div>
                  )}

                  {(selectedApplication.additionalData?.zoningStatus === "FOR_INSPECTION" || selectedApplication.additionalData?.zoningStatus === "FOR_REINSPECTION") && (selectedApplication.additionalData?.zoningInspectionSchedule || selectedApplication.additionalData?.inspectionSchedule) && (
                    <div className="mt-4 p-5 bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                        {selectedApplication.additionalData.zoningStatus === "FOR_REINSPECTION" ? "Zoning Re-Inspection Details" : "Zoning Inspection Details"}
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-xs text-purple-800 dark:text-purple-300 font-bold">
                        <div>
                          <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-0.5">Date & Time</span>
                          {(selectedApplication.additionalData.zoningInspectionSchedule || selectedApplication.additionalData.inspectionSchedule).date} at {(selectedApplication.additionalData.zoningInspectionSchedule || selectedApplication.additionalData.inspectionSchedule).time}
                        </div>
                        <div>
                          <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-0.5">Inspector</span>
                          {(selectedApplication.additionalData.zoningInspectionSchedule || selectedApplication.additionalData.inspectionSchedule).inspectorName}
                        </div>
                        <div className="col-span-2">
                          <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-0.5">Type</span>
                          {(selectedApplication.additionalData.zoningInspectionSchedule || selectedApplication.additionalData.inspectionSchedule).type}
                        </div>
                        {(selectedApplication.additionalData.zoningInspectionSchedule || selectedApplication.additionalData.inspectionSchedule).notes && (
                          <div className="col-span-2 mt-2 pt-3 border-t border-purple-200 dark:border-purple-500/20">
                            <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-1">Notes / Instructions</span>
                            <p className="italic text-purple-700 dark:text-purple-300 font-medium">"{(selectedApplication.additionalData.zoningInspectionSchedule || selectedApplication.additionalData.inspectionSchedule).notes}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">Endorsement Status</h3>
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      ["UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status || "") || (selectedApplication.status === "EVALUATED" && selectedApplication.additionalData?.zoningStatus === "EVALUATED")
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500"
                        : "bg-amber-100 dark:bg-amber-500/20 text-amber-500"
                    )}>
                      {["UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status || "") || (selectedApplication.status === "EVALUATED" && selectedApplication.additionalData?.zoningStatus === "EVALUATED") ? (
                        <Check className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 dark:text-white text-sm leading-snug">Endorsement to Treasury</p>
                      <p className="text-xs text-slate-500 leading-normal">
                        {["UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status || "") || (selectedApplication.status === "EVALUATED" && selectedApplication.additionalData?.zoningStatus === "EVALUATED")
                          ? "Endorsed successfully to Treasury"
                          : !["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status || "")
                            ? "Awaiting Engineering and Zoning approval"
                            : "Awaiting Zoning approval"}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 w-fit sm:self-center self-start sm:ml-0 ml-14",
                    selectedApplication.isCancelled || selectedApplication.status === "REJECTED"
                      ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                      : selectedApplication.status === "UNPAID"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                        : ["PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status || "") || (selectedApplication.status === "EVALUATED" && selectedApplication.additionalData?.zoningStatus === "EVALUATED")
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                  )}>
                    {selectedApplication.isCancelled
                      ? "Cancelled"
                      : selectedApplication.status === "REJECTED"
                        ? "Rejected"
                        : selectedApplication.status === "UNPAID"
                          ? "Unpaid"
                          : ["PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status || "") || (selectedApplication.status === "EVALUATED" && selectedApplication.additionalData?.zoningStatus === "EVALUATED")
                            ? "Endorsed"
                            : "Awaiting"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description of Work</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase italic">{selectedApplication.additionalData?.descriptionOfWork || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Occupancy / Use</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase italic">{selectedApplication.additionalData?.occupancyUse || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimated Cost</p>
                  <p className="font-bold text-theme-primary mt-1 text-base">₱{parseFloat(selectedApplication.additionalData?.estimatedCost || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location of Construction</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase italic">{selectedApplication.additionalData?.locationOfConstruction || "N/A"}</p>
                </div>
              </div>

              <div className="pt-6 flex flex-wrap justify-end gap-4">
                {selectedApplication.status === "FOR_REVISION" && (
                  <button
                    onClick={() => {
                      setIsRevision(true);
                      setCurrentStep("PROFILE");
                    }}
                    className="px-6 py-3 bg-theme-primary hover:bg-theme-primary/90 text-white rounded-full font-black uppercase tracking-widest text-xs shadow-md"
                  >
                    Edit & Resubmit Application
                  </button>
                )}
                {selectedApplication.status === "FOR_REQUESTING" && !selectedApplication.isCancelled && (
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="px-6 py-3 border border-red-200 hover:bg-red-50 text-red-600 rounded-full font-black uppercase tracking-widest text-xs"
                  >
                    Cancel Application
                  </button>
                )}
                {!selectedApplication.isCancelled && !["REJECTED", "CANCELLED"].includes(selectedApplication.status) && (
                  <button
                    disabled={["FOR_REQUESTING", "FOR_INSPECTION", "FOR_REINSPECTION", "EVALUATED", "FOR_REVISION"].includes(selectedApplication.status)}
                    onClick={() => {
                      if (["FOR_REQUESTING", "FOR_INSPECTION", "FOR_REINSPECTION", "EVALUATED", "FOR_REVISION"].includes(selectedApplication.status)) {
                        return;
                      }
                      setCurrentStep("TREASURY");
                    }}
                    className="px-6 py-3 bg-theme-primary text-white rounded-full font-black uppercase tracking-widest text-xs disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    {["FOR_REQUESTING", "FOR_INSPECTION", "FOR_REINSPECTION", "EVALUATED", "FOR_REVISION"].includes(selectedApplication.status)
                      ? (selectedApplication.status === "FOR_REVISION" ? "Awaiting Resubmission" : "Awaiting Treasury Billing")
                      : "Next: Treasury & Zoning"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-start pt-8">
              <button
                onClick={() => {
                  setCurrentStep("EXISTING");
                  setSelectedApplication(null);
                }}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-white font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-full transition-colors"
              >
                Back to Applications List
              </button>
            </div>
          </div>
        )}

        {currentStep === "TREASURY" && selectedApplication && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Treasury & <span className="text-theme-primary italic">Clearances</span>
              </h2>
              <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                Manage your payment proof and verify necessary clearances (BFP and zoning).
              </p>
            </div>

            <div className="bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 max-w-3xl mx-auto space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fulfillment Type</p>
                    <p className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-md">{selectedApplication.fulfillmentType || "CLAIM"}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-amber-200">
                    {selectedApplication.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 md:p-6 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">Payment Processing</h4>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-black/30">
                  <p className="text-[9px] font-black italic uppercase tracking-widest text-theme-primary">Endorsed Fees Summary</p>
                  <div className="mt-3 space-y-3 text-xs font-bold text-slate-500 dark:text-slate-300">
                    {(() => {
                      const rawFiscal = selectedApplication.fiscalSnapshot;
                      const snap = (typeof rawFiscal === "string" ? JSON.parse(rawFiscal) : rawFiscal) as any || {};
                      const lineItems: { label: string; amount: number }[] = (snap.lineItems || []).filter((i: any) => Number(i.amount) > 0);

                      if (lineItems.length > 0) {
                        return lineItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between gap-4">
                            <span>{item.label}</span>
                            <span>₱{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ));
                      }

                      // Fallback: show Building Permit Fee from baseAmount
                      return (
                        <div className="flex justify-between gap-4">
                          <span>Building Permit Fee</span>
                          <span>₱{Number(snap.baseAmount ?? selectedApplication.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })()}
                    {Number(selectedApplication.fiscalSnapshot?.deliveryFee || 0) > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>Delivery Service</span>
                        <span>₱{Number(selectedApplication.fiscalSnapshot.deliveryFee).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-dashed border-slate-300 pt-5">
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-white">Total Amount</span>
                    <span className="text-xl font-black text-theme-primary">₱{Number(selectedApplication.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </section>

              {(() => {
                const officialReceiptUrl =
                  selectedApplication.orUrl ||
                  selectedApplication.additionalData?.orDocumentUrl ||
                  selectedApplication.additionalData?.treasuryReceiptUrl;
                if (!officialReceiptUrl && !selectedApplication.additionalData?.treasuryRemarks) return null;

                return (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-left dark:border-white/10 dark:bg-black/30">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <Receipt className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Treasury Record</p>
                          <p className="text-sm font-black uppercase text-slate-800 dark:text-white">Official Receipt (OR)</p>
                        </div>
                      </div>
                      {officialReceiptUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewerFile(null);
                            setViewerUrl(officialReceiptUrl);
                            setViewerTitle("Official Treasury Receipt");
                            setViewerOpen(true);
                          }}
                          className="rounded-full border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          View OR
                        </button>
                      )}
                    </div>

                    {selectedApplication.additionalData?.orSeriesNumber && (
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        OR Number: <span className="text-slate-800 dark:text-white">{selectedApplication.additionalData.orSeriesNumber}</span>
                      </p>
                    )}

                    {selectedApplication.additionalData?.treasuryRemarks && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Treasury Remarks / Notes</p>
                        <p className="mt-2 whitespace-pre-wrap text-xs font-semibold italic leading-relaxed text-slate-700 dark:text-slate-300">
                          &ldquo;{selectedApplication.additionalData.treasuryRemarks}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedApplication.status === "UNPAID" && (() => {
                const payRef = selectedApplication.paymentReference;
                const gcashRef = selectedApplication.additionalData?.gcashReferenceNo;

                if (payRef) {
                  // Already paid — show reference details
                  return (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-6 space-y-4">
                      <h4 className="font-black uppercase tracking-widest text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                        <Check className="w-4 h-4" /> Payment Submitted — Pending Verification
                      </h4>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Your payment has been submitted and is currently being verified by the Treasury Office. No further action is needed at this time.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 bg-white dark:bg-black/35 rounded-xl border border-slate-200 dark:border-white/5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Assessment Amount</p>
                          <p className="font-black text-2xl text-theme-primary mt-1">₱{parseFloat(selectedApplication.totalAmount || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-black/35 rounded-xl border border-slate-200 dark:border-white/5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Reference No.</p>
                          <p className="font-black text-sm text-slate-800 dark:text-white mt-1 break-all">{gcashRef || payRef}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-full font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                      >
                        <Receipt className="w-4 h-4" /> View Payment Details
                      </button>
                    </div>
                  );
                }

                // Not yet paid — show proceed to payment
                return (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-6 space-y-4">
                    <h4 className="font-black uppercase tracking-widest text-xs flex items-center gap-2 text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4" /> Pending Payment
                    </h4>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Please pay the total amount at the Municipal Hall or via GCash, then upload your payment receipt below.</p>
                    
                    <div className="p-4 bg-white dark:bg-black/35 rounded-xl border border-slate-200 dark:border-white/5 w-fit">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Assessment Amount</p>
                      <p className="font-black text-2xl text-theme-primary mt-1">₱{parseFloat(selectedApplication.totalAmount || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>

                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="px-6 py-3 bg-theme-primary hover:bg-theme-primary/90 text-white rounded-full font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-md"
                    >
                      <CreditCard className="w-4 h-4" /> Proceed to Payment
                    </button>
                  </div>
                );
              })()}

              {/* Clearances verification block (BFP and zoning) */}
              {["PAID", "FOR_PROCESSING", ...RELEASE_PHASE_STATUSES].includes(selectedApplication.status) && (
                <div className="space-y-6">
                  <h4 className="font-black uppercase tracking-widest text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <Check className="w-4 h-4 text-emerald-500" /> Payment Verified
                  </h4>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Your payment has been officially verified! The permit will continue to the next phase once processing is complete.</p>

                  {selectedApplication.additionalData?.clearanceRevisionReason && !selectedApplication.additionalData?.clearancesSubmitted && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Revision Required</p>
                      <p className="mt-1 text-xs font-medium text-amber-800">{selectedApplication.additionalData.clearanceRevisionReason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-between gap-4 pt-8">
              <button
                onClick={() => {
                  setCurrentStep("EVALUATION");
                }}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-white font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-full transition-colors"
              >
                Back to Evaluation
              </button>
              <button
                disabled={selectedApplication.status !== "PAID"}
                onClick={() => {
                  if (selectedApplication.status !== "PAID") return;
                  setCurrentStep("SUBMIT");
                }}
                className="px-8 py-3 bg-theme-primary text-white rounded-full text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {selectedApplication.status === "PAID" ? "Next: Submission" : "Awaiting Payment"}
              </button>
            </div>
          </div>
        )}

        {currentStep === "SUBMIT" && (!selectedApplication || isRevision) && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-3 md:space-y-4 text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight flex items-center justify-center gap-4">
                <FileSignature className="w-10 h-10 md:w-12 md:h-12 text-slate-800 dark:text-white" />
                <span className="text-slate-800 dark:text-white">Verification & <span className="text-theme-primary italic">Submit</span></span>
              </h2>
              <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto">Verify your details and apply your digital signature to acknowledge the building application.</p>
            </div>

            <div className="bg-white/40 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] p-6 md:p-8 relative group hover:border-theme-primary/30 transition-all duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity rounded-l-2xl"></div>
              <div className="flex items-center gap-2 mb-4">
                <Book className="w-5 h-5 text-theme-primary" />
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">Digital Signature Required</h3>
              </div>
              {!isEditable ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Your digital signature was recorded with this application submission:</p>
                  {selectedApplication?.additionalData?.signature ? (
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 bg-white max-w-md">
                      <img src={selectedApplication.additionalData.signature} alt="Digital Signature" className="max-h-32 object-contain mx-auto" />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No signature was saved for this application.</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mb-6">Please sign to acknowledge that all information provided is true and correct.</p>
                  {isRevision && signatureData && (
                    <div className="mb-4">
                      <p className="text-xs text-emerald-600 font-bold mb-2">Previous Signature (You can resign below to update):</p>
                      <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 bg-white max-w-md">
                        <img src={signatureData} alt="Digital Signature" className="max-h-32 object-contain mx-auto" />
                      </div>
                    </div>
                  )}
                  <div className={cn("rounded-xl overflow-hidden bg-white transition-all", showValidationErrors && !signatureData ? "border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border border-slate-200 dark:border-white/10")}>
                    <SignaturePad
                      onSave={(dataUrl) => {
                        setSignatureData(dataUrl);
                        toast.success("Signature captured successfully. Ready to submit!");
                      }}
                    />
                  </div>
                  {signatureData && (
                    <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                      <CheckCircle className="w-4 h-4" /> Signature captured successfully. Ready to submit!
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Data Privacy Agreement Block */}
            <div className="mt-8">
              <div
                onClick={() => {
                  if (privacyAccepted) {
                    setPrivacyAccepted(false);
                  } else {
                    setIsPrivacyModalOpen(true);
                  }
                }}
                className={cn(
                  "p-6 rounded-2xl border flex items-start gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all select-none",
                  privacyAccepted ? "bg-emerald-500/[0.03] border-emerald-500/30 text-emerald-700 dark:text-emerald-400" :
                    (showValidationErrors && !privacyAccepted) ? "border-red-500 bg-red-500/[0.02] shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" :
                      "bg-white/40 dark:bg-white/5 border-slate-200 dark:border-white/10"
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors", privacyAccepted ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-white/20")}>
                    {privacyAccepted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
                <div className="space-y-1 text-left">
                  <h4 className="text-sm font-black uppercase tracking-wider italic">
                    Data Privacy &amp; Consent Agreement <span className="text-red-500 font-bold">*</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    I declare under oath that all files, properties, and documents uploaded match the physical copy on file, and I voluntarily consent to the Local Government Unit processing my data pursuant to the Data Privacy Act of 2012.
                  </p>
                </div>
              </div>
            </div>

            <PrivacyTermsModal
              isOpen={isPrivacyModalOpen}
              themeColor = "var(--primary-theme)"
              onClose={() => setIsPrivacyModalOpen(false)}
              onAccept={() => {
                setPrivacyAccepted(true);
                setIsPrivacyModalOpen(false);
              }}
            />

            <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6">
              <button
                onClick={() => {
                  setCurrentStep("DOCUMENTS");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 dark:border-white/20 rounded-full transition-colors shadow-sm"
              >
                ← Back to Uploads
              </button>
              {isEditable && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-theme-primary hover:bg-theme-primary/90 disabled:bg-slate-300 disabled:text-slate-500 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all shadow-xl shadow-theme-primary/20 w-full md:w-auto ml-auto"
                >
                  {isSubmitting ? "Submitting Application..." : "Submit Building Permit Application"}
                  {!isSubmitting && <span className="text-xl leading-none">✓</span>}
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === "SUBMIT" && selectedApplication && !isRevision && (RELEASE_PHASE_STATUSES.includes(selectedApplication.status) || hasTreasuryClearances(selectedApplication) || selectedApplication.status === "PAID") && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-xl dark:border-white/10 dark:bg-[#11131a] dark:text-white md:p-10">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 px-6 py-10 text-center md:px-12 dark:border-white/10 dark:bg-white/5">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-theme-primary shadow-md ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/10">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="mt-7 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Application Status</h2>
                <p className="mt-3 text-xl font-black uppercase tracking-widest text-emerald-400 dark:text-emerald-300">
                  {selectedApplication.status === "FOR_CLAIM"
                    ? "Ready to Claim!"
                    : selectedApplication.status === "FOR_PICKING"
                      ? "Ready for Delivery!"
                      : selectedApplication.status === "DELIVERED"
                        ? "Permit Delivered!"
                        : "Application Processing"}
                </p>
                <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                  {selectedApplication.status === "FOR_CLAIM"
                    ? "Your building permit has been approved and the digital copy is now available below."
                    : selectedApplication.status === "FOR_PICKING"
                      ? "Your approved building permit is being prepared for home delivery."
                      : selectedApplication.status === "DELIVERED"
                        ? "Your building permit release process has been completed."
                        : "Your application is being processed. You will be notified once your permit is ready for release."}
                </p>

                {selectedApplication.eCopyUrl ? (
                  <div className="mx-auto mt-8 max-w-3xl space-y-4">
                    <div className="flex flex-col items-stretch gap-5 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/5 p-6 text-left md:flex-row md:items-center md:justify-between dark:bg-emerald-500/10">
                      <div className="flex items-start gap-4 md:items-center">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">Official Permit E-Copy</p>
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Your approved building permit is ready for preview.</p>
                          {selectedApplication.status === "RELEASED" && (
                            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-widest text-emerald-600/80 dark:text-emerald-300/80">
                              Released on: {new Date(selectedApplication.deliveredAt || selectedApplication.updatedAt || Date.now()).toLocaleDateString("en-PH")} {new Date(selectedApplication.deliveredAt || selectedApplication.updatedAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 justify-center md:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setViewerFile(null);
                            setViewerUrl(selectedApplication.eCopyUrl);
                            setViewerTitle("Official Building Permit E-Copy");
                            setViewerOpen(true);
                          }}
                          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-emerald-600"
                        >
                          <FileText className="h-4 w-4" /> Preview
                        </button>
                      </div>
                    </div>

                    {selectedApplication.additionalData?.zoningClearanceUrl && (
                      <div className="flex flex-col items-stretch gap-5 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/5 p-6 text-left md:flex-row md:items-center md:justify-between dark:bg-emerald-500/10">
                        <div className="flex items-start gap-4 md:items-center">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div className="text-center md:text-left">
                            <p className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">Zoning / Locational Clearance</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Your approved zoning clearance is ready for preview.</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 justify-center md:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setViewerFile(null);
                              setViewerUrl(selectedApplication.additionalData.zoningClearanceUrl);
                              setViewerTitle("Zoning Clearance");
                              setViewerOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-emerald-600"
                          >
                            <FileText className="h-4 w-4" /> Preview
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedApplication.additionalData?.bfpClearanceUrl && (
                      <div className="flex flex-col items-stretch gap-5 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/5 p-6 text-left md:flex-row md:items-center md:justify-between dark:bg-emerald-500/10">
                        <div className="flex items-start gap-4 md:items-center">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div className="text-center md:text-left">
                            <p className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">BFP Fire Safety Clearance</p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Your approved fire safety clearance is ready for preview.</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 justify-center md:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setViewerFile(null);
                              setViewerUrl(selectedApplication.additionalData.bfpClearanceUrl);
                              setViewerTitle("BFP Clearance");
                              setViewerOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-emerald-600"
                          >
                            <FileText className="h-4 w-4" /> Preview
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto mt-8 max-w-2xl rounded-2xl border-2 border-dashed border-[#1e293b] bg-slate-50/50 p-6 text-center dark:border-white/50 dark:bg-white/5">
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e293b] text-white dark:bg-white dark:text-slate-900">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          <span className="font-black">Digital Copy</span> of your documents will be available here upon release
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          You can preview your approved permit directly from this page.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mx-auto mt-6 flex max-w-3xl items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left dark:border-white/10 dark:bg-black/30">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
                  <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    <span className="font-black text-slate-800 dark:text-white">RA 10173 (Data Privacy Act of 2012) Compliance:</span>{" "}
                    Your personal information is collected for building permit processing only and will not be shared with third parties without your consent.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentStep("TREASURY")}
                className="mt-8 rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                ← Back to Treasury & Zoning
              </button>
            </div>
          </div>
        )}

        {currentStep === "SUBMIT" && selectedApplication && !isRevision && !(RELEASE_PHASE_STATUSES.includes(selectedApplication.status) || hasTreasuryClearances(selectedApplication) || selectedApplication.status === "PAID") && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
              <Hourglass className="mx-auto mb-4 h-14 w-14 animate-pulse text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Application Status</p>
              <h2 className="mt-2 text-3xl font-black uppercase text-slate-900 dark:text-white">
                {selectedApplication.status.replace(/_/g, " ")}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-300">
                Your Building Permit is still being processed. The Submission phase will become available once it is ready for claiming or delivery.
              </p>
              <button
                type="button"
                onClick={() => setCurrentStep("TREASURY")}
                className="mt-6 rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                Back to Treasury & Clearances
              </button>
            </div>
          </div>
        )}

      </div>

      <PaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        amount={
          Number(selectedApplication?.fiscalSnapshot?.baseAmount) ||
          Math.max(
            0,
            Number(selectedApplication?.totalAmount || 0) -
              Number(selectedApplication?.fiscalSnapshot?.deliveryFee || 0),
          )
        }
        transactionId={selectedApplication?.id || ""}
        initialFulfillment={selectedApplication?.fulfillmentType === "DELIVERY" ? "DELIVERY" : "PICK_UP"}
        initialAddress={{
          ...(selectedApplication?.deliveryAddress || {}),
          barangay: selectedApplication?.deliveryAddress?.barangay || residentData?.barangay || "",
          houseNumber: selectedApplication?.deliveryAddress?.houseNumber || residentData?.houseNumber || "",
          street: selectedApplication?.deliveryAddress?.street || residentData?.street || "",
          sitio: selectedApplication?.deliveryAddress?.sitio || residentData?.sitio || "",
          purok: selectedApplication?.deliveryAddress?.purok || residentData?.purok || "",
          municipality: selectedApplication?.deliveryAddress?.municipality || residentData?.municipality || "",
          province: selectedApplication?.deliveryAddress?.province || residentData?.province || "",
          landmark: selectedApplication?.deliveryAddress?.landmark || selectedApplication?.deliveryLandmark || "",
        }}
        onBeforeCheckout={handleSaveCheckoutDetails}
        referenceName="Building Permit Payment"
        redirectPath="/modules/building-permit"
      />

      {/* Cancel Application Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="bg-white dark:bg-[#0f111a] border-slate-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-2">
              <FileWarning className="w-6 h-6 text-red-500" /> Cancel Application?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed mt-2">
              Are you sure you want to cancel this building permit application? This action will cancel your submission permanently and it cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-full font-bold uppercase tracking-widest text-[10px] px-6">No, Keep It</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[10px] px-6 shadow-md"
              onClick={confirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Yes, Cancel Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

const SignaturePad = ({ onSave }: { onSave: (dataUrl: string) => void }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [isUploadedSignature, setIsUploadedSignature] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isUploadedSignature) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offsetX, offsetY;
    if ('touches' in e) {
      const rect = canvas.getBoundingClientRect();
      offsetX = e.touches[0].clientX - rect.left;
      offsetY = e.touches[0].clientY - rect.top;
    } else {
      offsetX = e.nativeEvent.offsetX;
      offsetY = e.nativeEvent.offsetY;
    }

    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isUploadedSignature || !isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offsetX, offsetY;
    if ('touches' in e) {
      const rect = canvas.getBoundingClientRect();
      offsetX = e.touches[0].clientX - rect.left;
      offsetY = e.touches[0].clientY - rect.top;
    } else {
      offsetX = e.nativeEvent.offsetX;
      offsetY = e.nativeEvent.offsetY;
    }

    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsUploadedSignature(false);
  };

  const handleSave = () => {
    if (isUploadedSignature) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height,
          centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);

        setIsUploadedSignature(true);
        onSave(canvas.toDataURL('image/png'));
      }
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col items-center w-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={250}
        className={cn(
          "w-full h-[250px] cursor-crosshair touch-none transition-all",
          isUploadedSignature && "pointer-events-none opacity-80"
        )}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="p-4 bg-slate-50 dark:bg-black/40 w-full flex justify-center gap-4 border-t border-slate-200 dark:border-white/10 flex-wrap">
        <button onClick={clearCanvas} className="px-6 py-2 rounded-full border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 text-sm font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
          Clear
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 rounded-full border border-blue-300 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
          <UploadCloud className="w-4 h-4" />
          Upload E-Signature
        </button>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button
          onClick={handleSave}
          disabled={isUploadedSignature}
          className={cn(
            "px-6 py-2 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 shadow-md hover:bg-emerald-600 transition-colors",
            isUploadedSignature && "opacity-50 cursor-not-allowed"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
          Save Signature
        </button>
      </div>
    </div>
  );
}
