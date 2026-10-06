"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileUp, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";

const REQUIREMENTS = [
  "Barangay Clearance/Certification",
  "Tax Declaration",
  "Land Title",
  "Community Tax Certificate",
  "Latest Tax Receipts",
  "Adjoining Owners Confirmation",
  "Locational Clearance",
  "Affidavit of Consent",
  "Affidavit of Adjoining Owners",
  "Signed & Sealed Plans",
  "Notarized Deed of Sale/Lot Locational Plan/ Contract of Lease",
  "Cedula of Lot Owner",
  "ID of Lot Owner",
  "Death Certificate of Lot Owner (Optional)",
  "Birth Certificate of Heirs of Deceased Owner (Optional)",
  "Valid Licenses (PRC I.D.) of Involved Professionals",
  "Duly Notarized Estimated Value of Building/Structure",
  "Duly Notarized Technical Specification",
  "Construction Safety and Health Program From DOLE",
  "Construction Logbook duly signed by Civil Engineer/Architect in-charge of Construction",
  "Affidavit of Undertaking",
  "Cedula of Applicant",
  "ID of applicant with 3 signatures",
  "Structural Analysis and Design",
  "Soil Boring Test",
];
const PERMITS = [
  "Electrical Documents",
  "Plumbing Documents",
  "Sanitary Documents",
  "Excavation & Ground Preparation Documents",
  "Fencing Documents",
  "Scaffolding Documents",
  "Mechanical Documents",
  "Architectural Documents",
  "Civil/Structural Documents",
  "Electronics Documents",
  "Geodetic Documents",
  "Fire Protection Plan",
];

const BUSINESS_PERMIT_LABELS: Record<string, string> = {
  ownerIdFile: "Owner's Valid ID",
  ctcFile: "Community Tax Certificate (CTC/Cedula)",
  dtiSecFile: "DTI / SEC / COA Registration",
  birCorFile: "BIR Certificate of Registration (COR)",
  previousPermitFile: "Previous Business Permit",
  brgyClearanceFile: "Barangay Clearance",
  locationPhotoFile: "Location Photo of Business",
  sanitaryPermitFile: "Sanitary Permit",
  fireSafetyFile: "Fire Safety Inspection Certificate",
};

const RPT_LABELS: Record<string, string> = {
  rpt_validId: "Valid Government ID",
  rpt_previousOr: "Previous O.R. / SOA",
  rpt_buildingPermit: "Building / Occupancy Permit",
  rpt_deedOfSale: "Deed of Absolute Sale",
  rpt_title: "TCT / Land Title",
  rpt_birEcar: "BIR eCAR Certificate",
};

const CEDULA_LABELS: Record<string, string> = {
  idFile: "Government-Issued Valid ID",
  proofFile: "Proof of Income (e.g., Payslip, ITR, Barangay Certificate)",
};

const OCCUPANCY_REQUIREMENTS = [
  "Duly Notarized Certificate of Completion",
  "Construction Logbook, signed and sealed by Owner's Architect and Civil Engineer",
  "As-Built Plans, signed and sealed by the Owner's Architect and Civil Engineer",
  "Valid Licenses of All Involved Professionals",
  "Captioned Photographs of Site and Completed Building/Structure (Front, Sides, and Rear Areas)",
  "Duly Notarized Affidavit of Undertaking (Optional)"
];

const REQUIRED_REQUIREMENT_INDICES = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
]);

type HandoffContext = {
  isLotOwner?: boolean;
  totalFloors?: number;
  module?: string;
};

type UploadedFile = { slot: string; fileName: string; url: string };

