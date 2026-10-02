"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";


interface BusinessPermitViewProps {
  request: any;
  additionalData: any;
}

export default function BusinessPermitView({ request, additionalData }: BusinessPermitViewProps) {
  const isNew = additionalData.businessType === "NEW";

  const formatCurrency = (amount: any) => {
    const val = parseFloat(String(amount || 0).replace(/,/g, ""));
    return isNaN(val) ? "₱0.00" : `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Badge className="bg-theme-primary/10 text-theme-primary border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5 animate-pulse">
          {isNew ? "New Business Application" : "Business Renewal"}
        </Badge>
        {additionalData.businessBranch && (
          <Badge className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5">
            {additionalData.businessBranch} BRANCH
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs leading-relaxed">
        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Business Name</span>
          <p className="font-black uppercase text-slate-800 dark:text-white">
            {additionalData.businessName || "N/A"}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Trade / Signage Name</span>
          <p className="font-black uppercase text-slate-800 dark:text-white">
            {additionalData.tradeName || "N/A"}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Organization Type</span>
          <p className="font-black uppercase text-slate-800 dark:text-white">
            {String(additionalData.orgType || "").replace(/_/g, " ")}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Line of Business</span>
          <p className="font-black uppercase text-slate-800 dark:text-white">
            {additionalData.lineOfBusiness || "N/A"}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Business Address</span>
          <p className="font-black uppercase text-slate-850 dark:text-white">
            {[additionalData.building, additionalData.street, additionalData.barangay, additionalData.municipality, additionalData.province].filter(Boolean).join(", ")}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">TIN Number</span>
          <p className="font-black text-slate-800 dark:text-white font-mono">
            {additionalData.tinNumber || "N/A"}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Store Area & Employees</span>
          <p className="font-black text-slate-800 dark:text-white">
            {additionalData.businessArea || "0"} SQM / {additionalData.employeeCount || "0"} Employees
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">
            {isNew ? "Initial Capitalization" : "Previous Gross Sales"}
          </span>
          <p className="font-black text-theme-primary font-mono text-sm">
            {isNew ? formatCurrency(additionalData.capitalInvestment) : formatCurrency(additionalData.grossSales)}
          </p>
        </div>

        {isNew ? (
          <>
            <div className="space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Registration Type & No.</span>
              <p className="font-black uppercase text-slate-800 dark:text-white">
                {additionalData.registrationType || "DTI"}: {additionalData.dtiSecNumber || "N/A"}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Registration Date</span>
              <p className="font-black text-slate-800 dark:text-white">
                {additionalData.dtiSecDate || "N/A"}
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Existing Permit License No.</span>
            <p className="font-black uppercase text-slate-800 dark:text-white">
              {additionalData.permitNumber || "N/A"}
            </p>
          </div>
        )}
      </div>


    </div>
  );
}
