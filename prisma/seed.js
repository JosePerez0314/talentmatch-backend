import prisma from "../src/lib/prisma";
import bcrypt from "bcrypt";

// User by default
async function main() {
    const hashedPassword = await bcrypt.hash("Admin123", 10);

    await prisma.user.upsert({
        where: { email: 'admin@admin.ai' },
        update: {},
        create: {
            email: "admin@admin.ai",
            password: hashedPassword,
        },
    });
    console.log("Demo user seeded: admin@admin.ai")
};

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());