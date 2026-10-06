"use client";

import React, { useRef, useId } from "react";
import { Upload, QrCode, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compression";

interface PremiumDocumentUploadProps {
    id?: string;
    label: string;
    required?: boolean;
    file: File | null;
    previewUrl?: string | null;
    existingUrl?: string | null;
    onFileSelect: (file: File) => void;
    onClear?: () => void;
    onView: () => void;
    error?: boolean | string;
    infoText?: string;
    onClickUpload?: () => void;
}

export default function PremiumDocumentUpload({
    id,
    label,
    required = false,
    file,
    previewUrl,
    existingUrl,
    onFileSelect,
    onClear,
    onView,
    error = false,
    infoText = "PDF / IMAGE (MAX 5MB)",
    onClickUpload
}: PremiumDocumentUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        if (selectedFile) {
            const maxBytes = 5 * 1024 * 1024; // 5MB limit
            if (selectedFile.size > maxBytes) {
                toast.error(`The file "${selectedFile.name}" is too large! Maximum limit is 5MB`);
                e.target.value = "";
                return;
            }

            const extension = selectedFile.name.split(".").pop()?.toLowerCase();
            if (extension === "docx" || extension === "doc" || selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || selectedFile.type === "application/msword") {
                toast.error("Word documents (.doc, .docx) are not accepted. Please upload PDF or image files.");
                e.target.value = "";
                return;
            }

            // Browser-side magic numbers check to prevent MIME sniffing/Polyglot attacks
            try {
                const headerBuffer = await selectedFile.slice(0, 8).arrayBuffer();
                const arr = new Uint8Array(headerBuffer);
                let hex = "";
                for (let i = 0; i < arr.length; i++) {
                    hex += arr[i].toString(16).padStart(2, "0").toUpperCase();
                }

                const isPdf = hex.startsWith("25504446"); // %PDF-
                const isPng = hex.startsWith("89504E470D0A1A0A"); // \x89PNG\r\n\x1a\n
                const isJpg = hex.startsWith("FFD8FF"); // JPEG

                if (!isPdf && !isPng && !isJpg) {
                    toast.error("The file content format is invalid or corrupted. Please upload a standard PDF or Image.");
                    e.target.value = "";
                    return;
                }
            } catch (err) {
                console.error("File header check error:", err);
                toast.error("Failed to read the file header.");
                e.target.value = "";
                return;
            }

            let fileToProcess = selectedFile;
            if (selectedFile.type.startsWith("image/")) {
                try {
                    toast.loading("Compressing and optimizing document...", { id: "image-compress-toast" });
                    fileToProcess = await compressImage(selectedFile);
                    toast.dismiss("image-compress-toast");
                } catch (err) {
                    console.error("Compression error:", err);
                    toast.dismiss("image-compress-toast");
                }
            }

            onFileSelect(fileToProcess);
        }
    };

    const hasFile = !!file || !!previewUrl || !!existingUrl;
    const checkIsPdfUrl = (url: string | null | undefined): boolean => {
        if (!url) return false;
        try {
            const cleanUrl = url.split("?")[0].toLowerCase();
            if (cleanUrl.endsWith(".pdf")) return true;
        } catch {}
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes("application/pdf") || 
               lowerUrl.includes(".pdf?") || 
               lowerUrl.startsWith("data:application/pdf");
    };

    const isPdf = file 
        ? (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
        : previewUrl 
        ? checkIsPdfUrl(previewUrl)
        : existingUrl
        ? checkIsPdfUrl(existingUrl)
        : false;

    const getFileName = () => {
        if (file) return file.name;
        const url = previewUrl || existingUrl;
        if (url) {
            try {
                const cleanUrl = url.split("?")[0];
                const parts = cleanUrl.split("/");
                const fileNameWithTimestamp = decodeURIComponent(parts[parts.length - 1]);
                const cleanName = fileNameWithTimestamp.replace(/^\d+_/, "");
                if (cleanName) return cleanName;
            } catch {}
        }
        return "PDF Document";
    };

    const currentPreview = previewUrl || (file ? URL.createObjectURL(file) : existingUrl || null);

    return (
        <div id={id} className={cn(
            "p-5 md:p-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-dashed flex flex-col gap-4 transition-all duration-300 w-full hover:border-slate-350 dark:hover:border-white/20",
            error 
                ? "!border-red-500 !border-solid !border-2 dark:!border-red-500/80 ring-2 ring-red-500/20 bg-red-50/10 animate-pulse" 
                : "border-slate-200 dark:border-white/10"
        )}>
            <input
                type="file"
                id={inputId}
                ref={inputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
            />

            {hasFile ? (
                <>
                    {/* Header when file exists */}
                    <div className="flex items-center gap-3 md:gap-4 w-full text-left">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-black/20 rounded-xl flex items-center justify-center shadow-sm shrink-0 border border-slate-100 dark:border-white/5">
                            <Upload className="w-5 h-5 md:w-6 md:h-6 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="space-y-0.5">
                            <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-white italic flex items-center gap-1">
                                {label} {required && <span className="text-red-500 font-black not-italic">*</span>}
                            </h4>
                            <p className="text-[8px] md:text-[9px] text-slate-400 font-bold italic uppercase tracking-tighter line-clamp-1">
                                {infoText}
                            </p>
                        </div>
                    </div>

                    {isPdf ? (
                        <div
                            onClick={onView}
                            className="w-full p-4 bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-between mt-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-350 truncate max-w-[200px]">
                                {getFileName()}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-450 italic">🔍 Click to View</span>
                        </div>
                    ) : currentPreview ? (
                        <div
                            onClick={onView}
                            className="relative w-full aspect-[21/9] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg mt-1 cursor-pointer group/preview"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={currentPreview}
                                alt={label}
                                className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-2 select-none z-20">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white italic">🔍 Click to View Full Size</span>
                            </div>
                        </div>
                    ) : null}

                    <div className="flex items-center justify-between w-full gap-2 md:gap-3 mt-1">
                        <button
                            type="button"
                            onClick={onView}
                            className="font-black italic uppercase tracking-widest text-[8px] md:text-[9px] px-3 md:px-4 h-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-white/5 flex-1 transition-all duration-300 cursor-pointer"
                        >
                            View
                        </button>
                        {onClickUpload ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onClickUpload}
                                    className="font-black italic uppercase tracking-widest text-[8px] md:text-[9px] px-2 md:px-3 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white border border-slate-200 dark:border-white/10 flex-1 transition-all duration-300 cursor-pointer text-center flex items-center justify-center select-none"
                                >
                                    QR Change
                                </button>
                                <label
                                    htmlFor={inputId}
                                    className="font-black italic uppercase tracking-widest text-[8px] md:text-[9px] px-2 md:px-3 h-8 rounded-full border border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/5 flex-1 transition-all duration-300 cursor-pointer text-center flex items-center justify-center select-none"
                                >
                                    Direct Change
                                </label>
                            </>
                        ) : (
                            <label
                                htmlFor={inputId}
                                className="font-black italic uppercase tracking-widest text-[8px] md:text-[9px] px-4 md:px-6 h-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-white/5 flex-1 transition-all duration-300 cursor-pointer text-center flex items-center justify-center select-none"
                            >
                                Change
                            </label>
                        )}
                        {onClear && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (inputRef.current) inputRef.current.value = "";
                                    onClear();
                                }}
                                className="font-black italic uppercase tracking-widest text-[8px] md:text-[9px] px-2 md:px-3 h-8 rounded-full border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 flex-1 transition-all duration-300 cursor-pointer text-center flex items-center justify-center select-none"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Title & Info at the top */}
                    <div className="text-center space-y-1">
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center justify-center gap-1">
                            {label} {required && <span className="text-red-500 font-black not-italic">*</span>}
                        </h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{infoText}</p>
                    </div>

                    {onClickUpload ? (
                        <div className="grid sm:grid-cols-2 gap-4 w-full mt-2">
                            {/* Left Choice: Upload from Phone (QR) */}
                            <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 bg-white/[0.02] flex flex-col justify-between items-center text-center min-h-[160px]">
                                <div className="space-y-1">
                                    <QrCode className="w-8 h-8 text-slate-500 dark:text-slate-400 mx-auto" />
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white">Upload from Phone</h4>
                                    <p className="text-slate-400 text-[8px] leading-tight font-medium">Scan QR code with phone camera to upload.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClickUpload}
                                    className="w-full mt-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-black uppercase tracking-widest text-[8px] rounded-xl py-3 border border-slate-200 dark:border-white/10 active:scale-95 transition-all cursor-pointer"
                                >
                                    SCAN QR CODE
                                </button>
                            </div>

                            {/* Right Choice: Direct Upload */}
                            <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 bg-white/[0.02] flex flex-col justify-between items-center text-center min-h-[160px]">
                                <div className="space-y-1">
                                    <UploadCloud className="w-8 h-8 text-slate-500 dark:text-slate-400 mx-auto" />
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white">Direct Upload</h4>
                                    <p className="text-slate-400 text-[8px] leading-tight font-medium">Upload files directly from this kiosk.</p>
                                </div>
                                <label
                                    htmlFor={inputId}
                                    className="w-full mt-3 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 font-black uppercase tracking-widest text-[8px] rounded-xl py-3 text-slate-700 dark:text-slate-300 shadow-sm text-center cursor-pointer flex items-center justify-center select-none active:scale-95 transition-all"
                                >
                                    SELECT FILE
                                </label>
                            </div>
                        </div>
                    ) : (
                        <label
                            htmlFor={inputId}
                            className="w-full h-10 rounded-xl bg-theme-primary hover:bg-theme-hover text-white font-black uppercase tracking-widest italic text-[9px] transition-all duration-300 flex items-center justify-center shadow-lg shadow-theme-primary/10 cursor-pointer text-center select-none mt-2"
                        >
                            UPLOAD
                        </label>
                    )}
                </>
            )}
        </div>
    );
}
