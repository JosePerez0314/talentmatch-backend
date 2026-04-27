import prisma from "../src/lib/prisma.js";
import bcrypt from "bcrypt";

// User by default
async function main() {
    const hashedPassword = await bcrypt.hash("Admin123", 10);

    await prisma.user.upsert({
        where: { email: 'admin@admin.ai' },
        update: { role: "ADMIN" },
        create: {
            email: "admin@admin.ai",
            password: hashedPassword,
            role: "ADMIN"
        },
    });

    console.log("Admin user seeded: admin@admin.ai");
};

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());