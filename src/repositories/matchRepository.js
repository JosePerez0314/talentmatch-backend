export const upsertMatchResult = async (prisma, result, userId) => {
    return await prisma.matchResult.upsert({
        where: {
            candidateId_vacancyId: {
                candidateId: result.candidateId,
                vacancyId: result.vacancyId,
            }
        },
        update: {
            matchScore: result.matchScore,
            hardSkillsScore: result.hardSkillsScore,
            experienceScore: result.experienceScore,
            roleScore: result.roleScore,
            languagesScore: result.languagesScore,
            educationScore: result.educationScore,
            softSkillsScore: result.softSkillsScore,
            summary: result.summary,
            redFlags: result.redFlags,
            normalizedCandidate: result.normalizedCandidate
        },
        create: {
            candidateId: result.candidateId,
            vacancyId: result.vacancyId,
            matchScore: result.matchScore,
            hardSkillsScore: result.hardSkillsScore,
            experienceScore: result.experienceScore,
            roleScore: result.roleScore,
            languagesScore: result.languagesScore,
            educationScore: result.educationScore,
            softSkillsScore: result.softSkillsScore,
            summary: result.summary,
            redFlags: result.redFlags,
            normalizedCandidate: result.normalizedCandidate
        }
    });
};