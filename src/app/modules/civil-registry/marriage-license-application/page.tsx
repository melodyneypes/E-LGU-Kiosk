/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from "react";
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
    Home,
    Heart,
    Search
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
import { Checkbox } from "@/components/ui/checkbox";
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
    ensureCivilRegistryTransactionTypes,
    submitCivilRegistryTransaction,
    getTransactionTypes,
    getTransactionById,
    getSecureUploadUrlAction,
    searchResidentsAction,
    getResidentDataByIdAction,
    getExistingMarriageLicenses
} from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { saveDraftFile, getDraftFiles, clearDraftFiles } from "@/lib/draftDb";
import RequestList from "../_components/request-list";
import ReviewAndSubmit from "../_components/review-and-submit";
import ReadOnlyDocumentPreview from "../_components/read-only-document-preview";
import PremiumDocumentUpload from "@/components/shared/PremiumDocumentUpload";

const REQUIRED_DOCS = [
    "Municipal Form No. 90",
    "Community Tax Certificate",
    "Parental Consent of the father/mother",
    "Certificate of Family Planning",
    "Certificate of Pre-Marriage Counseling",
    "Birth Certificate of Applicant 1",
    "Birth Certificate of Applicant 2",
    "Government ID of Applicant 1",
    "Government ID of Applicant 2",
    "Seminar Attendance Proof",
    "Legal Capacity (if one party is a foreigner)"
];

const STORAGE_KEY = "lcr_marriage_license_draft";
const MISC_FEE = 862; // base fee for marriage license

