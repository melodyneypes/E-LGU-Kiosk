/* eslint-disable react/no-unescaped-entities, @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";

import {
  CheckCircle,
  User,
  Users,
  AlertCircle,
  CheckCircle2,
  Upload,
  Printer,
  ChevronRight,
  ChevronLeft,
  Search,
  Home
} from "lucide-react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getCurrentUserResident,
  submitBirthCertificateRequest,
  getExistingBirthRequests,
  getSecureUploadUrlAction,
  ensureCivilRegistryTransactionTypes,
  getTransactionTypes,
  getTransactionById
} from "./actions";
import RequestList from "../_components/request-list";
import InformantInfo from "../_components/informant-info";
import ReviewAndSubmit from "../_components/review-and-submit";
import RequiredDocuments from "../_components/required-documents";
import ReadOnlyDocumentPreview from "../_components/read-only-document-preview";

type Step = "EXISTING" | "IDENTITY" | "DETAILS" | "PARENTS" | "UPLOAD" | "SUBMIT";

const STEPS = [
  { id: "IDENTITY", label: "Identity", icon: User },
  { id: "DETAILS", label: "Details", icon: Search },
  { id: "PARENTS", label: "Parents", icon: Users },
  { id: "UPLOAD", label: "Upload ID", icon: Upload },
  { id: "SUBMIT", label: "Submit", icon: CheckCircle2 },
];

const RELATION_OPTIONS = [
  "Self (Aplikante)",
  "Parent (Magulang)",
  "Spouse (Asawa)",
  "Child (Anak)",
  "Sibling (Kapatid)",
  "Guardian / Authorized Representative"
];





// --- UPLOAD FILE SECURELY VIA SIGNED UPLOAD URL ---
async function uploadFileClientSide(file: File, fieldName: string, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'bin';

  const res = await getSecureUploadUrlAction(fieldName, "lcr/birth_certificate_request", fileExt, userId);
  if (!res.success || !res.signedUrl || !res.publicUrl) {
    throw new Error(res.error || "Failed to generate secure upload destination");
  }

  const uploadRes = await fetch(res.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type
    },
    body: file
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload direct to storage failed: ${uploadRes.statusText}`);
  }

  return res.publicUrl;
}

const formatBirthDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = String(d.getFullYear()).padStart(4, "0");
    return `${mm}/${dd}/${yyyy}`;
  } catch {
    return dateStr;
  }
};

export default function BirthCertificatePage() {
  const router = useRouter();
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState<Step>("EXISTING");
  const [existingRequests, setExistingRequests] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [residentData, setResidentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [dbBaseFee, setDbBaseFee] = useState<number>(100);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [revisionTx, setRevisionTx] = useState<any>(null);


  // Digital Handoff (QR Code Upload) States
  const [idFrontHandoffUrl, setIdFrontHandoffUrl] = useState<string | null>(null);
  const [idFrontHandoffFileName, setIdFrontHandoffFileName] = useState("");
  const [idBackHandoffUrl, setIdBackHandoffUrl] = useState<string | null>(null);
  const [idBackHandoffFileName, setIdBackHandoffFileName] = useState("");
  const [handoffToken, setHandoffToken] = useState("");
  const [handoffQrCode, setHandoffQrCode] = useState("");
  const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);
  const [handoffSessionSlot, setHandoffSessionSlot] = useState("");

  // Document Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<File | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");

  const [idChoice, setIdChoice] = useState<"PROFILE" | "UPLOAD">("PROFILE");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Structured formData matching LCR requirements
  const [formData, setFormData] = useState({
    certFirstName: "",
    certMiddleName: "",
    certLastName: "",
    certSuffix: "",
    sex: "",
    dateOfEvent: "",
    placeOfEvent: "",
    fatherFirstName: "",
    fatherMiddleName: "",
    fatherLastName: "",
    motherFirstName: "",
    motherMiddleName: "",
    motherLastName: "",
    relation: "Self (Aplikante)",
    contactNumber: "",
    email: "",
    occupation: "",
    certDocType: "Birth Certificate",
    newIdFile: null as File | null,
    newIdFileBack: null as File | null,
  });

  const [maxStepIdx, setMaxStepIdx] = useState(0);

  useEffect(() => {
    const currentStepIdx = STEPS.findIndex(s => s.id === currentStep);
    if (currentStepIdx > maxStepIdx) {
      setMaxStepIdx(currentStepIdx);
    }
  }, [currentStep, maxStepIdx]);

  useEffect(() => {
    pageScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  // Relationship flow auto-population logic
  useEffect(() => {
    if (!residentData) return;
    if (formData.relation === "Self (Aplikante)") {
      setFormData(prev => ({
        ...prev,
        certFirstName: residentData.firstName || "",
        certMiddleName: residentData.middleName || "",
        certLastName: residentData.lastName || "",
        certSuffix: residentData.suffix || "",
        sex: (residentData.gender || "").toUpperCase(),
        dateOfEvent: residentData.dateOfBirth ? new Date(residentData.dateOfBirth).toISOString().split('T')[0] : "",
        placeOfEvent: residentData.placeOfBirth || (residentData.municipality ? `${residentData.municipality}, ${residentData.province || ""}`.trim() : ""),
        fatherFirstName: residentData.fatherFirstName || "",
        fatherMiddleName: residentData.fatherMiddleName || "",
        fatherLastName: residentData.fatherLastName || "",
        motherFirstName: residentData.motherFirstName || "",
        motherMiddleName: residentData.motherMiddleName || "",
        motherLastName: residentData.motherLastName || "",
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        certFirstName: "",
        certMiddleName: "",
        certLastName: "",
        certSuffix: "",
        sex: "",
        dateOfEvent: "",
        placeOfEvent: "",
        fatherFirstName: "",
        fatherMiddleName: "",
        fatherLastName: "",
        motherFirstName: "",
        motherMiddleName: "",
        motherLastName: "",
      }));
    }
  }, [formData.relation, residentData]);

  // QR Upload handoff polling
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
          let updated = false;

          const frontFile = files.find((f: any) => f.slot === "idFront");
          const backFile = files.find((f: any) => f.slot === "idBack");

          if (frontFile && frontFile.url !== idFrontHandoffUrl) {
            setIdFrontHandoffUrl(frontFile.url);
            setIdFrontHandoffFileName(frontFile.fileName || "Valid ID Front Upload");
            updated = true;
          }
          if (backFile && backFile.url !== idBackHandoffUrl) {
            setIdBackHandoffUrl(backFile.url);
            setIdBackHandoffFileName(backFile.fileName || "Valid ID Back Upload");
            updated = true;
          }

          if (updated) {
            toast.success("Document uploaded successfully from your device!");
          }

          if (frontFile && backFile) {
            setIsHandoffOpen(false);
            setHandoffToken("");
            toast.success("Both Front and Back ID copies uploaded successfully!");
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
  }, [handoffToken, idFrontHandoffUrl, idBackHandoffUrl]);

  const startHandoff = async (slot: string = "birth_id") => {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create QR upload.");
    } finally {
      setIsCreatingHandoff(false);
    }
  };

  const handleOpenViewer = (file: File | null, title: string, url: string | null = null) => {
    setViewerFile(file);
    setViewerUrl(url);
    setViewerTitle(title);
    setViewerOpen(true);
  };





  const getHandoffSlotLabel = () => {
    const map: Record<string, string> = {
      birth_id: "Front & Back ID Photos",
      idFront: "Valid ID (Front Side)",
      idBack: "Valid ID (Back Side)",
    };
    return map[handoffSessionSlot] || "Document";
  };

  // Initialization
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
        const returnedTransactionId = query.get("transactionId");
        const revId = query.get("revisionId") || query.get("revId");

        await ensureCivilRegistryTransactionTypes();

        let txData: any = null;
        if (revId) {
          const txRes = await getTransactionById(revId, userId);
          if (txRes.success && txRes.data) {
            txData = txRes.data;
            setRevisionId(revId);
            setRevisionTx(txData);
          } else {
            toast.error("Failed to fetch revision details");
          }
        }

        const [res, requestsRes, typesResult] = await Promise.all([
          getCurrentUserResident(userId),
          getExistingBirthRequests(userId),
          getTransactionTypes()
        ]);

        if (typesResult.success && typesResult.data) {
          const birthType = typesResult.data.find((t: any) => t.code === "LCR_BIRTH");
          if (birthType) {
            setDbBaseFee(Number(birthType.baseFee ?? 100));
          }
        }

        if (res.success && res.data) {
          const data = res.data;
          setResidentData(data);

          if (txData) {
            const addData = txData.additionalData as any || {};
            const resSnapshot = txData.residentSnapshot as any || data || {};
            const docPreviews = addData.documents || {};

            setFormData(prev => ({
              ...prev,
              certFirstName: addData.certFirstName || "",
              certMiddleName: addData.certMiddleName || "",
              certLastName: addData.certLastName || "",
              certSuffix: addData.certSuffix || "",
              sex: (addData.gender || addData.sex || "").toUpperCase(),
              dateOfEvent: addData.dateOfEvent || "",
              placeOfEvent: addData.placeOfEvent || "",
              fatherFirstName: addData.fatherFirstName || "",
              fatherMiddleName: addData.fatherMiddleName || "",
              fatherLastName: addData.fatherLastName || "",
              motherFirstName: addData.motherFirstName || "",
              motherMiddleName: addData.motherMiddleName || "",
              motherLastName: addData.motherLastName || "",
              contactNumber: addData.contactNumber || resSnapshot.contactNumber || "",
              email: addData.email || resSnapshot.email || "",
              occupation: addData.occupation || data.occupation || "",
              relation: addData.relation || "Self (Aplikante)",
            }));

            if (docPreviews.newIdFile) {
              setIdFrontHandoffUrl(docPreviews.newIdFile);
              setIdFrontHandoffFileName("Uploaded_ID_Front.jpg");
              setIdChoice("UPLOAD");
            }
            if (docPreviews.newIdFileBack) {
              setIdBackHandoffUrl(docPreviews.newIdFileBack);
              setIdBackHandoffFileName("Uploaded_ID_Back.jpg");
              setIdChoice("UPLOAD");
            }
          } else {
            // Set initial form data
            setFormData(prev => ({
              ...prev,
              certFirstName: data.firstName || "",
              certMiddleName: data.middleName || "",
              certLastName: data.lastName || "",
              certSuffix: data.suffix || "",
              sex: (data.gender || "").toUpperCase(),
              dateOfEvent: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : "",
              placeOfEvent: data.placeOfBirth || (data.municipality ? `${data.municipality}, ${data.province || ""}`.trim() : ""),
              fatherFirstName: data.fatherFirstName || "",
              fatherMiddleName: data.fatherMiddleName || "",
              fatherLastName: data.fatherLastName || "",
              motherFirstName: data.motherFirstName || "",
              motherMiddleName: data.motherMiddleName || "",
              motherLastName: data.motherLastName || "",
              contactNumber: data.contactNumber || "",
              email: data.email || "",
              occupation: data.occupation || "",
            }));
          }
        }

        // Check for saved step, form data, and handoff URLs
        const savedStep = sessionStorage.getItem("birth-cert-step");
        const savedForm = sessionStorage.getItem("birth-cert-form");
        const savedFrontUrl = sessionStorage.getItem("birth-cert-front-url");
        const savedBackUrl = sessionStorage.getItem("birth-cert-back-url");
        const savedFrontName = sessionStorage.getItem("birth-cert-front-name");
        const savedBackName = sessionStorage.getItem("birth-cert-back-name");

        if (!revId && savedForm) {
          try {
            const parsed = JSON.parse(savedForm);
            setFormData(prev => ({ ...prev, ...parsed }));
          } catch (e) {
            console.error("Failed to parse saved form", e);
          }
        }
        if (!revId && savedFrontUrl) setIdFrontHandoffUrl(savedFrontUrl);
        if (!revId && savedBackUrl) setIdBackHandoffUrl(savedBackUrl);
        if (!revId && savedFrontName) setIdFrontHandoffFileName(savedFrontName);
        if (!revId && savedBackName) setIdBackHandoffFileName(savedBackName);

        if (requestsRes.success && requestsRes.data) {
          setExistingRequests(requestsRes.data);
        }

        const returnedApplication = (requestsRes.success && requestsRes.data && returnedTransactionId)
          ? requestsRes.data.find((app: any) => app.id === returnedTransactionId)
          : null;

        if (returnedApplication) {
          setSelectedApplication(returnedApplication);
          setCurrentStep("SUBMIT");
        } else if (revId) {
          setCurrentStep("IDENTITY");
        } else if (requestsRes.success && requestsRes.data && requestsRes.data.length > 0) {
          if (savedStep && savedStep !== "SUBMIT") {
            setCurrentStep(savedStep as Step);
          } else {
            setCurrentStep("EXISTING");
          }
        } else {
          if (savedStep && savedStep !== "SUBMIT") {
            setCurrentStep(savedStep as Step);
          } else {
            setCurrentStep("IDENTITY");
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

  useEffect(() => {
    if (!loading && !selectedApplication && !revisionId) {
      sessionStorage.setItem("birth-cert-step", currentStep);
      // Remove File object before stringifying
      const formCopy: any = { ...formData };
      delete formCopy.newIdFile;
      delete formCopy.newIdFileBack;
      sessionStorage.setItem("birth-cert-form", JSON.stringify(formCopy));

      if (idFrontHandoffUrl) {
        sessionStorage.setItem("birth-cert-front-url", idFrontHandoffUrl);
      } else {
        sessionStorage.removeItem("birth-cert-front-url");
      }
      if (idBackHandoffUrl) {
        sessionStorage.setItem("birth-cert-back-url", idBackHandoffUrl);
      } else {
        sessionStorage.removeItem("birth-cert-back-url");
      }
      if (idFrontHandoffFileName) {
        sessionStorage.setItem("birth-cert-front-name", idFrontHandoffFileName);
      } else {
        sessionStorage.removeItem("birth-cert-front-name");
      }
      if (idBackHandoffFileName) {
        sessionStorage.setItem("birth-cert-back-name", idBackHandoffFileName);
      } else {
        sessionStorage.removeItem("birth-cert-back-name");
      }
    }
  }, [currentStep, formData, idFrontHandoffUrl, idBackHandoffUrl, idFrontHandoffFileName, idBackHandoffFileName, loading, selectedApplication, revisionId]);

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateIdentityStep = () => {
    const errs: Record<string, string> = {};
    if (!formData.relation) errs.relationship = "Required";
    if (!formData.contactNumber) errs.contactNumber = "Required";

    const valid = Object.keys(errs).length === 0;
    setShowValidationErrors(!valid);

    if (!valid) {
      toast.warning("Please select relationship and provide your contact number.");
      const firstErrorKey = Object.keys(errs)[0];
      setTimeout(() => {
        let element: any = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
        if (!element && firstErrorKey === "relationship") {
          element = (document.querySelector('[role="combobox"]') || document.querySelector('button[aria-autocomplete="none"]')) as any;
        }
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus();
        }
      }, 100);
    }
    return valid;
  };

  const validateDetailsStep = () => {
    const errs: Record<string, string> = {};
    if (!formData.certFirstName?.trim()) errs.certFirstName = "Required";
    if (!formData.certLastName?.trim()) errs.certLastName = "Required";
    if (!formData.sex) errs.sex = "Required";
    if (!formData.dateOfEvent) errs.dateOfEvent = "Required";
    if (!formData.placeOfEvent?.trim()) errs.placeOfEvent = "Required";

    const valid = Object.keys(errs).length === 0;
    setShowValidationErrors(!valid);

    if (!valid) {
      toast.warning("Please fill in all required fields (First Name, Last Name, Date of Birth, Place, and Sex).");
      const firstErrorKey = Object.keys(errs)[0];
      setTimeout(() => {
        let element: any = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
        if (!element && firstErrorKey === "sex") {
          element = (document.querySelector('[role="combobox"]') || document.querySelector('button[aria-autocomplete="none"]')) as any;
        }
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus();
        }
      }, 100);
    }
    return valid;
  };

  const validateParentsStep = () => {
    const errs: Record<string, string> = {};
    if (!formData.motherFirstName?.trim()) errs.motherFirstName = "Required";
    if (!formData.motherLastName?.trim()) errs.motherLastName = "Required";

    const valid = Object.keys(errs).length === 0;
    setShowValidationErrors(!valid);

    if (!valid) {
      toast.warning("Mother's Maiden First Name and Last Name are required.");
      const firstErrorKey = Object.keys(errs)[0];
      setTimeout(() => {
        const element = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus();
        }
      }, 100);
    }
    return valid;
  };

  const handleNextFromIdentity = () => {
    if (validateIdentityStep()) {
      setShowValidationErrors(false);
      setCurrentStep("DETAILS");
    }
  };

  const handleNextFromDetails = () => {
    if (validateDetailsStep()) {
      setShowValidationErrors(false);
      setCurrentStep("PARENTS");
    }
  };

  const handleNextFromParents = () => {
    if (validateParentsStep()) {
      setShowValidationErrors(false);
      setCurrentStep("UPLOAD");
    }
  };

  const handleNextFromUpload = () => {
    if (idChoice === "PROFILE") {
      if (!residentData?.idFrontUrl || !residentData?.idBackUrl) {
        toast.warning("Your profile is missing the Front or Back ID. Please upload a new copy.");
        return;
      }
    } else {
      const hasFront = idFrontHandoffUrl || formData.newIdFile;
      const hasBack = idBackHandoffUrl || formData.newIdFileBack;
      if (!hasFront || !hasBack) {
        toast.warning("Please upload both the Front and Back sides of your valid ID.");
        setShowValidationErrors(true);
        setTimeout(() => {
          const firstErrorKey = !hasFront ? "idFront" : "idBack";
          const element = document.getElementById(firstErrorKey);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
        return;
      }
    }
    setShowValidationErrors(false);
    setCurrentStep("SUBMIT");
  };

  const handleSubmitRequest = async () => {
    if (idChoice === "PROFILE") {
      if (!residentData?.idFrontUrl || !residentData?.idBackUrl) {
        toast.warning("Your profile is missing the Front or Back ID. Please upload a new copy.");
        return;
      }
    } else {
      const hasFront = idFrontHandoffUrl || formData.newIdFile;
      const hasBack = idBackHandoffUrl || formData.newIdFileBack;
      if (!hasFront || !hasBack) {
        toast.warning("Please upload both the Front and Back sides of your valid ID.");
        return;
      }
    }

    if (!privacyAccepted) {
      toast.warning("You must accept the Data Privacy Terms.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = residentData.userId || residentData.id;
      const data = new FormData();
      data.append("certFirstName", formData.certFirstName);
      data.append("certMiddleName", formData.certMiddleName);
      data.append("certLastName", formData.certLastName);
      data.append("certSuffix", formData.certSuffix);
      data.append("sex", formData.sex);
      data.append("dateOfEvent", formData.dateOfEvent);
      data.append("placeOfEvent", formData.placeOfEvent);
      data.append("fatherFirstName", formData.fatherFirstName);
      data.append("fatherMiddleName", formData.fatherMiddleName);
      data.append("fatherLastName", formData.fatherLastName);
      data.append("motherFirstName", formData.motherFirstName);
      data.append("motherMiddleName", formData.motherMiddleName);
      data.append("motherLastName", formData.motherLastName);
      data.append("relation", formData.relation);
      data.append("contactNumber", formData.contactNumber);
      data.append("email", formData.email);
      data.append("occupation", formData.occupation);
      data.append("privacyConsentAccepted", String(privacyAccepted));
      if (revisionId) {
        data.append("revisionId", revisionId);
      }

      if (idChoice === "UPLOAD") {
        if (idFrontHandoffUrl) {
          data.append("newIdFile", idFrontHandoffUrl);
        } else if (formData.newIdFile) {
          data.append("newIdFile", formData.newIdFile);
        }

        if (idBackHandoffUrl) {
          data.append("newIdFileBack", idBackHandoffUrl);
        } else if (formData.newIdFileBack) {
          data.append("newIdFileBack", formData.newIdFileBack);
        }
      } else {
        if (residentData.idFrontUrl) {
          data.append("newIdFile", residentData.idFrontUrl);
        }
        if (residentData.idBackUrl) {
          data.append("newIdFileBack", residentData.idBackUrl);
        }
      }

      const result = await submitBirthCertificateRequest(data, userId);
      if (result.success && result.transactionId) {
        // Clear drafts if success
        sessionStorage.removeItem("birth-cert-step");
        sessionStorage.removeItem("birth-cert-form");
        sessionStorage.removeItem("birth-cert-front-url");
        sessionStorage.removeItem("birth-cert-back-url");
        sessionStorage.removeItem("birth-cert-front-name");
        sessionStorage.removeItem("birth-cert-back-name");

        // Refresh request data
        const updatedRequests = await getExistingBirthRequests(userId);
        if (updatedRequests.success && updatedRequests.data) {
          setExistingRequests(updatedRequests.data);
          const currentTx = updatedRequests.data.find((tx: any) => tx.id === result.transactionId);
          if (currentTx) {
            setSelectedApplication(currentTx);
          }
        }

        toast.success(revisionId ? "Revision resubmitted successfully." : "Birth Certificate request submitted successfully.");
        setCurrentStep("SUBMIT");
      } else {
        toast.error(result.error || "Failed to submit request.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };



  const handlePrintReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <LoaderComponent />
      </div>
    );
  }

  return (
    <div ref={pageScrollRef} className="h-full overflow-y-auto px-4 py-8 md:px-12 md:py-12 bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white">

      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <Home className="h-3.5 w-3.5" /> Dashboard
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/modules/civil-registry" className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                  Civil Registry
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-black uppercase tracking-widest text-theme-primary">
                Birth Certificate Request
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Title Header */}
      <div className="mx-auto max-w-7xl mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 px-1 md:px-0">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none select-none">
              BIRTH <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">CERTIFICATE</span>
            </h1>
            <p className="text-[9px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">LCR Civil Registry Request Portal</p>
          </div>
          {currentStep === "EXISTING" && (
            <Button
              onClick={() => {
                setSelectedApplication(null);
                setPrivacyAccepted(false);
                setMaxStepIdx(0);
                setCurrentStep("IDENTITY");
              }}
              className="bg-theme-primary hover:bg-theme-hover text-white font-bold uppercase tracking-wider rounded-2xl py-6 px-8 shadow-lg shadow-theme-primary/20 active:scale-95 transition-all text-xs"
            >
              New Certified Copy Request
            </Button>
          )}
        </div>
      </div>

      {/* Progress Stepper */}
      {currentStep !== "EXISTING" && (
        <div className="mx-auto max-w-7xl mb-10">
          <div className="grid grid-cols-5 max-w-3xl mx-auto gap-1 md:gap-4 relative px-1 md:px-2">
            {STEPS.map((step, idx) => {

              const isActive = currentStep === step.id;
              const isCompleted = idx <= maxStepIdx;
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isCompleted && (!selectedApplication || currentStep !== "SUBMIT")) {
                      setCurrentStep(step.id as Step);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 md:gap-3 relative z-10 font-black cursor-pointer group",
                    (!isCompleted || (selectedApplication && currentStep === "SUBMIT")) && "cursor-not-allowed opacity-65"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 border",
                    isActive ? "bg-white dark:bg-[#0d120f]/60 text-theme-primary border-2 border-theme-primary shadow-[0_0_20px_color-mix(in_srgb,var(--primary-theme)_35%,transparent)] scale-105 md:scale-110" :
                      isCompleted ? "bg-slate-50/50 dark:bg-white/[0.02] text-theme-primary border border-slate-200/80 dark:border-white/10" :
                        "bg-transparent text-slate-600 dark:text-slate-400 border border-slate-250/50 dark:border-white/5 group-hover:border-theme-primary/30"
                  )}>
                    <Icon className="w-4 h-4 md:w-7 md:h-7" />
                  </div>
                  <span className={cn(
                    "text-[7px] md:text-[10px] uppercase tracking-widest text-center italic font-bold hidden sm:block",
                    isActive ? "text-slate-900 dark:text-white font-black" :
                      isCompleted ? "text-slate-700 dark:text-slate-300" :
                        "text-slate-600 dark:text-slate-400"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Form/Content Wrapper */}
      <div className="mx-auto max-w-7xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-12 shadow-2xl relative min-h-[500px] flex flex-col text-slate-900 dark:text-white">

        {/* Step: EXISTING (Applications List) */}
        {currentStep === "EXISTING" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Existing <span className="text-theme-primary">Requests</span>
              </h2>
              <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                We found previous requests for certified birth certificates under your profile.
              </p>
            </div>

            <RequestList
              requests={existingRequests}
              onItemClick={(app) => {
                setSelectedApplication(app);
                setCurrentStep("SUBMIT");
              }}
              emptyMessage="No records found"
              emptySubMessage="Submit your first copy request by clicking New Request."
              getSubjectName={(app) => app.birthCertificateRequest?.subjectName || "Birth Certificate Copy"}
            />

            {/* Navigation buttons at the bottom of list */}
            <div className="flex pt-8 mt-auto border-t border-slate-200 dark:border-white/10">
              <Button
                type="button"
                onClick={() => router.push("/modules/civil-registry")}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back to Hub
              </Button>
            </div>
          </div>
        )}



        {/* Step: IDENTITY */}
        {currentStep === "IDENTITY" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1">
            <div className="text-center">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Requestor <span className="text-theme-primary">Identity</span>
              </h2>
              <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                Confirm your relationship to the subject and your current contact information.
              </p>
            </div>

            {revisionTx && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-800 dark:text-amber-400 animate-in fade-in duration-300 max-w-3xl mx-auto w-full">
                <AlertCircle className="w-5 h-5 shrink-0 animate-pulse mt-0.5" />
                <div className="text-left space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider italic">Attention: Revision Needed</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-300 leading-relaxed italic">
                    &ldquo;{revisionTx.rejectionRemarks || "Please check the highlighted checklist files or values and submit them again."}&rdquo;
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <InformantInfo
                firstName={residentData?.firstName}
                middleName={residentData?.middleName}
                lastName={residentData?.lastName}
                suffix={residentData?.suffix}
                birthDate={residentData?.dateOfBirth}
                age={residentData?.age?.toString()}
                civilStatus={residentData?.civilStatus}
                citizenship={residentData?.citizenship}
                relationship={formData.relation}
                occupation={formData.occupation}
                contactNumber={formData.contactNumber}
                email={formData.email}
                onRelationshipChange={(val) => handleFormChange("relation", val)}
                onOccupationChange={(val) => handleFormChange("occupation", val)}
                onContactNumberChange={(val) => handleFormChange("contactNumber", val)}
                onEmailChange={(val) => handleFormChange("email", val)}
                relationshipOptions={RELATION_OPTIONS}
                errors={{
                  relationship: (showValidationErrors && !formData.relation) ? "Required" : "",
                  contactNumber: (showValidationErrors && !formData.contactNumber) ? "Required" : ""
                }}
                showErrors={showValidationErrors}
                isCardWrapped={false}
              />
            </div>

            <div className="flex justify-between items-center pt-8 mt-auto">
              <Button
                type="button"
                onClick={() => {
                  if (existingRequests.length > 0) {
                    setCurrentStep("EXISTING");
                  } else {
                    router.push("/modules/civil-registry");
                  }
                }}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNextFromIdentity}
                className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40"
              >
                Subject Details <ChevronRight className="inline-block ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: DETAILS */}
        {currentStep === "DETAILS" && (() => {
          const isSelf = formData.relation === "Self (Aplikante)";
          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                  Subject <span className="text-theme-primary">Details</span>
                </h2>
                <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                  Provide the exact details of the person whose birth certificate is being requested.
                </p>
              </div>

              <div className="space-y-5 mt-6">
                {/* Row 1: Name fields in a single responsive row (4 columns on md and up) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      required
                      id="certFirstName"
                      placeholder="First Name"
                      value={formData.certFirstName}
                      onChange={e => !isSelf && handleFormChange("certFirstName", e.target.value)}
                      disabled={isSelf}
                      className={cn(
                        "h-12 bg-slate-50/20 dark:bg-black/20 text-slate-900 dark:text-white rounded-xl focus-visible:ring-theme-primary/20 border",
                        showValidationErrors && !formData.certFirstName ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-white/10",
                        isSelf && "cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 opacity-80"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Middle Name
                    </Label>
                    <Input
                      placeholder="Middle Name"
                      value={formData.certMiddleName}
                      onChange={e => !isSelf && handleFormChange("certMiddleName", e.target.value)}
                      disabled={isSelf}
                      className={cn(
                        "h-12 bg-slate-50/20 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-theme-primary/20",
                        isSelf && "cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 opacity-80"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Last Name <span className="text-red-555">*</span>
                    </Label>
                    <Input
                      required
                      id="certLastName"
                      placeholder="Last Name"
                      value={formData.certLastName}
                      onChange={e => !isSelf && handleFormChange("certLastName", e.target.value)}
                      disabled={isSelf}
                      className={cn(
                        "h-12 bg-slate-50/20 dark:bg-black/20 text-slate-900 dark:text-white rounded-xl focus-visible:ring-theme-primary/20 border",
                        showValidationErrors && !formData.certLastName ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-white/10",
                        isSelf && "cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 opacity-80"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Suffix
                    </Label>
                    <Input
                      placeholder="e.g. Jr, Sr"
                      value={formData.certSuffix}
                      onChange={e => !isSelf && handleFormChange("certSuffix", e.target.value)}
                      disabled={isSelf}
                      className={cn(
                        "h-12 bg-slate-50/20 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-theme-primary/20",
                        isSelf && "cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 opacity-80"
                      )}
                    />
                  </div>
                </div>

                {/* Row 2: Gender, Date of Birth, and Place of Birth all on one line, aligned together */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Gender (Kasarian) <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.sex}
                      onValueChange={val => !isSelf && handleFormChange("sex", val)}
                      disabled={isSelf}
                    >
                      <SelectTrigger
                        id="sex"
                        className={cn(
                          "h-12 w-full rounded-xl bg-slate-50/20 dark:bg-black/20 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus-visible:ring-theme-primary/20 focus:border-theme-primary border",
                          showValidationErrors && !formData.sex ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-white/10",
                          isSelf && "cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 opacity-80"
                        )}
                      >
                        <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                        <SelectItem value="MALE" className="focus:bg-theme-primary focus:text-white">Male (Lalake)</SelectItem>
                        <SelectItem value="FEMALE" className="focus:bg-theme-primary focus:text-white">Female (Babae)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Date of Birth (Araw ng Kapanganakan) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      required
                      id="dateOfEvent"
                      type="date"
                      value={formData.dateOfEvent}
                      onChange={e => !isSelf && handleFormChange("dateOfEvent", e.target.value)}
                      disabled={isSelf}
                      className={cn(
                        "h-12 bg-slate-50/20 dark:bg-black/20 text-slate-900 dark:text-white rounded-xl focus-visible:ring-theme-primary/20 dark:[color-scheme:dark] border",
                        showValidationErrors && !formData.dateOfEvent ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-white/10",
                        isSelf && "cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 opacity-80"
                      )}
                    />
                  </div>

                  <div className="space-y-2 col-span-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Place of Birth (Lugar ng Kapanganakan) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      required
                      id="placeOfEvent"
                      placeholder="e.g. City / Municipality, Province"
                      value={formData.placeOfEvent}
                      onChange={e => !isSelf && handleFormChange("placeOfEvent", e.target.value)}
                      disabled={isSelf}
                      className={cn(
                        "h-12 bg-slate-50/20 dark:bg-black/20 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-500 focus-visible:ring-theme-primary/20 border",
                        showValidationErrors && !formData.placeOfEvent ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-white/10",
                        isSelf && "cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 opacity-80"
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-8 mt-auto">
                <Button
                  type="button"
                  onClick={() => setCurrentStep("IDENTITY")}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={handleNextFromDetails}
                  className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40"
                >
                  Parents Info <ChevronRight className="inline-block ml-1 w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Step: PARENTS */}
        {currentStep === "PARENTS" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1">
            <div className="text-center">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Parents <span className="text-theme-primary">Information</span>
              </h2>
              <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                Provide parents' full names and secondary details for civil registry retrieval.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              {/* Father Information */}
              <div className="bg-slate-50/30 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary mb-2">Father's Full Name (Ama)</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">First Name</Label>
                    <Input
                      placeholder="Father's First Name"
                      value={formData.fatherFirstName}
                      onChange={e => handleFormChange("fatherFirstName", e.target.value)}
                      className="h-11 bg-slate-50/20 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Middle Name</Label>
                    <Input
                      placeholder="Father's Middle Name"
                      value={formData.fatherMiddleName}
                      onChange={e => handleFormChange("fatherMiddleName", e.target.value)}
                      className="h-11 bg-slate-50/20 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Last Name</Label>
                  <Input
                    placeholder="Father's Last Name"
                    value={formData.fatherLastName}
                    onChange={e => handleFormChange("fatherLastName", e.target.value)}
                    className="h-11 bg-slate-50/20 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Mother Information */}
              <div className="bg-slate-50/30 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary mb-2">Mother's Maiden Name (Ina - Pagkadalaga) <span className="text-red-500">*</span></h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">First Name <span className="text-red-500">*</span></Label>
                    <Input
                      required
                      id="motherFirstName"
                      placeholder="Mother's First Name"
                      value={formData.motherFirstName}
                      onChange={e => handleFormChange("motherFirstName", e.target.value)}
                      className={cn(
                        "h-11 bg-slate-50/20 dark:bg-black/20 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-500 border",
                        showValidationErrors && !formData.motherFirstName ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-white/10"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Middle Name</Label>
                    <Input
                      placeholder="Mother's Middle Name"
                      value={formData.motherMiddleName}
                      onChange={e => handleFormChange("motherMiddleName", e.target.value)}
                      className="h-11 bg-slate-50/20 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Last Name <span className="text-red-500">*</span></Label>
                  <Input
                    required
                    id="motherLastName"
                    placeholder="Mother's Last Name"
                    value={formData.motherLastName}
                    onChange={e => handleFormChange("motherLastName", e.target.value)}
                    className={cn(
                      "h-11 bg-slate-50/20 dark:bg-black/20 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-500 border",
                      showValidationErrors && !formData.motherLastName ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-white/10"
                    )}
                  />
                </div>
              </div>
            </div>



            <div className="flex justify-between items-center pt-8 mt-auto">
              <Button
                type="button"
                onClick={() => setCurrentStep("DETAILS")}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNextFromParents}
                className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40"
              >
                ID Verification <ChevronRight className="inline-block ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: UPLOAD */}
        {currentStep === "UPLOAD" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1">
            <div className="text-center">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                Requestor <span className="text-theme-primary">ID Verification</span>
              </h2>
              <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                We need a copy of your valid ID for authentication and security.
              </p>
            </div>

            <div className="max-w-2xl mx-auto mt-6 w-full">
              <RequiredDocuments
                title="Required Documents"
                subtitle="Please provide clear copies of the front and back of your valid ID."
                idChoice={idChoice}
                onIdChoiceChange={setIdChoice}
                residentData={residentData}
                hasProfileId={!!(residentData?.idFrontUrl || residentData?.idBackUrl)}
                onViewProfileId={(side) => {
                  const url = side === "front" ? residentData?.idFrontUrl : residentData?.idBackUrl;
                  handleOpenViewer(null, `Valid ID (${side === "front" ? "Front Side" : "Back Side"})`, url);
                }}
                documents={[
                  {
                    key: "idFront",
                    label: "Valid ID (Front Side)",
                    file: formData.newIdFile,
                    previewUrl: idFrontHandoffUrl,
                    infoText: "PDF / IMAGE (MAX 5MB)",
                    error: showValidationErrors && !idFrontHandoffUrl && !formData.newIdFile,
                    onFileSelect: async (newFile) => {
                      setIsUploadingId(true);
                      try {
                        toast.loading("Uploading ID Front...", { id: "id-front-upload" });
                        const userId = residentData?.userId || residentData?.id;
                        if (!userId) throw new Error("User profile not found. Please log in again.");
                        const publicUrl = await uploadFileClientSide(newFile, "newIdFile", userId);
                        setIdFrontHandoffUrl(publicUrl);
                        setIdFrontHandoffFileName(newFile.name);
                        handleFormChange("newIdFile", newFile);
                        toast.success("ID Front uploaded!", { id: "id-front-upload" });
                      } catch (error: any) {
                        toast.error(error.message || "Upload failed.", { id: "id-front-upload" });
                        handleFormChange("newIdFile", newFile);
                      } finally {
                        setIsUploadingId(false);
                      }
                    },
                    onClickUpload: () => startHandoff("idFront"),
                    onClear: () => {
                      setIdFrontHandoffUrl(null);
                      handleFormChange("newIdFile", null);
                      setIdFrontHandoffFileName("");
                      toast.success("Front ID removed.");
                    },
                    onView: () => handleOpenViewer(formData.newIdFile, "Valid ID (Front Side)", idFrontHandoffUrl),
                  },
                  {
                    key: "idBack",
                    label: "Valid ID (Back Side)",
                    file: formData.newIdFileBack,
                    previewUrl: idBackHandoffUrl,
                    infoText: "PDF / IMAGE (MAX 5MB)",
                    error: showValidationErrors && !idBackHandoffUrl && !formData.newIdFileBack,
                    onFileSelect: async (newFile) => {
                      setIsUploadingId(true);
                      try {
                        toast.loading("Uploading ID Back...", { id: "id-back-upload" });
                        const userId = residentData?.userId || residentData?.id;
                        if (!userId) throw new Error("User profile not found. Please log in again.");
                        const publicUrl = await uploadFileClientSide(newFile, "newIdFileBack", userId);
                        setIdBackHandoffUrl(publicUrl);
                        setIdBackHandoffFileName(newFile.name);
                        handleFormChange("newIdFileBack", newFile);
                        toast.success("ID Back uploaded!", { id: "id-back-upload" });
                      } catch (error: any) {
                        toast.error(error.message || "Upload failed.", { id: "id-back-upload" });
                        handleFormChange("newIdFileBack", newFile);
                      } finally {
                        setIsUploadingId(false);
                      }
                    },
                    onClickUpload: () => startHandoff("idBack"),
                    onClear: () => {
                      setIdBackHandoffUrl(null);
                      handleFormChange("newIdFileBack", null);
                      setIdBackHandoffFileName("");
                      toast.success("Back ID removed.");
                    },
                    onView: () => handleOpenViewer(formData.newIdFileBack, "Valid ID (Back Side)", idBackHandoffUrl),
                  }
                ]}
              />
            </div>

            <div className="flex justify-between items-center pt-8 mt-auto">
              <Button
                type="button"
                onClick={() => setCurrentStep("PARENTS")}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNextFromUpload}
                disabled={isUploadingId}
                className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40 disabled:opacity-50"
              >
                Proceed to Submit <ChevronRight className="inline-block mr-1 w-4 h-4" />
              </Button>            </div>
          </div>
        )}

        {/* Step: SUBMIT */}
        {currentStep === "SUBMIT" && (
          !selectedApplication ? (
            <ReviewAndSubmit
              title="Review & Confirm"
              subtitle="Please review your information before final submission."
              policyAccepted={privacyAccepted}
              onPolicyAcceptedChange={setPrivacyAccepted}
              onReviewPolicy={() => setIsPrivacyModalOpen(true)}
              showErrors={showValidationErrors}
              submitting={isSubmitting}
              submitLabel="Submit Application"
              feeSummary={
                <div className="bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white">
                      <CheckCircle2 size={18} className="stroke-[2.5] text-theme-primary" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Fee Summary</h3>
                  </div>
                  <div className="space-y-3 text-xs md:text-sm font-bold">
                    <div className="flex justify-between items-center border-b border-dashed border-slate-250 dark:border-white/10 pb-3">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Service Request</span>
                      <span className="text-slate-700 dark:text-slate-350 uppercase">Birth Certificate Copy</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed border-slate-250 dark:border-white/10 pb-3">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Base Filing Fee</span>
                      <span className="text-slate-700 dark:text-slate-350">₱{dbBaseFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-gradient-to-r from-theme-primary to-theme-secondary/85 text-white rounded-2xl p-4 md:p-6 shadow-xl shadow-theme-primary/10 mt-6">
                      <span className="font-black uppercase tracking-widest text-[10px] md:text-xs text-white/90">Total Amount Due</span>
                      <span className="font-black text-xl md:text-2xl tracking-tight">₱{dbBaseFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              }
              onSubmit={handleSubmitRequest}
              onBack={() => setCurrentStep("UPLOAD")}
              backLabel="Back to Upload"
              detailsCards={
                <div className="grid md:grid-cols-2 gap-6 mt-6">
                  {/* Card 1: Subject Details (Aplikante) */}
                  <div className="bg-slate-50/30 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                      <User size={16} /> Subject Details (Aplikante)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">First Name</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.certFirstName}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Middle Name</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.certMiddleName || "N/A"}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Last Name</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.certLastName}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Suffix</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.certSuffix || "N/A"}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Gender</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.sex}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Birth</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold">{formatBirthDate(formData.dateOfEvent)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Place of Birth</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.placeOfEvent}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Parents Details */}
                  <div className="bg-slate-50/30 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                      <Users size={16} /> Parents Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Father's Full Name</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                          {[formData.fatherFirstName, formData.fatherMiddleName, formData.fatherLastName].filter(Boolean).join(" ") || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Mother's Maiden Name</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                          {[formData.motherFirstName, formData.motherMiddleName, formData.motherLastName].filter(Boolean).join(" ") || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Requestor & Contact Details */}
                  <div className="bg-slate-50/30 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                      <User size={16} /> Requestor & Contact Info
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Relationship</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.relation}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Contact Number</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold">{formData.contactNumber}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Email Address</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold">{formData.email || "N/A"}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Occupation</span>
                        <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.occupation || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
              documentsSection={
                <div className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white">
                      <Upload size={18} className="stroke-[2.5]" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Verification IDs</h3>
                  </div>

                  {idChoice === "PROFILE" ? (
                    <div className="space-y-3 w-full">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <CheckCircle2 size={14} className="text-theme-primary" />
                        <span>Verified Profile ID Attached</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        {/* Front ID Card */}
                        <ReadOnlyDocumentPreview
                          file={null}
                          previewUrl={residentData?.idFrontUrl}
                          label="Front ID Photo"
                          fileName="Profile ID Front"
                          onView={() => {
                            if (residentData?.idFrontUrl) {
                              handleOpenViewer(null, "Valid ID (Front Side)", residentData.idFrontUrl);
                            }
                          }}
                        />

                        {/* Back ID Card */}
                        <ReadOnlyDocumentPreview
                          file={null}
                          previewUrl={residentData?.idBackUrl}
                          label="Back ID Photo"
                          fileName="Profile ID Back"
                          onView={() => {
                            if (residentData?.idBackUrl) {
                              handleOpenViewer(null, "Valid ID (Back Side)", residentData.idBackUrl);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      {/* Front ID Card */}
                      <ReadOnlyDocumentPreview
                        file={formData.newIdFile}
                        previewUrl={idFrontHandoffUrl}
                        label="Front ID Photo"
                        fileName={idFrontHandoffFileName || (formData.newIdFile ? formData.newIdFile.name : "Not uploaded")}
                        onView={() => {
                          if (formData.newIdFile || idFrontHandoffUrl) {
                            handleOpenViewer(formData.newIdFile, "Valid ID (Front Side)", idFrontHandoffUrl);
                          }
                        }}
                      />

                      {/* Back ID Card */}
                      <ReadOnlyDocumentPreview
                        file={formData.newIdFileBack}
                        previewUrl={idBackHandoffUrl}
                        label="Back ID Photo"
                        fileName={idBackHandoffFileName || (formData.newIdFileBack ? formData.newIdFileBack.name : "Not uploaded")}
                        onView={() => {
                          if (formData.newIdFileBack || idBackHandoffUrl) {
                            handleOpenViewer(formData.newIdFileBack, "Valid ID (Back Side)", idBackHandoffUrl);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              }
            />

          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-theme-primary/20 text-theme-primary flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                  Request <span className="text-theme-primary">Submitted</span>
                </h2>
                <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                  Your Birth Certificate certified copy request has been logged successfully.
                </p>
              </div>

              {/* Printable Receipt Frame */}
              <div className="max-w-2xl mx-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2rem] p-8 space-y-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <Users size={160} />
                </div>

                <div className="flex justify-between items-start gap-4 flex-wrap border-b border-slate-200 dark:border-white/10 pb-6">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">MUNICIPAL CIVIL REGISTRY</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-theme-primary">Local Civil Registry Office</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-theme-primary/20 text-slate-900 dark:text-white text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest border border-theme-primary/30">
                      {selectedApplication.status}
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6 text-sm font-semibold">
                  <div className="space-y-4">
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Transaction ID</span>
                      <span className="text-slate-900 dark:text-white text-xs font-black">{selectedApplication.id}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Subject Name</span>
                      <span className="text-slate-900 dark:text-white uppercase font-black">{selectedApplication.birthCertificateRequest?.subjectName}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Date of Birth</span>
                      <span className="text-slate-900 dark:text-white font-black">
                        {selectedApplication.birthCertificateRequest?.dateOfEvent
                          ? new Date(selectedApplication.birthCertificateRequest.dateOfEvent).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Fulfillment Strategy</span>
                      <span className="text-slate-900 dark:text-white font-black uppercase">{selectedApplication.fulfillmentType || "PICK_UP (Office Claim)"}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Paid Amount</span>
                      <span className="text-slate-900 dark:text-white font-black">₱{selectedApplication.totalAmount?.toFixed(2) || dbBaseFee.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Request Purpose</span>
                      <span className="text-slate-900 dark:text-white font-bold">{selectedApplication.additionalData?.purpose || "Personal Use"}</span>
                    </div>
                  </div>
                </div>

                {selectedApplication.status === "PAID" && (
                  <div className="p-4 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex gap-3 text-xs text-theme-primary font-semibold leading-relaxed">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <span>Your payment has been successfully recorded. Civil registry staff will retrieve the certified copy. You will receive notification for pickup/delivery once ready.</span>
                  </div>
                )}

                {selectedApplication.status === "UNPAID" && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-xs text-amber-700 dark:text-amber-300 font-semibold leading-relaxed">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>This request is drafted but unpaid. Please click checkout below to proceed with the payment.</span>
                  </div>
                )}

                {selectedApplication.status === "FOR_REVISION" && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-xs text-amber-600 dark:text-amber-300 font-semibold leading-relaxed">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>This request requires revision. Please check the rejection remarks or checklist files and resubmit.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4 pt-8">
                <Button
                  type="button"
                  onClick={() => setCurrentStep("EXISTING")}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Back to List
                </Button>
                <Button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg flex items-center gap-2"
                >
                  <Printer size={16} /> Print Receipt
                </Button>
                {selectedApplication.status === "FOR_REVISION" && !selectedApplication.isCancelled && (
                  <Button
                    type="button"
                    onClick={() => {
                      window.location.href = `/modules/civil-registry/birth-certificate-request?revisionId=${selectedApplication.id}`;
                    }}
                    className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg"
                  >
                    Revise Details
                  </Button>
                )}
              </div>
            </div>
          )
        )}

      </div>

      {/* Secure Handoff QR Code Modal */}
      <SecureQrUploadModal
        isOpen={isHandoffOpen}
        onClose={() => { setIsHandoffOpen(false); setHandoffToken(""); }}
        qrCode={handoffQrCode}
        slotLabel={getHandoffSlotLabel()}
        expiresAt={handoffExpiresAt}
      />

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={viewerFile}
        fileUrl={viewerUrl}
        title={viewerTitle}
      />



      {/* Privacy Modal */}
      <PrivacyTermsModal
        isOpen={isPrivacyModalOpen}
        themeColor="var(--primary-theme)"
        onClose={() => setIsPrivacyModalOpen(false)}
        onAccept={() => {
          setPrivacyAccepted(true);
          setIsPrivacyModalOpen(false);
        }}
      />

    </div>
  );
}

const LoaderComponent = () => (
  <div className="flex flex-col items-center justify-center gap-4 py-12">
    <div className="w-16 h-16 border-4 border-theme-primary/20 border-t-theme-primary rounded-full animate-spin"></div>
    <p className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Initializing Portal</p>
  </div>
);


