import fs from "node:fs";
import path from "node:path";
import { makePdfBuffer } from "./pdf.util.js";

// Generates realistic, fully-populated CV PDFs for the upload throughput test.
// Every CV is randomized AND carries a unique reference line, so each produces a
// distinct SHA-256 hash — the upload controller dedups by hash, so identical
// content would collapse into a single candidate and defeat the load test.

const FIRST_NAMES = [
  "Sofia", "Mateo", "Valentina", "Diego", "Camila", "Lucas", "Isabella",
  "Sebastian", "Valeria", "Daniel", "Lucia", "Adrian", "Martina", "Emiliano",
  "Renata", "Thiago", "Antonella", "Bruno", "Regina", "Maximo",
] as const;

const LAST_NAMES = [
  "Garcia", "Rodriguez", "Martinez", "Lopez", "Gonzalez", "Perez", "Sanchez",
  "Ramirez", "Torres", "Flores", "Rivera", "Gomez", "Diaz", "Reyes", "Cruz",
  "Morales", "Ortiz", "Gutierrez", "Chavez", "Ramos",
] as const;

const ROLES = [
  "Backend Engineer", "Frontend Engineer", "Full Stack Developer",
  "DevOps Engineer", "Data Scientist", "Software Architect",
  "Mobile Developer", "QA Automation Engineer", "Machine Learning Engineer",
  "Cloud Engineer",
] as const;

const TECH_SKILLS = [
  "Node.js", "Express", "PostgreSQL", "MySQL", "MongoDB", "Redis", "React",
  "Next.js", "TypeScript", "JavaScript", "Docker", "Kubernetes", "AWS", "GCP",
  "CI/CD", "Microservices", "GraphQL", "Python", "FastAPI", "Go", "Terraform",
] as const;

const SOFT_SKILLS = [
  "Communication", "Teamwork", "Leadership", "Problem Solving", "Adaptability",
  "Ownership", "Mentoring", "Critical Thinking", "Time Management",
] as const;

const LANGUAGES = ["Spanish", "English", "Portuguese", "French", "German"] as const;

const EDUCATION = [
  { level: "UNIVERSITY", area: "Computer Science" },
  { level: "UNIVERSITY", area: "Software Engineering" },
  { level: "BACHELOR", area: "Information Systems" },
  { level: "MASTER", area: "Data Science" },
  { level: "TECHNICAL", area: "Web Development" },
  { level: "DOCTORATE", area: "Artificial Intelligence" },
] as const;

const UNIVERSITIES = [
  "National University", "Tech Institute", "Central University",
  "Polytechnic School", "State University",
] as const;

const COMPANIES = [
  "Google", "Amazon", "Meta", "Netflix", "Globant", "MercadoLibre",
  "StartupX", "FinTech Labs", "Cloud Systems Inc", "Nubank",
] as const;

const ACHIEVEMENTS = [
  "Improved system performance by 42% through query optimization and caching.",
  "Designed and deployed scalable microservices handling high-traffic workloads.",
  "Reduced API latency by 60% via architectural refactoring and load balancing.",
  "Led migration from a monolith to distributed microservices with zero downtime.",
  "Built high-availability backend systems sustaining 99.99% uptime.",
  "Automated the CI/CD pipeline, cutting release time from hours to minutes.",
] as const;

const pick = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const sample = <T>(arr: readonly T[], n: number): T[] => {
  const set = new Set<T>();
  while (set.size < Math.min(n, arr.length)) set.add(pick(arr));
  return [...set];
};

const buildCvText = (index: number): string => {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const role = pick(ROLES);
  const years = randomInt(2, 14);
  const education = pick(EDUCATION);
  const email = `${firstName}.${lastName}.${index}`.toLowerCase() + "@example.com";

  const experience = Array.from({ length: randomInt(3, 5) }, () => {
    const company = pick(COMPANIES);
    const start = randomInt(2013, 2021);
    const end = start + randomInt(1, 3);
    return [
      `- ${role} at ${company} (${start} - ${end})`,
      `  ${pick(ACHIEVEMENTS)}`,
      `  Collaborated with cross-functional teams across product, design and DevOps.`,
    ].join("\n");
  }).join("\n");

  // The reference line guarantees a unique file hash for dedup-free ingestion.
  const reference = `Reference ID: ${index}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  return [
    `${firstName} ${lastName}`,
    `Role: ${role}`,
    `Email: ${email}`,
    `Phone: +1 555 ${randomInt(1000, 9999)}`,
    `Location: Remote / Hybrid`,
    `Years of Experience: ${years}`,
    ``,
    `PROFESSIONAL SUMMARY`,
    `${firstName} is a ${role.toLowerCase()} with ${years} years of experience building`,
    `scalable, production-grade systems. Strong focus on clean architecture, performance`,
    `optimization, testing and cloud infrastructure in agile environments.`,
    ``,
    `TECHNICAL SKILLS`,
    sample(TECH_SKILLS, randomInt(7, 11)).join(", "),
    ``,
    `ADDITIONAL / OPTIONAL SKILLS`,
    sample(TECH_SKILLS, randomInt(2, 4)).join(", "),
    ``,
    `SOFT SKILLS`,
    sample(SOFT_SKILLS, randomInt(3, 5)).join(", "),
    ``,
    `LANGUAGES`,
    sample(LANGUAGES, randomInt(2, 3)).join(", "),
    ``,
    `PROFESSIONAL EXPERIENCE`,
    experience,
    ``,
    `EDUCATION`,
    `${education.level} degree in ${education.area} — ${pick(UNIVERSITIES)} (${randomInt(2010, 2019)})`,
    ``,
    reference,
  ].join("\n");
};

// Wipes `outDir` and writes `count` fresh CV PDFs into it, returning their
// absolute paths. Resetting the directory keeps only the latest batch on disk.
export const generateMockCvs = async (
  count: number,
  outDir: string,
): Promise<string[]> => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const paths: string[] = [];
  for (let i = 1; i <= count; i++) {
    const buffer = await makePdfBuffer(buildCvText(i));
    const filePath = path.join(
      outDir,
      `candidate-cv-${String(i).padStart(3, "0")}.pdf`,
    );
    fs.writeFileSync(filePath, buffer);
    paths.push(filePath);
  }
  return paths;
};