const calculateAge = (birthDateString: string): number => {
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

const formatDocLabel = (docName: string, app1Gender: string) => {
    const isApp1Male = app1Gender === "MALE";
    if (docName.includes("Applicant 1")) {
        return docName.replace("Applicant 1", isApp1Male ? "Groom" : "Bride / Wife");
    }
    if (docName.includes("Applicant 2")) {
        return docName.replace("Applicant 2", isApp1Male ? "Bride / Wife" : "Groom");
    }
    return docName;
};



function getMimeType(ext: string) {
    const e = ext.toLowerCase();
    if (e === "pdf") return "application/pdf";
    if (e === "png") return "image/png";
    if (e === "jpg" || e === "jpeg") return "image/jpeg";
    if (e === "webp") return "image/webp";
    if (e === "gif") return "image/gif";
    return `application/${ext}`;
}

// --- Resident Search component for applicant 2 ---
const ResidentSearch = ({ onSelect, placeholder = "Search resident..." }: { onSelect: (r: any) => void; placeholder?: string }) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        if (timer) clearTimeout(timer);

        if (val.trim().length > 2) {
            const newTimer = setTimeout(async () => {
                const res = await searchResidentsAction(val);
                if (res.success && res.data) setResults(res.data as any[]);
                else setResults([]);
            }, 300);
            setTimer(newTimer);
        } else {
            setResults([]);
        }
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    className="pl-12 h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold"
                />
            </div>
            {results.length > 0 && (
                <div className="absolute z-[110] w-full mt-2 bg-white dark:bg-[#151b2b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2 space-y-1">
                    {results.map(r => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => { onSelect(r); setQuery(""); setResults([]); }}
                            className="w-full text-left px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl flex items-center gap-3 transition-colors text-slate-900 dark:text-white"
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase italic text-slate-900 dark:text-white">{r.firstName} {r.lastName}</p>
                                <p className="text-[10px] text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">{r.barangay}</p>
							</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

type Step = "EXISTING" | "IDENTITY" | "UPLOAD" | "REVIEW" | "SUBMIT";

const STEPS: { id: "IDENTITY" | "UPLOAD" | "REVIEW"; label: string; icon: any }[] = [
    { id: "IDENTITY", label: "Identity", icon: User },
    { id: "UPLOAD", label: "Upload Documents", icon: Upload },
    { id: "REVIEW", label: "Review & Submit", icon: CheckCircle2 },
];

export default function MarriageLicenseApplicationPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string>("");
    const [currentStep, setCurrentStep] = useState<Step>("EXISTING");
    const [existingRequests, setExistingRequests] = useState<any[]>([]);
    const [selectedApplication, setSelectedApplication] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [resident, setResident] = useState<any>(null);
    const [typeId, setTypeId] = useState<string>("");
    const [dbMiscFee, setDbMiscFee] = useState<number>(MISC_FEE);
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [revisionTx, setRevisionTx] = useState<any>(null);
    const [showErrors, setShowErrors] = useState(false);



    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerFile, setViewerFile] = useState<File | null>(null);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState("");

    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [previews, setPreviews] = useState<Record<string, string | null>>({});

    const handleOpenViewer = (file: File | null, title: string, url: string | null = null) => {
        setViewerFile(file);
        setViewerUrl(url);
        setViewerTitle(title);
        setViewerOpen(true);
    };

    // QR Upload Handoff State
    const [handoffToken, setHandoffToken] = useState("");
    const [handoffQrCode, setHandoffQrCode] = useState("");
    const [handoffSessionSlot, setHandoffSessionSlot] = useState("");
    const [handoffExpiresAt, setHandoffExpiresAt] = useState(0);
    const [isHandoffOpen, setIsHandoffOpen] = useState(false);
    const [isCreatingHandoff, setIsCreatingHandoff] = useState(false);

    // Form State
    const [form, setForm] = useState<any>({
        app1FullName: "",
        app1BirthDate: "",
        app1BirthPlace: "",
        app1Citizenship: "FILIPINO",
        app1Gender: "",
        app2IsResident: false,
        app2IsForeigner: null as boolean | null,
        app2FullName: "",
        app2BirthDate: "",
        app2BirthPlace: "",
        app2Citizenship: "FILIPINO",
        app2Gender: "",
        app2Address: "",
        informantAddress: "",
        app2Resident: null as any
    });

    // Privacy / Terms modal state
    const [policyOpen, setPolicyOpen] = useState(false);
    const [policyAccepted, setPolicyAccepted] = useState(false);

    const handleAcceptPolicy = () => { setPolicyOpen(false); setPolicyAccepted(true); };

    // --- UPLOAD FILE SECURELY VIA SIGNED UPLOAD URL ---
    async function uploadFileClientSide(file: File, fieldName: string, uId: string): Promise<string> {
        const fileExt = file.name.split('.').pop() || 'bin';
        const res = await getSecureUploadUrlAction(fieldName, "lcr/marriage_license", fileExt, uId);
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
        const docName = REQUIRED_DOCS.find(d => d.replace(/[^a-zA-Z0-9_-]/g, '_') === handoffSessionSlot.replace("lcr_", ""));
        return docName ? formatDocLabel(docName, form.app1Gender) : "Required Document";
    };

    // Restore progress from session storage & IndexedDB
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("revisionId")) return;

        const savedStep = sessionStorage.getItem("marriage-license-step");
        const savedForm = sessionStorage.getItem("marriage-license-form");
        const savedPreviews = sessionStorage.getItem("marriage-license-previews");

        if (savedStep) {
            if (savedStep === "SUBMIT") {
                setCurrentStep("EXISTING");
            } else {
                setCurrentStep(savedStep as Step);
            }
        }
        if (savedForm) {
            try {
                const parsed = JSON.parse(savedForm);
                setForm((prev: any) => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse saved form", e);
            }
        }
        if (savedPreviews) {
            try {
                const parsed = JSON.parse(savedPreviews);
                setPreviews(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse saved previews", e);
            }
        }

        // Hydrate files from IndexedDB
        async function hydrateFiles() {
            try {
                const draftFiles = await getDraftFiles(STORAGE_KEY);
                if (draftFiles && Object.keys(draftFiles).length > 0) {
                    setFiles(prev => ({ ...prev, ...draftFiles }));

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
            sessionStorage.setItem("marriage-license-step", currentStep);
            sessionStorage.setItem("marriage-license-form", JSON.stringify(form));

            const remotePreviews: Record<string, string> = {};
            Object.entries(previews).forEach(([key, val]) => {
                if (val && val.startsWith("http")) {
                    remotePreviews[key] = val;
                }
            });
            sessionStorage.setItem("marriage-license-previews", JSON.stringify(remotePreviews));
        }
    }, [currentStep, form, previews, loading, revisionId]);

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
                    getExistingMarriageLicenses(uId)
                ]);

                if (resResult.success && resResult.data) {
                    const r = resResult.data;
                    setResident(r);

                    if (r.civilStatus && r.civilStatus.toUpperCase() === "MARRIED") {
                        toast.error("Your civil status is registered as Married. You cannot apply for a marriage license.", {
                            duration: 10000,
                            id: "civil-status-check"
                        });
                        router.push("/modules/civil-registry");
                        return;
                    }

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

                        const loadedPreviews: Record<string, string | null> = {};
                        REQUIRED_DOCS.forEach(d => {
                            const key = d.replace(/[^a-zA-Z0-9_-]/g, '_');
                            if (addData[key] && typeof addData[key] === "string" && addData[key].startsWith("http")) {
                                loadedPreviews[key] = addData[key];
                            }
                        });

                        setForm((prev: any) => ({
                            ...prev,
                            app1FullName: (addData.applicant1?.fullName || `${resSnapshot.firstName} ${resSnapshot.lastName}`).toUpperCase(),
                            app1BirthDate: addData.applicant1?.birthDate || (resSnapshot.dateOfBirth ? new Date(resSnapshot.dateOfBirth).toISOString().split('T')[0] : ""),
                            app1BirthPlace: (addData.applicant1?.birthPlace || resSnapshot.placeOfBirth || "").toUpperCase(),
                            app1Citizenship: (addData.applicant1?.citizenship || resSnapshot.citizenship || "FILIPINO").toUpperCase(),
                            app1Gender: (addData.applicant1?.gender || resSnapshot.gender || "").toUpperCase(),
                            app2IsResident: !!addData.app2IsResident,
                            app2IsForeigner: typeof addData.app2IsForeigner !== 'undefined' ? addData.app2IsForeigner : null,
                            app2FullName: (addData.applicant2?.fullName || "").toUpperCase(),
                            app2BirthDate: addData.applicant2?.birthDate || "",
                            app2BirthPlace: (addData.applicant2?.birthPlace || "").toUpperCase(),
                            app2Citizenship: (addData.applicant2?.citizenship || "FILIPINO").toUpperCase(),
                            app2Gender: (addData.applicant2?.gender || "").toUpperCase(),
                            app2Address: (addData.applicant2?.address || "").toUpperCase(),
                            app2Resident: addData.app2Resident || null,
                            informantAddress: (addData.informantAddress || constructedAddr).toUpperCase()
                        }));
                        setPreviews(loadedPreviews);
                    } else {
                        // Pre-populate active resident as Applicant 1
                        const app1Gender = (r.gender || "").toUpperCase();
                        const app2Gender = app1Gender === "MALE" ? "FEMALE" : app1Gender === "FEMALE" ? "MALE" : "";

                        setForm((prev: any) => ({
                            ...prev,
                            app1FullName: `${r.firstName} ${r.middleName ? r.middleName[0] + '. ' : ''}${r.lastName}`.toUpperCase(),
                            app1BirthDate: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : "",
                            app1BirthPlace: (r.placeOfBirth || r.municipality || "").toUpperCase(),
                            app1Citizenship: (r.citizenship || "FILIPINO").toUpperCase(),
                            app1Gender,
                            app2Gender,
                            informantAddress: constructedAddr
                        }));
                    }
                }

                if (typesResult.success && typesResult.data) {
                    const mlType = typesResult.data.find((t: any) => t.code === "LCR_MARRIAGE_LICENSE");
                    if (mlType) {
                        setTypeId(mlType.id);
                        setDbMiscFee(Number(mlType.baseFee));
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
                    const savedStep = sessionStorage.getItem("marriage-license-step");
                    if (savedStep && savedStep !== "SUBMIT") {
                        setCurrentStep(savedStep as Step);
                    } else {
                        setCurrentStep("EXISTING");
                    }
                } else {
                    const savedStep = sessionStorage.getItem("marriage-license-step");
                    if (savedStep && savedStep !== "SUBMIT") {
                        setCurrentStep(savedStep as Step);
                    } else {
                        setCurrentStep("IDENTITY");
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
        setForm((prev: any) => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleApp2Select = async (res: any) => {
        const result = await getResidentDataByIdAction(res.id);
        if (result.success && result.data) {
            const r = result.data;
            const app2Gender = (r.gender || "").toUpperCase();
            if (form.app1Gender && app2Gender && form.app1Gender === app2Gender) {
                toast.error("Same-sex marriage is not permitted. Both applicants must be of opposite sex.");
                return;
            }
            if (r.civilStatus && r.civilStatus.toUpperCase() === "MARRIED") {
                toast.error("The selected resident's civil status is Married. They cannot apply for a marriage license.", {
                    duration: 10000
                });
                return;
            }

            const targetApp1Gender = form.app1Gender || (app2Gender === "MALE" ? "FEMALE" : app2Gender === "FEMALE" ? "MALE" : "");
            const targetApp2Gender = app2Gender || (targetApp1Gender === "MALE" ? "FEMALE" : targetApp1Gender === "FEMALE" ? "MALE" : "");

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

            setForm((prev: any) => ({
                ...prev,
                app2FullName: `${r.firstName} ${r.middleName ? r.middleName[0] + '. ' : ''}${r.lastName}`.toUpperCase(),
                app2BirthDate: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : "",
                app2BirthPlace: (r.placeOfBirth || r.municipality || "").toUpperCase(),
                app2Citizenship: (r.citizenship || "FILIPINO").toUpperCase(),
                app2Gender: targetApp2Gender,
                app1Gender: targetApp1Gender,
                app2Address: constructedAddr,
                app2Resident: r
            }));
            toast.success(`Fetched details for ${r.firstName} ${r.lastName}`);
        }
    };

    const handleClearApp2Resident = () => {
        setForm((prev: any) => {
            const app1Gender = (prev.app1Gender || "").toUpperCase();
            const app2Gender = app1Gender === "MALE" ? "FEMALE" : app1Gender === "FEMALE" ? "MALE" : "";
            return {
                ...prev,
                app2FullName: "",
                app2BirthDate: "",
                app2BirthPlace: "",
                app2Citizenship: "FILIPINO",
                app2Gender,
                app2Resident: null
            };
        });
        toast.info("Cleared selected resident details.");
    };

    const setApp2Foreigner = (val: boolean) => {
        setForm((p: any) => {
            if (val) return { ...p, app2IsForeigner: true, app2Citizenship: "" };
            
            // Clear capacity file/preview if changing back to non-foreigner
            const capKey = "Legal Capacity (if one party is a foreigner)".replace(/[^a-zA-Z0-9_-]/g, '_');
            setFiles(prev => {
                const copy = { ...prev };
                delete copy[capKey];
                return copy;
            });
            setPreviews(prev => {
                const copy = { ...prev };
                delete copy[capKey];
                return copy;
            });
            saveDraftFile(STORAGE_KEY, capKey, null).catch(() => {});

            return { ...p, app2IsForeigner: false, app2Citizenship: "FILIPINO" };
        });
    };

    const docsToShow = REQUIRED_DOCS.filter(d => {
        if (d.toLowerCase().includes("legal capacity")) {
            return !!form.app2IsForeigner;
        }
        return true;
    });

    const isApp1Male = form.app1Gender === "MALE";
    const groomDocKeys = isApp1Male
        ? ["Birth Certificate of Applicant 1", "Government ID of Applicant 1"]
        : ["Birth Certificate of Applicant 2", "Government ID of Applicant 2"];

    const brideDocKeys = isApp1Male
        ? ["Birth Certificate of Applicant 2", "Government ID of Applicant 2"]
        : ["Birth Certificate of Applicant 1", "Government ID of Applicant 1"];

    const sharedDocKeys = docsToShow.filter(d =>
        !groomDocKeys.includes(d) && !brideDocKeys.includes(d)
    );

    const groomName = (isApp1Male ? form.app1FullName : form.app2FullName) || "";
    const brideName = (isApp1Male ? form.app2FullName : form.app1FullName) || "";

    const getDocItem = (docName: string) => {
        const sanitizedKey = docName.replace(/[^a-zA-Z0-9_-]/g, '_');
        return {
            id: sanitizedKey,
            label: formatDocLabel(docName, form.app1Gender),
            file: files[sanitizedKey] || null,
            previewUrl: previews[sanitizedKey] || null,
            infoText: `PDF / IMAGE (MAX 5MB)`,
            error: showErrors && !files[sanitizedKey] && !previews[sanitizedKey],
            onFileSelect: async (newFile: File) => {
                saveDraftFile(STORAGE_KEY, sanitizedKey, newFile).catch(err => console.error("Failed to save draft file in IndexedDB:", err));
                try {
                    toast.loading("Uploading document...", { id: `file-upload-${sanitizedKey}` });
                    const publicUrl = await uploadFileClientSide(newFile, sanitizedKey, userId);
                    setFiles(prev => ({ ...prev, [sanitizedKey]: newFile }));
                    setPreviews(prev => ({ ...prev, [sanitizedKey]: publicUrl }));
                    toast.success("Document uploaded!", { id: `file-upload-${sanitizedKey}` });
                } catch {
                    toast.error("Upload failed. Local copy stored.", { id: `file-upload-${sanitizedKey}` });
                    setFiles(prev => ({ ...prev, [sanitizedKey]: newFile }));
                    setPreviews(prev => ({ ...prev, [sanitizedKey]: newFile.type.startsWith("image/") ? URL.createObjectURL(newFile) : null }));
                }
            },
            onClickUpload: () => startHandoff(sanitizedKey),
            onClear: async () => {
                setFiles(prev => ({ ...prev, [sanitizedKey]: null }));
                setPreviews(prev => ({ ...prev, [sanitizedKey]: null }));
                await saveDraftFile(STORAGE_KEY, sanitizedKey, null);
                toast.success("Document removed.");
            },
            onView: () => handleOpenViewer(files[sanitizedKey], formatDocLabel(docName, form.app1Gender), previews[sanitizedKey]),
        };
    };

    const validateStep = (step: Step): boolean => {
        if (step === "IDENTITY") {
            if (form.app1BirthDate && calculateAge(form.app1BirthDate) < 18) {
                toast.error("Applicant 1 must be 18 years of age or older. We cannot issue a marriage license to a minor.");
                return false;
            }
            if (form.app2BirthDate && calculateAge(form.app2BirthDate) < 18) {
                toast.error("Applicant 2 must be 18 years of age or older. We cannot issue a marriage license to a minor.");
                return false;
            }
        }

        const errs: Record<string, string> = {};
        if (step === "IDENTITY") {
            if (!form.app1FullName) errs.app1FullName = "Required";
            if (!form.app1BirthDate) errs.app1BirthDate = "Required";
            if (!form.app1BirthPlace) errs.app1BirthPlace = "Required";
            if (!form.app1Citizenship) errs.app1Citizenship = "Required";
            if (!form.app1Gender) errs.app1Gender = "Required";

            if (form.app2IsForeigner === null) errs.app2IsForeigner = "Required";
            if (!form.app2FullName?.trim()) errs.app2FullName = "Required";
            if (!form.app2BirthDate) errs.app2BirthDate = "Required";
            if (!form.app2BirthPlace?.trim()) errs.app2BirthPlace = "Required";
            if (!form.app2Citizenship?.trim()) errs.app2Citizenship = "Required";
            if (!form.app2Gender) errs.app2Gender = "Required";
            if (!form.app2Address?.trim()) errs.app2Address = "Required";
        } else if (step === "UPLOAD") {
            docsToShow.forEach(d => {
                const key = d.replace(/[^a-zA-Z0-9_-]/g, '_');
                if (!files[key] && !previews[key]) {
                    errs[key] = "Required";
                }
            });
        }

        const valid = Object.keys(errs).length === 0;
        setShowErrors(!valid);

        if (!valid) {
            if (step === "IDENTITY") {
                toast.error("Please fill in all required applicant details.");
            } else if (step === "UPLOAD") {
                toast.error("Please upload all required documents before proceeding.");
            }

            setTimeout(() => {
                const firstErrorKey = Object.keys(errs)[0];
                if (firstErrorKey) {
                    const element: any = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
                    if (element) {
                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                        element.focus();
                    }
                }
            }, 100);
        } else {
            if (step === "IDENTITY") {
                if (resident?.civilStatus && resident.civilStatus.toUpperCase() === "MARRIED") {
                    toast.error("Your civil status is registered as Married. You cannot apply for a marriage license.");
                    return false;
                }
                if (form.app2Resident?.civilStatus && form.app2Resident.civilStatus.toUpperCase() === "MARRIED") {
                    toast.error("Applicant 2 is registered as Married. You cannot apply for a marriage license.");
                    return false;
                }
                if (form.app1Gender === form.app2Gender) {
                    toast.error("Same-sex marriage is not permitted. Genders must be Groom (Male) and Bride / Wife (Female).");
                    return false;
                }
            }
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

        if (!validateStep("IDENTITY") || !validateStep("UPLOAD")) {
            return;
        }

        setSubmitting(true);
        try {
            const data = new FormData();
            data.append("typeId", typeId);
            data.append("registryType", "MARRIAGE_LICENSE");
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
                address: form.informantAddress
            };
            data.append("residentSnapshot", JSON.stringify(residentSnapshot));

            const fileUrls: Record<string, string> = {};

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

                if (fileUrls[sanitizedKey]) {
                    continue;
                }

                try {
                    toast.loading(`Uploading document ${i + 1}/${fileEntries.length}...`, { id: "upload-toast" });
                    const url = await uploadFileClientSide(file, sanitizedKey, userId);
                    fileUrls[sanitizedKey] = url;
                } catch (uploadErr) {
                    console.error(`[ClientUpload] Failed to upload ${key}:`, uploadErr);
                    toast.error(`Failed to upload document: ${key}. Please try again.`, { id: "upload-toast" });
                    setSubmitting(false);
                    return;
                }
            }
            toast.dismiss("upload-toast");

            const finalRequiredDocs = docsToShow.map(d => d.replace(/[^a-zA-Z0-9_-]/g, '_'));

            const additionalData = {
                applicant1: {
                    fullName: form.app1FullName,
                    birthDate: form.app1BirthDate,
                    birthPlace: form.app1BirthPlace,
                    citizenship: form.app1Citizenship,
                    gender: form.app1Gender
                },
                applicant2: {
                    fullName: form.app2FullName,
                    birthDate: form.app2BirthDate,
                    birthPlace: form.app2BirthPlace,
                    citizenship: form.app2Citizenship,
                    gender: form.app2Gender,
                    address: form.app2Address
                },
                app2IsResident: form.app2IsResident,
                app2IsForeigner: form.app2IsForeigner,
                app2Resident: form.app2Resident,
                requiredDocs: finalRequiredDocs,
                subjectName: `${form.app1FullName} & ${form.app2FullName}`,
                informantAddress: form.informantAddress,
                payments: [
                    { label: "Misc Fee", amount: dbMiscFee }
                ],
                totalAmount: dbMiscFee,
                ...fileUrls
            };
            data.append("additionalData", JSON.stringify(additionalData));

            const res = await submitCivilRegistryTransaction(data, userId);

            if (res.success && res.data) {
                toast.success(revisionId ? "Revision resubmitted successfully!" : "Marriage License Application submitted successfully!");
                sessionStorage.removeItem("marriage-license-step");
                sessionStorage.removeItem("marriage-license-form");
                await clearDraftFiles(STORAGE_KEY);

                const updated = await getExistingMarriageLicenses(userId);
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
                toast.error(res.error || "Failed to submit application");
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

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: "var(--primary-theme)" }} />
                <p className="font-black uppercase tracking-widest text-[10px] text-slate-700 dark:text-slate-400 italic">Initializing Application Form...</p>
            </div>
        );
    }

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
                                <Link href="/dashboard" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                    <Home className="h-3.5 w-3.5" /> Dashboard
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/modules/civil-registry" className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                    Civil Registry
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage className="text-xs font-black uppercase tracking-widest text-theme-primary">
                                Marriage License Application
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
                            MARRIAGE <span className="text-theme-primary underline decoration-[6px] md:decoration-8 decoration-theme-primary/20 underline-offset-[6px] md:underline-offset-[12px]">LICENSE APPLICATION</span>
                        </h1>
                        <p className="text-[9px] md:text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-[0.4em] ml-1 md:ml-2 italic">LCR Civil Registry Request Portal</p>
                    </div>
                    {currentStep === "EXISTING" ? (
                        <Button
                            onClick={() => {
                                setSelectedApplication(null);
                                setPolicyAccepted(false);
                                setCurrentStep("IDENTITY");
                            }}
                            className="bg-theme-primary hover:bg-theme-hover text-white font-bold uppercase tracking-wider rounded-2xl py-6 px-8 shadow-lg shadow-theme-primary/20 active:scale-95 transition-all text-xs"
                        >
                            New Application
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
                    <div className="grid grid-cols-3 gap-1 md:gap-4 relative px-1 md:px-2">
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
                                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                    Existing <span className="text-theme-primary">Applications</span>
                                </h2>
                                <p className="text-slate-700 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                    We found previous Marriage License Applications under your profile.
                                </p>
                            </div>

                            <RequestList
                                requests={existingRequests}
                                onItemClick={(app) => {
                                    setSelectedApplication(app);
                                    setCurrentStep("SUBMIT");
                                }}
                                emptyMessage="No records found"
                                emptySubMessage="Submit your first marriage license application by clicking New Application."
                                getSubjectName={(app) => {
                                    const addData = app.additionalData as any || {};
                                    return addData.subjectName || "Marriage License Application";
                                }}
                            />

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
                                        <CheckCircle2 className="w-10 h-10 text-theme-primary" />
                                    </div>
                                    <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white">
                                        Application <span className="text-theme-primary">Summary</span>
                                    </h2>
                                    <p className="text-slate-700 dark:text-slate-400 font-medium italic text-xs md:text-lg uppercase tracking-widest max-w-2xl mx-auto mt-2">
                                        Review details and current status of your marriage license request.
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
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Transaction ID</span>
                                                <span className="text-xs font-black text-slate-900 dark:text-white">{selectedApplication.id}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Groom / Husband</span>
                                                <span className="uppercase font-black text-slate-900 dark:text-white">
                                                    {form.app1Gender === "MALE" ? addData.applicant1?.fullName : addData.applicant2?.fullName}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Bride / Wife</span>
                                                <span className="uppercase font-black text-slate-900 dark:text-white">
                                                    {form.app1Gender === "FEMALE" ? addData.applicant1?.fullName : addData.applicant2?.fullName}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Application Date</span>
                                                <span className="font-black text-slate-900 dark:text-white">
                                                    {new Date(selectedApplication.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Address of Groom</span>
                                                <span className="uppercase font-bold text-slate-900 dark:text-white">
                                                    {form.app1Gender === "MALE" ? addData.informantAddress : addData.applicant2?.address}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Address of Bride</span>
                                                <span className="uppercase font-bold text-slate-900 dark:text-white">
                                                    {form.app1Gender === "FEMALE" ? addData.informantAddress : addData.applicant2?.address}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                                        <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                                            <span className="text-slate-600 dark:text-slate-400">Total Application Fee</span>
                                            <span className="text-theme-primary text-sm font-black">₱{(selectedApplication.totalAmount || dbMiscFee).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {selectedApplication.isCancelled ? (
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
                                            <span>Your Marriage License Application has been received. Our Civil Registry officers will verify the uploaded requirements and process your license. Standard verification takes 10-12 days.</span>
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
                                        className="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2 animate-none"
                                    >
                                        <Printer size={16} /> Print Details
                                    </Button>
                                    {selectedApplication.status === "FOR_REVISION" && !selectedApplication.isCancelled && (
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                window.location.href = `/modules/civil-registry/marriage-license-application?revisionId=${selectedApplication.id}`;
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

                    {/* ===== STEP 1: IDENTITY ===== */}
                    {currentStep === "IDENTITY" && (
                        <motion.div
                            key="identity-step"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="space-y-8"
                        >
                            <div className="space-y-2">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Applicants Information</h2>
                                <p className="text-xs text-slate-700 dark:text-slate-400 font-medium italic">Configure the details for both applying parties</p>
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

                            {/* Applicant 1 Details (Read-only Informant) */}
                            <Card className="bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-wider italic text-theme-primary">
                                    Applicant 1 ({form.app1Gender === "MALE" ? "Groom" : "Bride / Wife"})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Full Name</Label>
                                        <Input disabled value={form.app1FullName} className="bg-slate-100 dark:bg-white/5 font-bold uppercase cursor-not-allowed opacity-75 border-none text-slate-950 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Date of Birth</Label>
                                        <Input disabled type="date" value={form.app1BirthDate} className="bg-slate-100 dark:bg-white/5 font-bold cursor-not-allowed opacity-75 border-none text-slate-950 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Place of Birth</Label>
                                        <Input disabled value={form.app1BirthPlace} className="bg-slate-100 dark:bg-white/5 font-bold uppercase cursor-not-allowed opacity-75 border-none text-slate-950 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Citizenship</Label>
                                        <Input disabled value={form.app1Citizenship} className="bg-slate-100 dark:bg-white/5 font-bold uppercase cursor-not-allowed opacity-75 border-none text-slate-950 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Sex</Label>
                                        <Select
                                            disabled={!!resident?.gender}
                                            value={form.app1Gender}
                                            onValueChange={(val) => {
                                                setForm((prev: any) => ({
                                                    ...prev,
                                                    app1Gender: val,
                                                    app2Gender: val === "MALE" ? "FEMALE" : val === "FEMALE" ? "MALE" : ""
                                                }));
                                            }}
                                        >
                                            <SelectTrigger className="w-full h-10 px-3 bg-slate-100 dark:bg-white/5 border-none font-bold uppercase text-xs rounded-md disabled:cursor-not-allowed opacity-75 text-left text-slate-950 dark:text-white">
                                                <SelectValue placeholder="SELECT GENDER" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MALE">Groom (Male)</SelectItem>
                                                <SelectItem value="FEMALE">Bride / Wife (Female)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Address</Label>
                                        <Input disabled value={form.informantAddress || ""} className="bg-slate-100 dark:bg-white/5 font-bold uppercase cursor-not-allowed opacity-75 border-none text-slate-950 dark:text-white" />
                                    </div>
                                </div>
                            </Card>

                            {/* Applicant 2 Details */}
                            <Card className="bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider italic text-theme-primary">
                                        Applicant 2 ({form.app2Gender === "MALE" ? "Groom" : "Bride / Wife"})
                                    </h3>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="app2Resident"
                                            checked={form.app2IsResident}
                                            onCheckedChange={(checked) => {
                                                setForm((prev: any) => {
                                                    const newGender = prev.app1Gender === "MALE" ? "FEMALE" : prev.app1Gender === "FEMALE" ? "MALE" : "";
                                                    return {
                                                        ...prev,
                                                        app2IsResident: !!checked,
                                                        ...(checked ? {} : {
                                                            app2FullName: "",
                                                            app2BirthDate: "",
                                                            app2BirthPlace: "",
                                                            app2Citizenship: "FILIPINO",
                                                            app2Gender: newGender,
                                                            app2Resident: null
                                                        })
                                                    };
                                                });
                                            }}
                                        />
                                        <label htmlFor="app2Resident" className="text-xs font-bold italic text-slate-700 dark:text-slate-400 cursor-pointer">Applicant 2 is a local resident</label>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-bold italic text-slate-700 dark:text-slate-400">Is Applicant 2 a foreigner? <span className="text-red-500">*</span></label>
                                        <div role="tablist" aria-label="Applicant 2 foreigner selector" className={cn(
                                            "flex items-center gap-2 ml-2 p-1 rounded-full border border-slate-200 dark:border-white/10",
                                            (showErrors && form.app2IsForeigner === null) ? "border-red-500 border-2" : ""
                                        )}>
                                            <button
                                                type="button"
                                                aria-pressed={form.app2IsForeigner === true}
                                                onClick={() => setApp2Foreigner(true)}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-bold transition",
                                                    form.app2IsForeigner === true ? "bg-theme-primary text-white" : "text-slate-700 dark:text-slate-400"
                                                )}
                                            >
                                                Yes
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={form.app2IsForeigner === false}
                                                onClick={() => setApp2Foreigner(false)}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-bold transition",
                                                    form.app2IsForeigner === false ? "bg-theme-primary text-white" : "text-slate-700 dark:text-slate-400"
                                                )}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {form.app2IsResident && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                        {form.app2Resident ? (
                                            <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                                                <div>
                                                    <p className="text-xs font-black uppercase italic text-slate-900 dark:text-white">{form.app2FullName}</p>
                                                    <p className="text-[10px] text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Local Resident</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={handleClearApp2Resident}
                                                    className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 rounded-xl px-3 border border-red-500/20"
                                                >
                                                    Remove Resident
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-blue-500">Search Resident Records</Label>
                                                <ResidentSearch onSelect={handleApp2Select} placeholder="Search by first or last name..." />
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Full Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="app2FullName"
                                            name="app2FullName"
                                            placeholder="ENTER FULL NAME"
                                            disabled={!!form.app2Resident}
                                            className={cn(
                                                "bg-slate-50 dark:bg-slate-900 font-bold uppercase text-slate-950 dark:text-white transition-all",
                                                (showErrors && !form.app2FullName) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10",
                                                !!form.app2Resident && "bg-slate-100 dark:bg-white/5 opacity-75 cursor-not-allowed border-none"
                                            )}
                                            value={form.app2FullName}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Date of Birth <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="app2BirthDate"
                                            name="app2BirthDate"
                                            type="date"
                                            disabled={!!form.app2Resident}
                                            className={cn(
                                                "bg-slate-50 dark:bg-slate-900 font-bold text-slate-950 dark:text-white dark:[color-scheme:dark] transition-all",
                                                (showErrors && !form.app2BirthDate) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10",
                                                !!form.app2Resident && "bg-slate-100 dark:bg-white/5 opacity-75 cursor-not-allowed border-none"
                                            )}
                                            value={form.app2BirthDate}
                                            onChange={e => setForm((p: any) => ({ ...p, app2BirthDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Place of Birth <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="app2BirthPlace"
                                            name="app2BirthPlace"
                                            placeholder="ENTER PLACE"
                                            disabled={!!form.app2Resident}
                                            className={cn(
                                                "bg-slate-50 dark:bg-slate-900 font-bold uppercase text-slate-950 dark:text-white transition-all",
                                                (showErrors && !form.app2BirthPlace) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10",
                                                !!form.app2Resident && "bg-slate-100 dark:bg-white/5 opacity-75 cursor-not-allowed border-none"
                                            )}
                                            value={form.app2BirthPlace}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Citizenship <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="app2Citizenship"
                                            name="app2Citizenship"
                                            placeholder="ENTER CITIZENSHIP"
                                            disabled={!!form.app2Resident}
                                            className={cn(
                                                "bg-slate-50 dark:bg-slate-900 font-bold uppercase text-slate-950 dark:text-white transition-all",
                                                (showErrors && !form.app2Citizenship) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10",
                                                !!form.app2Resident && "bg-slate-100 dark:bg-white/5 opacity-75 cursor-not-allowed border-none"
                                            )}
                                            value={form.app2Citizenship}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Sex <span className="text-red-500">*</span></Label>
                                        <Select
                                            disabled={!!form.app2Resident}
                                            value={form.app2Gender}
                                            onValueChange={(val) => {
                                                if (resident?.gender) {
                                                    const app1Gender = resident.gender.toUpperCase();
                                                    if (val && val === app1Gender) {
                                                        toast.error("Same-sex marriage is not permitted. Both applicants must be of opposite sex.");
                                                        return;
                                                    }
                                                }
                                                setForm((prev: any) => ({
                                                    ...prev,
                                                    app2Gender: val,
                                                    app1Gender: val === "MALE" ? "FEMALE" : val === "FEMALE" ? "MALE" : prev.app1Gender
                                                }));
                                            }}
                                        >
                                            <SelectTrigger
                                                id="app2Gender"
                                                className={cn(
                                                    "w-full h-10 px-3 rounded-md font-bold uppercase text-xs transition-all text-left text-slate-950 dark:text-white",
                                                    (showErrors && !form.app2Gender) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10",
                                                    !!form.app2Resident && "bg-slate-100 dark:bg-white/5 opacity-75 cursor-not-allowed border-none"
                                                )}
                                            >
                                                <SelectValue placeholder="SELECT GENDER" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MALE">Groom (Male)</SelectItem>
                                                <SelectItem value="FEMALE">Bride / Wife (Female)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">Address <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="app2Address"
                                            name="app2Address"
                                            placeholder="ENTER ADDRESS"
                                            disabled={!!form.app2Resident}
                                            className={cn(
                                                "bg-slate-50 dark:bg-slate-900 font-bold uppercase text-slate-950 dark:text-white transition-all",
                                                (showErrors && !form.app2Address) ? "border-2 border-red-500" : "border border-slate-200 dark:border-white/10",
                                                !!form.app2Resident && "bg-slate-100 dark:bg-white/5 opacity-75 cursor-not-allowed border-none"
                                            )}
                                            value={form.app2Address}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </Card>

                            <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-white/10">
                                <Button
                                    variant="ghost"
                                    onClick={() => existingRequests.length > 0 ? setCurrentStep("EXISTING") : router.push("/modules/civil-registry")}
                                    className="rounded-full px-8 border-slate-200 dark:border-white/10 font-black uppercase tracking-widest italic text-[10px] h-12 text-slate-700 dark:text-slate-300"
                                >
                                    <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                                    Back
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!validateStep("IDENTITY")) return;
                                        setCurrentStep("UPLOAD");
                                    }}
                                    className="rounded-full px-12 bg-theme-primary hover:bg-theme-hover text-white font-black uppercase tracking-widest italic text-[10px] h-12 shadow-xl shadow-theme-primary/20"
                                >
                                    Next Step
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
                            className="space-y-6 animate-in fade-in duration-300"
                        >
                            {/* Header */}
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
                                    REQUIRED <span className="text-theme-primary">DOCUMENTS</span>
                                </h2>
                                <p className="text-xs text-slate-500 font-medium italic">
                                    Please upload the documents prepared by each applicant (max 5MB each).
                                </p>
                            </div>

                            {/* Groom Documents Section */}
                            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-white/10">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black uppercase italic tracking-wider text-slate-900 dark:text-white">
                                        GROOM <span className="text-theme-primary">DOCUMENTS</span> (MALE)
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {groomName}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {groomDocKeys.map((docName) => {
                                        const doc = getDocItem(docName);
                                        return <PremiumDocumentUpload key={doc.id} {...doc} required={true} />;
                                    })}
                                </div>
                            </div>

                            {/* Bride Documents Section */}
                            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-white/10">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black uppercase italic tracking-wider text-slate-900 dark:text-white">
                                        BRIDE / WIFE <span className="text-theme-primary">DOCUMENTS</span> (FEMALE)
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {brideName}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {brideDocKeys.map((docName) => {
                                        const doc = getDocItem(docName);
                                        return <PremiumDocumentUpload key={doc.id} {...doc} required={true} />;
                                    })}
                                </div>
                            </div>

                            {/* General Documents Section */}
                            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-white/10">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black uppercase italic tracking-wider text-slate-900 dark:text-white">
                                        GENERAL / SHARED <span className="text-theme-primary">DOCUMENTS</span>
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        JOINT & ADMINISTRATIVE REQUIREMENTS
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sharedDocKeys.map((docName) => {
                                        const doc = getDocItem(docName);
                                        return <PremiumDocumentUpload key={doc.id} {...doc} required={true} />;
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-white/10 mt-6">
                                <Button
                                    variant="ghost"
                                    onClick={() => setCurrentStep("IDENTITY")}
                                    className="rounded-full px-8 border-slate-200 dark:border-white/10 font-black uppercase tracking-widest italic text-[10px] h-12 text-slate-700 dark:text-slate-300"
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

                    {/* ===== STEP: REVIEW & SUBMIT ===== */}
                    {currentStep === "REVIEW" && (
                        <ReviewAndSubmit
                            title="Application Review"
                            subtitle="Verify all information and documents before submitting your marriage license application"
                            policyAccepted={policyAccepted}
                            onPolicyAcceptedChange={setPolicyAccepted}
                            onReviewPolicy={() => setPolicyOpen(true)}
                            showErrors={showErrors}
                            submitting={submitting}
                            submitLabel="Submit Marriage License Application"
                            submitDisabled={false}
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
                                            <span className="text-slate-700 dark:text-slate-350 uppercase">Marriage License Application</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-dashed border-slate-250 dark:border-white/10 pb-3">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Base Filing Fee</span>
                                            <span className="text-slate-700 dark:text-slate-350">₱{dbMiscFee.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-gradient-to-r from-theme-primary to-theme-secondary/85 text-white rounded-2xl p-4 md:p-6 shadow-xl shadow-theme-primary/10 mt-6">
                                            <span className="font-black uppercase tracking-widest text-[10px] md:text-xs text-white/90">Total Amount Due</span>
                                            <span className="font-black text-xl md:text-2xl tracking-tight">₱{dbMiscFee.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            }
                            onSubmit={handleSubmit}
                            onBack={() => setCurrentStep("UPLOAD")}
                            backLabel="Modify Uploads"
                            detailsCards={
                                <Card className="bg-slate-50 dark:bg-white/5 border-none p-6 rounded-[2rem] space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-900 dark:text-white">
                                        <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#071018] relative pt-8">
                                            <span className="absolute top-2 left-4 text-[9px] font-black uppercase tracking-widest text-theme-primary italic">
                                                Applicant 1 ({form.app1Gender === "MALE" ? "Groom" : "Bride / Wife"})
                                            </span>
                                            <div className="text-sm font-black text-slate-900 dark:text-white">{form.app1FullName}</div>
                                            <div className="text-xs text-slate-600 dark:text-slate-300">{form.app1BirthDate} • {form.app1BirthPlace}</div>
                                            <div className="text-xs text-slate-400">{form.app1Citizenship}</div>
                                            <div className="text-xs text-slate-400 mt-1">Address: {form.informantAddress || "N/A"}</div>
                                        </div>
                                        <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#071018] relative pt-8">
                                            <span className="absolute top-2 left-4 text-[9px] font-black uppercase tracking-widest text-theme-primary italic">
                                                Applicant 2 ({form.app2Gender === "MALE" ? "Groom" : "Bride / Wife"})
                                            </span>
                                            <div className="text-sm font-black text-slate-900 dark:text-white">{form.app2FullName || 'N/A'}</div>
                                            <div className="text-xs text-slate-600 dark:text-slate-300">{form.app2BirthDate || ''} • {form.app2BirthPlace || ''}</div>
                                            <div className="text-xs text-slate-400">{form.app2Citizenship || ''}</div>
                                            <div className="text-xs text-slate-400 mt-1">Address: {form.app2Address || "N/A"}</div>
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
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Uploaded Documents</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {docsToShow.map((docName) => {
                                            const sanitizedKey = docName.replace(/[^a-zA-Z0-9_-]/g, '_');
                                            return (
                                                <ReadOnlyDocumentPreview
                                                    key={sanitizedKey}
                                                    file={files[sanitizedKey]}
                                                    previewUrl={previews[sanitizedKey]}
                                                    label={formatDocLabel(docName, form.app1Gender)}
                                                    fileName={files[sanitizedKey] ? files[sanitizedKey]!.name : previews[sanitizedKey] ? "Uploaded Document" : "Not uploaded"}
                                                    onView={() => handleOpenViewer(files[sanitizedKey], formatDocLabel(docName, form.app1Gender), previews[sanitizedKey])}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            }
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
