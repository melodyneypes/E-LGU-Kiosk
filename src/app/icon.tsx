import { ImageResponse } from "next/og";
import lguConfig from "@/lgu.config.json";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  try {
    let logoUrl: string | null = lguConfig.assets.logo;

    if (logoUrl && logoUrl.startsWith("/")) {
      try {
        const filePath = path.join(process.cwd(), "public", logoUrl.replace(/^\//, ""));
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          logoUrl = `data:image/png;base64,${buffer.toString("base64")}`;
        } else {
          logoUrl = null;
        }
      } catch {
        logoUrl = null;
      }
    }

    if (logoUrl && (logoUrl.startsWith("http://") || logoUrl.startsWith("https://") || logoUrl.startsWith("data:"))) {
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
          />
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
          background: "#0b1a3b",
          color: "#00A3FF",
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
