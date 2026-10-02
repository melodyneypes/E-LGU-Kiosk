import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const dbUrl = process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== STARTING FULL DATABASE GENERALIZATION ===");

  // 1. UPDATE HERO SLIDES
  console.log("--> Updating HeroSlides...");
  const heroSlideImages = [
    "/slide-welcome.png",
    "/slide-services.png",
    "/slide-announcements.png",
  ];
  const slides = await prisma.heroSlide.findMany();
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    await prisma.heroSlide.update({
      where: { id: s.id },
      data: {
        title: "Welcome to E-LGU",
        subtitle: "Your digital gateway to municipal services, citizen assistance, and public programs.",
        imageUrl: heroSlideImages[i % heroSlideImages.length],
      },
    });
  }
  console.log(`Updated ${slides.length} HeroSlides to generic titles and local images.`);

  // 2. UPDATE OFFICIALS
  console.log("--> Updating Officials to generic roster...");
  await prisma.official.deleteMany({});
  const genericOfficials = [
    {
      name: "HON. ROBERTO V. SANTOS",
      position: "MUNICIPAL MAYOR",
      motto: "Tapat, Mabilis, at Serbisyong Diretso sa Mamamayan",
      category: "EXECUTIVE",
      order: 1,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. MARIA CLARA E. REYES",
      position: "VICE MAYOR",
      category: "EXECUTIVE",
      order: 2,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. JUAN D. DELA CRUZ",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 3,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. TERESA M. GARCIA",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 4,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. EDUARDO S. BAUTISTA",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 5,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. CARMEN L. MENDOZA",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 6,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. ROLANDO G. VILLANUEVA",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 7,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. PATRICIA A. NAVARRO",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 8,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. JOSE MARI P. TAN",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 9,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. BEATRIZ C. RAMOS",
      position: "COUNCILOR",
      category: "COUNCIL",
      order: 10,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. ANTONIO S. LOPEZ",
      position: "LNB PRESIDENT",
      category: "COUNCIL",
      order: 11,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. MIGUEL B. TORRES",
      position: "SK FEDERATION PRESIDENT",
      category: "COUNCIL",
      order: 12,
      isActive: true,
      imageUrl: null,
    },
    {
      name: "HON. DANIEL K. CORPUZ",
      position: "PCL PRESIDENT",
      category: "COUNCIL",
      order: 13,
      isActive: true,
      imageUrl: null,
    },
  ];

  for (const off of genericOfficials) {
    await prisma.official.create({ data: off });
  }
  console.log(`Created ${genericOfficials.length} generic officials.`);

  // 3. UPDATE SYSTEM SETTINGS (BRANDING & LOGO)
  console.log("--> Updating System Settings...");
  const settingsToUpsert = [
    { key: "site_logo", value: "/logo.png" },
    { key: "kiosk_logo_url", value: "/logo.png" },
    { key: "portal_name", value: "Municipality of E-LGU" },
    { key: "bank_account_name", value: "MUNICIPALITY OF E-LGU" },
    { key: "brand_word_1", value: "E-" },
    { key: "brand_word_2", value: "LGU" },
  ];

  for (const s of settingsToUpsert) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.log("Updated system settings for branding.");

  // 4. CLEAN BARANGAY DESCRIPTIONS
  console.log("--> Cleaning BarangayInfo descriptions...");
  const barangays = await prisma.barangayInfo.findMany();
  for (const b of barangays) {
    if (b.description && (b.description.includes("Mapandan") || b.description.includes("Pangasinan"))) {
      const cleanDesc = b.description
        .replace(/in the municipality of Mapandan,\s*Pangasinan\.?/gi, "in the local municipality.")
        .replace(/Mapandan/gi, "E-LGU")
        .replace(/Pangasinan/gi, "");
      await prisma.barangayInfo.update({
        where: { id: b.id },
        data: { description: cleanDesc, logoUrl: null },
      });
    }
  }
  console.log(`Sanitized ${barangays.length} BarangayInfo records.`);

  // 5. CLEAN NEWS & ANNOUNCEMENTS
  console.log("--> Cleaning News & Announcements...");
  const newsList = await prisma.news.findMany();
  for (const n of newsList) {
    if (n.title.includes("Mapandan") || (n.content && n.content.includes("Mapandan"))) {
      await prisma.news.update({
        where: { id: n.id },
        data: {
          title: n.title.replace(/EMapandan/gi, "E-LGU").replace(/Mapandan/gi, "E-LGU"),
          content: n.content.replace(/EMapandan/gi, "E-LGU").replace(/Mapandan/gi, "E-LGU"),
          author: n.author ? n.author.replace(/Mapandan/gi, "E-LGU") : "LGU Information Office",
        },
      });
    }
  }

  const announcements = await prisma.announcement.findMany();
  for (const a of announcements) {
    if (a.title.includes("Mapandan") || (a.content && a.content.includes("Mapandan"))) {
      await prisma.announcement.update({
        where: { id: a.id },
        data: {
          title: a.title.replace(/EMapandan/gi, "E-LGU").replace(/Mapandan/gi, "E-LGU"),
          content: a.content.replace(/EMapandan/gi, "E-LGU").replace(/Mapandan/gi, "E-LGU"),
        },
      });
    }
  }

  // 6. CLEAN HOTLINES
  console.log("--> Cleaning Hotlines...");
  const hotlines = await prisma.hotline.findMany();
  for (const h of hotlines) {
    if (h.name.includes("Mapandan")) {
      await prisma.hotline.update({
        where: { id: h.id },
        data: {
          name: h.name.replace(/Mapandan/gi, "Local"),
        },
      });
    }
  }

  // 7. CLEAN PROJECTS
  console.log("--> Cleaning Projects...");
  const projects = await prisma.project.findMany();
  for (const p of projects) {
    if (p.title.includes("Mapandan") || (p.location && p.location.includes("Mapandan"))) {
      await prisma.project.update({
        where: { id: p.id },
        data: {
          title: p.title.replace(/Mapandan/gi, "Municipal"),
          location: p.location ? p.location.replace(/Mapandan/gi, "Town Center") : "Town Center",
        },
      });
    }
  }

  console.log("=== COMPLETED ALL DATABASE GENERALIZATIONS SUCCESSFULLY ===");
}

main()
  .catch(err => {
    console.error("Generalize error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
