interface CandidateExtracted {
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
    projectHighlights: string[];
  };
}

export type { CandidateExtracted };
