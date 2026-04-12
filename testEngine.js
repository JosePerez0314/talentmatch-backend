import { calculateMatchScore } from './src/utils/scoringEngine.js'; // Update with your actual path

// 1. Mock the Database Data (Notice the weird casing to test your fix)
const mockPosition = {
    role: "Backend Developer",
    yearsOfExperience: 3,
    technicalSkills: ["Node.js", "Express", "Prisma"],
    languages: ["English", "Spanish"],
    education: "Bachelor",
    softSkills: ["Communication", "Leadership"]
};

const mockCandidate = {
    role: "backend developer", // lowercase
    yearsOfExperience: 2, // Less than required, to test fallback
    rawApiPayload: { projectHighlights: ["Built a SaaS API"] },
    technicalSkills: ["node.js", "prisma", "react"], // Different casing & extra skill
    languages: ["english"], // Missing Spanish
    education: "Associate", // Lower than Bachelor
    softSkills: ["COMMUNICATION"] // ALL CAPS
};

// 2. Execute the Engine
console.log("--- RUNNING TALENTMATCH AI CORE ENGINE ---");
const result = calculateMatchScore(mockPosition, mockCandidate);

// 3. Print the Output
console.dir(result, { depth: null });