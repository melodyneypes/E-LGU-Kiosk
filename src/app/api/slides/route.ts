import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const [announcements, news] = await Promise.all([
      prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          content: true,
          priority: true,
          category: true,
          isPinned: true,
          expiryDate: true,
          createdAt: true,
        },
      }),
      prisma.news.findMany({
        where: { isPublished: true },
        orderBy: { publishDate: "desc" },
        take: 4,
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
      announcements, 
      news: news.map(n => ({ ...n, imageUrl: resolveImg(n.imageUrl) }))
    });
  } catch (err) {
    console.error("[/api/slides] DB error:", err);
    return NextResponse.json(
      { announcements: [], news: [], error: "Could not fetch slides" },
      { status: 500 }
    );
  }
}
