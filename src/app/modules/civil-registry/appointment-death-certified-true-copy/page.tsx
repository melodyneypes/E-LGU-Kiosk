"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import SecureIdleTimer from "@/components/shared/SecureIdleTimer";
import PrivacyTermsModal from "@/components/shared/PrivacyTermsModal";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Loader2,
    Check,
    AlertCircle,
    Home,
    Skull,
    CheckCircle2,
    FileText,
    ArrowLeft,
    Calendar,
    X,
    Search
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import SchedulePicker from "@/components/shared/SchedulePicker";
import {
    getCurrentUserResident,
    ensureCivilRegistryTransactionTypes,
    submitCivilRegistryTransaction,
    getTransactionTypes,
    getSystemSettingAction,
    getLatestForm2AForCurrentUser,
    getTransactionById,
    logDebugMessage,
    getRegistrarAppointmentConfig,
    getBarangaysList
} from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "INFORMANT" | "SUBJECT" | "SCHEDULE" | "REVIEW";

const STEPS: { id: Step; label: string; icon: any }[] = [
    { id: "INFORMANT", label: "Informant Info", icon: User },
    { id: "SUBJECT", label: "Deceased & Documents", icon: FileText },
    { id: "SCHEDULE", label: "Choose Schedule", icon: Calendar },
    { id: "REVIEW", label: "Review & Submit", icon: CheckCircle2 },
];

