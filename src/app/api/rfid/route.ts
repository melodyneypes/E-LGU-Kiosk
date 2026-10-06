import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type FacialRecognitionPayload =
  | string
  | {
      mode?: "reference_image" | "embedding" | "liveness";
      referenceImageUrl?: string;
      selfieUrl?: string;
      embedding?: number[];
      model?: string;
      verifiedAt?: string;
    };

function parseFacialRecognition(value: unknown) {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as FacialRecognitionPayload;
    } catch {
      return { referenceImageUrl: value } as FacialRecognitionPayload;
    }
  }

  if (typeof value === "object") {
    return value as FacialRecognitionPayload;
  }

  return null;
}

import { sanitizeRfid } from "@/lib/rfidSanitizer";

export async function GET(req: NextRequest) {
  const rawCardId = req.nextUrl.searchParams.get("card");
  const cardId = sanitizeRfid(rawCardId);

  if (!cardId) {
    return NextResponse.json({ error: "No card ID provided" }, { status: 400 });
  }

  try {
    const resident = await prisma.resident.findUnique({
      where: { rfid: cardId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        barangay: true,
        imageUrl: true,
        livenessUrl: true,
        idFrontUrl: true,
        facialRecognition: true,
        user: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!resident) {
      return NextResponse.json(
        { error: "Card not recognized. Please register at the front desk." },
        { status: 404 }
      );
    }

    let userId = resident.userId;
    let role = resident.user?.role || null;

    if (!userId) {
      const cleanRfid = cardId.trim();
      
      // Check if a User with this RFID already exists
      let existingUser = await prisma.user.findFirst({
        where: { rfid: cleanRfid }
      });

      // If no User has this RFID, check if a User has this email
      if (!existingUser && resident.email) {
        existingUser = await prisma.user.findUnique({
          where: { email: resident.email }
        });
      }

      if (existingUser) {
        // Link resident to the existing user
        await prisma.resident.update({
          where: { id: resident.id },
          data: { userId: existingUser.id }
        });
        userId = existingUser.id;
        role = existingUser.role;
      } else {
        // Create a new User
        const fullNameTemp = [resident.firstName, resident.middleName, resident.lastName]
          .filter(Boolean)
          .join(" ");

        const newUser = await prisma.user.create({
          data: {
            name: fullNameTemp,
            email: resident.email || null,
            rfid: cleanRfid,
            role: "USER"
          }
        });

        await prisma.resident.update({
          where: { id: resident.id },
          data: { userId: newUser.id }
        });

        userId = newUser.id;
        role = newUser.role;
      }
    }

    const fullName = [resident.firstName, resident.middleName, resident.lastName]
      .filter(Boolean)
      .join(" ");

    const facialRecognition = parseFacialRecognition(resident.facialRecognition);
    const facialRecognitionObject =
      facialRecognition && typeof facialRecognition === "object" && !Array.isArray(facialRecognition)
        ? facialRecognition
        : null;

    return NextResponse.json({
      resident: {
        id: resident.id,
        userId: userId,
        fullName,
        firstName: resident.firstName,
        lastName: resident.lastName,
        middleName: resident.middleName,
        photoUrl: resident.livenessUrl || resident.imageUrl || resident.idFrontUrl,
        barangay: resident.barangay,
        email: resident.email,
        role: role,
        hasFaceAuth: Boolean(facialRecognitionObject || resident.imageUrl || resident.livenessUrl),
        faceAuthSource: facialRecognitionObject?.mode || (resident.imageUrl ? "reference_image" : null),
        faceReferenceUrl: facialRecognitionObject?.referenceImageUrl || facialRecognitionObject?.selfieUrl || resident.imageUrl || resident.livenessUrl || null,
        facialRecognition,
      },
    });
  } catch (err) {
    console.error("[/api/rfid] DB error:", err);
    return NextResponse.json(
      { error: "Could not verify card. Please try again." },
      { status: 500 }
    );
  }
}
