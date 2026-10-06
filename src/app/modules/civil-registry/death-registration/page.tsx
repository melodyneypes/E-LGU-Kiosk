/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    User,
    Users,
    Upload,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Skull,
    Home,
    Check,
    Printer,
    AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import RequiredDocuments, { DocumentItem } from "../_components/required-documents";
import ReviewAndSubmit from "../_components/review-and-submit";
import ReadOnlyDocumentPreview from "../_components/read-only-document-preview";
import RequestList from "../_components/request-list";
import InformantInfo from "../_components/informant-info";

import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import DocumentViewerModal from "@/components/shared/DocumentViewerModal";
import SecureQrUploadModal from "@/components/shared/SecureQrUploadModal";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
    getCurrentUserResident,
    getTransactionTypes,
    ensureCivilRegistryTransactionTypes,
    submitCivilRegistryTransaction,
    getTransactionById,
    getBarangaysList,
    getExistingDeathRegistrations,
    cancelDeathRegistration,
    getSecureUploadUrlAction,
    searchResidentsAction
} from "./actions";

type Step = "EXISTING" | "INFORMANT" | "DECEASED" | "UPLOAD" | "REVIEW" | "SUBMIT";

const STEPS = [
    { id: "INFORMANT", label: "Informant", icon: User },
    { id: "DECEASED", label: "Deceased", icon: Users },
    { id: "UPLOAD", label: "Upload", icon: Upload },
    { id: "REVIEW", label: "Review", icon: CheckCircle2 },
];

const STORAGE_KEY = "lcr_death_registration_draft";

