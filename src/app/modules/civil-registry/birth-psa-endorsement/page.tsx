/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
"use client";


import React, { useState, useEffect, useRef } from "react";
import SecureIdleTimer from "@/components/shared/SecureIdleTimer";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Loader2,
    AlertCircle,
    ArrowRight,
    Upload,
    CheckCircle2,
    ChevronLeft,
    Printer,
    Baby,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    getCurrentUserResident,
    ensureCivilRegistryTransactionTypes,
    submitCivilRegistryTransaction,
    getTransactionTypes,
    getLatestForm1AForCurrentUser,
    getTransactionById,
    getSecureUploadUrlAction,
    getExistingPsaEndorsements
} from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { saveDraftFile, getDraftFiles, clearDraftFiles } from "@/lib/draftDb";
import RequestList from "../_components/request-list";
import InformantInfo from "../_components/informant-info";
import ReviewAndSubmit from "../_components/review-and-submit";
import RequiredDocuments from "../_components/required-documents";
import ReadOnlyDocumentPreview from "../_components/read-only-document-preview";



// --- UPLOAD FILE SECURELY VIA SIGNED UPLOAD URL ---
async function uploadFileClientSide(file: File, fieldName: string, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'bin';

    const res = await getSecureUploadUrlAction(fieldName, "lcr/birth_psa_endorsement", fileExt, userId);
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

function getMimeType(ext: string) {
    const e = ext.toLowerCase();
    if (e === "pdf") return "application/pdf";
    if (e === "png") return "image/png";
    if (e === "jpg" || e === "jpeg") return "image/jpeg";
    if (e === "webp") return "image/webp";
    if (e === "gif") return "image/gif";
    return `application/${ext}`;
}


const STORAGE_KEY = "lcr_birth_psa_endorsement_draft";

type Step = "EXISTING" | "INFORMANT" | "SUBJECT" | "UPLOAD" | "REVIEW" | "SUBMIT";

const STEPS: { id: "INFORMANT" | "SUBJECT" | "UPLOAD" | "REVIEW"; label: string; icon: any }[] = [
    { id: "INFORMANT", label: "Informant Info", icon: User },
    { id: "SUBJECT", label: "Subject Details", icon: User },
    { id: "UPLOAD", label: "Upload Documents", icon: Upload },
    { id: "REVIEW", label: "Review & Submit", icon: CheckCircle2 },
];

export default function BirthPsaEndorsementPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string>("");
    const [currentStep, setCurrentStep] = useState<Step>("EXISTING");
    const [existingRequests, setExistingRequests] = useState<any[]>([]);
    const [selectedApplication, setSelectedApplication] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [resident, setResident] = useState<any>(null);
    const [typeId, setTypeId] = useState<string>("");
    const [dbBaseFee, setDbBaseFee] = useState<number>(150);
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [revisionTx, setRevisionTx] = useState<any>(null);
    const [showErrors, setShowErrors] = useState(false);

    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerFile, setViewerFile] = useState<File | null>(null);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState("");
    const [previews, setPreviews] = useState<Record<string, string | null>>({});

    // QR Upload Handoff State
    const [handoffToken, setHandoffToken] = useState("");
    const [handoffQrCode, setHandoffQrCode] = useState("");
    const [handoffSessionSlot, setHandoffSessionSlot] = useState("");
    const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
    const [isHandoffOpen, setIsHandoffOpen] = useState(false);
    const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);

    // QR Handoff Polling Effect
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
                    if (handoffSessionSlot === "lcr_birth_psa") {
                        let updated = false;
                        const psaFile = uploadedFiles.find((f: any) => f.slot === "psaNegativeCert");
                        const form1aFile = uploadedFiles.find((f: any) => f.slot === "form1a");

                        if (psaFile && previews.psaNegativeCert !== psaFile.url) {
                            const fileExt = psaFile.url.split('.').pop() || 'bin';
                            const fakeFile = new File([], psaFile.fileName, { type: getMimeType(fileExt) });
                            setFiles(prev => ({ ...prev, psaNegativeCert: fakeFile }));
                            setPreviews(prev => ({ ...prev, psaNegativeCert: psaFile.url }));
                            saveDraftFile(STORAGE_KEY, "psaNegativeCert", fakeFile).catch(err => console.error("Failed to save draft file in IndexedDB:", err));
                            updated = true;
                        }

                        if (form1aFile && previews.form1a !== form1aFile.url) {
                            const fileExt = form1aFile.url.split('.').pop() || 'bin';
                            const fakeFile = new File([], form1aFile.fileName, { type: getMimeType(fileExt) });
                            setFiles(prev => ({ ...prev, form1a: fakeFile }));
                            setPreviews(prev => ({ ...prev, form1a: form1aFile.url }));
                            saveDraftFile(STORAGE_KEY, "form1a", fakeFile).catch(err => console.error("Failed to save draft file in IndexedDB:", err));
                            updated = true;
                        }

                        if (updated) {
                            toast.success("Document uploaded successfully from mobile device!");
                        }

                        if (psaFile && form1aFile) {
                            setIsHandoffOpen(false);
                            setHandoffToken("");
                            toast.success("Both documents uploaded successfully!");
                        }
                    } else {
                        const uploadedFile = uploadedFiles[0];
                        if (uploadedFile) {
                            const targetKey = handoffSessionSlot.replace("lcr_", "");
                            const fileExt = uploadedFile.url.split('.').pop() || 'bin';
                            const fakeFile = new File([], uploadedFile.fileName, { type: getMimeType(fileExt) });

                            setFiles(prev => ({ ...prev, [targetKey]: fakeFile }));
                            setPreviews(prev => ({ ...prev, [targetKey]: uploadedFile.url }));

                            saveDraftFile(STORAGE_KEY, targetKey, fakeFile).catch(err => console.error("Failed to save draft file in IndexedDB:", err));

                            setIsHandoffOpen(false);
                            setHandoffToken("");
                            toast.success("Document uploaded successfully from mobile device!");
                        }
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
    }, [handoffToken, handoffSessionSlot, previews]);

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
            lcr_psaNegativeCert: "PSA Negative Certification",
            lcr_form1a: "Form 1A (Local Registry Copy)",
            lcr_birth_psa: "PSA Negative & Form 1A Documents"
        };
        return map[handoffSessionSlot] || "Document";
    };

    const handleOpenViewer = (file: File | null, title: string, url: string | null = null) => {
        setViewerFile(file);
        setViewerUrl(url);
        setViewerTitle(title);
        setViewerOpen(true);
    };

    // Form State
    const [formData, setFormData] = useState({
        relationship: "",
        email: "",
        contactNumber: "",
        informantFirstName: "",
        informantMiddleName: "",
        informantLastName: "",
        informantSuffix: "",
        informantBirthDate: "",
        informantAge: "",
        informantCivilStatus: "",
        informantCitizenship: "",
        informantOccupation: "",
        informantAddress: "",
        // Subject fields
        subjectFullName: "",
        subjectDateOfBirth: "",
        mothersMaidenName: "",
    });

    const [files, setFiles] = useState<Record<string, File | null>>({
        psaNegativeCert: null,
        form1a: null,
    });

    // Privacy / Terms modal state
    const [policyOpen, setPolicyOpen] = useState(false);
    const [policyAccepted, setPolicyAccepted] = useState(false);

    const handleAcceptPolicy = () => { setPolicyOpen(false); setPolicyAccepted(true); };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _isRestoredRef = useRef(false);

    // Restore progress from session storage & IndexedDB
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("revisionId")) return;

        const savedStep = sessionStorage.getItem("psa-endorsement-step");
        const savedForm = sessionStorage.getItem("psa-endorsement-form");
        const savedPreviews = sessionStorage.getItem("psa-endorsement-previews");

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
                setFormData(prev => ({
                    ...prev,
                    ...parsed
                }));
            } catch (e) {
                console.error("Failed to parse saved form", e);
            }
        }
        if (savedPreviews) {
            try {
                const parsed = JSON.parse(savedPreviews);
                setPreviews(prev => ({
                    ...prev,
                    ...parsed
                }));
            } catch (e) {
                console.error("Failed to parse saved previews", e);
            }
        }

        // Hydrate files from IndexedDB
        async function hydrateFiles() {
            try {
                const draftFiles = await getDraftFiles(STORAGE_KEY);
                if (draftFiles && Object.keys(draftFiles).length > 0) {
                    setFiles(prev => ({
                        ...prev,
                        ...draftFiles
                    }));

                    // Also regenerate blob preview URLs for real local files
                    const newPreviews: Record<string, string | null> = {};
                    Object.entries(draftFiles).forEach(([key, fileObj]) => {
                        if (fileObj && fileObj instanceof File && fileObj.size > 0) {
                            if (fileObj.type.startsWith("image/")) {
                                newPreviews[key] = URL.createObjectURL(fileObj);
                            }
                        }
                    });
                    if (Object.keys(newPreviews).length > 0) {
                        setPreviews(prev => ({ ...prev, ...newPreviews }));
                    }

                    toast.info("Progress restored. Uploaded document drafts recovered.", {
                        duration: 6000
                    });
                }
            } catch (error) {
                console.error("Failed to hydrate draft files from IndexedDB:", error);
            }
        }

        hydrateFiles();
    }, []);

    useEffect(() => {
        if (!loading && !revisionId) {
            sessionStorage.setItem("psa-endorsement-step", currentStep);
            sessionStorage.setItem("psa-endorsement-form", JSON.stringify(formData));

            // Save non-blob preview URLs (like remote Supabase URLs)
            const remotePreviews: Record<string, string> = {};
            Object.entries(previews).forEach(([key, val]) => {
                if (val && val.startsWith("http")) {
                    remotePreviews[key] = val;
                }
            });
            sessionStorage.setItem("psa-endorsement-previews", JSON.stringify(remotePreviews));
        }
    }, [currentStep, formData, previews, loading, revisionId]);

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

                const [resResult, typesResult, existingRes] = await Promise.all([
                    getCurrentUserResident(uId),
                    getTransactionTypes(),
                    getExistingPsaEndorsements(uId)
                ]);

                if (resResult.success && resResult.data) {
                    const r = resResult.data;
                    setResident(r);

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

                        const previews: Record<string, string | null> = {};
                        const fileKeys = ["psaNegativeCert", "form1a"];
                        fileKeys.forEach(k => {
                            if (addData[k] && typeof addData[k] === "string" && addData[k].startsWith("http")) {
                                previews[k] = addData[k];
                            }
                        });

                        setFormData(prev => ({
                            ...prev,
                            relationship: addData.relationship || prev.relationship,
                            email: addData.email || resSnapshot.email || prev.email,
                            contactNumber: addData.contactNumber || resSnapshot.contactNumber || prev.contactNumber,
                            informantFirstName: addData.informantFirstName || resSnapshot.firstName || prev.informantFirstName,
                            informantMiddleName: addData.informantMiddleName || resSnapshot.middleName || prev.informantMiddleName,
                            informantLastName: addData.informantLastName || resSnapshot.lastName || prev.informantLastName,
                            informantSuffix: addData.informantSuffix || resSnapshot.suffix || prev.informantSuffix,
                            informantBirthDate: addData.informantBirthDate || prev.informantBirthDate,
                            informantAge: addData.informantAge || prev.informantAge,
                            informantCivilStatus: addData.informantCivilStatus || prev.informantCivilStatus,
                            informantCitizenship: addData.informantCitizenship || prev.informantCitizenship,
                            informantOccupation: addData.informantOccupation || prev.informantOccupation,
                            informantAddress: addData.informantAddress || prev.informantAddress,
                            subjectFullName: addData.subjectFullName || "",
                            subjectDateOfBirth: addData.subjectDateOfBirth || "",
                            mothersMaidenName: addData.mothersMaidenName || "",
                        }));
                        setPreviews(previews);
                    } else {
                        setFormData(prev => ({
                            ...prev,
                            email: prev.email || r.user?.email || "",
                            contactNumber: prev.contactNumber || r.contactNumber || "",
                            informantFirstName: r.firstName || "",
                            informantMiddleName: r.middleName || "",
                            informantLastName: r.lastName || "",
                            informantSuffix: r.suffix || "",
                            informantBirthDate: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : "",
                            informantAge: r.age?.toString() || "",
                            informantCivilStatus: r.civilStatus || "",
                            informantCitizenship: r.citizenship || "FILIPINO",
                            informantOccupation: r.occupation || "",
                            informantAddress: constructedAddr
                        }));
                    }
                }

                if (typesResult.success && typesResult.data) {
                    const psaType = typesResult.data.find((t: any) => t.code === "LCR_PSA_ENDORSEMENT");
                    if (psaType) {
                        setTypeId(psaType.id);
                        setDbBaseFee(Number(psaType.baseFee ?? 150));
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
                    setCurrentStep("INFORMANT");
                } else if (existingRes.success && existingRes.data && existingRes.data.length > 0) {
                    const savedStep = sessionStorage.getItem("psa-endorsement-step");
                    if (savedStep && savedStep !== "SUBMIT") {
                        setCurrentStep(savedStep as Step);
                    } else {
                        setCurrentStep("EXISTING");
                    }
                } else {
                    const savedStep = sessionStorage.getItem("psa-endorsement-step");
                    if (savedStep && savedStep !== "SUBMIT") {
                        setCurrentStep(savedStep as Step);
                    } else {
                        setCurrentStep("INFORMANT");
                    }
                }
            } catch (error) {
                console.error("Initialization error:", error);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === "relationship") {
                if (value === "SELF" && resident) {
                    const sName = [resident.firstName, resident.middleName, resident.lastName].filter(Boolean).join(" ") + (resident.suffix ? " " + resident.suffix : "");
                    const sDob = resident.dateOfBirth ? new Date(resident.dateOfBirth).toISOString().split('T')[0] : "";
                    const mName = [resident.motherFirstName, resident.motherMiddleName, resident.motherLastName].filter(Boolean).join(" ");

                    next.subjectFullName = sName.toUpperCase();
                    next.subjectDateOfBirth = sDob;
                    next.mothersMaidenName = mName.toUpperCase();
                } else {
                    next.subjectFullName = "";
                    next.subjectDateOfBirth = "";
                    next.mothersMaidenName = "";
                }
            }
            return next;
        });

        if (name === "relationship" && value !== "SELF") {
            setFiles(prev => ({ ...prev, form1a: null }));
            saveDraftFile(STORAGE_KEY, "form1a", null).catch(err => {
                console.error("Failed to delete draft Form 1A file from IndexedDB:", err);
            });
        }

        if (name === "relationship" && value === "SELF") {
            const promise = (async () => {
                const res = await getLatestForm1AForCurrentUser(userId);
                if (res.success && res.data) {
                    const { docUrl, subjectName, dateOfBirth, mothersMaidenName } = res.data;

                    setFormData(prev => ({
                        ...prev,
                        subjectFullName: subjectName ? subjectName.toUpperCase() : prev.subjectFullName,
                        subjectDateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString().split('T')[0] : prev.subjectDateOfBirth,
                        mothersMaidenName: mothersMaidenName ? mothersMaidenName.toUpperCase() : prev.mothersMaidenName
                    }));

                    if (docUrl) {
                        try {
                            const response = await fetch(docUrl);
                            const blob = await response.blob();
                            const filename = docUrl.split('/').pop() || "form_1a.pdf";
                            const file = new File([blob], filename, { type: blob.type });

                            setFiles(prev => ({
                                ...prev,
                                form1a: file
                            }));
                            setPreviews(prev => ({
                                ...prev,
                                form1a: docUrl
                            }));

                            await saveDraftFile(STORAGE_KEY, "form1a", file);
                            toast.success("Latest Form 1A found and automatically attached from your transactions!");
                        } catch (err) {
                            console.error("Failed to download Form 1A file:", err);
                        }
                    }
                }
            })();
            toast.promise(promise, {
                loading: "Checking for your latest issued Form 1A in transactions...",
                success: "Form 1A status checked.",
                error: "Failed to check or fetch Form 1A document."
            });
        }
    };

    const validateStep = (step: Step): boolean => {
        const errs: Record<string, string> = {};
        if (step === "INFORMANT") {
            if (!formData.relationship) errs.relationship = "Required";
            if (!formData.contactNumber) errs.contactNumber = "Required";
        } else if (step === "SUBJECT") {
            if (!formData.subjectFullName?.trim()) errs.subjectFullName = "Required";
            if (!formData.subjectDateOfBirth) errs.subjectDateOfBirth = "Required";
            if (!formData.mothersMaidenName?.trim()) errs.mothersMaidenName = "Required";
        } else if (step === "UPLOAD") {
            if (!files.psaNegativeCert && !previews.psaNegativeCert) errs.psaNegativeCert = "Required";
            if (!files.form1a && !previews.form1a) errs.form1a = "Required";
        }

        const valid = Object.keys(errs).length === 0;
        setShowErrors(!valid);

        if (!valid) {
            const firstErrorKey = Object.keys(errs)[0];
            if (step === "INFORMANT") {
                toast.error("Please fill in all required informant details.");
            } else if (step === "SUBJECT") {
                toast.error("Please fill in all subject details.");
            } else if (step === "UPLOAD") {
                if (errs.psaNegativeCert) toast.error("Please upload PSA Negative Certification.");
                else if (errs.form1a) toast.error("Please upload Form 1A (Local Registry Copy).");
            }

            setTimeout(() => {
                if (firstErrorKey) {
                    let element: any = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
                    if (!element && firstErrorKey === "relationship") {
                        element = (document.querySelector('[role="combobox"]') || document.querySelector('button[aria-autocomplete="none"]')) as any;
                    }
                    if (element) {
                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                        element.focus();
                    }
                }
            }, 100);
        }
        return valid;
    };

    const handleSubmit = async () => {
        if (submitting) return;
        if (!policyAccepted) {
            setShowErrors(true);
            toast.error("Please review and accept the Privacy Policy & Terms before submitting. Click Review to open the agreement.");
            return;
        }
        if (!typeId) {
            toast.error("Service type not initialized. Please try again later.");
            return;
        }

        if (!validateStep("INFORMANT") || !validateStep("SUBJECT") || !validateStep("UPLOAD")) {
            return;
        }

        setSubmitting(true);
        try {
            const data = new FormData();
            data.append("typeId", typeId);
            data.append("registryType", "BIRTH_PSA_ENDORSEMENT");
            if (revisionId) {
                data.append("revisionId", revisionId);
            }

            const residentSnapshot = {
                firstName: resident?.firstName || "",
                middleName: resident?.middleName || "",
                lastName: resident?.lastName || "",
                suffix: resident?.suffix || "",
                contactNumber: resident?.contactNumber || "",
                email: resident?.user?.email || "",
                residentId: resident?.residentId || "",
                address: resident ? `Brgy. ${resident.barangay}, ${resident?.municipality || ""}` : ""
            };

            data.append("residentSnapshot", JSON.stringify(residentSnapshot));

            const fileUrls: Record<string, string> = {};

            // First, copy any existing public URLs from previews
            Object.entries(previews || {}).forEach(([key, url]) => {
                if (url && typeof url === "string" && url.startsWith("http")) {
                    fileUrls[key] = url;
                }
            });

            const fileEntries = Object.entries(files);
            for (let i = 0; i < fileEntries.length; i++) {
                const [key, file] = fileEntries[i];
                if (!file) continue;
                const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');

                if (fileUrls[key]) {
                    console.log(`[ClientUpload] Reusing existing public URL for ${key}:`, fileUrls[key]);
                    continue;
                }

                try {
                    toast.loading(`Uploading document ${i + 1}/${fileEntries.length}...`, { id: "upload-toast" });
                    const url = await uploadFileClientSide(file, sanitizedKey, userId);
                    fileUrls[key] = url;
                } catch (uploadErr) {
                    console.error(`[ClientUpload] Failed to upload ${key}:`, uploadErr);
                    toast.error(`Failed to upload document: ${key}. Please try again.`, { id: "upload-toast" });
                    setSubmitting(false);
                    return;
                }
            }
            toast.dismiss("upload-toast");

            const additionalData = {
                ...formData,
                subjectName: formData.subjectFullName,
                psaEndorsementFee: 200,
                ...fileUrls
            };
            data.append("additionalData", JSON.stringify(additionalData));

            const res = await submitCivilRegistryTransaction(data, userId);

            if (res.success && res.data) {
                toast.success(revisionId ? "Revision resubmitted successfully!" : "Birth PSA Endorsement submitted successfully!");
                sessionStorage.removeItem("psa-endorsement-step");
                sessionStorage.removeItem("psa-endorsement-form");
                await clearDraftFiles(STORAGE_KEY);

                const updated = await getExistingPsaEndorsements(userId);
                if (updated.success && updated.data) {
                    setExistingRequests(updated.data);
                    const newTxId = res.data.id || revisionId;
                    const match = updated.data.find((a: any) => a.id === newTxId);
                    if (match) {
                        setSelectedApplication(match);
                        setCurrentStep("SUBMIT");
                        return;
                    }
                }
                router.push("/dashboard");
            } else {
                toast.error(res.error || "Failed to submit endorsement request");
            }
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrintReceipt = () => {
        window.print();
    };


    return (
        <div className="h-full overflow-y-auto px-4 py-8 md:px-12 md:py-12 bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white">
            <SecureIdleTimer />
            <PrivacyTermsModal
                isOpen={policyOpen}
                onClose={() => setPolicyOpen(false)}
                onAccept={handleAcceptPolicy}
                onDecline={() => { setPolicyAccepted(false); }}
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
                                Birth PSA Endorsement
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
                            BIRTH <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">PSA ENDORSEMENT</span>
                        </h1>
                        <p className="text-[9px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">LCR Civil Registry Request Portal</p>
                    </div>
                    {currentStep === "EXISTING" ? (
                        <Button
                            onClick={() => {
                                setSelectedApplication(null);
                                setPolicyAccepted(false);
                                setCurrentStep("INFORMANT");
                            }}
                            className="bg-theme-primary hover:bg-theme-hover text-white font-bold uppercase tracking-wider rounded-2xl py-6 px-8 shadow-lg shadow-theme-primary/20 active:scale-95 transition-all text-xs"
                        >
                            New Endorsement Request
                        </Button>
                    ) : (
                        currentStep === "SUBMIT" && (
                            <div className="flex gap-4">
                                <Button
                                    onClick={() => setCurrentStep("EXISTING")}
                                    className="bg-[#151821] hover:bg-[#1a1e2c] text-slate-300 font-bold uppercase tracking-wider rounded-2xl py-6 px-8 border border-white/10 active:scale-95 transition-all text-xs"
                                >
                                    <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back to List
                                </Button>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Progress Stepper */}
            {currentStep !== "EXISTING" && currentStep !== "SUBMIT" && (
                <div className="mx-auto max-w-7xl mb-10">
                    <div className="grid grid-cols-4 gap-1 md:gap-4 relative px-1 md:px-2">
                        {STEPS.map((step, idx) => {
                            const isActive = currentStep === step.id;
                            const stepIdx = STEPS.findIndex(s => s.id === currentStep);
                            const isCompleted = stepIdx >= idx;
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

            <div className="mx-auto max-w-7xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-12 shadow-2xl relative min-h-[500px] flex flex-col text-slate-900 dark:text-white">
                <AnimatePresence mode="wait">
                    {/* ============ STEP: EXISTING ============ */}
                    {currentStep === "EXISTING" && (
                        <motion.div
                            key="existing-step"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="space-y-8 flex-1 flex flex-col"
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                                    Existing <span className="text-theme-primary">Endorsements</span>
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                    We found previous PSA endorsement requests under your profile.
                                </p>
                            </div>

                            <RequestList
                                requests={existingRequests}
                                onItemClick={(app) => {
                                    setSelectedApplication(app);
                                    setCurrentStep("SUBMIT");
                                }}
                                emptyMessage="No records found"
                                emptySubMessage="Submit your first endorsement request by clicking New Endorsement Request."
                                getSubjectName={(app) => {
                                    const addData = app.additionalData as any || {};
                                    return addData.subjectName || "Birth PSA Endorsement";
                                }}
                            />

                            {/* Navigation buttons at bottom of list */}
                            <div className="flex pt-8 mt-auto border-t border-slate-200 dark:border-white/10">
                                <Button
                                    type="button"
                                    onClick={() => router.push("/modules/civil-registry")}
                                    className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all"
                                >
                                    <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back to Hub
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* ============ STEP: SUBMIT (Receipt/Summary view) ============ */}
                    {currentStep === "SUBMIT" && selectedApplication && (() => {
                        const addData = selectedApplication.additionalData as any || {};
                        return (
                            <motion.div
                                key="submit-step"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                className="space-y-8 flex-1 flex flex-col"
                            >
                                <div className="text-center">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white flex items-center justify-center mx-auto mb-4 animate-bounce">
                                        <CheckCircle2 className="w-10 h-10" />
                                    </div>
                                    <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                                        Application <span className="text-theme-primary">Summary</span>
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                        Review details and current status of your PSA endorsement request.
                                    </p>
                                </div>

                                {/* Printable Receipt Frame */}
                                <div className="max-w-2xl mx-auto w-full bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden text-slate-900 dark:text-white backdrop-blur-2xl">
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
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Subject&apos;s Name</span>
                                                <span className="uppercase font-black text-theme-primary">{addData.subjectName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Birth</span>
                                                <span className="font-black">
                                                    {addData.subjectDateOfBirth
                                                        ? new Date(addData.subjectDateOfBirth).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                                                        : "N/A"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Informant</span>
                                                <span className="uppercase font-black">
                                                    {selectedApplication.residentSnapshot?.firstName
                                                        ? `${selectedApplication.residentSnapshot.firstName} ${selectedApplication.residentSnapshot.lastName}`
                                                        : addData.informantFirstName
                                                            ? `${addData.informantFirstName} ${addData.informantLastName}`
                                                            : "N/A"
                                                    }
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Relationship to Subject</span>
                                                <span className="uppercase font-bold">{addData.relationship || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Mother&apos;s Maiden Name</span>
                                                <span className="uppercase font-bold">{addData.mothersMaidenName || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                                        <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                                            <span className="text-slate-400">Total Application Fee</span>
                                            <span className="text-theme-primary text-sm">₱{(selectedApplication.totalAmount || 200).toFixed(2)}</span>
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
                                            <span>Your PSA endorsement request has been received. Our Civil Registry officers will verify the uploaded negative certification and Form 1A registry copy. You will be updated of the status.</span>
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
                                                window.location.href = `/modules/civil-registry/birth-psa-endorsement?revisionId=${selectedApplication.id}`;
                                            }}
                                            className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg"
                                        >
                                            Revise Details
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })()}

                    {/* ===== STEP 1: INFORMANT ===== */}
                    {currentStep === "INFORMANT" && (
                        <motion.div
                            key="informant-step"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Personal Information</h2>
                                <p className="text-xs text-slate-500 font-medium italic">Your details as the requesting informant</p>
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

                            <InformantInfo
                                firstName={formData.informantFirstName}
                                middleName={formData.informantMiddleName}
                                lastName={formData.informantLastName}
                                suffix={formData.informantSuffix}
                                birthDate={formData.informantBirthDate}
                                age={formData.informantAge}
                                civilStatus={formData.informantCivilStatus}
                                citizenship={formData.informantCitizenship}
                                address={formData.informantAddress}
                                relationship={formData.relationship}
                                occupation={formData.informantOccupation}
                                contactNumber={formData.contactNumber}
                                onRelationshipChange={(val) => handleSelectChange("relationship", val)}
                                onOccupationChange={(val) => setFormData(prev => ({ ...prev, informantOccupation: val }))}
                                onContactNumberChange={(val) => setFormData(prev => ({ ...prev, contactNumber: val }))}
                                relationshipOptions={[
                                    { value: "SELF", label: "SELF (I AM THE SUBJECT)" },
                                    { value: "CHILD", label: "CHILD" },
                                    { value: "PARENT", label: "PARENT" },
                                    { value: "SIBLING", label: "SIBLING" },
                                    { value: "RELATIVE", label: "OTHER RELATIVE" },
                                    { value: "REPRESENTATIVE", label: "AUTHORIZED REPRESENTATIVE" }
                                ]}
                                errors={{
                                    relationship: !formData.relationship ? "Required" : "",
                                    contactNumber: !formData.contactNumber ? "Required" : ""
                                }}
                                showErrors={showErrors}
                                isCardWrapped={false}
                            />

                            <div className="flex justify-between pt-6">
                                <Button
                                    variant="ghost"
                                    onClick={() => existingRequests.length > 0 ? setCurrentStep("EXISTING") : router.push("/modules/civil-registry")}
                                    className="rounded-full px-8 border-slate-200 dark:border-white/10 font-black uppercase tracking-widest italic text-[10px] h-12"
                                >
                                    <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                                    Back
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!validateStep("INFORMANT")) return;
                                        setCurrentStep("SUBJECT");
                                    }}
                                    className="rounded-full px-12 bg-theme-primary hover:bg-theme-hover text-white font-black uppercase tracking-widest italic text-[10px] h-12 shadow-xl shadow-theme-primary/20"
                                >
                                    Next Step
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP 2: SUBJECT DETAILS ===== */}
                    {currentStep === "SUBJECT" && (
                        <motion.div
                            key="subject-step"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight flex items-center gap-2">
                                    Subject Details
                                </h2>
                                <p className="text-xs text-slate-500 font-medium italic">Provide the details of the person whose birth record needs PSA endorsement</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2 space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Subject&apos;s Full Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="subjectFullName"
                                        name="subjectFullName"
                                        placeholder="ENTER FULL NAME OF SUBJECT"
                                        value={formData.subjectFullName}
                                        onChange={handleInputChange}
                                        className={cn(
                                            "rounded-xl bg-white dark:bg-slate-900 h-12 transition-all uppercase font-black text-slate-955 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600",
                                            (showErrors && !formData.subjectFullName) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10"
                                        )}
                                    />
                                    {(showErrors && !formData.subjectFullName) && (
                                        <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Date of Birth <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="subjectDateOfBirth"
                                        type="date"
                                        name="subjectDateOfBirth"
                                        value={formData.subjectDateOfBirth}
                                        onChange={handleInputChange}
                                        className={cn(
                                            "rounded-xl bg-white dark:bg-slate-900 h-12 transition-all font-black text-slate-955 dark:text-white dark:[color-scheme:dark]",
                                            (showErrors && !formData.subjectDateOfBirth) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10"
                                        )}
                                    />
                                    {(showErrors && !formData.subjectDateOfBirth) && (
                                        <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Mother&apos;s Maiden Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="mothersMaidenName"
                                        name="mothersMaidenName"
                                        placeholder="ENTER MOTHER'S MAIDEN NAME"
                                        value={formData.mothersMaidenName}
                                        onChange={handleInputChange}
                                        className={cn(
                                            "rounded-xl bg-white dark:bg-slate-900 h-12 transition-all uppercase font-black text-slate-955 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600",
                                            (showErrors && !formData.mothersMaidenName) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10"
                                        )}
                                    />
                                    {(showErrors && !formData.mothersMaidenName) && (
                                        <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between pt-6">
                                <Button
                                    variant="ghost"
                                    onClick={() => setCurrentStep("INFORMANT")}
                                    className="rounded-full px-8 border-slate-200 dark:border-white/10 font-black uppercase tracking-widest italic text-[10px] h-12"
                                >
                                    <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                                    Back
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!validateStep("SUBJECT")) return;
                                        setCurrentStep("UPLOAD");
                                    }}
                                    className="rounded-full px-12 bg-theme-primary hover:bg-theme-hover text-white font-black uppercase tracking-widest italic text-[10px] h-12 shadow-xl shadow-theme-primary/20"
                                >
                                    Next: Upload Documents
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: UPLOAD DOCUMENTS ===== */}
                    {currentStep === "UPLOAD" && (
                        <motion.div
                            key="upload-step"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="space-y-6"
                        >
                            <RequiredDocuments
                                title="Required Documents"
                                subtitle="Please upload the required certification files to proceed"
                                warningBanner={
                                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/20">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">PSA Negative Certification Required</p>
                                                <p className="text-[9px] text-amber-600/80 dark:text-amber-400/80 italic mt-1">
                                                    This is strictly required as proof that the record is not available in the national database. Obtain this from any PSA Serbilis outlet.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                }
                                documents={[
                                    {
                                        key: "psaNegativeCert",
                                        label: "PSA Negative Certification",
                                        file: files.psaNegativeCert,
                                        previewUrl: previews.psaNegativeCert,
                                        infoText: "PSA Negative Certification of Birth",
                                        error: showErrors && !files.psaNegativeCert && !previews.psaNegativeCert,
                                        onFileSelect: async (newFile) => {
                                            saveDraftFile(STORAGE_KEY, "psaNegativeCert", newFile).catch(err => console.error("Failed to save draft file in IndexedDB:", err));
                                            try {
                                                toast.loading("Uploading document...", { id: "file-upload-psa" });
                                                const publicUrl = await uploadFileClientSide(newFile, "psaNegativeCert", userId);
                                                setFiles(prev => ({ ...prev, psaNegativeCert: newFile }));
                                                setPreviews(prev => ({ ...prev, psaNegativeCert: publicUrl }));
                                                toast.success("Document uploaded!", { id: "file-upload-psa" });
                                            } catch {
                                                toast.error("Upload failed. Local copy stored.", { id: "file-upload-psa" });
                                                setFiles(prev => ({ ...prev, psaNegativeCert: newFile }));
                                                setPreviews(prev => ({ ...prev, psaNegativeCert: newFile.type.startsWith("image/") ? URL.createObjectURL(newFile) : null }));
                                            }
                                        },
                                        onClickUpload: () => startHandoff("psaNegativeCert"),
                                        onClear: async () => {
                                            setFiles(prev => ({ ...prev, psaNegativeCert: null }));
                                            setPreviews(prev => ({ ...prev, psaNegativeCert: null }));
                                            await saveDraftFile(STORAGE_KEY, "psaNegativeCert", null);
                                            toast.success("PSA Certification removed.");
                                        },
                                        onView: () => handleOpenViewer(files.psaNegativeCert, "PSA Negative Certification", previews.psaNegativeCert),
                                    },
                                    {
                                        key: "form1a",
                                        label: "Form 1A (Local Registry Copy)",
                                        file: files.form1a,
                                        previewUrl: previews.form1a,
                                        infoText: "Form 1A / Local Registry Copy",
                                        error: showErrors && !files.form1a && !previews.form1a,
                                        onFileSelect: async (newFile) => {
                                            saveDraftFile(STORAGE_KEY, "form1a", newFile).catch(err => console.error("Failed to save draft file in IndexedDB:", err));
                                            try {
                                                toast.loading("Uploading document...", { id: "file-upload-form1a" });
                                                const publicUrl = await uploadFileClientSide(newFile, "form1a", userId);
                                                setFiles(prev => ({ ...prev, form1a: newFile }));
                                                setPreviews(prev => ({ ...prev, form1a: publicUrl }));
                                                toast.success("Document uploaded!", { id: "file-upload-form1a" });
                                            } catch {
                                                toast.error("Upload failed. Local copy stored.", { id: "file-upload-form1a" });
                                                setFiles(prev => ({ ...prev, form1a: newFile }));
                                                setPreviews(prev => ({ ...prev, form1a: newFile.type.startsWith("image/") ? URL.createObjectURL(newFile) : null }));
                                            }
                                        },
                                        onClickUpload: () => startHandoff("form1a"),
                                        onClear: async () => {
                                            setFiles(prev => ({ ...prev, form1a: null }));
                                            setPreviews(prev => ({ ...prev, form1a: null }));
                                            await saveDraftFile(STORAGE_KEY, "form1a", null);
                                            toast.success("Form 1A copy removed.");
                                        },
                                        onView: () => handleOpenViewer(files.form1a, "Form 1A (Local Copy)", previews.form1a),
                                    }
                                ]}
                            />

                            <div className="flex justify-between pt-6">
                                <Button
                                    variant="ghost"
                                    onClick={() => setCurrentStep("SUBJECT")}
                                    className="rounded-full px-8 border-slate-200 dark:border-white/10 font-black uppercase tracking-widest italic text-[10px] h-12"
                                >
                                    <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                                    Back
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!validateStep("UPLOAD")) return;
                                        setCurrentStep("REVIEW");
                                    }}
                                    className="rounded-full px-12 bg-theme-primary hover:bg-theme-hover text-white font-black uppercase tracking-widest italic text-[10px] h-12 shadow-xl shadow-theme-primary/20"
                                >
                                    Proceed to Review
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP 3: REVIEW & SUBMIT ===== */}
                    {currentStep === "REVIEW" && (
                        <ReviewAndSubmit
                            title="Endorsement Review"
                            subtitle="Verify information before submission"
                            policyAccepted={policyAccepted}
                            onPolicyAcceptedChange={setPolicyAccepted}
                            onReviewPolicy={() => setPolicyOpen(true)}
                            showErrors={showErrors}
                            submitting={submitting}
                            submitLabel="Submit Birth PSA Endorsement Application"
                            submitDisabled={(!files.psaNegativeCert && !previews.psaNegativeCert) || (!files.form1a && !previews.form1a)}
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
                                            <span className="text-slate-700 dark:text-slate-350 uppercase">Birth PSA Endorsement</span>
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
                            onSubmit={handleSubmit}
                            onBack={() => setCurrentStep("UPLOAD")}
                            backLabel="Modify Details"
                            detailsCards={
                                <Card className="bg-slate-50 dark:bg-white/5 border-none p-6 rounded-[2rem] space-y-4">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Informant</span>
                                            <p className="font-black text-slate-900 dark:text-white italic uppercase">{resident?.firstName} {resident?.lastName} ({formData.relationship})</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Contact</span>
                                            <p className="font-black text-slate-900 dark:text-white italic">{formData.contactNumber}</p>
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Informant Address</span>
                                            <p className="font-black text-slate-900 dark:text-white italic uppercase">{formData.informantAddress}</p>
                                        </div>
                                        <div className="col-span-2 border-t border-slate-200 dark:border-white/5 pt-4 space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-theme-primary italic">Subject Name (To Endorse)</span>
                                            <p className="font-black text-slate-900 dark:text-white italic uppercase text-lg">{formData.subjectFullName}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Date of Birth</span>
                                            <p className="font-black text-slate-900 dark:text-white italic">{formData.subjectDateOfBirth}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Mother&apos;s Maiden Name</span>
                                            <p className="font-black text-slate-900 dark:text-white italic uppercase">{formData.mothersMaidenName}</p>
                                        </div>
                                    </div>
                                    </Card>
                            }
                            documentsSection={
                                (files.psaNegativeCert || previews.psaNegativeCert || files.form1a || previews.form1a) ? (
                                    <div className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white">
                                                <Upload size={18} className="stroke-[2.5]" />
                                            </div>
                                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Uploaded Documents</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <ReadOnlyDocumentPreview
                                                file={files.psaNegativeCert}
                                                previewUrl={previews.psaNegativeCert}
                                                label="PSA Negative Certification"
                                                fileName={files.psaNegativeCert ? files.psaNegativeCert.name : previews.psaNegativeCert ? "Uploaded" : "Not uploaded"}
                                                onView={() => handleOpenViewer(files.psaNegativeCert, "PSA Negative Certification", previews.psaNegativeCert)}
                                            />

                                            <ReadOnlyDocumentPreview
                                                file={files.form1a}
                                                previewUrl={previews.form1a}
                                                label="Form 1A"
                                                fileName={files.form1a ? files.form1a.name : previews.form1a ? "Attached from previous draft" : "Not uploaded"}
                                                onView={() => handleOpenViewer(files.form1a, "Form 1A (Local Copy)", previews.form1a)}
                                            />
                                        </div>
                                    </div>
                                ) : null
                            }
                        />

                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
