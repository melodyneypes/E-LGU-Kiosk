import { NextResponse } from "next/server";
import lguConfig from "@/lgu.config.json";

export async function GET() {
  return NextResponse.json({
    logoUrl: lguConfig.assets.logo,
    coverImageUrl: lguConfig.assets.welcomeSlide,
  });
}
