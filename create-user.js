import { PrismaClient } from "@prisma/client";

// Initialize with an empty object to satisfy the "non-empty" requirement 
// or leave empty if using standard generation.
const prisma = new PrismaClient({});

async function main() {
    const newUser = await prisma.user.create({
        data: {
            email: "jose.perez@talentmatch.ai",
            password: "CanadaMasterPlan2026",
        },
    });
    console.log("✅ SUCCESS: User integrated into Aiven:", newUser);
}

main()
    .catch((e) => {
        console.error("❌ Execution failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });