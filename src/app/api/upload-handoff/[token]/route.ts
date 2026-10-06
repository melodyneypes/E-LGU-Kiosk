import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getHandoffStoragePrefix,
  HANDOFF_ALLOWED_TYPES,
  HANDOFF_MAX_FILE_SIZE,
  inspectFileSignature,
  isAllowedHandoffSlot,
  scanWithClamAv,
  verifyHandoffToken,
} from "@/lib/secure-upload-handoff";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };
const BUCKET = "system-assets";

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const payload = verifyHandoffToken(decodeURIComponent(token));
    const folder = getHandoffStoragePrefix(payload);
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, { limit: 30 });
    if (error) throw error;

    const files = (data || [])
      .map((item: { name: string }) => {
        const separator = item.name.indexOf("--");
        const slot = separator === -1 ? "" : item.name.slice(0, separator);
        const fileName = separator === -1 ? item.name : item.name.slice(separator + 2);
        const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(`${folder}/${item.name}`);
        return { slot, fileName, url: publicData.publicUrl };
      })
      .filter((item: { slot: string }) => isAllowedHandoffSlot(payload.slot, item.slot));

    return NextResponse.json({
      status: files.length ? "uploaded" : "waiting",
      files,
      expiresAt: payload.exp,
      sessionSlot: payload.slot,
      context: payload.context || {},
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid handoff.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const payload = verifyHandoffToken(decodeURIComponent(token));
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > HANDOFF_MAX_FILE_SIZE + 256 * 1024) {
      return NextResponse.json({ error: "Upload request exceeds the 5MB limit." }, { status: 413 });
    }

    const formData = await request.formData();
    const uploadSlot = String(formData.get("slot") || payload.slot);
    if (!isAllowedHandoffSlot(payload.slot, uploadSlot)) {
      return NextResponse.json({ error: "Invalid document slot." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }
    if (file.size > HANDOFF_MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds the 5MB limit." }, { status: 400 });
    }
    if (!HANDOFF_ALLOWED_TYPES.includes(file.type as (typeof HANDOFF_ALLOWED_TYPES)[number])) {
      return NextResponse.json({ error: "Only PDF, JPG, and PNG files are allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const signature = inspectFileSignature(buffer);
    if (signature.mime !== file.type) {
      return NextResponse.json({ error: "File extension and content do not match." }, { status: 400 });
    }
    await scanWithClamAv(buffer);
    const folder = getHandoffStoragePrefix(payload);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const path = `${folder}/${uploadSlot}--${safeName || `document.${signature.extension}`}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: signature.mime,
      upsert: true,
      cacheControl: "private, no-store",
    });
    if (error) throw error;

    // Asynchronously prune stale files for the same slot with differing filenames
    try {
      const existing = await supabaseAdmin.storage.from(BUCKET).list(folder, { limit: 30 });
      const previous = existing.data?.filter((item: { name: string }) => item.name.startsWith(`${uploadSlot}--`) && `${folder}/${item.name}` !== path) || [];
      if (previous.length) {
        await supabaseAdmin.storage.from(BUCKET).remove(previous.map((item: { name: string }) => `${folder}/${item.name}`));
      }
    } catch {
      // Non-blocking cleanup
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      success: true,
      slot: uploadSlot,
      message: "File verified and uploaded successfully.",
      file: {
        slot: uploadSlot,
        fileName: file.name,
        url: publicData.publicUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Secure upload failed.";
    console.error("Secure handoff upload error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
