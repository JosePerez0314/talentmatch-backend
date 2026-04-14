import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { matchEngine } from "../prompts/matchEnginePrompt.js";
import { calculateMatchScore } from "../utils/scoringEngine.js";

export const matchResult = async (req, res, next) => {
    const { vacancyId, candidateId, isHireFlag } = req.body;

    try {
        const vacancy = await prisma.vacancy.findUnique({
            where: { id: vacancyId },
            include: { position: true }
        });

        const rawCandidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: {
                rawApiPayload: true,
            }
        });

        if (!vacancy || !rawCandidate) return res.status(404).json({ success: false, message: "Vacancy or Candidate not found" });

        const normalizedCandidate = await matchEngine(vacancy.position, rawCandidate);

        const matchData = calculateMatchScore(vacancy.position, normalizedCandidate);

        if (isHireFlag) {
            const [matchResult, updateVacancy] = await prisma.$transaction([prisma.matchResult.create({
                data: {
                    vacancyId: vacancyId,
                    candidateId: candidateId,
                    score: matchData.score,
                    redFlags: matchData.aiAnalysis.rawTextSummary
                }
            }),
            prisma.vacancy.update({
                where: { id: vacancyId },
                data: { status: 'FILLED' }
            })
            ]);
        } else {
            const matchResult = await prisma.matchResult.create({
                data: {
                    vacancyId: vacancyId,
                    candidateId: candidateId,
                    score: matchData.score,
                    redFlags: matchData.aiAnalysis.rawTextSummary
                }
            });
        }

    } catch (error) {
        next(error)
    }
} 