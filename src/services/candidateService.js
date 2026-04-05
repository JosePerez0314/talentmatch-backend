import prisma from '../lib/prisma.js';

export const saveCandidateToDatabase = async (candidateJson, cloudinaryUrl, userId, positionId) => {
    return await prisma.candidate.create({
        data: {
            fullName: candidateJson.fullName,
            email: candidateJson.email || "no-email@talentmatch.com", // Handle empty strings
            fileUrl: cloudinaryUrl,
            role: candidateJson.role,
            yearsOfExperience: candidateJson.yearsOfExperience,
            technicalSkills: candidateJson.technicalSkills, // Prisma maps JS strings/arrays to JSON automatically
            optionalTechnicalSkills: [], // Default empty if not in your AI schema
            softSkills: candidateJson.softSkills,
            description: candidateJson.description,
            education: candidateJson.education,
            languages: candidateJson.languages,
            rawApiPayload: candidateJson, // Dump the entire raw object for the audit log
            userId: userId,
            positionId: positionId
        }
    });
}