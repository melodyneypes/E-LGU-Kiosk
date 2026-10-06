"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from "react";
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
    Baby,
    CheckCircle2,
    FileText,
    ArrowLeft,
    Calendar,
    X
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackNextButton } from "../_components/back-next-button";
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
    getLatestForm1AForCurrentUser,
    getTransactionById,
    logDebugMessage,
    getRegistrarAppointmentConfig
} from "./action";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "INFORMANT" | "SUBJECT" | "SCHEDULE" | "REVIEW";

const STEPS: { id: Step; label: string; icon: any }[] = [
    { id: "INFORMANT", label: "Informant Info", icon: User },
    { id: "SUBJECT", label: "Subject & Documents", icon: FileText },
    { id: "SCHEDULE", label: "Choose Schedule", icon: Calendar },
    { id: "REVIEW", label: "Review & Submit", icon: CheckCircle2 },
];

export default function AppointmentBirthCertifiedTrueCopyPage() {
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
        // Subject fields
        subjectFullName: "",
        subjectDateOfBirth: "",
        mothersMaidenName: "",
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

        const savedStep = sessionStorage.getItem("appointment-birth-certified-true-copy-step");
        const savedForm = sessionStorage.getItem("appointment-birth-certified-true-copy-form");

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
            sessionStorage.setItem("appointment-birth-certified-true-copy-step", currentStep);
            sessionStorage.setItem("appointment-birth-certified-true-copy-form", JSON.stringify(formData));
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
                const [resResult, typesResult, configResult] = await Promise.all([
                    getCurrentUserResident(uId).catch(err => ({ success: false, data: null, error: err?.message || err })),
                    getTransactionTypes().catch(err => ({ success: false, data: [] as any, error: err?.message || err })),
                    getRegistrarAppointmentConfig().catch(err => ({ success: false, config: null, bookedSlots: [], error: err?.message || err }))
                ]);
                await logDebugMessage("Client: getCurrentUserResident() and getTransactionTypes() resolved");

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
                            const isSelf = rel === "SELF";
                            const sName = [r.firstName, r.middleName, r.lastName].filter(Boolean).join(" ") + (r.suffix ? " " + r.suffix : "");
                            const sDob = r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : "";
                            const mName = [r.motherFirstName, r.motherMiddleName, r.motherLastName].filter(Boolean).join(" ");

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
                                subjectFullName: addData.subjectFullName || (isSelf ? sName.toUpperCase() : ""),
                                subjectDateOfBirth: addData.subjectDateOfBirth || (isSelf ? sDob : ""),
                                mothersMaidenName: addData.mothersMaidenName || (isSelf ? mName.toUpperCase() : ""),
                                appointmentDate: addData.appointmentDate || (txData.appointmentDate ? new Date(txData.appointmentDate).toISOString().split('T')[0] : "") || "",
                                appointmentSlot: addData.appointmentSlot || txData.appointmentSlot || "",
                            };
                        });
                    } else {
                        setFormData(prev => {
                            const isSelf = prev.relationship === "SELF";
                            const sName = [r.firstName, r.middleName, r.lastName].filter(Boolean).join(" ") + (r.suffix ? " " + r.suffix : "");
                            const sDob = r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : "";
                            const mName = [r.motherFirstName, r.motherMiddleName, r.motherLastName].filter(Boolean).join(" ");

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
                                informantAddress: constructedAddr,
                                subjectFullName: isSelf ? sName.toUpperCase() : (prev.subjectFullName || ""),
                                subjectDateOfBirth: isSelf ? sDob : (prev.subjectDateOfBirth || ""),
                                mothersMaidenName: isSelf ? mName.toUpperCase() : (prev.mothersMaidenName || "")
                            };
                        });
                    }
                }

                if (typesResult.success && typesResult.data) {
                    const psaType = typesResult.data.find((t: any) => t.code === "LCR_BIRTH_CERTIFIED_TRUE_COPY_APPOINTMENT");
                    if (psaType) {
                        setTypeId(psaType.id);
                        setDbType(psaType);
                        await logDebugMessage(`Client: Found dbType ID: ${psaType.id}`);
                    } else {
                        await logDebugMessage("Client: LCR_BIRTH_CERTIFIED_TRUE_COPY_APPOINTMENT type NOT found in dbTypes list");
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
                if (value === "SELF" && resident) {
                    const sName = [resident.firstName, resident.middleName, resident.lastName].filter(Boolean).join(" ") + (resident.suffix ? " " + resident.suffix : "");
                    const sDob = resident.dateOfBirth ? new Date(resident.dateOfBirth).toISOString().split('T')[0] : "";
                    const mName = [resident.motherFirstName, resident.motherMiddleName, resident.motherLastName].filter(Boolean).join(" ");

                    next.subjectFullName = sName.toUpperCase();
                    next.subjectDateOfBirth = sDob;
                    next.mothersMaidenName = mName.toUpperCase();
                    next.relationshipOther = "";
                } else {
                    next.subjectFullName = "";
                    next.subjectDateOfBirth = "";
                    next.mothersMaidenName = "";
                }
            }
            return next;
        });

        if (name === "relationship" && value === "SELF") {
            const promise = (async () => {
                // Fetch fresh/full resident details from DB to ensure all fields are populated
                const resResult = await getCurrentUserResident(userId);
                let currentResident = resident;
                if (resResult.success && resResult.data) {
                    currentResident = resResult.data;
                    setResident(currentResident);

                    const sName = [currentResident.firstName, currentResident.middleName, currentResident.lastName].filter(Boolean).join(" ") + (currentResident.suffix ? " " + currentResident.suffix : "");
                    const sDob = currentResident.dateOfBirth ? new Date(currentResident.dateOfBirth).toISOString().split('T')[0] : "";
                    const mName = [currentResident.motherFirstName, currentResident.motherMiddleName, currentResident.motherLastName].filter(Boolean).join(" ");

                    setFormData(prev => ({
                        ...prev,
                        subjectFullName: sName.toUpperCase(),
                        subjectDateOfBirth: sDob,
                        mothersMaidenName: mName.toUpperCase()
                    }));
                }

                // Check Form 1A as well
                const res = await getLatestForm1AForCurrentUser(userId);
                if (res.success && res.data) {
                    const { subjectName, dateOfBirth, mothersMaidenName } = res.data;

                    setFormData(prev => ({
                        ...prev,
                        subjectFullName: subjectName ? subjectName.toUpperCase() : prev.subjectFullName,
                        subjectDateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString().split('T')[0] : prev.subjectDateOfBirth,
                        mothersMaidenName: mothersMaidenName ? mothersMaidenName.toUpperCase() : prev.mothersMaidenName
                    }));
                }
            })();
            toast.promise(promise, {
                loading: "Fetching resident profile & checking Form 1A status...",
                success: "Profile data and Form 1A status loaded.",
                error: "Failed to load profile or Form 1A status."
            });
        }
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

        setSubmitting(true);
        try {
            const data = new FormData();
            data.append("typeId", typeId);
            data.append("registryType", "BIRTH_CERTIFIED_TRUE_COPY_APPOINTMENT");
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

            const finalRelationship = (formData.relationship === "OTHER" || formData.relationship === "RELATIVE")
                ? `OTHER: ${formData.relationshipOther.toUpperCase()}`
                : formData.relationship;

            const additionalData = {
                ...formData,
                relationship: finalRelationship,
                subjectName: formData.subjectFullName,
                psaEndorsementFee: miscFeeAmount,
            };
            data.append("additionalData", JSON.stringify(additionalData));

            const res = await submitCivilRegistryTransaction(data, userId);

            if (res.success && res.data) {
                toast.success(revisionId ? "Revision resubmitted successfully!" : "Birth Certified True Copy Appointment submitted successfully!");
                sessionStorage.removeItem("appointment-birth-certified-true-copy-step");
                sessionStorage.removeItem("appointment-birth-certified-true-copy-form");
                router.push("/modules/civil-registry");
            } else {
                toast.error(res.error || "Failed to submit appointment request");
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
                .bg-emerald-600, [class*="bg-emerald-600"] {
                    background-color: ${themeColor} !important;
                }
                .border-emerald-500, [class*="border-emerald-500"] {
                    border-color: ${themeColor} !important;
                }
                .border-emerald-600, [class*="border-emerald-600"] {
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
                .hover\\:bg-emerald-600:hover, [class*="hover:bg-emerald-600"]:hover {
                    background-color: ${themeColor} !important;
                    filter: brightness(0.9);
                }
                .hover\\:border-emerald-500\\/50:hover, [class*="hover:border-emerald-500/50"]:hover {
                    border-color: ${themeColor === "var(--primary-theme)" ? "color-mix(in srgb, var(--primary-theme) 50%, transparent)" : `${themeColor}80`} !important;
                }
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
                `
            }} />
            <SecureIdleTimer />
            <PrivacyTermsModal
                isOpen={policyOpen}
                onClose={() => setPolicyOpen(false)}
                onAccept={handleAcceptPolicy}
                onDecline={() => { setPolicyAccepted(false); }}
                themeColor="var(--primary-theme)"
            />

            <div className="container max-w-5xl mx-auto px-4 pt-3 pb-0 space-y-5">
                <div className="sticky top-[64px] sm:top-[80px] z-40 md:static -mx-4 md:mx-0 px-4 md:px-0 pt-2 md:pt-0">
                    <Breadcrumb>
                        <BreadcrumbList className="flex-nowrap whitespace-nowrap overflow-x-auto scrollbar-none max-w-full bg-white/80 dark:bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-200/60 dark:border-white/5 w-full md:w-fit shadow-sm">
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link href="/dashboard" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors italic">
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
                                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: themeColor }}>Birth Certified True Copy Appointment</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="space-y-6">
                    {/* Premium Header/Banner */}
                    <div className="relative overflow-hidden bg-white dark:bg-[#0c1017] p-6 md:p-10 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white shadow-xl dark:shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                        <div
                            className="absolute top-0 right-0 w-96 h-96 blur-[120px] rounded-full opacity-10 dark:opacity-20 pointer-events-none -mr-40 -mt-40 transition-colors duration-700"
                            style={{ backgroundColor: themeColor }}
                        />

                        <div className="space-y-3 md:space-y-4 max-w-2xl relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center backdrop-blur-md">
                                    <Baby className="w-4 h-4 text-emerald-500" style={{ color: themeColor }} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-white/70 italic">Local Civil Registry</span>
                            </div>

                            <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">
                                Birth Certified True Copy <span style={{ color: themeColor }}>Appointment</span>
                            </h1>

                            <p className="text-slate-600 dark:text-slate-300 font-medium text-xs leading-relaxed max-w-xl italic">
                                Schedule an appointment and request a certified true copy of an existing birth certificate.
                            </p>
                        </div>

                        <div className="hidden md:block relative z-10 shrink-0">
                            <div className="w-28 h-28 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 shadow-sm dark:shadow-2xl relative overflow-hidden group hover:scale-105 transition-transform duration-500">
                                <div className="absolute inset-0 bg-gradient-to-tr opacity-0 group-hover:opacity-10 transition-opacity" style={{ backgroundImage: `linear-gradient(to top right, ${themeColor}, transparent)` }} />
                                <CheckCircle2 className="w-8 h-8 mb-1.5 opacity-80" style={{ color: themeColor }} />
                                <p className="text-[7px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-tight">Secure Filing</p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Stepper */}
                    <div className="relative px-2 py-4">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 dark:bg-white/5 -translate-y-1/2 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full"
                                style={{ backgroundColor: themeColor }}
                                initial={{ width: 0 }}
                                animate={{ width: `${(STEPS.findIndex(s => s.id === currentStep) / (STEPS.length - 1)) * 100}%` }}
                            />
                        </div>

                        <div className="flex justify-between items-center relative z-10">
                            {STEPS.map((step, idx) => {
                                const isActive = currentStep === step.id;
                                const stepIdx = STEPS.findIndex(s => s.id === currentStep);
                                const isCompleted = stepIdx > idx;
                                const Icon = step.icon;

                                return (
                                    <div
                                        key={idx}
                                        className="flex flex-col items-center gap-2 transition-all duration-300"
                                    >
                                        <div className={cn(
                                            "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-500 border-2 bg-white dark:bg-[#08090d]",
                                            isActive ? "shadow-lg scale-110" :
                                                isCompleted ? "text-white" :
                                                    "border-slate-200 dark:border-white/10 text-slate-400"
                                        )}
                                            style={
                                                isActive
                                                    ? { borderColor: themeColor, color: themeColor, boxShadow: `0 10px 15px -3px color-mix(in srgb, ${themeColor} 20%, transparent)` }
                                                    : isCompleted
                                                        ? { backgroundColor: themeColor, borderColor: themeColor }
                                                        : {}
                                            }
                                        >
                                            {isCompleted ? (
                                                <Check className="w-5 h-5" />
                                            ) : (
                                                <Icon className="w-4 h-4 md:w-5 md:h-5" />
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-[8px] md:text-[10px] font-black uppercase tracking-wider italic hidden md:block",
                                            (isActive || isCompleted) ? "opacity-100 font-black" : "text-slate-400 opacity-55"
                                        )}
                                            style={(isActive || isCompleted) ? { color: themeColor } : {}}
                                        >
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {mounted && typeof document !== "undefined" && createPortal(
                        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#06080a] border-t border-slate-200 dark:border-white/10 z-50 pt-2.5 pb-2.5 px-4 flex flex-col items-center">
                            <div className="w-full max-w-5xl flex items-center justify-center gap-4">
                                <div className="h-1.5 flex-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-emerald-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${((STEPS.findIndex(s => s.id === currentStep) + 1) / STEPS.length) * 100}%` }}
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

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Relationship to Subject <span className="text-red-500">*</span></Label>
                                            {(formData.relationship === "OTHER" || formData.relationship === "RELATIVE") ? (
                                                <div className="relative flex items-center">
                                                    <Input
                                                        value={formData.relationshipOther || ""}
                                                        onChange={(e) => setFormData(p => ({ ...p, relationshipOther: e.target.value }))}
                                                        className={cn("h-12 rounded-xl text-xs md:text-sm font-bold uppercase pr-10 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10", (showErrors && !formData.relationshipOther) && "!border-2 !border-red-500")}
                                                        placeholder="Specify relationship (e.g. Aunt, Cousin)"
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
                                                    <SelectTrigger className={cn("h-12 rounded-xl focus:ring-emerald-500 shadow-sm text-xs md:text-sm bg-white dark:bg-slate-900 transition-all font-bold", (showErrors && !formData.relationship) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10")}>
                                                        <SelectValue placeholder="SELECT RELATIONSHIP" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-slate-200 dark:border-white/10 italic">
                                                        <SelectItem value="SELF">SELF (I AM THE SUBJECT)</SelectItem>
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

                                        {/* Personal Details Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">First Name</Label>
                                                <Input readOnly value={formData.informantFirstName} placeholder="FIRST NAME" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Middle Name</Label>
                                                <Input readOnly value={formData.informantMiddleName} placeholder="MIDDLE NAME" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Last Name</Label>
                                                <Input readOnly value={formData.informantLastName} placeholder="LAST NAME" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                            <div className="md:col-span-1 space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Suffix</Label>
                                                <Input readOnly value={formData.informantSuffix} placeholder="NONE" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Birth Date</Label>
                                                <Input readOnly value={formData.informantBirthDate} type="date" placeholder="BIRTH DATE" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Age</Label>
                                                <Input readOnly value={formData.informantAge} placeholder="AGE" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Civil Status</Label>
                                                <Input readOnly value={formData.informantCivilStatus} placeholder="CIVIL STATUS" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Citizenship</Label>
                                                <Input readOnly value={formData.informantCitizenship} placeholder="CITIZENSHIP" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Occupation</Label>
                                                <Input readOnly value={formData.informantOccupation} placeholder="OCCUPATION" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Contact Number</Label>
                                                <Input readOnly value={formData.contactNumber} placeholder="CONTACT NUMBER" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Address</Label>
                                            <Input readOnly value={formData.informantAddress} placeholder="COMPLETE ADDRESS" className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 h-12 font-bold italic text-slate-600" />
                                        </div>
                                    </div>

                                    <BackNextButton
                                        onBack={() => router.push("/modules/civil-registry")}
                                        onNext={() => {
                                            if (!formData.relationship || ((formData.relationship === "OTHER" || formData.relationship === "RELATIVE") && !formData.relationshipOther)) {
                                                setShowErrors(true);
                                                toast.error("Please specify your relationship to the subject.");
                                                return;
                                            }
                                            setShowErrors(false);
                                            setCurrentStep("SUBJECT");
                                        }}
                                        themeColor={themeColor}
                                    />
                                </motion.div>
                            )}

                            {/* ===== STEP 2: SUBJECT & DOCUMENTS ===== */}
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
                                            Subject Information & Documents
                                        </h2>
                                        <p className="text-xs text-slate-500 font-medium italic">Provide the details of the person whose birth certificate certified true copy is being requested</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2 space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic ml-1">Subject&apos;s Full Name <span className="text-red-500">*</span></Label>
                                            <Input
                                                name="subjectFullName"
                                                placeholder="ENTER FULL NAME OF SUBJECT"
                                                value={formData.subjectFullName}
                                                onChange={handleInputChange}
                                                className={cn(
                                                    "rounded-xl bg-white dark:bg-slate-900 h-12 transition-all uppercase font-medium",
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
                                                type="date"
                                                name="subjectDateOfBirth"
                                                value={formData.subjectDateOfBirth}
                                                onChange={handleInputChange}
                                                className={cn(
                                                    "rounded-xl bg-white dark:bg-slate-900 h-12 transition-all font-medium",
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
                                                name="mothersMaidenName"
                                                placeholder="ENTER MOTHER'S MAIDEN NAME"
                                                value={formData.mothersMaidenName}
                                                onChange={handleInputChange}
                                                className={cn(
                                                    "rounded-xl bg-white dark:bg-slate-900 h-12 transition-all uppercase font-medium",
                                                    (showErrors && !formData.mothersMaidenName) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10"
                                                )}
                                            />
                                            {(showErrors && !formData.mothersMaidenName) && (
                                                <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest ml-1 animate-pulse">Required</p>
                                            )}
                                        </div>
                                    </div>

                                    <BackNextButton
                                        onBack={() => setCurrentStep("INFORMANT")}
                                        onNext={() => {
                                            if (!formData.subjectFullName || !formData.subjectDateOfBirth || !formData.mothersMaidenName) {
                                                setShowErrors(true);
                                                toast.error("Please fill in all subject details.");
                                                return;
                                            }
                                            setShowErrors(false);
                                            setCurrentStep("SCHEDULE");
                                        }}
                                        themeColor={themeColor}
                                    />
                                </motion.div>
                            )}

                            {/* ===== STEP 3: CHOOSE SCHEDULE ===== */}
                            {currentStep === "SCHEDULE" && (
                                <motion.div
                                    key="schedule-step"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    className="space-y-8"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Choose Schedule</h2>
                                            <p className="text-xs text-slate-500 font-medium italic">Select an appointment date and session</p>
                                        </div>
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

                                    <BackNextButton
                                        onBack={() => {
                                            setShowErrors(false);
                                            setCurrentStep("SUBJECT");
                                        }}
                                        onNext={() => {
                                            if (!formData.appointmentDate || !formData.appointmentSlot) {
                                                setShowErrors(true);
                                                toast.error("Please select an appointment date and session.");
                                                return;
                                            }
                                            setShowErrors(false);
                                            setCurrentStep("REVIEW");
                                        }}
                                        themeColor={themeColor}
                                    />
                                </motion.div>
                            )}

                            {/* ===== STEP 4: REVIEW & SUBMIT ===== */}
                            {currentStep === "REVIEW" && (
                                <motion.div
                                    key="review-step"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    className="space-y-8"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div>
                                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Certified True Copy Review</h2>
                                            <p className="text-xs text-slate-500 font-medium italic">Verify information before submission</p>
                                        </div>
                                    </div>

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
                                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 italic">Subject Name (Certified True Copy)</span>
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
                                            <div className="col-span-2 border-t border-slate-200 dark:border-white/5 pt-4 grid grid-cols-2 gap-6">
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Appointment Date</span>
                                                    <p className="font-black text-slate-900 dark:text-white italic">
                                                        {formData.appointmentDate ? new Date(formData.appointmentDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not selected"}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Appointment Slot</span>
                                                    <p className="font-black text-slate-900 dark:text-white italic uppercase">
                                                        {formData.appointmentSlot || "Not selected"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fee Display */}
                                        <div className="space-y-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                                                <span>Misc Fee</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">₱{miscFeeAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                                                <span>Mandatory Fee</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">₱{mandatoryFeeAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="border-t border-emerald-200/40 dark:border-emerald-500/20 pt-2 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Total Certified True Copy Appointment Fee</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-lg font-black text-emerald-600 tracking-tight">₱{apptTotalAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <div className="space-y-4">
                                        {/* Data Privacy Agreement panel */}
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

                                        <div className="flex justify-end items-center gap-6 pt-6 select-none">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStep("SCHEDULE")}
                                                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors duration-200 uppercase font-black tracking-widest italic text-[11px] disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-0 outline-none cursor-pointer group"
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                                                BACK
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSubmit}
                                                disabled={submitting}
                                                style={
                                                    themeColor
                                                        ? {
                                                            backgroundColor: themeColor,
                                                            boxShadow: themeColor.startsWith("var")
                                                                ? `0 0 20px color-mix(in srgb, ${themeColor} 30%, transparent)`
                                                                : `0 0 20px ${themeColor}4d`
                                                        }
                                                        : {}
                                                }
                                                className="rounded-full px-6 py-3 font-black uppercase tracking-widest italic text-[11px] flex items-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 bg-[#e11d48] text-white hover:brightness-110 shadow-[0_0_20px_rgba(225,29,72,0.3)] group"
                                            >
                                                {submitting ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <>
                                                        SUBMIT
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>
                </div>
            </div>
        </>
    );
}
