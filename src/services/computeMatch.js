import { matchEngine } from "../prompts/matchEnginePrompt.js";
import { calculateMatchScore } from "../utils/scoringEngine.js";

export const computeMatch = async (prisma, vacancy, candidate) => {
    const normalizedCandidate = await matchEngine(vacancy.position, rawCandidate.rawApiPayload);

    const matchData = calculateMatchScore(vacancy.position, normalizedCandidate);

    const baseData = {
        matchScore: Math.round(matchData.totalScore),

        hardSkillsScore: Math.round(matchData.breakdown.technical?.score ?? matchData.breakdown.technical ?? 0),
        experienceScore: Math.round(matchData.breakdown.experience?.score ?? 0),
        roleScore: Math.round(matchData.breakdown.role?.score ?? 0),
        languagesScore: Math.round(matchData.breakdown.languages?.score ?? 0),
        educationScore: Math.round(matchData.breakdown.education?.score ?? 0),
        softSkillsScore: Math.round(matchData.breakdown.softSkills?.score ?? 0),

        summary: normalizedCandidate.aiAnalysis.rawTextSummary,
        redFlags: normalizedCandidate.aiAnalysis.redFlags,

        normalizedCandidate: normalizedCandidate
    };

    await prisma.matchResult.upsert({
        where: {
            candidateId_vacancyId: {
                candidateId: candidate.id,
                vacancyId: vacancy.id,
            }
        },
        update: baseData,
        create: {
            candidateId: candidate.id,
            vacancyId: vacancy.id,
            ...baseData
        }
    });
}