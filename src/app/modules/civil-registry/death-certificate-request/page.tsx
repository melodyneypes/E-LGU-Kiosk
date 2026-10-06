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
    CheckCircle2,
    Upload,
    Printer,
    ChevronRight,
    ChevronLeft,
    Search,
    Home,
    Skull
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
    submitDeathCertificateRequest,
    getExistingDeathCertificateRequests,
    getSecureUploadUrlAction,
    getBarangaysList,
    searchResidentsAction,
    ensureCivilRegistryTransactionTypes,
    getTransactionTypes
} from "./actions";
import RequestList from "../_components/request-list";
import InformantInfo from "../_components/informant-info";
import ReviewAndSubmit from "../_components/review-and-submit";
import RequiredDocuments from "../_components/required-documents";
import ReadOnlyDocumentPreview from "../_components/read-only-document-preview";

type Step = "EXISTING" | "IDENTITY" | "DETAILS" | "UPLOAD" | "SUBMIT";

const STEPS = [
    { id: "IDENTITY", label: "Identity", icon: User },
    { id: "DETAILS", label: "Deceased", icon: Skull },
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

// --- UPLOAD FILE SECURELY VIA SIGNED UPLOAD URL ---
async function uploadFileClientSide(file: File, fieldName: string, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'bin';

    const res = await getSecureUploadUrlAction(fieldName, "lcr/death_certificate_request", fileExt, userId);
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

const formatDateOfEvent = (dateStr: string) => {
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

// --- Resident Search Component ---
const ResidentSearch = ({ onSelect, placeholder = "Search resident...", currentResidentId }: { onSelect: (r: any) => void; placeholder?: string; currentResidentId?: string }) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);

    useEffect(() => {
        if (query.length <= 2) {
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            const res = await searchResidentsAction(query);
            if (res.success && res.data) {
                // Filter out the current user resident (cannot search oneself for death requests)
                const filtered = (res.data as any[]).filter(r => r.id !== currentResidentId);
                setResults(filtered);
            } else {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [query, currentResidentId]);

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => {
                        const val = e.target.value;
                        setQuery(val);
                        if (val.length <= 2) {
                            setResults([]);
                        }
                    }}
                    className="pl-12 h-12 bg-slate-50 dark:bg-white/5 border-none font-bold text-slate-900 dark:text-white"
                />
            </div>

            {results.length > 0 && (
                <div className="absolute z-[110] w-full mt-2 bg-white dark:bg-[#151b2b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2 space-y-1">
                    {results.map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                                onSelect(r);
                                setQuery("");
                                setResults([]);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-500/10 dark:hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase italic text-slate-900 dark:text-white">{r.firstName} {r.lastName}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{r.barangay}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function DeathCertificatePage() {
    const router = useRouter();
    const pageScrollRef = useRef<HTMLDivElement>(null);
    const [currentStep, setCurrentStep] = useState<Step>("EXISTING");
    const [existingRequests, setExistingRequests] = useState<any[]>([]);
    const [selectedApplication, setSelectedApplication] = useState<any>(null);
    const [residentData, setResidentData] = useState<any>(null);
    const [barangaysList, setBarangaysList] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingId, setIsUploadingId] = useState(false);
    const [dbBaseFee, setDbBaseFee] = useState<number>(100);

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
        firstName: "",
        middleName: "",
        lastName: "",
        suffix: "",
        relationship: "",
        relationshipSpecify: "",
        contactNumber: "",
        email: "",
        occupation: "",

        // Deceased Details
        deceasedFirstName: "",
        deceasedMiddleName: "",
        deceasedLastName: "",
        deceasedSuffix: "",
        dateOfDeath: "",
        placeOfDeath: "",
        causeOfDeath: "",

        // Parents Details
        fatherFirstName: "",
        fatherMiddleName: "",
        fatherLastName: "",
        motherFirstName: "",
        motherMiddleName: "",
        motherLastName: "",

        idType: "",
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

    const startHandoff = async (slot: string = "death_id") => {
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
            death_id: "Front & Back ID Photos",
            idFront: "Valid ID (Front Side)",
            idBack: "Valid ID (Back Side)",
        };
        return map[handoffSessionSlot] || "Document";
    };

    const getNormalizedPlaceOfDeath = (val: string) => {
        if (!val) return "";
        const upperVal = val.toUpperCase();
        const found = barangaysList.find(b => upperVal.includes(b.toUpperCase()));
        if (found) {
            return found.toUpperCase();
        }
        return val;
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

                await ensureCivilRegistryTransactionTypes();

                const [res, requestsRes, brgyRes, typesResult] = await Promise.all([
                    getCurrentUserResident(userId),
                    getExistingDeathCertificateRequests(userId),
                    getBarangaysList(),
                    getTransactionTypes()
                ]);

                if (typesResult.success && typesResult.data) {
                    const deathType = typesResult.data.find((t: any) => t.code === "LCR_DEATH");
                    if (deathType) {
                        setDbBaseFee(Number(deathType.baseFee ?? 100));
                    }
                }

                if (brgyRes.success && brgyRes.data) {
                    setBarangaysList(brgyRes.data);
                }

                if (res.success && res.data) {
                    const data = res.data;
                    setResidentData(data);

                    setFormData(prev => ({
                        ...prev,
                        firstName: data.firstName || "",
                        middleName: data.middleName || "",
                        lastName: data.lastName || "",
                        suffix: data.suffix || "",
                        contactNumber: data.contactNumber || "",
                        email: data.email || "",
                        occupation: data.occupation || "",
                    }));
                }

                const savedStep = sessionStorage.getItem("death-cert-step");
                const savedForm = sessionStorage.getItem("death-cert-form");
                const savedFrontUrl = sessionStorage.getItem("death-cert-front-url");
                const savedBackUrl = sessionStorage.getItem("death-cert-back-url");
                const savedFrontName = sessionStorage.getItem("death-cert-front-name");
                const savedBackName = sessionStorage.getItem("death-cert-back-name");

                if (savedForm) {
                    try {
                        const parsed = JSON.parse(savedForm);
                        setFormData(prev => ({ ...prev, ...parsed }));
                    } catch (e) {
                        console.error("Failed to parse saved form", e);
                    }
                }
                if (savedFrontUrl) setIdFrontHandoffUrl(savedFrontUrl);
                if (savedBackUrl) setIdBackHandoffUrl(savedBackUrl);
                if (savedFrontName) setIdFrontHandoffFileName(savedFrontName);
                if (savedBackName) setIdBackHandoffFileName(savedBackName);

                if (requestsRes.success && requestsRes.data && requestsRes.data.length > 0) {
                    setExistingRequests(requestsRes.data);
                    const returnedApplication = returnedTransactionId
                        ? requestsRes.data.find((app: any) => app.id === returnedTransactionId)
                        : null;
                    if (returnedApplication) {
                        setSelectedApplication(returnedApplication);
                        setCurrentStep("SUBMIT");
                        return;
                    }
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
        if (!loading && !selectedApplication) {
            sessionStorage.setItem("death-cert-step", currentStep);
            const formCopy: any = { ...formData };
            delete formCopy.newIdFile;
            delete formCopy.newIdFileBack;
            sessionStorage.setItem("death-cert-form", JSON.stringify(formCopy));

            if (idFrontHandoffUrl) {
                sessionStorage.setItem("death-cert-front-url", idFrontHandoffUrl);
            } else {
                sessionStorage.removeItem("death-cert-front-url");
            }
            if (idBackHandoffUrl) {
                sessionStorage.setItem("death-cert-back-url", idBackHandoffUrl);
            } else {
                sessionStorage.removeItem("death-cert-back-url");
            }
            if (idFrontHandoffFileName) {
                sessionStorage.setItem("death-cert-front-name", idFrontHandoffFileName);
            } else {
                sessionStorage.removeItem("death-cert-front-name");
            }
            if (idBackHandoffFileName) {
                sessionStorage.setItem("death-cert-back-name", idBackHandoffFileName);
            } else {
                sessionStorage.removeItem("death-cert-back-name");
            }
        }
    }, [currentStep, formData, idFrontHandoffUrl, idBackHandoffUrl, idFrontHandoffFileName, idBackHandoffFileName, loading, selectedApplication]);

    const handleFormChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

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
        const errs: Record<string, string> = {};
        if (!formData.deceasedFirstName?.trim()) errs.deceasedFirstName = "Required";
        if (!formData.deceasedLastName?.trim()) errs.deceasedLastName = "Required";
        if (!formData.fatherFirstName?.trim()) errs.fatherFirstName = "Required";
        if (!formData.fatherLastName?.trim()) errs.fatherLastName = "Required";
        if (!formData.motherFirstName?.trim()) errs.motherFirstName = "Required";
        if (!formData.motherLastName?.trim()) errs.motherLastName = "Required";

        const valid = Object.keys(errs).length === 0;
        setShowValidationErrors(!valid);

        if (!valid) {
            toast.warning("Please fill in all required fields (Deceased and Parents names).");
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
            setCurrentStep("UPLOAD");
        }
    };

    const handleNextFromUpload = () => {
        if (!formData.dateOfDeath || !formData.placeOfDeath) {
            toast.warning("Please enter the Date of Death and Place of Death.");
            setShowValidationErrors(true);
            return;
        }

        const isFutureDate = formData.dateOfDeath && new Date(formData.dateOfDeath) > new Date();
        if (isFutureDate) {
            toast.warning("Date of death cannot be in the future.");
            return;
        }

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
            data.append("deceasedFirstName", formData.deceasedFirstName);
            data.append("deceasedMiddleName", formData.deceasedMiddleName);
            data.append("deceasedLastName", formData.deceasedLastName);
            data.append("deceasedSuffix", formData.deceasedSuffix);
            data.append("dateOfDeath", formData.dateOfDeath);
            data.append("placeOfDeath", formData.placeOfDeath);
            data.append("causeOfDeath", formData.causeOfDeath);

            data.append("fatherFirstName", formData.fatherFirstName);
            data.append("fatherMiddleName", formData.fatherMiddleName);
            data.append("fatherLastName", formData.fatherLastName);
            data.append("motherFirstName", formData.motherFirstName);
            data.append("motherMiddleName", formData.motherMiddleName);
            data.append("motherLastName", formData.motherLastName);

            const relValue = formData.relationship === "OTHER" ? `OTHER: ${formData.relationshipSpecify}` : formData.relationship;
            data.append("relation", relValue);
            data.append("contactNumber", formData.contactNumber);
            data.append("email", formData.email);
            data.append("occupation", formData.occupation);
            data.append("privacyConsentAccepted", String(privacyAccepted));

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

            const result = await submitDeathCertificateRequest(data, userId);
            if (result.success && result.transactionId) {
                // Clear drafts
                sessionStorage.removeItem("death-cert-step");
                sessionStorage.removeItem("death-cert-form");
                sessionStorage.removeItem("death-cert-front-url");
                sessionStorage.removeItem("death-cert-back-url");
                sessionStorage.removeItem("death-cert-front-name");
                sessionStorage.removeItem("death-cert-back-name");

                const updatedRequests = await getExistingDeathCertificateRequests(userId);
                if (updatedRequests.success && updatedRequests.data) {
                    setExistingRequests(updatedRequests.data);
                    const currentTx = updatedRequests.data.find((tx: any) => tx.id === result.transactionId);
                    if (currentTx) {
                        setSelectedApplication(currentTx);
                    }
                }

                toast.success("Death Certificate request submitted successfully.");
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
                                Death Certificate Request
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            {/* Title Header */}
            <div className="mx-auto max-w-7xl mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 px-1 md:px-0">
                    <div className="space-y-1 md:space-y-2">
                        <div className="flex items-center gap-2">
                            <Skull className="w-8 h-8 text-slate-950 dark:text-white" />
                            <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none select-none">
                                DEATH <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">CERTIFICATE</span>
                            </h1>
                        </div>
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
                    <div className="grid grid-cols-4 max-w-2xl mx-auto gap-1 md:gap-4 relative px-1 md:px-2">
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

            {/* Main Content Wrapper */}
            <div className="mx-auto max-w-7xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-12 shadow-2xl relative min-h-[500px] flex flex-col text-slate-900 dark:text-white">

                {/* Step: EXISTING */}
                {currentStep === "EXISTING" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                Existing <span className="text-theme-primary">Requests</span>
                            </h2>
                            <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                We found previous requests for certified death certificates under your profile.
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
                                emptySubMessage="Submit your first certified copy request by clicking New Request."
                                getSubjectName={(app: any) => app.deathCertificateRequest?.subjectName || "Death Certificate Copy"}
                            />
                        </div>
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
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
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
                                cardSubtitle="Please verify the informant details below."
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
                                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleNextFromIdentity}
                                className="rounded-xl bg-theme-primary hover:bg-theme-hover px-8 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-theme-primary/40"
                            >
                                Proceed to Deceased Details <ChevronRight className="inline-block mr-1 w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step: DETAILS */}
                {currentStep === "DETAILS" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Deceased Details</h2>
                            <p className="text-xs text-slate-500 font-medium italic">Please enter the official registry details of the deceased person.</p>
                        </div>

                        {/* Resident Search Component */}
                        <div className="space-y-3 p-6 rounded-[2rem] bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <div className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-theme-primary" />
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                                    Search Deceased in Resident Database
                                </Label>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider italic">
                                If the deceased was a registered local resident, you can search and select their profile to automatically pre-fill the name fields below.
                            </p>
                            <ResidentSearch
                                currentResidentId={residentData?.id}
                                placeholder="Type resident name to search..."
                                onSelect={(r) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        deceasedFirstName: r.firstName || "",
                                        deceasedMiddleName: r.middleName || "",
                                        deceasedLastName: r.lastName || "",
                                        deceasedSuffix: r.suffix || "",
                                        fatherFirstName: r.fatherFirstName || "",
                                        fatherMiddleName: r.fatherMiddleName || "",
                                        fatherLastName: r.fatherLastName || "",
                                        motherFirstName: r.motherFirstName || "",
                                        motherMiddleName: r.motherMiddleName || "",
                                        motherLastName: r.motherLastName || "",
                                    }));
                                    toast.success(`Selected ${r.firstName} ${r.lastName} as the deceased.`);
                                }}
                            />
                        </div>

                        <div className="space-y-6">
                            {/* Deceased Full Name Input Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="deceasedFirstName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Deceased First Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="deceasedFirstName"
                                        value={formData.deceasedFirstName}
                                        onChange={(e) => handleFormChange("deceasedFirstName", e.target.value.toUpperCase())}
                                        placeholder="Enter first name"
                                        className={cn(
                                            "rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md",
                                            showValidationErrors && !formData.deceasedFirstName && "border-red-500"
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="deceasedMiddleName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Deceased Middle Name</Label>
                                    <Input
                                        id="deceasedMiddleName"
                                        value={formData.deceasedMiddleName}
                                        onChange={(e) => handleFormChange("deceasedMiddleName", e.target.value.toUpperCase())}
                                        placeholder="Enter middle name"
                                        className="rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="deceasedLastName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Deceased Last Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="deceasedLastName"
                                        value={formData.deceasedLastName}
                                        onChange={(e) => handleFormChange("deceasedLastName", e.target.value.toUpperCase())}
                                        placeholder="Enter last name"
                                        className={cn(
                                            "rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md",
                                            showValidationErrors && !formData.deceasedLastName && "border-red-500"
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="deceasedSuffix" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Deceased Suffix</Label>
                                    <Input
                                        id="deceasedSuffix"
                                        value={formData.deceasedSuffix}
                                        onChange={(e) => handleFormChange("deceasedSuffix", e.target.value.toUpperCase())}
                                        placeholder="E.g., JR, SR, III"
                                        className="rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md"
                                    />
                                </div>
                            </div>

                            {/* Parents Section Header */}
                            <div className="pt-6 border-t border-slate-200 dark:border-white/5 mt-8 space-y-1">
                                <h3 className="text-sm font-black uppercase italic tracking-wider text-slate-800 dark:text-white">Deceased Parents Details</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">Enter the deceased individual's parent names for confirmation verification.</p>
                            </div>

                            {/* Father's Name Grid */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Father's Name</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="fatherFirstName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Father's First Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="fatherFirstName"
                                            value={formData.fatherFirstName}
                                            onChange={(e) => handleFormChange("fatherFirstName", e.target.value.toUpperCase())}
                                            placeholder="Enter father's first name"
                                            className={cn(
                                                "rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md",
                                                showValidationErrors && !formData.fatherFirstName && "border-red-500"
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fatherMiddleName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Father's Middle Name</Label>
                                        <Input
                                            id="fatherMiddleName"
                                            value={formData.fatherMiddleName}
                                            onChange={(e) => handleFormChange("fatherMiddleName", e.target.value.toUpperCase())}
                                            placeholder="Enter father's middle name"
                                            className="rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fatherLastName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Father's Last Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="fatherLastName"
                                            value={formData.fatherLastName}
                                            onChange={(e) => handleFormChange("fatherLastName", e.target.value.toUpperCase())}
                                            placeholder="Enter father's last name"
                                            className={cn(
                                                "rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md",
                                                showValidationErrors && !formData.fatherLastName && "border-red-500"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Mother's Maiden Name Grid */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mother's Maiden Name</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="motherFirstName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Mother's First Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="motherFirstName"
                                            value={formData.motherFirstName}
                                            onChange={(e) => handleFormChange("motherFirstName", e.target.value.toUpperCase())}
                                            placeholder="Enter mother's first name"
                                            className={cn(
                                                "rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md",
                                                showValidationErrors && !formData.motherFirstName && "border-red-500"
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="motherMiddleName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Mother's Middle Name</Label>
                                        <Input
                                            id="motherMiddleName"
                                            value={formData.motherMiddleName}
                                            onChange={(e) => handleFormChange("motherMiddleName", e.target.value.toUpperCase())}
                                            placeholder="Enter mother's middle name"
                                            className="rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="motherLastName" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Mother's Last Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="motherLastName"
                                            value={formData.motherLastName}
                                            onChange={(e) => handleFormChange("motherLastName", e.target.value.toUpperCase())}
                                            placeholder="Enter mother's last name"
                                            className={cn(
                                                "rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md",
                                                showValidationErrors && !formData.motherLastName && "border-red-500"
                                            )}
                                        />
                                    </div>
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
                                Proceed to ID & Death Event <ChevronRight className="inline-block mr-1 w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step: UPLOAD */}
                {currentStep === "UPLOAD" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Death Event & Identification</h2>
                            <p className="text-xs text-slate-500 font-medium italic">Please enter the details of the event and upload clear photos of your valid ID card.</p>
                        </div>

                        <div className="space-y-6">
                            {/* Event Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-slate-200 dark:border-white/5">
                                <div className="space-y-2">
                                    <Label htmlFor="dateOfDeath" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Date of Death <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        id="dateOfDeath"
                                        max={new Date().toISOString().split("T")[0]}
                                        value={formData.dateOfDeath}
                                        onChange={(e) => handleFormChange("dateOfDeath", e.target.value)}
                                        className={cn(
                                            "rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md",
                                            showValidationErrors && !formData.dateOfDeath && "border-red-500"
                                        )}
                                    />
                                    {formData.dateOfDeath && new Date(formData.dateOfDeath) > new Date() && (
                                        <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">
                                            Date of death cannot be in the future.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="placeOfDeath" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Place of Death (Barangay) <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={getNormalizedPlaceOfDeath(formData.placeOfDeath)}
                                        onValueChange={(val) => handleFormChange("placeOfDeath", val)}
                                    >
                                        <SelectTrigger className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md", showValidationErrors && !formData.placeOfDeath && "border-red-500")}>
                                            <SelectValue placeholder="Select place of death" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl mt-2 max-h-60 overflow-y-auto">
                                            {barangaysList.map((brgy) => (
                                                <SelectItem
                                                    key={brgy}
                                                    value={brgy.toUpperCase()}
                                                    className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 dark:hover:bg-theme-primary/15 font-black uppercase text-xs tracking-wider transition-colors"
                                                >
                                                    {brgy.toUpperCase()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <Label htmlFor="causeOfDeath" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Cause of Death (Optional)</Label>
                                    <Input
                                        id="causeOfDeath"
                                        value={formData.causeOfDeath}
                                        onChange={(e) => handleFormChange("causeOfDeath", e.target.value.toUpperCase())}
                                        placeholder="E.g., Cardiopulmonary Arrest"
                                        className="rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md"
                                    />
                                </div>
                            </div>

                            {/* ID Type dropdown */}
                            <div className="space-y-2">
                                <Label htmlFor="idType" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-1">Government ID Type <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.idType || residentData?.idType || ""}
                                    onValueChange={(val) => handleFormChange("idType", val)}
                                    disabled={idChoice === "PROFILE"}
                                >
                                    <SelectTrigger className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md", showValidationErrors && !(formData.idType || residentData?.idType) && "border-red-500")}>
                                        <SelectValue placeholder="Select type of government ID" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl mt-2 max-h-60 overflow-y-auto">
                                        <SelectItem value="UMID" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">UMID</SelectItem>
                                        <SelectItem value="DRIVERS_LICENSE" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">Driver's License</SelectItem>
                                        <SelectItem value="PASSPORT" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">Passport</SelectItem>
                                        <SelectItem value="POSTAL_ID" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">Postal ID</SelectItem>
                                        <SelectItem value="VOTERS_ID" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">Voter's ID</SelectItem>
                                        <SelectItem value="PRC_ID" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">PRC ID</SelectItem>
                                        <SelectItem value="NATIONAL_ID" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">National ID (PhilSys)</SelectItem>
                                        <SelectItem value="SENIOR_CITIZEN" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">Senior Citizen ID</SelectItem>
                                        <SelectItem value="PWD_ID" className="focus:bg-theme-primary focus:text-white hover:bg-theme-primary/10 font-black uppercase text-xs tracking-wider transition-colors">PWD ID</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Required Documents Upload area */}
                            <RequiredDocuments
                                title="Government ID Copies"
                                subtitle="Provide front and back images of your chosen Government ID."
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
                                onClick={() => setCurrentStep("DETAILS")}
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
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step: SUBMIT */}
                {currentStep === "SUBMIT" && (
                    !selectedApplication ? (
                        <ReviewAndSubmit
                            title="Review & Confirm"
                            subtitle="Please review your death certificate request details before submission."
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
                                            <span className="text-slate-700 dark:text-slate-350 uppercase">Death Certificate Copy</span>
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
                                    {/* Card 1: Subject Details (Deceased) */}
                                    <div className="bg-slate-50/30 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                            <User size={16} /> Subject Details (Deceased)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">First Name</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.deceasedFirstName}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Middle Name</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.deceasedMiddleName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Last Name</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.deceasedLastName}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Suffix</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.deceasedSuffix || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Death</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold">{formatDateOfEvent(formData.dateOfDeath)}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Place of Death</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.placeOfDeath}</span>
                                            </div>
                                            {formData.causeOfDeath && (
                                                <div className="col-span-2">
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Cause of Death</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{formData.causeOfDeath}</span>
                                                </div>
                                            )}
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

                                    {/* Card 3: Requester Details */}
                                    <div className="bg-slate-50/30 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4 col-span-1 md:col-span-2">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                            <User size={16} /> Requester Information
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Full Name</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                                                    {[formData.firstName, formData.middleName, formData.lastName, formData.suffix].filter(Boolean).join(" ")}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Relationship</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                                                    {formData.relationship === "OTHER" ? `OTHER (${formData.relationshipSpecify})` : formData.relationship}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Contact Number</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold">{formData.contactNumber}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Email Address</span>
                                                <span className="text-slate-900 dark:text-white text-sm font-bold">{formData.email || "N/A"}</span>
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
                                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                    Request <span className="text-theme-primary">Submitted</span>
                                </h2>
                                <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                    Your Death Certificate certified copy request has been logged successfully.
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
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Deceased individual</span>
                                            <span className="text-slate-900 dark:text-white uppercase font-black">{selectedApplication.deathCertificateRequest?.subjectName}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Date of Death</span>
                                            <span className="text-slate-900 dark:text-white font-black">
                                                {selectedApplication.deathCertificateRequest?.dateOfEvent
                                                    ? new Date(selectedApplication.deathCertificateRequest.dateOfEvent).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                                                    : "N/A"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Fulfillment Type</span>
                                            <span className="text-slate-900 dark:text-white font-black uppercase">{selectedApplication.fulfillmentType || "PICK_UP (Office Claim)"}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Paid Amount</span>
                                            <span className="text-slate-900 dark:text-white font-black">₱{selectedApplication.totalAmount?.toFixed(2) || "100.00"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex gap-3 text-xs text-theme-primary font-semibold leading-relaxed">
                                    <CheckCircle className="w-5 h-5 shrink-0" />
                                    <span>Your request is successfully pending civil registry inspection. Once verified, you will be notified for pickup.</span>
                                </div>
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