export default function UploadHandoffPage() {
  const params = useParams<{ token: string }>();
  const [sessionSlot, setSessionSlot] = useState("");
  const [uploaded, setUploaded] = useState<Record<string, UploadedFile>>({});
  const [uploadingSlot, setUploadingSlot] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<HandoffContext>({});

  const endpoint = `/api/upload-handoff/${encodeURIComponent(params.token)}`;

  async function refresh() {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "This upload session is unavailable.");
        return;
      }
      setSessionSlot(result.sessionSlot);
      setContext(result.context || {});
      setUploaded(Object.fromEntries((result.files || []).map((file: UploadedFile) => [file.slot, file])));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        return resolve(file);
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1920;
          let width = img.width;
          let height = img.height;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(file);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                return resolve(file);
              }
              const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressed);
            },
            "image/jpeg",
            0.85
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  async function upload(slot: string, file: File) {
    setUploadingSlot(slot);
    setMessage("");
    try {
      let fileToUpload = file;
      if (file.type.startsWith("image/") && file.size > 500 * 1024) {
        fileToUpload = await compressImage(file);
      }
      const body = new FormData();
      body.append("slot", slot);
      body.append("file", fileToUpload);
      const response = await fetch(endpoint, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Upload failed.");
      } else if (result.file) {
        setUploaded(prev => ({ ...prev, [slot]: result.file }));
      } else {
        await refresh();
      }
    } catch (err) {
      console.error(err);
      setMessage("An unexpected error occurred during upload.");
    } finally {
      setUploadingSlot("");
    }
  }

  const slots = (sessionSlot === "documents" || sessionSlot === "occupancy_documents")
    ? (context.module === "occupancy" || sessionSlot === "occupancy_documents")
      ? OCCUPANCY_REQUIREMENTS.map((label, index) => ({
          slot: `req_${index}`,
          label,
          group: "Occupancy Permit Requirements",
          isRequired: index < 5,
        }))
      : [
        ...REQUIREMENTS
          .map((label, index) => {
            const isLotOwner = context.isLotOwner ?? true;
            const hasMultipleFloors = (context.totalFloors || 0) > 1;
            const isRequired =
              REQUIRED_REQUIREMENT_INDICES.has(index) &&
              (isLotOwner ? ![7, 10, 11, 12, 13, 14].includes(index) : ![21, 22].includes(index)) &&
              (hasMultipleFloors || ![23, 24].includes(index));
            return { slot: `req_${index}`, label, group: "Requirements", isRequired };
          }),
        ...PERMITS.map((label, index) => ({
          slot: `permit_${index}`,
          label,
          group: "Permits",
          isRequired: false,
        })),
      ]
    : sessionSlot.startsWith("bp_")
      ? [{ slot: sessionSlot, label: BUSINESS_PERMIT_LABELS[sessionSlot.replace("bp_", "")] || sessionSlot.replace("bp_", "").replace(/([A-Z])/g, " $1").trim(), group: "Business Permit Document", isRequired: false }]
      : sessionSlot.startsWith("rpt_")
        ? [{ slot: sessionSlot, label: RPT_LABELS[sessionSlot] || "Real Property Tax Document", group: "Real Property Tax Document", isRequired: false }]
      : sessionSlot === "birth_id"
        ? [
            { slot: "idFront", label: "Valid ID Front Photo", group: "Valid ID Copy (Front & Back)", isRequired: false },
            { slot: "idBack", label: "Valid ID Back Photo", group: "Valid ID Copy (Front & Back)", isRequired: false }
          ]
      : sessionSlot === "lcr_birth_psa"
        ? [
            { slot: "psaNegativeCert", label: "PSA Negative Certification", group: "Required Documents", isRequired: false },
            { slot: "form1a", label: "Form 1A (Local Registry Copy)", group: "Required Documents", isRequired: false }
          ]
        : sessionSlot === "idFile" || sessionSlot === "proofFile"
        ? [{ slot: sessionSlot, label: CEDULA_LABELS[sessionSlot] || "Secure Document Upload", group: "Cedula Application Document", isRequired: false }]
        : sessionSlot === "bfp"
          ? [{ slot: "bfp", label: "Fire Safety / BFP Clearance", group: "Clearance Document", isRequired: false }]
          : sessionSlot === "zoning"
            ? [{ slot: "zoning", label: "Zoning / Locational Clearance", group: "Clearance Document", isRequired: false }]
            : [{ slot: sessionSlot || "unknown", label: "Secure Document Upload", group: "Document", isRequired: false }];

  return (
    <main className="h-dvh overflow-y-auto bg-[#071c12] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3 text-theme-primary">
          <ShieldCheck className="h-9 w-9 shrink-0" />
          <div>
            <h1 className="text-xl font-black uppercase">Secure Document Upload</h1>
            <p className="text-xs font-semibold text-slate-500">PDF, JPG, PNG • 5MB each • Antivirus scanned</p>
          </div>
        </div>

        {message && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-theme-primary" />
            <p className="text-sm font-bold text-slate-500">Loading upload session...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((item, index) => {
              const file = uploaded[item.slot];
              const showGroup = index === 0 || slots[index - 1]?.group !== item.group;
              return (
                <div key={item.slot}>
                  {showGroup && <h2 className="mb-2 mt-5 text-xs font-black uppercase tracking-widest text-theme-primary">{item.group}</h2>}
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4">
                    <div className={file ? "text-emerald-500" : "text-slate-400"}>
                      {file ? <CheckCircle2 className="h-6 w-6" /> : <FileUp className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {item.label}
                        {item.group === "Requirements" && !item.isRequired && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Optional</span>
                        )}
                      </p>
                      <div className="truncate text-xs text-slate-400">
                        {uploadingSlot === item.slot ? (
                          <span className="inline-flex items-center gap-1.5 text-blue-600 font-bold animate-pulse">
                            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            Uploading & Verifying...
                          </span>
                        ) : file ? (
                          <span className="text-emerald-700 font-medium truncate flex items-center gap-1">
                            <span>✓ Ready:</span> {file.fileName}
                          </span>
                        ) : (
                          "Tap to choose file"
                        )}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-2 text-[10px] font-black uppercase text-white transition-all ${
                      uploadingSlot === item.slot ? "bg-blue-500 animate-pulse" : file ? "bg-emerald-600" : "bg-theme-primary"
                    }`}>
                      {uploadingSlot === item.slot ? "Uploading" : file ? "Re-upload" : "Upload"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={!!uploadingSlot}
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) => {
                        const selected = event.target.files?.[0];
                        if (selected) void upload(item.slot, selected);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
