import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "mock_cvs");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// -------------------- DATA --------------------
const roles = [
    "Backend Engineer",
    "Frontend Engineer",
    "Full Stack Developer",
    "DevOps Engineer",
    "Data Scientist",
    "Software Architect"
];

const skills = [
    "Node.js", "Express", "PostgreSQL", "MongoDB", "Redis",
    "React", "Next.js", "TypeScript", "Docker",
    "AWS", "CI/CD", "Microservices", "System Design",
    "Python", "FastAPI", "Kubernetes"
];

const companies = [
    "Google", "Amazon", "Meta", "Netflix",
    "StartupX", "FinTech Labs", "Cloud Systems Inc"
];

const achievements = [
    "Improved system performance by 42% through query optimization and caching strategies.",
    "Designed and deployed scalable microservices handling high traffic workloads.",
    "Reduced API latency by 60% through architectural refactoring and load balancing.",
    "Led migration from monolithic architecture to distributed microservices.",
    "Built high-availability backend systems with 99.99% uptime.",
    "Optimized database indexing improving response time significantly."
];

// -------------------- HELPERS --------------------
const generateSkills = () =>
    Array.from({ length: randomInt(6, 12) }, () => rand(skills)).join(", ");

const generateExperience = (name) => {
    let text = "";

    for (let i = 0; i < randomInt(4, 7); i++) {
        text += `
- ${rand(companies)}:
  Worked as a ${rand(roles)} contributing to backend architecture and system scalability.
  ${rand(achievements)}
  Collaborated with cross-functional teams including frontend, DevOps, and product managers.
`;
    }

    return text;
};

// -------------------- GENERATOR --------------------
console.log("Generating 100 VALID CVs (500+ char safe)...");

for (let i = 1; i <= 100; i++) {
    const doc = new PDFDocument({
        margin: 50,
        size: "A4"
    });

    const filePath = path.join(outputDir, `Candidate_CV_${i}.pdf`);
    doc.pipe(fs.createWriteStream(filePath));

    const name = `Candidate ${i}`;

    let fullTextBuffer = "";

    doc.fontSize(22).text(name, { align: "center" });
    doc.moveDown();

    doc.fontSize(12);
    const role = rand(roles);

    const header = `
Role: ${role}
Email: candidate${i}@example.com
Years of Experience: ${randomInt(1, 12)}
Location: Remote / Hybrid
`;

    doc.text(header);
    fullTextBuffer += header;

    doc.moveDown();

    // SKILLS
    const skillsText = `
TECHNICAL SKILLS:
${generateSkills()}
`;
    doc.fontSize(14).text("Technical Skills");
    doc.fontSize(11).text(skillsText);
    fullTextBuffer += skillsText;

    doc.moveDown();

    // EXPERIENCE (MAIN FIX FOR YOUR ISSUE)
    const experienceText = `
PROFESSIONAL EXPERIENCE:
${generateExperience(name)}
`;
    doc.fontSize(14).text("Experience");
    doc.fontSize(11).text(experienceText);
    fullTextBuffer += experienceText;

    doc.moveDown();

    // SUMMARY (ENSURES EXTRA TEXT DEPTH)
    const summaryText = `
SUMMARY:
Experienced software engineer with strong background in scalable systems, distributed architecture, cloud infrastructure, and backend engineering. Focused on performance optimization, clean architecture, and production-grade systems. Proven ability to design and maintain high-scale applications in agile environments.
`;

    doc.fontSize(14).text("Summary");
    doc.fontSize(11).text(summaryText);
    fullTextBuffer += summaryText;

    doc.end();

    // OPTIONAL DEBUG (uncomment if needed)
    // console.log(`CV ${i} chars:`, fullTextBuffer.length);
}

console.log("✅ 100 CVs generated with guaranteed 500+ extractable characters.");