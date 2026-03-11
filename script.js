import { PrismaClient } from "@prisma/client";

// Initialize with an empty object to satisfy the "non-empty" requirement 
// or leave empty if using standard generation.
const prisma = new PrismaClient({});

async function main() {
    // 🚀 THE NESTED WRITE: Creating both entities at the exact same time
    const newUserWithProfile = await prisma.user.create({
        data: {
            email: "bryam@talentmatch.ai",
            password: "securepassword123", // We will hash this later
            profile: {
                create: {
                    role: "Senior Backend Architect",
                    yearsOfExperience: 5,
                    technicalSkills: "Node.js, Express, MySQL, Prisma",
                    optionalTechnicalSkills: "AWS, Docker, Linux",
                    softSkills: "Leadership, Communication, Project Management",
                    description: "Highly disciplined backend engineer specializing in scalable SaaS architectures.",
                    education: "B.S. Systems Engineering",
                    languages: "Spanish (Native), English (B2)"
                }
            }
        },
        // This tells Prisma to return the profile data in the console log
        include: {
            profile: true,
        }
    });

    console.log("✅ SUCCESS: User and Profile integrated into Aiven:");
    console.dir(newUserWithProfile, { depth: null });
}

main()
    .catch((e) => {
        console.error("❌ Execution failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });