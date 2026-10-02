import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [logoSetting, barangay] = await Promise.all([
      prisma.systemSetting.findUnique({
        where: { key: "kiosk_logo_url" },
        select: { value: true },
      }),
      prisma.barangayInfo.findFirst({
        select: { logoUrl: true, coverImageUrl: true },
      }),
    ]);

    return NextResponse.json({
      logoUrl: logoSetting?.value || barangay?.logoUrl || null,
      coverImageUrl: barangay?.coverImageUrl || null,
    });
  } catch (error) {
    console.error("[/api/branding] DB error:", error);
    return NextResponse.json(
      { logoUrl: null, coverImageUrl: null, error: "Failed to fetch branding" },
      { status: 500 }
    );
  }
}
