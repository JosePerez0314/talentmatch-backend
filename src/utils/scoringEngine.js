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

    const candidateTechLower = normalizedCandidate.technicalSkills.map(s => s.toLowerCase());

    // Technical skills
    const matchedTech = position.technicalSkills.filter(skill => candidateTechLower.includes(skill.toLowerCase()));
    const techScore = position.technicalSkills.length > 0
        ? (matchedTech.length / position.technicalSkills.length) * (WEIGHTS.TECHNICAL_SKILLS * 100)
        : (WEIGHTS.TECHNICAL_SKILLS * 100);
    finalScore += techScore;
    breakdown.technical = { score: techScore, matched: matchedTech };

    // Experience
    let expScore = 0;
    if (normalizedCandidate.yearsOfExperience >= position.yearsOfExperience) {
        expScore = WEIGHTS.EXPERIENCE * 100;
    } else {
        const highlights = normalizedCandidate.aiAnalysis?.projectHighlights ||
            normalizedCandidate.rawApiPayload?.aiAnalysis?.projectHighlights;

        if (highlights && highlights.length > 0) {
            expScore = WEIGHTS.EXPERIENCE * 50;
        } else {
            expScore = position.yearsOfExperience > 0
                ? (normalizedCandidate.yearsOfExperience / position.yearsOfExperience) * (WEIGHTS.EXPERIENCE * 100)
                : 0;
        }
    }
    finalScore += expScore;
    breakdown.experience = { score: expScore };

    // Role
    const roleScore = (normalizedCandidate.role.toLowerCase() === position.role.toLowerCase() ? (WEIGHTS.ROLE * 100) : 0);
    finalScore += roleScore;
    breakdown.role = { score: roleScore };

    // Languages
    const candidateLanLower = normalizedCandidate.languages.map(l => l.toLowerCase());

    const matchedLan = position.languages.filter(language => candidateLanLower.includes(language.toLowerCase()));
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
    const candidateSoftLower = normalizedCandidate.softSkills.map(sf => sf.toLowerCase());

    const matchedSoft = position.softSkills.filter(softSkill => candidateSoftLower.includes(softSkill.toLowerCase()));
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