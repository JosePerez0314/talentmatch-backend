import { calculateMatchScore } from "./src/utils/scoringEngine";

const position = {
  role: "Backend Node.js Developer",
  yearsOfExperience: 3,
  technicalSkills: ["Node.js", "Express", "MySQL", "TypeScript"],
  optionalTechnicalSkills: ["Docker", "Redis"],
  softSkills: ["Communication", "Problem Solving"],
  languages: ["Spanish", "English"],
  education: "Computer Sciences",
  educationLevel: "university",
};

// Test 1: Strong candidate — should score high
const strongCandidate = {
  role: "Backend Node.js Developer",
  yearsOfExperience: 4,
  technicalSkills: ["Node.js", "Express", "MySQL", "TypeScript"],
  softSkills: ["Communication", "Problem Solving"],
  languages: ["Spanish", "English"],
  education: "university computer sciences",
  aiAnalysis: {
    projectHighlights: [
      "Built a multi-tenant REST API using Express and MySQL.",
      "Migrated monolith to modular architecture reducing response time by 40%.",
    ],
  },
};

// Test 2: Weak candidate — missing skills, low experience, wrong role
const weakCandidate = {
  role: "Frontend Developer",
  yearsOfExperience: 1,
  technicalSkills: ["React", "CSS"],
  softSkills: ["Teamwork"],
  languages: ["Spanish"],
  education: "high_school",
  aiAnalysis: {
    projectHighlights: [],
  },
};

// Test 3: Partial candidate — under experience but has project highlights
const partialCandidate = {
  role: "Backend Node.js Developer",
  yearsOfExperience: 1,
  technicalSkills: ["Node.js", "Express"],
  softSkills: ["Problem Solving"],
  languages: ["Spanish", "English"],
  education: "university systems engineering",
  aiAnalysis: {
    projectHighlights: [
      "Developed REST API with Node.js and Express for an e-commerce platform.",
    ],
  },
};

// Test 4: Position with no education requirement (none)
const positionNoEducation = {
  ...position,
  educationLevel: "none",
};

const results = [
  {
    label: "Strong Candidate",
    result: calculateMatchScore(position, strongCandidate),
  },
  {
    label: "Weak Candidate",
    result: calculateMatchScore(position, weakCandidate),
  },
  {
    label: "Partial Candidate (low exp + highlights)",
    result: calculateMatchScore(position, partialCandidate),
  },
  {
    label: "No Education Required + Strong Candidate",
    result: calculateMatchScore(positionNoEducation, strongCandidate),
  },
];

results.forEach(({ label, result }) => {
  console.log(`\n===== ${label} =====`);
  console.log(`Total Score: ${result.totalScore}/100`);
  console.log("Breakdown:", JSON.stringify(result.breakdown, null, 2));
});
