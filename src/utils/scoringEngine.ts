interface Weights {
  TECHNICAL_SKILLS: number;
  EXPERIENCE: number;
  ROLE: number;
  LANGUAGES: number;
  EDUCATION: number;
  SOFT_SKILLS: number;
}

interface Candidate {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  education: string;
  softSkills: string[];
  aiAnalysis?: {
    projectHighlights?: string[];
  };
}

interface Position {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  educationLevel: string;
  education: string;
  softSkills: string[];
}

interface EducationsLevels {
  none: number;
  high_school: number;
  university: number;
  masters: number;
  doctorate: number;
}

const WEIGHTS: Weights = {
  TECHNICAL_SKILLS: 0.3,
  EXPERIENCE: 0.2,
  ROLE: 0.15,
  LANGUAGES: 0.15,
  EDUCATION: 0.1,
  SOFT_SKILLS: 0.1,
};

const EDUCATION_LEVELS: EducationsLevels = {
  none: 0,
  high_school: 1,
  university: 2,
  masters: 3,
  doctorate: 4,
};

interface MatchScoreResult {
  totalScore: number;
  breakdown: Record<string, { score: number; matched?: unknown[] }>;
}

export const calculateMatchScore = (
  position: Position,
  normalizedCandidate: Candidate,
): MatchScoreResult => {
  let finalScore: number = 0;
  const breakdown: Record<string, { score: number; matched?: unknown[] }> = {};

  // Inputs values validation
  if (!position || !normalizedCandidate) return { totalScore: 0, breakdown };

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
    const highlights: string[] =
      normalizedCandidate.aiAnalysis?.projectHighlights || [];

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
  const roleScore: number =
    normalizedCandidate.role.toLowerCase() === position.role.toLowerCase()
      ? WEIGHTS.ROLE * 100
      : 0;
  finalScore += roleScore;
  breakdown.role = { score: roleScore };

  // Languages
  const candidateLanLower: string[] = normalizedCandidate.languages.map((l) =>
    l.toLowerCase(),
  );

  const matchedLan: string[] = position.languages.filter((language) =>
    candidateLanLower.includes(language.toLowerCase()),
  );
  const lanScore: number =
    position.languages.length > 0
      ? (matchedLan.length / position.languages.length) *
        (WEIGHTS.LANGUAGES * 100)
      : WEIGHTS.LANGUAGES * 100;
  finalScore += lanScore;
  breakdown.languages = { score: lanScore, matched: matchedLan };

  // Education

  let educationScore: number = 0;

  const getEducationLevel = (education: string): number => {
    for (const [key, value] of Object.entries(EDUCATION_LEVELS)) {
      if (education.toLocaleLowerCase().includes(key)) return value;
    }
    return 0;
  };

  const positionEduLevel: number = getEducationLevel(
    position.educationLevel.toLowerCase() ?? 0,
  );
  const candidateEduLevel: number = getEducationLevel(
    normalizedCandidate.education,
  );

  educationScore =
    positionEduLevel === 0 || candidateEduLevel >= positionEduLevel
      ? WEIGHTS.EDUCATION * 100
      : 0;

  finalScore += educationScore;
  breakdown.education = { score: educationScore };

  // Soft Skills
  const candidateSoftLower: string[] = normalizedCandidate.softSkills.map(
    (sf) => sf.toLowerCase(),
  );

  const matchedSoft: string[] = position.softSkills.filter((softSkill) =>
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
