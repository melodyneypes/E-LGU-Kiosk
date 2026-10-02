import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  try {
    const [logoSetting, barangay] = await Promise.all([
      prisma.systemSetting.findUnique({
        where: { key: "kiosk_logo_url" },
        select: { value: true },
      }),
      prisma.barangayInfo.findFirst({
        select: { logoUrl: true },
      }),
    ]);

    const logoUrl = logoSetting?.value || barangay?.logoUrl || null;

    if (logoUrl) {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              borderRadius: "9999px",
              overflow: "hidden",
              backgroundImage: `url(${logoUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
          </div>
        ),
        size
      );
    }
  } catch (error) {
    console.error("[icon] branding fetch failed:", error);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "var(--primary-theme-secondary)",
          fontWeight: 700,
          fontSize: 18,
          borderRadius: "9999px",
        }}
      >
        E
      </div>
    ),
    size
  );
}
