import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const [
      heroSlides,
      announcements,
      newsList,
      services,
      officials,
      projects,
      hotlines,
    ] = await Promise.all([
      // 1. Hero Slides
      prisma.heroSlide.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        take: 5,
      }),

      // 2. Announcements
      prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          content: true,
          priority: true,
          category: true,
          isPinned: true,
          createdAt: true,
        },
      }),

      // 3. News
      prisma.news.findMany({
        where: { isPublished: true },
        orderBy: { publishDate: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          content: true,
          author: true,
          category: true,
          imageUrl: true,
          publishDate: true,
        },
      }),

      // 4. Citizen Services (Transaction Types)
      prisma.transactionType.findMany({
        orderBy: [{ level: "asc" }, { name: "asc" }],
        take: 16,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          category: true,
          baseFee: true,
          processingTime: true,
          slaDays: true,
          requiredDocs: true,
          pickupAddress: true,
        },
      }),

      // 5. Officials
      prisma.official.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        take: 16,
        select: {
          id: true,
          name: true,
          position: true,
          imageUrl: true,
          motto: true,
          category: true,
        },
      }),

      // 6. Public Works & Infrastructure Projects
      prisma.project.findMany({
        where: { isPublished: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          location: true,
          budget: true,
          progress: true,
          imageUrl: true,
        },
      }),

      // 7. Emergency Hotlines
      prisma.hotline.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        take: 12,
        select: {
          id: true,
          name: true,
          category: true,
          mobileNumber: true,
          telephone: true,
        },
      }),
    ]);

    const resolveImg = (url: string | null) => {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('/')) {
        const localPath = path.join(process.cwd(), 'public', url);
        if (fs.existsSync(localPath)) return url;
        return `https://e-lgu.vercel.app${url}`;
      }
      return url;
    };

    return NextResponse.json({
      heroSlides: heroSlides.map(h => ({ ...h, imageUrl: resolveImg(h.imageUrl) || h.imageUrl })),
      announcements,
      newsList: newsList.map(n => ({ ...n, imageUrl: resolveImg(n.imageUrl) })),
      services,
      officials: officials.map(o => ({ ...o, imageUrl: resolveImg(o.imageUrl) })),
      projects: projects.map(p => ({ ...p, imageUrl: resolveImg(p.imageUrl) })),
      hotlines,
    });
  } catch (err) {
    console.error("[/api/kiosk/feed] Error loading kiosk feed:", err);
    return NextResponse.json(
      {
        heroSlides: [],
        announcements: [],
        newsList: [],
        services: [],
        officials: [],
        projects: [],
        hotlines: [],
        error: "Failed to fetch kiosk feed",
      },
      { status: 500 }
    );
  }
}
