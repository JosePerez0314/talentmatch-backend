import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { DEFAULT_DEPARTMENTS } from "../src/utils/defaultDepartments.util.js";

const prisma = new PrismaClient();
// User by default
async function main(): Promise<void> {
  const hashedPassword: string = await bcrypt.hash("Admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@admin.ai" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@admin.ai",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  for (const title of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { title_userId: { title, userId: admin.id } },
      update: {},
      create: { title, userId: admin.id },
    });
  }

  console.log("Admin user seeded: admin@admin.ai");
  console.log(
    `Default departments ensured for admin (${DEFAULT_DEPARTMENTS.length}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