export default function AppointmentDeathCertifiedTrueCopyPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string>("");
    const [currentStep, setCurrentStep] = useState<Step>("INFORMANT");
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);

    const [themeColor, setThemeColor] = useState("var(--primary-theme)");
    const [appointmentConfig, setAppointmentConfig] = useState<any>(null);
    const [bookedSlots, setBookedSlots] = useState<any[]>([]);

    useEffect(() => {
        getSystemSettingAction("theme_color").then((res) => {
            if (res.success && res.data) {
                setThemeColor(res.data);
            }
        });
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);
    const [submitting, setSubmitting] = useState(false);
    const [resident, setResident] = useState<any>(null);
    const [typeId, setTypeId] = useState<string>("");
    const [dbType, setDbType] = useState<any>(null);
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [revisionTx, setRevisionTx] = useState<any>(null);
    const [showErrors, setShowErrors] = useState(false);
    const [barangaysList, setBarangaysList] = useState<string[]>([]);
    const [placeOfDeathOpen, setPlaceOfDeathOpen] = useState(false);
    const [placeOfDeathSearch, setPlaceOfDeathSearch] = useState("");
    const [placeOfDeathRect, setPlaceOfDeathRect] = useState<DOMRect | null>(null);
    const placeOfDeathTriggerRef = useRef<HTMLDivElement>(null);

    const openPlaceOfDeathDropdown = useCallback(() => {
        if (placeOfDeathTriggerRef.current) {
            setPlaceOfDeathRect(placeOfDeathTriggerRef.current.getBoundingClientRect());
        }
        setPlaceOfDeathOpen(true);
        setPlaceOfDeathSearch("");
    }, []);

    // Form State
    const [formData, setFormData] = useState({
        relationship: "",
        relationshipOther: "",
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
        // Subject (Deceased) fields
        subjectFullName: "",
        subjectDateOfDeath: "",
        mothersMaidenName: "",
        fathersName: "",
        placeOfDeath: "",
        causeOfDeath: "",
        appointmentDate: "",
        appointmentSlot: "",
    });

    // Privacy / Terms modal state
    const [policyOpen, setPolicyOpen] = useState(false);
    const [policyAccepted, setPolicyAccepted] = useState(false);

    const parsedDefaultFees = dbType?.defaultFees 
        ? (typeof dbType.defaultFees === "string" ? JSON.parse(dbType.defaultFees) : dbType.defaultFees) 
        : [];
    const miscFeeAmount = dbType?.baseFee ?? 130.00;
    const mandatoryFeeAmount = parsedDefaultFees.find((f: any) => f.code === "MANDATORY_FINE" || f.code === "MANDATORY_FEE")?.amount ?? 140.00;
    const apptTotalAmount = miscFeeAmount + mandatoryFeeAmount;

    const handleAcceptPolicy = () => { setPolicyOpen(false); setPolicyAccepted(true); };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _isRestoredRef = useRef(false);

    // Restore progress from session storage
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("revisionId")) return;

        const savedStep = sessionStorage.getItem("appointment-death-certified-true-copy-step");
        const savedForm = sessionStorage.getItem("appointment-death-certified-true-copy-form");

        if (savedStep) setCurrentStep(savedStep as Step);
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
    }, []);

    useEffect(() => {
        if (!loading && !revisionId) {
            sessionStorage.setItem("appointment-death-certified-true-copy-step", currentStep);
            sessionStorage.setItem("appointment-death-certified-true-copy-form", JSON.stringify(formData));
        }
    }, [currentStep, formData, loading, revisionId]);

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

                await logDebugMessage("Client: init() started");
                await logDebugMessage("Client: Calling ensureCivilRegistryTransactionTypes()...");
                await ensureCivilRegistryTransactionTypes();
                await logDebugMessage("Client: ensureCivilRegistryTransactionTypes() finished");

                const urlParams = new URLSearchParams(window.location.search);
                const revId = urlParams.get("revisionId");

                let txData: any = null;
                if (revId) {
                    await logDebugMessage(`Client: Fetching revision transaction for ID ${revId}...`);
                    const txRes = await getTransactionById(revId, uId);
                    if (txRes.success && txRes.data) {
                        txData = txRes.data;
                        setRevisionId(revId);
                        setRevisionTx(txData);
                        await logDebugMessage("Client: Revision transaction fetched successfully");
                    } else {
                        toast.error("Failed to fetch revision details");
                        await logDebugMessage(`Client: Failed to fetch revision details: ${txRes.error}`);
                    }
                }

                await logDebugMessage("Client: Calling getCurrentUserResident() and getTransactionTypes()...");
                const [resResult, typesResult, configResult, brgyResult] = await Promise.all([
                    getCurrentUserResident(uId).catch(err => ({ success: false, data: null, error: err?.message || err })),
                    getTransactionTypes().catch(err => ({ success: false, data: [] as any, error: err?.message || err })),
                    getRegistrarAppointmentConfig().catch(err => ({ success: false, config: null, bookedSlots: [], error: err?.message || err })),
                    getBarangaysList().catch(err => ({ success: false, data: [] as string[], error: err?.message || err }))
                ]);
                await logDebugMessage("Client: getCurrentUserResident() and getTransactionTypes() resolved");

                if (brgyResult.success && brgyResult.data) {
                    setBarangaysList(brgyResult.data);
                }

                if (configResult.success) {
                    setAppointmentConfig(configResult.config);
                    setBookedSlots(configResult.bookedSlots);
                }

                let r: any = resResult.success && resResult.data ? resResult.data : null;
                if (!r && residentObj) {
                    r = {
                        firstName: residentObj.firstName || "",
                        middleName: residentObj.middleName || "",
                        lastName: residentObj.lastName || "",
                        suffix: residentObj.suffix || "",
                        dateOfBirth: residentObj.dateOfBirth || "",
                        age: residentObj.age || "",
                        civilStatus: residentObj.civilStatus || "",
                        citizenship: residentObj.citizenship || "FILIPINO",
                        occupation: residentObj.occupation || "",
                        contactNumber: residentObj.contactNumber || "",
                        barangay: residentObj.barangay || "",
                        user: { email: residentObj.email || "" }
                    };
                }

                if (r) {
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

                        setFormData(prev => {
                            const rel = addData.relationship && addData.relationship.startsWith("OTHER:") ? "OTHER" : (addData.relationship || prev.relationship);

                            return {
                                ...prev,
                                relationship: rel,
                                relationshipOther: addData.relationship && addData.relationship.startsWith("OTHER:") ? addData.relationship.replace(/^OTHER:\s*/i, "") : "",
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
                                subjectDateOfDeath: addData.subjectDateOfDeath || "",
                                mothersMaidenName: addData.mothersMaidenName || "",
                                fathersName: addData.fathersName || "",
                                placeOfDeath: addData.placeOfDeath || "",
                                causeOfDeath: addData.causeOfDeath || "",
                                appointmentDate: addData.appointmentDate || (txData.appointmentDate ? new Date(txData.appointmentDate).toISOString().split('T')[0] : "") || "",
                                appointmentSlot: addData.appointmentSlot || txData.appointmentSlot || "",
                            };
                        });
                    } else {
                        setFormData(prev => {
                            return {
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
                            };
                        });
                    }
                }

                if (typesResult.success && typesResult.data) {
                    const psaType = typesResult.data.find((t: any) => t.code === "LCR_DEATH_CERTIFIED_TRUE_COPY_APPOINTMENT");
                    if (psaType) {
                        setTypeId(psaType.id);
                        setDbType(psaType);
                        await logDebugMessage(`Client: Found dbType ID: ${psaType.id}`);
                    } else {
                        await logDebugMessage("Client: LCR_DEATH_CERTIFIED_TRUE_COPY_APPOINTMENT type NOT found in dbTypes list");
                    }
                } else {
                    await logDebugMessage(`Client: getTransactionTypes was unsuccessful: ${(typesResult as any).error || "Unknown error"}`);
                }
                await logDebugMessage("Client: init() try block successfully finished");
            } catch (error: any) {
                console.error("Initialization error:", error);
                await logDebugMessage(`Client: init() catch block error: ${error?.message || error}`);
            } finally {
                await logDebugMessage("Client: init() finally block (setting loading=false)");
                setLoading(false);
            }
        }
        init();
    }, [router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === "relationship") {
                const promise = (async () => {
                    const res = await getLatestForm2AForCurrentUser(userId);
                    if (res.success && res.data) {
                        const { subjectName, dateOfDeath, mothersMaidenName, fathersName, placeOfDeath, causeOfDeath } = res.data;
                        setFormData(prevFormData => ({
                            ...prevFormData,
                            subjectFullName: subjectName ? subjectName.toUpperCase() : prevFormData.subjectFullName,
                            subjectDateOfDeath: dateOfDeath ? new Date(dateOfDeath).toISOString().split('T')[0] : prevFormData.subjectDateOfDeath,
                            mothersMaidenName: mothersMaidenName ? mothersMaidenName.toUpperCase() : prevFormData.mothersMaidenName,
                            fathersName: fathersName ? fathersName.toUpperCase() : prevFormData.fathersName,
                            placeOfDeath: placeOfDeath ? placeOfDeath.toUpperCase() : prevFormData.placeOfDeath,
                            causeOfDeath: causeOfDeath ? causeOfDeath.toUpperCase() : prevFormData.causeOfDeath
                        }));
                    }
                })();
                toast.promise(promise, {
                    loading: "Searching for your latest Form 2A record...",
                    success: "Form 2A check complete.",
                    error: "Error checking latest Form 2A."
                });
            }
            return next;
        });
    };

    const validateStep = (step: Step): boolean => {
        if (step === "INFORMANT") {
            const isSpecifyEmpty = (formData.relationship === "OTHER") && !formData.relationshipOther?.trim();
            if (!formData.relationship || !formData.contactNumber || isSpecifyEmpty) {
                setShowErrors(true);
                toast.error("Please complete highlighted required fields.");
                return false;
            }
        }
        if (step === "SUBJECT") {
            if (!formData.subjectFullName || !formData.subjectDateOfDeath || !formData.mothersMaidenName) {
                setShowErrors(true);
                toast.error("Please fill in all required fields.");
                return false;
            }
        }
        if (step === "SCHEDULE") {
            if (!formData.appointmentDate || !formData.appointmentSlot) {
                setShowErrors(true);
                toast.error("Please select appointment date and slot.");
                return false;
            }
        }
        return true;
    };

    const handleNext = () => {
        if (currentStep === "INFORMANT") {
            if (validateStep("INFORMANT")) setCurrentStep("SUBJECT");
        } else if (currentStep === "SUBJECT") {
            if (validateStep("SUBJECT")) setCurrentStep("SCHEDULE");
        } else if (currentStep === "SCHEDULE") {
            if (validateStep("SCHEDULE")) setCurrentStep("REVIEW");
        }
    };

    const handleBack = () => {
        if (currentStep === "SUBJECT") setCurrentStep("INFORMANT");
        else if (currentStep === "SCHEDULE") setCurrentStep("SUBJECT");
        else if (currentStep === "REVIEW") setCurrentStep("SCHEDULE");
    };

    const handleSubmit = async () => {
        if (submitting) return;

        if (!policyAccepted) {
            setShowErrors(true);
            toast.error("Please review and accept the Privacy Policy & Terms before submitting.");
            return;
        }

        if (!typeId) {
            toast.error("Service type not initialized. Please try again later.");
            return;
        }

        setSubmitting(true);
        try {
            const data = new FormData();
            data.append("typeId", typeId);
            data.append("registryType", "DEATH_CERTIFIED_TRUE_COPY_APPOINTMENT");
            if (revisionId) {
                data.append("revisionId", revisionId);
            }

            const parts = [
                resident.houseNumber && `#${resident.houseNumber}`,
                resident.street && `${resident.street} St.`,
                resident.purok && `Purok ${resident.purok}`,
                resident.sitio && `Sitio ${resident.sitio}`,
                resident.barangay && `Brgy. ${resident.barangay}`,
                resident.municipality || "",
                resident.province || ""
            ].filter(Boolean);
            const constructedAddr = parts.join(", ").toUpperCase();

            const residentSnapshot = {
                firstName: resident.firstName || "",
                middleName: resident.middleName || "",
                lastName: resident.lastName || "",
                suffix: resident.suffix || "",
                contactNumber: formData.contactNumber || resident.contactNumber || "",
                email: formData.email || resident.user?.email || "",
                address: constructedAddr
            };

            data.append("residentSnapshot", JSON.stringify(residentSnapshot));

            const finalRelationship = (formData.relationship === "OTHER")
                ? `OTHER: ${formData.relationshipOther.toUpperCase()}`
                : formData.relationship;

            const additionalData = {
                relationship: finalRelationship,
                contactNumber: formData.contactNumber,
                email: formData.email,
                subjectFullName: formData.subjectFullName,
                subjectDateOfDeath: formData.subjectDateOfDeath,
                mothersMaidenName: formData.mothersMaidenName,
                fathersName: formData.fathersName,
                placeOfDeath: formData.placeOfDeath,
                causeOfDeath: formData.causeOfDeath,
                appointmentDate: formData.appointmentDate,
                appointmentSlot: formData.appointmentSlot,
                psaEndorsementFee: miscFeeAmount,
            };
            data.append("additionalData", JSON.stringify(additionalData));

            const res = await submitCivilRegistryTransaction(data, userId);

            if (res.success && res.data) {
                toast.success(revisionId ? "Revision resubmitted successfully!" : "Death Certified True Copy Appointment submitted successfully!");
                sessionStorage.removeItem("appointment-death-certified-true-copy-step");
                sessionStorage.removeItem("appointment-death-certified-true-copy-form");
                router.push("/modules/civil-registry");
            } else {
                toast.error(res.error || "Failed to submit request");
            }
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                ${themeColor !== "var(--primary-theme)" ? `
                :root, * {
                    --primary-theme: ${themeColor} !important;
                }
                ` : ""}
                .text-emerald-500, [class*="text-emerald-500"]:not(input):not(select):not(textarea) {
                    color: ${themeColor} !important;
                }
                .text-emerald-600, [class*="text-emerald-600"]:not(input):not(select):not(textarea) {
                    color: ${themeColor} !important;
                }
                .bg-emerald-500, [class*="bg-emerald-500"] {
                    background-color: ${themeColor} !important;
                }
                .bg-slate-600, [class*="bg-slate-600"] {
                    background-color: ${themeColor} !important;
                }
                .border-slate-500, [class*="border-slate-500"] {
                    border-color: ${themeColor} !important;
                }
                .border-slate-600, [class*="border-slate-600"] {
                    border-color: ${themeColor} !important;
                }
                .bg-emerald-500\\/10, [class*="bg-emerald-500/10"] {
                    background-color: ${themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 10%, transparent)" : `${themeColor}1a`} !important;
                }
                .bg-emerald-500\\/20, [class*="bg-emerald-500/20"] {
                    background-color: ${themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 20%, transparent)" : `${themeColor}33`} !important;
                }
                .bg-emerald-500\\/5, [class*="bg-emerald-500/5"] {
                    background-color: ${themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 5%, transparent)" : `${themeColor}0d`} !important;
                }
                .shadow-emerald-500\\/20, [class*="shadow-emerald-500/20"] {
                    --tw-shadow-color: ${themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 20%, transparent)" : `${themeColor}33`} !important;
                }
                .hover\\:bg-slate-600:hover, [class*="hover:bg-slate-600"]:hover {
                    background-color: ${themeColor} !important;
                    filter: brightness(0.9);
                }
                .hover\\:border-emerald-500\\/50:hover, [class*="hover:border-emerald-500/50"]:hover {
                    border-color: ${themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 50%, transparent)" : `${themeColor}80`} !important;
                }
                input:not([type="button"]):not([type="submit"]), select, textarea, button[role="combobox"], [class*="SelectTrigger"] {
                    color: #0f172a !important;
                }
                input:not([type="button"]):not([type="submit"]):disabled, select:disabled, textarea:disabled,
                input:not([type="button"]):not([type="submit"])[readonly], select[readonly], textarea[readonly] {
                    color: #1e293b !important;
                    -webkit-text-fill-color: #1e293b !important;
                    opacity: 0.9 !important;
                }
                .dark input:not([type="button"]):not([type="submit"]), .dark select, .dark textarea, .dark button[role="combobox"], .dark [class*="SelectTrigger"] {
                    color: #f8fafc !important;
                }
                .dark input:not([type="button"]):not([type="submit"]):disabled, .dark select:disabled, .dark textarea:disabled,
                .dark input:not([type="button"]):not([type="submit"])[readonly], .dark select[readonly], .dark textarea[readonly] {
                    color: #cbd5e1 !important;
                    -webkit-text-fill-color: #cbd5e1 !important;
                    opacity: 0.8 !important;
                }
                `
            }} />
            <SecureIdleTimer />
            <PrivacyTermsModal
                isOpen={policyOpen}
                onClose={() => setPolicyOpen(false)}
                onAccept={handleAcceptPolicy}
                onDecline={() => { setPolicyAccepted(false); }}
                themeColor={themeColor}
            />

            <div className="container max-w-5xl mx-auto px-4 pt-3 pb-0 space-y-5">
                <div className="sticky top-[64px] sm:top-[80px] z-40 md:static -mx-4 md:mx-0 px-4 md:px-0 pt-2 md:pt-0">
                    <Breadcrumb>
                        <BreadcrumbList className="flex-nowrap whitespace-nowrap overflow-x-auto scrollbar-none max-w-full bg-white/80 dark:bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-200/60 dark:border-white/5 w-full md:w-fit shadow-sm">
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link href="/" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors italic">
                                        <Home className="w-3.5 h-3.5 mb-0.5" />
                                        Home
                                    </Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-slate-300 dark:text-white/10" />
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link href="/modules/civil-registry" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors italic">
                                        Civil Registry
                                    </Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-slate-300 dark:text-white/10" />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: themeColor }}>Death Certified True Copy Appointment</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="space-y-6">
                    {/* Header */}
                    <div className="relative overflow-hidden bg-white dark:bg-[#0c1017] p-6 md:p-10 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white shadow-xl dark:shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                        <div
                            className="absolute top-0 right-0 w-96 h-96 blur-[120px] rounded-full opacity-10 dark:opacity-20 pointer-events-none -mr-40 -mt-40 transition-colors duration-700"
                            style={{ backgroundColor: themeColor }}
                        />

                        <div className="space-y-3 md:space-y-4 max-w-2xl relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center backdrop-blur-md">
                                    <Skull className="w-4 h-4 text-emerald-500" style={{ color: themeColor }} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-white/70 italic">Local Civil Registry</span>
                            </div>

                            <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">
                                Death Certified True Copy <span style={{ color: themeColor }}>Appointment</span>
                            </h1>

                            <p className="text-slate-600 dark:text-slate-300 font-medium text-xs leading-relaxed max-w-xl italic">
                                Schedule an appointment and request a certified true copy of an existing death certificate.
                            </p>
                        </div>
                    </div>

                    {/* Progress Stepper */}
                    <div className="grid grid-cols-4 gap-1.5 md:gap-4 relative px-1 md:px-2 py-4">
                        {STEPS.map((step, idx) => {
                            const isActive = currentStep === step.id;
                            const stepIdx = STEPS.findIndex(s => s.id === currentStep);
                            const isCompleted = stepIdx > idx;
                            const Icon = step.icon;

                            return (
                                <div
                                    key={idx}
                                    className="flex flex-col items-center gap-2 md:gap-3 relative z-10 font-black group cursor-pointer"
                                    onClick={() => {
                                        const targetIdx = STEPS.findIndex(s => s.id === step.id);
                                        const currentIdx = STEPS.findIndex(s => s.id === currentStep);
                                        if (targetIdx <= currentIdx) {
                                            setCurrentStep(step.id);
                                        } else {
                                            for (let i = currentIdx; i < targetIdx; i++) {
                                                const stepToValidate = STEPS[i].id;
                                                if (!validateStep(stepToValidate)) {
                                                    return;
                                                }
                                            }
                                            setCurrentStep(step.id);
                                        }
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "w-11 h-11 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                                            isActive ? "text-white border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)] scale-105 md:scale-110" :
                                                isCompleted ? "border-transparent" :
                                                    "bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent group-hover:border-primary/30"
                                        )}
                                        style={
                                            isActive
                                                ? { backgroundColor: themeColor, borderColor: themeColor }
                                                : isCompleted
                                                    ? { backgroundColor: themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 10%, transparent)" : `${themeColor}1a`, color: themeColor, borderColor: themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 20%, transparent)" : `${themeColor}33` }
                                                    : {}
                                        }
                                    >
                                        <Icon className="w-4 h-4 md:w-7 md:h-7" />
                                    </div>
                                    <span
                                        className={cn(
                                            "text-[7px] md:text-[10px] uppercase tracking-widest text-center italic hidden sm:block",
                                            (isActive || isCompleted) ? "opacity-100 font-black" : "opacity-40 group-hover:opacity-100 transition-opacity"
                                        )}
                                        style={(isActive || isCompleted) ? { color: themeColor } : {}}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {mounted && typeof document !== "undefined" && createPortal(
                        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#06080a] border-t border-slate-200 dark:border-white/10 z-50 pt-2.5 pb-2.5 px-4 flex flex-col items-center">
                            <div className="w-full max-w-5xl flex items-center justify-center gap-4">
                                <div className="h-1.5 flex-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-slate-600"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${((STEPS.findIndex(s => s.id === currentStep) + 1) / STEPS.length) * 100}%` }}
                                        style={{ backgroundColor: themeColor }}
                                    />
                                </div>
                                <span className="font-black uppercase tracking-widest italic text-[8px] md:text-[10px] text-slate-400 whitespace-nowrap">
                                    Phase {STEPS.findIndex(s => s.id === currentStep) + 1} / {STEPS.length}
                                </span>
                            </div>
                        </div>,
                        document.body
                    )}

                    <Card className="p-6 md:p-10 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 bg-white dark:bg-[#0f1117] shadow-xl dark:shadow-2xl overflow-hidden min-h-[400px]">
                        <AnimatePresence mode="wait">
                            {/* ===== STEP 1: INFORMANT ===== */}
                            {currentStep === "INFORMANT" && (
                                <motion.div
                                    key="informant-step"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-1">
                                        <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                            Personal <span style={{ color: themeColor }}>Information</span>
                                        </h2>
                                        <p className="text-[10px] md:text-xs text-slate-500 font-medium italic">
                                            Your details as the requesting informant
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

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Relationship to Subject <span className="text-red-500">*</span></Label>
                                            {formData.relationship === "OTHER" ? (
                                                <div className="relative flex items-center">
                                                    <Input
                                                        value={formData.relationshipOther || ""}
                                                        onChange={(e) => setFormData(p => ({ ...p, relationshipOther: e.target.value }))}
                                                        className={cn("h-12 rounded-xl text-xs md:text-sm font-bold uppercase pr-10 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10", (showErrors && !formData.relationshipOther) && "!border-2 !border-red-500")}
                                                        placeholder="Specify relationship (e.g. Nephew, Friend)"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(p => ({ ...p, relationship: "", relationshipOther: "" }))}
                                                        className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                                                        title="Back to options"
                                                    >
                                                        <X className="w-4.5 h-4.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <Select
                                                    value={formData.relationship}
                                                    onValueChange={(v) => handleSelectChange("relationship", v)}
                                                >
                                                    <SelectTrigger style={{ height: '3rem' }} className={cn("!h-12 rounded-xl focus:ring-slate-500 shadow-sm text-xs md:text-sm bg-white dark:bg-slate-900 transition-all font-bold border border-slate-200 dark:border-white/10", (showErrors && !formData.relationship) ? "!border-2 !border-red-500" : "")}>
                                                        <SelectValue placeholder="SELECT RELATIONSHIP" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-slate-200 dark:border-white/10 italic">
                                                        <SelectItem value="SPOUSE">SPOUSE</SelectItem>
                                                        <SelectItem value="CHILD">CHILD</SelectItem>
                                                        <SelectItem value="PARENT">PARENT</SelectItem>
                                                        <SelectItem value="SIBLING">SIBLING</SelectItem>
                                                        <SelectItem value="OTHER">OTHER</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {(showErrors && !formData.relationship) && (
                                                <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">First Name</Label>
                                                <Input readOnly placeholder="FIRST NAME" value={formData.informantFirstName} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Middle Name</Label>
                                                <Input readOnly placeholder="MIDDLE NAME" value={formData.informantMiddleName} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Last Name</Label>
                                                <Input readOnly placeholder="LAST NAME" value={formData.informantLastName} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Suffix</Label>
                                                <Input readOnly placeholder="NONE" value={formData.informantSuffix} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Birth Date</Label>
                                                <Input readOnly value={formData.informantBirthDate} type="date" className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Age</Label>
                                                <Input readOnly placeholder="AGE" value={formData.informantAge} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Civil Status</Label>
                                                <Input readOnly placeholder="CIVIL STATUS" value={formData.informantCivilStatus} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Citizenship</Label>
                                                <Input readOnly placeholder="FILIPINO" value={formData.informantCitizenship} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Occupation</Label>
                                                <Input readOnly placeholder="OCCUPATION" value={formData.informantOccupation} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Contact Number <span className="text-red-500">*</span></Label>
                                                <Input
                                                    name="contactNumber"
                                                    value={formData.contactNumber}
                                                    onChange={handleInputChange}
                                                    placeholder="CONTACT NUMBER"
                                                    className={cn("rounded-xl h-12 font-bold uppercase border border-slate-200 dark:border-white/10", (showErrors && !formData.contactNumber) && "!border-2 !border-red-500")}
                                                />
                                                {(showErrors && !formData.contactNumber) && (
                                                    <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Address</Label>
                                            <Input readOnly placeholder="ADDRESS" value={formData.informantAddress} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-12 font-bold uppercase border border-slate-200 dark:border-white/10" />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <Button
                                            onClick={handleNext}
                                            className="h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest italic text-white"
                                            style={{ backgroundColor: themeColor }}
                                        >
                                            Next Step
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ===== STEP 2: SUBJECT ===== */}
                            {currentStep === "SUBJECT" && (
                                <motion.div
                                    key="subject-step"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-1">
                                        <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                            Deceased <span style={{ color: themeColor }}>Details</span>
                                        </h2>
                                        <p className="text-[10px] md:text-xs text-slate-500 font-medium italic">
                                            Details of the deceased subject
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Full Name of Deceased <span className="text-red-500">*</span></Label>
                                            <Input
                                                name="subjectFullName"
                                                value={formData.subjectFullName}
                                                onChange={handleInputChange}
                                                placeholder="FULL NAME OF DECEASED"
                                                className={cn("rounded-xl h-12 font-bold uppercase border border-slate-200 dark:border-white/10", (showErrors && !formData.subjectFullName) && "!border-2 !border-red-500")}
                                            />
                                            {(showErrors && !formData.subjectFullName) && (
                                                <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Date of Death <span className="text-red-500">*</span></Label>
                                                <Input
                                                    name="subjectDateOfDeath"
                                                    type="date"
                                                    value={formData.subjectDateOfDeath}
                                                    onChange={handleInputChange}
                                                    className={cn("rounded-xl h-12 font-bold uppercase border border-slate-200 dark:border-white/10", (showErrors && !formData.subjectDateOfDeath) && "!border-2 !border-red-500")}
                                                />
                                                {(showErrors && !formData.subjectDateOfDeath) && (
                                                    <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Mother&apos;s Maiden Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    name="mothersMaidenName"
                                                    value={formData.mothersMaidenName}
                                                    onChange={handleInputChange}
                                                    placeholder="MOTHER'S MAIDEN NAME"
                                                    className={cn("rounded-xl h-12 font-bold uppercase border border-slate-200 dark:border-white/10", (showErrors && !formData.mothersMaidenName) && "!border-2 !border-red-500")}
                                                />
                                                {(showErrors && !formData.mothersMaidenName) && (
                                                    <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Father&apos;s Name</Label>
                                                <Input
                                                    name="fathersName"
                                                    value={formData.fathersName}
                                                    onChange={handleInputChange}
                                                    placeholder="FATHER'S NAME"
                                                    className="rounded-xl h-12 font-bold uppercase border border-slate-200 dark:border-white/10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Place of Death</Label>
                                                <div className="relative" ref={placeOfDeathTriggerRef}>
                                                    <div
                                                        className="rounded-xl h-12 font-bold uppercase border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 flex items-center px-3 cursor-pointer select-none"
                                                        onClick={openPlaceOfDeathDropdown}
                                                    >
                                                        <span className={cn("flex-1 text-sm truncate", !formData.placeOfDeath && "text-slate-400 font-normal normal-case")}>
                                                            {formData.placeOfDeath || "Select Barangay"}
                                                        </span>
                                                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                                                    </div>
                                                    {placeOfDeathOpen && mounted && placeOfDeathRect && createPortal(
                                                        <>
                                                            {/* Click-outside backdrop */}
                                                            <div
                                                                className="fixed inset-0 z-[9998]"
                                                                onClick={() => setPlaceOfDeathOpen(false)}
                                                            />
                                                            {/* Dropdown panel */}
                                                            <div
                                                                className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                                                                style={{
                                                                    top: placeOfDeathRect.bottom + 6,
                                                                    left: placeOfDeathRect.left,
                                                                    width: placeOfDeathRect.width,
                                                                    maxHeight: Math.min(320, window.innerHeight - placeOfDeathRect.bottom - 16),
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                }}
                                                            >
                                                                <div className="p-2 border-b border-slate-100 dark:border-white/10 shrink-0">
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        placeholder="Search barangay..."
                                                                        value={placeOfDeathSearch}
                                                                        onChange={e => setPlaceOfDeathSearch(e.target.value)}
                                                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-700 outline-none font-medium"
                                                                    />
                                                                </div>
                                                                <div className="overflow-y-auto flex-1">
                                                                    {barangaysList
                                                                        .filter(b => !placeOfDeathSearch || b.toLowerCase().includes(placeOfDeathSearch.toLowerCase()))
                                                                        .map(brgy => (
                                                                            <button
                                                                                key={brgy}
                                                                                type="button"
                                                                                onMouseDown={e => e.preventDefault()}
                                                                                onClick={() => {
                                                                                    const locStr = `Brgy. ${brgy}${resident?.municipality ? `, ${resident.municipality}` : ""}${resident?.province ? `, ${resident.province}` : ""}`;
                                                                                    setFormData(prev => ({ ...prev, placeOfDeath: locStr }));
                                                                                    setPlaceOfDeathOpen(false);
                                                                                    setPlaceOfDeathSearch("");
                                                                                }}
                                                                                className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0"
                                                                            >
                                                                                Brgy. {brgy}{resident?.municipality ? `, ${resident.municipality}` : ""}
                                                                            </button>
                                                                        ))
                                                                    }
                                                                    {barangaysList.filter(b => !placeOfDeathSearch || b.toLowerCase().includes(placeOfDeathSearch.toLowerCase())).length === 0 && (
                                                                        <div className="px-4 py-4 text-xs text-slate-400 italic text-center">No barangay found</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>,
                                                        document.body
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Cause of Death</Label>
                                                <Input
                                                    name="causeOfDeath"
                                                    value={formData.causeOfDeath}
                                                    onChange={handleInputChange}
                                                    placeholder="CAUSE OF DEATH (IF KNOWN)"
                                                    className="rounded-xl h-12 font-bold uppercase border border-slate-200 dark:border-white/10"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between pt-4">
                                        <Button
                                            onClick={handleBack}
                                            variant="outline"
                                            className="h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest italic"
                                        >
                                            <ArrowLeft className="w-4 h-4 mr-2" />
                                            Go Back
                                        </Button>
                                        <Button
                                            onClick={handleNext}
                                            className="h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest italic text-white"
                                            style={{ backgroundColor: themeColor }}
                                        >
                                            Next Step
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ===== STEP 3: SCHEDULE ===== */}
                            {currentStep === "SCHEDULE" && (
                                <motion.div
                                    key="schedule-step"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-1">
                                        <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                            Appointment <span style={{ color: themeColor }}>Schedule</span>
                                        </h2>
                                        <p className="text-[10px] md:text-xs text-slate-500 font-medium italic">
                                            Choose your slot to claim the certified true copy document
                                        </p>
                                    </div>

                                    {appointmentConfig && (
                                        <SchedulePicker
                                            selectedDate={formData.appointmentDate}
                                            setSelectedDate={(dateStr) => setFormData(prev => ({ ...prev, appointmentDate: dateStr }))}
                                            selectedSlot={formData.appointmentSlot}
                                            setSelectedSlot={(slotStr) => setFormData(prev => ({ ...prev, appointmentSlot: slotStr }))}
                                            bookedSlots={bookedSlots}
                                            config={appointmentConfig}
                                            themeColor={themeColor}
                                        />
                                    )}

                                    {showErrors && (!formData.appointmentDate || !formData.appointmentSlot) && (
                                        <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest text-center animate-pulse mt-2">Please select both date and session slot.</p>
                                    )}

                                    <div className="flex justify-between pt-4">
                                        <Button
                                            onClick={handleBack}
                                            variant="outline"
                                            className="h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest italic"
                                        >
                                            <ArrowLeft className="w-4 h-4 mr-2" />
                                            Go Back
                                        </Button>
                                        <Button
                                            onClick={handleNext}
                                            className="h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest italic text-white"
                                            style={{ backgroundColor: themeColor }}
                                        >
                                            Next Step
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ===== STEP 4: REVIEW ===== */}
                            {currentStep === "REVIEW" && (
                                <motion.div
                                    key="review-step"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    className="space-y-8"
                                >
                                    <div className="space-y-1">
                                        <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                            Confirm <span style={{ color: themeColor }}>Submission</span>
                                        </h2>
                                        <p className="text-[10px] md:text-xs text-slate-500 font-medium italic">
                                            Double check your details before processing your certified true copy request
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Informant Review */}
                                        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Informant Details</h3>
                                            <div className="space-y-2.5 text-xs font-bold">
                                                <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                                    <span className="text-slate-400">NAME</span>
                                                    <span className="uppercase">{`${formData.informantFirstName} ${formData.informantMiddleName} ${formData.informantLastName}`}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                                    <span className="text-slate-400">RELATIONSHIP</span>
                                                    <span className="uppercase">{formData.relationship === "OTHER" ? formData.relationshipOther : formData.relationship}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                                    <span className="text-slate-400">CONTACT</span>
                                                    <span>{formData.contactNumber}</span>
                                                </div>
                                                <div className="flex justify-between pb-1.5">
                                                    <span className="text-slate-400">ADDRESS</span>
                                                    <span className="uppercase text-right max-w-[200px] truncate" title={formData.informantAddress}>{formData.informantAddress}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Deceased Review */}
                                        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Deceased Details</h3>
                                            <div className="space-y-2.5 text-xs font-bold">
                                                <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                                    <span className="text-slate-400">DECEASED NAME</span>
                                                    <span className="uppercase">{formData.subjectFullName}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                                    <span className="text-slate-400">DATE OF DEATH</span>
                                                    <span>{formData.subjectDateOfDeath ? new Date(formData.subjectDateOfDeath).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }) : ""}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                                    <span className="text-slate-400">MOTHER&apos;S MAIDEN</span>
                                                    <span className="uppercase">{formData.mothersMaidenName}</span>
                                                </div>
                                                <div className="flex justify-between pb-1.5">
                                                    <span className="text-slate-400">PLACE OF DEATH</span>
                                                    <span className="uppercase text-right max-w-[200px] truncate" title={formData.placeOfDeath}>{formData.placeOfDeath || "NONE"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Appointment Slot Review */}
                                    <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Selected Slot</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                                            <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-1.5 md:border-b-0 md:pb-0">
                                                <span className="text-slate-400">DATE</span>
                                                <span>{formData.appointmentDate ? new Date(formData.appointmentDate).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ""}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">SESSION</span>
                                                <span className="uppercase">{formData.appointmentSlot}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fee Breakdown */}
                                    <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Fee Breakdown</h3>
                                        <div className="space-y-2 text-xs font-bold">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 uppercase">Certified True Copy Processing Fee</span>
                                                <span>₱{miscFeeAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 uppercase">Mandatory LCR Doc Stamp Fee</span>
                                                <span>₱{mandatoryFeeAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="h-px bg-slate-200 dark:bg-white/10 my-2" />
                                            <div className="flex justify-between text-sm font-black">
                                                <span className="uppercase">Total Amount Payable</span>
                                                <span style={{ color: themeColor }}>₱{apptTotalAmount.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Consent */}
                                    <div
                                        onClick={() => {
                                            if (policyAccepted) {
                                                setPolicyAccepted(false);
                                            } else {
                                                setPolicyOpen(true);
                                            }
                                        }}
                                        className={cn(
                                            "p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 select-none",
                                            policyAccepted
                                                ? "bg-emerald-50/20 border-emerald-500/30"
                                                : showErrors
                                                    ? "border-2 border-red-500"
                                                    : "border-slate-200/40 bg-white/30 dark:bg-white/5 hover:border-emerald-500/20"
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (policyAccepted) {
                                                    setPolicyAccepted(false);
                                                } else {
                                                    setPolicyOpen(true);
                                                }
                                            }}
                                            className={cn(
                                                "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0 mt-0.5",
                                                policyAccepted
                                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                                    : showErrors
                                                        ? "border-2 border-red-500"
                                                        : "border-slate-300"
                                            )}
                                        >
                                            {policyAccepted ? <Check className="w-3 h-3" /> : null}
                                        </button>
                                        <div className="flex-1 text-xs text-left cursor-pointer select-none" onClick={(e) => { e.stopPropagation(); setPolicyOpen(true); }}>
                                            <div className="font-black uppercase text-[11px] tracking-wider text-slate-900 dark:text-white">DATA PRIVACY AND TERMS AGREEMENT</div>
                                            <div className="text-[10px] text-slate-500 italic mt-1 line-clamp-2 md:line-clamp-none">I AUTHORIZE THE LGU TO PROCESS MY PERSONAL INFORMATION IN ACCORDANCE WITH THE DATA PRIVACY ACT. CLICK TO REVIEW AGREEMENT.</div>
                                            {(showErrors && !policyAccepted) && (
                                                <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest mt-1 animate-pulse">Agreement required before submitting</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPolicyOpen(true);
                                            }}
                                            className="text-[10px] font-black italic text-emerald-600 hover:text-emerald-700 shrink-0"
                                        >
                                            Review
                                        </button>
                                    </div>

                                    <div className="flex justify-between pt-4">
                                        <Button
                                            onClick={handleBack}
                                            variant="outline"
                                            className="h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest italic"
                                        >
                                            <ArrowLeft className="w-4 h-4 mr-2" />
                                            Go Back
                                        </Button>
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                            className="h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2"
                                            style={{ backgroundColor: themeColor }}
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    Submit Certified True Copy Request
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>
                </div>
            </div>
            <div className="pb-24" />
        </>
    );
}
