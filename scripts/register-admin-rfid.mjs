import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const dbUrl = process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
console.log(`[DB URL loaded]:`, dbUrl ? "Present" : "Missing");
const lguConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), "src", "lgu.config.json"), "utf8")
);

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const targetRfid = lguConfig.identity.adminRfidUid;
  const adminEmail = lguConfig.identity.adminEmail;
  const adminName = lguConfig.identity.adminName;
  if ([targetRfid, adminEmail, adminName].some(
    (value) => typeof value !== "string" || value.includes("{{")
  )) {
    throw new Error("Configure identity.adminRfidUid, identity.adminEmail, and identity.adminName first.");
  }
  console.log("[Register Admin RFID] Registering configured admin card.");

  // 1. Clear this RFID from any other user or resident to avoid unique constraint violations
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET rfid = NULL WHERE rfid = $1`,
    targetRfid
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Resident" SET rfid = NULL WHERE rfid = $1`,
    targetRfid
  );

  // 2. Find an existing ADMIN user or create one
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  let adminUser;
  if (existingAdmin) {
    adminUser = await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { rfid: targetRfid },
    });
    console.log(`[Success] Updated existing ADMIN user:`, {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      rfid: adminUser.rfid,
    });
  } else {
    const emailAdmin = await prisma.user.findFirst({
      where: { email: adminEmail },
    });

    if (emailAdmin) {
      adminUser = await prisma.user.update({
        where: { id: emailAdmin.id },
        data: { role: "ADMIN", rfid: targetRfid },
      });
    } else {
      adminUser = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          role: "ADMIN",
          rfid: targetRfid,
        },
      });
    }
    console.log(`[Success] Created/Updated ADMIN user:`, {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      rfid: adminUser.rfid,
    });
  }

  // 3. Verify via query matching /api/admin-rfid
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, email, role, rfid FROM "User" WHERE rfid = $1 LIMIT 1`,
    targetRfid
  );
  console.log(`[Verification] Query result:`, rows);
}

main()
  .catch((err) => {
    console.error(`[Error] Failed to register admin RFID:`, err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
