import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "src", "lgu.config.json"), "utf8")
);
const reset = config.defaults.databaseReset;
const dbUrl =
  process.env.DIRECT_URL ||
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== STARTING GENERIC LGU CONTENT RESET ===");

  const heroImages = [
    config.assets.welcomeSlide,
    config.assets.servicesSlide,
    config.assets.announcementsSlide,
  ];
  const heroSlides = await prisma.heroSlide.findMany();
  for (const [index, slide] of heroSlides.entries()) {
    await prisma.heroSlide.update({
      where: { id: slide.id },
      data: {
        title: config.defaults.hero.title,
        subtitle: config.defaults.hero.subtitle,
        tagline: config.defaults.hero.tagline,
        imageUrl: heroImages[index % heroImages.length],
      },
    });
  }

  await prisma.official.deleteMany({});
  for (const [index, official] of config.defaults.officials.entries()) {
    await prisma.official.create({
      data: {
        name: official.name,
        position: official.position,
        category: official.category,
        order: index + 1,
        isActive: false,
        imageUrl: null,
        motto: official.motto,
      },
    });
  }

  const settings = [
    { key: "site_logo", value: config.assets.logo },
    { key: "kiosk_logo_url", value: config.assets.logo },
    { key: "portal_name", value: config.identity.lguName },
    { key: "bank_account_name", value: reset.bankAccountName },
    { key: "brand_word_1", value: reset.brandWord1 },
    { key: "brand_word_2", value: reset.brandWord2 },
  ];
  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  await prisma.news.updateMany({
    data: {
      title: reset.news.title,
      content: reset.news.content,
      author: reset.news.author,
      category: reset.news.category,
      imageUrl: null,
      barangay: null,
      isPublished: false,
    },
  });
  await prisma.announcement.updateMany({
    data: {
      title: reset.announcement.title,
      content: reset.announcement.content,
      category: reset.announcement.category,
      barangay: null,
      imageUrl: null,
      isPinned: false,
      isActive: false,
    },
  });
  await prisma.hotline.updateMany({
    data: {
      name: reset.hotline.name,
      category: reset.hotline.category,
      mobileNumber: null,
      telephone: null,
      address: null,
      isActive: false,
    },
  });
  await prisma.project.updateMany({
    data: {
      title: reset.project.title,
      description: reset.project.description,
      category: reset.project.category,
      status: reset.project.status,
      location: reset.project.location,
      budget: null,
      contractor: null,
      imageUrl: null,
      barangay: null,
      isPublished: false,
    },
  });

  console.log(
    "Reset kiosk display content. Review database barangay records, service fees, forms, and private resident data separately."
  );
}

main()
  .catch((error) => {
    console.error("Generic LGU content reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
