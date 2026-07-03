import PDFDocument from "pdfkit";

// Builds a real in-memory PDF whose extracted text is `text`. Used only by the
// opt-in external-service tests (CV upload / position autocomplete), where the
// controller runs pdf-parse on the uploaded buffer before calling OpenAI —
// so the buffer must be a genuine PDF, not an arbitrary Buffer.
export const makePdfBuffer = (text: string): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.text(text);
    doc.end();
  });

// A CV long enough to clear the controller's 500-char quality gate.
export const SAMPLE_CV_TEXT = [
  "John Doe — Senior Backend Developer",
  "Email: john.doe@example.com",
  "Experience: 6 years building Node.js and TypeScript services on MySQL and Prisma.",
  "Led the migration of a monolith to a layered Express architecture with Zod validation.",
  "Skills: JavaScript, TypeScript, Node.js, Express, Prisma, MySQL, Docker, REST APIs.",
  "Soft skills: communication, teamwork, ownership, mentoring.",
  "Languages: English (native), Spanish (professional).",
  "Education: University degree in Computer Science.",
  "Built CV-screening pipelines and deterministic scoring engines for HR automation.",
].join("\n");

// A job description long enough to clear the /complete 300-char gate.
export const SAMPLE_POSITION_TEXT = [
  "Job title: Senior Backend Developer",
  "We are looking for a backend developer to join our HR automation platform team.",
  "Responsibilities: design and maintain REST APIs with Node.js, Express and Prisma on MySQL.",
  "Requirements: 5+ years of experience, strong TypeScript, Docker and testing skills.",
  "Nice to have: experience with AI-assisted candidate evaluation pipelines.",
  "Education: University degree in Computer Science or related field.",
  "Languages: English required, Spanish is a plus.",
].join("\n");
