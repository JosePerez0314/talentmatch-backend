interface Weights {
  TECHNICAL_SKILLS: number;
  EXPERIENCE: number;
  ROLE: number;
  LANGUAGES: number;
  EDUCATION: number;
  SOFT_SKILLS: number;
}

interface EducationLevels {
  none: number;
  "high school": number;
  associate: number;
  bachelor: number;
  master: number;
  phd: number;
}

interface Candidate {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  education: string;
  softskills: string[];
  aiAnalysis?: {
    projectHighlights?: string[];
  };
}

interface Position {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  education: string;
  softskills: string[];
}

const WEIGHTS: Weights = {
  TECHNICAL_SKILLS: 0.3,
  EXPERIENCE: 0.2,
  ROLE: 0.15,
  LANGUAGES: 0.15,
  EDUCATION: 0.1,
  SOFT_SKILLS: 0.1,
};

const EDUCATION_LEVELS: EducationLevels = {
  none: 0,
  "high school": 1,
  associate: 2,
  bachelor: 3,
  master: 4,
  phd: 5,
};

type calculatorInput<T> = {
  position: T;
  normalizedCandidate: T;
};

export const calculateMatchScore = (
  position: Position,
  normalizedCandidate: Candidate,
) => {
  let finalScore: number = 0;
  const breakdown: Record<string, { score: number; matched?: unknown[] }> = {};

  // Inputs values validation
  if (!position || !normalizedCandidate) return null;

  // Technical skills
  const candidateTechSkillsLower: string[] =
    normalizedCandidate.technicalSkills.map((s) => s.toLowerCase());

  const matchedTech: string[] = position.technicalSkills.filter((skill) =>
    candidateTechSkillsLower.includes(skill.toLowerCase()),
  );

  const techScore: number =
    position.technicalSkills.length > 0
      ? (matchedTech.length / position.technicalSkills.length) *
        (WEIGHTS.TECHNICAL_SKILLS * 100)
      : WEIGHTS.TECHNICAL_SKILLS * 100;

  finalScore += techScore;
  breakdown.technical = { score: techScore, matched: matchedTech };

  // Experience
  let expScore: number = 0;
  if (normalizedCandidate.yearsOfExperience >= position.yearsOfExperience) {
    expScore = WEIGHTS.EXPERIENCE * 100;
  } else {
    const highlights =
      normalizedCandidate.aiAnalysis?.projectHighlights ||
      normalizedCandidate.rawApiPayload?.aiAnalysis?.projectHighlights;

    if (highlights && highlights.length > 0) {
      expScore = WEIGHTS.EXPERIENCE * 50;
    } else {
      expScore =
        position.yearsOfExperience > 0
          ? (normalizedCandidate.yearsOfExperience /
              position.yearsOfExperience) *
            (WEIGHTS.EXPERIENCE * 100)
          : 0;
    }
  }
  finalScore += expScore;
  breakdown.experience = { score: expScore };

  // Role
  const roleScore =
    normalizedCandidate.role.toLowerCase() === position.role.toLowerCase()
      ? WEIGHTS.ROLE * 100
      : 0;
  finalScore += roleScore;
  breakdown.role = { score: roleScore };

  // Languages
  const candidateLanLower = normalizedCandidate.languages.map((l) =>
    l.toLowerCase(),
  );

  const matchedLan = position.languages.filter((language) =>
    candidateLanLower.includes(language.toLowerCase()),
  );
  const lanScore =
    position.languages.length > 0
      ? (matchedLan.length / position.languages.length) *
        (WEIGHTS.LANGUAGES * 100)
      : WEIGHTS.LANGUAGES * 100;
  finalScore += lanScore;
  breakdown.languages = { score: lanScore, matched: matchedLan };

  // Education
  const candidateLevel =
    EDUCATION_LEVELS[normalizedCandidate.education.toLowerCase()] || 0;
  const positionLevel = EDUCATION_LEVELS[position.education.toLowerCase()] || 0;

  const eduScore =
    candidateLevel >= positionLevel ? WEIGHTS.EDUCATION * 100 : 0;
  finalScore += eduScore;
  breakdown.education = { score: eduScore, candidateLevel, positionLevel };

  // Soft Skills
  const candidateSoftLower = normalizedCandidate.softSkills.map((sf) =>
    sf.toLowerCase(),
  );

  const matchedSoft = position.softSkills.filter((softSkill) =>
    candidateSoftLower.includes(softSkill.toLowerCase()),
  );
  const softScore =
    position.softSkills.length > 0
      ? (matchedSoft.length / position.softSkills.length) *
        (WEIGHTS.SOFT_SKILLS * 100)
      : WEIGHTS.SOFT_SKILLS * 100;
  finalScore += softScore;
  breakdown.softSkills = { score: softScore, matched: matchedSoft };

  return {
    totalScore: Math.round(finalScore),
    breakdown,
  };
};
