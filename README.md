# TALENTMATCH AI - EXECUTIVE ARCHITECTURE SUMMARY

## 1. THE PRISMA SCHEMA (The Database)

This is where the data lives permanently in MySQL (via Aiven).

- **User:** id, email, password (hashed).
- **JobRequirement:** Linked to User. Contains the Recruiter's inputs: role, yearsOfExperience, technicalSkills, softSkills, education, languages.
- **Candidate:** Linked to User. Contains fullName, email, phoneNumber, fileUrl.
  - _CRITICAL UPDATE NEEDED:_ We must add `matchScore (Int)` and `aiAnalysis (Json)` columns to this table to store the AI's results.

## 2. THE 5-STAGE DATA FLOW (The Backend Logic)

How a Candidate moves through the Express.js server:

1.  **UPLOAD:** Candidate submits their CV -> React sends the PDF -> `multer` intercepts it.
2.  **CLOUD:** Server uploads the PDF buffer to Cloudinary -> Cloudinary returns a public `fileUrl`.
3.  **PARSE:** Server uses `pdf-parse` to read the PDF buffer -> Extracts all visual text into a single, massive raw string.
4.  **AI PROMPT:** Server pulls the `JobRequirement` from the DB. It combines the Job Data + the raw PDF string and sends them to the OpenAI API.
5.  **SAVE:** The AI returns a structured JSON result. Express takes this AI JSON, adds the `fileUrl` and `userId`, and executes `prisma.candidate.create()` to save everything.

## 3. THE AI PAYLOADS (The Intelligence)

To make this work without crashing, we have strict rules for what we send to the AI, and what the AI gives back.

### A. The REQUEST (What we send TO the AI)

We send the AI the exact job rules, plus the unstructured resume text.
{
"jobRequirement": {
"role": "Systems Engineer / Fullstack Developer",
"yearsOfExperience": 2,
"technicalSkills": "React, Node.js, Express, MySQL",
"softSkills": "Leadership, Problem Solving",
"education": "University Degree",
"languages": "English, Spanish"
},
"candidateResumeText": "RAW_EXTRACTED_STRING_FROM_PDF_PARSE_GOES_HERE"
}

### B. The RESPONSE (What we receive FROM the AI)

The AI does the heavy lifting. It parses the text, calculates the match, and returns this exact, clean JSON object so our database can save it easily.
{
"fullName": "José Gabriel Pérez Calcaño",
"role": "Systems Engineer / Fullstack Developer",
"email": "jotangamers@gmail.com",
"phoneNumber": "+1-809-555-0123",
"matchScore": 72,
"aiAnalysis": {
"experienceYears": 0,
"mandatorySkillsFound": ["React", "Node.js"],
"mandatorySkillsMissing": ["SQL"],
"optionalSkillsFound": ["Docker", "Git"],
"optionalSkillsMissing": ["AWS"],
"educationFound": ["Estudiante de Ingeniería de Software"],
"languagesFound": ["Inglés Técnico"],
"softSkillsFound": ["Liderazgo", "Resolución de problemas"]
}
}
