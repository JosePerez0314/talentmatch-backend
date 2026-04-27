import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";

export const getCandidates = async (req, res, next) => {
    const allCandidates = await prisma.candidate.findMany({
        where: { userId: req.user.id },
        select: {
            id: true,
            fullName: true,
            email: true,
            fileUrl: true,
            role: true,
            yearsOfExperience: true,
            technicalSkills: true,
            softSkills: true,
            description: true,
            education: true,
            languages: true,
            rawApiPayload: true,
            createdAt: true
        }
    });

    return sendResponseOr404(res, allCandidates, "Candidates");
}