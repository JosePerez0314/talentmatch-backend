const WEIGHTS = {
    TECHNICAL_SKILLS: 0.30,
    EXPERIENCE: 0.20,
    ROLE: 0.15,
    LANGUAGES: 0.15,
    EDUCATION: 0.10,
    SOFT_SKILLS: 0.10
}

const EDUCATION_LEVELS = {
    "none": 0,
    "high school": 1,
    "associate": 2,
    "bachelor": 3,
    "master": 4,
    "phd": 5
};

export const calculateMatchScore = (position, normalizedCandidate) => {
    let finalScore = 0;
    const breakdown = {};

    // Technical skills
    const matchedTech = position.technicalSkills.filter(skill => normalizedCandidate.technicalSkills.includes(skill));
    const techScore = position.technicalSkills.length > 0
        ? (matchedTech.length / position.technicalSkills.length) * (WEIGHTS.TECHNICAL_SKILLS * 100)
        : (WEIGHTS.TECHNICAL_SKILLS * 100);
    finalScore += techScore;
    breakdown.technical = { score: techScore, matched: matchedTech };

    // Experience
    let expScore = 0;
    if (normalizedCandidate.yearsOfExperience >= position.yearsOfExperience) {
        expScore = WEIGHTS.EXPERIENCE * 100;
    } else if (normalizedCandidate.rawApiPayload.projectHighlights.length > 0) {
        expScore = WEIGHTS.EXPERIENCE * 50;
    } else {
        expScore = (normalizedCandidate.yearsOfExperience / position.yearsOfExperience) * (WEIGHTS.EXPERIENCE * 100);
    }
    finalScore += expScore;
    breakdown.experience = { score: expScore };

    // Role
    const roleScore = (normalizedCandidate.role.toLowerCase() === position.role.toLowerCase() ? (WEIGHTS.ROLE * 100) : 0);
    finalScore += roleScore;
    breakdown.role = { score: roleScore };

    // Languages
    const matchedLan = position.languages.filter(language => normalizedCandidate.languages.includes(language));
    const lanScore = position.languages.length > 0
        ? (matchedLan.length / position.languages.length) * (WEIGHTS.LANGUAGES * 100)
        : (WEIGHTS.LANGUAGES * 100);
    finalScore += lanScore;
    breakdown.languages = { score: lanScore, matched: matchedLan };

    // Education
    const candidateLevel = EDUCATION_LEVELS[normalizedCandidate.education.toLowerCase()] || 0;
    const positionLevel = EDUCATION_LEVELS[position.education.toLowerCase()] || 0;

    const eduScore = candidateLevel >= positionLevel ? (WEIGHTS.EDUCATION * 100) : 0;
    finalScore += eduScore;
    breakdown.education = { score: eduScore, candidateLevel, positionLevel };

    // Soft Skills
    const matchedSoft = position.softSkills.filter(softSkill => normalizedCandidate.softSkills.includes(softSkill));
    const softScore = position.softSkills.length > 0
        ? (matchedSoft.length / position.softSkills.length) * (WEIGHTS.SOFT_SKILLS * 100)
        : (WEIGHTS.SOFT_SKILLS * 100)
    finalScore += softScore;
    breakdown.softSkills = { score: softScore, matched: matchedSoft }

    return {
        totalScore: Math.round(finalScore),
        breakdown
    };
};