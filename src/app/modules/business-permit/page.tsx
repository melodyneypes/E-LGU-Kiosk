/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2,
    Calculator,
    ChevronRight,
    Loader2,
    Check,
    Upload,
    Sparkles,
    TrendingUp,
    ShieldAlert,
    User,
    Building2,
    HelpCircle,
    X,
    ChevronDown,
    Eye,
    AlertCircle
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { calculateBusinessPermit } from "@/lib/business-permit";
import { useDraft } from "@/hooks/useDraft";
import { getCurrentUserResident, getTransactionTypes, submitBusinessPermitTransaction, getBarangaysList, getTransactionById, getAllSuccessfulBusinessPermits, getUserTransactions, getSystemSettingAction } from "./actions";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import SecureIdleTimer from "@/components/shared/SecureIdleTimer";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import { supabase } from "@/lib/supabase";

// --- TYPES ---
type Step = "PATHWAY" | "USER_IDENTITY" | "PROFILE" | "CHECKLIST" | "SUBMIT";

interface FormState {
    typeId: string;
    businessType: "NEW" | "RENEWAL";
    businessName: string;
    tradeName: string;
    orgType: string;
    dtiSecNumber: string;
    permitNumber: string; // Used for renewals
    lineOfBusiness: string;
    barangay: string; // Barangay location of the business
    street: string; // Street address of the business
    building: string; // Building / House number of the business location
    capitalInvestment: string; // Declared Capitalization for new
    grossSales: string; // Declared gross sales for renewals
    employeeCount: string;
    businessArea: string;
    fulfillmentType: "PICK_UP" | "DELIVERY" | "E_COPY";
    deliveryAddress: string;
    deliveryPhone: string;
    residentData?: {
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
        user?: any;
        [key: string]: any;
    }; // Added for editable user details matching Cedula
    tinNumber: string;
    philhealthNumber: string;
    pagibigNumber: string;
    sssNumber: string;
    businessBranch: "MAIN" | "BRANCH";
    registrationType: "DTI" | "SEC" | "COA";
    dtiSecDate: string;

    // Files
    ctcFile: File | null;
    dtiSecFile: File | null;
    brgyClearanceFile: File | null;
    ownerIdFile: File | null;
    locationPhotoFile: File | null;
    sanitaryPermitFile: File | null;
    fireSafetyFile: File | null;
    birCorFile: File | null;
    previousPermitFile: File | null;
    [key: string]: any;
}

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
    { id: "PATHWAY", label: "Status", icon: Sparkles },
    { id: "USER_IDENTITY", label: "Identity", icon: User },
    { id: "PROFILE", label: "Business", icon: Building2 },
    { id: "CHECKLIST", label: "Documents", icon: Upload },
    { id: "SUBMIT", label: "Submit", icon: CheckCircle2 },
];

const DEFAULT_BARANGAYS = [
    "Amanoaoac",
    "Apaya",
    "Aserda",
    "Baloling",
    "Coral",
    "Golden",
    "Lanas",
    "Nilombot",
    "Patland",
    "Pias",
    "Poblacion",
    "Primicias",
    "Santa Maria",
    "Torres",
    "Valenzuela"
];

const LINE_OF_BUSINESS_OPTIONS = [
    "Agriculture & Forestry",
    "Manufacturing",
    "Wholesale & Retail",
    "Food & Beverage Services",
    "IT & Computer Services",
    "Construction",
    "Real Estate",
    "Transportation & Storage",
    "Healthcare & Social",
    "Education"
];

const STEP_BY_STEP_GUIDES: Record<string, { title: string; steps: string[] }> = {
    ctcFile: {
        title: "How to get a Community Tax Certificate (Cedula)",
        steps: [
            "Visit your local Barangay Hall or the Municipal Treasury Office.",
            "Bring a Valid Government-Issued ID.",
            "Fill out the Community Tax Declaration Form.",
            "Declare your primary source of income or gross receipts from the preceding year (if applicable).",
            "Pay the corresponding basic and additional community tax.",
            "Receive your signed and thumb-marked Community Tax Certificate."
        ]
    },
    dtiSecFile: {
        title: "How to get a DTI / SEC / COA Registration",
        steps: [
            "For Sole Proprietorships (DTI): Register your business name online via the DTI BNRS (Business Name Registration System) website or visit the nearest DTI Negosyo Center.",
            "For Corporations/Partnerships (SEC): Register online via the SEC eSPARC (Electronic Simplified Processing of Application for Registration of Company) portal.",
            "For Cooperatives (CDA): Coordinate with the Cooperative Development Authority (CDA) regional office for registration.",
            "Pay the corresponding registration fee via their respective online payment portals or authorized Payments.",
            "Once approved, download and print your official Certificate of Registration."
        ]
    },
    birCorFile: {
        title: "How to get a BIR Certificate of Registration (COR)",
        steps: [
            "Fill out BIR Form 1901 (for Sole Proprietorships) or Form 1903 (for Corporations/Partnerships).",
            "Submit the completed form along along with your DTI/SEC Certificate, Barangay Clearance, and Valid IDs to your designated Revenue District Office (RDO).",
            "Pay the Annual Registration Fee (₱500) and Documentary Stamp Tax (DST) at the BIR office or an Authorized Agent Bank (AAB).",
            "Attend the required taxpayer's initial briefing or seminar scheduled by the RDO.",
            "Claim your official BIR Form 2303 (Certificate of Registration) and the 'Ask for Receipt' signage."
        ]
    },
    brgyClearanceFile: {
        title: "How to get a Barangay Clearance",
        steps: [
            "Visit the Barangay Hall of the barangay where your business is located.",
            "Bring your approved DTI / SEC / COA Registration and a Valid Government-Issued ID.",
            "Request an application for a Barangay Business Clearance from the receiving desk.",
            "Pay the corresponding barangay clearance fee to the Barangay Treasurer.",
            "Wait for the issuance of your officially signed and sealed Barangay Clearance."
        ]
    },
    fireSafetyFile: {
        title: "How to get a Fire Safety Inspection Certificate",
        steps: [
            "Visit the local Bureau of Fire Protection (BFP) office.",
            "Submit the required documents (e.g., building plan, previous FSIC, or fire insurance).",
            "Pay the required Fire Code Construction/Regulatory fees.",
            "Wait for the official fire safety inspection to be conducted by authorized BFP personnel at your business location.",
            "Claim your Fire Safety Inspection Certificate (FSIC) upon passing the inspection and complying with all safety requirements."
        ]
    },
    sanitaryPermitFile: {
        title: "How to get a Sanitary Permit",
        steps: [
            "Ensure all employees secure valid Health Certificates (requires medical exams at the Municipal Health Office).",
            "Prepare water potability test results (if your business involves food, beverage, or water services).",
            "Request a sanitary inspection of your business establishment from the Rural Health Unit (RHU) / Sanitary Inspector.",
            "Pay the required Sanitary Inspection Fee at the Municipal Treasury Office.",
            "Claim your approved Sanitary Permit from the Municipal Health Office upon passing the inspection."
        ]
    }
};

function FilePreview({ file, onClick }: { file: File; onClick?: () => void }) {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!file) return;

        if (file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    }, [file]);

    if (file.type.startsWith("image/")) {
        if (!previewUrl) return null;
        return (
            <div
                onClick={onClick}
                className="relative w-full h-36 rounded-xl overflow-hidden mt-3 border border-slate-100 dark:border-white/10 shadow-inner bg-slate-50 dark:bg-black/20 flex items-center justify-center group/preview animate-in fade-in zoom-in-95 duration-200 cursor-pointer"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={previewUrl}
                    alt="Document Preview"
                    className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="text-[10px] text-white font-black uppercase tracking-widest bg-black/60 px-3.5 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 hover:bg-black/80 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                        Click to View
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className="w-full py-4 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 mt-3 flex items-center justify-between gap-2.5 animate-in fade-in duration-200 cursor-pointer group/pdf hover:border-primary/25 transition-all"
        >
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                    PDF
                </div>
                <div className="truncate text-left">
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 truncate font-mono">{file.name}</span>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Document File</span>
                </div>
            </div>
            <Eye className="w-4 h-4 text-slate-400 group-hover/pdf:text-primary transition-colors shrink-0 mr-1" />
        </div>
    );
}
export default function BusinessPermitWizardPage() {
    const router = useRouter();
    const { hydrateDraft, hydrateDraftFiles, persistDraft, clearDraft } = useDraft<FormState>("elgu_bp_draft");
    const contactInputRef = useRef<HTMLInputElement>(null);

    const [currentStep, setCurrentStep] = useState<Step>("PATHWAY");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isSuspended, setIsSuspended] = useState(false); // 3-Strike Penalty Flag
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [calcResult, setCalcResult] = useState<any | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [initialResident, setInitialResident] = useState<any>(null);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [bpTypes, setBpTypes] = useState<any[]>([]);
    const [hasActiveNewPermit, setHasActiveNewPermit] = useState(false);
    const [hasActiveRenewPermit, setHasActiveRenewPermit] = useState(false);
    const [dbBarangays, setDbBarangays] = useState<string[]>([]);
    const [isOtherLine, setIsOtherLine] = useState(false);
    const [isDtiGuideOpen, setIsDtiGuideOpen] = useState(false);
    const [activeGuideKey, setActiveGuideKey] = useState<string | null>(null);
    const [dtiGuideTab, setDtiGuideTab] = useState<"SOLE" | "CORP">("SOLE");
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [revisionTx, setRevisionTx] = useState<any>(null);
    const [showValidationErrors, setShowValidationErrors] = useState(false);
    const [themeColor, setThemeColor] = useState("var(--primary-theme)");

    const [previousPermits, setPreviousPermits] = useState<any[]>([]);
    const [selectedPermitIndex, setSelectedPermitIndex] = useState<number>(0);
    const [isAutofilledFromPrevious, setIsAutofilledFromPrevious] = useState(false);
    const [showRenewalModal, setShowRenewalModal] = useState(false);
    const [handoffToken, setHandoffToken] = useState("");
    const [handoffQrCode, setHandoffQrCode] = useState("");
    const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
    const [handoffField, setHandoffField] = useState<string | null>(null);
    const [handoffFiles, setHandoffFiles] = useState<Record<string, { fileName: string; url: string }>>({});
    const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);

    const [formData, setFormData] = useState<FormState>({
        typeId: "",
        businessType: "NEW",
        businessName: "",
        tradeName: "",
        orgType: "SOLE_PROPRIETORSHIP",
        dtiSecNumber: "",
        permitNumber: "",
        lineOfBusiness: "",
        barangay: "",
        street: "",
        building: "",
        capitalInvestment: "",
        grossSales: "",
        employeeCount: "0",
        businessArea: "",
        fulfillmentType: "E_COPY",
        deliveryAddress: "",
        deliveryPhone: "",
        residentData: {},
        tinNumber: "",
        philhealthNumber: "",
        pagibigNumber: "",
        sssNumber: "",
        businessBranch: "MAIN",
        registrationType: "DTI",
        dtiSecDate: "",
        ctcFile: null,
        dtiSecFile: null,
        brgyClearanceFile: null,
        ownerIdFile: null,
        locationPhotoFile: null,
        sanitaryPermitFile: null,
        fireSafetyFile: null,
        birCorFile: null,
        previousPermitFile: null
    });

    // Document Viewer States
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerFile, setViewerFile] = useState<File | null>(null);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState("");
    const openViewer = (file: File | null, url: string | null, title: string) => {
        setViewerFile(file);
        setViewerUrl(url);
        setViewerTitle(title);
        setViewerOpen(true);
    };

    useEffect(() => {
        if (!handoffToken) return;
        let cancelled = false;
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/upload-handoff/${encodeURIComponent(handoffToken)}`);
                const result = await response.json();
                if (cancelled) return;
                if (result.status === "uploaded" && Array.isArray(result.files)) {
                    const first = result.files[0];
                    if (first?.slot && first?.url) {
                        setHandoffFiles(prev => ({ ...prev, [first.slot]: { fileName: first.fileName, url: first.url } }));
                    }
                }
                if (result.expiresAt) setHandoffExpiresAt(result.expiresAt);
            } catch (error) {
                console.error("Business Permit upload handoff polling error:", error);
            }
        }, 5000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [handoffToken]);

    const startHandoff = async (field: string) => {
        try {
            setIsCreatingHandoff(true);
            const userId = formData.residentData?.id;
            if (!userId) {
                toast.error("Resident profile is unavailable.");
                return;
            }
            const response = await fetch("/api/upload-handoff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, slot: `bp_${field}` }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to create QR upload.");
            const qrDataUrl = await QRCode.toDataURL(result.uploadUrl, { margin: 1, width: 320, errorCorrectionLevel: "M" });
            setHandoffToken(result.token);
            setHandoffQrCode(qrDataUrl);
            setHandoffExpiresAt(result.expiresAt);
            setHandoffField(field);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to create QR upload.");
        } finally {
            setIsCreatingHandoff(false);
        }
    };

    // Scroll to top when transitioning to the submit step
    useEffect(() => {
        if (currentStep === "SUBMIT") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [currentStep]);

    // Reset validation errors on step change
    useEffect(() => {
        setShowValidationErrors(false);
    }, [currentStep]);

    useEffect(() => {
        getSystemSettingAction("theme_color").then((res) => {
            if (res.success && res.data) {
                setThemeColor(res.data);
            }
        });
    }, []);

    // --- INITIALIZATION & DRAFT HYDRATION ---
    useEffect(() => {
        async function init() {
            try {
                // Check user rejection count (rejection count strikes penalty check)
                const residentRes = await getCurrentUserResident();
                const resident = residentRes.data;

                if (residentRes.success && resident) {
                    setInitialResident(resident);

                    // Validate strikes on load
                    const resWithUser = resident as any;
                    if (resWithUser.user && (resWithUser.user.rejectionCount ?? 0) >= 3) {
                        setIsSuspended(true);
                        setLoading(false);
                        return;
                    }

                    setFormData(prev => ({
                        ...prev,
                        residentData: resident,
                        barangay: resident.barangay || "",
                        deliveryPhone: resident.contactNumber || "",
                        deliveryAddress: resident.houseNumber
                            ? `${resident.houseNumber} ${resident.street || ""}, Brgy. ${resident.barangay || ""}, ${resident.municipality || "Local Municipality"}`
                            : ""
                    }));
                }

                // Fetch database transaction types to map typeIds
                const typesRes = await getTransactionTypes();
                if (typesRes.success) {
                    const filtered = typesRes.data?.filter((t: any) => t.code.startsWith("BUSINESS_PERMIT")) || [];
                    setBpTypes(filtered);
                    if (filtered.length > 0) {
                        // Select default NEW permit type ID
                        const newType = filtered.find((t: any) => t.code === "BUSINESS_PERMIT_NEW") || filtered[0];
                        setFormData(prev => ({ ...prev, typeId: newType.id }));
                    }
                }

                // Fetch active barangays from database
                const brgyRes = await getBarangaysList();
                if (brgyRes.success && brgyRes.data) {
                    setDbBarangays(brgyRes.data);
                }

                // Fetch previous successful permit for renewal auto-fill checking
                const prevPermitsRes = await getAllSuccessfulBusinessPermits();
                if (prevPermitsRes.success && prevPermitsRes.data) {
                    // Group by business name (case-insensitive, trimmed) to filter unique businesses
                    const uniqueBusinessesMap: Record<string, any> = {};
                    prevPermitsRes.data.forEach((tx: any) => {
                        const bizName = tx.additionalData?.businessName?.trim().toUpperCase();
                        if (bizName && !uniqueBusinessesMap[bizName]) {
                            uniqueBusinessesMap[bizName] = tx;
                        }
                    });
                    const uniqueList = Object.values(uniqueBusinessesMap);
                    setPreviousPermits(uniqueList);
                }

                // Fetch User Transactions to verify pending requests for BUSINESS_PERMIT_NEW and BUSINESS_PERMIT_RENEW
                const txsRes = await getUserTransactions();
                if (txsRes.success && txsRes.data) {
                    const activeNew = txsRes.data.some((tx: any) =>
                        tx.type?.code === "BUSINESS_PERMIT_NEW" &&
                        !tx.isCancelled &&
                        !["DELIVERED", "RELEASED", "REJECTED", "DRAFT"].includes(tx.status)
                    );
                    setHasActiveNewPermit(activeNew);

                    const activeRenew = txsRes.data.some((tx: any) =>
                        tx.type?.code === "BUSINESS_PERMIT_RENEW" &&
                        !tx.isCancelled &&
                        !["DELIVERED", "RELEASED", "REJECTED", "DRAFT"].includes(tx.status)
                    );
                    setHasActiveRenewPermit(activeRenew);
                }

                // Check search parameters for revision ID
                const searchParams = new URLSearchParams(window.location.search);
                const revId = searchParams.get("revisionId");
                let isRevisionMode = false;

                if (revId) {
                    const txRes = await getTransactionById(revId);
                    if (txRes.success && txRes.data) {
                        const tx = txRes.data;
                        if (tx.status === "FOR_REVISION") {
                            setRevisionId(revId);
                            setRevisionTx(tx);
                            isRevisionMode = true;
                            setCurrentStep("USER_IDENTITY");

                            // Prepopulate values from existing transaction additionalData
                            const addData = tx.additionalData as any;
                            if (addData) {
                                setFormData(prev => ({
                                    ...prev,
                                    businessType: addData.businessType || "NEW",
                                    businessName: addData.businessName || "",
                                    tradeName: addData.tradeName || "",
                                    orgType: addData.orgType || "SOLE_PROPRIETORSHIP",
                                    dtiSecNumber: addData.dtiSecNumber || "",
                                    permitNumber: addData.permitNumber || "",
                                    lineOfBusiness: addData.lineOfBusiness || "",
                                    barangay: addData.barangay || prev.barangay,
                                    street: addData.street || "",
                                    building: addData.building || "",
                                    capitalInvestment: addData.capitalInvestment ? addData.capitalInvestment.toString() : "",
                                    grossSales: addData.grossSales ? addData.grossSales.toString() : "",
                                    employeeCount: addData.employeeCount ? addData.employeeCount.toString() : "0",
                                    businessArea: addData.businessArea ? addData.businessArea.toString() : "",
                                    fulfillmentType: addData.fulfillmentType || "E_COPY",
                                    deliveryAddress: addData.deliveryAddress || prev.deliveryAddress,
                                    deliveryPhone: addData.deliveryPhone || prev.deliveryPhone,
                                    tinNumber: addData.tinNumber || "",
                                    philhealthNumber: addData.philhealthNumber || "",
                                    pagibigNumber: addData.pagibigNumber || "",
                                    sssNumber: addData.sssNumber || "",
                                    dtiSecDate: addData.dtiSecDate || "",
                                    registrationType: addData.registrationType || "DTI",
                                    businessBranch: addData.businessBranch || "MAIN"
                                }));
                            }
                        }
                    }
                }

                if (!isRevisionMode) {
                    // Hydrate inputs draft from localStorage
                    hydrateDraft(setFormData, (parsed) => {
                        setFormData(prev => ({
                            ...prev,
                            ...parsed,
                        }));
                    });

                    // Hydrate files from IndexedDB
                    hydrateDraftFiles((files) => {
                        setFormData(prev => ({
                            ...prev,
                            ctcFile: files.ctcFile || null,
                            dtiSecFile: files.dtiSecFile || null,
                            brgyClearanceFile: files.brgyClearanceFile || null,
                            ownerIdFile: files.ownerIdFile || null,
                            locationPhotoFile: files.locationPhotoFile || null,
                            sanitaryPermitFile: files.sanitaryPermitFile || null,
                            fireSafetyFile: files.fireSafetyFile || null,
                            birCorFile: files.birCorFile || null,
                            previousPermitFile: files.previousPermitFile || null
                        }));
                    });
                }
            } catch (err) {
                console.error("Initialization error:", err);
                toast.error("Failed to initialize permits portal");
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [hydrateDraft, hydrateDraftFiles]);

    // --- SYNCHRONIZE TYPEID REACTIVELY ON PATHWAY TOGGLE ---
    useEffect(() => {
        if (bpTypes.length === 0) return;
        const targetCode = formData.businessType === "NEW" ? "BUSINESS_PERMIT_NEW" : "BUSINESS_PERMIT_RENEW";
        const matched = bpTypes.find((t: any) => t.code === targetCode);
        if (matched) {
            setFormData(prev => {
                if (prev.typeId === matched.id) return prev;
                return { ...prev, typeId: matched.id };
            });
        }
    }, [formData.businessType, bpTypes]);

    // Synchronize isOtherLine state with formData.lineOfBusiness on draft hydration
    useEffect(() => {
        if (formData.lineOfBusiness && !LINE_OF_BUSINESS_OPTIONS.includes(formData.lineOfBusiness)) {
            setIsOtherLine(true);
        }
    }, [formData.lineOfBusiness]);

    // Prevent background page scrolling while custom overlays are open.
    useEffect(() => {
        const hasRenewalModal = showRenewalModal && previousPermits.length > 0;
        const hasGuideModal = isDtiGuideOpen || Boolean(activeGuideKey);
        const shouldLockScroll = hasRenewalModal || hasGuideModal;

        if (!shouldLockScroll) return;

        const scrollY = window.scrollY;
        const previousOverflow = document.body.style.overflow;
        const previousPosition = document.body.style.position;
        const previousTop = document.body.style.top;
        const previousWidth = document.body.style.width;

        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";

        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.position = previousPosition;
            document.body.style.top = previousTop;
            document.body.style.width = previousWidth;
            window.scrollTo(0, scrollY);
        };
    }, [showRenewalModal, previousPermits.length, isDtiGuideOpen, activeGuideKey]);


    const handleLineOfBusinessSelect = (val: string) => {
        if (val === "Other") {
            setIsOtherLine(true);
            handleInputChange("lineOfBusiness", "");
            setTimeout(() => {
                document.getElementById("profile-lineOfBusiness")?.focus();
            }, 50);
        } else {
            setIsOtherLine(false);
            handleInputChange("lineOfBusiness", val);
        }
    };

    const handleSelectPreviousPermit = () => {
        const targetPermit = previousPermits[selectedPermitIndex];
        if (!targetPermit) return;
        const addData = targetPermit.additionalData || {};

        setFormData(prev => {
            const updated: FormState = {
                ...prev,
                businessType: "RENEWAL",
                businessName: addData.businessName || "",
                tradeName: addData.tradeName || "",
                orgType: addData.orgType || "SOLE_PROPRIETORSHIP",
                dtiSecNumber: addData.dtiSecNumber || "",
                permitNumber: targetPermit.businessPermit?.permitNumber || addData.permitNumber || targetPermit.id.slice(-8).toUpperCase(),
                lineOfBusiness: addData.lineOfBusiness || "",
                barangay: addData.barangay || prev.barangay,
                street: addData.street || "",
                building: addData.building || "",
                employeeCount: addData.employeeCount ? addData.employeeCount.toString() : "0",
                businessArea: addData.businessArea ? addData.businessArea.toString() : "",
                tinNumber: addData.tinNumber || "",
                philhealthNumber: addData.philhealthNumber || "",
                pagibigNumber: addData.pagibigNumber || "",
                sssNumber: addData.sssNumber || "",
                businessBranch: addData.businessBranch === "BRANCH" ? "BRANCH" : "MAIN",
                registrationType: addData.registrationType === "SEC" ? "SEC" : addData.registrationType === "COA" ? "COA" : "DTI",
                dtiSecDate: addData.dtiSecDate || "",
            };
            persistDraftLocal(updated);
            return updated;
        });

        setIsAutofilledFromPrevious(true);
        setShowRenewalModal(false);
        toast.success(`Business details auto-filled for ${addData.businessName || "selected business"}!`);

        setCurrentStep("USER_IDENTITY");
    };

    const handleDeclinePreviousPermit = () => {
        setFormData(prev => {
            const updated: FormState = {
                ...prev,
                businessType: "RENEWAL",
                businessName: "",
                tradeName: "",
                orgType: "SOLE_PROPRIETORSHIP",
                dtiSecNumber: "",
                permitNumber: "",
                lineOfBusiness: "",
                barangay: prev.residentData?.barangay || "",
                street: "",
                building: "",
                capitalInvestment: "",
                grossSales: "",
                employeeCount: "0",
                businessArea: "",
                tinNumber: "",
                philhealthNumber: "",
                pagibigNumber: "",
                sssNumber: "",
                businessBranch: "MAIN",
                registrationType: "DTI",
                dtiSecDate: "",
            };
            persistDraftLocal(updated);
            return updated;
        });
        setIsAutofilledFromPrevious(false);
        setShowRenewalModal(false);
        toast.info("Proceeding with manual renewal entry.");
    };

    // --- AUTO-SAVE ON FIELD CHANGES ---
    const persistDraftLocal = (state: FormState) => {
        const textInputs = {
            businessType: state.businessType,
            businessName: state.businessName,
            tradeName: state.tradeName,
            orgType: state.orgType,
            barangay: state.barangay,
            street: state.street,
            building: state.building,
            dtiSecNumber: state.dtiSecNumber,
            permitNumber: state.permitNumber,
            lineOfBusiness: state.lineOfBusiness,
            capitalInvestment: state.capitalInvestment,
            grossSales: state.grossSales,
            employeeCount: state.employeeCount,
            businessArea: state.businessArea,
            fulfillmentType: state.fulfillmentType,
            deliveryAddress: state.deliveryAddress,
            deliveryPhone: state.deliveryPhone,
            tinNumber: state.tinNumber,
            philhealthNumber: state.philhealthNumber,
            pagibigNumber: state.pagibigNumber,
            sssNumber: state.sssNumber,
            businessBranch: state.businessBranch,
            registrationType: state.registrationType,
            dtiSecDate: state.dtiSecDate
        };
        persistDraft(textInputs);
    };

    const handleInputChange = (field: keyof FormState, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            persistDraftLocal(updated);
            return updated;
        });
    };

    // --- REALTIME READ-ONLY COMPUTATION PREVIEW ---
    const updateCalc = useCallback(() => {
        const cap = parseFloat(formData.capitalInvestment.replace(/,/g, "")) || 0;
        const sales = parseFloat(formData.grossSales.replace(/,/g, "")) || 0;

        const result = calculateBusinessPermit({
            type: formData.businessType,
            capitalization: cap,
            grossSales: sales,
            fulfillmentType: formData.fulfillmentType,
            deliveryFee: 100.00 // Standard municipal dispatch logistics fee
        });
        setCalcResult(result);
    }, [formData.capitalInvestment, formData.grossSales, formData.businessType, formData.fulfillmentType]);

    useEffect(() => {
        updateCalc();
    }, [updateCalc]);

    // --- DYNAMIC STEP VALIDATIONS ---
    const isStepValid = (stepId: Step) => {
        switch (stepId) {
            case "PATHWAY":
                return !!formData.typeId;
            case "USER_IDENTITY":
                const r = formData.residentData;
                return !!(r?.firstName && r?.lastName && r?.dateOfBirth && r?.occupation && r?.contactNumber);
            case "PROFILE":
                if (!formData.businessName || !formData.lineOfBusiness || !formData.barangay || !formData.orgType || !formData.tinNumber || !formData.businessBranch) return false;
                if (formData.businessType === "NEW") {
                    return parseFloat(formData.capitalInvestment.replace(/,/g, "")) > 0 && !!formData.dtiSecNumber && !!formData.dtiSecDate;
                } else {
                    return parseFloat(formData.grossSales.replace(/,/g, "")) > 0 && !!formData.permitNumber;
                }
            case "CHECKLIST":
                if (formData.businessType === "NEW") {
                    return !!(
                        (formData.ownerIdFile || formData.residentData?.idFrontUrl || revisionTx?.additionalData?.ownerIdUrl) &&
                        (formData.ctcFile || revisionTx?.additionalData?.ctcUrl) &&
                        (formData.dtiSecFile || revisionTx?.additionalData?.dtiSecUrl) &&
                        (formData.brgyClearanceFile || revisionTx?.additionalData?.brgyClearanceUrl) &&
                        (formData.sanitaryPermitFile || revisionTx?.additionalData?.sanitaryPermitUrl) &&
                        (formData.fireSafetyFile || revisionTx?.additionalData?.fireSafetyUrl)
                    );
                } else {
                    return !!(
                        (formData.ownerIdFile || formData.residentData?.idFrontUrl || revisionTx?.additionalData?.ownerIdUrl) &&
                        (formData.ctcFile || revisionTx?.additionalData?.ctcUrl) &&
                        (formData.dtiSecFile || revisionTx?.additionalData?.dtiSecUrl) &&
                        (formData.previousPermitFile || revisionTx?.additionalData?.previousPermitUrl)
                    );
                }
            case "SUBMIT":
                return !!revisionId || privacyAccepted;
            default:
                return true;
        }
    };

    const canNavigate = (targetStep: Step) => {
        if (targetStep === "PATHWAY" && revisionId) return false;

        if (formData.businessType === "NEW" && hasActiveNewPermit && !revisionId && targetStep !== "PATHWAY") {
            return false;
        }
        if (formData.businessType === "RENEWAL" && hasActiveRenewPermit && !revisionId && targetStep !== "PATHWAY") {
            return false;
        }

        const targetIdx = STEPS.findIndex(s => s.id === targetStep);
        const currentIdx = STEPS.findIndex(s => s.id === currentStep);

        // Always allow going backwards
        if (targetIdx <= currentIdx) return true;

        // For forward navigation (clicking tab icons), ensure all PRECEDING steps are valid
        for (let i = 0; i < targetIdx; i++) {
            if (!isStepValid(STEPS[i].id)) return false;
        }
        return true;
    };

    const handleNext = () => {
        if (currentStep === "PATHWAY") {
            if (formData.businessType === "NEW" && hasActiveNewPermit && !revisionId) {
                toast.error("You already have an active New Business Permit request in progress.");
                return;
            }
            if (formData.businessType === "RENEWAL" && hasActiveRenewPermit && !revisionId) {
                toast.error("You already have an active Business Permit Renewal request in progress.");
                return;
            }
        }
        if (!isStepValid(currentStep)) {
            setShowValidationErrors(true);
            if (currentStep === "USER_IDENTITY") {
                toast.error("Municipal profile record not loaded. Please contact administration.");
                const r = formData.residentData;
                let elementToFocus: HTMLElement | null = null;
                if (!r?.firstName) {
                    elementToFocus = document.getElementById("resident-firstName");
                } else if (!r?.lastName) {
                    elementToFocus = document.getElementById("resident-lastName");
                } else if (!r?.dateOfBirth) {
                    elementToFocus = document.getElementById("resident-dateOfBirth");
                } else if (!r?.occupation) {
                    elementToFocus = document.getElementById("resident-occupation");
                } else if (!r?.contactNumber) {
                    elementToFocus = document.getElementById("resident-contactNumber");
                }

                if (elementToFocus) {
                    elementToFocus.focus();
                    elementToFocus.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            } else if (currentStep === "PROFILE") {
                toast.error("Please fill out all required business profile details.");
                let elementToFocus: HTMLElement | null = null;
                if (!formData.businessName) {
                    elementToFocus = document.getElementById("profile-businessName");
                } else if (!formData.orgType) {
                    elementToFocus = document.getElementById("profile-orgType");
                } else if (!formData.barangay) {
                    elementToFocus = document.getElementById("profile-barangay");
                } else if (!formData.lineOfBusiness) {
                    if (isOtherLine) {
                        elementToFocus = document.getElementById("profile-lineOfBusiness");
                    } else {
                        elementToFocus = document.getElementById("profile-lineOfBusiness-select");
                    }
                } else if (!formData.tinNumber) {
                    elementToFocus = document.getElementById("profile-tinNumber");
                } else if (!formData.businessBranch) {
                    elementToFocus = document.getElementById("profile-businessBranch");
                } else if (formData.businessType === "NEW") {
                    const capVal = parseFloat((formData.capitalInvestment || "").replace(/,/g, "")) || 0;
                    if (capVal <= 0) {
                        elementToFocus = document.getElementById("profile-capitalInvestment");
                    } else if (!formData.dtiSecNumber) {
                        elementToFocus = document.getElementById("profile-dtiSecNumber");
                    } else if (!formData.dtiSecDate) {
                        elementToFocus = document.getElementById("profile-dtiSecDate");
                    }
                } else {
                    const salesVal = parseFloat((formData.grossSales || "").replace(/,/g, "")) || 0;
                    if (salesVal <= 0) {
                        elementToFocus = document.getElementById("profile-grossSales");
                    } else if (!formData.permitNumber) {
                        elementToFocus = document.getElementById("profile-permitNumber");
                    }
                }

                if (elementToFocus) {
                    elementToFocus.focus();
                    elementToFocus.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            } else if (currentStep === "CHECKLIST") {
                toast.error("All document uploads are required. Please upload the missing file.");
                const requiredChecks = formData.businessType === "NEW"
                    ? [
                        { field: "ownerIdFile", check: !!(formData.ownerIdFile || formData.residentData?.idFrontUrl || revisionTx?.additionalData?.ownerIdUrl) },
                        { field: "ctcFile", check: !!(formData.ctcFile || revisionTx?.additionalData?.ctcUrl) },
                        { field: "dtiSecFile", check: !!(formData.dtiSecFile || revisionTx?.additionalData?.dtiSecUrl) },
                        { field: "brgyClearanceFile", check: !!(formData.brgyClearanceFile || revisionTx?.additionalData?.brgyClearanceUrl) },
                        { field: "sanitaryPermitFile", check: !!(formData.sanitaryPermitFile || revisionTx?.additionalData?.sanitaryPermitUrl) },
                        { field: "fireSafetyFile", check: !!(formData.fireSafetyFile || revisionTx?.additionalData?.fireSafetyUrl) }
                    ]
                    : [
                        { field: "ownerIdFile", check: !!(formData.ownerIdFile || formData.residentData?.idFrontUrl || revisionTx?.additionalData?.ownerIdUrl) },
                        { field: "ctcFile", check: !!(formData.ctcFile || revisionTx?.additionalData?.ctcUrl) },
                        { field: "dtiSecFile", check: !!(formData.dtiSecFile || revisionTx?.additionalData?.dtiSecUrl) },
                        { field: "previousPermitFile", check: !!(formData.previousPermitFile || revisionTx?.additionalData?.previousPermitUrl) }
                    ];
                const firstMissing = requiredChecks.find(c => !c.check);
                if (firstMissing) {
                    const uploadCard = document.getElementById(`upload-card-${firstMissing.field}`);
                    if (uploadCard) {
                        uploadCard.scrollIntoView({ behavior: "smooth", block: "center" });
                        uploadCard.classList.add("ring-2", "ring-rose-500", "ring-offset-2");
                        setTimeout(() => {
                            uploadCard.classList.remove("ring-2", "ring-rose-500", "ring-offset-2");
                        }, 2500);
                    }
                }
            } else {
                toast.error("Please complete the required items in this step.");
            }
            return;
        }
        const idx = STEPS.findIndex(s => s.id === currentStep);
        if (idx < STEPS.length - 1) {
            setCurrentStep(STEPS[idx + 1].id);
        }
    };


    // --- UPLOAD FILE CLIENT-SIDE HELPER ---
    const uploadFileClientSide = async (file: File | null, fieldName: string) => {
        if (!file) return null;
        try {
            const userId = formData.residentData?.id || "anonymous";
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${fieldName}_${Date.now()}.${fileExt}`;
            const filePath = `business-permits/${fileName}`;

            const { error } = await supabase.storage
                .from("system-assets")
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error(`Upload error for ${fieldName}:`, error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from("system-assets")
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (err) {
            console.error(`Failed uploading ${fieldName}:`, err);
            throw new Error(`Failed to upload ${file.name}`);
        }
    };

    // --- CONVERT BASE64 DATAURL TO FILE ---
    const dataURLtoFile = (dataurl: string, filename: string) => {
        try {
            const arr = dataurl.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            if (!mimeMatch) return null;
            const mime = mimeMatch[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, { type: mime });
        } catch (e) {
            console.error("Failed to parse base64 data url", e);
            return null;
        }
    };

    // --- FORM ACTIONS SUBMISSION ---
    const onSubmit = async () => {
        setSubmitting(true);
        try {
            toast.loading(<span style={{ color: themeColor }} className="font-black uppercase tracking-widest text-[10px]">Submitting application...</span>, { id: "bp-upload-toast" });

            // Process residentSnapshot base64 files if present (e.g. webcam selfie or scanned IDs)
            const updatedResidentData = { ...formData.residentData };
            if (updatedResidentData.idFrontUrl && updatedResidentData.idFrontUrl.startsWith("data:")) {
                const file = dataURLtoFile(updatedResidentData.idFrontUrl, "id_front.png");
                if (file) {
                    const publicUrl = await uploadFileClientSide(file, 'resident_id_front');
                    if (publicUrl) updatedResidentData.idFrontUrl = publicUrl;
                }
            }
            if (updatedResidentData.idBackUrl && updatedResidentData.idBackUrl.startsWith("data:")) {
                const file = dataURLtoFile(updatedResidentData.idBackUrl, "id_back.png");
                if (file) {
                    const publicUrl = await uploadFileClientSide(file, 'resident_id_back');
                    if (publicUrl) updatedResidentData.idBackUrl = publicUrl;
                }
            }

            // Upload all checklist files client-side first to avoid Vercel 4.5MB payload limit
            const ctcUrl = formData.ctcFile
                ? await uploadFileClientSide(formData.ctcFile, 'ctc')
                : (handoffFiles.ctcFile?.url || revisionTx?.additionalData?.ctcUrl || null);
            const dtiSecUrl = formData.dtiSecFile
                ? await uploadFileClientSide(formData.dtiSecFile, 'dtiSec')
                : (handoffFiles.dtiSecFile?.url || revisionTx?.additionalData?.dtiSecUrl || null);
            const brgyClearanceUrl = formData.brgyClearanceFile
                ? await uploadFileClientSide(formData.brgyClearanceFile, 'brgyClearance')
                : (handoffFiles.brgyClearanceFile?.url || revisionTx?.additionalData?.brgyClearanceUrl || null);
            const ownerIdUrl = formData.ownerIdFile
                ? await uploadFileClientSide(formData.ownerIdFile, 'ownerId')
                : (handoffFiles.ownerIdFile?.url || updatedResidentData.idFrontUrl || revisionTx?.additionalData?.ownerIdUrl || null);
            const locationPhotoUrl = formData.locationPhotoFile
                ? await uploadFileClientSide(formData.locationPhotoFile, 'locationPhoto')
                : (handoffFiles.locationPhotoFile?.url || revisionTx?.additionalData?.locationPhotoUrl || null);
            const sanitaryPermitUrl = formData.sanitaryPermitFile
                ? await uploadFileClientSide(formData.sanitaryPermitFile, 'sanitaryPermit')
                : (handoffFiles.sanitaryPermitFile?.url || revisionTx?.additionalData?.sanitaryPermitUrl || null);
            const fireSafetyUrl = formData.fireSafetyFile
                ? await uploadFileClientSide(formData.fireSafetyFile, 'fireSafety')
                : (handoffFiles.fireSafetyFile?.url || revisionTx?.additionalData?.fireSafetyUrl || null);
            const birCorUrl = formData.birCorFile
                ? await uploadFileClientSide(formData.birCorFile, 'birCor')
                : (handoffFiles.birCorFile?.url || revisionTx?.additionalData?.birCorUrl || null);
            const previousPermitUrl = formData.previousPermitFile
                ? await uploadFileClientSide(formData.previousPermitFile, 'previousPermit')
                : (handoffFiles.previousPermitFile?.url || revisionTx?.additionalData?.previousPermitUrl || null);

            const submitData = new FormData();
            submitData.append("typeId", formData.typeId);
            submitData.append("residentSnapshot", JSON.stringify(updatedResidentData));
            if (revisionId) {
                submitData.append("revisionId", revisionId);
            }

            // Merge textual profiles and storage URLs into additionalData metadata
            submitData.append("additionalData", JSON.stringify({
                businessType: formData.businessType,
                businessName: formData.businessName,
                tradeName: formData.tradeName,
                orgType: formData.orgType,
                dtiSecNumber: formData.dtiSecNumber,
                permitNumber: formData.permitNumber,
                lineOfBusiness: formData.lineOfBusiness,
                barangay: formData.barangay,
                street: formData.street,
                building: formData.building,
                capitalInvestment: parseFloat(formData.capitalInvestment.replace(/,/g, "")) || 0,
                grossSales: parseFloat(formData.grossSales.replace(/,/g, "")) || 0,
                employeeCount: isNaN(parseInt(formData.employeeCount)) ? 0 : parseInt(formData.employeeCount),
                businessArea: parseFloat(formData.businessArea) || 0,
                fulfillmentType: null,
                deliveryAddress: null,
                deliveryPhone: null,
                tinNumber: formData.tinNumber,
                philhealthNumber: formData.philhealthNumber,
                pagibigNumber: formData.pagibigNumber,
                sssNumber: formData.sssNumber,
                businessBranch: formData.businessBranch,
                registrationType: formData.registrationType,
                dtiSecDate: formData.dtiSecDate,
                ctcUrl,
                dtiSecUrl,
                brgyClearanceUrl,
                ownerIdUrl,
                locationPhotoUrl,
                sanitaryPermitUrl,
                fireSafetyUrl,
                birCorUrl,
                previousPermitUrl
            }));

            // Console log payload sizes to help debug
            console.log("=== SUBMIT PAYLOAD DIAGNOSTICS ===");
            for (const [key, value] of (submitData as any).entries()) {
                if (typeof value === "string") {
                    console.log(`Key: ${key}, Length: ${value.length} chars (approx ${(value.length / 1024).toFixed(2)} KB)`);
                } else {
                    console.log(`Key: ${key}, File: ${value.name}, Size: ${(value.size / 1024 / 1024).toFixed(2)} MB`);
                }
            }

            // No files appended to FormData payload to bypass Vercel incoming payload limit!
            const res = await submitBusinessPermitTransaction(submitData);
            if (res.success) {
                clearDraft(); // Purge draft upon successful submission
                toast.success("Business Permit application submitted successfully!", { id: "bp-upload-toast" });
                router.push("/dashboard");
            } else {
                toast.error(res.error || "Submission failed. Please check inputs.", { id: "bp-upload-toast" });
            }
        } catch (err) {
            console.error("Submit error:", err);
            toast.error("An error occurred during submission.", { id: "bp-upload-toast" });
        } finally {
            setSubmitting(false);
        }
    };

    // --- UI LOADING STATE ---
    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 italic animate-pulse">Synchronizing Business Portal...</p>
            </div>
        );
    }

    // --- 3-STRIKE REJECTION BLOCK RENDER ---
    if (isSuspended) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8 pb-32">
                <div className="w-24 h-24 bg-red-500/10 border-2 border-red-500 rounded-[2rem] flex items-center justify-center mx-auto text-red-500 shadow-xl shadow-red-500/15">
                    <ShieldAlert className="w-10 h-10" />
                </div>
                <div className="space-y-4">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Portal Suspended</h1>
                    <div className="max-w-xl mx-auto p-6 bg-red-500/5 dark:bg-red-500/10 rounded-3xl border border-red-500/30 text-slate-600 dark:text-slate-300 font-bold text-sm leading-relaxed italic">
                        &quot;Your account has been suspended from submitting online applications due to acquiring 3 rejection strikes on your permit filings. To comply, please apply onsite directly at the Business Permit Department inside the Municipal Hall.&quot;
                    </div>
                </div>
                <div className="pt-6">
                    <Link href="/">
                        <Button className="rounded-full px-12 py-5 font-black uppercase tracking-widest text-[10px] border-2 bg-slate-900 text-white dark:bg-white dark:text-slate-950 transition-all hover:opacity-90">
                            Return Home
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="h-full max-w-5xl mx-auto overflow-y-auto overscroll-y-contain touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4 sm:px-6 py-8 space-y-12 pb-32 font-sans relative">
                <div className="space-y-4 md:space-y-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 px-1 md:px-0">
                        <div className="space-y-1 md:space-y-2">
                            <h1 className="text-4xl md:text-7xl font-black text-white uppercase italic tracking-tighter leading-none select-none">
                                BUSINESS <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">PERMIT</span>
                            </h1>
                            <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">Streamlined Permitting & Compliance Portal</p>
                        </div>
                    </div>
                </div>

                {/* Progress Stepper */}
                <div className="grid grid-cols-5 gap-1.5 md:gap-4 relative px-1 md:px-2">
                    {STEPS.map((step, idx) => {
                        const isActive = currentStep === step.id;
                        const isCompleted = STEPS.findIndex(s => s.id === currentStep) > idx;
                        const Icon = step.icon;
                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    if (step.id === "PATHWAY" && revisionId) return; // Completely block tab navigation
                                    if (canNavigate(step.id)) {
                                        setCurrentStep(step.id);
                                    } else {
                                        handleNext();
                                    }
                                }}
                                className={cn(
                                    "flex flex-col items-center gap-2 md:gap-3 relative z-10 font-black cursor-pointer group",
                                    (!canNavigate(step.id) && !isActive) && "cursor-not-allowed opacity-50"
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
                                    "text-[7px] md:text-[10px] uppercase tracking-widest text-center italic hidden sm:block",
                                    isActive ? "text-theme-primary opacity-100 font-black" : "opacity-40 group-hover:opacity-100 transition-opacity"
                                )}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Secure Idle Inactivity Timer */}
                <SecureIdleTimer />



                {/* Step Content */}
                <div className="mt-4 md:mt-8 md:bg-white md:dark:bg-[#11131a] md:rounded-[2.5rem] md:border md:border-slate-200 md:dark:border-white/10 p-0 md:p-12 md:shadow-2xl relative md:overflow-hidden group/container min-h-[400px] md:min-h-[500px] flex flex-col">
                    <div className="flex-1">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.4 }}
                            >
                                {/* STEP 1: PATHWAY SELECTOR */}
                                {currentStep === "PATHWAY" && (
                                    <div className="space-y-8 md:space-y-12">
                                        <div className="space-y-3 md:space-y-4 text-center">
                                            <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">Choose Application <span className="text-primary italic">Pathway</span></h2>
                                            <p className="text-slate-500 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto">Select your current business permit status to proceed.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-4xl mx-auto">
                                            {[
                                                {
                                                    id: "NEW",
                                                    code: "BUSINESS_PERMIT_NEW",
                                                    icon: Sparkles
                                                },
                                                {
                                                    id: "RENEWAL",
                                                    code: "BUSINESS_PERMIT_RENEW",
                                                    icon: TrendingUp
                                                }
                                            ].map(opt => {
                                                const matchedType = bpTypes.find((t: any) => t.code === opt.code);
                                                const label = matchedType?.name || (opt.id === "NEW" ? "New Business Permit" : "Permit Renewal");
                                                const desc = matchedType?.description || (opt.id === "NEW"
                                                    ? "For newly registered businesses in this municipality. Based on initial declared capitalization investment."
                                                    : "For existing businesses renewing for the current year. Calculated on previous annual gross receipts/sales.");

                                                const Icon = opt.icon;
                                                const isSelected = formData.businessType === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => {
                                                            if (opt.id === "NEW" && hasActiveNewPermit && !revisionId) {
                                                                toast.error("You already have an active New Business Permit request in progress.");
                                                                return;
                                                            }
                                                            if (opt.id === "RENEWAL" && hasActiveRenewPermit && !revisionId) {
                                                                toast.error("You already have an active Business Permit Renewal request in progress.");
                                                                return;
                                                            }
                                                            if (opt.id === "RENEWAL" && previousPermits.length > 0) {
                                                                setShowRenewalModal(true);
                                                            } else {
                                                                handleInputChange("businessType", opt.id as any);
                                                                setIsAutofilledFromPrevious(false);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "p-6 md:p-10 rounded-2xl md:rounded-[3rem] border-2 md:border-4 transition-all duration-500 text-left relative group select-none overflow-hidden h-[240px] md:h-[300px] flex flex-col justify-between",
                                                            isSelected
                                                                ? "bg-theme-primary text-white border-theme-primary shadow-2xl shadow-theme-primary/20 scale-[1.02]"
                                                                : "bg-theme-light dark:bg-theme-dark/20 backdrop-blur-md border-theme-primary/15 dark:border-theme-primary/20 hover:border-theme-primary/50 hover:bg-theme-light dark:hover:bg-theme-hover/30"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-[2rem] flex items-center justify-center transition-transform group-hover:scale-110",
                                                            isSelected ? "bg-white/20 text-white" : "bg-theme-primary/10 text-theme-primary"
                                                        )}>
                                                            <Icon className={cn("w-6 h-6 md:w-10 md:h-10", isSelected ? "animate-pulse text-white" : "text-theme-primary")} />
                                                        </div>
                                                        <div className="space-y-1 md:space-y-2 relative z-10">
                                                            <h4 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">
                                                                {label}
                                                            </h4>
                                                            <p className={cn("text-[9px] md:text-[11px] font-bold uppercase italic tracking-widest leading-relaxed", isSelected ? "text-white/70" : "text-slate-500 dark:text-slate-300")}>
                                                                {desc}
                                                            </p>
                                                        </div>
                                                        {isSelected && (
                                                            <motion.div layoutId="check" className="absolute top-6 right-6 md:top-8 md:right-8 w-8 h-8 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center text-theme-primary shadow-xl">
                                                                <Check className="w-4 h-4 md:w-6 md:h-6 stroke-[4]" />
                                                            </motion.div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: USER PROFILE REVIEW */}
                                {currentStep === "USER_IDENTITY" && (
                                    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="space-y-1">
                                            <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                                Identity <span className="text-primary italic">Confirmation</span>
                                            </h2>
                                            <p className="text-[10px] md:text-xs text-slate-500 font-medium italic">
                                                Verify and refine your personal records for this certificate.
                                            </p>
                                        </div>

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

                                        <div className="space-y-4 md:space-y-6">
                                            {/* Row 1: Names */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name</Label>
                                                    <Input
                                                        id="resident-firstName"
                                                        value={formData.residentData?.firstName || ""}
                                                        readOnly={true}
                                                        className={cn(
                                                            "h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400",
                                                            showValidationErrors && !formData.residentData?.firstName && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                        )}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Middle Name</Label>
                                                    <Input
                                                        value={formData.residentData?.middleName || ""}
                                                        readOnly={true}
                                                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Name</Label>
                                                    <Input
                                                        id="resident-lastName"
                                                        value={formData.residentData?.lastName || ""}
                                                        readOnly={true}
                                                        className={cn(
                                                            "h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400",
                                                            showValidationErrors && !formData.residentData?.lastName && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                        )}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Suffix</Label>
                                                    <Input
                                                        value={formData.residentData?.suffix || ""}
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
                                                        id="resident-dateOfBirth"
                                                        type="date"
                                                        value={formData.residentData?.dateOfBirth ? new Date(formData.residentData.dateOfBirth).toISOString().split('T')[0] : ""}
                                                        readOnly={true}
                                                        className={cn(
                                                            "h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400",
                                                            showValidationErrors && !formData.residentData?.dateOfBirth && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                        )}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Age</Label>
                                                    <Input
                                                        value={(() => {
                                                            if (!formData.residentData?.dateOfBirth) return "";
                                                            const today = new Date();
                                                            const birthDate = new Date(formData.residentData.dateOfBirth);
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
                                                        value={formData.residentData?.civilStatus || ""}
                                                        readOnly
                                                        className="h-10 rounded-xl bg-slate-50 border-slate-200 text-slate-400 font-bold text-xs md:text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Citizenship</Label>
                                                    <Input
                                                        value={formData.residentData?.citizenship || ""}
                                                        readOnly={true}
                                                        className="h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 3: Contact & Occupation */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Occupation</Label>
                                                    <div className="relative">
                                                        <Input
                                                            id="resident-occupation"
                                                            value={formData.residentData?.occupation || ""}
                                                            readOnly={true}
                                                            className={cn(
                                                                "h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm bg-slate-50 text-slate-400",
                                                                showValidationErrors && !formData.residentData?.occupation && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Number</Label>
                                                    <Input
                                                        id="resident-contactNumber"
                                                        ref={contactInputRef}
                                                        value={formData.residentData?.contactNumber || ""}
                                                        onChange={(e) => {
                                                            const cleanVal = e.target.value.replace(/[^0-9+]/g, "");
                                                            setFormData(p => ({
                                                                ...p,
                                                                residentData: {
                                                                    ...p.residentData,
                                                                    contactNumber: cleanVal
                                                                }
                                                            }));
                                                        }}
                                                        className={cn(
                                                            "h-10 rounded-xl border-slate-200 shadow-sm text-xs md:text-sm",
                                                            showValidationErrors && !formData.residentData?.contactNumber && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                        )}
                                                        placeholder="09xx xxx xxxx"
                                                    />
                                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-wider ml-1 animate-pulse">
                                                        * Note: Please use your active contact number. This will be used to contact you regarding your transaction.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>


                                        <div className="bg-primary/5 border border-primary/10 p-3 md:p-4 rounded-2xl md:rounded-3xl flex items-center gap-2 md:gap-3">
                                            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <p className="text-[8px] md:text-[10px] text-primary font-black italic leading-tight uppercase tracking-widest">
                                                Note: Changes will update your Resident Profile upon submission.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: PROFILE FORMS */}
                                {currentStep === "PROFILE" && (
                                    <div className="space-y-8">
                                        <div className="border-b border-slate-100 dark:border-white/5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-black uppercase italic text-slate-900 dark:text-white tracking-tighter flex items-center gap-2">
                                                    Business Details
                                                </h2>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Provide legal and financial registration metrics</p>
                                            </div>
                                        </div>

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

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Official Business Name (DTI/SEC) <span className="text-rose-500 ml-0.5">*</span></Label>
                                                <div className="relative">
                                                    <Input
                                                        id="profile-businessName"
                                                        type="text"
                                                        value={formData.businessName}
                                                        onChange={e => handleInputChange("businessName", e.target.value)}
                                                        placeholder="e.g. City Express Café Inc."
                                                        readOnly={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 transition-all duration-200",
                                                            showValidationErrors && !formData.businessName && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 focus-visible:ring-primary/10 cursor-not-allowed select-none"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Trade / Signage Name</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        value={formData.tradeName}
                                                        onChange={e => handleInputChange("tradeName", e.target.value)}
                                                        placeholder="e.g. City Express Café"
                                                        readOnly={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 transition-all duration-200",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 focus-visible:ring-primary/10 cursor-not-allowed select-none"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Organization Type <span className="text-rose-500 ml-0.5">*</span></Label>
                                                <div className="relative">
                                                    <select
                                                        id="profile-orgType"
                                                        value={formData.orgType}
                                                        onChange={e => handleInputChange("orgType", e.target.value)}
                                                        disabled={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "w-full appearance-none rounded-xl h-12 border border-slate-200 dark:border-white bg-white dark:bg-[#0c0d12]/50 px-4 pr-10 text-xs md:text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all cursor-pointer shadow-sm hover:border-slate-300 dark:hover:border-white/20",
                                                            showValidationErrors && !formData.orgType && "border-red-500 ring-2 ring-red-500/20 dark:border-red-500/50",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                        )}
                                                    >
                                                        <option value="SOLE_PROPRIETORSHIP" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">Sole Proprietorship</option>
                                                        <option value="PARTNERSHIP" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">Partnership</option>
                                                        <option value="CORPORATION" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">Corporation</option>
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <ChevronDown className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Business Barangay Location <span className="text-rose-500 ml-0.5">*</span></Label>
                                                <div className="relative">
                                                    <select
                                                        id="profile-barangay"
                                                        value={formData.barangay}
                                                        onChange={e => handleInputChange("barangay", e.target.value)}
                                                        disabled={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "w-full appearance-none rounded-xl h-12 border border-slate-200 dark:border-white bg-white dark:bg-[#0c0d12]/50 px-4 pr-10 text-xs md:text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all cursor-pointer shadow-sm hover:border-slate-300 dark:hover:border-white/20",
                                                            showValidationErrors && !formData.barangay && "border-red-500 ring-2 ring-red-500/20 dark:border-red-500/50",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                        )}
                                                    >
                                                        <option value="" disabled className="dark:bg-[#0c0d12] text-slate-400">Select Barangay...</option>
                                                        {(dbBarangays.length > 0 ? dbBarangays : DEFAULT_BARANGAYS).map((b) => (
                                                            <option key={b} value={b} className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">{b}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <ChevronDown className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Building / House No. / Unit</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        value={formData.building}
                                                        onChange={e => handleInputChange("building", e.target.value)}
                                                        placeholder="e.g. Bldg 4A, Green Meadows (Optional)"
                                                        readOnly={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 transition-all duration-200",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Street Address</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        value={formData.street}
                                                        onChange={e => handleInputChange("street", e.target.value)}
                                                        placeholder="e.g. Rizal Avenue (Optional)"
                                                        readOnly={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 transition-all duration-200",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Line of Business / Classification <span className="text-rose-500 ml-0.5">*</span></Label>
                                                {isAutofilledFromPrevious ? (
                                                    <div className="relative animate-in fade-in duration-200">
                                                        <Input
                                                            type="text"
                                                            value={formData.lineOfBusiness}
                                                            readOnly
                                                            className="rounded-xl h-12 border-slate-200 bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none font-bold text-xs md:text-sm"
                                                        />
                                                    </div>
                                                ) : !isOtherLine ? (
                                                    <div className="relative">
                                                        <select
                                                            id="profile-lineOfBusiness-select"
                                                            value={formData.lineOfBusiness || ""}
                                                            onChange={e => handleLineOfBusinessSelect(e.target.value)}
                                                            className={cn(
                                                                "w-full appearance-none rounded-xl h-12 border border-slate-200 dark:border-white bg-white dark:bg-[#0c0d12]/50 px-4 pr-10 text-xs md:text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all cursor-pointer shadow-sm hover:border-slate-300 dark:hover:border-white/20",
                                                                showValidationErrors && !formData.lineOfBusiness && "border-red-500 ring-2 ring-red-500/20 dark:border-red-500/50"
                                                            )}
                                                        >
                                                            <option value="" disabled className="dark:bg-[#0c0d12] text-slate-400">Select Line of Business...</option>
                                                            {LINE_OF_BUSINESS_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt} className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">{opt}</option>
                                                            ))}
                                                            <option value="Other" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">Other...</option>
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                            <ChevronDown className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="relative animate-in fade-in zoom-in-95 duration-200">
                                                        <Input
                                                            id="profile-lineOfBusiness"
                                                            type="text"
                                                            value={formData.lineOfBusiness}
                                                            onChange={e => handleInputChange("lineOfBusiness", e.target.value)}
                                                            placeholder="Enter your custom line of business..."
                                                            className={cn(
                                                                "rounded-xl h-12 border-slate-200 pr-10 font-bold",
                                                                showValidationErrors && !formData.lineOfBusiness && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                            )}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsOtherLine(false);
                                                                handleInputChange("lineOfBusiness", "");
                                                            }}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-all select-none"
                                                            title="Back to dropdown options"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Employee Count</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={formData.employeeCount}
                                                        onChange={e => handleInputChange("employeeCount", e.target.value)}
                                                        min="0"
                                                        readOnly={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 transition-all duration-200",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Store Area (in Sqm)</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={formData.businessArea}
                                                        onChange={e => handleInputChange("businessArea", e.target.value)}
                                                        placeholder="e.g. 120"
                                                        readOnly={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 transition-all duration-200",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            {formData.businessType === "NEW" ? (
                                                <div className="space-y-2 relative animate-in fade-in duration-200">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Initial Capitalization (₱) <span className="text-rose-500 ml-0.5">*</span></Label>
                                                    <Input
                                                        id="profile-capitalInvestment"
                                                        type="text"
                                                        value={formData.capitalInvestment}
                                                        onChange={e => {
                                                            const cleanVal = e.target.value.replace(/[^0-9.,]/g, "");
                                                            handleInputChange("capitalInvestment", cleanVal);
                                                        }}
                                                        placeholder="e.g. 250,000"
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 pr-12 font-mono font-bold",
                                                            showValidationErrors && !formData.capitalInvestment && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                        )}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-2 relative animate-in fade-in duration-200">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Annual Gross Sales In The Previous Year (₱) <span className="text-rose-500 ml-0.5">*</span></Label>
                                                    <Input
                                                        id="profile-grossSales"
                                                        type="text"
                                                        value={formData.grossSales}
                                                        onChange={e => {
                                                            const cleanVal = e.target.value.replace(/[^0-9.,]/g, "");
                                                            handleInputChange("grossSales", cleanVal);
                                                        }}
                                                        placeholder="e.g. 1,200,000"
                                                        className={cn(
                                                            "rounded-xl h-12 border-slate-200 pr-12 font-mono font-bold",
                                                            showValidationErrors && !formData.grossSales && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                        )}
                                                    />
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Branch of Business <span className="text-rose-500 ml-0.5">*</span></Label>
                                                <div className="relative">
                                                    <select
                                                        id="profile-businessBranch"
                                                        value={formData.businessBranch}
                                                        onChange={e => handleInputChange("businessBranch", e.target.value)}
                                                        disabled={isAutofilledFromPrevious}
                                                        className={cn(
                                                            "w-full appearance-none rounded-xl h-12 border border-slate-200 dark:border-white bg-white dark:bg-[#0c0d12]/50 px-4 pr-10 text-xs md:text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all cursor-pointer shadow-sm hover:border-slate-300 dark:hover:border-white/20",
                                                            showValidationErrors && !formData.businessBranch && "border-red-500 ring-2 ring-red-500/20 dark:border-red-500/50",
                                                            isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                        )}
                                                    >
                                                        <option value="MAIN" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">Main</option>
                                                        <option value="BRANCH" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">Branch</option>
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <ChevronDown className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">TIN No. of the Business <span className="text-rose-500 ml-0.5">*</span></Label>
                                                <Input
                                                    id="profile-tinNumber"
                                                    type="text"
                                                    value={formData.tinNumber}
                                                    onChange={e => handleInputChange("tinNumber", e.target.value)}
                                                    placeholder="e.g. 123-456-789-000"
                                                    readOnly={isAutofilledFromPrevious}
                                                    className={cn(
                                                        "rounded-xl h-12 border-slate-200 font-bold",
                                                        showValidationErrors && !formData.tinNumber && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50",
                                                        isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                    )}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">PhilHealth Number <span className="text-slate-400 font-normal ml-1">(Optional)</span></Label>
                                                <Input
                                                    type="text"
                                                    value={formData.philhealthNumber}
                                                    onChange={e => handleInputChange("philhealthNumber", e.target.value)}
                                                    placeholder="e.g. 12-345678901-2"
                                                    readOnly={isAutofilledFromPrevious}
                                                    className={cn(
                                                        "rounded-xl h-12 border-slate-200 font-bold",
                                                        isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                    )}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Pag-Ibig MID Number <span className="text-slate-400 font-normal ml-1">(Optional)</span></Label>
                                                <Input
                                                    type="text"
                                                    value={formData.pagibigNumber}
                                                    onChange={e => handleInputChange("pagibigNumber", e.target.value)}
                                                    placeholder="e.g. 1234-5678-9012"
                                                    readOnly={isAutofilledFromPrevious}
                                                    className={cn(
                                                        "rounded-xl h-12 border-slate-200 font-bold",
                                                        isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                    )}
                                                />
                                            </div>

                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">SSS Number <span className="text-slate-400 font-normal ml-1">(Optional)</span></Label>
                                                <Input
                                                    type="text"
                                                    value={formData.sssNumber}
                                                    onChange={e => handleInputChange("sssNumber", e.target.value)}
                                                    placeholder="e.g. 12-3456789-0"
                                                    readOnly={isAutofilledFromPrevious}
                                                    className={cn(
                                                        "rounded-xl h-12 border-slate-200 font-bold",
                                                        isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                    )}
                                                />
                                            </div>

                                            {/* Pathway Specific Inputs */}
                                            {formData.businessType === "NEW" ? (
                                                <div className="space-y-2 col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Registration Type <span className="text-rose-500 ml-0.5">*</span></Label>
                                                        <div className="relative">
                                                            <select
                                                                value={formData.registrationType}
                                                                onChange={e => handleInputChange("registrationType", e.target.value)}
                                                                className={cn(
                                                                    "w-full appearance-none rounded-xl h-12 border border-slate-200 dark:border-white bg-white dark:bg-[#0c0d12]/50 px-4 pr-10 text-xs md:text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all cursor-pointer shadow-sm hover:border-slate-300 dark:hover:border-white/20",
                                                                    showValidationErrors && !formData.registrationType && "border-red-500 ring-2 ring-red-500/20 dark:border-red-500/50"
                                                                )}
                                                            >
                                                                <option value="DTI" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">DTI</option>
                                                                <option value="SEC" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">SEC</option>
                                                                <option value="COA" className="dark:bg-[#0c0d12] text-slate-900 dark:text-white font-bold">COA</option>
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                                <ChevronDown className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">{formData.registrationType} Registration Number <span className="text-rose-500 ml-0.5">*</span></Label>
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsDtiGuideOpen(true)}
                                                                className="text-slate-400 hover:text-primary transition-all p-0.5 shrink-0"
                                                                title="Click for registration guide"
                                                            >
                                                                <HelpCircle className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <Input
                                                            id="profile-dtiSecNumber"
                                                            type="text"
                                                            value={formData.dtiSecNumber}
                                                            onChange={e => handleInputChange("dtiSecNumber", e.target.value)}
                                                            placeholder={`e.g. ${formData.registrationType === "DTI" ? "DTI-123456789" : formData.registrationType === "SEC" ? "SEC-CS202012345" : "COA-987654"}`}
                                                            className={cn(
                                                                "rounded-xl h-12 border-slate-200 font-bold",
                                                                showValidationErrors && !formData.dtiSecNumber && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">{formData.registrationType} Registration Date <span className="text-rose-500 ml-0.5">*</span></Label>
                                                        <Input
                                                            id="profile-dtiSecDate"
                                                            type="date"
                                                            value={formData.dtiSecDate}
                                                            onChange={e => handleInputChange("dtiSecDate", e.target.value)}
                                                            className={cn(
                                                                "rounded-xl h-12 border-slate-200 font-bold",
                                                                showValidationErrors && !formData.dtiSecDate && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50"
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2 col-span-1 md:col-span-2 animate-in fade-in duration-200">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic">Existing Permit License Number <span className="text-rose-500 ml-0.5">*</span></Label>
                                                    <div className="relative">
                                                        <Input
                                                            id="profile-permitNumber"
                                                            type="text"
                                                            value={formData.permitNumber}
                                                            onChange={e => handleInputChange("permitNumber", e.target.value)}
                                                            placeholder="e.g. MP-2025-0816"
                                                            readOnly={isAutofilledFromPrevious}
                                                            className={cn(
                                                                "rounded-xl h-12 border-slate-200 font-bold transition-all duration-200",
                                                                showValidationErrors && !formData.permitNumber && "border-red-500 focus-visible:ring-red-500/20 dark:border-red-500/50",
                                                                isAutofilledFromPrevious && "bg-primary/[0.03] dark:bg-primary/[0.02] border-primary/25 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>


                                    </div>
                                )}

                                {/* STEP 3: FILE UPLOAD CHECKLIST DROPS */}
                                {currentStep === "CHECKLIST" && (
                                    <div className="space-y-8">
                                        <div className="border-b border-slate-100 dark:border-white/5 pb-4">
                                            <h2 className="text-2xl font-black uppercase italic text-slate-900 dark:text-white tracking-tighter">Required Document Checklist</h2>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Provide the required legal registrations and clearances to complete your submission</p>

                                            <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-amber-500 animate-in fade-in duration-300">
                                                <ShieldAlert className="w-5 h-5 shrink-0 animate-pulse" />
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase tracking-wider italic">Notice for Multiple Pages/Images</p>
                                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">If your document has more than 1 image/page, please compile them into a single PDF file before uploading.</p>
                                                </div>
                                            </div>
                                        </div>

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

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            {((formData.businessType === "NEW"
                                                ? [
                                                    { label: "1. Owner's Valid ID", field: "ownerIdFile" },
                                                    { label: "2. Community Tax Certificate (CTC/Cedula)", field: "ctcFile" },
                                                    { label: "3. DTI / SEC / COA Registration", field: "dtiSecFile" },
                                                    { label: "4. BIR Certificate of Registration (COR)", field: "birCorFile", optional: true },
                                                    { label: "5. Barangay Clearance", field: "brgyClearanceFile" },
                                                    { label: "6. Location Photo of Business", field: "locationPhotoFile", optional: true },
                                                    { label: "7. Sanitary Permit", field: "sanitaryPermitFile" },
                                                    { label: "8. Fire Safety Inspection Certificate", field: "fireSafetyFile" }
                                                ]
                                                : [
                                                    { label: "1. Owner's Valid ID", field: "ownerIdFile" },
                                                    { label: "2. Community Tax Certificate (CTC/Cedula)", field: "ctcFile" },
                                                    { label: "3. DTI / SEC / COA Registration", field: "dtiSecFile" },
                                                    { label: "4. BIR Certificate of Registration (COR)", field: "birCorFile", optional: true },
                                                    { label: "5. Previous Business Permit", field: "previousPermitFile" }
                                                ]
                                            ) as { label: string; field: string; optional?: boolean }[]).map(item => {
                                                const file = formData[item.field as keyof FormState] as File | null;
                                                return (
                                                    <div key={item.field} id={`upload-card-${item.field}`} className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 italic flex items-center">
                                                                <span>{item.label}</span>
                                                                {!item.optional && <span className="text-rose-500 ml-0.5">*</span>}
                                                                {STEP_BY_STEP_GUIDES[item.field] && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setActiveGuideKey(item.field)}
                                                                        className="ml-1.5 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-primary transition-all shrink-0"
                                                                        title="View step-by-step guide"
                                                                    >
                                                                        <HelpCircle className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </Label>
                                                            {item.optional && (
                                                                <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase italic">
                                                                    (optional)
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className={cn(
                                                            "p-4 md:p-5 bg-slate-50/50 dark:bg-white/[0.02] rounded-3xl border border-dashed flex flex-col gap-4 relative overflow-hidden transition-all duration-300 hover:border-primary/40 shadow-sm",
                                                            (file || (item.field === "ownerIdFile" && formData.residentData?.idFrontUrl) || revisionTx?.additionalData?.[`${item.field.replace("File", "Url")}`])
                                                                ? "border-primary dark:border-primary/30 bg-primary/[0.01]"
                                                                : "border-slate-200 dark:border-white/10"
                                                        )}>
                                                            <div className="flex items-center gap-3.5 w-full text-left">
                                                                <div className={cn(
                                                                    "w-11 h-11 bg-white dark:bg-black/20 border rounded-xl flex items-center justify-center shadow-sm shrink-0",
                                                                    (file || (item.field === "ownerIdFile" && formData.residentData?.idFrontUrl) || revisionTx?.additionalData?.[`${item.field.replace("File", "Url")}`]) ? "border-primary/20 dark:border-primary/20 text-primary" : "border-slate-100 dark:border-white/5 text-primary"
                                                                )}>
                                                                    <Upload className={cn("w-4 h-4", (file || (item.field === "ownerIdFile" && formData.residentData?.idFrontUrl) || revisionTx?.additionalData?.[`${item.field.replace("File", "Url")}`]) && "animate-bounce")} />
                                                                </div>
                                                                <div className="space-y-0.5 min-w-0">
                                                                    <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-white italic truncate pr-2">
                                                                        {item.label.replace(/^\d+\.\s*/, "")}
                                                                    </h4>
                                                                    <p className="text-[8px] md:text-[9px] text-slate-400 font-bold italic uppercase tracking-tighter truncate">
                                                                        {file
                                                                            ? `Uploaded (${(file.size / 1024).toFixed(1)} KB)`
                                                                            : revisionTx?.additionalData?.[`${item.field.replace("File", "Url")}`]
                                                                                ? "Verified Revision Draft"
                                                                                : (item.field === "ownerIdFile" && formData.residentData?.idFrontUrl)
                                                                                    ? "Preloaded from Resident Profile"
                                                                                    : (item.optional ? "PDF / IMAGE (OPTIONAL)" : "PDF / IMAGE (MAX 5MB)")}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Live File Preview Card for Images/PDFs or Preloaded Identity Card */}
                                                            {file ? (
                                                                <FilePreview file={file} onClick={() => openViewer(file, null, item.label)} />
                                                            ) : revisionTx?.additionalData?.[`${item.field.replace("File", "Url")}`] ? (
                                                                String(revisionTx.additionalData[`${item.field.replace("File", "Url")}`]).toLowerCase().includes('.pdf') ? (
                                                                    <div
                                                                        onClick={() => openViewer(null, revisionTx.additionalData[`${item.field.replace("File", "Url")}`] as string, item.label)}
                                                                        className="w-full py-4 px-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mt-3 flex items-center justify-between gap-2.5 animate-in fade-in duration-200 cursor-pointer group/pdf hover:border-emerald-500/30 transition-all"
                                                                    >
                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                                                                                PDF
                                                                            </div>
                                                                            <div className="truncate text-left">
                                                                                <span className="block text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate font-mono">View PDF Document</span>
                                                                                <span className="block text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Active Revision File</span>
                                                                            </div>
                                                                        </div>
                                                                        <Eye className="w-4 h-4 text-emerald-500/70 group-hover/pdf:text-emerald-600 transition-colors shrink-0 mr-1" />
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        onClick={() => openViewer(null, revisionTx.additionalData[`${item.field.replace("File", "Url")}`] as string, item.label)}
                                                                        className="relative w-full h-36 rounded-xl overflow-hidden mt-3 border border-slate-100 dark:border-white/10 shadow-inner bg-slate-50 dark:bg-black/20 flex items-center justify-center group/preview animate-in fade-in zoom-in-95 duration-200 cursor-pointer"
                                                                    >
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img
                                                                            src={revisionTx.additionalData[`${item.field.replace("File", "Url")}`] as string}
                                                                            alt="Revision Document Preview"
                                                                            className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-300"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                            <span className="text-[10px] text-white font-black uppercase tracking-widest bg-black/60 px-3.5 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 hover:bg-black/80 transition-colors">
                                                                                <Eye className="w-3.5 h-3.5" />
                                                                                CLICK TO VIEW FULL SIZE
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            ) : (item.field === "ownerIdFile" && formData.residentData?.idFrontUrl) ? (
                                                                <div
                                                                    onClick={() => openViewer(null, formData.residentData?.idFrontUrl as string, item.label)}
                                                                    className="relative rounded-2xl overflow-hidden border border-slate-100 dark:border-white/5 bg-slate-100 dark:bg-black/30 h-28 flex items-center justify-center group/preview cursor-pointer"
                                                                >
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src={formData.residentData?.idFrontUrl}
                                                                        alt="Preloaded ID Front"
                                                                        className="object-cover w-full h-full group-hover/preview:scale-105 transition-transform duration-300"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                        <span className="text-[10px] text-white font-black uppercase tracking-widest bg-black/60 px-3.5 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 hover:bg-black/80 transition-colors">
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                            CLICK TO VIEW FULL SIZE
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            <div className="flex items-center justify-between w-full mt-1">
                                                                <div className="flex gap-2 w-full">
                                                                    <Button
                                                                        type="button"
                                                                        onClick={() => startHandoff(item.field)}
                                                                        disabled={isCreatingHandoff}
                                                                        className="flex-1 font-black italic uppercase tracking-widest text-[9px] sm:text-xs h-10 rounded-2xl transition-all select-none bg-theme-primary hover:bg-[#155b31] text-white shadow-md active:scale-[0.98]"
                                                                    >
                                                                        {isCreatingHandoff
                                                                            ? "QR..."
                                                                            : (file || (item.field === "ownerIdFile" && formData.residentData?.idFrontUrl) || revisionTx?.additionalData?.[`${item.field.replace("File", "Url")}`])
                                                                                ? "Re-upload QR"
                                                                                : "QR Upload"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* STEP 4: FINAL REVIEWS & FULFILLMENT */}
                                {currentStep === "SUBMIT" && (
                                    <div className="space-y-8">
                                        <div className="border-b border-slate-100 dark:border-white/5 pb-4">
                                            <h2 className="text-2xl font-black uppercase italic text-slate-900 dark:text-white tracking-tighter">Final Assessment & Submission</h2>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Review your assessed bill and confirm your permit request</p>
                                        </div>

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

                                        <div className="grid grid-cols-1 gap-8">
                                            {/* Column A: Summary & Declarations */}
                                            <div className="space-y-6">
                                                <div className="p-6 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-3xl space-y-4">
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white italic">Filing Summary Review</h3>
                                                    <div className="space-y-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                        <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                            <span>Official Name</span>
                                                            <span className="text-slate-900 dark:text-white font-mono text-right truncate max-w-[200px]">{formData.businessName}</span>
                                                        </div>
                                                        {formData.tradeName && (
                                                            <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                                <span>Trade Name</span>
                                                                <span className="text-slate-900 dark:text-white font-mono text-right truncate max-w-[200px]">{formData.tradeName}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                            <span>Org Type</span>
                                                            <span className="text-slate-900 dark:text-white font-mono text-right capitalize">
                                                                {formData.orgType.toLowerCase().replace(/_/g, " ")}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2 gap-4">
                                                            <span className="shrink-0">Location Address</span>
                                                            <span className="text-slate-900 dark:text-white font-mono text-right">
                                                                {[formData.building, formData.street, formData.barangay].filter(Boolean).join(", ")}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                            <span>Line of Business</span>
                                                            <span className="text-slate-900 dark:text-white font-mono text-right truncate max-w-[200px]">{formData.lineOfBusiness}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                            <span>Branch Type</span>
                                                            <span className="text-slate-900 dark:text-white font-mono text-right capitalize">
                                                                {formData.businessBranch.toLowerCase()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                            <span>TIN Number</span>
                                                            <span className="text-slate-900 dark:text-white font-mono text-right">
                                                                {formData.tinNumber}
                                                            </span>
                                                        </div>
                                                        {formData.philhealthNumber && (
                                                            <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                                <span>PhilHealth Number</span>
                                                                <span className="text-slate-900 dark:text-white font-mono text-right">
                                                                    {formData.philhealthNumber}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {formData.pagibigNumber && (
                                                            <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                                <span>Pag-Ibig MID</span>
                                                                <span className="text-slate-900 dark:text-white font-mono text-right">
                                                                    {formData.pagibigNumber}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {formData.sssNumber && (
                                                            <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                                                                <span>SSS Number</span>
                                                                <span className="text-slate-900 dark:text-white font-mono text-right">
                                                                    {formData.sssNumber}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {formData.businessType === "NEW" ? (
                                                            <>
                                                                <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2 gap-4">
                                                                    <span className="shrink-0">{formData.registrationType} Reg. No.</span>
                                                                    <span className="text-slate-900 dark:text-white font-mono text-right break-all">
                                                                        {formData.dtiSecNumber}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2 gap-4">
                                                                    <span className="shrink-0">{formData.registrationType} Reg. Date</span>
                                                                    <span className="text-slate-900 dark:text-white font-mono text-right">
                                                                        {formData.dtiSecDate}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex justify-between border-b border-slate-200/50 dark:border-white/5 pb-2 gap-4">
                                                                <span className="shrink-0">Existing Permit No.</span>
                                                                <span className="text-slate-900 dark:text-white font-mono text-right break-all">
                                                                    {formData.permitNumber}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span>{formData.businessType === "NEW" ? "Capital Investment" : "Annual Gross Sales"}</span>
                                                            <span className="text-slate-900 dark:text-white font-mono">
                                                                ₱{formData.businessType === "NEW"
                                                                    ? (parseFloat(formData.capitalInvestment.replace(/,/g, "")) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })
                                                                    : (parseFloat(formData.grossSales.replace(/,/g, "")) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expected Fees Structure (Local Revenue Code) */}
                                                {(() => {
                                                    const selectedType = bpTypes.find((t: any) => t.id === formData.typeId);
                                                    const defaultFees = selectedType?.defaultFees;
                                                    if (!Array.isArray(defaultFees) || defaultFees.length === 0) return null;
                                                    return (
                                                        <div className="p-6 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-3xl space-y-4 animate-in fade-in duration-300">
                                                            <h3 className="text-xs font-black uppercase tracking-widest text-primary italic">Expected Fees Structure (Local Revenue Code)</h3>
                                                            <div className="space-y-3">
                                                                {defaultFees.map((fee: any, idx: number) => (
                                                                    <div key={idx} className="flex justify-between items-start text-xs font-bold text-slate-500 uppercase tracking-widest gap-4 border-b border-slate-200/50 dark:border-white/5 pb-2 last:border-0 last:pb-0">
                                                                        <span className="text-slate-700 dark:text-slate-300">{fee.label}</span>
                                                                        <span className="text-slate-900 dark:text-white font-mono text-right italic normal-case shrink-0">{fee.description}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Privacy Acceptance checkbox card */}
                                                {!revisionId && (
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
                                                            privacyAccepted ? "bg-primary/5 border-primary shadow-sm" : "bg-slate-50 dark:bg-white/[0.02] border-transparent hover:border-primary/20"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 mt-0.5",
                                                            privacyAccepted ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-white/10"
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
                                                )}
                                            </div>

                                            <div className="p-5 bg-amber-500/[0.04] border border-dashed border-amber-500/20 rounded-2xl flex items-center gap-3">
                                                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                                                    <Calculator className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Tax Assessment Pending</h4>
                                                    <p className="text-[9px] text-slate-400 font-bold italic leading-tight">Your fees will be assessed by the Municipal Treasury after your application is reviewed and approved.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Integrated Navigation Card Actions */}
                    <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-200 dark:border-white/10 flex justify-end items-center">
                        <Button
                            onClick={currentStep === "SUBMIT" ? onSubmit : handleNext}
                            disabled={submitting || (currentStep === "SUBMIT" && !isStepValid(currentStep))}
                            className="bg-theme-primary hover:bg-[#155b31] text-white shadow-xl shadow-theme-primary/20 text-[10px] md:text-xs rounded-xl md:rounded-2xl px-8 md:px-12 h-10 md:h-14 group transition-all duration-300 active:scale-95 font-black uppercase tracking-widest italic"
                        >
                            {submitting ? (
                                <div className="flex items-center">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Submitting...
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    {currentStep === "SUBMIT" ? (revisionId ? "Resubmit" : "Finalize Submission") : "Next Phase"}
                                    <ChevronRight className={cn("w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform", submitting && "hidden")} />
                                </div>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Sticky Actions */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/70 dark:bg-[#06080a]/70 backdrop-blur-2xl border-t border-slate-200 dark:border-white/10 z-50 p-2.5 flex flex-col items-center">
                    <div className="w-full max-w-5xl flex items-center justify-center gap-4">
                        <div className="h-1.5 flex-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-theme-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${((STEPS.findIndex(s => s.id === currentStep) + 1) / STEPS.length) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {handoffQrCode && handoffField && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => { setHandoffQrCode(""); setHandoffToken(""); setHandoffField(null); }}
                                className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0c0d12]"
                            >
                                <button
                                    type="button"
                                    onClick={() => { setHandoffQrCode(""); setHandoffToken(""); setHandoffField(null); }}
                                    className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                                <div className="space-y-4 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-theme-primary/10 text-theme-primary">
                                        <Upload className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                                            QR Upload
                                        </h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            {handoffField.replace(/([A-Z])/g, " $1").replace("File", "").trim()}
                                        </p>
                                    </div>
                                    <Image src={handoffQrCode} alt="Business Permit upload QR code" width={256} height={256} className="mx-auto rounded-3xl border border-slate-200 bg-white p-3 dark:border-white/10" unoptimized />
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                                        Scan with your phone to upload the file securely.
                                    </p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-theme-primary">
                                        Expires {handoffExpiresAt > 0 ? new Date(handoffExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "soon"}
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                <PrivacyTermsModal
                    isOpen={isPrivacyModalOpen}
                    onClose={() => setIsPrivacyModalOpen(false)}
                    onAccept={() => {
                        setPrivacyAccepted(true);
                        setIsPrivacyModalOpen(false);
                    }}
                    themeColor="var(--primary-theme)"
                />
                <DocumentViewerModal
                    isOpen={viewerOpen}
                    onClose={() => setViewerOpen(false)}
                    file={viewerFile}
                    fileUrl={viewerUrl}
                    title={viewerTitle}
                    themeColor="var(--primary-theme)"
                />

                {/* RENEWAL AUTOFILL CONFIRMATION MODAL */}
                <AnimatePresence>
                    {showRenewalModal && previousPermits.length > 0 && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            {/* Glass backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowRenewalModal(false)}
                                className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md"
                            />

                            {/* Modal card */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ type: "spring", duration: 0.5 }}
                                className="bg-white dark:bg-[#11131a] rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl p-6 md:p-8 max-w-lg w-full relative z-10 space-y-6 overflow-hidden"
                            >
                                {/* Decorative background gradient */}
                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-theme-primary/10 rounded-full blur-3xl pointer-events-none" />

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-theme-primary/10 rounded-2xl text-theme-primary shrink-0">
                                        <Building2 className="w-6 h-6 animate-pulse" />
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-theme-primary italic">Record Detected</span>
                                        <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                                            {previousPermits.length > 1 ? "Renew Which Business?" : "Renew Previous Business?"}
                                        </h3>
                                        <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wide italic">
                                            {previousPermits.length > 1
                                                ? "Select which of your registered businesses to renew!"
                                                : "We found your last successful business permit record!"}
                                        </p>
                                    </div>
                                </div>

                                {/* Card showing previous business details or list of businesses */}
                                {previousPermits.length === 1 ? (
                                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-4 text-left">
                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                            <div className="col-span-2 space-y-0.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Business Name</span>
                                                <span className="text-sm font-black text-slate-800 dark:text-white uppercase italic truncate block">
                                                    {previousPermits[0].additionalData?.businessName || "N/A"}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Trade Name</span>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase italic truncate block">
                                                    {previousPermits[0].additionalData?.tradeName || "N/A"}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Permit License No.</span>
                                                <span className="text-xs font-mono font-bold text-primary block">
                                                    {previousPermits[0].businessPermit?.permitNumber || previousPermits[0].additionalData?.permitNumber || previousPermits[0].id.slice(-8).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Barangay</span>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                                                    {previousPermits[0].additionalData?.barangay || "N/A"}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Line of Business</span>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block truncate font-sans">
                                                    {previousPermits[0].additionalData?.lineOfBusiness || "N/A"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-theme-light border border-theme-primary/20 rounded-xl flex items-center gap-2.5">
                                            <p className="text-[9px] text-theme-primary font-bold uppercase tracking-wider leading-relaxed">
                                                Selecting yes autofills details to guarantee municipal compliance.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 text-left">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block px-1">Choose Business to Renew</span>
                                        <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                            {previousPermits.map((permit, idx) => {
                                                const addData = permit.additionalData || {};
                                                const isSelected = selectedPermitIndex === idx;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={permit.id}
                                                        onClick={() => setSelectedPermitIndex(idx)}
                                                        className={cn(
                                                            "w-full p-4 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group select-none flex flex-col gap-1.5",
                                                            isSelected
                                                                ? "bg-theme-light dark:bg-[#10261a] border-theme-primary shadow-md"
                                                                : "bg-theme-light dark:bg-theme-dark/20 border-theme-primary/15 dark:border-theme-primary/20 hover:border-theme-primary/40 hover:bg-theme-light dark:hover:bg-theme-hover/30"
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <span className={cn("text-xs font-black uppercase italic truncate", isSelected ? "text-theme-primary" : "text-slate-800 dark:text-white")}>
                                                                {addData.businessName || "N/A"}
                                                            </span>
                                                            {isSelected && (
                                                                <div className="w-4 h-4 rounded-full bg-theme-primary flex items-center justify-center text-white shrink-0">
                                                                    <Check className="w-2.5 h-2.5 stroke-[4]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-x-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                                            <div>
                                                                <span className="text-[7px] text-slate-400 block">Trade Name</span>
                                                                <span className="text-slate-600 dark:text-slate-300 truncate block">{addData.tradeName || "N/A"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[7px] text-slate-400 block">License Permit No.</span>
                                                                <span className="text-theme-primary font-mono truncate block">{permit.businessPermit?.permitNumber || addData.permitNumber || permit.id.slice(-8).toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="p-3 bg-theme-light border border-theme-primary/20 rounded-xl flex items-center gap-2.5">
                                            <p className="text-[9px] text-theme-primary font-bold uppercase tracking-wider leading-relaxed">
                                                Selecting yes autofills details to guarantee municipal compliance.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Button
                                        onClick={handleDeclinePreviousPermit}
                                        variant="outline"
                                        className="rounded-full py-6 font-black uppercase tracking-widest text-[10px] border-theme-primary/20 text-theme-primary hover:bg-theme-light transition-all"
                                    >
                                        No, Register Different
                                    </Button>
                                    <Button
                                        onClick={handleSelectPreviousPermit}
                                        className="rounded-full py-6 font-black uppercase tracking-widest text-[10px] text-white bg-theme-primary hover:bg-[#155b31] shadow-lg shadow-theme-primary/20 transition-all"
                                    >
                                        Yes, Autofill Details
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {isDtiGuideOpen && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsDtiGuideOpen(false)}
                                className="absolute inset-0 bg-[#06070a]/80 backdrop-blur-md"
                            />

                            {/* Modal Container */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="bg-white dark:bg-[#0c0d12] border border-slate-100 dark:border-white/10 rounded-[2.5rem] w-full max-w-md sm:max-w-lg shadow-2xl relative overflow-hidden z-10 flex flex-col max-h-[85vh] sm:max-h-[80vh]"
                            >
                                {/* Top Accent line with dynamic theme color */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-1.5"
                                    style={{ background: "var(--primary-theme)" }}
                                />

                                {/* Floating Close Button */}
                                <button
                                    type="button"
                                    onClick={() => setIsDtiGuideOpen(false)}
                                    className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all z-20"
                                    title="Close guide"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                {/* Header Section */}
                                <div className="p-6 sm:p-8 pb-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-primary bg-primary/10 shrink-0">
                                            <HelpCircle className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <h3 className="text-base sm:text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">DTI & SEC Registration</h3>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                                Philippine regulatory compliance guide
                                            </p>
                                        </div>
                                    </div>

                                    {/* Custom Toggle Selector */}
                                    <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/50 dark:border-white/5 relative z-10">
                                        <button
                                            type="button"
                                            onClick={() => setDtiGuideTab("SOLE")}
                                            className={cn(
                                                "flex-1 py-2 px-3 rounded-xl text-center text-xs font-black uppercase tracking-widest transition-all select-none",
                                                dtiGuideTab === "SOLE"
                                                    ? "bg-theme-light dark:bg-[#10261a] shadow-md text-theme-primary"
                                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                            )}
                                        >
                                            Sole Proprietorship
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDtiGuideTab("CORP")}
                                            className={cn(
                                                "flex-1 py-2 px-3 rounded-xl text-center text-xs font-black uppercase tracking-widest transition-all select-none",
                                                dtiGuideTab === "CORP"
                                                    ? "bg-theme-light dark:bg-[#10261a] shadow-md text-theme-primary"
                                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                            )}
                                        >
                                            Partnership / Corp
                                        </button>
                                    </div>
                                </div>

                                {/* Body Section (Scrollable content) */}
                                <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-2 min-h-[160px] flex flex-col justify-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                    <AnimatePresence mode="wait">
                                        {dtiGuideTab === "SOLE" ? (
                                            <motion.div
                                                key="sole"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-4 w-full"
                                            >
                                                {/* Sole Proprietorship Card */}
                                                <div className="p-5 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-3xl space-y-3 shadow-inner">
                                                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white flex items-center gap-1.5">
                                                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                                        Sole Proprietorship
                                                    </h4>
                                                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-wider">
                                                        Register your trade name online using the DTI Business Name Registration System (BNRS) in just 10-15 minutes.
                                                    </p>
                                                    <div className="pt-1">
                                                        <a
                                                            href="https://bnrs.dti.gov.ph"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-extrabold"
                                                        >
                                                            Visit DTI BNRS Website <ChevronRight className="w-3.5 h-3.5" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="corp"
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-4 w-full"
                                            >
                                                {/* Partnership & Corporation Card */}
                                                <div className="p-5 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-3xl space-y-3 shadow-inner">
                                                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white flex items-center gap-1.5">
                                                        <Building2 className="w-4 h-4 text-primary animate-pulse" />
                                                        Partnership or Corporation
                                                    </h4>
                                                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-wider">
                                                        Submit your articles of incorporation and secure registration numbers through the SEC Electronic Simplified Processing System (eSPARC / CRS).
                                                    </p>
                                                    <div className="pt-1">
                                                        <a
                                                            href="https://crs.sec.gov.ph"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-extrabold"
                                                        >
                                                            Visit SEC eSPARC Portal <ChevronRight className="w-3.5 h-3.5" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Footer Section */}
                                <div className="p-6 sm:p-8 pt-4 border-t border-slate-100 dark:border-white/5">
                                    <Button
                                        onClick={() => setIsDtiGuideOpen(false)}
                                        className="w-full h-12 rounded-xl text-white font-extrabold uppercase italic tracking-widest transition-all shadow-lg active:scale-[0.98]"
                                        style={{ backgroundColor: "var(--primary-theme)" }}
                                    >
                                        Got it, thanks!
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Document Step-by-Step Guide Modal */}
                <AnimatePresence>
                    {activeGuideKey && STEP_BY_STEP_GUIDES[activeGuideKey] && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setActiveGuideKey(null)}
                                className="absolute inset-0 bg-[#06070a]/80 backdrop-blur-md"
                            />

                            {/* Modal Body */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="bg-white dark:bg-[#0c0d12] border border-slate-100 dark:border-white/10 rounded-[2.5rem] w-full max-w-md sm:max-w-lg shadow-2xl relative overflow-hidden z-10 flex flex-col max-h-[85vh] sm:max-h-[80vh]"
                            >
                                {/* Top Accent Theme Line */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-1.5"
                                    style={{ background: "var(--primary-theme)" }}
                                />

                                {/* Floating Close Button */}
                                <button
                                    type="button"
                                    onClick={() => setActiveGuideKey(null)}
                                    className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all z-20"
                                    title="Close guide"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                {/* Header Section */}
                                <div className="p-6 sm:p-8 pb-4 space-y-2">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-primary bg-primary/10 shrink-0">
                                        <HelpCircle className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-base sm:text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white pr-8 truncate">
                                        {STEP_BY_STEP_GUIDES[activeGuideKey].title}
                                    </h3>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                        Official step-by-step procedural guidelines
                                    </p>
                                </div>

                                {/* Body Section (Custom Scrollable list of steps) */}
                                <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-2 space-y-3.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                    {STEP_BY_STEP_GUIDES[activeGuideKey].steps.map((step, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="flex gap-3.5 items-start p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                                        >
                                            <span className="w-6 h-6 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-[10px] text-primary dark:text-primary font-mono font-black shrink-0">
                                                {idx + 1}
                                            </span>
                                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                                                {step}
                                            </p>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Footer Section */}
                                <div className="p-6 sm:p-8 pt-4 border-t border-slate-100 dark:border-white/5">
                                    <Button
                                        onClick={() => setActiveGuideKey(null)}
                                        className="w-full h-12 rounded-xl text-white font-extrabold uppercase italic tracking-widest transition-all shadow-lg active:scale-[0.98]"
                                        style={{ backgroundColor: "var(--primary-theme)" }}
                                    >
                                        Got it, thank you!
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}