// --- UPLOAD FILE SECURELY VIA SIGNED UPLOAD URL ---
async function uploadFileClientSide(file: File, fieldName: string, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'bin';

    const res = await getSecureUploadUrlAction(fieldName, "lcr/death_registration", fileExt, userId);
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

export default function DeathRegistrationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string>("");
    const [resident, setResident] = useState<any>(null);
    const [existingRequests, setExistingRequests] = useState<any[]>([]);
    const [selectedApplication, setSelectedApplication] = useState<any | null>(null);

    const [currentStep, setCurrentStep] = useState<Step>("EXISTING");
    const [form, setForm] = useState({
        typeId: "",
        informantFirstName: "",
        informantMiddleName: "",
        informantLastName: "",
        informantSuffix: "",
        informantBirthDate: "",
        informantAge: "",
        informantCivilStatus: "",
        informantCitizenship: "",
        informantOccupation: "",
        contactNumber: "",
        email: "",
        relationship: "",
        relationshipSpecify: "",

        deceasedFullName: "",
        deceasedDateOfBirth: "",
        deceasedDateOfDeath: "",
        deceasedPlaceOfDeath: "",
        deceasedPlaceOfDeathCustom: "",
        deceasedCauseOfDeath: "",
        deceasedGender: "",
        deceasedCivilStatus: "",
        deceasedFatherName: "",
        deceasedMotherName: "",
        corpseDisposalMethod: "",
        corpseDisposalMethodCustom: "",
        cemeteryLocation: "",
    });

    const [files, setFiles] = useState<Record<string, File | null>>({
        deathCertificate: null
    });
    const [previews, setPreviews] = useState<Record<string, string | null>>({
        deathCertificate: null
    });

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Modal states
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerFile, setViewerFile] = useState<File | null>(null);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState("");
    const [policyOpen, setPolicyOpen] = useState(false);
    const [policyAccepted, setPolicyAccepted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [revisionTx, setRevisionTx] = useState<any | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showErrors, setShowErrors] = useState(false);
    const [barangaysList, setBarangaysList] = useState<string[]>([]);
    const [dbBaseFee, setDbBaseFee] = useState<number>(0);
    const [dbProcessingFee, setDbProcessingFee] = useState<number>(0);

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
                    const uploadedFiles = result.files || [];
                    const uploadedFile = uploadedFiles[0];
                    if (uploadedFile) {
                        const targetKey = handoffSessionSlot.replace("lcr_", "");
                        setPreviews(prev => ({ ...prev, [targetKey]: uploadedFile.url }));
                        setFiles(prev => ({ ...prev, [targetKey]: null }));
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
    }, [handoffToken, handoffSessionSlot]);

    // Search resident logic with debounce
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await searchResidentsAction(searchQuery);
                if (res.success && res.data) {
                    // Exclude the logged-in user from the search results
                    const filtered = res.data.filter((r: any) => r.id !== resident?.id);
                    setSearchResults(filtered);
                }
            } catch (err) {
                console.error("Search resident err:", err);
            } finally {
                setIsSearching(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, resident]);

    // Initialization
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
                    getExistingDeathRegistrations(uId)
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

                        const prevs: Record<string, string | null> = {};
                        if (addData.deathCertificate && typeof addData.deathCertificate === "string" && addData.deathCertificate.startsWith("http")) {
                            prevs.deathCertificate = addData.deathCertificate;
                        }

                        setForm({
                            typeId: txData.typeId || "",
                            informantFirstName: addData.informantFirstName || r.firstName || "",
                            informantMiddleName: addData.informantMiddleName || r.middleName || "",
                            informantLastName: addData.informantLastName || r.lastName || "",
                            informantSuffix: addData.informantSuffix || r.suffix || "",
                            informantBirthDate: addData.informantBirthDate || (r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : ""),
                            informantAge: addData.informantAge || r.age?.toString() || "",
                            informantCivilStatus: addData.informantCivilStatus || r.civilStatus || "",
                            informantCitizenship: addData.informantCitizenship || r.citizenship || "Filipino",
                            informantOccupation: addData.informantOccupation || r.occupation || "",
                            contactNumber: addData.contactNumber || resSnapshot.contactNumber || "",
                            email: addData.email || resSnapshot.email || "",
                            relationship: addData.relationship || "",
                            relationshipSpecify: addData.relationshipSpecify || "",

                            deceasedFullName: addData.deceasedFullName || addData.subjectName || "",
                            deceasedDateOfBirth: addData.deceasedDateOfBirth || "",
                            deceasedDateOfDeath: addData.deceasedDateOfDeath || addData.dateOfDeath || addData.dateOfEvent || "",
                            deceasedPlaceOfDeath: addData.deceasedPlaceOfDeath || addData.placeOfDeath || addData.placeOfEvent || "",
                            deceasedPlaceOfDeathCustom: addData.deceasedPlaceOfDeathCustom || "",
                            deceasedCauseOfDeath: addData.deceasedCauseOfDeath || "",
                            deceasedGender: addData.deceasedGender || "",
                            deceasedCivilStatus: addData.deceasedCivilStatus || "",
                            deceasedFatherName: addData.deceasedFatherName || addData.fatherName || "",
                            deceasedMotherName: addData.deceasedMotherName || addData.motherName || "",
                            corpseDisposalMethod: addData.corpseDisposalMethod || "",
                            corpseDisposalMethodCustom: addData.corpseDisposalMethodCustom || "",
                            cemeteryLocation: addData.cemeteryLocation || "",
                        });
                        if (prevs.deathCertificate) {
                            setPreviews(prevs);
                        }
                    } else {
                        setForm(prev => ({
                            ...prev,
                            informantFirstName: r.firstName || "",
                            informantMiddleName: r.middleName || "",
                            informantLastName: r.lastName || "",
                            informantSuffix: r.suffix || "",
                            informantBirthDate: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : "",
                            informantAge: r.age?.toString() || "",
                            informantCivilStatus: r.civilStatus || "",
                            informantCitizenship: r.citizenship || "Filipino",
                            informantOccupation: r.occupation || "",
                            contactNumber: r.contactNumber || "",
                            email: r.email || "",
                        }));
                    }
                }

                if (typesResult.success && typesResult.data) {
                    const lcrTypes = typesResult.data.filter((t: any) => t.category === "Civil Registry");
                    const currentDbType = lcrTypes.find((t: any) => t.code === "LCR_DEATH_REG");
                    if (currentDbType) {
                        setForm(prev => ({ ...prev, typeId: currentDbType.id }));
                        setDbBaseFee(Number(currentDbType.baseFee ?? 0));
                        if (currentDbType.defaultFees) {
                            const feesArray = typeof currentDbType.defaultFees === "string"
                                ? JSON.parse(currentDbType.defaultFees)
                                : currentDbType.defaultFees;
                            const procFeeObj = feesArray.find((f: any) => f.code === "PROCESSING_FEE");
                            setDbProcessingFee(procFeeObj ? Number(procFeeObj.amount) : 0);
                        } else {
                            setDbProcessingFee(0);
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
                    setCurrentStep("INFORMANT");
                } else if (existingRes.success && existingRes.data && existingRes.data.length > 0) {
                    setCurrentStep("EXISTING");
                } else {
                    setCurrentStep("INFORMANT");
                }
            } catch (err) {
                console.error("Initialization error:", err);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [router]);

    const handleInputChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setErrors(prev => {
            const copy = { ...prev };
            delete copy[field];
            return copy;
        });
    };

    const handleSelectResident = (res: any) => {
        const fullName = `${res.firstName} ${res.middleName ? res.middleName + ' ' : ''}${res.lastName}${res.suffix ? ' ' + res.suffix : ''}`.replace(/\s+/g, ' ').trim();
        const dob = res.dateOfBirth ? new Date(res.dateOfBirth).toISOString().split('T')[0] : "";
        const fatherName = `${res.fatherFirstName || ""} ${res.fatherMiddleName || ""} ${res.fatherLastName || ""}`.trim();
        const motherName = `${res.motherFirstName || ""} ${res.motherMiddleName || ""} ${res.motherLastName || ""}`.trim();

        setForm(prev => ({
            ...prev,
            deceasedFullName: fullName,
            deceasedDateOfBirth: dob,
            deceasedGender: res.gender?.toUpperCase() || "",
            deceasedCivilStatus: res.civilStatus?.toUpperCase() || "",
            deceasedFatherName: fatherName,
            deceasedMotherName: motherName,
        }));

        setSearchQuery("");
        setSearchResults([]);
        toast.success(`Pre-filled deceased details for ${fullName}!`);
    };

    const handleFileSelect = (key: string, newFile: File) => {
        setFiles(prev => ({ ...prev, [key]: newFile }));
        setPreviews(prev => ({
            ...prev,
            [key]: newFile.type.startsWith("image/") ? URL.createObjectURL(newFile) : null
        }));
        setErrors(prev => {
            const copy = { ...prev };
            delete copy.documents;
            return copy;
        });
    };

    const handleClearFile = (key: string) => {
        setFiles(prev => ({ ...prev, [key]: null }));
        setPreviews(prev => ({ ...prev, [key]: null }));
    };

    const handleViewFile = (file: File | null, url: string | null, title: string) => {
        setViewerFile(file);
        setViewerUrl(url);
        setViewerTitle(title);
        setViewerOpen(true);
    };

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

            const QRCode = (await import("qrcode")).default;
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
            lcr_deathCertificate: "Certificate of Death",
        };
        return map[handoffSessionSlot] || "Document";
    };

    const validateStep = (step: Step) => {
        const newErrors: Record<string, string> = {};
        if (step === "INFORMANT") {
            if (!form.relationship) newErrors.relationship = "Required";
            if (!form.contactNumber) newErrors.contactNumber = "Required";
            if (
                (form.relationship === "OTHER" || form.relationship === "Guardian / Authorized Representative") &&
                !form.relationshipSpecify?.trim()
            ) {
                newErrors.relationshipSpecify = "Required";
            }
        } else if (step === "DECEASED") {
            if (!form.deceasedFullName?.trim()) newErrors.deceasedFullName = "Required";
            if (!form.deceasedDateOfBirth) newErrors.deceasedDateOfBirth = "Required";
            if (!form.deceasedDateOfDeath) newErrors.deceasedDateOfDeath = "Required";
            if (!form.deceasedPlaceOfDeath) newErrors.deceasedPlaceOfDeath = "Required";
            if (form.deceasedPlaceOfDeath === "OUTSIDE_MUNICIPALITY" && !form.deceasedPlaceOfDeathCustom?.trim()) {
                newErrors.deceasedPlaceOfDeathCustom = "Required";
            }
            if (!form.deceasedCauseOfDeath?.trim()) newErrors.deceasedCauseOfDeath = "Required";
            if (!form.deceasedGender) newErrors.deceasedGender = "Required";
            if (!form.deceasedCivilStatus) newErrors.deceasedCivilStatus = "Required";
            if (!form.deceasedFatherName?.trim()) newErrors.deceasedFatherName = "Required";
            if (!form.deceasedMotherName?.trim()) newErrors.deceasedMotherName = "Required";
            if (!form.corpseDisposalMethod) newErrors.corpseDisposalMethod = "Required";
            if (form.corpseDisposalMethod === "OTHER" && !form.corpseDisposalMethodCustom?.trim()) {
                newErrors.corpseDisposalMethodCustom = "Required";
            }
            if (!form.cemeteryLocation?.trim()) newErrors.cemeteryLocation = "Required";
        } else if (step === "UPLOAD") {
            if (!(files.deathCertificate || previews.deathCertificate)) {
                newErrors.documents = "Please upload the Certificate of Death.";
            }
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        setShowErrors(!isValid);

        if (!isValid) {
            const firstErrorField = Object.keys(newErrors)[0];
            if (firstErrorField) {
                setTimeout(() => {
                    const element = document.getElementById(firstErrorField) || document.getElementsByName(firstErrorField)[0];
                    if (element) {
                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                        element.focus();
                    }
                }, 150);
            }

            if (step === "INFORMANT") {
                if (newErrors.relationship) {
                    toast.error("Please select your relationship to the deceased.");
                } else if (newErrors.relationshipSpecify) {
                    toast.error("Please specify your relationship.");
                } else if (newErrors.contactNumber) {
                    toast.error("Please enter your contact number.");
                }
            } else if (step === "DECEASED") {
                toast.error("Please fill in all required fields for the deceased individual.");
            } else if (step === "UPLOAD") {
                toast.error(newErrors.documents || "Please upload the required Certificate of Death.");
            }
        }

        return isValid;
    };

    const goNext = () => {
        if (!validateStep(currentStep)) return;
        if (currentStep === "INFORMANT") setCurrentStep("DECEASED");
        else if (currentStep === "DECEASED") setCurrentStep("UPLOAD");
        else if (currentStep === "UPLOAD") setCurrentStep("REVIEW");
    };

    const goPrev = () => {
        if (currentStep === "DECEASED") setCurrentStep("INFORMANT");
        else if (currentStep === "UPLOAD") setCurrentStep("DECEASED");
        else if (currentStep === "REVIEW") setCurrentStep("UPLOAD");
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    const handleCancelRegistration = async (id: string) => {
        if (!window.confirm("Are you sure you want to cancel this registration request?")) return;
        try {
            toast.loading("Cancelling request...", { id: "cancel-request-toast" });
            const res = await cancelDeathRegistration(id, userId);
            if (res.success) {
                toast.success("Application cancelled successfully.", { id: "cancel-request-toast" });
                const updated = await getExistingDeathRegistrations(userId);
                if (updated.success) {
                    setExistingRequests(updated.data);
                    const match = updated.data.find((a: any) => a.id === id);
                    if (match) {
                        setSelectedApplication(match);
                    } else {
                        setSelectedApplication(null);
                        setCurrentStep("EXISTING");
                    }
                } else {
                    setCurrentStep("EXISTING");
                }
            } else {
                toast.error(res.error || "Failed to cancel application.", { id: "cancel-request-toast" });
            }
        } catch {
            toast.error("An unexpected error occurred.", { id: "cancel-request-toast" });
        }
    };

    const getPlaceOfDeathText = () => {
        if (form.deceasedPlaceOfDeath === "OUTSIDE_MUNICIPALITY") {
            return form.deceasedPlaceOfDeathCustom || "N/A";
        }
        return form.deceasedPlaceOfDeath || "N/A";
    };

    const handleSubmit = async () => {
        if (!policyAccepted) {
            setErrors(prev => ({ ...prev, policyAccepted: "You must agree to the Data Privacy & Terms before submitting." }));
            setShowErrors(true);
            toast.error("Please review and accept the Privacy Policy & Terms before submitting.");
            return;
        }

        if (!validateStep("INFORMANT") || !validateStep("DECEASED") || !validateStep("UPLOAD")) {
            toast.error("Please complete all required fields and uploads.");
            return;
        }

        setSubmitting(true);
        try {
            const placeOfDeathResolved = form.deceasedPlaceOfDeath === "OUTSIDE_MUNICIPALITY"
                ? form.deceasedPlaceOfDeathCustom
                : form.deceasedPlaceOfDeath;

            const corpseDisposalMethodResolved = form.corpseDisposalMethod === "OTHER"
                ? form.corpseDisposalMethodCustom
                : form.corpseDisposalMethod;

            const residentSnapshot = { ...resident, contactNumber: form.contactNumber, email: form.email, occupation: form.informantOccupation };

            const formData = new FormData();
            formData.append("typeId", form.typeId);
            formData.append("registryType", "DEATH_REG");
            formData.append("residentSnapshot", JSON.stringify(residentSnapshot));
            if (revisionId) formData.append("revisionId", revisionId);

            const baseAdditionalData = {
                subjectName: form.deceasedFullName,
                deceasedFullName: form.deceasedFullName,
                deceasedDateOfBirth: form.deceasedDateOfBirth,
                deceasedDateOfDeath: form.deceasedDateOfDeath,
                deceasedPlaceOfDeath: placeOfDeathResolved,
                deceasedPlaceOfDeathCustom: form.deceasedPlaceOfDeathCustom || null,
                deceasedCauseOfDeath: form.deceasedCauseOfDeath,
                deceasedGender: form.deceasedGender,
                deceasedCivilStatus: form.deceasedCivilStatus,
                deceasedFatherName: form.deceasedFatherName,
                deceasedMotherName: form.deceasedMotherName,
                corpseDisposalMethod: corpseDisposalMethodResolved,
                corpseDisposalMethodCustom: form.corpseDisposalMethodCustom || null,
                cemeteryLocation: form.cemeteryLocation,

                dateOfEvent: form.deceasedDateOfDeath,
                dateOfDeath: form.deceasedDateOfDeath,
                placeOfEvent: placeOfDeathResolved,
                placeOfDeath: placeOfDeathResolved,

                relationship: form.relationship === "OTHER" ? form.relationshipSpecify : form.relationship,
                relationshipSpecify: form.relationshipSpecify || null,
                email: form.email,
                contactNumber: form.contactNumber,
                informantFirstName: form.informantFirstName,
                informantMiddleName: form.informantMiddleName,
                informantLastName: form.informantLastName,
                informantSuffix: form.informantSuffix,
                informantName: `${form.informantFirstName} ${form.informantMiddleName} ${form.informantLastName} ${form.informantSuffix}`.replace(/\s+/g, ' ').trim(),
                informantBirthDate: form.informantBirthDate,
                informantAge: form.informantAge,
                informantCivilStatus: form.informantCivilStatus,
                informantCitizenship: form.informantCitizenship,
                informantOccupation: form.informantOccupation,
                totalAmount: dbBaseFee + dbProcessingFee,
            };

            const fileUrls: Record<string, string> = {};
            Object.entries(previews || {}).forEach(([key, url]) => {
                if (url && typeof url === "string" && url.startsWith("http")) fileUrls[key] = url;
            });

            const finalFiles = { ...files };
            const fileEntries = Object.entries(finalFiles);
            for (let i = 0; i < fileEntries.length; i++) {
                const [key, file] = fileEntries[i];
                if (!file) continue;
                const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                if (fileUrls[key]) continue;
                try {
                    toast.loading(`Uploading document ${i + 1}/${fileEntries.length}...`, { id: "death-upload-toast" });
                    const url = await uploadFileClientSide(file, sanitizedKey, userId);
                    fileUrls[key] = url;
                } catch (uploadErr) {
                    console.error(`[ClientUpload] Failed to upload ${key}:`, uploadErr);
                    toast.error(`Failed to upload document: ${key}. Please try again.`, { id: "death-upload-toast" });
                    setSubmitting(false);
                    return;
                }
            }
            toast.dismiss("death-upload-toast");

            const updatedAdditionalData = { ...baseAdditionalData, ...fileUrls };
            formData.append("additionalData", JSON.stringify(updatedAdditionalData));

            const result = await submitCivilRegistryTransaction(formData, userId);

            if (result.success) {
                sessionStorage.removeItem("death-reg-step");
                sessionStorage.removeItem("death-reg-form");
                toast.success(revisionId ? "Application resubmitted successfully!" : "Death Registration submitted successfully!");

                const updated = await getExistingDeathRegistrations(userId);
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

    const getRequiredDocsList = (): DocumentItem[] => {
        return [
            {
                key: "deathCertificate",
                label: "Certificate of Death",
                file: files.deathCertificate,
                previewUrl: previews.deathCertificate,
                onFileSelect: (newFile) => handleFileSelect("deathCertificate", newFile),
                onClickUpload: () => startHandoff("deathCertificate"),
                onClear: () => handleClearFile("deathCertificate"),
                onView: () => handleViewFile(files.deathCertificate, previews.deathCertificate, "Certificate of Death")
            }
        ];
    };



    const stepIndex = STEPS.findIndex(s => s.id === currentStep);

    return (
        <div className="h-full overflow-y-auto px-4 py-8 md:px-12 md:py-12 bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white font-normal leading-normal">

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
                                Death Registration
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
                            DEATH <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">REGISTRATION</span>
                        </h1>
                        <p className="text-[9px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">LCR Civil Registry Request Portal</p>
                    </div>
                    {currentStep === "SUBMIT" && (
                        <Button
                            onClick={() => {
                                setForm({
                                    typeId: form.typeId,
                                    informantFirstName: resident?.firstName || "",
                                    informantMiddleName: resident?.middleName || "",
                                    informantLastName: resident?.lastName || "",
                                    informantSuffix: resident?.suffix || "",
                                    informantBirthDate: resident?.dateOfBirth ? new Date(resident?.dateOfBirth).toISOString().split('T')[0] : "",
                                    informantAge: resident?.age?.toString() || "",
                                    informantCivilStatus: resident?.civilStatus || "",
                                    informantCitizenship: resident?.citizenship || "Filipino",
                                    informantOccupation: resident?.occupation || "",
                                    contactNumber: resident?.contactNumber || "",
                                    email: resident?.email || "",
                                    relationship: "",
                                    relationshipSpecify: "",
                                    deceasedFullName: "",
                                    deceasedDateOfBirth: "",
                                    deceasedDateOfDeath: "",
                                    deceasedPlaceOfDeath: "",
                                    deceasedPlaceOfDeathCustom: "",
                                    deceasedCauseOfDeath: "",
                                    deceasedGender: "",
                                    deceasedCivilStatus: "",
                                    deceasedFatherName: "",
                                    deceasedMotherName: "",
                                    corpseDisposalMethod: "",
                                    corpseDisposalMethodCustom: "",
                                    cemeteryLocation: "",
                                });
                                setFiles({ deathCertificate: null });
                                setPreviews({ deathCertificate: null });
                                setPolicyAccepted(false);
                                setRevisionId(null);
                                setRevisionTx(null);
                                setSelectedApplication(null);
                                setCurrentStep("INFORMANT");
                            }}
                            className="bg-theme-primary hover:bg-theme-hover text-white font-bold uppercase tracking-wider rounded-2xl py-6 px-8 shadow-lg shadow-theme-primary/20 active:scale-95 transition-all text-xs"
                        >
                            New Registration Request
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress Stepper */}
            {currentStep !== "SUBMIT" && currentStep !== "EXISTING" && (
                <div className="mx-auto max-w-7xl mb-10">
                    <div className="grid grid-cols-4 max-w-2xl mx-auto gap-1 md:gap-4 relative px-1 md:px-2">
                        {STEPS.map((step, idx) => {
                            const isActive = currentStep === step.id;
                            const isCompleted = idx <= stepIndex;
                            const Icon = step.icon;
                            return (
                                <div
                                    key={idx}
                                    className="flex flex-col items-center flex-1 relative group"
                                >
                                    <div
                                        className={cn(
                                            "w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 select-none z-10",
                                            isActive
                                                ? "bg-theme-primary border-theme-primary text-white shadow-lg shadow-theme-primary/25 scale-105"
                                                : isCompleted
                                                    ? "bg-theme-primary/10 border-theme-primary/30 text-theme-primary"
                                                    : "bg-white dark:bg-[#151821] border-slate-250 dark:border-white/10 text-slate-500 dark:text-slate-405"
                                        )}
                                    >
                                        {isCompleted && !isActive ? (
                                            <Check className="w-5 h-5 md:w-6 h-6 stroke-[3]" />
                                        ) : (
                                            <Icon className="w-5 h-5 md:w-6 h-6" />
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            "mt-2 text-[9px] md:text-[10px] font-black uppercase tracking-wider text-center select-none transition-colors",
                                            isActive ? "text-theme-primary font-black" : isCompleted ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-500"
                                        )}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step Contents */}
            <div className="mx-auto max-w-3xl mt-4 mb-20">

                {/* Step 0: EXISTING REQUESTS LIST */}
                {currentStep === "EXISTING" && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">Death Registration Requests</h2>
                                <p className="text-xs text-slate-500 font-medium italic">View and manage your previous death registration submissions</p>
                            </div>
                            <Button
                                onClick={() => {
                                    setForm({
                                        typeId: form.typeId,
                                        informantFirstName: resident?.firstName || "",
                                        informantMiddleName: resident?.middleName || "",
                                        informantLastName: resident?.lastName || "",
                                        informantSuffix: resident?.suffix || "",
                                        informantBirthDate: resident?.dateOfBirth ? new Date(resident?.dateOfBirth).toISOString().split('T')[0] : "",
                                        informantAge: resident?.age?.toString() || "",
                                        informantCivilStatus: resident?.civilStatus || "",
                                        informantCitizenship: resident?.citizenship || "Filipino",
                                        informantOccupation: resident?.occupation || "",
                                        contactNumber: resident?.contactNumber || "",
                                        email: resident?.email || "",
                                        relationship: "",
                                        relationshipSpecify: "",
                                        deceasedFullName: "",
                                        deceasedDateOfBirth: "",
                                        deceasedDateOfDeath: "",
                                        deceasedPlaceOfDeath: "",
                                        deceasedPlaceOfDeathCustom: "",
                                        deceasedCauseOfDeath: "",
                                        deceasedGender: "",
                                        deceasedCivilStatus: "",
                                        deceasedFatherName: "",
                                        deceasedMotherName: "",
                                        corpseDisposalMethod: "",
                                        corpseDisposalMethodCustom: "",
                                        cemeteryLocation: "",
                                    });
                                    setFiles({ deathCertificate: null });
                                    setPreviews({ deathCertificate: null });
                                    setPolicyAccepted(false);
                                    setRevisionId(null);
                                    setRevisionTx(null);
                                    setSelectedApplication(null);
                                    setCurrentStep("INFORMANT");
                                }}
                                className="bg-theme-primary hover:bg-theme-hover text-white font-bold uppercase tracking-wider rounded-2xl py-4 px-6 shadow-lg shadow-theme-primary/20 active:scale-95 transition-all text-xs"
                            >
                                New Request
                            </Button>
                        </div>

                        <RequestList
                            requests={existingRequests}
                            onItemClick={(app) => {
                                setSelectedApplication(app);
                                setCurrentStep("SUBMIT");
                            }}
                            emptyMessage="No records found"
                            emptySubMessage="Submit your first death registration request to get started."
                            getSubjectName={(app) => app.additionalData?.subjectName || "Unknown Subject"}
                        />

                        <div className="flex justify-start pt-6">
                            <Button
                                variant="outline"
                                onClick={() => router.push("/modules/civil-registry")}
                                className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-bold uppercase tracking-wider text-xs px-6 py-5 rounded-2xl transition-all"
                            >
                                <ChevronLeft className="inline-block mr-1 w-4 h-4" /> Back to Hub
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 1: INFORMANT */}
                {currentStep === "INFORMANT" && (
                    <div className="space-y-6">
                        {revisionTx && (
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-800 dark:text-amber-400 animate-in fade-in duration-300">
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
                                { value: "SPOUSE", label: "Spouse" },
                                { value: "CHILD", label: "Child" },
                                { value: "PARENT", label: "Parent" },
                                { value: "SIBLING", label: "Sibling" },
                                { value: "RELATIVE", label: "Other Relative" },
                                { value: "Guardian / Authorized Representative", label: "Authorized Representative" },
                                { value: "OTHER", label: "Other" }
                            ]}
                            errors={errors}
                            showErrors={showErrors}
                            isCardWrapped={true}
                            cardTitle="Informant Details"
                            cardSubtitle="Please enter details of the person registering the death"
                        />
                    </div>
                )}

                {/* Step 2: DECEASED */}
                {currentStep === "DECEASED" && (
                    <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-8 overflow-visible">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                                <Skull className="w-8 h-8 text-slate-900 dark:text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">Deceased Details</h2>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Provide the details of the deceased individual</p>
                            </div>
                        </div>

                        {/* Search resident search database */}
                        <div className="p-6 rounded-[2rem] bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-theme-primary animate-pulse" /> SEARCH DECEASED IN RESIDENT DATABASE
                            </h3>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider italic leading-normal">
                                IF THE DECEASED WAS A REGISTERED LOCAL RESIDENT, YOU CAN SEARCH AND SELECT THEIR PROFILE TO AUTOMATICALLY PRE-FILL ALL AVAILABLE INFORMATION.
                            </p>
                            <div className="relative">
                                <Input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Type resident name to search..."
                                    className="rounded-2xl border-slate-200 dark:border-white/10 h-12 pl-10 font-bold"
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450">
                                    <User size={16} />
                                </div>
                                {isSearching && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* Search Results Dropdown */}
                            {searchResults.length > 0 && (
                                <div className="bg-white dark:bg-[#151821] border border-slate-250 dark:border-white/10 rounded-2xl p-2 max-h-60 overflow-y-auto shadow-2xl space-y-1 z-30 relative">
                                    {searchResults.map((res) => {
                                        const name = `${res.firstName} ${res.middleName ? res.middleName + ' ' : ''}${res.lastName}${res.suffix ? ' ' + res.suffix : ''}`.replace(/\s+/g, ' ').trim();
                                        return (
                                            <div
                                                key={res.id}
                                                onClick={() => handleSelectResident(res)}
                                                className="p-3 hover:bg-theme-primary/10 dark:hover:bg-theme-primary/15 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                                            >
                                                <div>
                                                    <p className="text-xs font-black uppercase text-slate-900 dark:text-white">{name}</p>
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                                                        DOB: {res.dateOfBirth ? new Date(res.dateOfBirth).toLocaleDateString() : "N/A"} | Civil Status: {res.civilStatus || "N/A"}
                                                    </p>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-8 text-[9px] font-black uppercase tracking-wider text-theme-primary">
                                                    Select
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="deceasedFullName"
                                        value={form.deceasedFullName}
                                        onChange={e => handleInputChange("deceasedFullName", e.target.value.toUpperCase())}
                                        placeholder="ENTER FULL NAME"
                                        className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 uppercase font-bold", errors.deceasedFullName && "border-red-500")}
                                    />
                                    {errors.deceasedFullName && <p className="text-xs text-red-500 font-semibold">{errors.deceasedFullName}</p>}
                                </div>

                                {/* Date of Birth */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date of Birth <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="deceasedDateOfBirth"
                                        type="date"
                                        value={form.deceasedDateOfBirth}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => handleInputChange("deceasedDateOfBirth", e.target.value)}
                                        className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 font-bold", errors.deceasedDateOfBirth && "border-red-500")}
                                    />
                                    {errors.deceasedDateOfBirth && <p className="text-xs text-red-500 font-semibold">{errors.deceasedDateOfBirth}</p>}
                                </div>

                                {/* Date of Death */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date of Death <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="deceasedDateOfDeath"
                                        type="date"
                                        value={form.deceasedDateOfDeath}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => handleInputChange("deceasedDateOfDeath", e.target.value)}
                                        className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 font-bold", errors.deceasedDateOfDeath && "border-red-500")}
                                    />
                                    {errors.deceasedDateOfDeath && <p className="text-xs text-red-500 font-semibold">{errors.deceasedDateOfDeath}</p>}
                                </div>

                                {/* Place of Death */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Place of Death <span className="text-red-500">*</span></Label>
                                    <Select value={form.deceasedPlaceOfDeath} onValueChange={val => handleInputChange("deceasedPlaceOfDeath", val)}>
                                        <SelectTrigger id="deceasedPlaceOfDeath" className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 font-bold uppercase", errors.deceasedPlaceOfDeath && "border-red-500")}>
                                            <SelectValue placeholder="SELECT PLACE OF DEATH" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl max-h-60 overflow-y-auto">
                                            {barangaysList.map(b => (
                                                <SelectItem key={b} value={b.toUpperCase()} className="font-bold uppercase text-xs">{b.toUpperCase()}</SelectItem>
                                            ))}
                                            <SelectItem value="OUTSIDE_MUNICIPALITY" className="font-bold uppercase text-xs">OUTSIDE MUNICIPALITY (SPECIFY...)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.deceasedPlaceOfDeath && <p className="text-xs text-red-500 font-semibold">{errors.deceasedPlaceOfDeath}</p>}
                                </div>

                                {form.deceasedPlaceOfDeath === "OUTSIDE_MUNICIPALITY" && (
                                    <div className="space-y-2 md:col-span-2 animate-in fade-in duration-200">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Specify Place of Death <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="deceasedPlaceOfDeathCustom"
                                            value={form.deceasedPlaceOfDeathCustom}
                                            onChange={e => handleInputChange("deceasedPlaceOfDeathCustom", e.target.value.toUpperCase())}
                                            placeholder="ENTER CITY / MUNICIPALITY & PROVINCE"
                                            className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 uppercase font-bold", errors.deceasedPlaceOfDeathCustom && "border-red-500")}
                                        />
                                        {errors.deceasedPlaceOfDeathCustom && <p className="text-xs text-red-500 font-semibold">{errors.deceasedPlaceOfDeathCustom}</p>}
                                    </div>
                                )}

                                {/* Cause of Death */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cause of Death <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="deceasedCauseOfDeath"
                                        value={form.deceasedCauseOfDeath}
                                        onChange={e => handleInputChange("deceasedCauseOfDeath", e.target.value.toUpperCase())}
                                        placeholder="ENTER CAUSE"
                                        className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 uppercase font-bold", errors.deceasedCauseOfDeath && "border-red-500")}
                                    />
                                    {errors.deceasedCauseOfDeath && <p className="text-xs text-red-500 font-semibold">{errors.deceasedCauseOfDeath}</p>}
                                </div>

                                {/* Gender */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gender <span className="text-red-500">*</span></Label>
                                    <Select value={form.deceasedGender} onValueChange={val => handleInputChange("deceasedGender", val)}>
                                        <SelectTrigger id="deceasedGender" className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 font-bold uppercase", errors.deceasedGender && "border-red-500")}>
                                            <SelectValue placeholder="SELECT GENDER" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl">
                                            <SelectItem value="MALE" className="font-bold uppercase text-xs">MALE</SelectItem>
                                            <SelectItem value="FEMALE" className="font-bold uppercase text-xs">FEMALE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.deceasedGender && <p className="text-xs text-red-500 font-semibold">{errors.deceasedGender}</p>}
                                </div>

                                {/* Civil Status */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Civil Status <span className="text-red-500">*</span></Label>
                                    <Select value={form.deceasedCivilStatus} onValueChange={val => handleInputChange("deceasedCivilStatus", val)}>
                                        <SelectTrigger id="deceasedCivilStatus" className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 font-bold uppercase", errors.deceasedCivilStatus && "border-red-500")}>
                                            <SelectValue placeholder="SELECT STATUS" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl">
                                            <SelectItem value="SINGLE" className="font-bold uppercase text-xs">SINGLE</SelectItem>
                                            <SelectItem value="MARRIED" className="font-bold uppercase text-xs">MARRIED</SelectItem>
                                            <SelectItem value="WIDOWED" className="font-bold uppercase text-xs">WIDOWED</SelectItem>
                                            <SelectItem value="DIVORCED" className="font-bold uppercase text-xs">DIVORCED / SEPARATED</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.deceasedCivilStatus && <p className="text-xs text-red-500 font-semibold">{errors.deceasedCivilStatus}</p>}
                                </div>
                            </div>

                            {/* Parental Information */}
                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">PARENTAL INFORMATION</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Father's Name */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Father's Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="deceasedFatherName"
                                            value={form.deceasedFatherName}
                                            onChange={e => handleInputChange("deceasedFatherName", e.target.value.toUpperCase())}
                                            placeholder="ENTER FATHER'S NAME"
                                            className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 uppercase font-bold", errors.deceasedFatherName && "border-red-500")}
                                        />
                                        {errors.deceasedFatherName && <p className="text-xs text-red-500 font-semibold">{errors.deceasedFatherName}</p>}
                                    </div>

                                    {/* Mother's Maiden Name */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mother's Maiden Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="deceasedMotherName"
                                            value={form.deceasedMotherName}
                                            onChange={e => handleInputChange("deceasedMotherName", e.target.value.toUpperCase())}
                                            placeholder="ENTER MOTHER'S MAIDEN NAME"
                                            className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 uppercase font-bold", errors.deceasedMotherName && "border-red-500")}
                                        />
                                        {errors.deceasedMotherName && <p className="text-xs text-red-500 font-semibold">{errors.deceasedMotherName}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Corpse Disposal */}
                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">CORPSE DISPOSAL</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Method of Disposal */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Method of Corpse Disposal <span className="text-red-500">*</span></Label>
                                        <Select value={form.corpseDisposalMethod} onValueChange={val => handleInputChange("corpseDisposalMethod", val)}>
                                            <SelectTrigger id="corpseDisposalMethod" className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 font-bold uppercase", errors.corpseDisposalMethod && "border-red-500")}>
                                                <SelectValue placeholder="SELECT METHOD" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white/95 dark:bg-[#0d120f]/95 border-slate-200/85 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl">
                                                <SelectItem value="BURIAL" className="font-bold uppercase text-xs">BURIAL</SelectItem>
                                                <SelectItem value="CREMATION" className="font-bold uppercase text-xs">CREMATION</SelectItem>
                                                <SelectItem value="OTHER" className="font-bold uppercase text-xs">OTHER</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors.corpseDisposalMethod && <p className="text-xs text-red-500 font-semibold">{errors.corpseDisposalMethod}</p>}
                                    </div>

                                    {form.corpseDisposalMethod === "OTHER" && (
                                        <div className="space-y-2 md:col-span-2 animate-in fade-in duration-200">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Specify Method of Corpse Disposal <span className="text-red-500">*</span></Label>
                                            <Input
                                                id="corpseDisposalMethodCustom"
                                                value={form.corpseDisposalMethodCustom}
                                                onChange={e => handleInputChange("corpseDisposalMethodCustom", e.target.value.toUpperCase())}
                                                placeholder="SPECIFY OTHER DISPOSAL METHOD"
                                                className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 uppercase font-bold", errors.corpseDisposalMethodCustom && "border-red-500")}
                                            />
                                            {errors.corpseDisposalMethodCustom && <p className="text-xs text-red-500 font-semibold">{errors.corpseDisposalMethodCustom}</p>}
                                        </div>
                                    )}

                                    {/* Cemetery Location */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cemetery Location <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="cemeteryLocation"
                                            value={form.cemeteryLocation}
                                            onChange={e => handleInputChange("cemeteryLocation", e.target.value.toUpperCase())}
                                            placeholder="ENTER CEMETERY NAME OR LOCATION"
                                            className={cn("rounded-2xl border-slate-200 dark:border-white/10 h-12 uppercase font-bold", errors.cemeteryLocation && "border-red-500")}
                                        />
                                        {errors.cemeteryLocation && <p className="text-xs text-red-500 font-semibold">{errors.cemeteryLocation}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Step 3: UPLOAD */}
                {currentStep === "UPLOAD" && (
                    <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-8 flex-1 flex flex-col">
                        <RequiredDocuments
                            title="Required Documents"
                            subtitle="Please upload the required files for death registration"
                            documents={getRequiredDocsList()}
                            errorText={errors.documents}
                        />
                    </Card>
                )}

                {/* Step 4: REVIEW */}
                {currentStep === "REVIEW" && (
                    <ReviewAndSubmit
                        title="Registration Review"
                        subtitle="Verify information before final submission"
                        policyAccepted={policyAccepted}
                        onPolicyAcceptedChange={setPolicyAccepted}
                        onReviewPolicy={() => setPolicyOpen(true)}
                        submitting={submitting}
                        submitLabel="Submit Registration"
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
                                        <span className="text-slate-700 dark:text-slate-350 uppercase">Death Registration</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-dashed border-slate-250 dark:border-white/10 pb-3">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Base Filing Fee</span>
                                        <span className="text-slate-700 dark:text-slate-350">₱{dbBaseFee.toFixed(2)}</span>
                                    </div>
                                    {dbProcessingFee > 0 && (
                                        <div className="flex justify-between items-center border-b border-dashed border-slate-250 dark:border-white/10 pb-3">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Processing & e-Copy Fee</span>
                                            <span className="text-slate-700 dark:text-slate-350">₱{dbProcessingFee.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center bg-gradient-to-r from-theme-primary to-theme-secondary/85 text-white rounded-2xl p-4 md:p-6 shadow-xl shadow-theme-primary/10 mt-6">
                                        <span className="font-black uppercase tracking-widest text-[10px] md:text-xs text-white/90">Total Amount Due</span>
                                        <span className="font-black text-xl md:text-2xl tracking-tight">₱{(dbBaseFee + dbProcessingFee).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        }
                        onSubmit={handleSubmit}
                        onBack={goPrev}
                        backLabel="Previous"
                        detailsCards={
                            <div className="grid md:grid-cols-2 gap-6">
                                <Card className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                        <User size={14} className="stroke-[2.5]" /> Informant Info
                                    </h3>
                                    <div className="space-y-1">
                                        <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Name</span>
                                        <span className="text-slate-900 dark:text-white text-xs font-bold uppercase">{[form.informantFirstName, form.informantLastName].filter(Boolean).join(" ") || "N/A"}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Relationship / Contact</span>
                                        <span className="text-slate-900 dark:text-white text-xs font-bold uppercase">
                                            {form.relationship === "OTHER" ? form.relationshipSpecify : form.relationship || "N/A"} ({form.contactNumber || "N/A"})
                                        </span>
                                    </div>
                                </Card>

                                <Card className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                        <Home size={14} className="stroke-[2.5]" /> Fee Details
                                    </h3>
                                    <div className="space-y-2 text-xs font-semibold">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Registration Base Fee</span>
                                            <span className="text-slate-950 dark:text-white font-bold">₱{dbBaseFee.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Processing & e-Copy Fee</span>
                                            <span className="text-slate-950 dark:text-white font-bold">₱{dbProcessingFee.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-200 dark:border-white/10 pt-2 font-black">
                                            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Total Amount</span>
                                            <span className="text-theme-primary text-sm">₱{(dbBaseFee + dbProcessingFee).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-theme-primary flex items-center gap-2">
                                        <Users size={14} className="stroke-[2.5]" /> Deceased Info
                                    </h3>
                                    <div className="space-y-2 text-xs font-semibold">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2">
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Name</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">{form.deceasedFullName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Gender / Civil Status</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">{form.deceasedGender || "N/A"} / {form.deceasedCivilStatus || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Date of Birth</span>
                                                <span className="text-slate-900 dark:text-white font-bold">
                                                    {form.deceasedDateOfBirth ? new Date(form.deceasedDateOfBirth).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Date of Death</span>
                                                <span className="text-slate-900 dark:text-white font-bold">
                                                    {form.deceasedDateOfDeath ? new Date(form.deceasedDateOfDeath).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                                                </span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Place of Death</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">{getPlaceOfDeathText()}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Cause of Death</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">{form.deceasedCauseOfDeath || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Father's Name</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">{form.deceasedFatherName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Mother's Maiden Name</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">{form.deceasedMotherName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Corpse Disposal</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">
                                                    {form.corpseDisposalMethod === "OTHER" ? form.corpseDisposalMethodCustom : form.corpseDisposalMethod || "N/A"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Cemetery Location</span>
                                                <span className="text-slate-900 dark:text-white font-bold uppercase">{form.cemeteryLocation || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        }
                        documentsSection={
                            (files.deathCertificate || previews.deathCertificate) ? (
                                <div className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-theme-primary/30 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white">
                                            <Upload size={18} className="stroke-[2.5]" />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Uploaded Documents</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ReadOnlyDocumentPreview
                                            file={files.deathCertificate}
                                            previewUrl={previews.deathCertificate}
                                            label="Certificate of Death"
                                            fileName={files.deathCertificate ? files.deathCertificate.name : previews.deathCertificate ? "Uploaded from Mobile" : "Not uploaded"}
                                            onView={() => handleViewFile(files.deathCertificate, previews.deathCertificate, "Certificate of Death")}
                                        />
                                    </div>
                                </div>
                            ) : null
                        }
                    />
                )}

                {/* Step 5: SUBMIT SUCCESS OR SUMMARY */}
                {currentStep === "SUBMIT" && selectedApplication && (
                    (() => {
                        const addData = selectedApplication.additionalData as any || {};
                        const isCancelled = selectedApplication.isCancelled;
                        return (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                                <Card className="bg-white/40 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-theme-primary/5 rounded-full blur-3xl -z-10" />

                                    <div className="flex justify-between items-start gap-4 flex-wrap border-b border-slate-200 dark:border-white/10 pb-6">
                                        <div>
                                            <h3 className="text-lg font-black uppercase tracking-tight">MUNICIPAL CIVIL REGISTRY</h3>
                                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-theme-primary">Local Civil Registry Office</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={cn("text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest border",
                                                isCancelled ? "bg-red-500/20 text-red-400 border-red-500/30" :
                                                    selectedApplication.status === "RELEASED" ? "bg-theme-primary/20 text-theme-primary border-theme-primary/30" :
                                                        selectedApplication.status === "FOR_REVISION" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                                            "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                            )}>
                                                {isCancelled ? "CANCELLED" : selectedApplication.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-6 text-sm font-semibold mt-6">
                                        <div className="space-y-4">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Transaction ID</span>
                                                <span className="text-xs font-black">{selectedApplication.id}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Deceased Person</span>
                                                <span className="uppercase font-black text-theme-primary">{addData.subjectName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Gender / Civil Status</span>
                                                <span className="uppercase font-black">{addData.deceasedGender || "N/A"} / {addData.deceasedCivilStatus || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Birth</span>
                                                <span className="font-black">
                                                    {addData.deceasedDateOfBirth
                                                        ? new Date(addData.deceasedDateOfBirth).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                                                        : "N/A"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Death</span>
                                                <span className="font-black">
                                                    {addData.dateOfDeath
                                                        ? new Date(addData.dateOfDeath).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                                                        : "N/A"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Place of Death</span>
                                                <span className="uppercase font-bold">{addData.placeOfDeath || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Cause of Death</span>
                                                <span className="uppercase font-bold">{addData.deceasedCauseOfDeath || "N/A"}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Informant</span>
                                                <span className="uppercase font-black">{addData.informantName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Relationship to Deceased</span>
                                                <span className="uppercase font-bold">{addData.relationship || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Father's Name</span>
                                                <span className="uppercase font-bold">{addData.deceasedFatherName || addData.fatherName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Mother's Maiden Name</span>
                                                <span className="uppercase font-bold">{addData.deceasedMotherName || addData.motherName || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Corpse Disposal Method</span>
                                                <span className="uppercase font-bold">{addData.corpseDisposalMethod || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Cemetery Location</span>
                                                <span className="uppercase font-bold">{addData.cemeteryLocation || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {addData.deathCertificate && (
                                        <div className="border-t border-slate-200 dark:border-white/10 pt-6 mt-6">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Submitted Documents</span>
                                            <div className="max-w-xs">
                                                <ReadOnlyDocumentPreview
                                                    file={null}
                                                    previewUrl={addData.deathCertificate}
                                                    label="Certificate of Death"
                                                    fileName="Certificate_of_Death.pdf"
                                                    onView={() => handleViewFile(null, addData.deathCertificate, "Certificate of Death")}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-6">
                                        <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                                            <span className="text-slate-400">Total Application Fee</span>
                                            <span className="text-theme-primary text-sm">₱{(selectedApplication.totalAmount || (dbBaseFee + dbProcessingFee)).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6">
                                        {isCancelled ? (
                                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-xs text-red-600 dark:text-red-400 font-semibold leading-relaxed">
                                                <AlertCircle className="w-5 h-5 shrink-0" />
                                                <span>This application has been cancelled and will not be processed further.</span>
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
                                </Card>

                                <div className="flex justify-center gap-4">
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            setSelectedApplication(null);
                                            setCurrentStep(existingRequests.length > 0 ? "EXISTING" : "INFORMANT");
                                        }}
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
                                    {selectedApplication.status === "FOR_REVISION" && !isCancelled && (
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setRevisionId(selectedApplication.id);
                                                setRevisionTx(selectedApplication);
                                                const addData = selectedApplication.additionalData || {};
                                                setForm(prev => ({
                                                    ...prev,
                                                    deceasedFullName: addData.deceasedFullName || addData.subjectName || "",
                                                    deceasedDateOfBirth: addData.deceasedDateOfBirth || "",
                                                    deceasedDateOfDeath: addData.deceasedDateOfDeath || addData.dateOfDeath || addData.dateOfEvent || "",
                                                    deceasedPlaceOfDeath: addData.deceasedPlaceOfDeath || addData.placeOfDeath || addData.placeOfEvent || "",
                                                    deceasedPlaceOfDeathCustom: addData.deceasedPlaceOfDeathCustom || "",
                                                    deceasedCauseOfDeath: addData.deceasedCauseOfDeath || "",
                                                    deceasedGender: addData.deceasedGender || "",
                                                    deceasedCivilStatus: addData.deceasedCivilStatus || "",
                                                    deceasedFatherName: addData.deceasedFatherName || addData.fatherName || "",
                                                    deceasedMotherName: addData.deceasedMotherName || addData.motherName || "",
                                                    corpseDisposalMethod: addData.corpseDisposalMethod || "",
                                                    corpseDisposalMethodCustom: addData.corpseDisposalMethodCustom || "",
                                                    cemeteryLocation: addData.cemeteryLocation || "",
                                                    relationship: addData.relationship || "",
                                                    relationshipSpecify: addData.relationshipSpecify || "",
                                                    contactNumber: addData.contactNumber || prev.contactNumber,
                                                    email: addData.email || prev.email,
                                                }));
                                                if (addData.deathCertificate) {
                                                    setPreviews({ deathCertificate: addData.deathCertificate });
                                                }
                                                setCurrentStep("INFORMANT");
                                            }}
                                            className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg"
                                        >
                                            Revise Details
                                        </Button>
                                    )}
                                    {!isCancelled && !["RELEASED", "REJECTED", "PAID", "DELIVERED"].includes(selectedApplication.status) && (
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
                    })()
                )}

                {/* Step 5: SUCCESS (No Application selected, usually right after new submit) */}
                {currentStep === "SUBMIT" && !selectedApplication && (
                    <div className="text-center py-12 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-theme-primary/20 text-theme-primary flex items-center justify-center mx-auto mb-6 animate-bounce">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight">
                            Registration <span className="text-theme-primary">Submitted</span>
                        </h2>
                        <p className="text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                            The death registration request has been successfully queued for LCR officer verification.
                        </p>
                        <div className="mt-8 flex justify-center">
                            <Button
                                onClick={() => {
                                    setSelectedApplication(null);
                                    setCurrentStep(existingRequests.length > 0 ? "EXISTING" : "INFORMANT");
                                }}
                                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-black uppercase tracking-wider text-xs px-8 py-5 rounded-2xl transition-all"
                            >
                                Back to List
                            </Button>
                        </div>
                    </div>
                )}

                {/* Navigation Buttons for Wizard Steps */}
                {currentStep !== "SUBMIT" && currentStep !== "EXISTING" && currentStep !== "REVIEW" && (
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (currentStep === "INFORMANT") {
                                    if (existingRequests.length > 0) {
                                        setCurrentStep("EXISTING");
                                    } else {
                                        router.push("/modules/civil-registry");
                                    }
                                } else {
                                    goPrev();
                                }
                            }}
                            className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-bold uppercase tracking-wider text-xs px-6 py-5 rounded-2xl transition-all"
                        >
                            <ChevronLeft className="inline-block mr-1 w-4 h-4" />
                            {currentStep === "INFORMANT" ? (existingRequests.length > 0 ? "Back to List" : "Back to Hub") : "Previous"}
                        </Button>

                        <Button
                            onClick={goNext}
                            className="bg-theme-primary hover:bg-theme-hover text-white font-black uppercase tracking-wider text-xs px-8 py-5 shadow-lg shadow-theme-primary/20 cursor-pointer rounded-2xl transition-all"
                        >
                            Next Step
                            <ChevronRight className="inline-block ml-1 w-4 h-4" />
                        </Button>
                    </div>
                )}

            </div>

            {/* Viewer Modals */}
            <DocumentViewerModal
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                file={viewerFile}
                fileUrl={viewerUrl}
                title={viewerTitle}
                themeColor="var(--primary-theme)"
            />

            <PrivacyTermsModal
                isOpen={policyOpen}
                onClose={() => setPolicyOpen(false)}
                onAccept={() => {
                    setPolicyAccepted(true);
                    setPolicyOpen(false);
                }}
                onDecline={() => {
                    setPolicyAccepted(false);
                    setPolicyOpen(false);
                }}
                themeColor="var(--primary-theme)"
            />

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
