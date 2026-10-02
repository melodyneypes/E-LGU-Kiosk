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
  const slides = await prisma.heroSlide.findMany();
  console.log("=== HERO SLIDES (" + slides.length + ") ===");
  slides.forEach(s => console.log(`SLIDE [${s.id}]: title="${s.title}", subtitle="${s.subtitle}", img="${s.imageUrl}"`));

  const officials = await prisma.official.findMany();
  console.log("=== OFFICIALS (" + officials.length + ") ===");
  officials.forEach(o => console.log(`OFFICIAL [${o.id}]: name="${o.name}", position="${o.position}", cat="${o.category}"`));

  const settings = await prisma.systemSetting.findMany({
    where: {
      OR: [
        { key: { contains: "logo" } },
        { key: { contains: "brand" } },
        { key: { contains: "name" } },
        { key: { contains: "municipality" } }
      ]
    }
  });
  console.log("=== BRANDING SETTINGS ===");
  settings.forEach(s => console.log(`SETTING [${s.key}]: "${s.value}"`));
}

main()
  .catch(err => {
    console.error("Inspect error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
