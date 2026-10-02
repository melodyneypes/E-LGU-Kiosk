import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const dbUrl = process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
console.log(`[DB URL loaded]:`, dbUrl ? "Present" : "Missing");

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const targetRfid = "0637573799";
  console.log(`[Register Admin RFID] Registering card: "${targetRfid}"`);

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
    // Check if admin@elgu.gov.ph exists
    const emailAdmin = await prisma.user.findFirst({
      where: { email: "admin@elgu.gov.ph" },
    });

    if (emailAdmin) {
      adminUser = await prisma.user.update({
        where: { id: emailAdmin.id },
        data: { role: "ADMIN", rfid: targetRfid },
      });
    } else {
      adminUser = await prisma.user.create({
        data: {
          name: "System Admin",
          email: "admin@elgu.gov.ph",
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
