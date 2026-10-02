/* eslint-disable react/no-unescaped-entities, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";
import {
  User,
  CheckCircle2,
  Upload,
  Printer,
  ChevronRight,
  ChevronLeft,
  Home,
  Heart,
  Loader2,
  AlertCircle
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
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getCurrentUserResident,
  ensureCivilRegistryTransactionTypes,
  submitCivilRegistryTransaction,
  getTransactionTypes,
  getTransactionById,
  getSecureUploadUrlAction,
  getExistingMarriageCertificateRequests
} from "./actions";
import RequestList from "../_components/request-list";
import InformantInfo from "../_components/informant-info";
import ReviewAndSubmit from "../_components/review-and-submit";
import RequiredDocuments from "../_components/required-documents";
import ReadOnlyDocumentPreview from "../_components/read-only-document-preview";

type Step = "EXISTING" | "IDENTITY" | "DETAILS" | "UPLOAD" | "SUBMIT";

const STEPS = [
  { id: "IDENTITY", label: "Identity", icon: User },
  { id: "DETAILS", label: "Marriage Details", icon: Heart },
  { id: "UPLOAD", label: "Upload ID", icon: Upload },
  { id: "SUBMIT", label: "Submit", icon: CheckCircle2 },
];

const RELATION_OPTIONS = [
  { value: "SPOUSE", label: "Spouse (Asawa)" },
  { value: "SON", label: "Son (Anak na Lalaki)" },
  { value: "DAUGHTER", label: "Daughter (Anak na Babae)" },
  { value: "MOTHER", label: "Mother (Ina)" },
  { value: "FATHER", label: "Father (Ama)" },
  { value: "SIBLING", label: "Sibling (Kapatid)" },
  { value: "REPRESENTATIVE", label: "Legal Representative / Authorized Person" },
  { value: "OTHER", label: "Other (Iba pa)" }
];

const LOCAL_FALLBACK_PROVINCES = [
  "PANGASINAN", "METRO MANILA", "LA UNION", "TARLAC", "BENGUET", "ILOCOS SUR", "ILOCOS NORTE", "NUEVA ECIJA", "PAMPANGA", "BULACAN"
];

const LOCAL_FALLBACK_CITIES = [
  "CENTRAL", "EAST DISTRICT", "WEST DISTRICT", "NORTH DISTRICT", "SOUTH DISTRICT"
];



export default function MarriageCertificateRequestPage() {
  const router = useRouter();
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState<Step>("EXISTING");
  const [existingRequests, setExistingRequests] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [residentData, setResidentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typeId, setTypeId] = useState<string>("");
  const [dbBaseFee, setDbBaseFee] = useState<number>(150);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [maxStepIdx, setMaxStepIdx] = useState(0);

  // Digital Handoff (QR Code Upload) States
  const [handoffToken, setHandoffToken] = useState("");
  const [handoffQrCode, setHandoffQrCode] = useState("");
  const [handoffSessionSlot, setHandoffSessionSlot] = useState("");
  const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);

  // Upload Choice
  const [idChoice, setIdChoice] = useState<"PROFILE" | "UPLOAD">("PROFILE");

  // Document Viewer States
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");

  // Place of marriage dropdown and text states
  const [placeCountry, setPlaceCountry] = useState("PHILIPPINES");
  const [placeProvince, setPlaceProvince] = useState("");
  const [placeCity, setPlaceCity] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customProvince, setCustomProvince] = useState("");
  const [customCity, setCustomCity] = useState("");

  // Lists from API
  const [countriesList, setCountriesList] = useState<{ code: string; name: string }[]>([]);
  const [provincesList, setProvincesList] = useState<{ code: string; name: string }[]>([]);
  const [citiesList, setCitiesList] = useState<{ code: string; name: string }[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [provincesLoading, setProvincesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Revision / Draft parameters
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [revisionTx, setRevisionTx] = useState<any>(null);

  // Form Data State
  const [formData, setFormData] = useState<any>({
    relationship: "",
    relationshipSpecify: "",
    contactNumber: "",
    email: "",
    occupation: "",
    informantAddress: "",

    certFirstName: "",
    certMiddleName: "",
    certLastName: "",
    certSuffix: "",
    husbandFullName: "",
    spouseName: "",
    dateOfEvent: "",
    placeOfEvent: "",
    idType: "",

    newIdFile: null as File | null,
    newIdFileBack: null as File | null,
  });

  const [idFrontHandoffUrl, setIdFrontHandoffUrl] = useState<string | null>(null);
  const [idBackHandoffUrl, setIdBackHandoffUrl] = useState<string | null>(null);

  // Terms and Privacy Modal States
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const handleAcceptPrivacy = () => {
    setPrivacyOpen(false);
    setPrivacyAccepted(true);
  };

  const handleOpenViewer = (file: File | null, title: string, url: string | null = null) => {
    setViewerUrl(url || (file ? URL.createObjectURL(file) : null));
    setViewerTitle(title);
    setViewerOpen(true);
  };

  const handleFormChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const isRestoredRef = useRef(false);
  const prevRelationshipRef = useRef<string>("");

  // PSGC Dropdowns: Load Provinces & Cities
  useEffect(() => {
    if (!placeProvince || placeProvince === "OTHER" || placeCountry !== "PHILIPPINES") {
      setCitiesList([]);
      return;
    }

    const selectedProvObj = provincesList.find((p: any) => p && p.name && p.name.toUpperCase() === placeProvince.toUpperCase());
    if (!selectedProvObj || !selectedProvObj.code) return;

    async function loadCities(provCode: string) {
      setCitiesLoading(true);
      try {
        const res = await fetch(`https://psgc.gitlab.io/api/provinces/${provCode}/cities-municipalities/`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const sorted = data.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
            setCitiesList(sorted);

            if (sorted.length > 0 && !placeCity) {
              setPlaceCity(sorted[0].name.toUpperCase());
            }
          } else {
            setCitiesList(LOCAL_FALLBACK_CITIES.map(n => ({ code: n, name: n })));
          }
        } else {
          setCitiesList(LOCAL_FALLBACK_CITIES.map(n => ({ code: n, name: n })));
        }
      } catch {
        setCitiesList(LOCAL_FALLBACK_CITIES.map(n => ({ code: n, name: n })));
      } finally {
        setCitiesLoading(false);
      }
    }
    loadCities(selectedProvObj.code);
  }, [placeProvince, provincesList, placeCountry]);

  // Construct place of event string
  useEffect(() => {
    if (loading) return;

    const city = (placeCountry === "OTHER" ? customCity : (placeProvince === "OTHER" ? customCity : (placeCity === "OTHER" ? customCity : placeCity))).trim().toUpperCase();
    const prov = (placeCountry === "OTHER" ? customProvince : (placeProvince === "OTHER" ? customProvince : placeProvince)).trim().toUpperCase();
    const country = (placeCountry === "OTHER" ? customCountry : placeCountry).trim().toUpperCase();

    const parts: string[] = [];
    if (city) parts.push(city);
    if (prov) parts.push(prov);
    if (country) parts.push(country);

    setFormData((prev: any) => ({
      ...prev,
      placeOfEvent: parts.join(", ")
    }));
  }, [placeCountry, placeProvince, placeCity, customCountry, customProvince, customCity, loading]);

  // Auto-populate when relationship is SELF
  useEffect(() => {
    if (loading) return;
    if (isRestoredRef.current) {
      isRestoredRef.current = false;
      return;
    }

    if (formData.relationship === "SELF" && residentData) {
      const isFemale = residentData.gender === "FEMALE";
      setFormData((prev: any) => ({
        ...prev,
        husbandFullName: isFemale ? "" : `${residentData.firstName || ""} ${residentData.lastName || ""}`.trim().toUpperCase(),
        certFirstName: isFemale ? "" : (residentData.firstName || "").toUpperCase(),
        certMiddleName: isFemale ? "" : (residentData.middleName || "").toUpperCase(),
        certLastName: isFemale ? "" : (residentData.lastName || "").toUpperCase(),
        certSuffix: isFemale ? "" : (residentData.suffix || "").toUpperCase(),
        spouseName: isFemale ? `${residentData.firstName || ""} ${residentData.lastName || ""}`.trim().toUpperCase() : "",
      }));
    } else if (formData.relationship && formData.relationship !== "SELF" && prevRelationshipRef.current === "SELF") {
      setFormData((prev: any) => ({
        ...prev,
        husbandFullName: "",
        certFirstName: "",
        certMiddleName: "",
        certLastName: "",
        certSuffix: "",
        spouseName: "",
        dateOfEvent: "",
        placeOfEvent: ""
      }));
    }
  }, [formData.relationship, residentData, loading]);

  useEffect(() => {
    prevRelationshipRef.current = formData.relationship;
  }, [formData.relationship]);

  // Restore Draft & Init
  useEffect(() => {
    async function init() {
      try {
        const savedResident = sessionStorage.getItem("active_resident");
        if (!savedResident) {
          router.push("/");
          return;
        }

        const residentObj = JSON.parse(savedResident);
        const uId = residentObj.userId || residentObj.id;
        if (!uId) {
          router.push("/");
          return;
        }

        await ensureCivilRegistryTransactionTypes();

        const urlParams = new URLSearchParams(window.location.search);
        const revId = urlParams.get("revisionId");

        let txData: any = null;
        if (revId) {
          const txRes = await getTransactionById(revId, uId);
          if (txRes.success && txRes.data) {
            txData = txRes.data;
            setRevisionId(revId);
            setRevisionTx(txData);
          } else {
            toast.error("Failed to fetch revision details");
          }
        }

        const [resResult, typesResult, existingRes] = await Promise.all([
          getCurrentUserResident(uId),
          getTransactionTypes(),
          getExistingMarriageCertificateRequests(uId)
        ]);

        if (resResult.success && resResult.data) {
          const r = resResult.data;
          setResidentData(r);

          const parts = [
            r.houseNumber && `#${r.houseNumber}`,
            r.street && `${r.street} St.`,
            r.purok && `Purok ${r.purok}`,
            r.sitio && `Sitio ${r.sitio}`,
            r.barangay && `Brgy. ${r.barangay}`,
            r.municipality || "",
            r.province || ""
          ].filter(Boolean);
          const constructedAddr = parts.join(", ").toUpperCase();

          if (txData) {
            const addData = txData.additionalData as any || {};
            const resSnapshot = txData.residentSnapshot as any || r || {};

            let certFN = addData.certFirstName || "";
            let certMN = addData.certMiddleName || "";
            let certLN = addData.certLastName || "";
            let certSuf = addData.certSuffix || "";
            let certHusbandFullName = addData.certHusbandFullName || "";
            if (!certHusbandFullName && addData.subjectName) {
              certHusbandFullName = addData.subjectName.split("&")[0]?.trim() || "";
            }
            if (!certFN && !certLN && certHusbandFullName) {
              const nameParts = certHusbandFullName.split(/\s+/);
              certLN = nameParts.pop() || "";
              certFN = nameParts.shift() || "";
              if (["JR", "SR", "I", "II", "III", "IV"].includes(certLN.toUpperCase())) {
                certSuf = certLN;
                certLN = nameParts.pop() || "";
              }
              certMN = nameParts.join(" ") || "";
            }

            setFormData({
              relationship: addData.relationship || "",
              relationshipSpecify: addData.relationship?.startsWith("OTHER:") ? addData.relationship.replace("OTHER:", "").trim() : "",
              contactNumber: addData.contactNumber || resSnapshot.contactNumber || "",
              email: addData.email || resSnapshot.email || "",
              occupation: addData.occupation || r.occupation || "",
              informantAddress: addData.informantAddress || constructedAddr,
              certFirstName: certFN,
              certMiddleName: certMN,
              certLastName: certLN,
              certSuffix: certSuf,
              husbandFullName: certHusbandFullName,
              spouseName: addData.spouseName || "",
              dateOfEvent: addData.dateOfEvent || "",
              placeOfEvent: addData.placeOfEvent || "",
              idType: addData.idType || r.idType || "",
              newIdFile: null,
              newIdFileBack: null,
            });

            if (addData.placeOfEvent) {
              const eventParts = addData.placeOfEvent.split(",").map((p: string) => p.trim());
              if (eventParts.length >= 3) {
                setPlaceCountry(eventParts[eventParts.length - 1]);
                setPlaceProvince(eventParts[eventParts.length - 2]);
                setPlaceCity(eventParts[eventParts.length - 3]);
              }
            }

            if (addData.validIdFront) setIdFrontHandoffUrl(addData.validIdFront);
            if (addData.validIdBack) setIdBackHandoffUrl(addData.validIdBack);
            setIdChoice("UPLOAD");
          } else {
            // Restore from session draft if not in revision mode
            const savedStep = sessionStorage.getItem("marriage-request-step");
            const savedForm = sessionStorage.getItem("marriage-request-form");
            const savedFront = sessionStorage.getItem("marriage-request-front-url");
            const savedBack = sessionStorage.getItem("marriage-request-back-url");

            if (savedStep && savedStep !== "SUBMIT") {
              setCurrentStep(savedStep as Step);
            }
            if (savedForm) {
              try {
                const parsed = JSON.parse(savedForm);
                setFormData((prev: any) => ({ ...prev, ...parsed }));
                isRestoredRef.current = true;
              } catch (e) {
                console.error("Failed to parse saved form", e);
              }
            }
            if (savedFront) setIdFrontHandoffUrl(savedFront);
            if (savedBack) setIdBackHandoffUrl(savedBack);

            setFormData((prev: any) => ({
              ...prev,
              email: r.user?.email || r.email || "",
              contactNumber: r.contactNumber || "",
              occupation: r.occupation || "",
              informantAddress: constructedAddr
            }));
          }
        }

        if (typesResult.success && typesResult.data) {
          const marriageRequestType = typesResult.data.find((t: any) => t.code === "LCR_MARRIAGE");
          if (marriageRequestType) {
            setTypeId(marriageRequestType.id);
            setDbBaseFee(Number(marriageRequestType.baseFee ?? 150));
          }
        }

        if (existingRes.success && existingRes.data) {
          setExistingRequests(existingRes.data);
        }

        const returnedTransactionId = urlParams.get("transactionId");
        const returnedApplication = (existingRes.success && existingRes.data && returnedTransactionId)
          ? existingRes.data.find((app: any) => app.id === returnedTransactionId)
          : null;

        if (returnedApplication) {
          setSelectedApplication(returnedApplication);
          setCurrentStep("SUBMIT");
        } else if (revId) {
          setCurrentStep("IDENTITY");
        } else if (existingRes.success && existingRes.data && existingRes.data.length > 0) {
          const savedStep = sessionStorage.getItem("marriage-request-step");
          if (savedStep && savedStep !== "SUBMIT") {
            setCurrentStep(savedStep as Step);
          } else {
            setCurrentStep("EXISTING");
          }
        } else {
          const savedStep = sessionStorage.getItem("marriage-request-step");
          if (savedStep && savedStep !== "SUBMIT") {
            setCurrentStep(savedStep as Step);
          } else {
            setCurrentStep("IDENTITY");
          }
        }

        // Fetch countries & provinces
        setCountriesLoading(true);
        setProvincesLoading(true);
        (async () => {
          try {
            const res = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                const list = data.map((c: any) => ({
                  code: c.cca2,
                  name: c.name.common.toUpperCase()
                })).sort((a: any, b: any) => a.name.localeCompare(b.name));
                setCountriesList(list);
              }
            }
          } catch {
            console.warn("Countries API unavailable.");
          } finally {
            setCountriesLoading(false);
          }
        })();

        (async () => {
          try {
            const res = await fetch("https://psgc.gitlab.io/api/provinces/");
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                const sorted = data.sort((a: any, b: any) => a.name.localeCompare(b.name));
                setProvincesList(sorted);
              } else {
                setProvincesList(LOCAL_FALLBACK_PROVINCES.map(n => ({ code: n, name: n })));
              }
            } else {
              setProvincesList(LOCAL_FALLBACK_PROVINCES.map(n => ({ code: n, name: n })));
            }
          } catch {
            setProvincesList(LOCAL_FALLBACK_PROVINCES.map(n => ({ code: n, name: n })));
          } finally {
            setProvincesLoading(false);
          }
        })();

      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Save session draft
  useEffect(() => {
    if (!loading && !revisionId) {
      sessionStorage.setItem("marriage-request-step", currentStep);
      sessionStorage.setItem("marriage-request-form", JSON.stringify({
        ...formData,
        newIdFile: null,
        newIdFileBack: null,
      }));
      if (idFrontHandoffUrl) sessionStorage.setItem("marriage-request-front-url", idFrontHandoffUrl);
      else sessionStorage.removeItem("marriage-request-front-url");
      if (idBackHandoffUrl) sessionStorage.setItem("marriage-request-back-url", idBackHandoffUrl);
      else sessionStorage.removeItem("marriage-request-back-url");
    }
  }, [currentStep, formData, idFrontHandoffUrl, idBackHandoffUrl, loading]);

  // Digital Handoff upload polling
  useEffect(() => {
    if (!handoffToken) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/upload-handoff/${encodeURIComponent(handoffToken)}`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.status === "uploaded") {
          const uploadedFiles = result.files || [];
          const uploadedFile = uploadedFiles[0];
          if (uploadedFile) {
            if (handoffSessionSlot === "lcr_validIdFront") {
              setIdFrontHandoffUrl(uploadedFile.url);
              toast.success("Front of ID uploaded successfully!");
            } else if (handoffSessionSlot === "lcr_validIdBack") {
              setIdBackHandoffUrl(uploadedFile.url);
              toast.success("Back of ID uploaded successfully!");
            }
            setIsHandoffOpen(false);
            setHandoffToken("");
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
  }, [handoffToken, handoffSessionSlot]);

  const startHandoff = async (docKey: string) => {
    const userId = residentData?.userId || residentData?.id;
    if (!userId || isCreatingHandoff) return;
    setIsCreatingHandoff(true);
    try {
      const slot = `lcr_${docKey}`;
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

  const getHandoffSlotLabel = () => {
    return handoffSessionSlot === "lcr_validIdFront" ? "Valid ID (Front)" : "Valid ID (Back)";
  };

  // Direct storage file upload
  async function uploadFileClientSideDirect(file: File, fieldName: string, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'bin';
    const res = await getSecureUploadUrlAction(fieldName, "lcr/marriage_certificate_request", fileExt, userId);
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

  // Next steps validations
  const validateIdentityStep = () => {
    const errs: Record<string, string> = {};
    if (!formData.relationship) errs.relationship = "Required";
    if (formData.relationship === "OTHER" && !formData.relationshipSpecify?.trim()) {
      errs.relationshipSpecify = "Required";
    }
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
    const isCustomCountryEmpty = placeCountry === "OTHER" && !customCountry.trim();
    const isCustomProvinceEmpty = placeProvince === "OTHER" && !customProvince.trim();
    const isCustomCityEmpty = placeCity === "OTHER" && !customCity.trim();

    const errs: Record<string, string> = {};
    if (!formData.certFirstName?.trim()) errs.certFirstName = "Required";
    if (!formData.certLastName?.trim()) errs.certLastName = "Required";
    if (!formData.spouseName?.trim()) errs.spouseName = "Required";
    if (!formData.dateOfEvent) errs.dateOfEvent = "Required";
    if (isCustomCountryEmpty) errs.customCountry = "Required";
    if (isCustomProvinceEmpty) errs.customProvince = "Required";
    if (isCustomCityEmpty) errs.customCity = "Required";

    const valid = Object.keys(errs).length === 0;
    setShowValidationErrors(!valid);

    if (!valid) {
      toast.warning("Please fill in all required marriage details.");
      const firstErrorKey = Object.keys(errs)[0];
      setTimeout(() => {
        const element = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus();
        }
      }, 100);
    } else {
      const isFutureDate = formData.dateOfEvent && new Date(formData.dateOfEvent) > new Date();
      if (isFutureDate) {
        toast.warning("Date of marriage cannot be in the future.");
        return false;
      }
    }
    return valid;
  };

  const handleNextFromIdentity = () => {
    if (validateIdentityStep()) {
      setShowValidationErrors(false);
      setCurrentStep("DETAILS");
      setMaxStepIdx(Math.max(maxStepIdx, 1));
    }
  };

  const handleNextFromDetails = () => {
    if (validateDetailsStep()) {
      setShowValidationErrors(false);
      const husbandFull = `${formData.certFirstName} ${formData.certMiddleName} ${formData.certLastName} ${formData.certSuffix}`.replace(/\s+/g, ' ').trim().toUpperCase();
      setFormData((prev: any) => ({ ...prev, husbandFullName: husbandFull }));
      setCurrentStep("UPLOAD");
      setMaxStepIdx(Math.max(maxStepIdx, 2));
    }
  };

  const handleNextFromUpload = () => {
    const idTypeSelected = formData.idType || residentData?.idType;
    if (!idTypeSelected) {
      toast.warning("Please select a Government ID type.");
      setShowValidationErrors(true);
      return;
    }

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
        return;
      }
    }
    setShowValidationErrors(false);
    setCurrentStep("SUBMIT");
    setMaxStepIdx(Math.max(maxStepIdx, 3));
  };

  const handleSubmitRequest = async () => {
    if (!privacyAccepted) {
      toast.warning("You must accept the Data Privacy Terms.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = residentData.userId || residentData.id;
      const data = new FormData();
      data.append("typeId", typeId);
      data.append("registryType", "MARRIAGE");
      if (revisionId) {
        data.append("revisionId", revisionId);
      }

      const residentSnapshot = {
        firstName: residentData.firstName || "",
        lastName: residentData.lastName || "",
        middleName: residentData.middleName || "",
        suffix: residentData.suffix || "",
        contactNumber: residentData.contactNumber || "",
        email: residentData.user?.email || residentData.email || "",
        civilStatus: residentData.civilStatus || "",
        gender: residentData.gender || "",
        barangay: residentData.barangay || "",
        municipality: residentData.municipality || "",
        province: residentData.province || "",
        address: formData.informantAddress
      };
      data.append("residentSnapshot", JSON.stringify(residentSnapshot));

      const fileUrls: Record<string, string> = {};

      if (idChoice === "PROFILE") {
        if (residentData.idFrontUrl) fileUrls["validIdFront"] = residentData.idFrontUrl;
        if (residentData.idBackUrl) fileUrls["validIdBack"] = residentData.idBackUrl;
      } else {
        // Front ID
        if (idFrontHandoffUrl) {
          fileUrls["validIdFront"] = idFrontHandoffUrl;
        } else if (formData.newIdFile) {
          toast.loading("Uploading valid ID front...", { id: "req-upload-toast" });
          const url = await uploadFileClientSideDirect(formData.newIdFile, "validIdFront", userId);
          fileUrls["validIdFront"] = url;
        }

        // Back ID
        if (idBackHandoffUrl) {
          fileUrls["validIdBack"] = idBackHandoffUrl;
        } else if (formData.newIdFileBack) {
          toast.loading("Uploading valid ID back...", { id: "req-upload-toast" });
          const url = await uploadFileClientSideDirect(formData.newIdFileBack, "validIdBack", userId);
          fileUrls["validIdBack"] = url;
        }
      }
      toast.dismiss("req-upload-toast");

      const relValue = formData.relationship === "OTHER" ? `OTHER: ${formData.relationshipSpecify}` : formData.relationship;

      const additionalData = {
        certFirstName: formData.certFirstName,
        certMiddleName: formData.certMiddleName,
        certLastName: formData.certLastName,
        certSuffix: formData.certSuffix,
        certHusbandFullName: formData.husbandFullName,
        subjectName: `${formData.husbandFullName} & ${formData.spouseName}`,
        spouseName: formData.spouseName,
        dateOfEvent: formData.dateOfEvent,
        placeOfEvent: formData.placeOfEvent,
        relationship: relValue,
        email: formData.email,
        contactNumber: formData.contactNumber,
        occupation: formData.occupation,
        informantAddress: formData.informantAddress,
        idType: formData.idType || residentData?.idType,
        validIdFront: fileUrls["validIdFront"],
        validIdBack: fileUrls["validIdBack"],
        totalAmount: dbBaseFee,
      };
      data.append("additionalData", JSON.stringify(additionalData));

      const result = await submitCivilRegistryTransaction(data, userId);
      if (result.success && result.data) {
        sessionStorage.removeItem("marriage-request-step");
        sessionStorage.removeItem("marriage-request-form");
        sessionStorage.removeItem("marriage-request-front-url");
        sessionStorage.removeItem("marriage-request-back-url");

        const updatedRequests = await getExistingMarriageCertificateRequests(userId);
        if (updatedRequests.success && updatedRequests.data) {
          setExistingRequests(updatedRequests.data);
          const currentTx = updatedRequests.data.find((tx: any) => tx.id === (result.data.id || revisionId));
          if (currentTx) {
            setSelectedApplication(currentTx);
          }
        }

        toast.success(revisionId ? "Revision resubmitted successfully!" : "Marriage Certificate request submitted successfully.");
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: "var(--primary-theme)" }} />
        <p className="font-black uppercase tracking-widest text-[10px] text-slate-700 dark:text-slate-400 italic">Syncing Registry Matrix...</p>
      </div>
    );
  }

  return (
    <div ref={pageScrollRef} className="h-full overflow-y-auto px-4 py-8 md:px-12 md:py-12 bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white">
      <style dangerouslySetInnerHTML={{
        __html: `
        /* Ensure all inputs, select, and textarea text is dark in light mode, light in dark mode */
        input:not([type="button"]):not([type="submit"]), select, textarea {
            color: #0f172a !important;
        }
        input:not([type="button"]):not([type="submit"]):disabled, select:disabled, textarea:disabled,
        input:not([type="button"]):not([type="submit"])[readonly], select[readonly], textarea[readonly] {
            color: #1e293b !important;
            -webkit-text-fill-color: #1e293b !important;
            opacity: 0.9 !important;
        }
        .dark input:not([type="button"]):not([type="submit"]), .dark select, .dark textarea {
            color: #f8fafc !important;
        }
        .dark input:not([type="button"]):not([type="submit"]):disabled, .dark select:disabled, .dark textarea:disabled,
        .dark input:not([type="button"]):not([type="submit"])[readonly], .dark select[readonly], .dark textarea[readonly] {
            color: #cbd5e1 !important;
            -webkit-text-fill-color: #cbd5e1 !important;
            opacity: 0.8 !important;
        }

        /* High contrast text color rules for light mode */
        html:not(.dark) .text-slate-400,
        html:not(.dark) .text-slate-500 {
            color: #475569 !important;
        }
        html:not(.dark) .text-slate-300,
        html:not(.dark) .text-slate-200 {
            color: #1e293b !important;
        }
        html:not(.dark) .text-slate-600 {
            color: #0f172a !important;
        }
        html:not(.dark) .text-slate-800 {
            color: #0f172a !important;
        }

        /* Dark mode fallback values */
        .dark .text-slate-400 {
            color: #94a3b8 !important;
        }
        .dark .text-slate-500 {
            color: #cbd5e1 !important;
        }
        `
      }} />
      <PrivacyTermsModal
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        onAccept={handleAcceptPrivacy}
        onDecline={() => setPrivacyAccepted(false)}
        themeColor="var(--primary-theme)"
      />
      <DocumentViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={null}
        fileUrl={viewerUrl}
        title={viewerTitle}
        themeColor="var(--primary-theme)"
      />
      <SecureQrUploadModal
        isOpen={isHandoffOpen}
        onClose={() => {
          setIsHandoffOpen(false);
          setHandoffToken("");
        }}
        qrCode={handoffQrCode}
        expiresAt={handoffExpiresAt}
        slotLabel={getHandoffSlotLabel()}
      />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <Home className="h-3.5 w-3.5" /> Dashboard
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/modules/civil-registry" className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                  Civil Registry
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-black uppercase tracking-widest text-theme-primary">
                Marriage Certificate Request
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
              MARRIAGE <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">REQUEST</span>
            </h1>
            <p className="text-[9px] md:text-[11px] font-bold text-slate-800 dark:text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">LCR Civil Registry Request Portal</p>
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
              New Request
            </Button>
          )}
        </div>
      </div>

      {/* Progress Stepper */}
      {currentStep !== "EXISTING" && currentStep !== "SUBMIT" && (
        <div className="mx-auto max-w-7xl mb-10">
          <div className="grid grid-cols-4 max-w-2xl mx-auto gap-1 md:gap-4 relative px-1 md:px-2">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isCompleted = idx <= maxStepIdx;
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isCompleted) {
                      setCurrentStep(step.id as Step);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 md:gap-3 relative z-10 font-black cursor-pointer group",
                    !isCompleted && "cursor-not-allowed opacity-65"
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

      {/* Main Content Wrapper */}
      <div className="mx-auto max-w-7xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-12 shadow-2xl relative min-h-[500px] flex flex-col text-slate-900 dark:text-white">
        
        {/* Step: EXISTING */}
        {currentStep === "EXISTING" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                Existing <span className="text-theme-primary">Requests</span>
              </h2>
              <p className="text-slate-800 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                We found previous requests for certified marriage certificates under your profile.
              </p>
            </div>
            <div className="flex-1">
              <RequestList
                requests={existingRequests}
                onItemClick={(app: any) => {
                  setSelectedApplication(app);
                  setCurrentStep("SUBMIT");
                }}
                emptyMessage="No records found"
                emptySubMessage="Submit your first request by clicking New Request."
                getSubjectName={(app: any) => {
                  const addData = app.additionalData as any || {};
                  return addData.subjectName || "Marriage Certificate Copy";
                }}
              />
            </div>
            <div className="flex pt-8 mt-auto border-t border-slate-200 dark:border-white/10">
              <Button
                type="button"
                onClick={() => router.push("/modules/civil-registry")}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 transition-all"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back to Hub
              </Button>
            </div>
          </div>
        )}

        {/* Step: IDENTITY */}
        {currentStep === "IDENTITY" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
            {revisionTx && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-800 dark:text-red-400 animate-in fade-in duration-300">
                <AlertCircle className="w-5 h-5 shrink-0 animate-pulse mt-0.5" />
                <div className="text-left space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider italic">Attention: Revision Needed</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-300 leading-relaxed italic">
                    &ldquo;{revisionTx.rejectionRemarks || "Please check the highlighted checklist files or values and submit them again."}&rdquo;
                  </p>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-visible">
              <InformantInfo
                firstName={residentData?.firstName}
                middleName={residentData?.middleName}
                lastName={residentData?.lastName}
                suffix={residentData?.suffix}
                birthDate={residentData?.dateOfBirth}
                age={residentData?.age != null ? String(residentData.age) : ""}
                civilStatus={residentData?.civilStatus}
                citizenship={residentData?.citizenship}
                
                relationship={formData.relationship}
                relationshipSpecify={formData.relationshipSpecify}
                occupation={formData.occupation}
                contactNumber={formData.contactNumber}
                email={formData.email}
                
                onRelationshipChange={(val) => handleFormChange("relationship", val)}
                onRelationshipSpecifyChange={(val) => handleFormChange("relationshipSpecify", val)}
                onOccupationChange={(val) => handleFormChange("occupation", val)}
                onContactNumberChange={(val) => handleFormChange("contactNumber", val)}
                onEmailChange={(val) => handleFormChange("email", val)}
                relationshipOptions={RELATION_OPTIONS}
                
                showErrors={showValidationErrors}
                isCardWrapped={true}
                cardTitle="Requester Information"
                cardSubtitle="Please verify the requester/informant details below."
              />
            </div>

            <div className="flex justify-between items-center pt-8 mt-auto border-t border-slate-200 dark:border-white/10">
              <Button
                type="button"
                onClick={() => {
                  if (existingRequests.length > 0) {
                    setCurrentStep("EXISTING");
                  } else {
                    router.push("/modules/civil-registry");
                  }
                }}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNextFromIdentity}
                className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40"
              >
                Proceed to Marriage Details <ChevronRight className="inline-block mr-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: DETAILS */}
        {currentStep === "DETAILS" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Marriage Details</h2>
              <p className="text-xs text-slate-800 dark:text-slate-400 font-medium italic">Please enter the official registry details of the marriage record.</p>
            </div>

            <Card className="bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] space-y-6">
              {/* Husband Details */}
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Husband&apos;s Name <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-700 dark:text-slate-400 italic">First Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="certFirstName"
                      className={cn(
                        "rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all",
                        showValidationErrors && !formData.certFirstName && "border-red-500"
                      )}
                      placeholder="First Name"
                      value={formData.certFirstName}
                      onChange={(e) => handleFormChange("certFirstName", e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-700 dark:text-slate-400 italic">Middle Name</Label>
                    <Input
                      className="rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all"
                      placeholder="Middle Name"
                      value={formData.certMiddleName}
                      onChange={(e) => handleFormChange("certMiddleName", e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-700 dark:text-slate-400 italic">Last Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="certLastName"
                      className={cn(
                        "rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all",
                        showValidationErrors && !formData.certLastName && "border-red-500"
                      )}
                      placeholder="Last Name"
                      value={formData.certLastName}
                      onChange={(e) => handleFormChange("certLastName", e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              </div>

              {/* Suffix */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-slate-700 dark:text-slate-400 italic">Suffix</Label>
                  <Input
                    className="rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all"
                    placeholder="E.g., JR, SR, III"
                    value={formData.certSuffix}
                    onChange={(e) => handleFormChange("certSuffix", e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              {/* Wife Details */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Wife&apos;s Maiden Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="spouseName"
                  className={cn(
                    "rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all",
                    showValidationErrors && !formData.spouseName && "border-red-500"
                  )}
                  placeholder="Complete Maiden Name (First, Middle, Last)"
                  value={formData.spouseName}
                  onChange={(e) => handleFormChange("spouseName", e.target.value.toUpperCase())}
                />
              </div>

              <Separator className="border-slate-200 dark:border-white/10" />

              {/* Event Specifics */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Date of Marriage <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  className={cn(
                    "rounded-xl h-10 text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all",
                    showValidationErrors && !formData.dateOfEvent && "border-red-500"
                  )}
                  value={formData.dateOfEvent}
                  onChange={(e) => handleFormChange("dateOfEvent", e.target.value)}
                />
              </div>

              {/* Place of Marriage */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Country <span className="text-red-500">*</span></Label>
                  <Select value={placeCountry} onValueChange={(val) => {
                    setPlaceCountry(val);
                    if (val !== "PHILIPPINES") {
                      setPlaceProvince("OTHER");
                      setPlaceCity("OTHER");
                    } else {
                      setPlaceProvince("");
                      setPlaceCity("");
                    }
                  }}>
                    <SelectTrigger className="h-10 rounded-xl border border-slate-200 dark:border-white/10 focus:ring-rose-500 shadow-sm text-xs bg-white dark:bg-slate-900 font-bold text-slate-950 dark:text-white">
                      <div className="flex items-center gap-1.5 truncate">
                        {countriesLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-slate-400" />}
                        <SelectValue placeholder="Select Country" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px] overflow-y-auto">
                      <SelectItem value="PHILIPPINES">PHILIPPINES</SelectItem>
                      {countriesList.filter(c => c.name !== "PHILIPPINES").map((country) => (
                        <SelectItem key={country.code} value={country.name}>{country.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {placeCountry === "PHILIPPINES" && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Province <span className="text-red-500">*</span></Label>
                    <Select value={placeProvince} onValueChange={(val) => {
                      setPlaceProvince(val);
                      setPlaceCity("");
                    }}>
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 dark:border-white/10 focus:ring-rose-500 shadow-sm text-xs bg-white dark:bg-slate-900 font-bold text-slate-950 dark:text-white">
                        <div className="flex items-center gap-1.5 truncate">
                          {provincesLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-slate-400" />}
                          <SelectValue placeholder="Select Province" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-[250px] overflow-y-auto">
                        {provincesList.length > 0 ? (
                          <>
                            {provincesList.map((p) => (
                              <SelectItem key={p.code} value={p.name.toUpperCase()}>{p.name.toUpperCase()}</SelectItem>
                            ))}
                            <SelectItem value="OTHER">OTHER PROVINCE...</SelectItem>
                          </>
                        ) : (
                          <>
                            {LOCAL_FALLBACK_PROVINCES.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                            <SelectItem value="OTHER">OTHER PROVINCE...</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {placeCountry === "PHILIPPINES" && placeProvince !== "OTHER" && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">City / Municipality <span className="text-red-500">*</span></Label>
                    <Select value={placeCity} onValueChange={setPlaceCity}>
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 dark:border-white/10 focus:ring-rose-500 shadow-sm text-xs bg-white dark:bg-slate-900 font-bold text-slate-950 dark:text-white">
                        <div className="flex items-center gap-1.5 truncate">
                          {citiesLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-slate-400" />}
                          <SelectValue placeholder="Select City/Municipality" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-[250px] overflow-y-auto">
                        {citiesList.length > 0 ? (
                          <>
                            {citiesList.map((c) => (
                              <SelectItem key={c.code} value={c.name.toUpperCase()}>{c.name.toUpperCase()}</SelectItem>
                            ))}
                            <SelectItem value="OTHER">OTHER CITY/MUNICIPALITY...</SelectItem>
                          </>
                        ) : (
                          placeProvince.toUpperCase() === "PANGASINAN" ? (
                            <>
                              {LOCAL_FALLBACK_CITIES.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                              <SelectItem value="OTHER">OTHER CITY/MUNICIPALITY...</SelectItem>
                            </>
                          ) : (
                            <SelectItem value="OTHER">OTHER CITY/MUNICIPALITY...</SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {placeCountry === "OTHER" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Specify Country <span className="text-red-500">*</span></Label>
                    <Input
                      id="customCountry"
                      className={cn("rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all", showValidationErrors && !customCountry.trim() && "border-red-500")}
                      placeholder="e.g. UNITED STATES"
                      value={customCountry}
                      onChange={(e) => setCustomCountry(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Specify State / Province <span className="text-red-500">*</span></Label>
                    <Input
                      id="customProvince"
                      className={cn("rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all", showValidationErrors && !customProvince.trim() && "border-red-500")}
                      placeholder="e.g. CALIFORNIA"
                      value={customProvince}
                      onChange={(e) => setCustomProvince(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Specify City / Town <span className="text-red-500">*</span></Label>
                    <Input
                      id="customCity"
                      className={cn("rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all", showValidationErrors && !customCity.trim() && "border-red-500")}
                      placeholder="e.g. LOS ANGELES"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              )}

              {placeCountry === "PHILIPPINES" && placeProvince === "OTHER" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Specify Province <span className="text-red-500">*</span></Label>
                    <Input
                      id="customProvince"
                      className={cn("rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all", showValidationErrors && !customProvince.trim() && "border-red-500")}
                      placeholder="e.g. CEBU"
                      value={customProvince}
                      onChange={(e) => setCustomProvince(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Specify City / Municipality <span className="text-red-500">*</span></Label>
                    <Input
                      id="customCity"
                      className={cn("rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all", showValidationErrors && !customCity.trim() && "border-red-500")}
                      placeholder="e.g. CEBU CITY"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              )}

              {placeCountry === "PHILIPPINES" && placeProvince !== "OTHER" && placeCity === "OTHER" && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Specify City / Municipality <span className="text-red-500">*</span></Label>
                  <Input
                    id="customCity"
                    className={cn("rounded-xl h-10 uppercase font-bold text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 transition-all", showValidationErrors && !customCity.trim() && "border-red-500")}
                    placeholder="e.g. SAN JACINTO"
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value.toUpperCase())}
                  />
                </div>
              )}
            </Card>

            <div className="flex justify-between items-center pt-8 mt-auto border-t border-slate-200 dark:border-white/10">
              <Button
                type="button"
                onClick={() => setCurrentStep("IDENTITY")}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNextFromDetails}
                className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40"
              >
                Proceed to ID Verification <ChevronRight className="inline-block mr-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: UPLOAD */}
        {currentStep === "UPLOAD" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
            <RequiredDocuments
              title="Identity Verification"
              subtitle="Please upload or choose a valid government ID to verify your marriage copy request"
              idChoice={idChoice}
              onIdChoiceChange={setIdChoice}
              residentData={residentData}
              hasProfileId={!!(residentData?.idFrontUrl && residentData?.idBackUrl)}
              onViewProfileId={(side) => handleOpenViewer(null, `Profile ID - ${side === 'front' ? 'Front' : 'Back'}`, side === 'front' ? residentData.idFrontUrl : residentData.idBackUrl)}
              documents={[
                {
                  key: "validIdFront",
                  label: "Valid ID (Front Side)",
                  file: formData.newIdFile,
                  previewUrl: idFrontHandoffUrl || (formData.newIdFile ? URL.createObjectURL(formData.newIdFile) : null),
                  error: showValidationErrors && !formData.newIdFile && !idFrontHandoffUrl,
                  onFileSelect: (f) => handleFormChange("newIdFile", f),
                  onClickUpload: () => startHandoff("validIdFront"),
                  onClear: () => {
                    handleFormChange("newIdFile", null);
                    setIdFrontHandoffUrl(null);
                  },
                  onView: () => handleOpenViewer(formData.newIdFile, "Valid ID Front", idFrontHandoffUrl)
                },
                {
                  key: "validIdBack",
                  label: "Valid ID (Back Side)",
                  file: formData.newIdFileBack,
                  previewUrl: idBackHandoffUrl || (formData.newIdFileBack ? URL.createObjectURL(formData.newIdFileBack) : null),
                  error: showValidationErrors && !formData.newIdFileBack && !idBackHandoffUrl,
                  onFileSelect: (f) => handleFormChange("newIdFileBack", f),
                  onClickUpload: () => startHandoff("validIdBack"),
                  onClear: () => {
                    handleFormChange("newIdFileBack", null);
                    setIdBackHandoffUrl(null);
                  },
                  onView: () => handleOpenViewer(formData.newIdFileBack, "Valid ID Back", idBackHandoffUrl)
                }
              ]}
            >
              <div className="space-y-2 max-w-md pt-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400 ml-1">Government ID Type <span className="text-red-500">*</span></Label>
                 <Select
                  value={formData.idType || residentData?.idType || ""}
                  onValueChange={(val) => handleFormChange("idType", val)}
                  disabled={idChoice === "PROFILE"}
                >
                  <SelectTrigger className={cn("h-10 rounded-xl border border-slate-200 dark:border-white/10 focus:ring-rose-500 shadow-sm text-xs bg-white dark:bg-slate-900 font-bold uppercase text-slate-950 dark:text-white", showValidationErrors && !formData.idType && !residentData?.idType && "border-red-500")}>
                    <SelectValue placeholder="SELECT ID TYPE" />
                  </SelectTrigger>
                  <SelectContent className="font-bold uppercase text-slate-900">
                    <SelectItem value="UMID">Unified Multi-Purpose ID (UMID)</SelectItem>
                    <SelectItem value="DRIVERS_LICENSE">Driver's License</SelectItem>
                    <SelectItem value="PASSPORT">Passport</SelectItem>
                    <SelectItem value="POSTAL_ID">Postal ID</SelectItem>
                    <SelectItem value="VOTERS_ID">Voter's ID</SelectItem>
                    <SelectItem value="PRC_ID">PRC ID</SelectItem>
                    <SelectItem value="NATIONAL_ID">National ID (PhilSys)</SelectItem>
                    <SelectItem value="SENIOR_CITIZEN">Senior Citizen ID</SelectItem>
                    <SelectItem value="PWD_ID">PWD ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </RequiredDocuments>

            <div className="flex justify-between items-center pt-8 mt-auto border-t border-slate-200 dark:border-white/10">
              <Button
                type="button"
                onClick={() => setCurrentStep("DETAILS")}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300"
              >
                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNextFromUpload}
                className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40"
              >
                Proceed to Review & Submit <ChevronRight className="inline-block mr-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: REVIEW (SUBMIT) */}
        {currentStep === "SUBMIT" && !selectedApplication && (
          <ReviewAndSubmit
            title="Review Request Details"
            subtitle="Please review all information below before submitting your marriage certificate copy request"
            policyAccepted={privacyAccepted}
            onPolicyAcceptedChange={setPrivacyAccepted}
            onReviewPolicy={() => setPrivacyOpen(true)}
            showErrors={showValidationErrors}
            submitting={isSubmitting}
            submitLabel="Submit Marriage Certificate Request"
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
                    <span className="text-slate-700 dark:text-slate-350 uppercase">Marriage Certificate Copy</span>
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
            detailsCards={
              <Card className="bg-slate-50 dark:bg-white/5 border-none p-6 rounded-[2rem] space-y-6 text-slate-900 dark:text-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#071018] relative pt-8">
                    <span className="absolute top-2 left-4 text-[9px] font-black uppercase tracking-widest text-theme-primary italic">Requester Details</span>
                    <div className="text-sm font-black">{residentData?.firstName} {residentData?.lastName}</div>
                    <div className="text-xs text-slate-800 dark:text-slate-300">Relationship: {formData.relationship}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Contact: {formData.contactNumber}</div>
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#071018] relative pt-8">
                    <span className="absolute top-2 left-4 text-[9px] font-black uppercase tracking-widest text-theme-primary italic">Marriage Details</span>
                    <div className="text-sm font-black">{formData.husbandFullName}</div>
                    <div className="text-xs text-slate-800 dark:text-slate-300">Spouse Maiden Name: {formData.spouseName}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Date: {formData.dateOfEvent}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Place: {formData.placeOfEvent}</div>
                  </div>
                </div>

              </Card>
            }
            documentsSection={
              <div className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white">
                    <Upload size={18} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Verification ID Documents</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {idChoice === "PROFILE" ? (
                    <>
                      <ReadOnlyDocumentPreview
                        file={null}
                        label="Valid ID (Front)"
                        fileName="Profile ID Front"
                        previewUrl={residentData?.idFrontUrl}
                        onView={() => handleOpenViewer(null, "Profile ID Front", residentData?.idFrontUrl)}
                      />
                      <ReadOnlyDocumentPreview
                        file={null}
                        label="Valid ID (Back)"
                        fileName="Profile ID Back"
                        previewUrl={residentData?.idBackUrl}
                        onView={() => handleOpenViewer(null, "Profile ID Back", residentData?.idBackUrl)}
                      />
                    </>
                  ) : (
                    <>
                      <ReadOnlyDocumentPreview
                        file={formData.newIdFile}
                        label="Uploaded ID (Front)"
                        fileName={formData.newIdFile ? formData.newIdFile.name : "Mobile Uploaded"}
                        previewUrl={idFrontHandoffUrl || (formData.newIdFile ? URL.createObjectURL(formData.newIdFile) : null)}
                        onView={() => handleOpenViewer(formData.newIdFile, "Uploaded ID Front", idFrontHandoffUrl)}
                      />
                      <ReadOnlyDocumentPreview
                        file={formData.newIdFileBack}
                        label="Uploaded ID (Back)"
                        fileName={formData.newIdFileBack ? formData.newIdFileBack.name : "Mobile Uploaded"}
                        previewUrl={idBackHandoffUrl || (formData.newIdFileBack ? URL.createObjectURL(formData.newIdFileBack) : null)}
                        onView={() => handleOpenViewer(formData.newIdFileBack, "Uploaded ID Back", idBackHandoffUrl)}
                      />
                    </>
                  )}
                </div>
              </div>
            }
          />
        )}

        {/* Step: SUBMIT (Receipt display) */}
        {currentStep === "SUBMIT" && selectedApplication && (() => {
          const addData = selectedApplication.additionalData as any || {};
          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-theme-primary" />
                </div>
                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                  Request <span className="text-theme-primary">Summary</span>
                </h2>
                <p className="text-slate-800 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                  Review details and status of your certified marriage record request.
                </p>
              </div>

              <div className="max-w-2xl mx-auto w-full bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden text-slate-900 dark:text-white backdrop-blur-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <Heart size={160} />
                </div>

                <div className="flex justify-between items-start gap-4 flex-wrap border-b border-slate-200 dark:border-white/10 pb-6">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">MUNICIPAL CIVIL REGISTRY</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-theme-primary">Local Civil Registry Office</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest border",
                      selectedApplication.isCancelled ? "bg-red-500/20 text-red-400 border-red-500/30" :
                        selectedApplication.status === "RELEASED" ? "bg-theme-primary/20 text-theme-primary border-theme-primary/30" :
                          selectedApplication.status === "FOR_REVISION" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                            "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    )}>
                      {selectedApplication.isCancelled ? "CANCELLED" : selectedApplication.status}
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6 text-sm font-semibold">
                  <div className="space-y-4">
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Transaction ID</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{selectedApplication.id}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Husband Name</span>
                      <span className="uppercase font-black text-slate-900 dark:text-white">{addData.certHusbandFullName}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Wife Maiden Name</span>
                      <span className="uppercase font-black text-slate-900 dark:text-white">{addData.spouseName}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Request Date</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {new Date(selectedApplication.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Date of Marriage</span>
                      <span className="uppercase font-bold text-slate-900 dark:text-white">{addData.dateOfEvent}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-400">Place of Marriage</span>
                      <span className="uppercase font-bold text-slate-900 dark:text-white">{addData.placeOfEvent}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                  <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                    <span className="text-slate-800 dark:text-slate-400">Assessed Request Fee</span>
                    <span className="text-theme-primary text-sm font-black">₱{(selectedApplication.totalAmount || dbBaseFee).toFixed(2)}</span>
                  </div>
                </div>

                {selectedApplication.isCancelled ? (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-xs text-red-600 dark:text-red-400 font-semibold leading-relaxed">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>This request has been cancelled and will not be processed further.</span>
                  </div>
                ) : selectedApplication.status === "FOR_REVISION" ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-xs text-amber-600 dark:text-amber-300 font-semibold leading-relaxed">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>This request requires revision. Please click the button below to resume editing.</span>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex gap-3 text-xs text-theme-primary font-semibold leading-relaxed">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Your Marriage Certificate copy request has been logged. Our LCR officers will verify the record and prepare your copy within 1-2 business days.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4 pt-8">
                <Button
                  type="button"
                  onClick={() => setCurrentStep("EXISTING")}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300"
                >
                  Back to List
                </Button>
                <Button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
                >
                  <Printer size={16} /> Print Details
                </Button>
                {selectedApplication.status === "FOR_REVISION" && !selectedApplication.isCancelled && (
                  <Button
                    type="button"
                    onClick={() => {
                      window.location.href = `/modules/civil-registry/marriage-certificate-request?revisionId=${selectedApplication.id}`;
                    }}
                    className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg"
                  >
                    Revise Details
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
