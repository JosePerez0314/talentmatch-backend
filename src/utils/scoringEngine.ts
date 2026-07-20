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
  educationLevel: string;
  educationArea: string;
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
  educationArea: string;
  softSkills: string[];
}

const WEIGHTS: Weights = {
  TECHNICAL_SKILLS: 0.3,
  EXPERIENCE: 0.2,
  ROLE: 0.15,
  LANGUAGES: 0.15,
  EDUCATION: 0.1,
  SOFT_SKILLS: 0.1,
};

// Ordinal ladder used for proportional education scoring. The order here is
// the real-world academic hierarchy and is intentionally independent of the
// declaration order of the `EducationLevel` Prisma enum: a base university
// degree (BACHELOR) outranks a TECHNICAL one, so partial credit degrades the
// way a recruiter expects.
const EDUCATION_LEVELS: Record<string, number> = {
  NONE: 0,
  HIGH_SCHOOL: 1,
  TECHNICAL: 2,
  BACHELOR: 3,
  UNIVERSITY: 4,
  MASTER: 5,
  DOCTORATE: 6,
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
    // Always compute the proportional value the candidate earned on raw years
    // first, so the lifesaver can never take points away from them.
    const proportionalScore: number =
      position.yearsOfExperience > 0
        ? (normalizedCandidate.yearsOfExperience / position.yearsOfExperience) *
          (WEIGHTS.EXPERIENCE * 100)
        : 0;

    const highlights: string[] =
      normalizedCandidate.aiAnalysis?.projectHighlights || [];

    // Lifesaver: strong personal projects act as a minimum floor for junior
    // profiles, never as a cap — the higher of the two always wins.
    expScore =
      highlights.length > 0
        ? Math.max(proportionalScore, WEIGHTS.EXPERIENCE * 50)
        : proportionalScore;
  }
  finalScore += expScore;
  breakdown.experience = { score: expScore };

  // Role
  // Bidirectional containment instead of strict equality: it absorbs minor
  // semantic drift and compound titles ("Backend Developer" vs "Senior Backend
  // Developer") without wiping out 15 points over a wording mismatch.
  const positionRole: string = position.role.trim().toLowerCase();
  const candidateRole: string = normalizedCandidate.role.trim().toLowerCase();

  // Guard against empty strings: "".includes("") is true, so an unguarded
  // check would award full points to a candidate with no role at all.
  const roleMatches: boolean =
    positionRole.length > 0 &&
    candidateRole.length > 0 &&
    (candidateRole.includes(positionRole) ||
      positionRole.includes(candidateRole));

  const roleScore: number = roleMatches ? WEIGHTS.ROLE * 100 : 0;
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
    return EDUCATION_LEVELS[education.toUpperCase()] ?? 0;
  };

  const positionEduLevel: number = getEducationLevel(position.educationLevel);
  const candidateEduLevel: number = getEducationLevel(
    normalizedCandidate.educationLevel,
  );

  educationScore =
    positionEduLevel === 0 || candidateEduLevel >= positionEduLevel
      ? WEIGHTS.EDUCATION * 100
      : (candidateEduLevel / positionEduLevel) * (WEIGHTS.EDUCATION * 100);

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
