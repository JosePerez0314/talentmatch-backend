import { generateCvHash } from "../utils/hash.util.js";
import prisma from "../lib/prisma.js"
import { extractCandidateData } from "../prompts/extractCvPrompt.js";

export const processCandidateCv = async (parsedText, userId) => {
    const cvHash = generateCvHash(parsedText);

    // Cache check (FAST PATH)
    const existingProfile = await prisma.candidate.findUnique({
        where: { hash: cvHash }
    });

    if (existingProfile) {
        console.log("CACHE HIT");
        return {             // <500ms response
            candidate: existingProfile,
            cacheHit: true
        }
    }

    console.log("CACHE MISS --> Calling OPenAI");

    const rawCandidate = await extractCandidateData(parsedText, userId);

    const newCandidate = await prisma.candidate.create({
        data: {
            hash: cvHash,
            userId,
            fullName: rawCandidate.fullName,
            email: rawCandidate.email || "no-email@talentmatch.com", // Handle empty strings
            role: rawCandidate.role,
            yearsOfExperience: rawCandidate.yearsOfExperience,
            technicalSkills: rawCandidate.technicalSkills, // Prisma maps JS strings/arrays to JSON automatically
            optionalTechnicalSkills: [], // Default empty if not in your AI schema
            softSkills: rawCandidate.softSkills,
            description: rawCandidate.description,
            education: rawCandidate.education,
            languages: rawCandidate.languages,
            rawApiPayload: rawCandidate, // Dump the entire raw object for the audit log
        }
    });

    console.log("=== DEBUG CV HASH PIPELINE ===");
    console.log("HASH:", cvHash);
    console.log("TEXT PREVIEW:", parsedText.slice(0, 120));
    console.log("TEXT LENGTH:", parsedText.length);

    return {
        candidate: newCandidate,
        cacheHit: false
    };
}