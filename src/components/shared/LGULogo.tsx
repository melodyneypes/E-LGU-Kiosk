"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import lguConfig from "@/lgu.config.json";

type BrandingState = {
  logoUrl: string | null;
};

export default function LGULogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  const [branding, setBranding] = useState<BrandingState>({ logoUrl: null });

  useEffect(() => {
    let active = true;

    async function loadBranding() {
      try {
        const res = await fetch("/api/branding", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as BrandingState;
        if (active) setBranding({ logoUrl: data.logoUrl || null });
      } catch {
        if (active) setBranding({ logoUrl: null });
      }
    }

    void loadBranding();
    return () => {
      active = false;
    };
  }, []);

  const fallback = lguConfig.assets.logo;

  return (
    <Image
      src={branding.logoUrl || fallback}
      alt="LGU Logo"
      width={size}
      height={size}
      className={className || "object-contain"}
      unoptimized={Boolean(branding.logoUrl)}
    />
  );
}
