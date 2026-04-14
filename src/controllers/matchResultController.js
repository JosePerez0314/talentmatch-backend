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

        const dataMatchScore = {
            // FIX 1: Use Prisma's relational 'connect' syntax
            vacancy: { connect: { id: vacancyId } },
            candidate: { connect: { id: candidateId } },

            // FIX 2: Target the .score property and round it to an Integer
            matchScore: Math.round(matchData.totalScore),

            // Note: Make sure 'technical' is the correct key from your scoring engine!
            hardSkillsScore: Math.round(matchData.breakdown.technical?.score ?? matchData.breakdown.technical ?? 0),
            experienceScore: Math.round(matchData.breakdown.experience?.score ?? 0),
            roleScore: Math.round(matchData.breakdown.role?.score ?? 0),
            languagesScore: Math.round(matchData.breakdown.languages?.score ?? 0),
            educationScore: Math.round(matchData.breakdown.education?.score ?? 0),
            softSkillsScore: Math.round(matchData.breakdown.softSkills?.score ?? 0),

            summary: normalizedCandidate.aiAnalysis.rawTextSummary,
            redFlags: normalizedCandidate.aiAnalysis.redFlags,
        };

        if (isHireFlag) {
            const [matchResult, updateVacancy] = await prisma.$transaction([prisma.matchResult.create({
                data: {
                    ...dataMatchScore
                }
            }),
            prisma.vacancy.update({
                where: { id: vacancyId },
                data: { status: 'FILLED' }
            })

            ]);
            return sendResponseOr404(res, { matchResult, updateVacancy }, "Candidate Hired and Vacancy Filled");
        } else {
            const matchResult = await prisma.matchResult.create({
                data: {
                    ...dataMatchScore
                }
            });

            return sendResponseOr404(res, matchResult, "Match Result");
        }
    } catch (error) {
        next(error)
    }
} 