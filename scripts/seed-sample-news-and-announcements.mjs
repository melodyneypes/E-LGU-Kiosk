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
  console.log("=== SEEDING SAMPLE NEWS, ANNOUNCEMENTS, AND PROJECTS ===");

  // 1. UPDATE / ENSURE NEWS (at least 3 published items)
  // News 1: Lead story
  await prisma.news.upsert({
    where: { id: "cmurzlef00022o1t0nemb75dd" },
    update: {
      title: "Municipal Government Enhances Public Services with Digital Portal",
      content: "Citizens can now access key municipal services, request certificates, and track application status online through the new E-LGU Portal.",
      author: "Municipal Information Office",
      category: "GOVERNMENT",
      imageUrl: "/images/municipality-digital-services-news.webp",
      isPublished: true,
      publishDate: new Date(),
    },
    create: {
      id: "cmurzlef00022o1t0nemb75dd",
      title: "Municipal Government Enhances Public Services with Digital Portal",
      content: "Citizens can now access key municipal services, request certificates, and track application status online through the new E-LGU Portal.",
      author: "Municipal Information Office",
      category: "GOVERNMENT",
      imageUrl: "/images/municipality-digital-services-news.webp",
      isPublished: true,
      publishDate: new Date(),
    },
  });

  // News 2: Health caravan
  await prisma.news.upsert({
    where: { id: "cmuryu4hi0022o1jgvvj715wf" },
    update: {
      title: "Expanded Civic Health Caravan & Mobile Clinic Schedule Announced",
      content: "Free medical check-ups, dental services, and essential medicines will be provided across all barangays starting this week to promote community healthcare access.",
      author: "Municipal Health Office",
      category: "PUBLIC HEALTH",
      imageUrl: "/images/news/health-caravan.jpg",
      isPublished: true,
      publishDate: new Date(Date.now() - 86400000), // yesterday
    },
    create: {
      id: "cmuryu4hi0022o1jgvvj715wf",
      title: "Expanded Civic Health Caravan & Mobile Clinic Schedule Announced",
      content: "Free medical check-ups, dental services, and essential medicines will be provided across all barangays starting this week to promote community healthcare access.",
      author: "Municipal Health Office",
      category: "PUBLIC HEALTH",
      imageUrl: "/images/news/health-caravan.jpg",
      isPublished: true,
      publishDate: new Date(Date.now() - 86400000),
    },
  });

  // News 3: Business & Cashless center
  await prisma.news.upsert({
    where: { id: "cmurzaydf0022o1g832m2zb1z" },
    update: {
      title: "Express One-Stop Business Licensing and Cashless Payment Windows Open",
      content: "The Treasury and Business Permits Office inaugurated modernized payment kiosks and accelerated verification counters to support local entrepreneurs.",
      author: "Business Permits & Licensing Office",
      category: "COMMERCE",
      imageUrl: "/images/news/business-licensing.jpg",
      isPublished: true,
      publishDate: new Date(Date.now() - 172800000), // 2 days ago
    },
    create: {
      id: "cmurzaydf0022o1g832m2zb1z",
      title: "Express One-Stop Business Licensing and Cashless Payment Windows Open",
      content: "The Treasury and Business Permits Office inaugurated modernized payment kiosks and accelerated verification counters to support local entrepreneurs.",
      author: "Business Permits & Licensing Office",
      category: "COMMERCE",
      imageUrl: "/images/news/business-licensing.jpg",
      isPublished: true,
      publishDate: new Date(Date.now() - 172800000),
    },
  });

  // 2. UPDATE / ENSURE ANNOUNCEMENTS (at least 3 active notices)
  // Announcement 1: Digital portal launch
  await prisma.announcement.upsert({
    where: { id: "cmurzld0m0020o1t09szfn57s" },
    update: {
      title: "Launch of the E-LGU Digital Citizen Portal",
      content: "Citizens can now apply for business permits, cedula, civil registry documents, and track transactions online 24/7.",
      priority: "HIGH",
      category: "GENERAL",
      isPinned: true,
      isActive: true,
    },
    create: {
      id: "cmurzld0m0020o1t09szfn57s",
      title: "Launch of the E-LGU Digital Citizen Portal",
      content: "Citizens can now apply for business permits, cedula, civil registry documents, and track transactions online 24/7.",
      priority: "HIGH",
      category: "GENERAL",
      isPinned: true,
      isActive: true,
    },
  });

  // Announcement 2: Office hours & Kiosk accessibility
  const ann2Title = "Advisory: Frontline Service Hours & 24/7 Kiosk Operations";
  const existingAnn2 = await prisma.announcement.findFirst({
    where: { title: ann2Title },
  });
  if (existingAnn2) {
    await prisma.announcement.update({
      where: { id: existingAnn2.id },
      data: {
        content: "Frontline offices operate Monday to Friday from 8:00 AM to 5:00 PM. Self-service kiosks remain operational 24/7 at designated civic centers.",
        priority: "NORMAL",
        category: "PUBLIC ADVISORY",
        isActive: true,
      },
    });
  } else {
    await prisma.announcement.create({
      data: {
        title: ann2Title,
        content: "Frontline offices operate Monday to Friday from 8:00 AM to 5:00 PM. Self-service kiosks remain operational 24/7 at designated civic centers.",
        priority: "NORMAL",
        category: "PUBLIC ADVISORY",
        isPinned: false,
        isActive: true,
      },
    });
  }

  // Announcement 3: Community Clean-up
  const ann3Title = "Synchronous Community Clean-Up & Environmental Sanitation Drive";
  const existingAnn3 = await prisma.announcement.findFirst({
    where: { title: ann3Title },
  });
  if (existingAnn3) {
    await prisma.announcement.update({
      where: { id: existingAnn3.id },
      data: {
        content: "All barangays are invited to participate in the synchronous river cleanup and zero-waste drive this coming Saturday starting at 6:00 AM.",
        priority: "NORMAL",
        category: "ENVIRONMENT",
        isActive: true,
      },
    });
  } else {
    await prisma.announcement.create({
      data: {
        title: ann3Title,
        content: "All barangays are invited to participate in the synchronous river cleanup and zero-waste drive this coming Saturday starting at 6:00 AM.",
        priority: "NORMAL",
        category: "ENVIRONMENT",
        isPinned: false,
        isActive: true,
      },
    });
  }

  // 3. UPDATE / ENSURE PROJECTS (at least 3 published projects)
  // Project 1: Fiber connectivity
  await prisma.project.upsert({
    where: { id: "cmurzlevo0023o1t0nza1f3vs" },
    update: {
      title: "Municipal Digital Infrastructure & Fiber Connectivity",
      description: "High-speed network linking all barangay halls, health centers, and disaster command posts.",
      category: "INFRASTRUCTURE",
      status: "ONGOING",
      location: "Townwide",
      budget: "₱15,000,000.00",
      progress: 75,
      imageUrl: "/images/projects/fiber-connectivity.webp",
      isPublished: true,
    },
    create: {
      id: "cmurzlevo0023o1t0nza1f3vs",
      title: "Municipal Digital Infrastructure & Fiber Connectivity",
      description: "High-speed network linking all barangay halls, health centers, and disaster command posts.",
      category: "INFRASTRUCTURE",
      status: "ONGOING",
      location: "Townwide",
      budget: "₱15,000,000.00",
      progress: 75,
      imageUrl: "/images/projects/fiber-connectivity.webp",
      isPublished: true,
    },
  });

  // Project 2: Multi-purpose Center
  const proj2Title = "Modernized Multi-Purpose Evacuation & Civic Center";
  const existingProj2 = await prisma.project.findFirst({
    where: { title: proj2Title },
  });
  if (existingProj2) {
    await prisma.project.update({
      where: { id: existingProj2.id },
      data: {
        description: "Resilient community hall equipped with emergency shelters, solar power backup, and medical triage facilities.",
        category: "CIVIC WORKS",
        status: "ONGOING",
        location: "Barangay Poblacion",
        budget: "₱28,500,000.00",
        progress: 60,
        imageUrl: "/images/lgu-community-illustration.svg",
        isPublished: true,
      },
    });
  } else {
    await prisma.project.create({
      data: {
        title: proj2Title,
        description: "Resilient community hall equipped with emergency shelters, solar power backup, and medical triage facilities.",
        category: "CIVIC WORKS",
        status: "ONGOING",
        location: "Barangay Poblacion",
        budget: "₱28,500,000.00",
        progress: 60,
        imageUrl: "/images/lgu-community-illustration.svg",
        isPublished: true,
      },
    });
  }

  // Project 3: Solar Lighting
  const proj3Title = "Solar-Powered Street Lighting & Civic Safety Network";
  const existingProj3 = await prisma.project.findFirst({
    where: { title: proj3Title },
  });
  if (existingProj3) {
    await prisma.project.update({
      where: { id: existingProj3.id },
      data: {
        description: "Installation of smart solar streetlights along primary thoroughfares and barangay roads for public safety.",
        category: "PUBLIC SAFETY",
        status: "COMPLETED",
        location: "Major Municipal Corridors",
        budget: "₱12,200,000.00",
        progress: 100,
        imageUrl: "/images/lgu-services-illustration.svg",
        isPublished: true,
      },
    });
  } else {
    await prisma.project.create({
      data: {
        title: proj3Title,
        description: "Installation of smart solar streetlights along primary thoroughfares and barangay roads for public safety.",
        category: "PUBLIC SAFETY",
        status: "COMPLETED",
        location: "Major Municipal Corridors",
        budget: "₱12,200,000.00",
        progress: 100,
        imageUrl: "/images/lgu-services-illustration.svg",
        isPublished: true,
      },
    });
  }

  console.log("=== SEEDING COMPLETED SUCCESSFULLY ===");
}

main()
  .catch(err => {
    console.error("Error seeding sample news/announcements:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
