// Testing the prisma Database

import { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const newUserWithCandidate = await prisma.user.create({
        data: {
            email: "bryam@talent.ai",
            password: "12345",

            candidate: {
                create: {
                    fullName: "Bryam Smith",
                    role: "Frontend Developer",
                    email: "bryam.candidate@talentmatch.ai", // Must be unique
                    fileUrl: "https://aws-s3-bucket.com/resumes/bryam_resume.pdf",
                    technicalSkills: "React, Tailwind CSS, JavaScript",
                    softSkills: "Teamwork, Problem Solving, UI/UX Design",
                    personalProject: true,
                    phoneNumber: "+1-809-555-0199", // Must be string
                    education: "B.S. Systems Engineering",
                    languages: "Spanish (Native), English (B1)"
                }
            },

            jobRequirement: {
                create: {
                    role: "Senior React Developer",
                    yearsOfExperience: 3,
                    technicalSkills: "React, Node.js, TypeScript",
                    optionalTechnicalSkills: "Docker, AWS",
                    softSkills: "Communication, Leadership",
                    description: "Looking for a frontend expert to lead our new dashboard project.",
                    education: "Bachelor's Degree",
                    languages: "English, Spanish"
                }
            }
        },
        // Tell Prisma to return the nested candidate data in the console log
        include: {
            candidate: true,
            jobRequirement: true,
        }
    });

    console.log("✅ SUCCESS: User and Candidate integrated into Aiven:");
    console.dir(newUserWithCandidate, { depth: null }); // Forcing the terminal to show me everything
}

main()
    .catch((e) => {
        console.error("❌ Execution failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });