/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities, react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import SecureIdleTimer from "@/components/shared/SecureIdleTimer";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Loader2,
    Check,
    Home,
    Baby,
    Upload,
    Search,
    CheckCircle2,
    Users,
    AlertCircle,
    Printer,
    ChevronRight,
    ChevronLeft
} from "lucide-react";

import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import QRCode from "qrcode";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    getCurrentUserResident,
    getTransactionTypes,
    ensureCivilRegistryTransactionTypes,
    submitCivilRegistryTransaction,
    getSystemSettingAction,
    getTransactionById,
    getBarangaysList,
    getExistingBirthRegistrations,
    cancelBirthRegistration
} from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveDraftFile, getDraftFiles, clearDraftFiles } from "@/lib/draftDb";
import { getSecureUploadUrlAction } from "./actions";
import RequestList from "../_components/request-list";
import InformantInfo from "../_components/informant-info";
import ReviewAndSubmit from "../_components/review-and-submit";
import RequiredDocuments, { DocumentItem } from "../_components/required-documents";
import ReadOnlyDocumentPreview from "../_components/read-only-document-preview";


const STORAGE_KEY = "lcr_birth_registration_draft";

// --- UPLOAD FILE SECURELY VIA SIGNED UPLOAD URL ---
async function uploadFileClientSide(file: File, fieldName: string, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'bin';

    const res = await getSecureUploadUrlAction(fieldName, "lcr/birth_registration", fileExt, userId);
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


const EVIDENCE_LABELS: Record<string, string> = {
    A: "Baptismal Certificate",
    B: "School records",
    C: "Income tax return of parents",
    D: "Insurance Policy",
    E: "Medical records",
    F: "Others (Voter registration record, Barangay certification)",
    G: "Affidavit of 2 disinterested persons"
};

const EVIDENCE_OPTIONS = [
    { value: 'A', label: 'A. Baptismal Certificate' },
    { value: 'B', label: 'B. School records' },
    { value: 'C', label: 'C. Income tax return of parents' },
    { value: 'D', label: 'D. Insurance Policy' },
    { value: 'E', label: 'E. Medical records' },
    { value: 'F', label: 'F. Others (Voter registration record, Barangay certification)' },
    { value: 'G', label: 'G. Affidavit of 2 disinterested persons' }
];



// --- TYPES ---

type Step = "EXISTING" | "IDENTITY" | "DETAILS" | "PARENTS" | "UPLOAD" | "CONFIRM" | "SUBMIT";

const STEPS: { id: Step; label: string; icon: any }[] = [
    { id: "IDENTITY", label: "Informant Info", icon: User },
    { id: "DETAILS", label: "Child Details", icon: Search },
    { id: "PARENTS", label: "Parental Info", icon: Users },
    { id: "UPLOAD", label: "Upload Documents", icon: Upload },
    { id: "CONFIRM", label: "Review & Submit", icon: CheckCircle2 },
];

interface FormState {
    typeId: string;
    registryType: "BIRTH_REG";
    children: {
        firstName: string;
        middleName: string;
        lastName: string;
        suffix: string;
        sex: string;
        birthTime: string;
    }[];
    dateOfEvent: string;
    placeOfEvent: string;
    fatherFirstName: string;
    fatherMiddleName: string;
    fatherLastName: string;
    motherFirstName: string;
    motherMiddleName: string;
    motherLastName: string;
    birthType: string;
    birthTypeSpecify?: string;
    registrationType: "STANDARD" | "LATE";
    lateDuration?: "1-10" | "10-20" | "20+" | string;
    miscFee?: number;
    parentsMarried?: boolean;
    supportingEvidence1Type: string;
    supportingEvidence2Type: string;
    supportingEvidenceTypes: string[];
    supportingEvidence1Source: string;
    supportingEvidence2Source: string;
    paymentType: "WALK_IN";
    files: Record<string, File | null>;
    previews: Record<string, string | null>;
    idTypeOverride?: string;
    email: string;
    contactNumber: string;
    relationship: string;
    relationshipSpecify?: string;
    informantFirstName: string;
    informantMiddleName: string;
    informantLastName: string;
    informantSuffix: string;
    informantBirthDate: string;
    informantAge: string;
    informantCivilStatus: string;
    informantCitizenship: string;
    informantOccupation: string;
}

export default function BirthRegistrationPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<Step>("EXISTING");
    const [existingRequests, setExistingRequests] = useState<any[]>([]);
    const [selectedApplication, setSelectedApplication] = useState<any>(null);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);

    const [themeColor, setThemeColor] = useState("var(--primary-theme)");

    useEffect(() => {
        getSystemSettingAction("theme_color").then((res: any) => {
            if (res.success && res.data) {
                setThemeColor(res.data);
            }
        });
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [submitting, setSubmitting] = useState(false);
    const [, setShowErrors] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [resident, setResident] = useState<any>(null);
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [_revisionTx, setRevisionTx] = useState<any>(null);
    const [userId, setUserId] = useState<string>("");

    const [form, setForm] = useState<FormState>({
        typeId: "",
        registryType: "BIRTH_REG",
        children: [{ firstName: "", middleName: "", lastName: "", suffix: "", sex: "", birthTime: "" }],
        dateOfEvent: "",
        placeOfEvent: "",
        fatherFirstName: "",
        fatherMiddleName: "",
        fatherLastName: "",
        motherFirstName: "",
        motherMiddleName: "",
        motherLastName: "",
        birthType: "SINGLE",
        birthTypeSpecify: "",
        registrationType: "STANDARD",
        miscFee: 0,
        lateDuration: "",
        supportingEvidence1Type: "",
        supportingEvidence2Type: "",
        supportingEvidenceTypes: [],
        supportingEvidence1Source: "",
        supportingEvidence2Source: "",
        paymentType: "WALK_IN",
        files: {},
        previews: {},
        idTypeOverride: "",
        email: "",
        contactNumber: "",
        relationship: "",
        relationshipSpecify: "",
        informantFirstName: "",
        informantMiddleName: "",
        informantLastName: "",
        informantSuffix: "",
        informantBirthDate: "",
        informantAge: "",
        informantCivilStatus: "",
        informantCitizenship: "",
        informantOccupation: ""
    });

    const [dbBaseFee, setDbBaseFee] = useState<number>(100);
    const [dbProcessingFee, setDbProcessingFee] = useState<number>(215);
    const [dbLateFee1to10, setDbLateFee1to10] = useState<number>(315);
    const [dbLateFee10to20, setDbLateFee10to20] = useState<number>(515);
    const [dbLateFee20plus, setDbLateFee20plus] = useState<number>(1015);

    const [policyOpen, setPolicyOpen] = useState(false);
    const [policyAccepted, setPolicyAccepted] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerFile, setViewerFile] = useState<File | null>(null);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState("");
    const [barangaysList, setBarangaysList] = useState<string[]>([]);

    // QR Handoff states
    const [handoffToken, setHandoffToken] = useState("");
    const [handoffQrCode, setHandoffQrCode] = useState("");
    const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
    const [handoffSessionSlot, setHandoffSessionSlot] = useState<string>("");
    const [isHandoffOpen, setIsHandoffOpen] = useState(false);
    const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);

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
                    const uploadedFile = files[0];
                    if (uploadedFile) {
                        const targetKey = handoffSessionSlot.replace("lcr_", "");
                        setForm(prev => ({
                            ...prev,
                            previews: { ...prev.previews, [targetKey]: uploadedFile.url }
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
        }, 800);
        return () => window.clearInterval(poll);
    }, [handoffToken, handoffSessionSlot]);

    const startHandoff = async (docKey: string) => {
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
        const map: Record<string, string> = {
            lcr_marriageCertificate: "Marriage Certificate of Parents",
            lcr_municipalForm102: "Municipal Form 102",
            lcr_communityTaxCertificate: "Community Tax Certificate",
            lcr_negativePSA: "Negative Certification from PSA",
            lcr_colb: "Certificate of Live Birth (COLB)",
            lcr_affidavitDelayed: "Affidavit of Delayed Registration",
            lcr_supportingEvidence1: "Supporting Evidence 1",
            lcr_supportingEvidence2: "Supporting Evidence 2"
        };
        return map[handoffSessionSlot] || "Document";
    };

    const handleViewFile = (file: File | null, existingUrl: string | null, title: string) => {
        setViewerFile(file);
        setViewerUrl(existingUrl);
        setViewerTitle(title);
        setViewerOpen(true);
    };

    useEffect(() => {
        if (!form.dateOfEvent) return;

        try {
            const dob = new Date(form.dateOfEvent);
            const today = new Date();
            const dobNorm = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
            const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const diffDays = Math.floor((todayNorm.getTime() - dobNorm.getTime()) / (1000 * 60 * 60 * 24));
            const isLate = diffDays > 30;

            setForm(prev => {
                const desired = isLate ? "LATE" : "STANDARD";
                let lateDuration = prev.lateDuration;
                let miscFee = prev.miscFee;

                if (isLate) {
                    let age = todayNorm.getFullYear() - dobNorm.getFullYear();
                    const m = todayNorm.getMonth() - dobNorm.getMonth();
                    if (m < 0 || (m === 0 && todayNorm.getDate() < dobNorm.getDate())) {
                        age--;
                    }
                    if (age > 20) { lateDuration = "20+"; miscFee = dbLateFee20plus; }
                    else if (age > 10) { lateDuration = "10-20"; miscFee = dbLateFee10to20; }
                    else { lateDuration = "1-10"; miscFee = dbLateFee1to10; }
                } else {
                    lateDuration = "";
                    miscFee = 0;
                }

                if (prev.registrationType === desired && prev.lateDuration === lateDuration && prev.miscFee === miscFee) return prev;
                return { ...prev, registrationType: desired, lateDuration, miscFee };
            });
        } catch {
            // ignore
        }
    }, [form.dateOfEvent, dbLateFee20plus, dbLateFee10to20, dbLateFee1to10]);

    const handleAcceptPolicy = () => {
        setPolicyOpen(false);
        setPolicyAccepted(true);
        setErrors(prev => {
            const copy = { ...prev };
            delete copy.policyAccepted;
            return copy;
        });
    };

    const isRestoredRef = useRef(false);

    const baseFee = form.registrationType === "STANDARD" ? dbBaseFee : (
        form.lateDuration === "1-10" ? dbLateFee1to10 : form.lateDuration === "10-20" ? dbLateFee10to20 : form.lateDuration === "20+" ? dbLateFee20plus : 0
    );
    const totalAmount = Number(baseFee || 0) + dbProcessingFee;

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("revisionId")) return;

        const savedStep = sessionStorage.getItem("birth-reg-step");
        const savedForm = sessionStorage.getItem("birth-reg-form");

        if (savedStep) {
            if (savedStep === "STATUS" || savedStep === "SUBMIT") {
                setCurrentStep("EXISTING");
            } else {
                setCurrentStep(savedStep as Step);
            }
        }
        if (savedForm) {
            try {
                const parsed = JSON.parse(savedForm);
                if (parsed && typeof parsed === "object") {
                    const parsedSupporting = parsed.supportingEvidenceTypes || ((parsed.supportingEvidence1Type || parsed.supportingEvidence2Type) ? [parsed.supportingEvidence1Type, parsed.supportingEvidence2Type].filter(Boolean) : []);
                    isRestoredRef.current = true;
                    setForm(prev => ({
                        ...prev,
                        ...parsed,
                        placeOfEvent: parsed.placeOfEvent || "",
                        supportingEvidenceTypes: parsedSupporting,
                        supportingEvidence1Type: parsed.supportingEvidence1Type || parsedSupporting[0] || "",
                        supportingEvidence2Type: parsed.supportingEvidence2Type || parsedSupporting[1] || ""
                    }));
                }
            } catch (e) {
                console.error("Failed to parse saved form", e);
            }
        }

        async function hydrateFiles() {
            try {
                const draftFiles = await getDraftFiles(STORAGE_KEY);
                if (draftFiles && Object.keys(draftFiles).length > 0) {
                    setForm(prev => ({ ...prev, files: { ...prev.files, ...draftFiles } }));
                    Object.entries(draftFiles).forEach(([key, file]) => {
                        if (file && file.type.startsWith("image/")) {
                            const reader = new FileReader();
                            reader.onload = () => {
                                setForm(prev => ({ ...prev, previews: { ...prev.previews, [key]: reader.result as string } }));
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                    toast.info("Progress restored. Uploaded document drafts recovered.", { duration: 6000 });
                }
            } catch (error) {
                console.error("Failed to hydrate draft files from IndexedDB:", error);
            }
        }
        hydrateFiles();
    }, []);

    useEffect(() => {
        if (!loading && !revisionId) {
            try {
                sessionStorage.setItem("birth-reg-step", currentStep);
                const copy: any = { ...form };
                delete copy.files;
                delete copy.previews;
                sessionStorage.setItem("birth-reg-form", JSON.stringify(copy));
            } catch (err) {
                console.warn("Failed to persist form to sessionStorage:", err);
            }
        }
    }, [currentStep, form, loading, revisionId]);

    useEffect(() => {
        if (loading) return;
        if (isRestoredRef.current) { isRestoredRef.current = false; return; }

        if (form.relationship === "SELF" && resident) {
            setForm(prev => ({
                ...prev,
                children: [{
                    firstName: resident.firstName || "",
                    middleName: resident.middleName || "",
                    lastName: resident.lastName || "",
                    suffix: resident.suffix || "",
                    sex: resident.gender?.toUpperCase() || "",
                    birthTime: "",
                }],
                placeOfEvent: resident.placeOfBirth || resident.municipality || prev.placeOfEvent,
                dateOfEvent: resident.dateOfBirth ? new Date(resident.dateOfBirth).toISOString().split('T')[0] : prev.dateOfEvent,
                fatherFirstName: resident.fatherFirstName || prev.fatherFirstName,
                fatherMiddleName: resident.fatherMiddleName || prev.fatherMiddleName,
                fatherLastName: resident.fatherLastName || prev.fatherLastName,
                motherFirstName: resident.motherFirstName || prev.motherFirstName,
                motherMiddleName: resident.motherMiddleName || prev.motherMiddleName,
                motherLastName: resident.motherLastName || prev.motherLastName,
            }));
        } else if (form.relationship === "FATHER" && resident) {
            setForm(prev => ({
                ...prev,
                fatherFirstName: resident.firstName || "",
                fatherMiddleName: resident.middleName || "",
                fatherLastName: resident.lastName || "",
            }));
        } else if (form.relationship === "MOTHER" && resident) {
            setForm(prev => ({
                ...prev,
                motherFirstName: resident.firstName || "",
                motherMiddleName: resident.middleName || "",
                motherLastName: resident.lastName || "",
            }));
        }
    }, [form.relationship, resident, loading]);

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
                setUserId(uId);

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

                const [resResult, typesResult, brgyResult, existingRes] = await Promise.all([
                    getCurrentUserResident(uId),
                    getTransactionTypes(),
                    getBarangaysList(),
                    getExistingBirthRegistrations(uId)
                ]);

                if (brgyResult.success && brgyResult.data) {
                    setBarangaysList(brgyResult.data);
                }

                if (resResult.success && resResult.data) {
                    const r = resResult.data;
                    setResident(r);

                    if (txData) {
                        const addData = txData.additionalData as any || {};
                        const resSnapshot = txData.residentSnapshot as any || r || {};

                        const previews: Record<string, string | null> = {};
                        const fileKeys = ["marriageCertificate", "municipalForm102", "communityTaxCertificate", "negativePSA", "colb", "affidavitDelayed", "supportingEvidence1", "supportingEvidence2"];
                        fileKeys.forEach(k => {
                            if (addData[k] && typeof addData[k] === "string" && addData[k].startsWith("http")) {
                                previews[k] = addData[k];
                            }
                        });

                        let fFN = addData.fatherFirstName || ""; let fMN = addData.fatherMiddleName || ""; let fLN = addData.fatherLastName || "";
                        if (!fFN && !fLN && addData.fatherName) { const parts = addData.fatherName.split(/\s+/); fLN = parts.pop() || ""; fFN = parts.shift() || ""; fMN = parts.join(" ") || ""; }

                        let mFN = addData.motherFirstName || ""; let mMN = addData.motherMiddleName || ""; let mLN = addData.motherLastName || "";
                        if (!mFN && !mLN && addData.motherName) { const parts = addData.motherName.split(/\s+/); mLN = parts.pop() || ""; mFN = parts.shift() || ""; mMN = parts.join(" ") || ""; }

                        let infFN = addData.informantFirstName || ""; let infMN = addData.informantMiddleName || ""; let infLN = addData.informantLastName || ""; let infSuf = addData.informantSuffix || "";
                        if (!infFN && !infLN && addData.informantName) { const parts = addData.informantName.split(/\s+/); infLN = parts.pop() || ""; infFN = parts.shift() || ""; if (["JR", "SR", "I", "II", "III", "IV"].includes(infLN.toUpperCase())) { infSuf = infLN; infLN = parts.pop() || ""; } infMN = parts.join(" ") || ""; }

                        setForm(prev => ({
                            ...prev,
                            typeId: txData.typeId || prev.typeId,
                            children: addData.children || prev.children,
                            dateOfEvent: addData.dateOfEvent || prev.dateOfEvent,
                            placeOfEvent: addData.placeOfEvent || prev.placeOfEvent,
                            fatherFirstName: fFN, fatherMiddleName: fMN, fatherLastName: fLN,
                            motherFirstName: mFN, motherMiddleName: mMN, motherLastName: mLN,
                            birthType: addData.birthType || prev.birthType,
                            birthTypeSpecify: addData.birthTypeSpecify || prev.birthTypeSpecify,
                            registrationType: addData.registrationType || prev.registrationType,
                            lateDuration: addData.lateDuration || prev.lateDuration,
                            supportingEvidence1Type: addData.supportingEvidence1Type || prev.supportingEvidence1Type,
                            supportingEvidence2Type: addData.supportingEvidence2Type || prev.supportingEvidence2Type,
                            supportingEvidenceTypes: addData.supportingEvidenceTypes || prev.supportingEvidenceTypes || [],
                            supportingEvidence1Source: addData.supportingEvidence1Source || prev.supportingEvidence1Source,
                            supportingEvidence2Source: addData.supportingEvidence2Source || prev.supportingEvidence2Source,
                            email: addData.email || resSnapshot.email || prev.email,
                            contactNumber: addData.contactNumber || resSnapshot.contactNumber || prev.contactNumber,
                            relationship: addData.relationship || prev.relationship,
                            relationshipSpecify: addData.relationshipSpecify || prev.relationshipSpecify,
                            informantFirstName: infFN, informantMiddleName: infMN, informantLastName: infLN, informantSuffix: infSuf,
                            informantBirthDate: addData.informatnBirthDate || addData.informantBirthDate || prev.informantBirthDate,
                            informantAge: addData.informantAge || prev.informantAge,
                            informantCivilStatus: addData.informantCivilStatus || prev.informantCivilStatus,
                            informantCitizenship: addData.informantCitizenship || prev.informantCitizenship,
                            informantOccupation: addData.informantOccupation || prev.informantOccupation,
                            previews
                        }));
                    } else {
                        setForm(prev => ({
                            ...prev,
                            email: prev.email || r.email || "",
                            contactNumber: prev.contactNumber || r.contactNumber || "",
                            informantFirstName: r.firstName || "",
                            informantMiddleName: r.middleName || "",
                            informantLastName: r.lastName || "",
                            informantSuffix: r.suffix || "",
                            informantBirthDate: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : "",
                            informantAge: r.age?.toString() || "",
                            informantCivilStatus: r.civilStatus || "",
                            informantCitizenship: r.citizenship || "Filipino",
                            informantOccupation: r.occupation || ""
                        }));
                    }
                }

                if (typesResult.success && typesResult.data) {
                    const lcrTypes = typesResult.data.filter((t: any) => t.category === "Civil Registry");
                    const currentDbType = lcrTypes.find((t: any) => t.code === "LCR_BIRTH_REG");
                    if (currentDbType) {
                        setForm(prev => ({ ...prev, typeId: prev.typeId || currentDbType.id }));
                        setDbBaseFee(Number(currentDbType.baseFee ?? 100));
                        if (currentDbType.defaultFees) {
                            const feesArray = typeof currentDbType.defaultFees === "string"
                                ? JSON.parse(currentDbType.defaultFees)
                                : currentDbType.defaultFees;
                            const procFeeObj = feesArray.find((f: any) => f.code === "PROCESSING_FEE");
                            if (procFeeObj) setDbProcessingFee(Number(procFeeObj.amount));
                            const late1 = feesArray.find((f: any) => f.code === "LATE_FEE_1_10");
                            if (late1) setDbLateFee1to10(Number(late1.amount));
                            const late10 = feesArray.find((f: any) => f.code === "LATE_FEE_10_20");
                            if (late10) setDbLateFee10to20(Number(late10.amount));
                            const late20 = feesArray.find((f: any) => f.code === "LATE_FEE_20_UP");
                            if (late20) setDbLateFee20plus(Number(late20.amount));
                        }
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
                    const savedStep = sessionStorage.getItem("birth-reg-step");
                    if (savedStep && savedStep !== "SUBMIT") {
                        setCurrentStep(savedStep as Step);
                    } else {
                        setCurrentStep("EXISTING");
                    }
                } else {
                    const savedStep = sessionStorage.getItem("birth-reg-step");
                    if (savedStep && savedStep !== "SUBMIT") {
                        setCurrentStep(savedStep as Step);
                    } else {
                        setCurrentStep("IDENTITY");
                    }
                }
            } catch (err) {
                console.error(err);
                toast.error("Initialization Failed");
            } finally {
                setLoading(false);
            }
        }
        init();
    }, []);

    const handleBirthTypeChange = (val: string) => {
        let count = 1;
        if (val === "TWIN") count = 2;
        if (val === "TRIPLET") count = 3;
        if (val === "QUADRUPLET") count = 4;
        if (val === "QUINTUPLET") count = 5;
        if (val === "SEXTUPLET") count = 6;

        setForm(prev => {
            const currentChildren = [...prev.children];
            if (currentChildren.length < count) {
                for (let i = currentChildren.length; i < count; i++) {
                    currentChildren.push({ firstName: "", middleName: "", lastName: "", suffix: "", sex: "", birthTime: "" });
                }
            } else if (currentChildren.length > count) {
                currentChildren.splice(count);
            }
            return { ...prev, birthType: val, children: currentChildren };
        });
    };

    const handleChildNameChange = (index: number, field: keyof FormState['children'][0], value: string) => {
        setForm(prev => {
            const newChildren = [...prev.children];
            newChildren[index] = { ...newChildren[index], [field]: value.toUpperCase() };
            return { ...prev, children: newChildren };
        });
    };

    const handleDateOfEventChange = (value: string) => {
        if (!value) { setForm(prev => ({ ...prev, dateOfEvent: value })); return; }

        try {
            const dob = new Date(value);
            const today = new Date();
            const dobNorm = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
            const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const diffDays = Math.floor((todayNorm.getTime() - dobNorm.getTime()) / (1000 * 60 * 60 * 24));
            const isLate = diffDays > 30;
            let lateDuration = "";
            let miscFee = 0;

            if (isLate) {
                let age = todayNorm.getFullYear() - dobNorm.getFullYear();
                const m = todayNorm.getMonth() - dobNorm.getMonth();
                if (m < 0 || (m === 0 && todayNorm.getDate() < dobNorm.getDate())) age--;
                if (age > 20) { lateDuration = "20+"; miscFee = dbLateFee20plus; }
                else if (age > 10) { lateDuration = "10-20"; miscFee = dbLateFee10to20; }
                else { lateDuration = "1-10"; miscFee = dbLateFee1to10; }
            }

            setForm(prev => ({ ...prev, dateOfEvent: value, registrationType: isLate ? "LATE" : "STANDARD", lateDuration, miscFee }));
        } catch {
            setForm(prev => ({ ...prev, dateOfEvent: value }));
        }
    };

    const handleRemoveFile = (key: string) => {
        setForm(prev => {
            const nextFiles = { ...prev.files };
            const nextPreviews = { ...prev.previews };
            delete nextFiles[key];
            delete nextPreviews[key];
            return { ...prev, files: nextFiles, previews: nextPreviews };
        });
        saveDraftFile(STORAGE_KEY, key, null).catch(err => console.error("Failed to delete draft file in IndexedDB:", err));
        toast.success("File removed successfully.");
    };

    const getDocItemConfig = (key: string, label: string): DocumentItem => {
        const file = form.files[key] || null;
        const preview = form.previews[key] || null;

        const infoMap: Record<string, string> = {
            marriageCertificate: "Marriage Certificate of Parents (PDF/Image)",
            municipalForm102: "Municipal Form 102 (Certificate of Live Birth)",
            communityTaxCertificate: "Community Tax Certificate / Cedula of Mother",
            negativePSA: "PSA Negative Certification of Birth",
            colb: "Certificate of Live Birth (COLB) copy",
            affidavitDelayed: "Affidavit of Delayed Registration",
            supportingEvidence1: "Supporting Evidence 1 (Baptismal, School, etc.)",
            supportingEvidence2: "Supporting Evidence 2 (Baptismal, School, etc.)"
        };

        return {
            key,
            label,
            file,
            previewUrl: preview,
            infoText: infoMap[key] || "PDF / IMAGE (MAX 5MB)",
            error: !!errors.documents,
            onFileSelect: async (newFile) => {
                saveDraftFile(STORAGE_KEY, key, newFile).catch(err => console.error("Failed to save draft file to IndexedDB:", err));
                try {
                    toast.loading("Uploading document...", { id: `file-upload-${key}` });
                    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                    const publicUrl = await uploadFileClientSide(newFile, sanitizedKey, userId);
                    setForm(prev => ({ ...prev, files: { ...prev.files, [key]: newFile }, previews: { ...prev.previews, [key]: publicUrl } }));
                    toast.success("Document uploaded!", { id: `file-upload-${key}` });
                } catch {
                    toast.error("Upload failed. Local copy stored.", { id: `file-upload-${key}` });
                    setForm(prev => ({ ...prev, files: { ...prev.files, [key]: newFile }, previews: { ...prev.previews, [key]: newFile.type.startsWith("image/") ? URL.createObjectURL(newFile) : null } }));
                }
                setErrors(prev => { if (!prev.documents) return prev; const copy = { ...prev }; delete copy.documents; return copy; });
            },
            onClickUpload: () => startHandoff(key),
            onClear: () => handleRemoveFile(key),
            onView: () => handleViewFile(file, preview, label)
        };
    };

    const renderReadOnlyDocCard = (key: string, label: string) => {
        const file = form.files[key] || null;
        const preview = form.previews[key] || null;
        if (!file && !preview) return null;

        return (
            <ReadOnlyDocumentPreview
                key={key}
                file={file}
                previewUrl={preview}
                label={label}
                onView={() => handleViewFile(file, preview, label)}
            />
        );
    };

    const getRequiredDocsList = (): DocumentItem[] => {
        const list: DocumentItem[] = [];
        if (form.registrationType === "STANDARD") {
            if (form.parentsMarried) {
                list.push(getDocItemConfig("marriageCertificate", "Marriage Certificate of Parents"));
                list.push(getDocItemConfig("municipalForm102", "Municipal Form 102 (Certificate of Live Birth)"));
            } else {
                list.push(getDocItemConfig("communityTaxCertificate", "Community Tax Certificate (Cedula)"));
            }
        } else if (form.registrationType === "LATE") {
            list.push(getDocItemConfig("negativePSA", "Negative Certification from PSA"));
            list.push(getDocItemConfig("colb", "Certificate of Live Birth (COLB)"));
            list.push(getDocItemConfig("affidavitDelayed", "Affidavit of Delayed Registration"));
            if (form.parentsMarried) {
                list.push(getDocItemConfig("marriageCertificate", "Marriage Certificate of Parents"));
                list.push(getDocItemConfig("municipalForm102", "Municipal Form 102"));
            } else {
                list.push(getDocItemConfig("communityTaxCertificate", "Community Tax Certificate (Cedula)"));
            }
            if (form.supportingEvidence1Type) {
                list.push(getDocItemConfig("supportingEvidence1", `Evidence 1: ${EVIDENCE_LABELS[form.supportingEvidence1Type] || form.supportingEvidence1Type}`));
            }
            if (form.supportingEvidence2Type) {
                list.push(getDocItemConfig("supportingEvidence2", `Evidence 2: ${EVIDENCE_LABELS[form.supportingEvidence2Type] || form.supportingEvidence2Type}`));
            }
        }
        return list;
    };

    const hasUploadedDocs = (): boolean => {
        const keys = ["marriageCertificate", "municipalForm102", "communityTaxCertificate", "negativePSA", "colb", "affidavitDelayed", "supportingEvidence1", "supportingEvidence2"];
        return keys.some(k => !!form.files[k] || !!form.previews[k]);
    };

    const toggleSupportingEvidence = (val: string) => {
        setForm(prev => {
            const current = prev.supportingEvidenceTypes || [];
            let next: string[];
            if (current.includes(val)) {
                next = current.filter(v => v !== val);
            } else {
                if (current.length >= 2) {
                    toast.error("You can select only two supporting evidence types. Remove one to add another.");
                    return prev;
                }
                next = [...current, val];
            }

            // Clear files and previews for supportingEvidence when types change to avoid mismatched files
            const nextFiles = { ...prev.files };
            const nextPreviews = { ...prev.previews };

            delete nextFiles['supportingEvidence1'];
            delete nextPreviews['supportingEvidence1'];
            delete nextFiles['supportingEvidence2'];
            delete nextPreviews['supportingEvidence2'];

            // Also clean up database drafts
            saveDraftFile(STORAGE_KEY, 'supportingEvidence1', null).catch(err => console.error(err));
            saveDraftFile(STORAGE_KEY, 'supportingEvidence2', null).catch(err => console.error(err));

            return {
                ...prev,
                supportingEvidenceTypes: next,
                supportingEvidence1Type: next[0] || "",
                supportingEvidence2Type: next[1] || "",
                files: nextFiles,
                previews: nextPreviews
            };
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _isStepValid = (stepId: Step): boolean => {
        if (stepId === "IDENTITY") {
            const isSpecifyValid = form.relationship !== "OTHER" || !!form.relationshipSpecify?.trim();
            return !!form.relationship && !!form.contactNumber && isSpecifyValid;
        }
        if (stepId === "DETAILS") {
            const childrenValid = form.children.every((c) => {
                if (!c.firstName || !c.lastName || !c.sex) return false;
                if (form.birthType !== "SINGLE" && !c.birthTime) return false;
                return true;
            });
            if (!childrenValid || !form.dateOfEvent || !form.placeOfEvent) return false;
            const birthDate = new Date(form.dateOfEvent);
            const today = new Date(); today.setHours(23, 59, 59, 999);
            if (birthDate > today) return false;
            return true;
        }
        if (stepId === "PARENTS") {
            const hasMarried = typeof form.parentsMarried !== 'undefined';
            const hasMotherName = !!form.motherFirstName?.trim() && !!form.motherLastName?.trim();
            return hasMarried && hasMotherName;
        }
        return true;
    };

    const validateStep = (step: Step) => {
        const errs: Record<string, string> = {};

        if (step === "IDENTITY") {
            if (!form.relationship) errs.relationship = "Please select relationship.";
            if (form.relationship === "OTHER" && !form.relationshipSpecify?.trim()) errs.relationshipSpecify = "Please specify your relationship.";
            if (!form.contactNumber) errs.contactNumber = "Please enter a contact number.";
        }

        if (step === "DETAILS") {
            form.children.forEach((c, i) => {
                if (!c.firstName) errs[`children.${i}.firstName`] = "Please enter first name.";
                if (!c.lastName) errs[`children.${i}.lastName`] = "Please enter last name.";
                if (!c.sex) errs[`children.${i}.sex`] = "Please select sex.";
                if (form.birthType !== "SINGLE" && !c.birthTime) errs[`children.${i}.birthTime`] = "Please enter exact time of birth.";
            });
            if (!form.dateOfEvent) {
                errs.dateOfEvent = "Please select date of birth.";
            } else {
                const birthDate = new Date(form.dateOfEvent);
                const today = new Date(); today.setHours(23, 59, 59, 999);
                if (birthDate > today) errs.dateOfEvent = "Date of birth cannot be in the future.";
            }
            if (!form.placeOfEvent) errs.placeOfEvent = "Please select place of birth.";
        }

        if (step === "PARENTS") {
            if (typeof form.parentsMarried === 'undefined') errs.parentsMarried = "Please indicate parents' marital status.";
            if (!form.motherFirstName?.trim()) errs.motherFirstName = "Please enter mother's first name.";
            if (!form.motherLastName?.trim()) errs.motherLastName = "Please enter mother's last name.";
        }

        if (step === "UPLOAD") {
            if (form.registrationType === "STANDARD") {
                if (form.parentsMarried) {
                    if (!(form.files['marriageCertificate'] || form.previews['marriageCertificate'])) errs.marriageCertificate = "Required";
                    if (!(form.files['municipalForm102'] || form.previews['municipalForm102'])) errs.municipalForm102 = "Required";
                } else {
                    if (!(form.files['communityTaxCertificate'] || form.previews['communityTaxCertificate'])) errs.communityTaxCertificate = "Required";
                }
            } else if (form.registrationType === "LATE") {
                if (!form.supportingEvidenceTypes || form.supportingEvidenceTypes.length < 2) {
                    errs.supportingEvidenceTypes = "Please select two supporting evidence types.";
                } else {
                    const lateReqs = ['negativePSA', 'colb', 'affidavitDelayed', 'supportingEvidence1', 'supportingEvidence2', ...(form.parentsMarried ? ['marriageCertificate', 'municipalForm102'] : ['communityTaxCertificate'])];
                    lateReqs.forEach(k => {
                        if (!(form.files[k] || form.previews[k])) {
                            errs[k] = "Required";
                        }
                    });
                }
            }
            if (Object.keys(errs).length > 0) {
                errs.documents = "Please upload all required documents.";
            }
        }

        setErrors(errs);
        const valid = Object.keys(errs).length === 0;
        setShowErrors(!valid);
        if (!valid) {
            toast.error("Please complete highlighted required fields.", { className: "font-black uppercase tracking-widest text-[10px] italic" });
            setTimeout(() => {
                const firstErrorKey = Object.keys(errs)[0];
                if (firstErrorKey) {
                    let element: any = document.getElementsByName(firstErrorKey)[0] || document.getElementById(firstErrorKey);
                    if (!element) {
                        if (firstErrorKey === "relationship") {
                            element = (document.querySelector('[role="combobox"]') || document.querySelector('button[aria-autocomplete="none"]')) as any;
                        } else if (firstErrorKey.startsWith("children.")) {
                            const parts = firstErrorKey.split('.');
                            const index = parts[1]; const field = parts[2];
                            element = (document.querySelector(`[name="children.${index}.${field}"]`) || document.querySelector(`input[placeholder*="${field === 'firstName' ? 'First' : 'Last'}"], select`)) as any;
                        } else if (firstErrorKey === "parentsMarried") {
                            element = document.getElementById("parents-married-section") as any;
                        }
                    }
                    if (element) { element.scrollIntoView({ behavior: "smooth", block: "center" }); if (typeof (element as any).focus === "function") (element as any).focus(); }
                }
            }, 100);
        }
        return valid;
    };

    const handleSubmit = async () => {
        if (!policyAccepted) {
            setErrors(prev => ({ ...prev, policyAccepted: "You must agree to the Data Privacy & Terms before submitting." }));
            setShowErrors(true);
            toast.error("Please review and accept the Privacy Policy & Terms before submitting. Click Review to open the agreement.");
            return;
        }

        if (!form.relationship || (form.relationship === "OTHER" && !form.relationshipSpecify?.trim())) { toast.error("Please specify your relationship."); return; }
        if (!form.typeId) { toast.error("Service type not initialized. Please refresh the page."); return; }
        if (!form.dateOfEvent) { toast.error("Please provide the date of birth."); return; }
        if (form.registrationType === "LATE" && !form.lateDuration) {
            setErrors(prev => ({ ...prev, lateDuration: "Please select late registration period to compute the fee." }));
            setShowErrors(true);
            toast.error("Please select late registration period to compute the fee.");
            try { document.getElementById('late-duration-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { void e; }
            return;
        }

        const missingDocsQuick: string[] = [];
        if (form.registrationType === "STANDARD") {
            if (form.parentsMarried) {
                if (!(form.files['marriageCertificate'] || form.previews['marriageCertificate'])) missingDocsQuick.push('Marriage Certificate of Parents');
                if (!(form.files['municipalForm102'] || form.previews['municipalForm102'])) missingDocsQuick.push('Municipal Form 102');
            } else {
                if (!(form.files['communityTaxCertificate'] || form.previews['communityTaxCertificate'])) missingDocsQuick.push('Community Tax Certificate');
            }
        } else if (form.registrationType === "LATE") {
            const lateReqs = ['negativePSA', 'colb', 'affidavitDelayed', 'supportingEvidence1', 'supportingEvidence2', ...(form.parentsMarried ? ['marriageCertificate', 'municipalForm102'] : ['communityTaxCertificate'])];
            lateReqs.forEach(k => {
                if (!(form.files[k] || form.previews[k])) {
                    const map: any = { negativePSA: 'Negative Certification from PSA', colb: 'Certificate of Live Birth (COLB)', affidavitDelayed: 'Affidavit of Delayed Registration', supportingEvidence1: 'Supporting Evidence 1', supportingEvidence2: 'Supporting Evidence 2', marriageCertificate: 'Marriage Certificate of Parents', municipalForm102: 'Municipal Form 102', communityTaxCertificate: 'Community Tax Certificate' };
                    missingDocsQuick.push(map[k] || k);
                }
            });
        }

        if (missingDocsQuick.length > 0) {
            setErrors(prev => ({ ...prev, documents: `Please upload required documents: ${missingDocsQuick.join(', ')}` }));
            setShowErrors(true);
            toast.error('Please upload required documents before submitting.');
            const isSupportingEvidenceMissing = missingDocsQuick.some(doc => doc.includes('Supporting Evidence'));
            const isOtherDocsMissing = missingDocsQuick.some(doc => !doc.includes('Supporting Evidence'));
            if (isSupportingEvidenceMissing && !isOtherDocsMissing) { try { document.getElementById('supporting-evidence-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { void e; } }
            else { try { document.getElementById('documents-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { void e; } }
            return;
        }

        if (form.registrationType === "LATE") {
            if (!form.supportingEvidenceTypes || form.supportingEvidenceTypes.length < 2) {
                setErrors(prev => ({ ...prev, documents: "Please select two supporting evidence types." }));
                setShowErrors(true);
                toast.error("Please select two supporting evidence types before uploading files.");
                try { document.getElementById('supporting-evidence-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { void e; }
                return;
            }
        }

        setSubmitting(true);
        try {
            const childrenList = form.children.map(c => `${c.firstName} ${c.middleName} ${c.lastName} ${c.suffix}`.trim());
            const subjectName = childrenList.join(" & ");

            const residentSnapshot = { ...resident, contactNumber: form.contactNumber, email: form.email, occupation: form.informantOccupation };

            const formData = new FormData();
            formData.append("typeId", form.typeId);
            formData.append("registryType", "BIRTH_REG");
            formData.append("residentSnapshot", JSON.stringify(residentSnapshot));
            if (revisionId) formData.append("revisionId", revisionId);

            const baseAdditionalData = {
                subjectName,
                children: form.children,
                dateOfEvent: form.dateOfEvent,
                placeOfEvent: form.placeOfEvent,
                birthType: form.birthType,
                registrationType: form.registrationType,
                fatherFirstName: form.fatherFirstName, fatherMiddleName: form.fatherMiddleName, fatherLastName: form.fatherLastName,
                fatherName: `${form.fatherFirstName} ${form.fatherMiddleName} ${form.fatherLastName}`.trim(),
                motherFirstName: form.motherFirstName, motherMiddleName: form.motherMiddleName, motherLastName: form.motherLastName,
                motherName: `${form.motherFirstName} ${form.motherMiddleName} ${form.motherLastName}`.trim(),
                relationship: form.relationship === "OTHER" ? form.relationshipSpecify : form.relationship,
                relationshipSpecify: form.relationshipSpecify || null,
                email: form.email,
                contactNumber: form.contactNumber,
                informantFirstName: form.informantFirstName, informantMiddleName: form.informantMiddleName, informantLastName: form.informantLastName, informantSuffix: form.informantSuffix,
                informantName: `${form.informantFirstName} ${form.informantMiddleName} ${form.informantLastName} ${form.informantSuffix}`.replace(/\s+/g, ' ').trim(),
                informatnBirthDate: form.informantBirthDate,
                informantAge: form.informantAge,
                informantCivilStatus: form.informantCivilStatus,
                informantCitizenship: form.informantCitizenship,
                informantOccupation: form.informantOccupation,
                idType: form.idTypeOverride || resident?.idType,
                idFrontUrl: resident?.idFrontUrl,
                idBackUrl: resident?.idBackUrl,
                lateDuration: form.lateDuration || null,
                parentsMarried: form.parentsMarried,
                miscFee: totalAmount,
                totalAmount: totalAmount,
                supportingEvidenceTypes: form.supportingEvidenceTypes || [],
                supportingEvidence1Type: form.supportingEvidence1Type || null,
                supportingEvidence2Type: form.supportingEvidence2Type || null,
            };

            const fileUrls: Record<string, string> = {};
            Object.entries(form.previews || {}).forEach(([key, url]) => {
                if (url && typeof url === "string" && url.startsWith("http")) fileUrls[key] = url;
            });

            const finalFiles = { ...form.files };
            const fileEntries = Object.entries(finalFiles);
            for (let i = 0; i < fileEntries.length; i++) {
                const [key, file] = fileEntries[i];
                if (!file) continue;
                const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                if (fileUrls[key]) { console.log(`[ClientUpload] Reusing existing public URL for ${key}:`, fileUrls[key]); continue; }
                try {
                    toast.loading(`Uploading document ${i + 1}/${fileEntries.length}...`, { id: "birth-upload-toast" });
                    const url = await uploadFileClientSide(file, sanitizedKey, userId);
                    fileUrls[key] = url;
                } catch (uploadErr) {
                    console.error(`[ClientUpload] Failed to upload ${key}:`, uploadErr);
                    toast.error(`Failed to upload document: ${key}. Please try again.`, { id: "birth-upload-toast" });
                    setSubmitting(false);
                    return;
                }
            }
            toast.dismiss("birth-upload-toast");

            const updatedAdditionalData = { ...baseAdditionalData, ...fileUrls };

            formData.append("additionalData", JSON.stringify(updatedAdditionalData));

            const result = await submitCivilRegistryTransaction(formData, userId);

            if (result.success) {
                await clearDraftFiles(STORAGE_KEY);
                sessionStorage.removeItem("birth-reg-step");
                sessionStorage.removeItem("birth-reg-form");
                toast.success(revisionId ? "Application resubmitted successfully!" : "Birth Registration submitted successfully!");

                // Fetch the updated registrations to display this newly submitted request
                const updated = await getExistingBirthRegistrations(userId);
                if (updated.success) {
                    setExistingRequests(updated.data);
                    const newTxId = result.transactionId || revisionId;
                    const match = updated.data.find((a: any) => a.id === newTxId);
                    if (match) {
                        setSelectedApplication(match);
                        setCurrentStep("SUBMIT");
                        return;
                    }
                }

                router.push(result.redirectUrl || "/dashboard");
            } else {
                toast.error(result.error || "Submission failed. Please try again.");
            }
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const stepIndex = STEPS.findIndex(s => s.id === currentStep);

    const goNext = () => {
        if (!validateStep(currentStep)) return;
        const nextIdx = stepIndex + 1;
        if (nextIdx < STEPS.length) setCurrentStep(STEPS[nextIdx].id);
    };

    const goPrev = () => {
        const prevIdx = stepIndex - 1;
        if (prevIdx >= 0) setCurrentStep(STEPS[prevIdx].id);
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    const handleCancelRegistration = async (id: string) => {
        try {
            toast.loading("Cancelling application...", { id: "cancel-reg-toast" });
            const res = await cancelBirthRegistration(id, userId);
            if (res.success) {
                toast.success("Registration application cancelled.", { id: "cancel-reg-toast" });
                // Re-fetch existing requests
                const updated = await getExistingBirthRegistrations(userId);
                if (updated.success) {
                    setExistingRequests(updated.data);
                    // Update selected application if we are viewing it
                    if (selectedApplication && selectedApplication.id === id) {
                        const nextApp = updated.data.find((a: any) => a.id === id);
                        setSelectedApplication(nextApp || null);
                    }
                }
                setCurrentStep("EXISTING");
            } else {
                toast.error(res.error || "Failed to cancel application.", { id: "cancel-reg-toast" });
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while cancelling the application.", { id: "cancel-reg-toast" });
        }
    };



    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-[#09090b] font-sans text-slate-900 dark:text-white">
            {mounted && createPortal(
                <SecureIdleTimer
                    timeoutSeconds={3 * 60}
                    warningSeconds={30}
                />,
                document.body
            )}

            <PrivacyTermsModal
                isOpen={policyOpen}
                onClose={() => setPolicyOpen(false)}
                onAccept={handleAcceptPolicy}
                onDecline={() => {
                    setPolicyAccepted(false);
                    setPolicyOpen(false);
                }}
                themeColor={themeColor}
            />

            <DocumentViewerModal
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                file={viewerFile}
                fileUrl={viewerUrl}
                title={viewerTitle}
                themeColor={themeColor}
            />

            <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">

                {/* Breadcrumb */}
                <Breadcrumb className="mb-8">
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
                                Birth Registration
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                {/* Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                            <Baby className="w-9 h-9 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                                Birth <span className="text-theme-primary">Registration</span>
                            </h1>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-2 italic">
                                Municipal Civil Registry Office • Application Form
                            </p>
                        </div>
                    </div>
                    {currentStep === "EXISTING" && (
                        <Button
                            onClick={() => {
                                setSelectedApplication(null);
                                setCurrentStep("IDENTITY");
                            }}
                            className="bg-theme-primary hover:bg-theme-hover text-white font-bold uppercase tracking-wider rounded-2xl py-6 px-6 shadow-lg shadow-theme-primary/20 active:scale-95 transition-all text-xs"
                        >
                            New Registration
                        </Button>
                    )}
                </div>

                {/* Stepper */}
                {currentStep !== "EXISTING" && currentStep !== "SUBMIT" && (
                    <div className="mb-10 overflow-x-auto py-4">
                        <div className="flex items-center gap-0 min-w-max mx-auto w-fit">
                            {STEPS.map((step, idx) => {
                                const isActive = step.id === currentStep;
                                const isDone = idx < stepIndex;
                                const Icon = step.icon;
                                return (
                                    <React.Fragment key={step.id}>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className={cn(
                                                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 border",
                                                isActive ? "bg-white dark:bg-[#0d120f]/60 border-2 border-theme-primary shadow-[0_0_20px_color-mix(in_srgb,var(--primary-theme)_35%,transparent)] scale-110" :
                                                    isDone ? "bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10" :
                                                        "bg-transparent border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-550 opacity-60"
                                            )}>
                                                {isDone
                                                    ? <Check className="w-5 h-5 text-theme-primary stroke-[3]" />
                                                    : <Icon className={cn("w-5 h-5", isActive ? "text-theme-primary animate-pulse" : "text-slate-500 dark:text-slate-400")} />
                                                }
                                            </div>
                                            <span className={cn(
                                                "text-[9px] font-black uppercase tracking-widest italic transition-colors duration-300",
                                                isActive ? "text-slate-900 dark:text-white font-black scale-105" : isDone ? "text-slate-700 dark:text-slate-350" : "text-slate-600 dark:text-slate-400 opacity-60"
                                            )}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < STEPS.length - 1 && (
                                            <div className={cn("h-0.5 w-8 md:w-14 mx-1 transition-all duration-300", idx < stepIndex ? "bg-theme-primary/40" : "bg-slate-350 dark:bg-white/10")} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25 }}
                    >
                        {/* ============ STEP: EXISTING ============ */}
                        {currentStep === "EXISTING" && (
                            <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-8 flex-1 flex flex-col">
                                <div className="text-center mb-8">
                                    <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                                        Existing <span className="text-theme-primary">Registrations</span>
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                        We found previous birth registration applications under your profile.
                                    </p>
                                </div>

                                <RequestList
                                    requests={existingRequests}
                                    onItemClick={(app) => {
                                        if (app.status === "EVALUATED" || app.status === "UNPAID") {
                                            router.push(`/checkout/${app.id}`);
                                        } else {
                                            setSelectedApplication(app);
                                            setCurrentStep("SUBMIT");
                                        }
                                    }}
                                    emptyMessage="No records found"
                                    emptySubMessage="Submit your first birth registration by clicking New Registration."
                                    getSubjectName={(app) => {
                                        const addData = app.additionalData as any || {};
                                        return addData.subjectName || "Birth Registration";
                                    }}
                                />

                                {/* Navigation buttons at bottom of card */}
                                <div className="flex pt-8 mt-auto border-t border-slate-200 dark:border-white/10">
                                    <Button
                                        type="button"
                                        onClick={() => router.push("/modules/civil-registry")}
                                        className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all"
                                    >
                                        <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back to Hub
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* ============ STEP: SUBMIT (Receipt/Summary view) ============ */}
                        {currentStep === "SUBMIT" && selectedApplication && (() => {
                            const addData = selectedApplication.additionalData as any || {};
                            const isLate = addData.registrationType === "LATE";
                            return (
                                <div className="space-y-8 animate-in fade-in duration-500">
                                    <div className="text-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white flex items-center justify-center mx-auto mb-4 animate-bounce">
                                            <CheckCircle2 className="w-10 h-10" />
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                                            Application <span className="text-theme-primary">Summary</span>
                                        </h2>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                            Review details and current status of your birth registration request.
                                        </p>
                                    </div>

                                    {/* Printable Receipt Frame */}
                                    <div className="max-w-2xl mx-auto bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden text-slate-900 dark:text-white backdrop-blur-2xl">
                                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                            <Baby size={160} />
                                        </div>

                                        <div className="flex justify-between items-start gap-4 flex-wrap border-b border-slate-200 dark:border-white/10 pb-6">
                                            <div>
                                                <h3 className="text-lg font-black uppercase tracking-tight">MUNICIPAL CIVIL REGISTRY</h3>
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
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Transaction ID</span>
                                                    <span className="text-xs font-black">{selectedApplication.id}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Child's Name</span>
                                                    <span className="uppercase font-black text-theme-primary">{addData.subjectName || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Birth</span>
                                                    <span className="font-black">
                                                        {addData.dateOfEvent
                                                            ? new Date(addData.dateOfEvent).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                                                            : "N/A"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Registration Type</span>
                                                    <span className="uppercase font-black">
                                                        {isLate ? `Delayed Registration (${addData.lateDuration || ""} yrs)` : "Timely Registration"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Informant</span>
                                                    <span className="uppercase font-black">{addData.informantName || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Relationship to Child</span>
                                                    <span className="uppercase font-bold">{addData.relationship || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Father's Name</span>
                                                    <span className="uppercase font-bold">{addData.fatherName || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Mother's Maiden Name</span>
                                                    <span className="uppercase font-bold">{addData.motherName || "N/A"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                                            <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                                                <span className="text-slate-400">Total Application Fee</span>
                                                <span className="text-theme-primary text-sm">₱{(selectedApplication.totalAmount || totalAmount).toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {selectedApplication.isCancelled ? (
                                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-xs text-red-600 dark:text-red-400 font-semibold leading-relaxed">
                                                <AlertCircle className="w-5 h-5 shrink-0" />
                                                <span>This application has been cancelled and will not be processed further by the Civil Registry.</span>
                                            </div>
                                        ) : selectedApplication.status === "FOR_REVISION" ? (
                                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-xs text-amber-600 dark:text-amber-300 font-semibold leading-relaxed">
                                                <AlertCircle className="w-5 h-5 shrink-0" />
                                                <span>This application requires revision. Please click the button below to resume editing.</span>
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex gap-3 text-xs text-theme-primary font-semibold leading-relaxed">
                                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                                <span>Your application has been received and is currently under review by municipal civil registry staff. You will be notified of any updates or when the document is ready.</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-center gap-4 pt-8">
                                        <Button
                                            type="button"
                                            onClick={() => setCurrentStep("EXISTING")}
                                            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
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
                                                    window.location.href = `/modules/civil-registry/birth-registration?revisionId=${selectedApplication.id}`;
                                                }}
                                                className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg"
                                            >
                                                Revise Details
                                            </Button>
                                        )}
                                        {!selectedApplication.isCancelled && !["RELEASED", "REJECTED", "PAID", "DELIVERED"].includes(selectedApplication.status) && (
                                            <Button
                                                type="button"
                                                onClick={() => handleCancelRegistration(selectedApplication.id)}
                                                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg"
                                            >
                                                Cancel Application
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}


                        {/* ============ STEP: IDENTITY ============ */}
                        {currentStep === "IDENTITY" && (
                            <div className="space-y-6">
                                {_revisionTx && (
                                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-800 dark:text-amber-400 animate-in fade-in duration-300">
                                        <AlertCircle className="w-5 h-5 shrink-0 animate-pulse mt-0.5" />
                                        <div className="text-left space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider italic">Attention: Revision Needed</p>
                                            <p className="text-xs font-bold text-slate-900 dark:text-slate-300 leading-relaxed italic">
                                                &ldquo;{_revisionTx.rejectionRemarks || "Please check the highlighted checklist files or values and submit them again."}&rdquo;
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <InformantInfo
                                    firstName={form.informantFirstName}
                                    middleName={form.informantMiddleName}
                                    lastName={form.informantLastName}
                                    suffix={form.informantSuffix}
                                    birthDate={form.informantBirthDate}
                                    age={form.informantAge}
                                    civilStatus={form.informantCivilStatus}
                                    citizenship={form.informantCitizenship}
                                    relationship={form.relationship}
                                    relationshipSpecify={form.relationshipSpecify}
                                    occupation={form.informantOccupation}
                                    contactNumber={form.contactNumber}
                                    onRelationshipChange={(val) => {
                                        setForm(prev => ({ ...prev, relationship: val }));
                                        setErrors(prev => { const c = { ...prev }; delete c.relationship; return c; });
                                    }}
                                    onRelationshipSpecifyChange={(val) => {
                                        setForm(prev => ({ ...prev, relationshipSpecify: val }));
                                        setErrors(prev => { const c = { ...prev }; delete c.relationshipSpecify; return c; });
                                    }}
                                    onOccupationChange={(val) => setForm(prev => ({ ...prev, informantOccupation: val }))}
                                    onContactNumberChange={(val) => {
                                        setForm(prev => ({ ...prev, contactNumber: val }));
                                        setErrors(prev => { const c = { ...prev }; delete c.contactNumber; return c; });
                                    }}
                                    relationshipOptions={[
                                        ...(resident?.gender?.toUpperCase() === "FEMALE" ? [] : [{ value: "FATHER", label: "Father" }]),
                                        ...(resident?.gender?.toUpperCase() === "MALE" ? [] : [{ value: "MOTHER", label: "Mother" }]),
                                        { value: "SELF", label: "Self" },
                                        { value: "GUARDIAN", label: "Guardian" },
                                        { value: "OTHER", label: "Other" }
                                    ]}
                                    errors={errors}
                                    showErrors={true}
                                    isCardWrapped={true}
                                    cardTitle="Informant Information"
                                    cardSubtitle="Person filing this registration"
                                />
                            </div>
                        )}                        {/* ============ STEP: DETAILS ============ */}
                        {currentStep === "DETAILS" && (
                            <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-8 overflow-visible">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                                        <Baby className="w-8 h-8 text-slate-900 dark:text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">Child Details</h2>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Information about the child being registered</p>
                                    </div>
                                </div>

                                {/* Birth Type */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Birth Type</Label>
                                        <Select value={form.birthType} onValueChange={handleBirthTypeChange}>
                                            <SelectTrigger className="rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus:border-theme-primary focus:ring-4 focus:ring-theme-primary/15 shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl mt-2 max-h-60 overflow-y-auto">
                                                {["SINGLE", "TWIN", "TRIPLET", "QUADRUPLET", "QUINTUPLET", "SEXTUPLET"].map(t => (
                                                    <SelectItem key={t} value={t} className="hover:bg-theme-primary/10 dark:hover:bg-theme-primary/15 font-black uppercase text-xs tracking-wider transition-colors">{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="hidden md:block col-span-2" />
                                </div>

                                {/* Children */}
                                {form.children.map((child, idx) => (
                                    <div key={idx} className="space-y-4 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-white/10">
                                        {form.children.length > 1 && (
                                            <p className="text-xs font-black uppercase tracking-widest text-theme-primary">Child {idx + 1}</p>
                                        )}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                { field: "firstName", label: "First Name", placeholder: "JUAN" },
                                                { field: "middleName", label: "Middle Name", placeholder: "DELA" },
                                                { field: "lastName", label: "Last Name", placeholder: "CRUZ" },
                                                { field: "suffix", label: "Suffix", placeholder: "JR." },
                                            ].map(({ field, label, placeholder }) => (
                                                <div key={field} className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        {label} {field !== "middleName" && field !== "suffix" && <span className="text-red-500">*</span>}
                                                    </Label>
                                                    <Input
                                                        id={`children.${idx}.${field}`}
                                                        name={`children.${idx}.${field}`}
                                                        value={(child as any)[field]}
                                                        onChange={e => handleChildNameChange(idx, field as any, e.target.value)}
                                                        placeholder={placeholder}
                                                        className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus-visible:border-theme-primary focus-visible:ring-theme-primary/25 focus-visible:ring-[3px] shadow-sm", errors[`children.${idx}.${field}`] && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20")}
                                                    />
                                                    {errors[`children.${idx}.${field}`] && <p className="text-xs text-red-500 font-semibold">{errors[`children.${idx}.${field}`]}</p>}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sex <span className="text-red-500">*</span></Label>
                                                <Select value={child.sex} onValueChange={val => handleChildNameChange(idx, "sex", val)}>
                                                    <SelectTrigger id={`children.${idx}.sex`} className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus:border-theme-primary focus:ring-4 focus:ring-theme-primary/15 shadow-sm", errors[`children.${idx}.sex`] && "border-red-500 focus:border-red-500 focus:ring-red-500/20")}>
                                                        <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl mt-2 max-h-60 overflow-y-auto">
                                                        <SelectItem value="MALE" className="hover:bg-theme-primary/10 dark:hover:bg-theme-primary/15 font-black uppercase text-xs tracking-wider transition-colors">Male</SelectItem>
                                                        <SelectItem value="FEMALE" className="hover:bg-theme-primary/10 dark:hover:bg-theme-primary/15 font-black uppercase text-xs tracking-wider transition-colors">Female</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {errors[`children.${idx}.sex`] && <p className="text-xs text-red-500 font-semibold">{errors[`children.${idx}.sex`]}</p>}
                                            </div>
                                            {form.birthType !== "SINGLE" && (
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Time of Birth <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id={`children.${idx}.birthTime`}
                                                        type="time"
                                                        value={child.birthTime}
                                                        onChange={e => handleChildNameChange(idx, "birthTime", e.target.value)}
                                                        className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus-visible:border-theme-primary focus-visible:ring-theme-primary/25 focus-visible:ring-[3px] shadow-sm", errors[`children.${idx}.birthTime`] && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20")}
                                                    />
                                                    {errors[`children.${idx}.birthTime`] && <p className="text-xs text-red-500 font-semibold">{errors[`children.${idx}.birthTime`]}</p>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Date & Place of Birth */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date of Birth <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="dateOfEvent"
                                            type="date"
                                            name="dateOfEvent"
                                            value={form.dateOfEvent}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={e => handleDateOfEventChange(e.target.value)}
                                            className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus-visible:border-theme-primary focus-visible:ring-theme-primary/25 focus-visible:ring-[3px] shadow-sm", errors.dateOfEvent && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20")}
                                        />
                                        {errors.dateOfEvent && <p className="text-xs text-red-500 font-semibold">{errors.dateOfEvent}</p>}
                                        {form.registrationType === "LATE" && (
                                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">⚠ Delayed Registration — additional fees apply</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Place of Birth <span className="text-red-500">*</span></Label>
                                        <Select
                                            value={barangaysList.find(b => (form.placeOfEvent || "").toUpperCase().includes(b.toUpperCase())) || ""}
                                            onValueChange={(val) => {
                                                setForm(prev => ({ ...prev, placeOfEvent: val.toUpperCase() }));
                                                setErrors(prev => { const c = { ...prev }; delete c.placeOfEvent; return c; });
                                            }}
                                        >
                                            <SelectTrigger id="placeOfEvent" className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase italic bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus:border-theme-primary focus:ring-4 focus:ring-theme-primary/15 shadow-sm", errors.placeOfEvent && "border-red-500 focus:border-red-500 focus:ring-red-500/20")}>
                                                <SelectValue placeholder="SELECT BARANGAY..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl mt-2 max-h-60 overflow-y-auto">
                                                {barangaysList.map(b => (
                                                    <SelectItem key={b} value={b} className="hover:bg-theme-primary/10 dark:hover:bg-theme-primary/15 font-black uppercase text-xs tracking-wider transition-colors">{b.toUpperCase()}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.placeOfEvent && <p className="text-xs text-red-500 font-semibold">{errors.placeOfEvent}</p>}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* ============ STEP: PARENTS ============ */}
                        {currentStep === "PARENTS" && (
                            <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-8">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                                        <Users className="w-8 h-8 text-slate-900 dark:text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">Parental Information</h2>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Father and mother details</p>
                                    </div>
                                </div>

                                {/* Marital Status */}
                                <div id="parents-married-section" className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Are parents married? <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-4">
                                        {[{ val: true, label: "Yes, Married" }, { val: false, label: "No, Not Married" }].map(opt => (
                                            <button
                                                key={String(opt.val)}
                                                onClick={() => { setForm(prev => ({ ...prev, parentsMarried: opt.val })); setErrors(prev => { const c = { ...prev }; delete c.parentsMarried; return c; }); }}
                                                className={cn(
                                                    "flex-1 py-4 rounded-2xl border-2 text-xs font-black uppercase tracking-wide transition-all duration-200 cursor-pointer",
                                                    form.parentsMarried === opt.val
                                                        ? "border-theme-primary bg-theme-primary/10 text-theme-primary"
                                                        : errors.parentsMarried
                                                            ? "border-red-500 dark:border-red-500/80 text-slate-600 dark:text-slate-400 hover:border-red-650"
                                                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-theme-primary/30"
                                                )}
                                            >
                                                {opt.val && form.parentsMarried === true ? <Check className="w-4 h-4 inline mr-1.5" /> : null}
                                                {!opt.val && form.parentsMarried === false ? <Check className="w-4 h-4 inline mr-1.5" /> : null}
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    {errors.parentsMarried && <p className="text-xs text-red-500 font-semibold">{errors.parentsMarried}</p>}
                                </div>

                                {/* Father */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-white/10 pb-2">Father's Name</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { field: "fatherFirstName", label: "First Name", req: false },
                                            { field: "fatherMiddleName", label: "Middle Name", req: false },
                                            { field: "fatherLastName", label: "Last Name", req: false },
                                        ].map(({ field, label, req }) => (
                                            <div key={field} className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label} {req && <span className="text-red-500">*</span>}</Label>
                                                <Input
                                                    id={field}
                                                    name={field}
                                                    value={(form as any)[field] || ""}
                                                    onChange={e => { setForm(prev => ({ ...prev, [field]: e.target.value.toUpperCase() })); setErrors(prev => { const c = { ...prev }; delete c[field]; return c; }); }}
                                                    placeholder={label.split(' ')[0].toUpperCase()}
                                                    className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus-visible:border-theme-primary focus-visible:ring-theme-primary/25 focus-visible:ring-[3px] shadow-sm", errors[field] && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20")}
                                                />
                                                {errors[field] && <p className="text-xs text-red-500 font-semibold">{errors[field]}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Mother */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-white/10 pb-2">Mother's Maiden Name</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { field: "motherFirstName", label: "First Name", req: true },
                                            { field: "motherMiddleName", label: "Middle Name", req: false },
                                            { field: "motherLastName", label: "Last Name (Maiden)", req: true },
                                        ].map(({ field, label, req }) => (
                                            <div key={field} className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label} {req && <span className="text-red-500">*</span>}</Label>
                                                <Input
                                                    id={field}
                                                    name={field}
                                                    value={(form as any)[field] || ""}
                                                    onChange={e => { setForm(prev => ({ ...prev, [field]: e.target.value.toUpperCase() })); setErrors(prev => { const c = { ...prev }; delete c[field]; return c; }); }}
                                                    placeholder={label.split(' ')[0].toUpperCase()}
                                                    className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 text-slate-900 dark:text-white font-black uppercase bg-slate-50/20 dark:bg-black/20 backdrop-blur-md transition-all hover:border-theme-primary/45 focus-visible:border-theme-primary focus-visible:ring-theme-primary/25 focus-visible:ring-[3px] shadow-sm", errors[field] && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20")}
                                                />
                                                {errors[field] && <p className="text-xs text-red-500 font-semibold">{errors[field]}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* ============ STEP: UPLOAD ============ */}
                        {currentStep === "UPLOAD" && (
                            <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-8 flex-1 flex flex-col">
                                <RequiredDocuments
                                    title="Upload Documents"
                                    subtitle="Please upload the required files to proceed with your birth registration"
                                    warningBanner={
                                        form.registrationType === "LATE" ? (
                                            <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/20">
                                                <div className="flex items-start gap-3">
                                                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Delayed Registration Evidence Required</p>
                                                        <p className="text-[9px] text-amber-600/80 dark:text-amber-400/80 italic mt-1 leading-relaxed">
                                                            You must select two supporting evidence documents (e.g., Baptismal Certificate, School Records, Medical Records) and upload them along with the negative PSA cert and late affidavit.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-2xl bg-theme-primary/5 border border-theme-primary/10">
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle2 className="w-4 h-4 text-theme-primary shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-theme-primary">Timely Registration Uploads</p>
                                                        <p className="text-[9px] text-slate-500 italic mt-1 leading-relaxed">
                                                            Please upload the parent's marriage certificate and Municipal Form 102 (for married parents) or community tax certificate (for unmarried mother).
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    errorText={errors.documents}
                                    documents={getRequiredDocsList()}
                                >
                                    {form.registrationType === "LATE" && (
                                        <div id="supporting-evidence-section" className="space-y-4 p-6 rounded-[2rem] bg-slate-50/50 dark:bg-slate-800/10 border border-slate-200 dark:border-white/5 mt-6">
                                            <div>
                                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 italic">Select Supporting Evidence Types</h3>
                                                <p className="text-[10px] text-slate-500 italic mt-1 font-semibold">Choose exactly two (2) types of supporting documents to upload</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                                {EVIDENCE_OPTIONS.map((opt) => {
                                                    const isSelected = form.supportingEvidenceTypes?.includes(opt.value);
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => toggleSupportingEvidence(opt.value)}
                                                            className={cn(
                                                                "flex items-center justify-between text-left p-4 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-wide cursor-pointer",
                                                                isSelected
                                                                    ? "border-theme-primary bg-theme-primary/10 text-theme-primary"
                                                                    : "border-slate-200 dark:border-white/10 text-slate-650 dark:text-slate-350 hover:border-theme-primary/30"
                                                            )}
                                                        >
                                                            <span className="truncate pr-2">{opt.label}</span>
                                                            <div className={cn(
                                                                "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                                                isSelected ? "bg-theme-primary border-theme-primary text-white" : "border-slate-300 dark:border-white/20 bg-white dark:bg-black/20"
                                                            )}>
                                                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {errors.supportingEvidenceTypes && (
                                                <p className="text-xs text-red-500 font-semibold mt-2">{errors.supportingEvidenceTypes}</p>
                                            )}
                                        </div>
                                    )}
                                </RequiredDocuments>
                            </Card>
                        )}

                        {/* ============ STEP: CONFIRM (Documents & Submit) ============ */}
                        {currentStep === "CONFIRM" && (
                            <ReviewAndSubmit
                                title="Review & Confirm"
                                subtitle="Please review your details and uploaded documents before final submission"
                                policyAccepted={policyAccepted}
                                onPolicyAcceptedChange={setPolicyAccepted}
                                onReviewPolicy={() => setPolicyOpen(true)}
                                showErrors={!!errors.policyAccepted}
                                policyErrorText={errors.policyAccepted}
                                submitting={submitting}
                                submitLabel="Submit Application"
                                onSubmit={handleSubmit}
                                onBack={goPrev}
                                backLabel="Previous"
                                detailsCards={
                                    <div className="grid md:grid-cols-2 gap-6">
                                        {/* Card 1: Child Details */}
                                        <Card className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                                <Baby size={16} /> Child Details
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Full Name</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                                                        {form.children.map(c => [c.firstName, c.middleName, c.lastName, c.suffix].filter(Boolean).join(" ")).join(", ")}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Gender</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{form.children[0]?.sex || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Birth</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold">
                                                        {form.dateOfEvent ? new Date(form.dateOfEvent).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                                                    </span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Place of Birth</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">{form.placeOfEvent || "N/A"}</span>
                                                </div>
                                            </div>
                                        </Card>

                                        {/* Card 2: Parental Info */}
                                        <Card className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                                <Users size={16} /> Parents Information
                                            </h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Father's Full Name</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                                                        {[form.fatherFirstName, form.fatherMiddleName, form.fatherLastName].filter(Boolean).join(" ") || "N/A"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Mother's Maiden Name</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                                                        {[form.motherFirstName, form.motherMiddleName, form.motherLastName].filter(Boolean).join(" ") || "N/A"}
                                                    </span>
                                                </div>
                                            </div>
                                        </Card>

                                        {/* Card 3: Informant details */}
                                        <Card className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-4 md:col-span-2">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                                <User size={16} /> Informant & Contact Info
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Relationship</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold uppercase">
                                                        {form.relationship === "OTHER" ? form.relationshipSpecify : form.relationship}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Contact Number</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold">{form.contactNumber || "N/A"}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Email Address</span>
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold">{form.email || "N/A"}</span>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                }
                                documentsSection={
                                    hasUploadedDocs() ? (
                                        <div className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white">
                                                    <Upload size={18} className="stroke-[2.5]" />
                                                </div>
                                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Uploaded Documents</h3>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {form.registrationType === "STANDARD" ? (
                                                    <>
                                                        {form.parentsMarried && renderReadOnlyDocCard("marriageCertificate", "Marriage Certificate of Parents")}
                                                        {form.parentsMarried && renderReadOnlyDocCard("municipalForm102", "Municipal Form 102 (Certificate of Live Birth)")}
                                                        {!form.parentsMarried && renderReadOnlyDocCard("communityTaxCertificate", "Community Tax Certificate (Cedula)")}
                                                    </>
                                                ) : (
                                                    <>
                                                        {renderReadOnlyDocCard("negativePSA", "Negative Certification from PSA")}
                                                        {renderReadOnlyDocCard("colb", "Certificate of Live Birth (COLB)")}
                                                        {renderReadOnlyDocCard("affidavitDelayed", "Affidavit of Delayed Registration")}
                                                        {form.parentsMarried && renderReadOnlyDocCard("marriageCertificate", "Marriage Certificate of Parents")}
                                                        {form.parentsMarried && renderReadOnlyDocCard("municipalForm102", "Municipal Form 102")}
                                                        {!form.parentsMarried && renderReadOnlyDocCard("communityTaxCertificate", "Community Tax Certificate (Cedula)")}
                                                    </>
                                                )}
                                                {form.registrationType === "LATE" && (
                                                    <>
                                                        {form.supportingEvidence1Type && renderReadOnlyDocCard("supportingEvidence1", `Evidence 1: ${EVIDENCE_LABELS[form.supportingEvidence1Type] || form.supportingEvidence1Type}`)}
                                                        {form.supportingEvidence2Type && renderReadOnlyDocCard("supportingEvidence2", `Evidence 2: ${EVIDENCE_LABELS[form.supportingEvidence2Type] || form.supportingEvidence2Type}`)}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : null
                                }
                                feeSummary={
                                    <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 relative overflow-hidden">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white">
                                                <CheckCircle2 size={18} className="stroke-[2.5]" />
                                            </div>
                                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Fee Summary</h3>
                                        </div>
                                        <div className="space-y-3 text-xs md:text-sm font-bold">
                                            <div className="flex justify-between items-center border-b border-dashed border-slate-200 dark:border-white/10 pb-3">
                                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Registration Type</span>
                                                <span className={cn("text-xs font-black uppercase px-2.5 py-1 rounded-full border",
                                                    form.registrationType === "LATE"
                                                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                                        : "bg-theme-primary/20 text-theme-primary border-theme-primary/30"
                                                )}>
                                                    {form.registrationType === "LATE" ? `Delayed (${form.lateDuration} yrs)` : "Timely"}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-dashed border-slate-200 dark:border-white/10 pb-3">
                                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Base Fee</span>
                                                <span className="text-slate-700 dark:text-slate-350">₱{baseFee.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-dashed border-slate-200 dark:border-white/10 pb-3">
                                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Processing & e-Copy Fee</span>
                                                <span className="text-slate-700 dark:text-slate-350">₱{dbProcessingFee.toFixed(2)}</span>
                                            </div>

                                            {/* Total Receipt Row */}
                                            <div className="flex justify-between items-center bg-gradient-to-r from-theme-primary to-theme-secondary/85 text-white rounded-2xl p-4 md:p-6 shadow-xl shadow-theme-primary/10 mt-6">
                                                <span className="font-black uppercase tracking-widest text-[10px] md:text-xs">Total Amount Due</span>
                                                <span className="font-black text-xl md:text-2xl tracking-tight">₱{totalAmount.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </Card>
                                }
                            />
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation Buttons */}
                {currentStep !== "EXISTING" && currentStep !== "SUBMIT" && currentStep !== "CONFIRM" && (
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
                        <Button
                            variant="outline"
                            onClick={stepIndex === 0 ? (existingRequests.length > 0 ? () => setCurrentStep("EXISTING") : () => router.push("/modules/civil-registry")) : goPrev}
                            className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-bold uppercase tracking-wider text-xs px-6 py-5 rounded-2xl transition-all"
                        >
                            <ChevronLeft className="inline-block mr-1 w-4 h-4" />
                            {stepIndex === 0 ? (existingRequests.length > 0 ? "Back to List" : "Back to Hub") : "Previous"}
                        </Button>

                        <Button
                            onClick={goNext}
                            className="bg-theme-primary hover:bg-theme-hover text-white font-black uppercase tracking-wider text-xs px-8 py-5 shadow-lg shadow-theme-primary/20 cursor-pointer rounded-2xl transition-all"
                        >
                            Next Step <ChevronRight className="inline-block ml-1 w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Reusable QR Handoff Modal */}
            <SecureQrUploadModal
                isOpen={isHandoffOpen}
                onClose={() => { setIsHandoffOpen(false); setHandoffToken(""); }}
                qrCode={handoffQrCode}
                expiresAt={handoffExpiresAt}
                slotLabel={getHandoffSlotLabel()}
            />
        </div>
    );
}
