/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import SecureIdleTimer from "@/components/shared/SecureIdleTimer";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import lguConfig from "@/lgu.config.json";
import {
  Book,
  CheckCircle,
  ClipboardList,
  FileSignature,
  FileText,
  Flame,
  Home,
  CreditCard,
  Landmark,
  MapPin,
  PenTool,
  Ruler,
  UploadCloud,
  User,
  Clock,
  AlertCircle,
  FileWarning,
  Building2,
  CheckCircle2,
  Upload,
  Shield,
  Hourglass,
  Receipt,
  Check,
  Hash,
  UserCheck,
  Camera,
  BadgeCheck
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { submitOccupancyPermit, saveTransactionSignature, getExistingOccupancyPermits, resubmitOccupancyPermit, submitOccupancyPermitPaymentProof, checkActivePropertyPermit, cancelTransaction, getSecureUploadUrlsAction } from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compression";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";
import QRCode from "qrcode";

const mapWithConcurrency = async (items: any[], limit: number, fn: (item: any) => Promise<any>) => { for (const item of items) await fn(item); };

const STEPS = [
  { id: "GUIDE", label: "Guide", icon: ClipboardList },
  { id: "PROFILE", label: "Profile", icon: User },
  { id: "DOCUMENTS", label: "Upload", icon: Upload },
  { id: "EVALUATION", label: "Evaluation", icon: Building2 },
  { id: "BFP", label: "BFP", icon: Landmark },
  { id: "SUBMIT", label: "Submit", icon: CheckCircle2 },
];

const getEngineeringStatusLabel = (status: string) => {
  switch (status) {
    case "FOR_REQUESTING":
      return "FOR EVALUATION";
    case "FOR_REVISION":
      return "NEEDS REVISION";
    case "FOR_INSPECTION":
      return "FOR INSPECTION";
    case "FOR_REINSPECTION":
      return "FOR REINSPECTION";
    case "REJECTED":
      return "REJECTED";
    case "EVALUATED":
    case "UNPAID":
    case "PAID":
    case "FOR_PROCESSING":
    case "FOR_CLAIM":
    case "FOR_PICKING":
    case "RELEASED":
    case "DELIVERED":
      return "APPROVED";
    default:
      return status.replace(/_/g, ' ');
  }
};

const getDisplayStatusDetails = (app: any) => {
  if (app.isCancelled || app.status === "CANCELLED") {
    return { label: "CANCELLED", colorClass: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500" };
  }
  if (app.status === "REJECTED" || (app.status === "EVALUATED" && app.additionalData?.zoningStatus === "REJECTED")) {
    return { 
      label: app.status === "REJECTED" ? "REJECTED" : "ZONING REJECTED", 
      colorClass: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500" 
    };
  }
  if (app.status === "RELEASED" || app.status === "DELIVERED") {
    return { 
      label: app.status.replace(/_/g, ' '),
      colorClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500"
    };
  }
  
  if (app.status === "EVALUATED" && app.additionalData?.zoningStatus) {
    if (app.additionalData.zoningStatus === "EVALUATED") {
      return { label: "ZONING EVALUATED", colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500" };
    }
    return { 
      label: `ZONING ${app.additionalData.zoningStatus.replace(/_/g, ' ')}`,
      colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
    };
  }

  return { 
    label: app.status ? app.status.replace(/_/g, ' ') : "PENDING", 
    colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500" 
  };
};

export default function OccupancyPermitPage() {
  const router = useRouter();
  const [themeColor, setThemeColor] = useState("var(--primary-theme)");
  useEffect(() => {
    Promise.resolve({ success: true, data: "var(--primary-theme)" }).then((res: any) => {
      if (res.success && res.data) {
        setThemeColor(res.data);
      }
    });
  }, []);

  const [currentStep, setCurrentStep] = useState("GUIDE");
  const [hasReadGuide, setHasReadGuide] = useState(true);
  const [existingApplications, setExistingApplications] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [residentData, setResidentData] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevision, setIsRevision] = useState(false);
  const [isZoningRevision, setIsZoningRevision] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentPreviewUrl, setPaymentPreviewUrl] = useState<string | null>(null);
  const [gcashReferenceNo, setGcashReferenceNo] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerFile, setViewerFile] = useState<File | null>(null);

  const isEditable = !selectedApplication || isRevision || isZoningRevision;

  const isFieldRequested = (key: string) => {
    if (!isRevision && !isZoningRevision) return true;
    let requested = false;
    if (isRevision && selectedApplication?.additionalData?.revisionRequests) {
      requested = requested || selectedApplication.additionalData.revisionRequests.some((req: any) => req.key === key);
    }
    if (isZoningRevision && selectedApplication?.additionalData?.zoningRevisionRequests) {
      requested = requested || selectedApplication.additionalData.zoningRevisionRequests.some((req: any) => req.key === key);
    }
    return requested;
  };

  const effectiveDocuments = (() => {
    const docs = selectedApplication?.additionalData?.documents || {};
    if (!isRevision && !isZoningRevision) return docs;
    const filtered: Record<string, string> = {};
    const revisionKeys: string[] = [];
    const additionalData = selectedApplication?.additionalData as any;
    if (isRevision && additionalData?.revisionRequests) {
      additionalData.revisionRequests.forEach((r: any) => {
        if (r?.key) revisionKeys.push(r.key);
      });
    }
    if (isZoningRevision && additionalData?.zoningRevisionRequests) {
      additionalData.zoningRevisionRequests.forEach((r: any) => {
        if (r?.key) revisionKeys.push(r.key);
      });
    }
    for (const [k, v] of Object.entries(docs)) {
      if (revisionKeys.indexOf(k) === -1) {
        filtered[k] = v as string;
      }
    }
    return filtered;
  })();
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [idChoice, setIdChoice] = useState<"PROFILE" | "UPLOAD">("PROFILE");
  const [activeDocTab, setActiveDocTab] = useState<"REQUIREMENTS" | "PERMITS">("REQUIREMENTS");
  const [uploadedRequirements, setUploadedRequirements] = useState<Record<number, any>>({});
  const abandonedFilesRef = React.useRef<string[]>([]);

  useEffect(() => {
    return () => {
      if (abandonedFilesRef.current.length > 0) {
        navigator.sendBeacon("/api/upload/cleanup", JSON.stringify({ urls: abandonedFilesRef.current }));
      }
    };
  }, []);

  
  const handoffStorageKey = (slot: string) => `lgu_kiosk_occupancy_permit_handoff_${slot}`;
  const [handoffToken, setHandoffToken] = useState("");
  const [handoffQrCode, setHandoffQrCode] = useState("");
  const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
  const [handoffSessionSlot, setHandoffSessionSlot] = useState<"tct" | "documents" | "bfp" | "zoning">("tct");
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);
  const [handoffDocuments, setHandoffDocuments] = useState<Record<string, { fileName: string; url: string }>>({});

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
          if (result.sessionSlot === "documents" || result.sessionSlot === "occupancy_documents") {
            setHandoffDocuments(previous => ({
              ...previous,
              ...Object.fromEntries(
                files.map((file: { slot: string; fileName: string; url: string }) => [
                  file.slot,
                  { fileName: file.fileName, url: file.url }
                ])
              )
            }));

            const requiredSlots = [0, 1, 2, 3, 4].map(idx => `req_${idx}`);
            const uploadedSlots = new Set([
              ...Object.keys(effectiveDocuments || {}).filter(k => k.startsWith("req_")),
              ...Object.keys(uploadedRequirements).map(k => `req_${k}`),
              ...files.map((f: { slot: string }) => f.slot),
            ]);
            const allRequiredUploaded = requiredSlots.every(slot => uploadedSlots.has(slot));
            if (allRequiredUploaded) {
              setIsHandoffOpen(false);
              setHandoffToken("");
              setHandoffQrCode("");
              setHandoffExpiresAt(0);
              toast.success("All 5 required documents were received via QR upload.");
            }
          }
        } else if (!response.ok) {
          setIsHandoffOpen(false);
          setHandoffToken("");
          toast.error(result.error || "The QR upload session expired.");
        }
      } catch (error) {
        console.error("Upload handoff polling error:", error);
      }
    }, 2500);
    return () => window.clearInterval(poll);
  }, [effectiveDocuments, handoffToken, uploadedRequirements]);

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
          context: slot === "documents" ? { module: "occupancy" } : undefined
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


  const [formData, setFormData] = useState({
    occupancyApplicationType: "FULL", // "FULL" | "PARTIAL"
    buildingPermitNo: "",
    buildingPermitDateIssued: "",
    fsecNo: "",
    fsecDateIssued: "",
    nameOfProject: "",
    locationOfProject: "",
    useCharacterOfOccupancy: "",
    noOfStoreys: "",
    noOfUnits: "",
    totalGrossFloorArea: "",
    dateOfCompletion: "",
    contactNumber: "",
    newIdFile: null as any | null,
    newIdFileBack: null as any | null,
  });

  const [uploadedPermits, setUploadedPermits] = useState<Record<number, any>>({});
  const [customRequirements, setCustomRequirements] = useState<{ label: string }[]>([]);
  const [, setCustomPermits] = useState<{ label: string }[]>([]);
  const [isAddCustomDocOpen, setIsAddCustomDocOpen] = useState(false);
  const [customDocName, setCustomDocName] = useState("");

  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [duplicatePropertyWarning, setDuplicatePropertyWarning] = useState<{ isProcessing: boolean } | null>(null);

  useEffect(() => {
    if (!formData.locationOfProject || formData.locationOfProject.trim().length < 5) {
      setDuplicatePropertyWarning(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await checkActivePropertyPermit(
          formData.locationOfProject,
          selectedApplication?.id
        );
        if (res.success && res.isProcessing) {
          setDuplicatePropertyWarning({
            isProcessing: true
          });
        } else {
          setDuplicatePropertyWarning(null);
        }
      } catch (err) {
        console.error(err);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.locationOfProject, selectedApplication?.id]);

  const [maxStepIdx, setMaxStepIdx] = useState(0);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const prevFormDataRef = React.useRef(formData);

  useEffect(() => {
    if (prevFormDataRef.current !== formData) {
      prevFormDataRef.current = formData;
      if (privacyAccepted) {
        setPrivacyAccepted(false);
      }
    }
  }, [formData, privacyAccepted]);

  useEffect(() => {
    const currentStepIdx = STEPS.findIndex(s => s.id === currentStep);
    if (currentStepIdx > maxStepIdx) {
      setMaxStepIdx(currentStepIdx);
    }
  }, [currentStep, maxStepIdx]);

  const isAffidavitOfConsentRequired = false;
  const hasMultipleFloors = parseInt(formData.noOfStoreys || "0", 10) > 1;
  const requiredRequirementIndexes = [0, 1, 2, 3, 4];
  const requiredRequirementsCount = requiredRequirementIndexes.length;
  const uploadedRequirementKeys = new Set([
    ...Object.keys(effectiveDocuments || {}).filter(k => k.startsWith("req_")),
    ...Object.keys(uploadedRequirements).map(k => `req_${k}`),
    ...Object.keys(handoffDocuments).filter(k => k.startsWith("req_"))
  ]);
  const requirementsProgress = requiredRequirementIndexes
    .filter(index => uploadedRequirementKeys.has(`req_${index}`)).length;

  const uploadedRequirementsCount = uploadedRequirementKeys.size;

  const hasActiveApplication = existingApplications.some(app =>
    !["RELEASED", "REJECTED", "DELIVERED", "CANCELLED"].includes(app.status) && !app.isCancelled
  );

  const documentRequirementsList = [
    "Duly Notarized Certificate of Completion",
    "Construction Logbook, signed and sealed by Owner's Architect and Civil Engineer",
    "As-Built Plans, signed and sealed by the Owner's Architect and Civil Engineer",
    "Valid Licenses of All Involved Professionals",
    "Captioned Photographs of Site and Completed Building/Structure (Front, Sides, and Rear Areas)",
    "Duly Notarized Affidavit of Undertaking (Optional)"
  ];

  const permitTypesList: string[] = [];

  useEffect(() => {
    async function init() {
      try {
        const savedResident = window.sessionStorage.getItem("active_resident");
        if (!savedResident) return;
        const resData = JSON.parse(savedResident);
        const userId = resData.userId || resData.id;
        const res = { success: true, data: resData };
        const permitsRes = await getExistingOccupancyPermits(userId);
        if (res.success && res.data) {
          const resData = res.data;
          setResidentData(resData);
          setFormData(prev => ({
            ...prev,
            contactNumber: prev.contactNumber || resData.contactNumber || ""
          }));
        }
        if (permitsRes.success && permitsRes.data.length > 0) {
          setExistingApplications(permitsRes.data);
          setCurrentStep("EXISTING");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (selectedApplication) {
      const addData = selectedApplication.additionalData as any || {};
      setFormData({
        occupancyApplicationType: addData.occupancyApplicationType || "FULL",
        buildingPermitNo: addData.buildingPermitNo || "",
        buildingPermitDateIssued: addData.buildingPermitDateIssued || "",
        fsecNo: addData.fsecNo || "",
        fsecDateIssued: addData.fsecDateIssued || "",
        nameOfProject: addData.nameOfProject || "",
        locationOfProject: addData.locationOfProject || "",
        useCharacterOfOccupancy: addData.useCharacterOfOccupancy || "",
        noOfStoreys: addData.noOfStoreys || "",
        noOfUnits: addData.noOfUnits || "",
        totalGrossFloorArea: addData.totalGrossFloorArea || "",
        dateOfCompletion: addData.dateOfCompletion || "",
        contactNumber: addData.contactNumber || selectedApplication.residentSnapshot?.contactNumber || "",
        newIdFile: null,
        newIdFileBack: null,
      });
      if (addData.signature) {
        setSignatureUrl(addData.signature);
      }
      if (addData.documents?.newIdFile) {
        setIdChoice("UPLOAD");
      } else {
        setIdChoice("PROFILE");
      }

      // Load custom requirements
      const docs = addData.documents || {};
      const labels = addData.customLabels || {};
      
      const loadedReqs: { label: string }[] = [];
      Object.keys(docs).forEach(key => {
        if (key.startsWith("req_")) {
          const idx = parseInt(key.replace("req_", ""), 10);
          if (idx >= documentRequirementsList.length) {
            const label = labels[key] || `Additional Document ${idx - documentRequirementsList.length + 1}`;
            loadedReqs[idx - documentRequirementsList.length] = { label };
          }
        }
      });
      const finalReqs: { label: string }[] = [];
      for (let i = 0; i < loadedReqs.length; i++) {
        finalReqs.push(loadedReqs[i] || { label: `Additional Document ${i + 1}` });
      }
      setCustomRequirements(finalReqs);

      // Load custom permits
      const loadedPermits: { label: string }[] = [];
      Object.keys(docs).forEach(key => {
        if (key.startsWith("permit_")) {
          const idx = parseInt(key.replace("permit_", ""), 10);
          if (idx >= permitTypesList.length) {
            const label = labels[key] || `Additional Document ${idx - permitTypesList.length + 1}`;
            loadedPermits[idx - permitTypesList.length] = { label };
          }
        }
      });
      const finalPermits: { label: string }[] = [];
      for (let i = 0; i < loadedPermits.length; i++) {
        finalPermits.push(loadedPermits[i] || { label: `Additional Document ${i + 1}` });
      }
      setCustomPermits(finalPermits);
    } else {
      setCustomRequirements([]);
      setCustomPermits([]);
    }
  }, [selectedApplication, documentRequirementsList.length, permitTypesList.length]);

  const handleAddCustomDocument = () => {
    setCustomDocName("");
    setIsAddCustomDocOpen(true);
  };

  const handleConfirmAddCustomDoc = () => {
    if (!customDocName || !customDocName.trim()) return;

    if (activeDocTab === "REQUIREMENTS") {
      setCustomRequirements(prev => [...prev, { label: customDocName.trim() }]);
    } else {
      setCustomPermits(prev => [...prev, { label: customDocName.trim() }]);
    }
    setIsAddCustomDocOpen(false);
  };



  const handlePaymentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let fileToProcess = file;
      if (file.type.startsWith("image/")) {
        try {
          toast.loading("Compressing and optimizing document...", { id: "image-compress-toast" });
          fileToProcess = await compressImage(file);
          toast.success("Image optimized successfully!", { id: "image-compress-toast" });
        } catch (err) {
          console.error("Compression error:", err);
          toast.dismiss("image-compress-toast");
        }
      }
      setPaymentFile(fileToProcess);
      setPaymentPreviewUrl(URL.createObjectURL(fileToProcess));
    }
  };

  const handleSubmitPaymentProof = async () => {
    if (!paymentFile || !selectedApplication) return;
    const toastId = toast.loading("Uploading Payment Receipt...");
    setIsSubmitting(true);
    try {
      const paymentFormData = new FormData();
      paymentFormData.append("paymentFile", paymentFile);
      if (gcashReferenceNo) {
        paymentFormData.append("gcashReferenceNo", gcashReferenceNo.trim());
      }
      const userId = residentData?.userId || residentData?.id;
      const res = await submitOccupancyPermitPaymentProof(selectedApplication.id, paymentFormData, userId);
      if (res.success) {
        toast.success("Payment Receipt uploaded successfully! Waiting for Treasury verification.", { id: toastId });
        setIsPaymentModalOpen(false);
        setPaymentFile(null);
        setPaymentPreviewUrl(null);
        setGcashReferenceNo("");

        // Refresh application data
        const appsRes = await getExistingOccupancyPermits(residentData?.userId || residentData?.id);
        if (appsRes.success && appsRes.data) {
          setExistingApplications(appsRes.data);
          const updated = appsRes.data.find((a: any) => a.id === selectedApplication.id);
          if (updated) setSelectedApplication(updated);
        }
      } else {
        toast.error(res.error || "Failed to upload payment receipt.", { id: toastId });
      }
    } catch {
      toast.error("An error occurred while submitting payment.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const requirements = [
    {
      id: 1,
      title: "Certificate of Completion",
      office: "Licensed Professionals",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      steps: [
        "Secure the official Certificate of Completion form from the Office of the Building Official.",
        "Have the Architect or Civil Engineer in-charge of construction sign and seal the document upon full completion.",
        "Ensure the owner or authorized representative signs the owner section.",
        "Have the document duly notarized by a Notary Public.",
        "Prepare 3 notarized original copies for submission."
      ],
      infoType: "important",
      infoLabel: "Mandatory Document",
      infoText: "Must be fully accomplished and notarized prior to submission."
    },
    {
      id: 2,
      title: "As-Built Plans & Specifications",
      office: "Licensed Professionals",
      icon: <Ruler className="w-5 h-5 text-slate-500" />,
      steps: [
        "Request your licensed Architect / Civil Engineer to prepare As-Built Architectural & Structural plans reflecting the actual completed building.",
        "Secure As-Built Sanitary/Plumbing plans signed and sealed by a licensed Sanitary Engineer or Master Plumber.",
        "Secure As-Built Electrical plans signed and sealed by a Professional Electrical Engineer (PEE).",
        "Ensure all sheets are duly signed by the owner and the respective licensed professionals with active PRC & PTR details.",
        "Submit 3 complete sets of blueprinted/printed plans."
      ],
      infoType: "tip",
      infoLabel: "As-Built Compliance",
      infoText: "Required whenever there are deviations or additions from the originally approved Building Permit plans."
    },
    {
      id: 3,
      title: "Construction Logbook",
      office: "Licensed Professionals",
      icon: <Book className="w-5 h-5 text-blue-500" />,
      steps: [
        "Retrieve the daily Construction Logbook kept at the job site during the entire construction period.",
        "Ensure all daily entries, inspection logs, and weather notes are duly signed by the Engineer/Architect in-charge.",
        "Verify that the logbook cover contains complete project details and professional seals.",
        "Submit the original logbook for verification by the Building Inspector."
      ],
      infoType: "note",
      infoLabel: "Inspection Basis",
      infoText: "Serves as official record of daily construction progress and structural testing."
    },
    {
      id: 4,
      title: "Valid Professional Licenses (PRC IDs) & PTRs",
      office: "Professional Regulation Commission / LGU",
      icon: <BadgeCheck className="w-5 h-5 text-indigo-500" />,
      steps: [
        "Obtain clear photocopies of the valid PRC License IDs of the Architect, Civil Engineer, Professional Electrical Engineer, and Sanitary Engineer / Master Plumber.",
        "Obtain photocopies of the current year Professional Tax Receipts (PTR) with official receipt details.",
        "Ensure signatures and dry seals of each professional are affixed on the copies."
      ],
      infoType: "time",
      infoLabel: "Validity Check",
      infoText: "PRC licenses and PTRs must be unexpired at the time of Occupancy Permit application."
    },
    {
      id: 5,
      title: "Captioned Photographs of Completed Building",
      office: "Applicant / Owner",
      icon: <Camera className="w-5 h-5 text-amber-500" />,
      steps: [
        "Take clear, high-resolution color photographs showing all sides of the completed structure (Front, Rear, Left, and Right elevations).",
        "Take interior photographs highlighting key areas, electrical panels, sanitary fixtures, and exit routes.",
        "Print photographs on standard bond paper or photo paper with descriptive captions indicating the view and date taken.",
        "Attach to the application folder for pre-inspection audit."
      ],
      infoType: "important",
      infoLabel: "Visual Verification",
      infoText: "Helps inspectors verify full completion prior to scheduling on-site final inspection."
    },
    {
      id: 6,
      title: "Fire Safety Inspection Certificate (FSIC for Occupancy)",
      office: "Bureau of Fire Protection (BFP)",
      icon: <Flame className="w-5 h-5 text-red-500" />,
      steps: [
        "Submit a request for Final Fire Safety Inspection at the local Bureau of Fire Protection (BFP) station.",
        "Present the approved Building Permit and Fire Safety Evaluation Clearance (FSEC).",
        "Accommodate BFP Fire Safety Inspectors for on-site inspection of fire extinguishers, emergency exits, and alarm systems.",
        "Pay the required Fire Code Fees at the BFP/Treasury Office.",
        "Claim the official Fire Safety Inspection Certificate (FSIC) for Occupancy."
      ],
      infoType: "important",
      infoLabel: "Critical Prerequisite",
      infoText: "The FSIC for Occupancy is strictly mandatory before the final Occupancy Permit can be released."
    },
    {
      id: 7,
      title: "Approved Building Permit & Ancillary Permits",
      office: "Office of the Building Official (OBO)",
      icon: <FileText className="w-5 h-5 text-slate-600" />,
      steps: [
        "Prepare a clear photocopy of the issued Building Permit.",
        "Include copies of issued Electrical Permit, Sanitary/Plumbing Permit, and Mechanical Permit (if applicable).",
        "Attach the approved original building plans reference number for cross-verification."
      ],
      infoType: "note",
      infoLabel: "Reference Documents",
      infoText: "Ensures the completed structure is matched against the originally granted permits."
    },
    {
      id: 8,
      title: "Duly Notarized Affidavit of Undertaking (If Applicable)",
      office: "Notary Public",
      icon: <FileSignature className="w-5 h-5 text-purple-500" />,
      steps: [
        "Draft an Affidavit of Undertaking for minor non-structural completions or conditional requirements if requested by the Building Official.",
        "Sign the affidavit in the presence of a Notary Public.",
        "Pay the notarization fee and attach the notarized document to the submission folder."
      ],
      infoType: "note",
      infoLabel: "Conditional Submission",
      infoText: "Only required if specific minor conditions were stipulated during pre-occupancy evaluation."
    }
  ];

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const confirmCancel = async () => {
    if (!selectedApplication) return;
    setIsCancelling(true);
    try {
      const res = await cancelTransaction(selectedApplication.id, residentData?.userId || residentData?.id);
      if (res.success) {
        toast.success("Application successfully cancelled.");

        // Refresh permits list and update states
        const permitsRes = await getExistingOccupancyPermits(residentData?.userId || residentData?.id);
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

  const dataURLtoFile = (dataurl: string, filenameWithoutExt: string): File | null => {
    try {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
      const ext = mime.includes('pdf') ? 'pdf' : (mime.split('/')[1] || 'png');
      const filename = `${filenameWithoutExt}.${ext}`;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (e) {
      console.error("Failed to convert dataURL to File:", e);
      return null;
    }
  };

  const uploadFileClientSide = async (
    file: File | null,
    keyName: string,
    target: { signedUrl: string; publicUrl: string }
  ): Promise<string | null> => {
    if (!file) return null;
    try {
      const fileToUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
      const uploadRes = await fetch(target.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": fileToUpload.type
        },
        body: fileToUpload
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload direct to storage failed: ${uploadRes.statusText}`);
      }

      return target.publicUrl;
    } catch (err) {
      console.error(`Failed uploading ${keyName}:`, err);
      throw new Error(`Failed to upload ${file.name}`);
    }
  };

  const handleSubmit = async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const isFutureDatePresent =
      formData.buildingPermitDateIssued > todayStr ||
      formData.fsecDateIssued > todayStr ||
      formData.dateOfCompletion > todayStr;

    if (requirementsProgress < requiredRequirementsCount || !signatureUrl || !privacyAccepted || isFutureDatePresent) {
      setShowValidationErrors(true);
      if (isFutureDatePresent) {
        toast.warning("Future dates are not allowed for permit issuance or project completion.");
      } else if (requirementsProgress < requiredRequirementsCount) {
        toast.warning(`Please ensure ALL ${requiredRequirementsCount} required documents are provided.`);
        setActiveDocTab("REQUIREMENTS");
      } else if (!signatureUrl) {
        toast.warning("Please provide your digital signature before submitting.");
      } else {
        toast.warning("Please accept the Data Privacy and Terms Agreement.");
      }
      return;
    }

    if (isRevision || isZoningRevision) {
      const revisionRequests = [
        ...(isRevision ? (selectedApplication?.additionalData?.revisionRequests || []) : []),
        ...(isZoningRevision ? (selectedApplication?.additionalData?.zoningRevisionRequests || []) : [])
      ];

      const missingRevisions = revisionRequests.filter((r: any) => {
        if (!r?.key) return false;
        const key = r.key;
        if (key.startsWith("req_")) {
          const idx = parseInt(key.replace("req_", ""), 10);
          return !uploadedRequirements[idx] && typeof uploadedRequirements[idx] !== "string";
        }
        if (key.startsWith("permit_")) {
          const idx = parseInt(key.replace("permit_", ""), 10);
          return !uploadedPermits[idx] && typeof uploadedPermits[idx] !== "string";
        }
        if (key === "newIdFile") {
          return idChoice === "UPLOAD" && !formData.newIdFile;
        }
        if (key === "newIdFileBack") {
          return idChoice === "UPLOAD" && !formData.newIdFileBack;
        }
        return false;
      });

      if (missingRevisions.length > 0) {
        setShowValidationErrors(true);
        toast.warning("Please upload new files for all documents requested for revision.");
        const firstMissing = missingRevisions[0].key;
        if (firstMissing.startsWith("req_") || firstMissing.startsWith("permit_")) {
          setActiveDocTab(firstMissing.startsWith("req_") ? "REQUIREMENTS" : "PERMITS");
          setCurrentStep("SUBMIT");
        } else {
          setCurrentStep("PROFILE");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }



    setIsSubmitting(true);
    try {
      toast.loading("Submitting application...", { id: "op-upload-toast" });
      const displayResident = selectedApplication?.residentSnapshot || residentData;
      const uploadJobs: Array<() => Promise<void>> = [];
      const uploadRequests: Array<{ fieldName: string; fileExt: string }> = [];
      const uploadTargets: Array<{ signedUrl: string; publicUrl: string }> = [];
      const queueUpload = (
        file: File,
        folder: string,
        keyName: string,
        onUploaded: (url: string | null) => void
      ) => {
        const targetIndex = uploadRequests.length;
        uploadRequests.push({
          fieldName: `${folder}_${keyName}`,
          fileExt: file.name.split(".").pop() || "bin"
        });
        uploadJobs.push(async () => {
          const target = uploadTargets[targetIndex];
          if (!target) throw new Error("Missing secure upload destination");
          onUploaded(await uploadFileClientSide(file, keyName, target));
        });
      };

      // 1. Upload ID
      let idFileUrl: string | null = null;
      let idBackFileUrl: string | null = null;
      if (idChoice === "UPLOAD") {
        if (formData.newIdFile instanceof File) {
          queueUpload(formData.newIdFile, "ids", "newIdFile", url => { if (url) idFileUrl = url; });
        } else if (typeof formData.newIdFile === 'string') {
          idFileUrl = formData.newIdFile;
        } else if (effectiveDocuments?.newIdFile) {
          idFileUrl = effectiveDocuments.newIdFile;
        }
        if (formData.newIdFileBack instanceof File) {
          queueUpload(formData.newIdFileBack, "ids", "newIdFileBack", url => { if (url) idBackFileUrl = url; });
        } else if (typeof formData.newIdFileBack === 'string') {
          idBackFileUrl = formData.newIdFileBack;
        } else if (effectiveDocuments?.newIdFileBack) {
          idBackFileUrl = effectiveDocuments.newIdFileBack;
        }
      } else if (idChoice === "PROFILE") {
        const profileIdUrl = displayResident?.idFrontUrl || displayResident?.idBackUrl;
        if (profileIdUrl) {
          if (profileIdUrl.startsWith("data:")) {
            const file = dataURLtoFile(profileIdUrl, "profile_id");
            if (file) {
              queueUpload(file, "ids", "newIdFile", url => { idFileUrl = url; });
            }
          } else if (profileIdUrl.startsWith("http")) {
            idFileUrl = profileIdUrl;
          }
        }
        const profileIdBackUrl = displayResident?.idBackUrl;
        if (profileIdBackUrl) {
          if (profileIdBackUrl.startsWith("data:")) {
            const file = dataURLtoFile(profileIdBackUrl, "profile_id_back");
            if (file) {
              queueUpload(file, "ids", "newIdFileBack", url => { idBackFileUrl = url; });
            }
          } else if (profileIdBackUrl.startsWith("http")) {
            idBackFileUrl = profileIdBackUrl;
          }
        }
      }

      // 2. Upload Requirements
      const finalReqUrls: Record<string, string> = {};
      for (let i = 0; i < documentRequirementsList.length; i++) {
        const fileOrUrl = uploadedRequirements[i];
        if (fileOrUrl instanceof File) {
          queueUpload(fileOrUrl, "requirements", `req_${i}`, url => { if (url) finalReqUrls[`req_${i}`] = url; });
        } else if (typeof fileOrUrl === 'string') {
          finalReqUrls[`req_${i}`] = fileOrUrl;
        } else if (handoffDocuments[`req_${i}`]) {
          finalReqUrls[`req_${i}`] = handoffDocuments[`req_${i}`].url;
        } else if (effectiveDocuments?.[`req_${i}`]) {
          finalReqUrls[`req_${i}`] = effectiveDocuments[`req_${i}`];
        }
      }
      // Process custom requirements (index >= 25)
      for (const idxStr of Object.keys(uploadedRequirements)) {
        const idx = parseInt(idxStr, 10);
        if (idx >= 25) {
          const fileOrUrl = uploadedRequirements[idx];
          if (fileOrUrl instanceof File) {
            queueUpload(fileOrUrl, "requirements", `req_${idx}`, url => { if (url) finalReqUrls[`req_${idx}`] = url; });
          } else if (typeof fileOrUrl === 'string') {
            finalReqUrls[`req_${idx}`] = fileOrUrl;
          }
        }
      }
      if (effectiveDocuments) {
        Object.entries(effectiveDocuments).forEach(([key, url]) => {
          if (key.startsWith("req_")) {
            const idx = parseInt(key.replace("req_", ""), 10);
            if (idx >= 25 && !finalReqUrls[key] && url) {
              finalReqUrls[key] = url as string;
            }
          }
        });
      }

      // 4. Upload Permits

      if (uploadRequests.length > 0) {
        const batchResult = await getSecureUploadUrlsAction(uploadRequests, "occupancy_permits");
        if (!batchResult.success || batchResult.data.length !== uploadRequests.length) {
          throw new Error(batchResult.error || "Failed to allocate secure upload destinations");
        }
        uploadTargets.push(...batchResult.data);
      }

      await mapWithConcurrency(uploadJobs, 4, (job: any) => job());

      const customLabels: Record<string, string> = {};
      const existingLabels = selectedApplication?.additionalData?.customLabels || {};
      Object.assign(customLabels, existingLabels);
      customRequirements.forEach((req, idx) => {
        customLabels[`req_${10 + idx}`] = req.label;
      });

      const data = new FormData();
      data.append("occupancyApplicationType", formData.occupancyApplicationType || "FULL");
      data.append("buildingPermitNo", formData.buildingPermitNo);
      data.append("buildingPermitDateIssued", formData.buildingPermitDateIssued);
      data.append("fsecNo", formData.fsecNo);
      data.append("fsecDateIssued", formData.fsecDateIssued);

      data.append("nameOfProject", formData.nameOfProject);
      data.append("locationOfProject", formData.locationOfProject);
      data.append("useCharacterOfOccupancy", formData.useCharacterOfOccupancy);
      data.append("noOfStoreys", formData.noOfStoreys);
      data.append("noOfUnits", formData.noOfUnits);
      data.append("totalGrossFloorArea", formData.totalGrossFloorArea);
      data.append("dateOfCompletion", formData.dateOfCompletion);
      if (formData.contactNumber) {
        data.append("contactNumber", formData.contactNumber);
      }

      if (idFileUrl) {
        data.append("newIdFile", idFileUrl);
      }
      if (idBackFileUrl) {
        data.append("newIdFileBack", idBackFileUrl);
      }

      Object.entries(finalReqUrls).forEach(([key, url]) => {
        data.append(key, url);
      });
      data.append("customLabels", JSON.stringify(customLabels));

      let result;
      if (isRevision && selectedApplication) {
        result = await resubmitOccupancyPermit(selectedApplication.id, data, residentData?.userId || residentData?.id);
      } else {
        result = await submitOccupancyPermit(data, residentData?.userId || residentData?.id);
      }

      if (result.success) {
        if (signatureUrl) {
          await saveTransactionSignature(result.transactionId!, signatureUrl, residentData?.userId || residentData?.id);
        }
        abandonedFilesRef.current = [];
        // Fetch the updated data so the application becomes read-only and back button works
        const permitsRes = await getExistingOccupancyPermits(residentData?.userId || residentData?.id);
        if (permitsRes.success) {
          setExistingApplications(permitsRes.data);
          const newApp = permitsRes.data.find((a: any) => a.id === result.transactionId);
          if (newApp) setSelectedApplication(newApp);
        }
        toast.success("Occupancy Permit application submitted successfully!", { id: "op-upload-toast" });
        setCurrentStep("EVALUATION");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error(result.error || "Failed to submit.", { id: "op-upload-toast" });
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during submission.", { id: "op-upload-toast" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[var(--page-bg)] overflow-hidden font-sans select-none transition-colors duration-300 ease-out">
      <main className="flex-1 overflow-y-auto relative p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-12 pb-32 font-sans">
      <SecureIdleTimer />
      <DocumentViewerModal
        key="doc-viewer-modal"
        isOpen={viewerOpen}
        onClose={() => { setViewerOpen(false); setViewerFile(null); setViewerUrl(null); }}
        file={viewerFile}
        fileUrl={viewerUrl}
        title={viewerTitle}
        themeColor="var(--primary-theme)"
      />
      <SecureQrUploadModal
        key="secure-qr-modal"
        isOpen={isHandoffOpen}
        onClose={() => {
          setIsHandoffOpen(false);
        }}
        qrCode={handoffQrCode}
        expiresAt={handoffExpiresAt}
        themeColor={themeColor}
      />

      {/* Header / Breadcrumb */}
      <div className="space-y-4 md:space-y-10">
        <div className="sticky top-[64px] sm:top-[80px] z-40 md:static -mx-4 md:mx-0 px-4 md:px-0 pt-2 md:pt-0">
          <Breadcrumb>
            <BreadcrumbList className="flex-nowrap whitespace-nowrap overflow-x-auto scrollbar-none max-w-full bg-white/80 dark:bg-white/5 backdrop-blur-md px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-2xl border border-slate-200 dark:border-white/10 w-fit shadow-sm">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-theme-primary transition-colors italic">
                    <Home className="w-3.5 h-3.5 mb-0.5" />
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-slate-300 dark:text-white/10" />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/user/services" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-theme-primary transition-colors italic">
                    Services
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-slate-300 dark:text-white/10" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-widest italic text-theme-primary">Occupancy Permit</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 px-1 md:px-0">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none select-none">
              OCCUPANCY <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">PERMIT</span>
            </h1>
            <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">Construction & Building Compliance Portal</p>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      {!loading && currentStep !== "EXISTING" && (() => {
        let allowedMaxIdx = 5;
        if (selectedApplication) {
          if (["FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication.status)) {
            allowedMaxIdx = 5;
          } else if (["UNPAID", "PAID", "TREASURY_REVISION", "FOR_PROCESSING"].includes(selectedApplication.status)) {
            allowedMaxIdx = 4;
          } else {
            allowedMaxIdx = 3;
          }
        }
        return (
          <div className="grid grid-cols-6 gap-1.5 md:gap-4 relative px-1 md:px-2">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isCompleted = idx <= Math.min(maxStepIdx, allowedMaxIdx);
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
                    isActive ? "bg-theme-primary text-white border-theme-primary shadow-[0_0_20px_rgba(var(--primary),0.3)] scale-105 md:scale-110" :
                      isCompleted ? "" :
                        "bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent group-hover:border-theme-primary/30"
                  )}
                  style={isCompleted && !isActive ? {
                    backgroundColor: themeColor.startsWith("#") ? `${themeColor}1a` : `rgba(var(--primary), 0.1)`,
                    color: themeColor,
                    borderColor: themeColor.startsWith("#") ? `${themeColor}4d` : `rgba(var(--primary), 0.3)`,
                  } : undefined}>
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
        );
      })()}

      {/* Main Content Area */}
      <div className="mt-4 md:mt-8 md:bg-white md:dark:bg-[#11131a] md:rounded-[2.5rem] md:border md:border-slate-200 md:dark:border-white/10 p-0 md:p-12 md:shadow-2xl relative md:overflow-hidden group/container min-h-[400px] md:min-h-[500px] flex flex-col">

        {loading && (
          <div className="flex-1 min-h-[400px] md:min-h-[500px] flex items-center justify-center animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="w-20 h-20 rounded-3xl border border-theme-primary/20 bg-theme-primary/10 text-theme-primary flex items-center justify-center shadow-xl shadow-primary/10 animate-pulse">
                <Hourglass className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                  Loading Occupancy Permit
                </h2>
                <p className="text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  Checking your existing applications...
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && currentStep === "EXISTING" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Existing <span className="text-theme-primary italic">Applications</span>
              </h2>
              <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                We found existing Occupancy Permit records under your name.
              </p>
            </div>
            <div className="grid gap-4">
              {existingApplications.map((app, idx) => (
                <div
                  key={app.id || idx}
                  onClick={() => {
                    setSelectedApplication(app);
                    setIsRevision(false);
                    setIsZoningRevision(false);
                    let newMaxIdx = 3;
                    let initialStep = "EVALUATION";
                    if (["FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(app.status)) {
                      newMaxIdx = 5;
                      initialStep = "SUBMIT";
                    } else if (["UNPAID", "PAID", "TREASURY_REVISION", "FOR_PROCESSING"].includes(app.status)) {
                      newMaxIdx = 4;
                      initialStep = "BFP";
                    }
                    setMaxStepIdx(newMaxIdx);
                    setCurrentStep(initialStep);
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
                    {(() => {
                      const statusDetails = getDisplayStatusDetails(app);
                      return (
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full",
                          statusDetails.colorClass
                        )}>
                          {statusDetails.label}
                        </span>
                      );
                    })()}

                    <span className="text-theme-primary group-hover:translate-x-1 transition-transform font-bold">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {hasActiveApplication && (
              <div className="mt-8 border-t border-slate-200 dark:border-white/10 pt-8 flex flex-col items-center">
                <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 dark:border-blue-500/10 rounded-2xl p-6 max-w-xl text-center space-y-3 shadow-[0_0_20px_rgba(59,130,246,0.05)]">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 mb-1">
                    <AlertCircle className="w-6 h-6 animate-pulse" />
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm">
                    Active Application In Progress
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed font-sans">
                    You currently have an active occupancy permit application. You may still apply for a new permit for another property or project by clicking the button below.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-center border-t border-slate-200 dark:border-white/10 pt-8">
              <button
                onClick={() => {
                  setSelectedApplication(null);
                  setSignatureUrl(null);
                  setFormData({
                    occupancyApplicationType: "FULL",
                    buildingPermitNo: "",
                    buildingPermitDateIssued: "",
                    fsecNo: "",
                    fsecDateIssued: "",
                    nameOfProject: "",
                    locationOfProject: "",
                    useCharacterOfOccupancy: "",
                    noOfStoreys: "",
                    noOfUnits: "",
                    totalGrossFloorArea: "",
                    dateOfCompletion: "",
                    contactNumber: residentData?.contactNumber || "",
                    newIdFile: null,
                    newIdFileBack: null,
                  });
                  setUploadedRequirements({});
                  setUploadedPermits({});
                  setCurrentStep("GUIDE");
                }}
                className="bg-emerald-500 text-white hover:bg-emerald-600 px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all shadow-xl shadow-emerald-500/20"
              >
                Start a New Application
                <span className="text-xl leading-none">+</span>
              </button>
            </div>
          </div>
        )}

        {!loading && currentStep === "GUIDE" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Citizen's Charter Reference */}
            <div className="bg-theme-primary/5 border border-theme-primary/20 p-6 rounded-[2rem] flex flex-col md:flex-row gap-4 md:items-center justify-between shadow-sm mb-12">
              <div className="space-y-1.5 text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-primary/10 text-theme-primary text-[8px] font-black uppercase tracking-widest font-sans">
                  <Book className="w-3 h-3" /> Citizen's Charter
                </span>
                <h4 className="text-sm font-black tracking-widest text-slate-700 dark:text-white italic">
                  Based on Municipal Occupancy Permit Process
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
                  {/* Left Accent Border */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity"></div>

                  <div className="p-6 md:p-8 pl-8 md:pl-10">
                    {/* Header */}
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

                    {/* Steps */}
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

                    {/* Info Footer */}
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

            {/* Document Catalog Summary */}
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

              {/* Valid ID Guidelines Callout Card */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col gap-4 text-left">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-primary/10 text-theme-primary text-[8px] font-black uppercase tracking-widest font-sans">
                    <Shield className="w-3 h-3" /> Valid IDs Guidelines
                  </span>
                  <h4 className="text-sm font-black tracking-widest text-slate-800 dark:text-white italic">
                    Accepted Government-Issued IDs
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    When uploading your ID or bringing it to the municipal offices, make sure it is one of the following valid documents:
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">• Philippine National ID (PhilID / ePhilID)</div>
                  <div className="flex items-center gap-2">• Philippine Passport</div>
                  <div className="flex items-center gap-2">• Driver's License</div>
                  <div className="flex items-center gap-2">• UMID Card (SSS / GSIS)</div>
                  <div className="flex items-center gap-2">• PRC License</div>
                  <div className="flex items-center gap-2">• Postal ID</div>
                  <div className="flex items-center gap-2">• Voter's ID / Certificate</div>
                  <div className="flex items-center gap-2">• TIN Card</div>
                  <div className="flex items-center gap-2">• PhilHealth ID</div>
                  <div className="flex items-center gap-2">• Senior Citizen ID</div>
                  <div className="flex items-center gap-2">• PWD ID</div>
                  <div className="flex items-center gap-2">• Barangay Certification (with photo)</div>
                </div>
              </div>
            </div>

            {/* Next Button Action */}
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
                    ? "bg-theme-primary text-white hover:bg-theme-primary/90 shadow-xl shadow-primary/20"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-white/10 dark:text-slate-400"
                )}
              >
                Proceed to Profile & Purpose
                <span className="text-xl leading-none">→</span>
              </button>
            </div>
          </div>
        )}

        {!loading && currentStep === "PROFILE" && (() => {
          const displayResident = selectedApplication?.residentSnapshot || residentData;
          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Header */}
              <div className="space-y-3 md:space-y-4 text-center mb-8">
                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight flex items-center justify-center gap-4">
                  <UserCheck className="w-10 h-10 md:w-12 md:h-12 text-slate-800 dark:text-white" />
                  <span className="text-slate-800 dark:text-white">Profile <span className="text-theme-primary italic">Evaluation</span></span>
                </h2>
                <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto">Verify your identity and provide the necessary details. Fields marked with <span className="text-red-500 font-bold text-lg">*</span> are required.</p>
              </div>

              {loading ? (
                <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin"></div></div>
              ) : (
                <>
                  {/* Your Profile Card */}
                  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 relative group hover:border-theme-primary/30 transition-all duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity rounded-l-2xl"></div>
                    <div className="flex items-center gap-2 mb-6">
                      <Book className="w-5 h-5 text-theme-primary" />
                      <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">Your Profile (from Digital Data Gathering)</h3>
                    </div>

                    <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs py-3 px-4 rounded-xl flex items-start gap-2 border border-blue-500/20 mb-6">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p><b>Data Import Notice:</b> Your information was imported from the Digital Data Gathering module. Updates to your profile must be made through the separate Digital Data Gathering system. Last import: Today at 8:00 AM.</p>
                    </div>

                    <div className="bg-white dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 p-6 relative overflow-hidden shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                          <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-md italic">Personal Information</h4>
                        </div>
                        <div className="bg-emerald-500/10 text-emerald-600 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Imported from your registration
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase text-sm">{displayResident?.firstName} {displayResident?.lastName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Age / Date of Birth</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase text-sm">
                            {displayResident?.dateOfBirth ? `${new Date().getFullYear() - new Date(displayResident.dateOfBirth).getFullYear()} years old / ${new Date(displayResident.dateOfBirth).toLocaleDateString()}` : "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Phone Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            className={cn(
                              "w-full bg-white dark:bg-black/20 border rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-theme-primary/20",
                              showValidationErrors && !formData.contactNumber ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10"
                            )}
                            value={formData.contactNumber ?? (displayResident?.contactNumber || "")}
                            onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                            disabled={!isEditable}
                            placeholder={lguConfig.identity.residentContactNumber}
                          />
                          {showValidationErrors && !formData.contactNumber && (
                            <p className="text-[10px] text-red-500 font-medium mt-0.5">Contact number is required</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 text-sm">{displayResident?.user?.email || "N/A"}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Complete Address</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase text-sm">
                            {displayResident?.houseNumber ? `#${displayResident.houseNumber} ${displayResident.street || ""}, Brgy. ${displayResident.barangay || ""}, ${displayResident.municipality || "Local Municipality"}` : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Government ID Card */}
                      <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 mt-6 relative group hover:border-theme-primary/30 transition-all duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity rounded-l-2xl"></div>
                    <div className="flex items-center gap-2 mb-4">
                      <Book className="w-5 h-5 text-theme-primary" />
                      <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">
                        Government ID <span className="text-red-500 text-xl">*</span>
                      </h3>
                    </div>
                    {!isEditable ? (
                      <div>
                        {selectedApplication.additionalData?.documents?.newIdFile ? (
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm min-h-[180px]">
                              {(() => {
                                const url = selectedApplication.additionalData.documents.newIdFile;
                                const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url);
                                return (
                                  <div className="space-y-4 w-full flex flex-col items-center">
                                    {isImage ? (
                                      <img src={url} alt="Uploaded Government ID Front" className="max-h-48 object-contain rounded-lg border border-slate-200 dark:border-white/10" />
                                    ) : (
                                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                        <FileText className="w-8 h-8" />
                                      </div>
                                    )}
                                    <p className="text-xs font-semibold text-slate-500">Government ID - Front Side</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewerUrl(url);
                                        setViewerTitle("Government ID - Front");
                                        setViewerOpen(true);
                                      }}
                                      className="inline-flex items-center gap-2 text-xs font-bold text-theme-primary hover:underline"
                                    >
                                      View Front ID ↗
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm min-h-[180px]">
                              {selectedApplication.additionalData?.documents?.newIdFileBack ? (
                                (() => {
                                  const url = selectedApplication.additionalData.documents.newIdFileBack;
                                  const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url);
                                  return (
                                    <div className="space-y-4 w-full flex flex-col items-center">
                                      {isImage ? (
                                        <img src={url} alt="Uploaded Government ID Back" className="max-h-48 object-contain rounded-lg border border-slate-200 dark:border-white/10" />
                                      ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                          <FileText className="w-8 h-8" />
                                        </div>
                                      )}
                                      <p className="text-xs font-semibold text-slate-500">Government ID - Back Side (Optional)</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setViewerUrl(url);
                                          setViewerTitle("Government ID - Back");
                                          setViewerOpen(true);
                                        }}
                                        className="inline-flex items-center gap-2 text-xs font-bold text-theme-primary hover:underline"
                                      >
                                        View Back ID ↗
                                      </button>
                                    </div>
                                  );
                                })()
                              ) : (
                                <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                                  <FileWarning className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                  <p className="text-xs font-semibold text-slate-400 italic">No Back Side ID Uploaded</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 p-5 flex flex-col gap-2 shadow-sm">
                            <p className="text-sm font-bold text-slate-800 dark:text-white">ID on file: <span className="font-medium text-slate-600">{displayResident?.idType || "Philippine ID / Profile ID"}</span></p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Verified: <span className={cn("font-bold", displayResident?.registrationStatus === "APPROVED" || displayResident?.registrationStatus === "VERIFIED" ? "text-emerald-500" : "text-amber-500")}>{displayResident?.registrationStatus === "APPROVED" || displayResident?.registrationStatus === "VERIFIED" ? "Yes" : "Pending"}</span></p>

                            {(displayResident?.idFrontUrl || displayResident?.idBackUrl) && (
                              <div className="flex gap-4 mt-4">
                                {displayResident.idFrontUrl && (
                                  <div className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-50 dark:bg-black/40">
                                    <p className="text-[10px] font-bold text-center py-1.5 text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5">Front ID</p>
                                    <img src={displayResident.idFrontUrl} alt="Front ID" className="w-full h-24 md:h-32 object-contain p-2" />
                                  </div>
                                )}
                                {displayResident.idBackUrl && (
                                  <div className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-50 dark:bg-black/40">
                                    <p className="text-[10px] font-bold text-center py-1.5 text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5">Back ID</p>
                                    <img src={displayResident.idBackUrl} alt="Back ID" className="w-full h-24 md:h-32 object-contain p-2" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">You have an ID uploaded in your profile. Choose an option:</p>

                        <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-xl w-full md:w-fit mb-6 shadow-inner border border-slate-200 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => setIdChoice("PROFILE")}
                            className={cn(
                              "flex items-center justify-center gap-2 flex-1 md:px-6 py-2.5 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all",
                              idChoice === "PROFILE"
                                ? "bg-white dark:bg-white/10 text-theme-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5"
                            )}
                          >
                            <CheckCircle className="w-4 h-4" /> Use Profile ID
                          </button>
                          <button
                            type="button"
                            onClick={() => setIdChoice("UPLOAD")}
                            className={cn(
                              "flex items-center justify-center gap-2 flex-1 md:px-6 py-2.5 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all",
                              idChoice === "UPLOAD"
                                ? "bg-white dark:bg-white/10 text-theme-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5"
                            )}
                          >
                            <Upload className="w-4 h-4" /> Upload New ID
                          </button>
                        </div>

                        {idChoice === "PROFILE" ? (
                          <div className="bg-white dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 p-5 flex flex-col gap-2 shadow-sm">
                            <p className="text-sm font-bold text-slate-800 dark:text-white">ID on file: <span className="font-medium text-slate-600">{displayResident?.idType || "Philippine ID / Profile ID"}</span></p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Verified: <span className={cn("font-bold", displayResident?.registrationStatus === "APPROVED" || displayResident?.registrationStatus === "VERIFIED" ? "text-emerald-500" : "text-amber-500")}>{displayResident?.registrationStatus === "APPROVED" || displayResident?.registrationStatus === "VERIFIED" ? "Yes" : "Pending"}</span></p>
                          </div>
                        ) : (
                          <div className="flex flex-col md:flex-row gap-6">
                            {/* Front Side Upload */}
                            <div className="flex-1 flex flex-col gap-2">
                              
    <Button
      type="button"
      onClick={() => startHandoff("documents")}
      disabled={!isEditable}
      className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-2 border-dashed border-slate-300 dark:border-slate-700 mt-2"
    >
      <UploadCloud className="w-4 h-4 mr-2" />
      Upload Document via QR
    </Button>
  
                            </div>

                            {/* Back Side Upload (Optional) */}
                            <div className="flex-1 flex flex-col gap-2">
                              
    <Button
      type="button"
      onClick={() => startHandoff("documents")}
      disabled={!isEditable}
      className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-2 border-dashed border-slate-300 dark:border-slate-700 mt-2"
    >
      <UploadCloud className="w-4 h-4 mr-2" />
      Upload Document via QR
    </Button>
  
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Application Type & Reference Details */}
                  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 mt-6 relative group hover:border-theme-primary/30 transition-all duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity rounded-l-2xl"></div>
                    
                    {/* 1. Application Type Toggle: Full vs. Partial Occupancy */}
                    <div className="mb-8">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">
                        Application Type <span className="text-red-500 text-lg">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-4 max-w-md">
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setFormData({ ...formData, occupancyApplicationType: "FULL" })}
                          className={cn(
                            "py-3.5 px-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider transition-all border flex items-center justify-center gap-2",
                            formData.occupancyApplicationType === "FULL"
                              ? "bg-theme-primary text-white border-theme-primary shadow-lg shadow-primary/20 scale-[1.02]"
                              : "bg-white/50 dark:bg-black/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-theme-primary/50"
                          )}
                        >
                          Full Occupancy
                        </button>
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setFormData({ ...formData, occupancyApplicationType: "PARTIAL" })}
                          className={cn(
                            "py-3.5 px-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider transition-all border flex items-center justify-center gap-2",
                            formData.occupancyApplicationType === "PARTIAL"
                              ? "bg-theme-primary text-white border-theme-primary shadow-lg shadow-primary/20 scale-[1.02]"
                              : "bg-white/50 dark:bg-black/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-theme-primary/50"
                          )}
                        >
                          Partial Occupancy
                        </button>
                      </div>
                    </div>

                    {/* 2. Reference Inputs */}
                    <div className="pt-6 border-t border-slate-200/60 dark:border-white/10">
                      <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-xs md:text-sm mb-4">
                        Permit Reference Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Building Permit No. */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Building Permit No. <span className="text-red-500 text-lg">*</span>
                          </label>
                          <input
                            type="text"
                            className={cn(
                              "w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none",
(showValidationErrors && !formData.buildingPermitNo) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10"
                            )}
                            value={formData.buildingPermitNo || ""}
                            onChange={e => setFormData({ ...formData, buildingPermitNo: e.target.value })}
                            disabled={!isEditable}
                            placeholder="Enter Building Permit No."
                          />
                          {showValidationErrors && !formData.buildingPermitNo && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                          )}
                        </div>

                        {/* Building Permit Date Issued */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Building Permit Date Issued <span className="text-red-500 text-lg">*</span>
                          </label>
                          <input
                            type="date"
                            max={new Date().toISOString().split("T")[0]}
                            className={cn(
                              "w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none",
                              (showValidationErrors && (!formData.buildingPermitDateIssued || formData.buildingPermitDateIssued > new Date().toISOString().split("T")[0])) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10"
                            )}
                            value={formData.buildingPermitDateIssued || ""}
                            onChange={e => setFormData({ ...formData, buildingPermitDateIssued: e.target.value })}
                            disabled={!isEditable}
                          />
                          {showValidationErrors && !formData.buildingPermitDateIssued && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                          )}
                          {showValidationErrors && formData.buildingPermitDateIssued > new Date().toISOString().split("T")[0] && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">Future dates are not allowed for permit issuance.</p>
                          )}
                        </div>

                        {/* FSEC No. */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            FSEC No. <span className="text-red-500 text-lg">*</span>
                          </label>
                          <input
                            type="text"
                            className={cn(
                              "w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none",
                              (showValidationErrors && !formData.fsecNo) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10"
                            )}
                            value={formData.fsecNo || ""}
                            onChange={e => setFormData({ ...formData, fsecNo: e.target.value })}
                            disabled={!isEditable}
                            placeholder="Enter FSEC No."
                          />
                          {showValidationErrors && !formData.fsecNo && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                          )}
                        </div>

                        {/* FSEC Date Issued */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            FSEC Date Issued <span className="text-red-500 text-lg">*</span>
                          </label>
                          <input
                            type="date"
                            max={new Date().toISOString().split("T")[0]}
                            className={cn(
                              "w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none",
                              (showValidationErrors && (!formData.fsecDateIssued || formData.fsecDateIssued > new Date().toISOString().split("T")[0])) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10"
                            )}
                            value={formData.fsecDateIssued || ""}
                            onChange={e => setFormData({ ...formData, fsecDateIssued: e.target.value })}
                            disabled={!isEditable}
                          />
                          {showValidationErrors && !formData.fsecDateIssued && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                          )}
                          {showValidationErrors && formData.fsecDateIssued > new Date().toISOString().split("T")[0] && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">Future dates are not allowed for permit issuance.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 mt-6 relative group hover:border-theme-primary/30 transition-all duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-theme-primary opacity-50 group-hover:opacity-100 transition-opacity rounded-l-2xl"></div>
                    <div className="flex items-center gap-2 mb-6">
                      <Book className="w-5 h-5 text-theme-primary" />
                      <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg md:text-xl italic">Additional Information</h3>
                    </div>

                    <div className="space-y-8">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Name of Project <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                          type="text"
                          className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && !formData.nameOfProject) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                          value={formData.nameOfProject || ""}
                          onChange={e => setFormData({ ...formData, nameOfProject: e.target.value })}
                          disabled={!isEditable}
                          placeholder="Enter project name"
                        />
                        {showValidationErrors && !formData.nameOfProject && (
                          <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Location of Project <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                          type="text"
                          className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && !formData.locationOfProject) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                          value={formData.locationOfProject || ""}
                          onChange={e => setFormData({ ...formData, locationOfProject: e.target.value })}
                          disabled={!isEditable}
                          placeholder="Enter exact location"
                        />
                        {showValidationErrors && !formData.locationOfProject && (
                          <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                        )}
                        {duplicatePropertyWarning && duplicatePropertyWarning.isProcessing && (
                          <div className="mt-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-600 dark:text-amber-500 animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 animate-pulse" />
                            <div className="text-xs">
                              <span className="font-bold uppercase tracking-wider block mb-1">⚠️ Warning: Property Currently Processing</span>
                              An active occupancy permit application for this property location is currently being processed. You can still proceed if this is a separate permit for the same property.
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Use/Character of Occupancy <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                          type="text"
                          className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && !formData.useCharacterOfOccupancy) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                          value={formData.useCharacterOfOccupancy || ""}
                          onChange={e => setFormData({ ...formData, useCharacterOfOccupancy: e.target.value })}
                          disabled={!isEditable}
                          placeholder="e.g. Residential, Commercial"
                        />
                        {showValidationErrors && !formData.useCharacterOfOccupancy && (
                          <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            No. of Storey/s <span className="text-red-500 text-lg">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && !formData.noOfStoreys) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                            value={formData.noOfStoreys || ""}
                            onChange={e => setFormData({ ...formData, noOfStoreys: e.target.value })}
                            disabled={!isEditable}
                            placeholder="0"
                          />
                          {showValidationErrors && !formData.noOfStoreys && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            No. of Units <span className="text-red-500 text-lg">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && !formData.noOfUnits) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                            value={formData.noOfUnits || ""}
                            onChange={e => setFormData({ ...formData, noOfUnits: e.target.value })}
                            disabled={!isEditable}
                            placeholder="0"
                          />
                          {showValidationErrors && !formData.noOfUnits && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Total Gross Floor Area <span className="text-red-500 text-lg">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 pr-12 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && !formData.totalGrossFloorArea) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                              value={formData.totalGrossFloorArea || ""}
                              onChange={e => setFormData({ ...formData, totalGrossFloorArea: e.target.value })}
                              disabled={!isEditable}
                              placeholder="0.00"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">sqm</span>
                          </div>
                          {showValidationErrors && !formData.totalGrossFloorArea && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Date of Completion <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          className={cn("w-full bg-white dark:bg-black/20 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-theme-primary/20 outline-none", (showValidationErrors && (!formData.dateOfCompletion || formData.dateOfCompletion > new Date().toISOString().split("T")[0])) ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10")}
                          value={formData.dateOfCompletion || ""}
                          onChange={e => setFormData({ ...formData, dateOfCompletion: e.target.value })}
                          disabled={!isEditable}
                        />
                        {showValidationErrors && !formData.dateOfCompletion && (
                          <p className="text-[10px] text-red-500 font-medium mt-1">This field is required</p>
                        )}
                        {showValidationErrors && formData.dateOfCompletion > new Date().toISOString().split("T")[0] && (
                          <p className="text-[10px] text-red-500 font-medium mt-1">Future completion dates are invalid.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Buttons */}
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
                        const todayStr = new Date().toISOString().split("T")[0];
                        const isBuildingPermitDateFuture = formData.buildingPermitDateIssued > todayStr;
                        const isFsecDateFuture = formData.fsecDateIssued > todayStr;
                        const isCompletionDateFuture = formData.dateOfCompletion > todayStr;

                        const hasMissingFields = !formData.contactNumber ||
                          !formData.buildingPermitNo ||
                          !formData.buildingPermitDateIssued ||
                          !formData.fsecNo ||
                          !formData.fsecDateIssued ||
                          !formData.nameOfProject ||
                          !formData.locationOfProject ||
                          !formData.useCharacterOfOccupancy ||
                          !formData.noOfStoreys ||
                          !formData.noOfUnits ||
                          !formData.totalGrossFloorArea ||
                          !formData.dateOfCompletion ||
                          isBuildingPermitDateFuture ||
                          isFsecDateFuture ||
                          isCompletionDateFuture ||
                          (idChoice === "UPLOAD" && !formData.newIdFile && !selectedApplication?.additionalData?.documents?.newIdFile);

                        if (hasMissingFields) {
                          setShowValidationErrors(true);
                          if (isBuildingPermitDateFuture || isFsecDateFuture || isCompletionDateFuture) {
                            toast.error("Future dates are not allowed for permit issuance or project completion.");
                          } else {
                            toast.error("Please fill in all required fields marked with *.");
                          }
                          return;
                        }

                        setCurrentStep("DOCUMENTS");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all w-full md:w-auto text-white hover:opacity-90 shadow-xl"
                      style={{
                        backgroundColor: themeColor,
                        boxShadow: themeColor.startsWith("#") ? `0 20px 25px -5px ${themeColor}30` : `0 20px 25px -5px rgba(var(--primary), 0.2)`
                      }}
                    >
                      Next: Upload Requirements & Documents
                      <span className="text-xl leading-none">→</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {!loading && currentStep === "DOCUMENTS" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header */}
            <div className="space-y-3 md:space-y-4 mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight flex items-center gap-4">
                <UploadCloud className="w-10 h-10 md:w-12 md:h-12 text-slate-800 dark:text-white" />
                <span className="text-slate-800 dark:text-white">Upload Requirements & Documents</span>
              </h2>
              <p className="text-slate-500 font-medium text-xs md:text-sm uppercase tracking-widest">
                Upload all required requirements and documents. Files must be PDF, JPG, or PNG (max 5MB each).
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-8">
              <div className="bg-slate-100/50 dark:bg-white/5 border-l-4 border-slate-800 dark:border-white p-4 rounded-r-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-slate-800 dark:text-white shrink-0" />
                <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300">
                  <b>File Upload Rules:</b> Max 5MB per file · Allowed: .pdf, .jpg, .jpeg, .png only
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6 mt-8">
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-slate-800 dark:text-white">
                  Requirements
                </h3>
              </div>
              {isEditable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomDocument}
                  className="rounded-full border-slate-300 hover:bg-slate-50 dark:border-white/20 dark:hover:bg-white/10 flex items-center gap-2"
                >
                  <span>+</span> Add Custom Requirement
                </Button>
              )}
            </div>

            {isEditable && (
              <button
                type="button"
                onClick={() => startHandoff("documents")}
                disabled={isCreatingHandoff}
                className="mb-6 inline-flex items-center gap-2 rounded-full bg-theme-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-theme-primary/90 disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4" />
                {isCreatingHandoff ? "Creating secure QR..." : "Upload all documents via QR"}
              </button>
            )}

            {/* Document List */}
            <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {documentRequirementsList.map((docName, idx) => {
                const file = uploadedRequirements[idx];
                const existingUrl = selectedApplication?.additionalData?.documents?.[`req_${idx}`];
                const handoffFile = handoffDocuments[`req_${idx}`];
                const hasFile = !!file || !!existingUrl || !!handoffFile;
                const isRequired = requiredRequirementIndexes.includes(idx);
                const hasError = showValidationErrors && isRequired && !hasFile;

                return (
                  <div
                    key={`req_${idx}`}
                    className={cn(
                      "bg-white/40 dark:bg-white/5 border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm transition-all",
                      hasError ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border-slate-200 dark:border-white/10 hover:border-theme-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 dark:text-white text-sm flex items-center flex-wrap gap-1.5">
                          <span>{docName}</span>
                          {!isRequired && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 border border-slate-300 dark:border-white/10 px-2 py-0.5 rounded-full">Optional</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {file?.name || handoffFile?.fileName || (existingUrl ? "Existing Document" : isRequired ? "Required File" : "Optional File")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {existingUrl && (
                        <button
                          type="button"
                          onClick={() => { setViewerUrl(existingUrl); setViewerTitle(docName); setViewerOpen(true); }}
                          className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-white/20 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          View
                        </button>
                      )}
                      {file && (
                        <button
                          type="button"
                          onClick={() => { setViewerFile(file); setViewerTitle(docName); setViewerOpen(true); }}
                          className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-white/20 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          Preview
                        </button>
                      )}
                      {handoffFile && (
                        <button
                          type="button"
                          onClick={() => { setViewerUrl(handoffFile.url); setViewerTitle(docName); setViewerOpen(true); }}
                          className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-white/20 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          Preview
                        </button>
                      )}
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => startHandoff("documents")}
                          className="px-5 py-2 text-xs font-black uppercase bg-theme-primary text-white rounded-full hover:bg-theme-primary/90 flex items-center gap-1.5 shadow-md transition-all"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          {hasFile ? "Re-upload" : "Upload"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 mt-8">
              <div 
                className="border-l-4 p-4 rounded-r-xl flex items-center gap-3"
                style={{
                  backgroundColor: themeColor.startsWith("#") ? `${themeColor}0d` : `rgba(var(--primary), 0.05)`,
                  borderLeftColor: themeColor
                }}
              >
                <UploadCloud 
                  className="w-5 h-5 shrink-0" 
                  style={{ color: themeColor }}
                />
                <p 
                  className="text-xs md:text-sm font-bold"
                  style={{ color: themeColor }}
                >
                  {`Requirements Progress: ${uploadedRequirementsCount}/${requiredRequirementsCount} documents uploaded`}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/5 border-l-4 border-blue-500 p-4 rounded-r-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0" />
                  <p className="text-xs md:text-sm font-bold text-blue-800 dark:text-blue-300">
                    Total Progress: {uploadedRequirementsCount}/{requiredRequirementsCount} items uploaded
                  </p>
                </div>
                {!selectedApplication && (
                  <span className="text-[10px] text-blue-600/60 dark:text-blue-400/60 font-medium uppercase tracking-widest hidden sm:block">All requirements must be uploaded</span>
                )}
              </div>
            </div>

            {/* Signature Block */}
            <div className="bg-white dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm mt-8">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: themeColor.startsWith("#") ? `${themeColor}1a` : `rgba(var(--primary), 0.1)`
                  }}
                >
                  <PenTool 
                    className="w-5 h-5" 
                    style={{ color: themeColor }}
                  />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-lg flex items-center gap-2">
                    Digital Signature <span className="text-red-500 text-xl">*</span>
                  </h3>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Sign directly below</p>
                </div>
              </div>
              {!isEditable ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Your digital signature was recorded with this application submission:</p>
                  {selectedApplication.additionalData?.signature ? (
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
                  {isRevision && signatureUrl && (
                    <div className="mb-4">
                      <p 
                        className="text-xs font-bold mb-2"
                        style={{ color: themeColor }}
                      >
                        Previous Signature (You can resign below to update):
                      </p>
                      <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 bg-white max-w-md">
                        <img src={signatureUrl} alt="Digital Signature" className="max-h-32 object-contain mx-auto" />
                      </div>
                    </div>
                  )}
                  <div className={cn("rounded-xl overflow-hidden bg-white transition-all", showValidationErrors && !signatureUrl ? "border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" : "border border-slate-200 dark:border-white/10")}>
                  <SignaturePad
                    themeColor={themeColor}
                    onSave={async (file) => {
                      if (!file) return;
                      toast.loading("Uploading signature...", { id: "signature-upload-toast" });
                      const extension = file.name.split(".").pop() || "bin";
                      const allocation = await getSecureUploadUrlsAction(
                        [{ fieldName: "signature_signature", fileExt: extension }],
                        "occupancy_permits"
                      );
                      const target = allocation.success ? allocation.data?.[0] : undefined;
                      const url = target
                        ? await uploadFileClientSide(file, "signature", target)
                        : null;
                      if (url) {
                        setSignatureUrl(url);
                        toast.success("Signature uploaded successfully. Ready to submit!", { id: "signature-upload-toast" });
                      } else {
                        toast.error("Failed to upload signature.", { id: "signature-upload-toast" });
                      }
                    }}
                  />
                  </div>
                  {signatureUrl && (
                    <div 
                      className="mt-4 p-3 border rounded-xl flex items-center gap-2 text-sm font-bold"
                      style={{
                        backgroundColor: themeColor.startsWith("#") ? `${themeColor}0d` : `rgba(var(--primary), 0.05)`,
                        borderColor: themeColor.startsWith("#") ? `${themeColor}33` : `rgba(var(--primary), 0.2)`,
                        color: themeColor
                      }}
                    >
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
                  "p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 select-none",
                  privacyAccepted ? "bg-theme-primary/5 border-theme-primary shadow-sm" : "bg-slate-50 dark:bg-white/[0.02] border-transparent hover:border-theme-primary/20",
                  showValidationErrors && !privacyAccepted && "border-red-500 bg-red-50/50"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 mt-0.5",
                  privacyAccepted ? "bg-theme-primary border-theme-primary text-white" : "border-slate-300 dark:border-white/10",
                  showValidationErrors && !privacyAccepted && "border-red-400"
                )}>
                  {privacyAccepted && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black italic uppercase tracking-tight text-slate-900 dark:text-white">Data Privacy and Terms Agreement</p>
                  <p className="text-[8px] md:text-[10px] text-slate-500 font-medium leading-relaxed italic uppercase tracking-widest">
                    I officially accept the E-LGU Data Privacy Agreement & Terms. I declare under penalty of perjury that all submitted details are 100% legal and genuine. Click to review agreement.
                  </p>
                </div>
              </div>
            </div>

            <PrivacyTermsModal
              isOpen={isPrivacyModalOpen}
              onClose={() => setIsPrivacyModalOpen(false)}
              onAccept={() => {
                setPrivacyAccepted(true);
                setIsPrivacyModalOpen(false);
              }}
              themeColor={themeColor}
            />

            {/* Footer Buttons */}
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
              {!isEditable ? (
                <button
                  onClick={() => {
                    setCurrentStep("EVALUATION");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="bg-theme-primary text-white hover:bg-theme-primary/90 px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all shadow-xl shadow-primary/20 w-full md:w-auto"
                >
                  Next: Evaluation Status
                  <span className="text-xl leading-none">→</span>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3 transition-all shadow-xl w-full md:w-auto disabled:opacity-70 hover:opacity-90"
                  style={{
                    backgroundColor: themeColor,
                    boxShadow: themeColor.startsWith("#") ? `0 20px 25px -5px ${themeColor}30` : `0 20px 25px -5px rgba(var(--primary), 0.2)`
                  }}
                >
                  {isSubmitting ? "Submitting..." : (isRevision ? "Resubmit Application" : "Submit to Engineering for Review")}
                  {!isSubmitting && <span className="text-xl leading-none">→</span>}
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && currentStep === "EVALUATION" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {selectedApplication?.isCancelled && (
              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2rem] flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="text-left space-y-1">
                    <h4 className="font-black text-red-500 uppercase tracking-wider text-sm">
                      Application Cancelled
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
You cancelled this occupancy permit application. You can still view your details, but it is strictly read-only.
                    </p>
                  </div>
                </div>
                <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                  CANCELLED
                </span>
              </div>
            )}

            <div className="bg-white dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                <ClipboardList className="w-6 h-6 text-theme-primary" />
                Evaluation Status
              </h2>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">Engineering Department Review</h3>
                  <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800 dark:text-white text-sm leading-snug">
                            {selectedApplication?.status === "FOR_INSPECTION"
                              ? "Scheduled for Site Inspection"
                              : selectedApplication?.status === "FOR_REINSPECTION"
                                ? "Scheduled for Site Re-inspection"
                                : ["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication?.status || "")
                                  ? "Evaluation Approved"
                                  : "Documents Under Review"}
                          </p>
                          <p className="text-xs text-slate-500 leading-normal">
                            {selectedApplication?.status === "FOR_INSPECTION"
                              ? "Your application is scheduled for an upcoming site inspection."
                              : selectedApplication?.status === "FOR_REINSPECTION"
                                ? "Your application requires a site re-inspection. Please see the scheduled date below."
                                : ["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication?.status || "")
                                  ? "Your application documents have been evaluated and approved by the Engineering Department."
                                  : "Your documents are being reviewed by the Engineering Department"}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 w-fit sm:self-center self-start sm:ml-0 ml-14",
                        selectedApplication?.isCancelled
                          ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                          : selectedApplication?.status === "REJECTED"
                            ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                            : selectedApplication?.status === "FOR_REVISION"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                              : ["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication?.status || "")
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                      )}>
                        {selectedApplication?.isCancelled
                          ? "Cancelled"
                          : selectedApplication
                            ? getEngineeringStatusLabel(selectedApplication.status)
                            : "Pending Review"}
                      </span>
                    </div>

                    {selectedApplication && (selectedApplication.status === "REJECTED" || selectedApplication.status === "FOR_REVISION") && selectedApplication.rejectionRemarks && (
                      <div className="p-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl text-red-800 dark:text-red-400 text-sm">
                        <p className="font-bold uppercase tracking-widest text-[10px] mb-1">
                          {selectedApplication.status === "REJECTED" ? "Reason for Rejection" : "Revision Remarks"}
                        </p>
                        <p className="whitespace-pre-wrap font-medium">{selectedApplication.rejectionRemarks}</p>
                        
                        {selectedApplication.status === "FOR_REVISION" && selectedApplication.additionalData?.revisionRequests?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-500/20">
                            <p className="font-bold uppercase tracking-widest text-[10px] mb-2 text-red-700 dark:text-red-400">Documents to Revise / Additional Attachments:</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {selectedApplication.additionalData.revisionRequests.map((req: any, i: number) => (
                                <li key={i} className="text-xs font-medium text-red-800 dark:text-red-300">
                                  {req.name} <span className="text-[9px] uppercase tracking-widest text-red-600 dark:text-red-400/80 ml-1">({req.type === 'PERMITS' ? 'DOCUMENTS' : 'REQUIREMENTS'})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {(selectedApplication?.status === "FOR_INSPECTION" || selectedApplication?.status === "FOR_REINSPECTION") && selectedApplication?.additionalData?.inspectionSchedule && (
                      <div className="p-5 bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20 rounded-2xl space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                          {selectedApplication.status === "FOR_REINSPECTION" ? "Re-Inspection Details" : "Inspection Details"}
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-xs text-purple-800 dark:text-purple-300 font-bold">
                          <div>
                            <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-0.5">Date & Time</span>
                            {selectedApplication.additionalData.inspectionSchedule.date} at {selectedApplication.additionalData.inspectionSchedule.time}
                          </div>
                          <div>
                            <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-0.5">Inspector</span>
                            {selectedApplication.additionalData.inspectionSchedule.inspectorName}
                          </div>
                          <div className="col-span-2">
                            <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-0.5">Type</span>
                            {selectedApplication.additionalData.inspectionSchedule.type}
                          </div>
                          {selectedApplication.additionalData.inspectionSchedule.notes && (
                            <div className="col-span-2 mt-2 pt-3 border-t border-purple-200 dark:border-purple-500/20">
                              <span className="text-purple-400 dark:text-purple-500 block text-[9px] uppercase tracking-wider mb-1">Notes / Reason for Re-inspection</span>
                              <p className="italic text-purple-700 dark:text-purple-300 font-medium">&quot;{selectedApplication.additionalData.inspectionSchedule.notes}&quot;</p>
                            </div>
                          )}
                        </div>

                        {/* Previous Schedules / Re-inspection History (User side) */}
                        {selectedApplication.additionalData?.reinspectionHistory && selectedApplication.additionalData.reinspectionHistory.length > 0 && (
                          <div className="pt-4 border-t border-dashed border-purple-200 dark:border-purple-500/20 space-y-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400 dark:text-purple-500 block">Previous Schedules & History</span>
                            <div className="space-y-2">
                              {selectedApplication.additionalData.reinspectionHistory.map((h: any, idx: number) => {
                                const isOrig = h.count === 0 || h.isOriginal === true;
                                return (
                                  <div key={idx} className="p-3 bg-white/50 dark:bg-black/20 border border-purple-200/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-medium text-purple-800 dark:text-purple-300">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[9px] font-black italic",
                                        isOrig ? "bg-purple-200 text-purple-800 dark:bg-purple-500/30 dark:text-purple-300" : "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400"
                                      )}>
                                        {isOrig ? "Orig" : `#${h.count}`}
                                      </span>
                                      <span>
                                        {isOrig ? "Original Inspection Schedule" : "Re-inspection Requested"}
                                      </span>
                                    </div>
                                    <div className="text-left sm:text-right text-[10px] text-slate-500">
                                      {isOrig ? `${h.date} @ ${h.time}` : (h.date ? new Date(h.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A")}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  const isEngineeringRejected = selectedApplication?.status === "REJECTED";
                  const isEngineeringCancelled = !!selectedApplication?.isCancelled || selectedApplication?.status === "CANCELLED";
                  const isEngineeringApproved = ["EVALUATED", "UNPAID", "PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication?.status || "");
                  const isZoningRejected = selectedApplication?.additionalData?.zoningStatus === "REJECTED";
                  const isZoningApproved = !!selectedApplication?.additionalData?.feeAssessment?.zoningEndorsed || selectedApplication?.additionalData?.zoningStatus === "EVALUATED";

                  return (
                    <>
                      <div className="space-y-4">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300">MPDC Zoning Review</h3>
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                            <div className="flex items-start gap-4">
                              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                isEngineeringRejected || isEngineeringCancelled || isZoningRejected
                                  ? "bg-red-100 text-red-500 dark:bg-red-500/20"
                                  : !isEngineeringApproved
                                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-500"
                                    : "bg-blue-100 text-blue-500 dark:bg-blue-500/20"
                              )}>
                                {isEngineeringRejected || isEngineeringCancelled || isZoningRejected ? (
                                   <AlertCircle className="w-5 h-5" />
                                ) : !isEngineeringApproved ? (
                                   <Clock className="w-5 h-5" />
                                ) : isZoningApproved ? (
                                   <Check className="w-5 h-5" />
                                ) : (
                                   <MapPin className="w-5 h-5" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="font-bold text-slate-800 dark:text-white text-sm leading-snug">
                                  {isEngineeringRejected
                                    ? "Zoning Review Halted"
                                    : isEngineeringCancelled
                                      ? "Zoning Review Cancelled"
                                      : !isEngineeringApproved
                                        ? "Awaiting Engineering Approval"
                                        : isZoningRejected
                                          ? "Zoning Review Rejected"
                                          : selectedApplication?.additionalData?.zoningStatus === "FOR_INSPECTION"
                                            ? "Scheduled for Zoning Site Inspection"
                                            : selectedApplication?.additionalData?.zoningStatus === "FOR_REINSPECTION"
                                              ? "Scheduled for Zoning Site Re-inspection"
                                              : isZoningApproved
                                                ? "Zoning Assessment Approved"
                                                : "Zoning Clearance Under Review"}
                                </p>
                                <p className="text-xs text-slate-500 leading-normal">
                                  {isEngineeringRejected
                                    ? "Zoning review halted due to Engineering Department rejection."
                                    : isEngineeringCancelled
                                      ? "Zoning review halted due to application cancellation."
                                      : !isEngineeringApproved
                                        ? "Zoning review will commence once the Engineering Department approves your documents."
                                        : isZoningRejected
                                          ? "Your zoning requirements were evaluated and rejected by the MPDC Zoning Office."
                                          : selectedApplication?.additionalData?.zoningStatus === "FOR_INSPECTION"
                                            ? "Your application is scheduled for an upcoming zoning site inspection."
                                            : selectedApplication?.additionalData?.zoningStatus === "FOR_REINSPECTION"
                                              ? "Your application requires a zoning site re-inspection. Please check for updates."
                                              : isZoningApproved
                                                ? "Your zoning requirements have been evaluated and endorsed by MPDC."
                                                : "Your documents are currently being reviewed by the MPDC Zoning Office."}
                                </p>
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 w-fit sm:self-center self-start sm:ml-0 ml-14",
                              isEngineeringCancelled
                                ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                                : isEngineeringRejected || isZoningRejected
                                  ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                                  : !isEngineeringApproved
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                                    : selectedApplication?.additionalData?.zoningStatus === "FOR_REVISION"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                                      : isZoningApproved
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                            )}>
                              {isEngineeringCancelled
                                ? "Cancelled"
                                : isEngineeringRejected || isZoningRejected
                                  ? "REJECTED"
                                  : !isEngineeringApproved
                                    ? "Pending"
                                    : isZoningApproved
                                      ? "APPROVED"
                                      : selectedApplication?.additionalData?.zoningStatus === "FOR_INSPECTION" || selectedApplication?.additionalData?.zoningStatus === "FOR_REINSPECTION"
                                        ? "For Inspection"
                                        : selectedApplication?.additionalData?.zoningStatus === "FOR_REVISION"
                                          ? "For Revision"
                                          : "Pending Review"}
                            </span>
                          </div>

                          {selectedApplication?.additionalData?.zoningStatus && (selectedApplication.additionalData.zoningStatus === "REJECTED" || selectedApplication.additionalData.zoningStatus === "FOR_REVISION") && selectedApplication.additionalData.zoningRejectionRemarks && (
                            <div className="p-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl text-red-800 dark:text-red-400 text-sm">
                              <p className="font-bold uppercase tracking-widest text-[10px] mb-1">
                                {selectedApplication.additionalData.zoningStatus === "REJECTED" ? "Zoning Rejection Reason" : "Zoning Revision Remarks"}
                              </p>
                              <p className="whitespace-pre-wrap font-medium">{selectedApplication.additionalData.zoningRejectionRemarks}</p>
                            </div>
                          )}

                          {(selectedApplication?.additionalData?.zoningStatus === "FOR_INSPECTION" || selectedApplication?.additionalData?.zoningStatus === "FOR_REINSPECTION") && (selectedApplication?.additionalData?.zoningInspectionSchedule || selectedApplication?.additionalData?.inspectionSchedule) && (
                            <div className="p-5 bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20 rounded-2xl space-y-4">
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
                                    <p className="italic text-purple-700 dark:text-purple-300 font-medium">&quot;{(selectedApplication.additionalData.zoningInspectionSchedule || selectedApplication.additionalData.inspectionSchedule).notes}&quot;</p>
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
                              isEngineeringCancelled || isEngineeringRejected || isZoningRejected
                                ? "bg-red-100 text-red-500 dark:bg-red-500/20"
                                : selectedApplication?.additionalData?.bfpStatus === "ACKNOWLEDGED" || (isEngineeringApproved && isZoningApproved)
                                  ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500"
                                  : "bg-amber-100 dark:bg-amber-500/20 text-amber-500"
                            )}>
                              {isEngineeringCancelled || isEngineeringRejected || isZoningRejected ? (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              ) : selectedApplication?.additionalData?.bfpStatus === "ACKNOWLEDGED" || (isEngineeringApproved && isZoningApproved) ? (
                                <Check className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <Clock className="w-5 h-5 text-amber-500" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="font-bold text-slate-800 dark:text-white text-sm leading-snug">
                                {isEngineeringRejected || isZoningRejected
                                  ? "Endorsement to BFP Halted"
                                  : isEngineeringCancelled
                                    ? "Endorsement to BFP Cancelled"
                                    : "Endorsement to BFP"}
                              </p>
                              <p className="text-xs text-slate-500 leading-normal">
                                {isEngineeringRejected
                                  ? "Endorsement halted due to Engineering Department rejection."
                                  : isZoningRejected
                                    ? "Endorsement halted due to MPDC Zoning Office rejection."
                                    : isEngineeringCancelled
                                      ? "Endorsement cancelled due to application cancellation."
                                      : selectedApplication?.additionalData?.bfpStatus === "ACKNOWLEDGED"
                                        ? "BFP has successfully acknowledged your application"
                                        : (isEngineeringApproved && isZoningApproved)
                                          ? "Endorsed successfully to BFP"
                                          : !isEngineeringApproved
                                            ? "Awaiting Engineering and Zoning approval"
                                            : "Awaiting BFP acknowledgement"}
                              </p>
                            </div>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 w-fit sm:self-center self-start sm:ml-0 ml-14",
                            isEngineeringCancelled || isEngineeringRejected || isZoningRejected
                              ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500"
                              : selectedApplication?.status === "UNPAID"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                                : selectedApplication?.additionalData?.bfpStatus === "ACKNOWLEDGED" || (isEngineeringApproved && isZoningApproved)
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500"
                          )}>
                            {isEngineeringCancelled
                              ? "Cancelled"
                              : isEngineeringRejected || isZoningRejected
                                ? "REJECTED"
                                : selectedApplication?.status === "UNPAID"
                                  ? "UNPAID"
                                  : selectedApplication?.additionalData?.bfpStatus === "ACKNOWLEDGED" || (isEngineeringApproved && isZoningApproved)
                                    ? "ACKNOWLEDGED"
                                    : "PENDING"}
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {selectedApplication?.fiscalSnapshot && (selectedApplication.fiscalSnapshot as any).lineItems && (
                  <div className="mt-8 p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-4 animate-in fade-in-50 duration-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-theme-primary italic">Endorsed Fees Summary</span>
                    <div className="space-y-2">
                      {(selectedApplication.fiscalSnapshot as any).lineItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400">
                          <span>{item.label}</span>
                          <span className="font-mono">₱{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-white">Total Amount</span>
                      <span className="text-lg font-black text-theme-primary font-mono">
                        ₱{Number((selectedApplication.fiscalSnapshot as any).totalAmount || selectedApplication.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => {
                  if (selectedApplication) {
                    setCurrentStep("DOCUMENTS");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else if (existingApplications.length > 0) {
                    setCurrentStep("EXISTING");
                  } else {
                    router.push("/user/transactions");
                  }
                }}
                className="px-6 py-3 border border-slate-200 dark:border-white/10 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                ← Back
              </button>

              {/* Cancel Application Button */}
              {selectedApplication && selectedApplication.status === "FOR_REQUESTING" && !selectedApplication.isCancelled && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCancelling}
                  className="px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-full text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Application"}
                </button>
              )}

              {/* Edit for Revision Button */}
              {selectedApplication && (selectedApplication.status === "FOR_REVISION" || selectedApplication.additionalData?.zoningStatus === "FOR_REVISION") && !selectedApplication.isCancelled && (
                <button
                  onClick={() => {
                    if (selectedApplication.status === "FOR_REVISION") {
                      setIsRevision(true);
                    }
                    if (selectedApplication.additionalData?.zoningStatus === "FOR_REVISION") {
                      setIsZoningRevision(true);
                    }
                    setCurrentStep("PROFILE");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white border border-amber-500 hover:border-transparent rounded-full text-xs font-bold transition-all shadow-xl shadow-amber-500/20"
                >
                  Edit and Resubmit Application
                </button>
              )}

              {!(selectedApplication?.isCancelled || selectedApplication?.status === "CANCELLED" || selectedApplication?.status === "FOR_REVISION") && (
                <button
                  disabled={selectedApplication?.status !== "UNPAID"}
                  onClick={() => {
                    if (selectedApplication?.status !== "UNPAID") return;
                    setCurrentStep("BFP");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="px-8 py-3 bg-emerald-500 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                  {selectedApplication?.additionalData?.bfpStatus === "ACKNOWLEDGED"
                    ? "AWAITING ENGINEER PAYMENT ENDORSEMENT"
                    : selectedApplication?.status === "UNPAID"
                      ? "OPEN PAYMENT ENDORSEMENT"
                    : "Next: BFP →"}
                </button>
              )}
            </div>

            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <AlertDialogContent className="bg-white dark:bg-[#11131a] border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-black text-slate-800 dark:text-white uppercase tracking-wider italic text-lg flex items-center gap-2">
                    <span className="text-red-500 font-sans">⚠️</span> Cancel Application
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed mt-2">
                    Are you sure you want to cancel this application? This action is permanent and cannot be undone. Once cancelled, your application data will remain strictly read-only and a new permit application can be created.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 flex gap-3">
                  <AlertDialogCancel className="rounded-full border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-bold px-6 py-2.5 transition-colors cursor-pointer text-xs uppercase tracking-widest">
                    No, Keep Application
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmCancel}
                    className="bg-red-500 text-white hover:bg-red-600 rounded-full font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center justify-center gap-2 px-6 py-2.5 transition-all shadow-xl shadow-red-500/20 cursor-pointer"
                  >
                    Yes, Cancel Application
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {!loading && currentStep === "BFP" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                <Landmark className="w-6 h-6 text-theme-primary" />
                BFP Acknowledgement Status
              </h2>

              <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Receipt className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">BFP Review Processing</h3>
                </div>

                {selectedApplication?.fiscalSnapshot && (selectedApplication.fiscalSnapshot as any).lineItems && (
                  <div className="mb-6 p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-theme-primary italic">Endorsed Fees Summary</span>
                    <div className="space-y-2">
                      {(selectedApplication.fiscalSnapshot as any).lineItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400">
                          <span>{item.label}</span>
                          <span className="font-mono">₱{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-white">Total Amount</span>
                      <span className="text-lg font-black text-theme-primary font-mono">
                        ₱{Number((selectedApplication.fiscalSnapshot as any).totalAmount || selectedApplication.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                {selectedApplication?.status === "UNPAID" && !selectedApplication?.paymentReference ? (
                  <>
                    <div className="bg-amber-50 dark:bg-amber-500/5 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-amber-100 dark:border-amber-500/10">
                      <div className="flex items-center gap-3 text-amber-700 dark:text-amber-500">
                        <Hourglass className="w-5 h-5 animate-pulse" />
                        <span className="font-bold text-sm">Status: Pending Payment</span>
                      </div>

                      <button onClick={() => router.push(`/user/services/requests/${selectedApplication.id}`)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all w-full md:w-auto justify-center">
                        <CreditCard className="w-4 h-4" /> {selectedApplication.rejectionRemarks ? "Upload New Receipt" : "Proceed to Payment"}
                      </button>
                    </div>

                    {/* Show Revision Remarks if any */}
                    {selectedApplication?.rejectionRemarks && (
                      <div className="mt-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-5 space-y-2 animate-in fade-in-50 duration-500">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-500">
                          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                          <h4 className="font-black text-xs uppercase tracking-widest italic">Payment Revision Required</h4>
                        </div>
                        <p className="text-xs font-medium text-red-800 dark:text-red-400 leading-relaxed">
                          {selectedApplication.rejectionRemarks}
                        </p>
                      </div>
                    )}

                    {/* Show Previous Uploaded Receipts if any */}
                    {selectedApplication?.additionalData?.previousPaymentProofs && selectedApplication.additionalData.previousPaymentProofs.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Previous Submissions</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {selectedApplication.additionalData.previousPaymentProofs.map((proof: any, idx: number) => (
                            <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 opacity-70 hover:opacity-100 transition-opacity">
                              <img src={proof.url} alt={`Previous Proof ${idx + 1}`} className="object-cover w-full h-full" />
                              <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded">Rejected</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 text-amber-700 dark:text-amber-500 text-xs font-medium px-4 py-3 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>Please proceed to the Municipal Treasury Office to pay the required fees. After payment, upload your official receipt here. Receipt verification takes 24 hours.</p>
                    </div>
                  </>
                ) : selectedApplication?.status === "UNPAID" && selectedApplication?.paymentReference ? (
                  <div className="bg-blue-50 dark:bg-blue-500/5 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-blue-100 dark:border-blue-500/10">
                    <div className="flex items-center gap-3 text-blue-700 dark:text-blue-500">
                      <Hourglass className="w-5 h-5 animate-pulse" />
                      <span className="font-bold text-sm">Status: Waiting Verification</span>
                    </div>
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Receipt uploaded successfully. Treasury is verifying your payment.
                    </div>
                  </div>
                ) : ["PAID", "FOR_PROCESSING", "FOR_CLAIM", "FOR_PICKING", "RELEASED", "DELIVERED"].includes(selectedApplication?.status || "") ? (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 dark:bg-emerald-500/5 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-emerald-100 dark:border-emerald-500/10">
                      <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-500">
                        <Check className="w-5 h-5 text-emerald-500" />
                        <span className="font-bold text-sm">Status: Paid (Receipt Submitted)</span>
                      </div>
                      {selectedApplication?.additionalData?.treasuryReceiptUrl && (
                        <button
                          onClick={() => {
                            setViewerUrl(selectedApplication.additionalData.treasuryReceiptUrl);
                            setViewerTitle("Official Treasury Receipt");
                            setViewerOpen(true);
                          }}
                          className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                        >
                          View Official Receipt
                        </button>
                      )}
                    </div>
                    {selectedApplication?.additionalData?.treasuryRemarks && (
                      <div className="p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 italic">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 not-italic block mb-1">Treasury Notes:</span>
                        &ldquo;{selectedApplication.additionalData.treasuryRemarks}&rdquo;
                      </div>
                    )}
                    {selectedApplication?.additionalData?.clearanceRevisionReason && (!selectedApplication?.additionalData?.bfpClearanceUrl || !selectedApplication?.additionalData?.zoningClearanceUrl) && (
                      <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-5 space-y-2 animate-in fade-in-50 duration-500">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                          <h4 className="font-black text-xs uppercase tracking-widest italic">Revision Required</h4>
                        </div>
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
                          {selectedApplication.additionalData.clearanceRevisionReason}
                        </p>
                      </div>
                    )}



                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => {
                  setCurrentStep("EVALUATION");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 dark:border-white/20 rounded-full transition-colors shadow-sm"
              >
                ← Back
              </button>

              <button
                disabled={
                  selectedApplication?.status === "UNPAID"
                }
                onClick={() => {
                  setCurrentStep("SUBMIT");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-8 py-3 bg-emerald-500 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                Next: Submission →
              </button>
            </div>
          </div>
        )}

        {!loading && currentStep === "SUBMIT" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 p-10 shadow-sm text-center">
              <div className="w-20 h-20 bg-[#1e293b] dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Application Status</h2>
              <p className="text-slate-500 text-sm font-medium mb-8">
                {selectedApplication?.status === "FOR_CLAIM" && (
                  <span className="text-emerald-500 font-black uppercase tracking-widest block text-lg mb-1">✅ Ready to Claim!</span>
                )}
                {selectedApplication?.status === "FOR_PICKING" && (
                  <span className="text-blue-500 font-black uppercase tracking-widest block text-lg mb-1">🚚 The Rider is on its way!</span>
                )}
                {selectedApplication?.status === "RELEASED" && (
                  <span className="text-emerald-500 font-black uppercase tracking-widest block text-lg mb-1">🎉 Released!</span>
                )}
                {["FOR_CLAIM", "FOR_PICKING", "RELEASED"].includes(selectedApplication?.status || "") ? (
                  "Your occupancy permit has been approved and the digital copy is now available below."
                ) : (
                  "Your application is being processed. You will be notified once your permit is ready for release."
                )}
              </p>

              {selectedApplication?.eCopyUrl && ["FOR_CLAIM", "FOR_PICKING", "RELEASED"].includes(selectedApplication?.status || "") ? (
                <div className="max-w-2xl mx-auto space-y-4 mb-6">
                  {/* Official Permit */}
                  <div className="border-2 border-emerald-500/50 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-emerald-500/5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="text-center md:text-left">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">
                          Official Permit E-Copy
                        </p>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Your approved occupancy permit is ready for download.
                          {selectedApplication?.updatedAt && (
                            <span className="block mt-1.5 text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-bold uppercase tracking-widest">
                              Released on: {new Date(selectedApplication.updatedAt).toLocaleDateString()} {new Date(selectedApplication.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setViewerUrl(selectedApplication.eCopyUrl);
                        setViewerTitle("Official Permit E-Copy");
                        setViewerOpen(true);
                      }}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 shrink-0"
                    >
                      <FileText className="w-4 h-4" /> Preview & Download
                    </button>
                  </div>

                  {/* Zoning Clearance */}
                  {selectedApplication?.additionalData?.zoningClearanceUrl && (
                    <div className="border-2 border-emerald-500/50 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-emerald-500/5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">
                            Zoning / Locational Clearance
                          </p>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Your approved zoning clearance is ready for download.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setViewerUrl(selectedApplication.additionalData.zoningClearanceUrl);
                          setViewerTitle("Zoning Clearance");
                          setViewerOpen(true);
                        }}
                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 shrink-0"
                      >
                        <FileText className="w-4 h-4" /> Preview & Download
                      </button>
                    </div>
                  )}

                  {/* BFP Clearance */}
                  {selectedApplication?.additionalData?.bfpClearanceUrl && (
                    <div className="border-2 border-emerald-500/50 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-emerald-500/5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">
                            BFP Fire Safety Clearance
                          </p>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Your approved fire safety clearance is ready for download.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setViewerUrl(selectedApplication.additionalData.bfpClearanceUrl);
                          setViewerTitle("BFP Clearance");
                          setViewerOpen(true);
                        }}
                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 shrink-0"
                      >
                        <FileText className="w-4 h-4" /> Preview & Download
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-2xl mx-auto border-2 border-dashed border-[#1e293b] dark:border-white/50 rounded-xl p-6 flex flex-col md:flex-row items-center justify-center gap-4 bg-slate-50/50 dark:bg-white/5 mb-6">
                  <div className="w-10 h-10 bg-[#1e293b] dark:bg-white text-white dark:text-slate-900 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-bold">Digital Copy</span> of your documents will be available here upon release
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">You can view and download your approved permit directly from this page.</p>
                  </div>
                </div>
              )}

              <div className="max-w-2xl mx-auto bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-4 flex items-start gap-3 text-left">
                <Shield className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  <span className="font-bold text-slate-700 dark:text-slate-300">RA 10173 (Data Privacy Act of 2012) Compliance:</span> Your personal information is collected for occupancy permit processing only and will not be shared with third parties without your consent.
                </p>
              </div>
            </div>

            <div className="flex justify-start items-center mt-6">
              <button
                onClick={() => {
                  setCurrentStep("BFP");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 dark:border-white/20 rounded-full transition-colors shadow-sm"
              >
                ← Back to Treasury & Zoning
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Add Custom Document Modal */}
      <Dialog open={isAddCustomDocOpen} onOpenChange={setIsAddCustomDocOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border-none rounded-[2.5rem] shadow-2xl p-10">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
              Add Custom <span style={{ color: themeColor }}>{activeDocTab === "REQUIREMENTS" ? "Requirement" : "Permit"}</span>
            </DialogTitle>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Define a new document name for upload</p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label htmlFor="customDocNameInput" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Document/Permit Name</label>
              <Input
                id="customDocNameInput"
                type="text"
                placeholder="e.g. Structural Computations"
                value={customDocName}
                onChange={(e) => setCustomDocName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl py-6 px-4 font-bold text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-theme-primary/20"
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCustomDocOpen(false)}
                className="flex-1 rounded-full border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 font-black uppercase tracking-widest text-[10px] py-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAddCustomDoc}
                className="flex-1 rounded-full font-black uppercase tracking-widest text-[10px] py-6 text-white"
                style={{ backgroundColor: themeColor }}
              >
                Add Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Receipt Upload Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border-none rounded-[2.5rem] shadow-2xl p-10">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
              Upload <span className="text-emerald-500">Receipt</span>
            </DialogTitle>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Submit your proof of payment</p>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {!paymentPreviewUrl ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-theme-primary" />
                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-theme-primary italic">Transaction Reference Number (Optional)</Label>
                  </div>
                  <Input
                    type="text"
                    placeholder="e.g. 5012 3456 78901 (GCash / Bank Transfer Ref No.)"
                    value={gcashReferenceNo}
                    onChange={(e) => setGcashReferenceNo(e.target.value)}
                    className="h-10 md:h-12 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl font-bold italic text-[10px] md:text-sm text-slate-800 dark:text-white placeholder-slate-400 focus-visible:ring-theme-primary focus-visible:border-theme-primary transition-all"
                  />
                </div>
                <label className="flex flex-col items-center justify-center gap-3 aspect-square rounded-2xl border-2 border-dashed border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/[0.02] cursor-pointer group transition-all">
                  <UploadCloud className="w-10 h-10 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 italic block">Select Image</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest">JPG, PNG, PDF</span>
                  </div>
                  <input type="file" accept="image/*,application/pdf,.pdf" onChange={handlePaymentFileSelect} className="hidden" />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-[3/4] md:aspect-square rounded-2xl overflow-hidden border-2 border-emerald-500/20 bg-slate-50 dark:bg-black/20">
                  <img src={paymentPreviewUrl} alt="Preview" className="object-contain w-full h-full" />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setPaymentFile(null); setPaymentPreviewUrl(null); }}
                    disabled={isSubmitting}
                    className="flex-1 h-12 rounded-xl border-2 border-red-500/20 text-red-500 hover:bg-red-500/5 font-black italic uppercase tracking-widest text-[10px]"
                  >
                    Change Image
                  </Button>
                  <Button
                    onClick={handleSubmitPaymentProof}
                    disabled={isSubmitting || !paymentFile}
                    className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
                  >
                    {isSubmitting ? "Uploading..." : "Submit Receipt"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
}

const SignaturePad = ({ onSave, themeColor = "var(--primary-theme)" }: { onSave: (file: File | null) => void; themeColor?: string }) => {
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

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const offsetX = (clientX - rect.left) * scaleX;
    const offsetY = (clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isUploadedSignature || !isDrawing) return;
    e.preventDefault(); // Prevent scrolling while signing on touch devices
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const offsetX = (clientX - rect.left) * scaleX;
    const offsetY = (clientY - rect.top) * scaleY;

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
    canvas.toBlob((blob) => {
      if (!blob) return onSave(null);
      onSave(new File([blob], `signature-${Date.now()}.png`, { type: "image/png" }));
    }, "image/png", 0.92);
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

        canvas.toBlob((blob) => {
          if (!blob) return onSave(null);
          setIsUploadedSignature(true);
          onSave(new File([blob], `signature-${Date.now()}.png`, { type: "image/png" }));
        }, "image/png", 0.92);
      };
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
            "px-6 py-2 rounded-full text-white text-sm font-bold flex items-center gap-2 shadow-md transition-all hover:opacity-90",
            isUploadedSignature && "opacity-50 cursor-not-allowed"
          )}
          style={!isUploadedSignature ? { backgroundColor: themeColor } : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
          Save Signature
        </button>
      </div>
    </div>
  );
}
