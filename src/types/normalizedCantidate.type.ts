interface NormalizedCandidate {
  fullName: string;
  email: string;
  role: string;
  yearsOfExperience: number;
  technicalSkills: string[];
  optionalTechnicalSkills: string[];
  softSkills: string[];
  description: string;
  educationLevel: string;
  educationArea: string;
  languages: string[];
  aiAnalysis: {
    rawTextSummary: string;
    redFlags: string;
    projectHighlights: string[];
  };
}

export type { NormalizedCandidate };
